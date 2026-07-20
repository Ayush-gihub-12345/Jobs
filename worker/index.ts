import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  detectAts, fetchJobsForSource, buildManualJobs, slugify, blockedHostReason,
  type ManualJobInput, type NormalizedJob,
} from "./ingest";
import { hashJob } from "./hash";
import { extractSkills, parseExperience, isIndiaLocation, SKILLS } from "./extract";
import { verifyFirebaseToken, type FirebaseUser } from "./firebaseAuth";

interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
  FIREBASE_PROJECT_ID: string;
}

type App = { Bindings: Env; Variables: { user: FirebaseUser } };
const app = new Hono<App>();

/* ---------------- auth ---------------- */

const SESSION_COOKIE = "admin_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function makeToken(secret: string): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await hmac(secret, exp)}`;
}

async function verifyToken(secret: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return (await hmac(secret, exp)) === sig;
}

async function requireAdmin(c: any): Promise<boolean> {
  return verifyToken(c.env.ADMIN_PASSWORD, getCookie(c, SESSION_COOKIE));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

app.post("/api/admin/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  const validUser = !!username && timingSafeEqual(username, c.env.ADMIN_USERNAME);
  const validPass = !!password && timingSafeEqual(password, c.env.ADMIN_PASSWORD);
  if (!validUser || !validPass) {
    return c.json({ error: "Invalid username or password" }, 401);
  }
  setCookie(c, SESSION_COOKIE, await makeToken(c.env.ADMIN_PASSWORD), {
    httpOnly: true, sameSite: "Strict", path: "/", maxAge: SESSION_TTL_MS / 1000,
  });
  return c.json({ ok: true });
});

app.post("/api/admin/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/admin/me", async (c) => {
  return c.json({ authenticated: await requireAdmin(c) });
});

app.use("/api/admin/*", async (c, next) => {
  const open = ["/api/admin/login", "/api/admin/logout", "/api/admin/me"];
  if (open.includes(c.req.path)) return next();
  if (!(await requireAdmin(c))) return c.json({ error: "Unauthorized" }, 401);
  return next();
});

/* ---------------- end-user auth (Firebase) ---------------- */

