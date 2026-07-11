-- Content hash lets the sync engine skip rewriting jobs that haven't changed since the
-- last hourly poll, instead of blindly deleting+reinserting every row every run.
ALTER TABLE jobs ADD COLUMN content_hash TEXT;

-- Both are used in every /api/jobs and /api/facets request (company filter/facet, remote filter).
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_remote ON jobs(remote);
