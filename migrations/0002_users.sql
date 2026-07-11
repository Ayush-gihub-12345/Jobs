-- App users, keyed by Firebase UID
CREATE TABLE users (
  uid TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One preferences row per user
CREATE TABLE preferences (
  uid TEXT PRIMARY KEY REFERENCES users(uid) ON DELETE CASCADE,
  locations TEXT NOT NULL DEFAULT '[]',
  remote_only INTEGER NOT NULL DEFAULT 0,
  salary_min INTEGER,
  salary_max INTEGER,
  currency TEXT NOT NULL DEFAULT 'USD',
  job_types TEXT NOT NULL DEFAULT '[]',
  categories TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  experience_level TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