async function requireUser(c: any, next: any) {
  const authHeader = c.req.header("Authorization") ?? "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const user = await verifyFirebaseToken(idToken, c.env.FIREBASE_PROJECT_ID);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  await c.env.DB.prepare(`
    INSERT INTO users (uid, email, name) VALUES (?, ?, ?)
    ON CONFLICT(uid) DO UPDATE SET email = excluded.email, name = excluded.name, last_login_at = datetime('now')
  `).bind(user.uid, user.email, user.name).run();

  c.set("user", user);
  await next();
}

app.use("/api/me/*", requireUser);

app.get("/api/me", (c) => {
  const user = c.get("user");
  return c.json({ uid: user.uid, email: user.email, name: user.name });
});

app.get("/api/me/preferences", async (c) => {
  const uid = c.get("user").uid;
  const row = await c.env.DB.prepare(`SELECT * FROM preferences WHERE uid = ?`).bind(uid).first<any>();
  if (!row) {
    return c.json({
      locations: [], remoteOnly: false, salaryMin: null, salaryMax: null, currency: "USD",
      jobTypes: [], categories: [], skills: [], experienceLevel: null,
    });
  }
  return c.json({
    locations: JSON.parse(row.locations),
    remoteOnly: !!row.remote_only,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    currency: row.currency,
    jobTypes: JSON.parse(row.job_types),
    categories: JSON.parse(row.categories),
    skills: JSON.parse(row.skills),
    experienceLevel: row.experience_level,
  });
});

app.put("/api/me/preferences", async (c) => {
  const uid = c.get("user").uid;
  const body = await c.req.json<{
    locations?: string[]; remoteOnly?: boolean; salaryMin?: number | null; salaryMax?: number | null;
    currency?: string; jobTypes?: string[]; categories?: string[]; skills?: string[]; experienceLevel?: string | null;
  }>();
  await c.env.DB.prepare(`
    INSERT INTO preferences (uid, locations, remote_only, salary_min, salary_max, currency, job_types, categories, skills, experience_level, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(uid) DO UPDATE SET
      locations=excluded.locations, remote_only=excluded.remote_only, salary_min=excluded.salary_min,
      salary_max=excluded.salary_max, currency=excluded.currency, job_types=excluded.job_types,
      categories=excluded.categories, skills=excluded.skills, experience_level=excluded.experience_level,
      updated_at=datetime('now')
  `).bind(
    uid, JSON.stringify(body.locations ?? []), body.remoteOnly ? 1 : 0,
    body.salaryMin ?? null, body.salaryMax ?? null, body.currency ?? "USD",
    JSON.stringify(body.jobTypes ?? []), JSON.stringify(body.categories ?? []),
    JSON.stringify(body.skills ?? []), body.experienceLevel ?? null
  ).run();
  return c.json({ ok: true });
});

/* ---------------- sync engine ---------------- */

const UPSERT_JOB_SQL = `
  INSERT INTO jobs (source_id, external_id, title, company, location, remote, job_type, level,
                    exp_min, exp_max, role_category, skills, description, apply_url, posted_at, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(source_id, external_id) DO UPDATE SET
    title=excluded.title, company=excluded.company, location=excluded.location,
    remote=excluded.remote, job_type=excluded.job_type, level=excluded.level,
    exp_min=excluded.exp_min, exp_max=excluded.exp_max, role_category=excluded.role_category,
    skills=excluded.skills, description=excluded.description,
    apply_url=excluded.apply_url, posted_at=excluded.posted_at, content_hash=excluded.content_hash
`;

function bindUpsert(stmt: D1PreparedStatement, sourceId: number, company: string, j: NormalizedJob, hash: string) {
  return stmt.bind(
    sourceId, j.externalId, j.title, company, j.location, j.remote ? 1 : 0,
    j.jobType, j.level, j.expMin, j.expMax, j.roleCategory,
    JSON.stringify(j.skills), j.description, j.applyUrl, j.postedAt, hash
  );
}

async function runBatched(db: D1Database, stmts: D1PreparedStatement[]) {
  // D1 batches are transactional; chunk to stay under per-batch statement limits
  for (let i = 0; i < stmts.length; i += 90) {
    await db.batch(stmts.slice(i, i + 90));
  }
}

/**
 * Used for hand-pasted (manual) sources only — small, infrequent, simplicity beats efficiency here.
 */
async function replaceSourceJobs(db: D1Database, sourceId: number, company: string, jobs: NormalizedJob[]) {
  const stmts: D1PreparedStatement[] = [db.prepare(`DELETE FROM jobs WHERE source_id = ?`).bind(sourceId)];
  const upsert = db.prepare(UPSERT_JOB_SQL);
  for (const j of jobs) stmts.push(bindUpsert(upsert, sourceId, company, j, hashJob(j)));
  stmts.push(db.prepare(
    `UPDATE sources SET status='ok', error=NULL, company=?, job_count=?, last_fetched_at=datetime('now') WHERE id=?`
  ).bind(company, jobs.length, sourceId));
  await runBatched(db, stmts);
}

/**
 * Used for the hourly ATS sync. Diffs against stored content hashes so unchanged jobs
 * (the overwhelming majority on any given hour) never trigger a write — this is what keeps
 * the site inside D1's free-tier row-write quota as more sources are added.
 */
async function diffSyncJobs(db: D1Database, sourceId: number, company: string, jobs: NormalizedJob[]) {
  const { results: existing } = await db.prepare(
    `SELECT external_id, content_hash FROM jobs WHERE source_id = ?`
  ).bind(sourceId).all<{ external_id: string; content_hash: string | null }>();
  const existingHash = new Map(existing.map((r) => [r.external_id, r.content_hash]));
  const incomingIds = new Set(jobs.map((j) => j.externalId));

  const stmts: D1PreparedStatement[] = [];
  const upsert = db.prepare(UPSERT_JOB_SQL);
  for (const j of jobs) {
    const hash = hashJob(j);
    if (existingHash.get(j.externalId) === hash) continue; // unchanged — skip the write entirely
    stmts.push(bindUpsert(upsert, sourceId, company, j, hash));
  }
  const staleIds = [...existingHash.keys()].filter((id) => !incomingIds.has(id));
  for (let i = 0; i < staleIds.length; i += 80) {
    const chunk = staleIds.slice(i, i + 80);
    stmts.push(db.prepare(
      `DELETE FROM jobs WHERE source_id = ? AND external_id IN (${chunk.map(() => "?").join(",")})`
    ).bind(sourceId, ...chunk));
  }
  stmts.push(db.prepare(
    `UPDATE sources SET status='ok', error=NULL, company=?, job_count=?, last_fetched_at=datetime('now') WHERE id=?`
  ).bind(company, jobs.length, sourceId));
  await runBatched(db, stmts);
}

async function syncSource(db: D1Database, source: { id: number; ats: string; ats_ref: string }) {
  try {
    const { company, jobs } = await fetchJobsForSource(source.ats, source.ats_ref);
    // India-only platform: filter here, not just on read — keeps the DB (and FTS index) small,
    // and non-India postings that disappear from the incoming set get cleaned up by the
    // existing diff (nothing special needed for removal).
    const indiaJobs = jobs.filter((j) => isIndiaLocation(j.location, j.title));
    await diffSyncJobs(db, source.id, company, indiaJobs);
    return { ok: true, count: indiaJobs.length };
  } catch (e: any) {
    await db.prepare(
      `UPDATE sources SET status='error', error=?, last_fetched_at=datetime('now') WHERE id=?`
    ).bind(String(e?.message ?? e).slice(0, 500), source.id).run();
    return { ok: false, error: String(e?.message ?? e) };
  }
}

async function syncAll(db: D1Database) {
  // "manual" sources have no live API — they're only updated when re-imported from the admin panel
  const { results } = await db.prepare(`SELECT id, ats, ats_ref FROM sources WHERE ats != 'manual'`).all<any>();
  for (const s of results) await syncSource(db, s);
}

/* ---------------- admin: sources ---------------- */

app.get("/api/admin/sources", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM sources ORDER BY created_at DESC`
  ).all();
  return c.json({ sources: results });
});

