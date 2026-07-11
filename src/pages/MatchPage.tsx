import { useRef, useState } from "react";
import { api, type Job } from "../api";
import JobCard from "../components/JobCard";
import { readResumeFile } from "../lib/resume";

export default function MatchPage() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [years, setYears] = useState<string>("");
  const [profile, setProfile] = useState<{ skills: string[]; years: number | null } | null>(null);
  const [matches, setMatches] = useState<Job[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
    } finally {
      setBusy(false);
    }
  };

  const runMatch = async (text = resumeText) => {
    setError("");
    setBusy(true);
    try {
      const y = years.trim() === "" ? null : Number(years);
      const res = await api.match(text, y);
      setProfile(res.profile);
      setMatches(res.matches);
    } catch (e: any) {
      setError(e.message ?? "Matching failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="match-grid">
      <div className="match-hero">
        <h1>Resume Matching</h1>
        <p>
          Upload your resume to receive a ranked list of open positions matched to your skills and
          experience — searched across every company added here, plus a live check of the
          admin-curated watchlist for strong (80%+) matches posted in the last 15 days.
        </p>
      </div>

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
        <div style={{ fontSize: 30 }}>📄</div>
        <b>{fileName || "Drop your resume here or click to browse"}</b>
        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>PDF or .txt — parsed in your browser, never stored</div>
        <input ref={fileInput} type="file" accept=".pdf,.txt,.md" hidden
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      <div className="panel profile-box">
        <h3>Or paste your resume text</h3>
        <textarea className="text-input" rows={5} value={resumeText}
          placeholder="Paste your resume or skills summary here…"
          onChange={(e) => setResumeText(e.target.value)} />
        <div className="years-row">
          <label className="muted" style={{ fontSize: 14 }}>Years of experience (optional):</label>
          <input className="text-input" type="number" min={0} max={40} value={years}
            onChange={(e) => setYears(e.target.value)} />
          <button className="btn" disabled={busy || resumeText.trim().length < 30} onClick={() => runMatch()}>
            {busy ? "Searching…" : "Match jobs"}
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {busy && (
        <>
          <div className="spinner" />
          <p className="muted" style={{ textAlign: "center", marginTop: -6, fontSize: 13 }}>
            Scoring stored listings and checking the live watchlist — this can take a few seconds.
          </p>
        </>
      )}

      {profile && !busy && (
        <div className="panel profile-box">
          <h3>Detected profile {profile.years !== null ? `· ~${profile.years} yrs experience` : ""}</h3>
          {profile.skills.length === 0 ? (
            <div className="muted">No recognizable skills were found in this resume.</div>
          ) : (
            <div className="tag-list">
              {profile.skills.map((s) => <span key={s} className="tag matched">{s}</span>)}
            </div>
          )}
        </div>
      )}

      {matches && !busy && (
        <div>
          <p className="results-meta">
            {matches.length} matching position{matches.length === 1 ? "" : "s"}, best first
            {matches.some((m) => m.live) && ` — including ${matches.filter((m) => m.live).length} live from the watchlist`}
          </p>
          {matches.length === 0 ? (
            <div className="panel empty">
              <b>No matches yet.</b>
              <p>Either no jobs are loaded (add sources in Admin) or the resume skills don't overlap with any listing.</p>
            </div>
          ) : (
            <div className="job-list">
              {matches.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
