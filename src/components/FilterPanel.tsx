import { useMemo, useState } from "react";
import type { Facets } from "../api";
import { FILTER_KEYS } from "../lib/useFilterState";

const TYPES = [
  { v: "full-time", label: "Full-time" },
  { v: "internship", label: "Internship" },
  { v: "contract", label: "Contract" },
  { v: "part-time", label: "Part-time" },
];
const LEVELS = [
  { v: "intern", label: "Intern" },
  { v: "entry", label: "Entry level (0–1 yrs)" },
  { v: "mid", label: "Mid level (2–4 yrs)" },
  { v: "senior", label: "Senior (5+ yrs)" },
  { v: "lead", label: "Lead / Staff+" },
];
const CATEGORIES = [
  "engineering", "data", "design", "product", "marketing",
  "sales", "hr", "finance", "operations", "support", "other",
];
const POSTED = [
  { v: "", label: "Any time" },
  { v: "1", label: "Last 24 hours" },
  { v: "7", label: "Last week" },
  { v: "30", label: "Last month" },
];

interface Props {
  get: (k: string) => string;
  getList: (k: string) => string[];
  set: (k: string, v: string) => void;
  toggleList: (k: string, v: string) => void;
  onClearAll: () => void;
  facets: Facets | null;
  /** Restrict the company list to entries relevant to the current result set (e.g. resume matches). */
  companyOptions?: { k: string; n: number }[];
  /** Restrict the skill list similarly. */
  skillOptions?: { k: string; n: number }[];
  maxCompanies?: number;
}

export default function FilterPanel({
  get, getList, set, toggleList, onClearAll, facets, companyOptions, skillOptions, maxCompanies = 12,
}: Props) {
  const [skillSearch, setSkillSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = FILTER_KEYS.filter((k) => get(k)).length;
  const skillPool = skillOptions ?? facets?.skills ?? [];
  const companyPool = companyOptions ?? facets?.companies ?? [];

  const visibleSkills = useMemo(() => {
    const selected = new Set(getList("skills"));
    return skillPool
      .filter((s) => s.k.toLowerCase().includes(skillSearch.toLowerCase()) || selected.has(s.k))
      .slice(0, 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillPool, skillSearch, get("skills")]);

  return (
    <aside className="panel filters">
      <button type="button" className="filters-toggle" onClick={() => setMobileOpen((o) => !o)}>
        <span>Filters{activeCount > 0 ? ` (${activeCount})` : ""}</span>
        <span aria-hidden>{mobileOpen ? "▲" : "▼"}</span>
      </button>

      <div className={`filter-body ${mobileOpen ? "open" : ""}`}>
        <h3>
          Filters
          {activeCount > 0 && (
            <button type="button" className="clear-btn" onClick={onClearAll}>
              Clear all ({activeCount})
            </button>
          )}
        </h3>

        <div className="filter-group">
          <label className="group-title">Job type</label>
          {TYPES.map((t) => (
            <label key={t.v} className="check-row">
              <input type="checkbox" checked={getList("types").includes(t.v)}
                onChange={() => toggleList("types", t.v)} />
              {t.label}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <label className="group-title">Experience level</label>
          {LEVELS.map((l) => (
            <label key={l.v} className="check-row">
              <input type="checkbox" checked={getList("levels").includes(l.v)}
                onChange={() => toggleList("levels", l.v)} />
              {l.label}
            </label>
          ))}
          <div style={{ marginTop: 12 }}>
            <label className="group-title">
              My experience: <span className="range-value">
                {get("maxYears") === "" ? "Any" : `${get("maxYears")} yrs`}
              </span>
            </label>
            <input type="range" min={0} max={15}
              value={get("maxYears") === "" ? 15 : get("maxYears")}
              onChange={(e) => set("maxYears", e.target.value === "15" ? "" : e.target.value)} />
            <div className="muted" style={{ fontSize: 12 }}>
              Hides positions requiring more years than you have
            </div>
          </div>
        </div>

        <div className="filter-group">
          <label className="group-title">Skills</label>
          <input className="text-input" placeholder="Find a skill…" value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)} />
          <div className="tag-list">
            {visibleSkills.map((s) => (
              <button key={s.k} type="button"
                className={`tag ${getList("skills").includes(s.k) ? "on" : ""}`}
                onClick={() => toggleList("skills", s.k)}>
                {s.k} <span style={{ opacity: 0.7 }}>{s.n}</span>
              </button>
            ))}
            {skillPool.length === 0 && (
              <span className="muted" style={{ fontSize: 13 }}>No skills available yet</span>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label className="group-title">Role category</label>
          {CATEGORIES.map((cat) => (
            <label key={cat} className="check-row" style={{ textTransform: "capitalize" }}>
              <input type="checkbox" checked={getList("categories").includes(cat)}
                onChange={() => toggleList("categories", cat)} />
              {cat}
            </label>
          ))}
        </div>

        <div className="filter-group">
          <label className="group-title">Location</label>
          <input className="text-input" placeholder="City or country…" value={get("location")}
            onChange={(e) => set("location", e.target.value)} />
          <label className="check-row" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={get("remote") === "1"}
              onChange={() => set("remote", get("remote") === "1" ? "" : "1")} />
            Remote only
          </label>
        </div>

        <div className="filter-group">
          <label className="group-title">Date posted</label>
          <select className="select-input" value={get("postedWithin")}
            onChange={(e) => set("postedWithin", e.target.value)}>
            {POSTED.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
          </select>
        </div>

        {companyPool.length > 0 && (
          <div className="filter-group">
            <label className="group-title">Company</label>
            {companyPool.slice(0, maxCompanies).map((co) => (
              <label key={co.k} className="check-row">
                <input type="checkbox" checked={getList("companies").includes(co.k)}
                  onChange={() => toggleList("companies", co.k)} />
                {co.k} <span className="count">{co.n}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
