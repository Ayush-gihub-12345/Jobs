import { useMemo, useRef, useState } from "react";
import { api, type Facets, type Job } from "../api";
import JobCard from "../components/JobCard";
import FilterPanel from "../components/FilterPanel";
import { useFilterState } from "../lib/useFilterState";
import { readResumeFile } from "../lib/resume";

function applyFilters(jobs: Job[], p: URLSearchParams): Job[] {
  const listOf = (k: string) => (p.get(k) ? p.get(k)!.split(",") : []);
  const types = listOf("types");
  const levels = listOf("levels");
  const categories = listOf("categories");
  const skills = listOf("skills").map((s) => s.toLowerCase());
  const companies = listOf("companies");
  const location = (p.get("location") ?? "").toLowerCase();
  const remote = p.get("remote") === "1";
  const maxYears = p.get("maxYears");
  const postedWithin = p.get("postedWithin");
  const now = Date.now();

  return jobs.filter((j) => {
    if (types.length && !types.includes(j.job_type)) return false;
    if (levels.length && !levels.includes(j.level)) return false;
    if (categories.length && !categories.includes(j.role_category)) return false;
    if (skills.length) {
      const jobSkills = j.skills.map((s) => s.toLowerCase());
      if (!skills.every((s) => jobSkills.includes(s))) return false;
    }
    if (companies.length && !companies.includes(j.company)) return false;
    if (location && !j.location.toLowerCase().includes(location)) return false;
    if (remote && !j.remote) return false;
    if (maxYears && j.exp_min !== null && j.exp_min > Number(maxYears)) return false;
    if (postedWithin && j.posted_at) {
      const days = (now - new Date(j.posted_at).getTime()) / 86400000;
      if (days > Number(postedWithin)) return false;
    }
    return true;
  });
}

function buildLocalFacets(jobs: Job[]): Facets {
  const skillCount = new Map<string, number>();
  const companyCount = new Map<string, number>();
  for (const j of jobs) {
    for (const s of j.skills) skillCount.set(s, (skillCount.get(s) ?? 0) + 1);
    companyCount.set(j.company, (companyCount.get(j.company) ?? 0) + 1);
  }
  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  return { skills: toSorted(skillCount), companies: toSorted(companyCount), locations: [], allSkills: [] };
}

export default function LinkedInPage() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [years, setYears] = useState<string>("");
  const [profile, setProfile] = useState<{ skills: string[]; years: number | null } | null>(null);
  const [rawMatches, setRawMatches] = useState<Job[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const { params, get, getList, set, toggleList, clear } = useFilterState();

  const runMatch = async (text: string) => {
    setError("");
    setBusy(true);
    try {
      const y = years.trim() === "" ? null : Number(years);
      const res = await api.match(text, y);
      setProfile(res.profile);
      setRawMatches(res.matches);
      clear();
    } catch (e: any) {
      setError(e.message ?? "Search failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setError("");
    setBusy(true);
    try {
      const text = await readResumeFile(file);
      setFileName(file.name);
      setResumeText(text);
      await runMatch(text);
    } catch (e: any) {
      setError(e.message ?? "Failed to read the file");
      setBusy(false);
    }
  };

  const localFacets = useMemo(() => (rawMatches ? buildLocalFacets(rawMatches) : null), [rawMatches]);
  const filteredMatches = useMemo(
    () => (rawMatches ? applyFilters(rawMatches, params) : null),
    [rawMatches, params]
  );

  return (
    <div>
      <div className="li-hero">
        <h1>LinkedIn</h1>
        <p>
          Search open positions against your resume with the same rich filters used across JobHub.
          Results are drawn from JobHub's aggregated listings, not scraped from linkedin.com.
        </p>
      </div>

      <div className="li-layout">
        <div className="li-left">
          <div
            className={`dropzone ${dragOver ? "over" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <div style={{ fontSize: 28 }}>📄</div>
            <b>{fileName || "Upload resume"}</b>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>PDF or .txt</div>
            <input ref={fileInput} type="file" accept=".pdf,.txt,.md" hidden
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>

          <div className="panel profile-box">
            <h3>Or paste resume text</h3>
            <textarea className="text-input" rows={4} value={resumeText}
              placeholder="Paste your resume or skills summary…"
              onChange={(e) => setResumeText(e.target.value)} />
            <div className="years-row" style={{ flexWrap: "wrap" }}>
              <label className="muted" style={{ fontSize: 13.5 }}>Years of experience:</label>
              <input className="text-input" type="number" min={0} max={40} value={years}
                onChange={(e) => setYears(e.target.value)} />
            </div>
            <button className="btn" style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
              disabled={busy || resumeText.trim().length < 30} onClick={() => runMatch(resumeText)}>
              {busy ? "Searching…" : "Search matching positions"}
            </button>
          </div>

          {profile && !busy && profile.skills.length > 0 && (
            <div className="panel profile-box">
              <h3>Detected skills</h3>
              <div className="tag-list">
                {profile.skills.map((s) => <span key={s} className="tag matched">{s}</span>)}
              </div>
            </div>
          )}

          {rawMatches && (
            <FilterPanel
              get={get} getList={getList} set={set} toggleList={toggleList}
              onClearAll={clear} facets={localFacets} maxCompanies={10}
            />
          )}
        </div>

        <div className="li-right">
          {error && <div className="alert error">{error}</div>}
          {busy && <div className="spinner" />}

          {!rawMatches && !busy && (
            <div className="panel empty">
              <b>Upload a resume to begin.</b>
              <p>Matching positions, ranked by relevance, will appear here with full filtering.</p>
            </div>
          )}

          {filteredMatches && !busy && (
            <>
              <p className="results-meta">
                {filteredMatches.length} of {rawMatches!.length} matching position{rawMatches!.length === 1 ? "" : "s"}
              </p>
              {filteredMatches.length === 0 ? (
                <div className="panel empty">
                  <b>No positions match the current filters.</b>
                  <p>Try clearing some filters to see more results.</p>
                </div>
              ) : (
                <div className="job-list">
                  {filteredMatches.map((j) => <JobCard key={j.id} job={j} />)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
