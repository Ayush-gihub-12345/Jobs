// Career-link ingestion: detect the ATS behind a URL and pull all jobs via its public API.
import {
  extractSkills, parseExperience, inferLevel, inferJobType, inferCategory, htmlToText,
} from "./extract";

export interface NormalizedJob {
  externalId: string;
  title: string;
  location: string;
  remote: boolean;
  jobType: string;
  level: string;
  expMin: number | null;
  expMax: number | null;
  roleCategory: string;
  skills: string[];
  description: string;
  applyUrl: string;
  postedAt: string | null;
}

export interface DetectedSource {
  ats: string;
  atsRef: string;
  company: string;
}

export interface FetchResult {
  company: string;
  jobs: NormalizedJob[];
}

const MAX_DESC = 6000;

function finishJob(partial: {
  externalId: string;
  title: string;
  location?: string | null;
  remote?: boolean;
  atsType?: string | null;
  descriptionHtml?: string | null;
  descriptionText?: string | null;
  applyUrl: string;
  postedAt?: string | null;
}): NormalizedJob {
  const title = partial.title.trim();
  const desc = (partial.descriptionText ?? htmlToText(partial.descriptionHtml ?? "")).slice(0, MAX_DESC);
  const { expMin, expMax } = parseExperience(`${title}\n${desc}`);
  const location = (partial.location ?? "").trim();
  const remote = partial.remote || /\bremote\b/i.test(location) || /\bremote\b/i.test(title);
  return {
    externalId: String(partial.externalId),
    title,
    location,
    remote,
    jobType: inferJobType(title, partial.atsType),
    level: inferLevel(title, expMin),
    expMin,
    expMax,
    roleCategory: inferCategory(title),
    skills: extractSkills(`${title}\n${desc}`),
    description: desc,
    applyUrl: partial.applyUrl,
    postedAt: partial.postedAt ? new Date(partial.postedAt).toISOString() : null,
  };
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "JobsPlatform/1.0 (+job aggregator)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).hostname}`);
  return res.json();
}

const titleCase = (s: string) =>
  s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** Figure out which ATS a career URL belongs to. */
export function detectAts(rawUrl: string): DetectedSource | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (host.includes("greenhouse.io")) {
    // boards.greenhouse.io/{token} or job-boards.greenhouse.io/{token}
    const ref = parts[0] === "embed" ? (u.searchParams.get("for") ?? "") : (parts[0] ?? "");
    if (ref) return { ats: "greenhouse", atsRef: ref, company: titleCase(ref) };
  }
  if (host.includes("lever.co")) {
    const ref = parts[0];
    if (ref) return { ats: "lever", atsRef: ref, company: titleCase(ref) };
  }
  if (host.includes("ashbyhq.com")) {
    const ref = parts[0];
    if (ref) return { ats: "ashby", atsRef: ref, company: titleCase(ref) };
  }
  if (host === "apply.workable.com" || host.endsWith(".workable.com")) {
    const ref = host === "apply.workable.com" ? parts[0] : host.split(".")[0];
    if (ref && ref !== "j") return { ats: "workable", atsRef: ref, company: titleCase(ref) };
  }
  if (host.includes("smartrecruiters.com")) {
    const ref = parts[0];
    if (ref) return { ats: "smartrecruiters", atsRef: ref, company: titleCase(ref) };
  }
  if (host.endsWith(".recruitee.com")) {
    const ref = host.split(".")[0];
    if (ref) return { ats: "recruitee", atsRef: ref, company: titleCase(ref) };
  }
  // Unknown host: generic JSON-LD scrape fallback
  return { ats: "generic", atsRef: rawUrl, company: titleCase(host.replace(/^(www|careers|jobs)\./, "").split(".")[0]) };
}

async function fetchGreenhouse(ref: string): Promise<FetchResult> {
  const data = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${ref}/jobs?content=true`);
  const jobs = (data.jobs ?? []).map((j: any) =>
    finishJob({
      externalId: j.id,
      title: j.title,
      location: j.location?.name,
      descriptionHtml: j.content ?? "",
      applyUrl: j.absolute_url,
      postedAt: j.first_published ?? j.updated_at,
      atsType: j.metadata?.find?.((m: any) => /employment/i.test(m?.name ?? ""))?.value,
    })
  );
  return { company: titleCase(ref), jobs };
}

async function fetchLever(ref: string): Promise<FetchResult> {
  const data = await fetchJson(`https://api.lever.co/v0/postings/${ref}?mode=json`);
  const jobs = (Array.isArray(data) ? data : []).map((j: any) =>
    finishJob({
      externalId: j.id,
      title: j.text,
      location: j.categories?.location,
      atsType: j.categories?.commitment,
      remote: j.workplaceType === "remote",
      descriptionText: j.descriptionPlain ?? "",
      applyUrl: j.hostedUrl,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    })
  );
  return { company: titleCase(ref), jobs };
}

