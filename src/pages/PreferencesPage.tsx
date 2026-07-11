import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, type Preferences } from "../api";
import { JOB_TYPES, CATEGORIES, LEVELS, CURRENCIES } from "../lib/filterOptions";
import AuthModal from "../components/AuthModal";

const EMPTY: Preferences = {
  locations: [], remoteOnly: false, salaryMin: null, salaryMax: null, currency: "USD",
  jobTypes: [], categories: [], skills: [], experienceLevel: null,
};

export default function PreferencesPage() {
  const { user, loading, getIdToken } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(EMPTY);
  const [locationInput, setLocationInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await getIdToken();
      if (!token) return;
      try {
        setPrefs(await api.me.getPreferences(token));
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [user]);

  if (loading) return <div className="spinner" />;

  if (!user) {
    return (
      <div className="panel empty" style={{ maxWidth: 480, margin: "40px auto" }}>
        <b>Sign in to set your preferences.</b>
        <p>Salary range, preferred locations, job types and more — saved to your account.</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowAuth(true)}>Sign in</button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const toggle = (key: "jobTypes" | "categories", value: string) => {
    setPrefs((p) => ({
      ...p,
      [key]: p[key].includes(value) ? p[key].filter((v) => v !== value) : [...p[key], value],
    }));
  };

  const addLocation = () => {
    const v = locationInput.trim();
    if (v && !prefs.locations.includes(v)) setPrefs((p) => ({ ...p, locations: [...p.locations, v] }));
    setLocationInput("");
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Not signed in");
      await api.me.savePreferences(token, prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="prefs-page">
      <h1>My preferences</h1>
      <p className="muted">Fine-tune what a great job looks like for you.</p>

      <div className="panel prefs-section">
        <h3>Locations</h3>
        <div className="form-row">
          <input className="text-input" placeholder="e.g. Bengaluru, Remote, New York"
            value={locationInput} onChange={(e) => setLocationInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLocation(); } }} />
          <button type="button" className="btn secondary" onClick={addLocation}>Add</button>
        </div>
        <div className="tag-list">
          {prefs.locations.map((loc) => (
            <span key={loc} className="tag on">
              {loc}
              <button type="button" className="tag-remove"
                onClick={() => setPrefs((p) => ({ ...p, locations: p.locations.filter((l) => l !== loc) }))}>✕</button>
            </span>
          ))}
        </div>
        <label className="check-row" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={prefs.remoteOnly}
            onChange={(e) => setPrefs((p) => ({ ...p, remoteOnly: e.target.checked }))} />
          Remote only
        </label>
      </div>

      <div className="panel prefs-section">
        <h3>Salary expectations</h3>
        <div className="salary-row">
          <select className="select-input" value={prefs.currency}
            onChange={(e) => setPrefs((p) => ({ ...p, currency: e.target.value }))}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="text-input" type="number" placeholder="Min" min={0}
            value={prefs.salaryMin ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, salaryMin: e.target.value ? Number(e.target.value) : null }))} />
          <span className="muted">to</span>
          <input className="text-input" type="number" placeholder="Max" min={0}
            value={prefs.salaryMax ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, salaryMax: e.target.value ? Number(e.target.value) : null }))} />
        </div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>
          Note: most listings don't publish salary, so this is saved to your profile for reference
          rather than used as a hard filter yet.
        </div>
      </div>

      <div className="panel prefs-section">
        <h3>Preferred experience level</h3>
        <select className="select-input" value={prefs.experienceLevel ?? ""}
          onChange={(e) => setPrefs((p) => ({ ...p, experienceLevel: e.target.value || null }))}>
          <option value="">No preference</option>
          {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
        </select>
      </div>

      <div className="panel prefs-section">
        <h3>Job type</h3>
        <div className="check-grid">
          {JOB_TYPES.map((t) => (
            <label key={t.v} className="check-row">
              <input type="checkbox" checked={prefs.jobTypes.includes(t.v)} onChange={() => toggle("jobTypes", t.v)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div className="panel prefs-section">
        <h3>Role category</h3>
        <div className="check-grid">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="check-row" style={{ textTransform: "capitalize" }}>
              <input type="checkbox" checked={prefs.categories.includes(cat)} onChange={() => toggle("categories", cat)} />
              {cat}
            </label>
          ))}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {saved && <div className="alert ok">Preferences saved.</div>}
      <button className="btn" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save preferences"}</button>
    </div>
  );
}
