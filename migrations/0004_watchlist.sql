-- Companies searched live during resume matching, in addition to admin-imported sources.
-- Never synced into `jobs` — queried fresh per /api/match request, nothing persisted.
CREATE TABLE watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  ats TEXT NOT NULL,
  ats_ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
