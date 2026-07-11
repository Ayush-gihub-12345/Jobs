import { Suspense, lazy, useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import JobsPage from "./pages/JobsPage";
import UserMenu from "./components/UserMenu";
import ThemeToggle from "./components/ThemeToggle";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

// Route-level code splitting: only Jobs (the landing page) ships in the initial bundle.
const MatchPage = lazy(() => import("./pages/MatchPage"));
const LinkedInPage = lazy(() => import("./pages/LinkedInPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const PreferencesPage = lazy(() => import("./pages/PreferencesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

const PRIMARY_NAV = [
  { label: "Jobs", to: "/", match: (loc: { pathname: string; search: string }) => loc.pathname === "/" && !loc.search },
  { label: "Fresher", to: "/?levels=entry&maxYears=0",
    match: (loc: { pathname: string; search: string }) => loc.pathname === "/" && loc.search === "?levels=entry&maxYears=0" },
  { label: "Internship", to: "/?types=internship",
    match: (loc: { pathname: string; search: string }) => loc.pathname === "/" && loc.search === "?types=internship" },
  { label: "Entry Level", to: "/?levels=entry",
    match: (loc: { pathname: string; search: string }) => loc.pathname === "/" && loc.search === "?levels=entry" },
  { label: "LinkedIn", to: "/linkedin", match: (loc: { pathname: string }) => loc.pathname === "/linkedin" },
  { label: "Resume Match", to: "/match", match: (loc: { pathname: string }) => loc.pathname === "/match" },
];

function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">h</span>
            hireers
          </Link>
          <nav className={`nav ${menuOpen ? "open" : ""}`}>
            {PRIMARY_NAV.map((item) => (
              <Link key={item.label} to={item.to} className={item.match(location) ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link to="/preferences" className="prefs-link">My Preferences</Link>
            <ThemeToggle />
            <UserMenu />
          </div>
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
        <Suspense fallback={<div className="spinner" />}>
          <Routes>
            <Route path="/" element={<JobsPage />} />
            <Route path="/match" element={<MatchPage />} />
            <Route path="/linkedin" element={<LinkedInPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
