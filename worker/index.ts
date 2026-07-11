import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { detectAts, fetchJobsForSource, type NormalizedJob } from "./ingest";
import { extractSkills, parseExperience, SKILLS } from "./extract";

interface Env {
  DB: D1Database;
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD: string;
}

type App = { Bindings: Env };
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

/* ---------------- sync engine ---------------- */

async function syncSource(db: D1Database, source: { id: number; ats: string; ats_ref: string }) {
  try {
    const { company, jobs } = await fetchJobsForSource(source.ats, source.ats_ref);

    // Replace the source's jobs wholesale (D1 caps bound params per statement,
    // so a NOT IN (...) stale-delete with hundreds of ids is not an option)
    const stmts: D1PreparedStatement[] = [
      db.prepare(`DELETE FROM jobs WHERE source_id = ?`).bind(source.id),
    ];
    const upsert = db.prepare(`
      INSERT INTO jobs (source_id, external_id, title, company, location, remote, job_type, level,
                        exp_min, exp_max, role_category, skills, description, apply_url, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, external_id) DO UPDATE SET
        title=excluded.title, company=excluded.company, location=excluded.location,
        remote=excluded.remote, job_type=excluded.job_type, level=excluded.level,
        exp_min=excluded.exp_min, exp_max=excluded.exp_max, role_category=excluded.role_category,
        skills=excluded.skills, description=excluded.description,
        apply_url=excluded.apply_url, posted_at=excluded.posted_at
    `);
    for (const j of jobs) {
      stmts.push(upsert.bind(
        source.id, j.externalId, j.title, company, j.location, j.remote ? 1 : 0,
        j.jobType, j.level, j.expMin, j.expMax, j.roleCategory,
        JSON.stringify(j.skills), j.description, j.applyUrl, j.postedAt
      ));
    }
    stmts.push(db.prepare(
      `UPDATE sources SET status='ok', error=NULL, company=?, job_count=?, last_fetched_at=datetime('now') WHERE id=?`
    ).bind(company, jobs.length, source.id));

    // D1 batches are transactional; chunk to stay under statement limits
    for (let i = 0; i < stmts.length; i += 90) {
      await db.batch(stmts.slice(i, i + 90));
    }
    return { ok: true, count: jobs.length };
  } catch (e: any) {
    await db.prepare(
      `UPDATE sources SET status='error', error=?, last_fetched_at=datetime('now') WHERE id=?`
    ).bind(String(e?.message ?? e).slice(0, 500), source.id).run();
    return { ok: false, error: String(e?.message ?? e) };
  }
}

async function syncAll(db: D1Database) {
  const { results } = await db.prepare(`SELECT id, ats, ats_ref FROM sources`).all<any>();
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
  const sync = await syncSource(c.env.DB, source);
  const updated = await c.env.DB.prepare(`SELECT * FROM sources WHERE id = ?`).bind(id).first();
  return c.json({ source: updated, sync });
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
  const page = Math.max(1, Number(c.req.query("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
  const sort = c.req.query("sort") === "company"
    ? "jobs.company ASC, jobs.title ASC"
    : "jobs.posted_at IS NULL, jobs.posted_at DESC, jobs.id DESC";

  const { where, params } = buildJobQuery(f);
  const db = c.env.DB;
  const [rows, count] = await Promise.all([
    db.prepare(`SELECT * FROM jobs ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`)
      .bind(...params, limit, (page - 1) * limit).all(),
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

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, company, location, remote, job_type, level, exp_min, exp_max,
            role_category, skills, apply_url, posted_at
     FROM jobs ORDER BY posted_at DESC LIMIT 2000`
  ).all<any>();

  const mySkills = new Set(resumeSkills.map((s) => s.toLowerCase()));
  const scored = results
    .map((j) => {
      const jobSkills: string[] = JSON.parse(j.skills);
      const matched = jobSkills.filter((s) => mySkills.has(s.toLowerCase()));
      if (matched.length === 0) return null;
      // skill overlap weighted by how much of the job's requirements are covered
      let score = (matched.length / Math.max(jobSkills.length, 3)) * 70 + Math.min(matched.length * 4, 20);
      if (userYears !== null && userYears !== undefined) {
        if (j.exp_min === null || j.exp_min <= userYears) score += 10;
        else if (j.exp_min > userYears + 2) score -= 25;
      }
      return {
        ...j,
        skills: jobSkills,
        remote: !!j.remote,
        matchedSkills: matched,
        score: Math.max(0, Math.min(100, Math.round(score))),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 60);

  return c.json({ profile: { skills: resumeSkills, years: userYears }, matches: scored });
});

/* ---------------- worker entry ---------------- */

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncAll(env.DB));
  },
} satisfies ExportedHandler<Env>;
