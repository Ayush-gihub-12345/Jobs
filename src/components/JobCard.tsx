import { useEffect, useState } from "react";
import { api, timeAgo, type Job } from "../api";

const LEVEL_LABELS: Record<string, string> = {
  intern: "Intern", entry: "Entry level", mid: "Mid level", senior: "Senior", lead: "Lead / Staff+",
};

export default function JobCard({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);

  const expText =
    job.exp_min !== null
      ? job.exp_max !== null ? `${job.exp_min}–${job.exp_max} yrs` : `${job.exp_min}+ yrs`
      : null;

  return (
    <>
      <div className="panel job-card" onClick={() => setOpen(true)}>
        <div className="top">
          <div>
            <h4>{job.title}</h4>
            <div className="company">{job.company}{job.location ? ` · ${job.location}` : ""}</div>
          </div>
          <span className="posted">{timeAgo(job.posted_at)}</span>
        </div>
        <div className="badges">
          {job.score !== undefined && <span className="badge score">{job.score}% match</span>}
          {job.live && <span className="badge live">Live</span>}
          <span className={`badge type ${job.job_type === "internship" ? "intern" : ""}`}>{job.job_type}</span>
          <span className="badge">{LEVEL_LABELS[job.level] ?? job.level}</span>
          {expText && <span className="badge">{expText}</span>}
          {job.remote && <span className="badge remote">Remote</span>}
          {(job.matchedSkills ?? job.skills).slice(0, 6).map((s) => (
            <span key={s} className={`badge ${job.matchedSkills?.includes(s) ? "remote" : ""}`}>{s}</span>
          ))}
          {job.skills.length > 6 && <span className="badge">+{job.skills.length - 6}</span>}
        </div>
        {job.snippet && <p className="snippet">{job.snippet}…</p>}
      </div>
      {open && <JobDetailModal job={job} onClose={() => setOpen(false)} />}
    </>
  );
}

function JobDetailModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const [detail, setDetail] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Live (not-yet-persisted) matches already carry their full description — no row to fetch.
    if (job.live || job.description) return;
    setLoading(true);
    api.job(job.id)
      .then(({ job: full }) => setDetail(full))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [job.id, job.live, job.description]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const desc = detail?.description ?? job.description;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal panel job-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 style={{ paddingRight: 30 }}>{job.title}</h2>
        <div className="company" style={{ marginBottom: 12 }}>
          {job.company}{job.location ? ` · ${job.location}` : ""}
        </div>
        <div className="badges">
          {job.score !== undefined && <span className="badge score">{job.score}% match</span>}
          {job.live && <span className="badge live">Live</span>}
          <span className={`badge type ${job.job_type === "internship" ? "intern" : ""}`}>{job.job_type}</span>
          {job.remote && <span className="badge remote">Remote</span>}
          {job.skills.map((s) => (
            <span key={s} className={`badge ${job.matchedSkills?.includes(s) ? "remote" : ""}`}>{s}</span>
          ))}
        </div>
        <div className="job-detail">
          {loading && <div className="spinner" />}
          {desc && <div className="desc">{desc}</div>}
        </div>
        <div style={{ marginTop: 16 }}>
          <a className="btn" href={job.apply_url} target="_blank" rel="noreferrer">
            Apply on company site ↗
          </a>
        </div>
      </div>
    </div>
  );
}
