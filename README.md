# hireers — India-only job aggregation platform

Add company career links in the admin panel; hireers auto-detects the ATS behind them
(Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Zoho Recruit, Freshteam,
Keka, Darwinbox, or any page with JSON-LD job markup), pulls every posting via the ATS's
public API, and refreshes hourly.

**hireers only lists India-based jobs.** Every import path — career links, bulk-import, and
the live resume-match watchlist — filters to India-based listings by location text (city name
or "India") and silently skips everything else. See `isIndiaLocation()` in `worker/extract.ts`
if you need to extend the recognized city list.

> The deployed Cloudflare Worker is still internally named `jobs-platform` (renaming it would
> change your live URL) — see [wrangler.jsonc](wrangler.jsonc). Everything user-facing (UI,
> page title, `package.json`) is branded **hireers**.

**Features**

- Full-text search (SQLite FTS5) + filters: skills, role category, experience level,
  "my years of experience", job type (incl. internships), location, remote, company, date posted
- "Load more" results (20 at a time, appended — not full-page pagination), with a skeleton
  loading state and smooth-scroll throughout
- Resume matching: PDF parsed in the browser, skills extracted, jobs ranked by match score —
  scored against every stored job, **plus** a live, on-demand check of an admin-curated
  "watchlist" of companies for anything that's a strong match (80%+), India-based, and posted
  in the last 15 days. Nothing from the live watchlist check is written to the database — it's
  computed fresh per request and discarded after the response.
- Fresher / Internship / Entry Level nav shortcuts: preset filters for 0-year, internship-only,
  and 0–1-year experience roles
- User accounts via Firebase Auth (Google + email/password), persistent sign-in (stays signed
  in across browser restarts), with a saved-preferences page (locations, remote, salary range,
  job type, category, experience level) and a profile page
- Light / dark / system theme switcher, persisted per-browser
- Admin bulk-import: paste hand-entered listings (e.g. from a company's LinkedIn or Naukri
  jobs page — both block automated access) as `Title | Location | URL` lines — normalized
  through the same skill/level/category extraction as every automated source
- Admin panel: **not linked in navigation** — reachable only at `/admin`, protected by
  a username + password login
- Job detail opens in a popup (not a full-screen takeover) — close via the ✕, Escape, or
  clicking outside it

**Why no LinkedIn/Naukri scraping?** Both block unauthenticated automated access and their
Terms of Service prohibit it (Naukri's `robots.txt` itself returns 403 to bots). Admin rejects
links to either host with an explanation; use the bulk-import tool to paste those listings by
hand instead, or — better — add the company's own ATS career page if it has one.

**Stack**: React (Vite) · Hono on Cloudflare Workers · D1 (SQLite) · Firebase Auth · hourly Cron Trigger

## Staying inside Cloudflare's free tier

D1's free-tier quota is dominated by **rows written**, not reads. The naive way to sync a job
board — delete everything for a source and reinsert it every hour — writes every single job
row every hour forever, whether or not it actually changed.

Instead, every job stores a `content_hash` (migration `0003_optimize.sql`) fingerprinting the
fields that matter. Each hourly sync fetches the source, computes a hash per incoming job, and
only writes rows whose hash changed, plus deletes for postings that disappeared or fell outside
the India filter. On a typical hour where a company hasn't changed most of its listings, this
turns hundreds of writes into a handful. (Bulk-imported/manual sources still do a simple full
replace — they're small and infrequent enough that it doesn't matter.)

Also indexed: `company` and `remote` (both filtered/grouped on every `/api/jobs` and
`/api/facets` request) — without an index, filtering by company on a large table means a full
scan, burning through the **rows read** quota instead.

The live resume-match watchlist (capped at 20 companies in `worker/index.ts`) is the one place
that does real work per user request — each match fetches every watchlist company's career
page live. Keep the watchlist short; it's meant for a curated few companies you especially
want covered, not a second copy of every source you've already imported.

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
FIREBASE_PROJECT_ID=jobs-9b284
```

### Firebase — one step still needed

The Firebase project (`jobs-9b284`) is already wired into the code (`.env.local` for the
frontend, `.dev.vars`/`wrangler.jsonc` for the backend). **Sign-in itself won't work yet**
until you enable the providers in the Firebase Console:

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → project
   `jobs-9b284` → **Authentication** → **Sign-in method**.
2. Enable **Google** and **Email/Password**.

Until that's done, clicking Sign in / Sign up returns `auth/operation-not-allowed` — that's
Firebase telling you the provider isn't turned on, not a bug in the app. This was confirmed by
testing: the app correctly reaches your Firebase project and gets a real, specific error back.

Sign-in persists across browser restarts (`browserLocalPersistence` in `src/lib/firebase.ts`)
— sign in once, stay signed in until an explicit sign-out.

## Deploying: Workers, not Pages

This project deploys as a **Cloudflare Worker**, not Cloudflare Pages. Pages Functions don't
support Cron Triggers (needed for the hourly refresh) the same way, and this repo is already
wired for Workers — `wrangler.jsonc` defines the Worker entrypoint (`worker/index.ts`), serves
the built React app as static assets, and binds D1 + the cron schedule. `npm run deploy` builds
the frontend and runs `wrangler deploy` in one step.

### Deploying to a different Cloudflare account

`wrangler.jsonc` currently points at a D1 database (`database_id`) created under whichever
Cloudflare account was last logged in via `wrangler login` in this environment — **that
database won't exist in a different account.** To deploy to another account:

```sh
npx wrangler logout          # clear the current session (if any)
npx wrangler login           # log in to the *target* account
npx wrangler d1 create jobs-db
```

Copy the printed `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`,
replacing the current value, then continue with steps 3–5 below. The Firebase project
(`jobs-9b284`) is independent of Cloudflare — reuse the same `FIREBASE_PROJECT_ID` and
`VITE_FIREBASE_*` values regardless of which Cloudflare account hosts the Worker.

### 1. Log in to Cloudflare

```sh
npx wrangler login
```

### 2. Create the production D1 database

```sh
npx wrangler d1 create jobs-db
```

Copy the printed `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`.

### 3. Apply migrations to the remote database

```sh
npm run db:migrate:remote
```

### 4. Set environment variables

Two **secrets** (credentials — never committed):

```sh
npx wrangler secret put ADMIN_USERNAME
# paste: ayush

npx wrangler secret put ADMIN_PASSWORD
# paste: Syush@1212
```

`FIREBASE_PROJECT_ID` is already set as a plain `var` in `wrangler.jsonc` (`jobs-9b284`) —
not a secret, Firebase project IDs are public. No action needed unless you're using a
different Firebase project.

Also set the four `VITE_FIREBASE_*` build-time variables so the frontend can initialize
Firebase. Since this repo builds via `vite build` before `wrangler deploy`, create
`.env.production` (gitignored, same shape as `.env.local` / `.env.local.example`) before
running `npm run deploy` — Vite picks it up automatically at build time. `.env.local` already
has the working values for `jobs-9b284`; copy it if you're keeping the same Firebase project.

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
