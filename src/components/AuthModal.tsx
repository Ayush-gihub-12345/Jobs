import { useState } from "react";
import { signInEmail, signUpEmail, signInGoogle } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { configured } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signin") await signInEmail(email, password);
      else await signUpEmail(email, password, name);
      onClose();
    } catch (err: any) {
      setError(friendlyAuthError(err?.code ?? err?.message));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError("");
    setBusy(true);
    try {
      await signInGoogle();
      onClose();
    } catch (err: any) {
      setError(friendlyAuthError(err?.code ?? err?.message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2>{mode === "signin" ? "Sign in" : "Create your account"}</h2>
        <p className="muted" style={{ fontSize: 13.5, marginTop: -6 }}>
          Save preferences and get a tailored job feed.
        </p>

        {!configured ? (
          <div className="alert error" style={{ marginTop: 14 }}>
            Sign-in isn't configured yet. Set the <code>VITE_FIREBASE_*</code> environment
            variables from your Firebase project to enable this.
          </div>
        ) : (
          <>
            <button type="button" className="btn secondary google-btn" onClick={google} disabled={busy}>
              Continue with Google
            </button>
            <div className="divider"><span>or</span></div>

            <form onSubmit={submit}>
              {mode === "signup" && (
                <input className="text-input" placeholder="Full name" value={name}
                  onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
              )}
              <input className="text-input" type="email" placeholder="Email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 10 }} />
              <input className="text-input" type="password" placeholder="Password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
              {error && <div className="alert error" style={{ marginTop: 10 }}>{error}</div>}
              <button className="btn" type="submit" disabled={busy || !email || !password}
                style={{ width: "100%", justifyContent: "center", marginTop: 14 }}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <p className="switch-mode">
              {mode === "signin" ? (
                <>Don't have an account? <button type="button" onClick={() => setMode("signup")}>Sign up</button></>
              ) : (
                <>Already have an account? <button type="button" onClick={() => setMode("signin")}>Sign in</button></>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function friendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email": return "That email address looks invalid.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/email-already-in-use": return "An account with this email already exists.";
    case "auth/weak-password": return "Password should be at least 6 characters.";
    case "auth/popup-closed-by-user": return "Sign-in was cancelled.";
    default: return code || "Something went wrong. Please try again.";
  }
}
