import { useState } from "react";
import { api, timeAgo, type Job } from "../api";

const LEVEL_LABELS: Record<string, string> = {
  intern: "Intern", entry: "Entry level", mid: "Mid level", senior: "Senior", lead: "Lead / Staff+",
};

export default function JobCard({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !detail && !job.description) {
      setLoading(true);
      try {
        const { job: full } = await api.job(job.id);
        setDetail(full);
      } catch { /* keep card usable without detail */ }
      setLoading(false);
    }
  };

  const expText =
    job.exp_min !== null
      ? job.exp_max !== null ? `${job.exp_min}–${job.exp_max} yrs` : `${job.exp_min}+ yrs`
      : null;
  const desc = detail?.description ?? job.description;

  return (
    <div className="panel job-card" onClick={toggle}>
      <div className="top">
        <div>
          <h4>{job.title}</h4>
          <div className="company">{job.company}{job.location ? ` · ${job.location}` : ""}</div>
        </div>
        <span className="posted">{timeAgo(job.posted_at)}</span>
      </div>
      <div className="badges">
        {job.score !== undefined && <span className="badge score">{job.score}% match</span>}
        <span className={`badge type ${job.job_type === "internship" ? "intern" : ""}`}>{job.job_type}</span>
        <span className="badge">{LEVEL_LABELS[job.level] ?? job.level}</span>
        {expText && <span className="badge">{expText}</span>}
        {job.remote && <span className="badge remote">Remote</span>}
        {(job.matchedSkills ?? job.skills).slice(0, 6).map((s) => (
          <span key={s} className={`badge ${job.matchedSkills?.includes(s) ? "remote" : ""}`}>{s}</span>
        ))}
        {job.skills.length > 6 && <span className="badge">+{job.skills.length - 6}</span>}
      </div>
      {!open && job.snippet && <p className="snippet">{job.snippet}…</p>}
      {open && (
        <div className="job-detail" onClick={(e) => e.stopPropagation()}>
          {loading && <div className="spinner" />}
          {desc && <div className="desc">{desc}</div>}
          <div style={{ marginTop: 14 }}>
            <a className="btn" href={job.apply_url} target="_blank" rel="noreferrer">
              Apply on company site ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
