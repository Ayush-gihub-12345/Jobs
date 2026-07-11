# hireers — self-hosted job aggregation platform

Add company career links in the admin panel; hireers auto-detects the ATS behind them
(Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, or JSON-LD pages),
pulls every posting via the ATS's public API, and refreshes hourly.

> The deployed Cloudflare Worker is still internally named `jobs-platform` (renaming it would
> change your live URL) — see [wrangler.jsonc](wrangler.jsonc). Everything user-facing (UI,
> page title, `package.json`) is branded **hireers**.

**Features**

- Full-text search (SQLite FTS5) + filters: skills, role category, experience level,
  "my years of experience", job type (incl. internships), location, remote, company, date posted
- "Load more" results (20 at a time, appended — not full-page pagination), with a skeleton
  loading state and smooth-scroll throughout
- Resume matching: PDF parsed in the browser, skills extracted, jobs ranked by match score
- LinkedIn tab: resume search with the same rich filters over hireers' own aggregated listings
  (searches hireers' own data — does **not** scrape linkedin.com; see note below)
- Fresher / Internship / Entry Level nav shortcuts: preset filters for 0-year, internship-only,
  and 0–1-year experience roles
- User accounts via Firebase Auth (Google + email/password), with a saved-preferences page
  (locations, remote, salary range, job type, category, experience level) and a profile page
- Light / dark / system theme switcher, persisted per-browser
- Admin bulk-import: paste hand-entered listings (e.g. from a company's LinkedIn jobs page,
  which can't be pulled through an API) as `Title | Location | URL` lines — normalized through
  the same skill/level/category extraction as every automated source
- Admin panel: **not linked in navigation** — reachable only at `/admin`, protected by
  a username + password login

**Why no real LinkedIn scraping?** LinkedIn blocks unauthenticated scraping and their Terms
of Service prohibit it. The "LinkedIn" tab instead runs resume search over hireers' own
aggregated data. If a company posts on LinkedIn, it almost always also runs a real ATS
(Greenhouse/Lever/etc.) — add that link in Admin instead to get its jobs listed.

**Stack**: React (Vite) · Hono on Cloudflare Workers · D1 (SQLite) · hourly Cron Trigger

## Staying inside Cloudflare's free tier

D1's free-tier quota is dominated by **rows written**, not reads. The naive way to sync a job
board — delete everything for a source and reinsert it every hour — writes every single job
row every hour forever, whether or not it actually changed. That gets expensive fast as you
add sources.

Instead, every job stores a `content_hash` (migration `0003_optimize.sql`) fingerprinting the
fields that matter. Each hourly sync fetches the source, computes a hash per incoming job, and
only writes rows whose hash changed, plus deletes for postings that disappeared. On a typical
hour where a company hasn't changed most of its listings, this turns hundreds of writes into
a handful. (Bulk-imported/manual sources still do a simple full replace — they're small and
infrequent enough that it doesn't matter.)

Also indexed: `company` and `remote` (both filtered/grouped on every `/api/jobs` and
`/api/facets` request) — without an index, filtering by company on a large table means a full
scan, burning through the **rows read** quota instead.

If you add many high-volume sources, keep an eye on the D1 usage dashboard in Cloudflare —
the diffing keeps steady-state writes low, but the *first* sync of a new source still writes
every job once.

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
FIREBASE_PROJECT_ID=
```

### Enabling user sign-in (Firebase)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) and
   enable **Authentication** → Sign-in methods: **Google** and **Email/Password**.
2. Add a Web app to the project (Project settings → General → Your apps) and copy its config.
   It has 6 fields — only 4 are used here:

   | Field | Used? | Where it goes |
   |---|---|---|
   | `apiKey` | ✅ | `.env.local` → `VITE_FIREBASE_API_KEY` |
   | `authDomain` | ✅ | `.env.local` → `VITE_FIREBASE_AUTH_DOMAIN` |
   | `projectId` | ✅ | **Both** `.env.local` → `VITE_FIREBASE_PROJECT_ID` **and** `.dev.vars` / `wrangler.jsonc` → `FIREBASE_PROJECT_ID` |
   | `appId` | ✅ | `.env.local` → `VITE_FIREBASE_APP_ID` |
   | `storageBucket` | ❌ | not used — only needed for Firebase Storage |
   | `messagingSenderId` | ❌ | not used — only needed for Firebase Cloud Messaging |

3. Copy `.env.local.example` to `.env.local` and fill in the four `VITE_FIREBASE_*` values.
4. Fill in `FIREBASE_PROJECT_ID` in `.dev.vars` with the same project ID (used to verify
   Firebase tokens server-side — no service account key needed, verification uses Google's
   public keys, so `projectId` is the only value the backend needs).

Without this, the app still runs — Sign in shows "Sign-in isn't configured yet" instead of crashing.

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

### 4. Set environment variables

Two **secrets** (credentials — never committed):

| Variable | Value | Purpose |
|---|---|---|
| `ADMIN_USERNAME` | `ayush` | Admin panel login username |
| `ADMIN_PASSWORD` | `Syush@1212` | Admin panel login password |

```sh
npx wrangler secret put ADMIN_USERNAME
# paste: ayush

npx wrangler secret put ADMIN_PASSWORD
# paste: Syush@1212
```

One **plain var** in `wrangler.jsonc` (not secret — Firebase project IDs are public):
edit `vars.FIREBASE_PROJECT_ID` to your real Firebase project ID (see "Enabling user sign-in"
above). It's a placeholder right now — sign-in verification will silently reject every
token until this is set to the real value.

Also set the four `VITE_FIREBASE_*` build-time variables so the frontend can initialize
Firebase. Since this repo builds via `vite build` before `wrangler deploy`, set these as
plain entries in `wrangler.jsonc`'s build environment, or simplest: create `.env.production`
(gitignored, same shape as `.env.local.example`) before running `npm run deploy` locally —
Vite picks it up automatically at build time.

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
