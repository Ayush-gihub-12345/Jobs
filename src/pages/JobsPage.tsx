import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Facets, type Job } from "../api";
import JobCard from "../components/JobCard";
import FilterPanel from "../components/FilterPanel";

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState<Facets | null>(null);
  const debounceRef = useRef<number>();

  const page = Number(params.get("page") ?? 1);
  const limit = 20;

  const get = (k: string) => params.get(k) ?? "";
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",") : []);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  const toggleList = (k: string, v: string) => {
    const cur = getList(k);
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };

  useEffect(() => {
    api.facets().then(setFacets).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const q = new URLSearchParams(params);
      q.set("limit", String(limit));
      api.jobs(q)
        .then((r) => { setJobs(r.jobs); setTotal(r.total); })
        .catch(() => { setJobs([]); setTotal(0); })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [params]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="searchbar">
        <div className="search-wrap">
          <span className="search-icon">🔎</span>
          <input
            placeholder="Search title, company, skills, keywords…"
            value={get("q")}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <select className="select-input" value={get("sort")} onChange={(e) => set("sort", e.target.value)}>
          <option value="">Newest first</option>
          <option value="company">By company</option>
        </select>
      </div>

      <div className="jobs-layout">
        <FilterPanel
          get={get} getList={getList} set={set} toggleList={toggleList}
          onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
          facets={facets}
        />

        <section>
          <p className="results-meta">
            {loading ? "Searching…" : `${total.toLocaleString()} position${total === 1 ? "" : "s"} found`}
          </p>
          {loading ? (
            <div className="spinner" />
          ) : jobs.length === 0 ? (
            <div className="panel empty">
              <b>No positions match these filters.</b>
              <p>Try clearing some filters — or add company career links in the Admin panel.</p>
            </div>
          ) : (
            <>
              <div className="job-list">
                {jobs.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
              {pages > 1 && (
                <div className="pagination">
                  <button className="btn secondary sm" disabled={page <= 1}
                    onClick={() => set("page", String(page - 1))}>← Prev</button>
                  <span className="page-info">Page {page} of {pages}</span>
                  <button className="btn secondary sm" disabled={page >= pages}
                    onClick={() => set("page", String(page + 1))}>Next →</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
