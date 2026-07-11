import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, type Facets, type Job } from "../api";
import JobCard from "../components/JobCard";
import FilterPanel from "../components/FilterPanel";

const PAGE_SIZE = 20;

export default function JobsPage() {
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [facets, setFacets] = useState<Facets | null>(null);
  const debounceRef = useRef<number>();

  const get = (k: string) => params.get(k) ?? "";
  const getList = (k: string) => (params.get(k) ? params.get(k)!.split(",") : []);
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };
  const toggleList = (k: string, v: string) => {
    const cur = getList(k);
    set(k, (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(","));
  };

  useEffect(() => {
    api.facets().then(setFacets).catch(() => {});
  }, []);

  // Filters/search changed: reset and fetch page 1 (debounced so typing doesn't spam requests)
  useEffect(() => {
    setLoading(true);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const q = new URLSearchParams(params);
      q.set("limit", String(PAGE_SIZE));
      api.jobs(q)
        .then((r) => { setJobs(r.jobs); setTotal(r.total); })
        .catch(() => { setJobs([]); setTotal(0); })
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const loadMore = () => {
    setLoadingMore(true);
    const q = new URLSearchParams(params);
    q.set("limit", String(PAGE_SIZE));
    q.set("offset", String(jobs.length));
    api.jobs(q)
      .then((r) => setJobs((prev) => [...prev, ...r.jobs]))
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = jobs.length < total;

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
            <JobListSkeleton />
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
              {hasMore && (
                <div className="load-more-row">
                  <button className="btn secondary" disabled={loadingMore} onClick={loadMore}>
                    {loadingMore ? "Loading…" : `Load more (${total - jobs.length} remaining)`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function JobListSkeleton() {
  return (
    <div className="job-list">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="panel job-card skeleton">
          <div className="sk-line sk-title" />
          <div className="sk-line sk-sub" />
          <div className="sk-badges">
            <span className="sk-badge" /><span className="sk-badge" /><span className="sk-badge" />
          </div>
        </div>
      ))}
    </div>
  );
}