async function fetchAshby(ref: string): Promise<FetchResult> {
  const data = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${ref}`);
  const jobs = (data.jobs ?? []).map((j: any) =>
    finishJob({
      externalId: j.id,
      title: j.title,
      location: j.location,
      remote: !!j.isRemote,
      atsType: j.employmentType,
      descriptionHtml: j.descriptionHtml ?? "",
      applyUrl: j.jobUrl ?? j.applyUrl,
      postedAt: j.publishedAt,
    })
  );
  return { company: titleCase(ref), jobs };
}

async function fetchWorkable(ref: string): Promise<FetchResult> {
  const data = await fetchJson(`https://apply.workable.com/api/v1/widget/accounts/${ref}?details=true`);
  const jobs = (data.jobs ?? []).map((j: any) =>
    finishJob({
      externalId: j.shortcode ?? j.id,
      title: j.title,
      location: [j.city, j.country].filter(Boolean).join(", "),
      remote: /remote/i.test(j.workplace ?? "") || !!j.telecommuting,
      atsType: j.employment_type,
      descriptionHtml: j.description ?? "",
      applyUrl: j.url ?? j.application_url,
      postedAt: j.created_at,
    })
  );
  return { company: data.name ?? titleCase(ref), jobs };
}

async function fetchSmartRecruiters(ref: string): Promise<FetchResult> {
  const jobs: NormalizedJob[] = [];
  let offset = 0;
  let company = titleCase(ref);
  // paginated, 100 per page
  for (let page = 0; page < 10; page++) {
    const data = await fetchJson(
      `https://api.smartrecruiters.com/v1/companies/${ref}/postings?limit=100&offset=${offset}`
    );
    const content = data.content ?? [];
    for (const j of content) {
      company = j.company?.name ?? company;
      jobs.push(
        finishJob({
          externalId: j.uuid ?? j.id,
          title: j.name,
          location: [j.location?.city, j.location?.country?.toUpperCase()].filter(Boolean).join(", "),
          remote: !!j.location?.remote,
          atsType: j.typeOfEmployment?.label,
          descriptionText: "",
          applyUrl: `https://jobs.smartrecruiters.com/${ref}/${j.id}`,
          postedAt: j.releasedDate,
        })
      );
    }
    offset += content.length;
    if (content.length < 100) break;
  }
  return { company, jobs };
}

async function fetchRecruitee(ref: string): Promise<FetchResult> {
  const data = await fetchJson(`https://${ref}.recruitee.com/api/offers/`);
  const jobs = (data.offers ?? []).map((j: any) =>
    finishJob({
      externalId: j.id,
      title: j.title,
      location: j.location ?? [j.city, j.country].filter(Boolean).join(", "),
      remote: j.remote === true || /remote/i.test(j.location ?? ""),
      atsType: j.employment_type_code ?? j.employment_type,
      descriptionHtml: j.description ?? "",
      applyUrl: j.careers_url ?? j.careers_apply_url,
      postedAt: j.created_at,
    })
  );
  return { company: titleCase(ref), jobs };
}

/** Generic fallback: fetch the page and look for JSON-LD JobPosting blocks. */
async function fetchGeneric(url: string): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; JobsPlatform/1.0)" },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const html = await res.text();
  const jobs: NormalizedJob[] = [];
  let company = titleCase(new URL(url).hostname.replace(/^(www|careers|jobs)\./, "").split(".")[0]);

  const blocks = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of blocks) {
    let parsed: any;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
    for (const item of items) {
      if (item?.["@type"] !== "JobPosting") continue;
      const loc = item.jobLocation;
      const locObj = Array.isArray(loc) ? loc[0] : loc;
      const addr = locObj?.address;
      company = item.hiringOrganization?.name ?? company;
      jobs.push(
        finishJob({
          externalId: item.identifier?.value ?? item.url ?? item.title,
          title: item.title ?? "Untitled",
          location: [addr?.addressLocality, addr?.addressCountry].filter(Boolean).join(", "),
          remote: /telecommute|remote/i.test(item.jobLocationType ?? ""),
          atsType: Array.isArray(item.employmentType) ? item.employmentType.join(" ") : item.employmentType,
          descriptionHtml: item.description ?? "",
          applyUrl: item.url ?? url,
          postedAt: item.datePosted,
        })
      );
    }
  }
  if (jobs.length === 0) {
    throw new Error(
      "No structured job data found on this page. Supported: Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, or pages with JSON-LD JobPosting markup."
    );
  }
  return { company, jobs };
}

export async function fetchJobsForSource(ats: string, atsRef: string): Promise<FetchResult> {
  switch (ats) {
    case "greenhouse": return fetchGreenhouse(atsRef);
    case "lever": return fetchLever(atsRef);
    case "ashby": return fetchAshby(atsRef);
    case "workable": return fetchWorkable(atsRef);
    case "smartrecruiters": return fetchSmartRecruiters(atsRef);
    case "recruitee": return fetchRecruitee(atsRef);
    case "generic": return fetchGeneric(atsRef);
    default: throw new Error(`Unknown ATS: ${ats}`);
  }
}

/**
 * "manual" sources have no live API to poll (e.g. jobs copied from a LinkedIn company page,
 * which blocks automated scraping) — admin pastes entries once and normalizes them through
 * the same pipeline as every other ATS. Never called by the sync/cron loop.
 */
export interface ManualJobInput {
  title: string;
  url: string;
  location?: string;
}

export function buildManualJobs(entries: ManualJobInput[]): NormalizedJob[] {
  return entries.map((e, i) =>
    finishJob({
      externalId: `manual-${i}`,
      title: e.title,
      location: e.location ?? "",
      applyUrl: e.url,
    })
  );
}

export function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
}
