import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

function initials(name: string | null, email: string | null): string {
  if (name) return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (email ?? "?")[0]?.toUpperCase() ?? "?";
}

export default function UserMenu() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (loading) return null;

  if (!user) {
    return (
      <>
        <button type="button" className="btn sm" onClick={() => setShowAuth(true)}>Sign in</button>
        {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      </>
    );
  }

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="avatar-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="avatar">{initials(user.displayName, user.email)}</span>
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-header">
            <div className="dropdown-name">{user.displayName || "Account"}</div>
            <div className="dropdown-email">{user.email}</div>
          </div>
          <button type="button" onClick={() => { setOpen(false); navigate("/profile"); }}>My Profile</button>
          <button type="button" onClick={() => { setOpen(false); navigate("/preferences"); }}>Settings</button>
          <button type="button" className="danger" onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}
