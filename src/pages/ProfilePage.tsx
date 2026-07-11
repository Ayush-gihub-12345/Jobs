import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthModal from "../components/AuthModal";
import { useState } from "react";

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();

  if (loading) return <div className="spinner" />;

  if (!user) {
    return (
      <div className="panel empty" style={{ maxWidth: 480, margin: "40px auto" }}>
        <b>Sign in to view your profile.</b>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => setShowAuth(true)}>Sign in</button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </div>
    );
  }

  const joined = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="prefs-page">
      <h1>My profile</h1>

      <div className="panel prefs-section profile-card">
        <span className="avatar large">
          {(user.displayName || user.email || "?")[0]?.toUpperCase()}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{user.displayName || "Unnamed account"}</div>
          <div className="muted">{user.email}</div>
          {joined && <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>Member since {joined}</div>}
        </div>
      </div>

      <div className="panel prefs-section" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn secondary" onClick={() => navigate("/preferences")}>Edit preferences</button>
        <button className="btn danger" onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}
