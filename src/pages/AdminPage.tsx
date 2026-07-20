import { useEffect, useState } from "react";
import { api, timeAgo, type Source, type WatchlistEntry } from "../api";

type Stats = Awaited<ReturnType<typeof api.admin.stats>>;

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    api.admin.me().then((r) => setAuthed(r.authenticated)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="spinner" />;

  if (!authed) {
    return (
      <div className="panel admin-login">
        <h2>Admin login</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          setLoginError("");
          try {
            await api.admin.login(username, password);
            setAuthed(true);
          } catch (err: any) {
            setLoginError(err.message);
          }
        }}>
          <input className="text-input" placeholder="Username" autoComplete="username"
            value={username} onChange={(e) => setUsername(e.target.value)} autoFocus
            style={{ marginBottom: 10 }} />
          <input className="text-input" type="password" placeholder="Password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginError && <div className="alert error">{loginError}</div>}
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={!username || !password}>Sign in</button>
          </div>
        </form>
      </div>
    );
  }

  return <Dashboard onLogout={() => { api.admin.logout(); setAuthed(false); }} />;
}

function parseManualJobs(text: string): { title: string; url: string; location?: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, location, url] = line.split("|").map((p) => p.trim());
      return { title, location: location || undefined, url };
    })
    .filter((j) => j.title && j.url);
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [manualCompany, setManualCompany] = useState("");
  const [manualText, setManualText] = useState("");
  const [importing, setImporting] = useState(false);
  const [watchUrl, setWatchUrl] = useState("");
  const [watching, setWatching] = useState(false);
  const [watchBusyIds, setWatchBusyIds] = useState<Set<number>>(new Set());

  const load = async () => {
    const [s, st, w] = await Promise.all([api.admin.sources(), api.admin.stats(), api.admin.watchlist()]);
    setSources(s.sources);
    setStats(st);
    setWatchlist(w.watchlist);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const addWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setWatching(true);
    setNotice(null);
    try {
      const res = await api.admin.addWatchlist(watchUrl.trim());
      setNotice({ kind: "ok", text: `Added ${res.entry.company} to the live-match watchlist.` });
      setWatchUrl("");
      await load();
    } catch (err: any) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setWatching(false);
    }
  };

  const removeWatch = async (id: number) => {
    setWatchBusyIds((s) => new Set(s).add(id));
    try { await api.admin.deleteWatchlist(id); await load(); }
    catch (err: any) { setNotice({ kind: "error", text: err.message }); }
    finally { setWatchBusyIds((s) => { const n = new Set(s); n.delete(id); return n; }); }
  };

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setNotice(null);
    try {
      const res = await api.admin.addSource(newUrl.trim());
      setNewUrl("");
      setNotice(res.sync.ok
        ? { kind: "ok", text: `Added ${res.source.company} — imported ${res.sync.count} India-based internship/fresher/entry-level job(s) (everything else from this source is skipped).` }
        : { kind: "error", text: `Source added but fetch failed: ${res.sync.error}` });
      await load();
    } catch (err: any) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setAdding(false);
    }
  };

  const withBusy = async (id: number, fn: () => Promise<unknown>) => {
    setBusyIds((s) => new Set(s).add(id));
    try { await fn(); await load(); }
    catch (err: any) { setNotice({ kind: "error", text: err.message }); }
    finally {
      setBusyIds((s) => { const n = new Set(s); n.delete(id); return n; });
    }
  };

  const manualJobs = parseManualJobs(manualText);
  const importManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setNotice(null);
    try {
      const res = await api.admin.importManual(manualCompany.trim(), manualJobs);
      const skipNotes = [
        res.skippedNonIndia > 0 && `${res.skippedNonIndia} non-India`,
        res.skippedNonJunior > 0 && `${res.skippedNonJunior} not internship/fresher/entry-level`,
      ].filter(Boolean).join(", ");
      setNotice({
        kind: "ok",
        text: `Imported ${res.count} job(s) for ${res.source.company}.`
          + (skipNotes ? ` Skipped: ${skipNotes}.` : ""),
      });
      setManualCompany("");
      setManualText("");
      await load();
    } catch (err: any) {
      setNotice({ kind: "error", text: err.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin panel</h1>
        <button className="btn secondary sm" onClick={onLogout}>Log out</button>
      </div>

      <div className="alert ok" style={{ marginBottom: 18 }}>
        hireers only keeps <b>India-based</b>, <b>internship / fresher / entry-level</b> postings.
        Every import path below (career links, bulk-import, live watchlist) checks both the
        location and the full job description — not just the title — and silently skips
        anything that doesn't qualify (mid/senior/lead roles, non-India locations).
      </div>

      {stats && (
        <div className="stat-cards">
          <div className="panel stat-card"><div className="num">{stats.totalJobs.toLocaleString()}</div><div className="lbl">Total jobs</div></div>
          <div className="panel stat-card"><div className="num">{stats.totalSources}</div><div className="lbl">Sources</div></div>
          <div className={`panel stat-card ${stats.sourceErrors ? "err" : ""}`}><div className="num">{stats.sourceErrors}</div><div className="lbl">Source errors</div></div>
          <div className="panel stat-card">
            <div className="num">{stats.byType.find((t) => t.k === "internship")?.n ?? 0}</div>
            <div className="lbl">Internships</div>
          </div>
        </div>
      )}

      <div className="admin-section">
        <h2>Add a career link</h2>
        <form className="form-row" onSubmit={addSource}>
          <input className="text-input" placeholder="e.g. https://boards.greenhouse.io/company or https://jobs.lever.co/company"
            value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
          <button className="btn" disabled={adding || !newUrl.trim()}>
            {adding ? "Importing…" : "Add & import"}
          </button>
        </form>
        {notice && <div className={`alert ${notice.kind}`}>{notice.text}</div>}
        <div className="help-box">
          Paste any company career page link. Supported automatically: <b>Greenhouse</b> (boards.greenhouse.io/…),{" "}
          <b>Lever</b> (jobs.lever.co/…), <b>Ashby</b> (jobs.ashbyhq.com/…), <b>Workable</b> (apply.workable.com/…),{" "}
          <b>SmartRecruiters</b>, <b>Recruitee</b>, <b>Zoho Recruit</b>, <b>Freshteam</b>, <b>Keka</b>,{" "}
          <b>Darwinbox</b>, plus any page with JSON-LD job markup. All sources auto-refresh every hour.{" "}
          <b>LinkedIn and Naukri links are rejected</b> — both block automated access; use bulk-import below instead.
        </div>
      </div>

      <div className="admin-section">
        <h2>Bulk-import company jobs</h2>
        <div className="help-box" style={{ marginTop: 0, marginBottom: 14 }}>
          For companies without a fetchable feed — e.g. jobs listed only on their LinkedIn or Naukri
          page. Both block automated scraping, so paste each listing by hand: one job per line,
          formatted <code>Title | Location | Apply URL</code>. Include a recognizable Indian
          city or "India" in the location, and make sure the title reflects the level (e.g.
          "Software Engineer Intern", "Graduate Trainee", "Junior Analyst") — entries that don't
          look India-based or don't read as internship/fresher/entry-level are skipped.
          Re-import the same company name any time to replace its listings with an updated paste.
        </div>
        <form onSubmit={importManual}>
          <input className="text-input" placeholder="Company name" value={manualCompany}
            onChange={(e) => setManualCompany(e.target.value)} style={{ marginBottom: 10 }} />
          <textarea className="text-input" rows={5}
            placeholder={"Senior Product Designer | Bengaluru, India | https://example.com/careers/123\nBackend Engineer | Remote - India | https://example.com/careers/124"}
            value={manualText} onChange={(e) => setManualText(e.target.value)} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>{manualJobs.length} job(s) parsed</span>
            <button className="btn" disabled={importing || !manualCompany.trim() || manualJobs.length === 0}>
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-section">
        <h2>Live resume-match watchlist ({watchlist.length}/20)</h2>
        <div className="help-box" style={{ marginTop: 0, marginBottom: 14 }}>
          Companies here aren't imported into Browse Jobs — instead, every time someone runs a
          resume match, hireers fetches these career pages live and includes anything that's a
          strong match (80%+), India-based, internship/fresher/entry-level, and posted in the
          last 15 days. Nothing from this list is stored in the database. Capped at 20 to keep
          each resume search fast and within a single Worker request's subrequest limit.
        </div>
        <form className="form-row" onSubmit={addWatch}>
          <input className="text-input" placeholder="Career page link (same platforms as above)"
            value={watchUrl} onChange={(e) => setWatchUrl(e.target.value)} />
          <button className="btn" disabled={watching || !watchUrl.trim() || watchlist.length >= 20}>
            {watching ? "Adding…" : "Add to watchlist"}
          </button>
        </form>
        {watchlist.length > 0 && (
          <div className="tag-list" style={{ marginTop: 12 }}>
            {watchlist.map((w) => (
              <span key={w.id} className="tag on">
                {w.company}
                <button type="button" className="tag-remove" disabled={watchBusyIds.has(w.id)}
                  onClick={() => removeWatch(w.id)}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="admin-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Sources ({sources.length})</h2>
          <button className="btn secondary sm" disabled={refreshingAll || sources.length === 0}
            onClick={async () => {
              setRefreshingAll(true);
              try { await api.admin.refreshAll(); await load(); }
              finally { setRefreshingAll(false); }
            }}>
            {refreshingAll ? "Refreshing…" : "⟳ Refresh all"}
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="panel empty">
            <b>No sources yet.</b>
            <p>Add your first career link above to start pulling jobs.</p>
          </div>
        ) : (
          <div className="panel" style={{ overflowX: "auto" }}>
            <table className="sources">
              <thead>
                <tr>
                  <th>Company</th><th>ATS</th><th>Status</th><th>Jobs</th><th>Last fetch</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <b>{s.company}</b>
                      <div>
                        {s.ats === "manual" ? (
                          <span className="muted" style={{ fontSize: 12.5 }}>Manually imported</span>
                        ) : (
                          <a href={s.url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12.5 }}>{s.url}</a>
                        )}
                      </div>
                    </td>
                    <td><span className="ats-chip">{s.ats}</span></td>
                    <td>
                      <span className={`status-pill ${s.status}`}>{s.status}</span>
                      {s.error && <div className="src-error">{s.error}</div>}
                    </td>
                    <td>{s.job_count}</td>
                    <td className="muted">{s.last_fetched_at ? timeAgo(s.last_fetched_at + "Z") : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {s.ats !== "manual" && (
                        <button className="btn secondary sm" disabled={busyIds.has(s.id)}
                          onClick={() => withBusy(s.id, () => api.admin.refreshSource(s.id))}>
                          {busyIds.has(s.id) ? "…" : "⟳"}
                        </button>
                      )}{" "}
                      <button className="btn danger sm" disabled={busyIds.has(s.id)}
                        onClick={() => {
                          if (confirm(`Delete ${s.company} and all its jobs?`)) {
                            withBusy(s.id, () => api.admin.deleteSource(s.id));
                          }
                        }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