app.post("/api/admin/sources", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const blocked = blockedHostReason((url ?? "").trim());
  if (blocked) return c.json({ error: blocked }, 400);
  const detected = detectAts((url ?? "").trim());
  if (!detected) return c.json({ error: "Invalid URL" }, 400);

  const existing = await c.env.DB.prepare(`SELECT id FROM sources WHERE url = ?`)
    .bind(url.trim()).first();
  if (existing) return c.json({ error: "This career link is already added" }, 409);

  const res = await c.env.DB.prepare(
    `INSERT INTO sources (url, company, ats, ats_ref) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(url.trim(), detected.company, detected.ats, detected.atsRef).first<{ id: number }>();

  const sync = await syncSource(c.env.DB, { id: res!.id, ats: detected.ats, ats_ref: detected.atsRef });
  const source = await c.env.DB.prepare(`SELECT * FROM sources WHERE id = ?`).bind(res!.id).first();
  return c.json({ source, sync }, sync.ok ? 201 : 207);
});

app.post("/api/admin/sources/:id/refresh", async (c) => {
  const id = Number(c.req.param("id"));
  const source = await c.env.DB.prepare(`SELECT id, ats, ats_ref FROM sources WHERE id = ?`)
    .bind(id).first<any>();
  if (!source) return c.json({ error: "Not found" }, 404);
  if (source.ats === "manual") {
    return c.json({ error: "Manual sources have no live feed — re-import to update them" }, 400);
  }
  const sync = await syncSource(c.env.DB, source);
  const updated = await c.env.DB.prepare(`SELECT * FROM sources WHERE id = ?`).bind(id).first();
  return c.json({ source: updated, sync });
});

// Bulk-import hand-entered listings (e.g. copied from a LinkedIn company jobs page, which
// blocks automated scraping and can't be pulled through a public API like the other ATSes).
app.post("/api/admin/sources/manual", async (c) => {
  const { company, jobs } = await c.req.json<{ company: string; jobs: ManualJobInput[] }>();
  if (!company?.trim()) return c.json({ error: "Company name is required" }, 400);
  const parsedJobs = (jobs ?? []).filter((j) => j.title?.trim() && j.url?.trim());
  const validJobs = parsedJobs.filter((j) => isIndiaLocation(j.location ?? "", j.title));
  const skippedNonIndia = parsedJobs.length - validJobs.length;
  if (validJobs.length === 0) {
    return c.json({
      error: skippedNonIndia > 0
        ? `All ${skippedNonIndia} pasted job(s) look non-India-based (hireers only lists India jobs) — include the city/state in the Location column so India-based roles are recognized.`
        : "Add at least one job with a title and URL",
    }, 400);
  }

  const slug = slugify(company);
  const url = `manual://${slug}`;
  const db = c.env.DB;
  const existing = await db.prepare(`SELECT id FROM sources WHERE url = ?`).bind(url).first<{ id: number }>();

  let sourceId: number;
  if (existing) {
    sourceId = existing.id;
  } else {
    const created = await db.prepare(
      `INSERT INTO sources (url, company, ats, ats_ref) VALUES (?, ?, 'manual', ?) RETURNING id`
    ).bind(url, company.trim(), slug).first<{ id: number }>();
    sourceId = created!.id;
  }

  const normalized = buildManualJobs(validJobs);
  await replaceSourceJobs(db, sourceId, company.trim(), normalized);
  const source = await db.prepare(`SELECT * FROM sources WHERE id = ?`).bind(sourceId).first();
  return c.json({ source, count: normalized.length, skippedNonIndia }, 201);
});

