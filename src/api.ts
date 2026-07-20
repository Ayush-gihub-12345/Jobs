export interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  job_type: string;
  level: string;
  exp_min: number | null;
  exp_max: number | null;
  role_category: string;
  skills: string[];
  snippet?: string;
  description?: string;
  apply_url: string;
  posted_at: string | null;
  matchedSkills?: string[];
  score?: number;
  /** Fetched live from the company's career page for this match request — never written to the DB. */
  live?: boolean;
}

export interface Source {
  id: number;
  url: string;
  company: string;
  ats: string;
  status: string;
  error: string | null;
  job_count: number;
  last_fetched_at: string | null;
  created_at: string;
}

export interface Facets {
  companies: { k: string; n: number }[];
  locations: { k: string; n: number }[];
  skills: { k: string; n: number }[];
  allSkills: string[];
}

export interface WatchlistEntry {
  id: number;
  url: string;
  company: string;
  ats: string;
  ats_ref: string;
  created_at: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { "content-type": "application/json" } : undefined,
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Request failed (${res.status})`);
  return data as T;
}

async function authedRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface Preferences {
  locations: string[];
  remoteOnly: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  jobTypes: string[];
  categories: string[];
  skills: string[];
  experienceLevel: string | null;
}

export const api = {
  jobs: (params: URLSearchParams) =>
    request<{ jobs: Job[]; total: number; page: number; limit: number }>(`/api/jobs?${params}`),
  job: (id: number) => request<{ job: Job }>(`/api/jobs/${id}`),
  facets: () => request<Facets>(`/api/facets`),
  match: (text: string, years?: number | null) =>
    request<{ profile: { skills: string[]; years: number | null }; matches: Job[] }>(`/api/match`, {
      method: "POST",
      body: JSON.stringify({ text, years }),
    }),
  admin: {
    login: (username: string, password: string) =>
      request(`/api/admin/login`, { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request(`/api/admin/logout`, { method: "POST" }),
    me: () => request<{ authenticated: boolean }>(`/api/admin/me`),
    sources: () => request<{ sources: Source[] }>(`/api/admin/sources`),
    addSource: (url: string) =>
      request<{ source: Source; sync: { ok: boolean; count?: number; error?: string } }>(
        `/api/admin/sources`, { method: "POST", body: JSON.stringify({ url }) }),
    refreshSource: (id: number) =>
      request<{ source: Source; sync: { ok: boolean; error?: string } }>(
        `/api/admin/sources/${id}/refresh`, { method: "POST" }),
    refreshAll: () => request<{ sources: Source[] }>(`/api/admin/refresh-all`, { method: "POST" }),
    deleteSource: (id: number) => request(`/api/admin/sources/${id}`, { method: "DELETE" }),
    importManual: (company: string, jobs: { title: string; url: string; location?: string }[]) =>
      request<{ source: Source; count: number; skippedNonIndia: number; skippedNonJunior: number }>(
        `/api/admin/sources/manual`, { method: "POST", body: JSON.stringify({ company, jobs }) }),
    stats: () =>
      request<{
        totalJobs: number; totalSources: number; sourceErrors: number;
        byType: { k: string; n: number }[]; byLevel: { k: string; n: number }[];
        byCategory: { k: string; n: number }[];
      }>(`/api/admin/stats`),
    watchlist: () => request<{ watchlist: WatchlistEntry[] }>(`/api/admin/watchlist`),
    addWatchlist: (url: string) =>
      request<{ entry: WatchlistEntry }>(`/api/admin/watchlist`, { method: "POST", body: JSON.stringify({ url }) }),
    deleteWatchlist: (id: number) => request(`/api/admin/watchlist/${id}`, { method: "DELETE" }),
  },
  me: {
    get: (token: string) => authedRequest<{ uid: string; email: string; name: string | null }>(`/api/me`, token),
    getPreferences: (token: string) => authedRequest<Preferences>(`/api/me/preferences`, token),
    savePreferences: (token: string, prefs: Preferences) =>
      authedRequest<{ ok: boolean }>(`/api/me/preferences`, token, { method: "PUT", body: JSON.stringify(prefs) }),
  },
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
