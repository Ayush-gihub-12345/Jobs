# JobHub — self-hosted job aggregation platform

Add company career links in the admin panel; JobHub auto-detects the ATS behind them
(Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, or JSON-LD pages),
pulls every posting via the ATS's public API, and refreshes hourly.

**Features**

- Full-text search (SQLite FTS5) + filters: skills, role category, experience level,
  "my years of experience", job type (incl. internships), location, remote, company, date posted
- Resume matching: PDF parsed in the browser, skills extracted, jobs ranked by match score
- LinkedIn tab: resume search with the same rich filters over JobHub's own aggregated listings
- Admin panel: **not linked in navigation** — reachable only at `/admin`, protected by
  a username + password login

**Stack**: React (Vite) · Hono on Cloudflare Workers · D1 (SQLite) · hourly Cron Trigger

## Local development

```sh
npm install
npm run db:migrate:local
npm run dev          # http://localhost:5173
```

Admin credentials for local dev live in `.dev.vars` (gitignored, never committed):

```
ADMIN_USERNAME=ayush
ADMIN_PASSWORD=Syush@1212
```

## Deploying: Workers, not Pages

This project deploys as a **Cloudflare Worker**, not Cloudflare Pages. Pages Functions don't
support Cron Triggers (needed for the hourly refresh) the same way, and this repo is already
wired for Workers — `wrangler.jsonc` defines the Worker entrypoint (`worker/index.ts`), serves
the built React app as static assets, and binds D1 + the cron schedule. `npm run deploy` builds
the frontend and runs `wrangler deploy` in one step.

### 1. Log in to Cloudflare

```sh
npx wrangler login
```

### 2. Create the production D1 database

```sh
npx wrangler d1 create jobs-db
```

Copy the printed `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`
(currently a placeholder).

### 3. Apply migrations to the remote database

```sh
npm run db:migrate:remote
```

### 4. Set environment variables (secrets)

These two secrets are **required** — there is no `vars` block in `wrangler.jsonc` for them
on purpose, since they're credentials and shouldn't be committed to git.

| Variable | Value | Purpose |
|---|---|---|
| `ADMIN_USERNAME` | `ayush` | Admin panel login username |
| `ADMIN_PASSWORD` | `Syush@1212` | Admin panel login password |

Set them with:

```sh
npx wrangler secret put ADMIN_USERNAME
# paste: ayush

npx wrangler secret put ADMIN_PASSWORD
# paste: Syush@1212
```

No other environment variables are needed — the `DB` binding (D1) and the hourly cron
schedule are both configured declaratively in `wrangler.jsonc`, not as env vars.

### 5. Build and deploy

```sh
npm run deploy
```

This runs `vite build` then `wrangler deploy`. The Worker serves both the API (`/api/*`)
and the built static frontend from the same deployment — no separate Pages project needed.

### 6. Verify

- Visit `https://<your-worker>.<your-subdomain>.workers.dev/` — jobs list (empty until you add sources)
- Visit `.../admin` directly (there's no nav link to it) and sign in with the credentials above
- The hourly Cron Trigger (`triggers.crons` in `wrangler.jsonc`) starts refreshing all
  added sources automatically once deployed — no manual step needed

### Changing the admin password later

```sh
npx wrangler secret put ADMIN_PASSWORD
```

This overwrites the existing secret; redeploy isn't required, it takes effect immediately
on the next request.