/* ---------------- admin: live-match watchlist ---------------- */
// Companies queried live during resume matching (in addition to imported `sources`). Never
// synced into `jobs` — capped to keep each /api/match request's subrequest count bounded.
const WATCHLIST_MAX = 20;

app.get("/api/admin/watchlist", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT * FROM watchlist ORDER BY created_at DESC`).all();
  return c.json({ watchlist: results });
});

app.post("/api/admin/watchlist", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  const blocked = blockedHostReason((url ?? "").trim());
  if (blocked) return c.json({ error: blocked }, 400);
  const detected = detectAts((url ?? "").trim());
  if (!detected) return c.json({ error: "Invalid URL" }, 400);

  const { n } = (await c.env.DB.prepare(`SELECT COUNT(*) n FROM watchlist`).first<{ n: number }>())!;
  if (n >= WATCHLIST_MAX) {
    return c.json({ error: `Live-match watchlist is capped at ${WATCHLIST_MAX} companies to keep each resume search fast and within Workers' subrequest limit.` }, 400);
  }
  const existing = await c.env.DB.prepare(`SELECT id FROM watchlist WHERE url = ?`).bind(url.trim()).first();
  if (existing) return c.json({ error: "Already on the watchlist" }, 409);

  const created = await c.env.DB.prepare(
    `INSERT INTO watchlist (url, company, ats, ats_ref) VALUES (?, ?, ?, ?) RETURNING *`
  ).bind(url.trim(), detected.company, detected.ats, detected.atsRef).first();
  return c.json({ entry: created }, 201);
});

app.delete("/api/admin/watchlist/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM watchlist WHERE id = ?`).bind(Number(c.req.param("id"))).run();
  return c.json({ ok: true });
});

app.post("/api/admin/refresh-all", async (c) => {
  await syncAll(c.env.DB);
  const { results } = await c.env.DB.prepare(`SELECT * FROM sources ORDER BY created_at DESC`).all();
  return c.json({ sources: results });
});

