-- Job sources: career page links added in the admin panel
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  company TEXT NOT NULL,
  ats TEXT NOT NULL,
  ats_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  job_count INTEGER NOT NULL DEFAULT 0,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Normalized job listings pulled from sources
CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  remote INTEGER NOT NULL DEFAULT 0,
  job_type TEXT NOT NULL DEFAULT 'full-time',
  level TEXT NOT NULL DEFAULT 'mid',
  exp_min INTEGER,
  exp_max INTEGER,
  role_category TEXT NOT NULL DEFAULT 'other',
  skills TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  apply_url TEXT NOT NULL,
  posted_at TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_id, external_id)
);

CREATE INDEX idx_jobs_source ON jobs(source_id);
CREATE INDEX idx_jobs_type ON jobs(job_type);
CREATE INDEX idx_jobs_level ON jobs(level);
CREATE INDEX idx_jobs_category ON jobs(role_category);
CREATE INDEX idx_jobs_posted ON jobs(posted_at);

-- Full-text search over jobs
CREATE VIRTUAL TABLE jobs_fts USING fts5(
  title, company, location, description, skills,
  content='jobs', content_rowid='id'
);

CREATE TRIGGER jobs_ai AFTER INSERT ON jobs BEGIN
  INSERT INTO jobs_fts(rowid, title, company, location, description, skills)
  VALUES (new.id, new.title, new.company, new.location, new.description, new.skills);
END;

CREATE TRIGGER jobs_ad AFTER DELETE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, location, description, skills)
  VALUES ('delete', old.id, old.title, old.company, old.location, old.description, old.skills);
END;

CREATE TRIGGER jobs_au AFTER UPDATE ON jobs BEGIN
  INSERT INTO jobs_fts(jobs_fts, rowid, title, company, location, description, skills)
  VALUES ('delete', old.id, old.title, old.company, old.location, old.description, old.skills);
  INSERT INTO jobs_fts(rowid, title, company, location, description, skills)
  VALUES (new.id, new.title, new.company, new.location, new.description, new.skills);
END;
