import { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import JobsPage from "./pages/JobsPage";
import MatchPage from "./pages/MatchPage";
import LinkedInPage from "./pages/LinkedInPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <div className="logo">💼 Job<span>Hub</span></div>
          <nav className={`nav ${menuOpen ? "open" : ""}`}>
            <NavLink to="/" end>Job Search</NavLink>
            <NavLink to="/match">Resume Match</NavLink>
            <NavLink to="/linkedin">LinkedIn</NavLink>
          </nav>
          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<JobsPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/linkedin" element={<LinkedInPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </>
  );
}