app.delete("/api/admin/sources/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await c.env.DB.prepare(`DELETE FROM jobs WHERE source_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM sources WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

app.get("/api/admin/stats", async (c) => {
  const db = c.env.DB;
  const [jobs, sources, byType, byLevel, byCategory] = await Promise.all([
    db.prepare(`SELECT COUNT(*) n FROM jobs`).first<any>(),
    db.prepare(`SELECT COUNT(*) n, SUM(status='error') errors FROM sources`).first<any>(),
    db.prepare(`SELECT job_type k, COUNT(*) n FROM jobs GROUP BY 1 ORDER BY 2 DESC`).all(),
    db.prepare(`SELECT level k, COUNT(*) n FROM jobs GROUP BY 1 ORDER BY 2 DESC`).all(),
    db.prepare(`SELECT role_category k, COUNT(*) n FROM jobs GROUP BY 1 ORDER BY 2 DESC`).all(),
  ]);
  return c.json({
    totalJobs: jobs?.n ?? 0,
    totalSources: sources?.n ?? 0,
    sourceErrors: sources?.errors ?? 0,
    byType: byType.results,
    byLevel: byLevel.results,
    byCategory: byCategory.results,
  });
});

/* ---------------- public: jobs ---------------- */

function ftsQuery(q: string): string {
  const tokens = q.replace(/['"^*()]/g, " ").split(/\s+/).filter(Boolean).slice(0, 8);
  if (tokens.length === 0) return "";
  return tokens.map((t, i) => `"${t}"${i === tokens.length - 1 ? "*" : ""}`).join(" ");
}

interface JobFilters {
  q?: string;
  skills?: string[];
  types?: string[];
  levels?: string[];
  categories?: string[];
  companies?: string[];
  location?: string;
  remote?: boolean;
  maxYears?: number | null;
  postedWithin?: number | null;
}

function buildJobQuery(f: JobFilters): { where: string; params: any[] } {
  const conds: string[] = [];
  const params: any[] = [];

  if (f.q) {
    const match = ftsQuery(f.q);
    if (match) {
      conds.push(`jobs.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)`);
      params.push(match);
    }
  }
  for (const skill of f.skills ?? []) {
    conds.push(`EXISTS (SELECT 1 FROM json_each(jobs.skills) WHERE json_each.value = ? COLLATE NOCASE)`);
    params.push(skill);
  }
  const inList = (col: string, vals?: string[]) => {
    if (vals && vals.length) {
      conds.push(`${col} IN (${vals.map(() => "?").join(",")})`);
      params.push(...vals);
    }
  };
  inList("jobs.job_type", f.types);
  inList("jobs.level", f.levels);
  inList("jobs.role_category", f.categories);
  inList("jobs.company", f.companies);
  if (f.location) {
    conds.push(`jobs.location LIKE ?`);
    params.push(`%${f.location}%`);
  }
  if (f.remote) conds.push(`jobs.remote = 1`);
  if (f.maxYears !== null && f.maxYears !== undefined) {
    conds.push(`(jobs.exp_min IS NULL OR jobs.exp_min <= ?)`);
    params.push(f.maxYears);
  }
  if (f.postedWithin) {
    conds.push(`(jobs.posted_at IS NULL OR jobs.posted_at >= datetime('now', ?))`);
    params.push(`-${f.postedWithin} days`);
  }
  return { where: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params };
}

function parseFilters(c: any): JobFilters {
  const q = c.req.query.bind(c.req);
  const list = (name: string) => {
    const v = q(name);
    return v ? v.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined;
  };
  const maxYears = q("maxYears");
  const postedWithin = q("postedWithin");
  return {
    q: q("q")?.trim() || undefined,
    skills: list("skills"),
    types: list("types"),
    levels: list("levels"),
    categories: list("categories"),
    companies: list("companies"),
    location: q("location")?.trim() || undefined,
    remote: q("remote") === "1",
    maxYears: maxYears !== undefined && maxYears !== "" ? Number(maxYears) : null,
    postedWithin: postedWithin ? Number(postedWithin) : null,
  };
}

app.get("/api/jobs", async (c) => {
  const f = parseFilters(c);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
  // "offset" drives the Load More pattern (append to an existing list); "page" is a fallback
  // for direct API callers that still think in pages.
  const offsetParam = c.req.query("offset");
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const offset = offsetParam !== undefined ? Math.max(0, Number(offsetParam)) : (page - 1) * limit;
  const sort = c.req.query("sort") === "company"
    ? "jobs.company ASC, jobs.title ASC"
    : "jobs.posted_at IS NULL, jobs.posted_at DESC, jobs.id DESC";

  const { where, params } = buildJobQuery(f);
  const db = c.env.DB;
  const [rows, count] = await Promise.all([
    db.prepare(`SELECT * FROM jobs ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset).all(),
    db.prepare(`SELECT COUNT(*) n FROM jobs ${where}`).bind(...params).first<any>(),
  ]);
  const jobs = rows.results.map((j: any) => ({
    ...j,
    skills: JSON.parse(j.skills),
    remote: !!j.remote,
    description: undefined,
    snippet: (j.description as string).slice(0, 260),
  }));
  return c.json({ jobs, total: count?.n ?? 0, page, limit });
});

app.get("/api/jobs/:id", async (c) => {
  const job = await c.env.DB.prepare(`SELECT * FROM jobs WHERE id = ?`)
    .bind(Number(c.req.param("id"))).first<any>();
  if (!job) return c.json({ error: "Not found" }, 404);
  return c.json({ job: { ...job, skills: JSON.parse(job.skills), remote: !!job.remote } });
});

app.get("/api/facets", async (c) => {
  const db = c.env.DB;
  const [companies, locations, skills] = await Promise.all([
    db.prepare(`SELECT company k, COUNT(*) n FROM jobs GROUP BY 1 ORDER BY 2 DESC LIMIT 100`).all(),
    db.prepare(`SELECT location k, COUNT(*) n FROM jobs WHERE location != '' GROUP BY 1 ORDER BY 2 DESC LIMIT 50`).all(),
    db.prepare(
      `SELECT json_each.value k, COUNT(*) n FROM jobs, json_each(jobs.skills) GROUP BY 1 ORDER BY 2 DESC LIMIT 80`
    ).all(),
  ]);
  return c.json({
    companies: companies.results,
    locations: locations.results,
    skills: skills.results,
    allSkills: SKILLS.map((s) => s.name),
  });
});

/* ---------------- resume matching ---------------- */

/** Shared scoring formula for both stored-DB matches and live cross-company matches. */
function scoreJob(
  jobSkills: string[], expMin: number | null, mySkills: Set<string>, userYears: number | null | undefined
): { matched: string[]; score: number } | null {
  const matched = jobSkills.filter((s) => mySkills.has(s.toLowerCase()));
  if (matched.length === 0) return null;
  // skill overlap weighted by how much of the job's requirements are covered
  let score = (matched.length / Math.max(jobSkills.length, 3)) * 70 + Math.min(matched.length * 4, 20);
  if (userYears !== null && userYears !== undefined) {
    if (expMin === null || expMin <= userYears) score += 10;
    else if (expMin > userYears + 2) score -= 25;
  }
  return { matched, score: Math.max(0, Math.min(100, Math.round(score))) };
}

const LIVE_MATCH_MIN_SCORE = 80;
const LIVE_MATCH_MAX_AGE_DAYS = 15;

/**
 * Beyond the admin-curated `sources`, also live-fetch every watchlist company and surface
 * anything that's a strong match (>=80%) and recent (<=15 days old). Nothing here touches
 * the `jobs` table — computed fresh per request, discarded after the response is sent.
 */
async function liveWatchlistMatches(
  db: D1Database, mySkills: Set<string>, userYears: number | null | undefined
): Promise<any[]> {
  const { results: watchlist } = await db.prepare(`SELECT company, ats, ats_ref FROM watchlist`).all<any>();
  if (watchlist.length === 0) return [];

  const cutoff = Date.now() - LIVE_MATCH_MAX_AGE_DAYS * 24 * 3600 * 1000;
  const perCompany = await Promise.allSettled(
    watchlist.map((w) => fetchJobsForSource(w.ats, w.ats_ref))
  );

  const out: any[] = [];
  let syntheticId = -1;
  for (let i = 0; i < perCompany.length; i++) {
    const result = perCompany[i];
    if (result.status !== "fulfilled") continue; // one company failing shouldn't fail the whole search
    const company = watchlist[i].company;
    for (const j of result.value.jobs) {
      // cheap filters first (recency, location), before the costlier scoring pass
      if (!j.postedAt || new Date(j.postedAt).getTime() < cutoff) continue;
      if (!isIndiaLocation(j.location, j.title)) continue;
      const scored = scoreJob(j.skills, j.expMin, mySkills, userYears);
      if (!scored || scored.score < LIVE_MATCH_MIN_SCORE) continue;
      out.push({
        id: syntheticId--,
        title: j.title,
        company,
        location: j.location,
        remote: j.remote,
        job_type: j.jobType,
        level: j.level,
        exp_min: j.expMin,
        exp_max: j.expMax,
        role_category: j.roleCategory,
        skills: j.skills,
        description: j.description,
        apply_url: j.applyUrl,
        posted_at: j.postedAt,
        matchedSkills: scored.matched,
        score: scored.score,
        live: true,
      });
    }
  }
  return out;
}

app.post("/api/match", async (c) => {
  const { text, years } = await c.req.json<{ text: string; years?: number }>();
  if (!text || text.trim().length < 30) {
    return c.json({ error: "Resume text is too short to analyze" }, 400);
  }
  const resumeSkills = extractSkills(text);
  const parsedExp = parseExperience(text);
  const userYears = years ?? parsedExp.expMin;

  if (resumeSkills.length === 0) {
    return c.json({ profile: { skills: [], years: userYears }, matches: [] });
  }

  const mySkills = new Set(resumeSkills.map((s) => s.toLowerCase()));

  const [{ results }, liveMatches] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, title, company, location, remote, job_type, level, exp_min, exp_max,
              role_category, skills, apply_url, posted_at
       FROM jobs ORDER BY posted_at DESC LIMIT 2000`
    ).all<any>(),
    liveWatchlistMatches(c.env.DB, mySkills, userYears),
  ]);

  const dbScored = results
    .map((j) => {
      const jobSkills: string[] = JSON.parse(j.skills);
      const scored = scoreJob(jobSkills, j.exp_min, mySkills, userYears);
      if (!scored) return null;
      return { ...j, skills: jobSkills, remote: !!j.remote, matchedSkills: scored.matched, score: scored.score };
    })
    .filter(Boolean);

  const combined = [...dbScored, ...liveMatches]
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 80);

  return c.json({ profile: { skills: resumeSkills, years: userYears }, matches: combined });
});

/* ---------------- worker entry ---------------- */

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncAll(env.DB));
  },
} satisfies ExportedHandler<Env>;
