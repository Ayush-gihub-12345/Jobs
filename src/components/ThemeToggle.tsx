import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemeChoice } from "../context/ThemeContext";

const OPTIONS: { v: ThemeChoice; label: string; icon: string }[] = [
  { v: "light", label: "Light", icon: "☀️" },
  { v: "dark", label: "Dark", icon: "🌙" },
  { v: "system", label: "System", icon: "🖥️" },
];

export default function ThemeToggle() {
  const { choice, resolved, setChoice } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="theme-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        aria-label="Change theme" title="Change theme">
        {resolved === "dark" ? "🌙" : "☀️"}
      </button>
      {open && (
        <div className="dropdown">
          {OPTIONS.map((o) => (
            <button key={o.v} type="button"
              className={choice === o.v ? "theme-option active" : "theme-option"}
              onClick={() => { setChoice(o.v); setOpen(false); }}>
              <span>{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
