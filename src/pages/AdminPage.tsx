import { useEffect, useState } from "react";
import { api, timeAgo, type Source } from "../api";

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

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = async () => {
    const [s, st] = await Promise.all([api.admin.sources(), api.admin.stats()]);
    setSources(s.sources);
    setStats(st);
  };
  useEffect(() => { load().catch(() => {}); }, []);

  const addSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setNotice(null);
    try {
      const res = await api.admin.addSource(newUrl.trim());
      setNewUrl("");
      setNotice(res.sync.ok
        ? { kind: "ok", text: `Added ${res.source.company} — imported ${res.sync.count} jobs.` }
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

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Admin panel</h1>
        <button className="btn secondary sm" onClick={onLogout}>Log out</button>
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
          <b>SmartRecruiters</b>, <b>Recruitee</b>, plus any page with JSON-LD job markup.
          All sources auto-refresh every hour.
        </div>
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
                      <div><a href={s.url} target="_blank" rel="noreferrer" className="muted" style={{ fontSize: 12.5 }}>{s.url}</a></div>
                    </td>
                    <td><span className="ats-chip">{s.ats}</span></td>
                    <td>
                      <span className={`status-pill ${s.status}`}>{s.status}</span>
                      {s.error && <div className="src-error">{s.error}</div>}
                    </td>
                    <td>{s.job_count}</td>
                    <td className="muted">{s.last_fetched_at ? timeAgo(s.last_fetched_at + "Z") : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn secondary sm" disabled={busyIds.has(s.id)}
                        onClick={() => withBusy(s.id, () => api.admin.refreshSource(s.id))}>
                        {busyIds.has(s.id) ? "…" : "⟳"}
                      </button>{" "}
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
