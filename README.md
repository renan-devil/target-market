# OSS GTM Tool — `target-market`

An internal go-to-market intelligence tool for OSS. Two features in one
regular-looking SaaS, behind magic-link sign-in restricted to `@oss.ventures`:

1. **Signal Analyzer** — paste a company's website copy and/or describe your
   ICP. The tool surfaces the concrete, observable **buying signals** that
   indicate a strong fit, plus keywords and suggested filters — and can
   pre-filter the map to match.
2. **Industrial Map** — every industrial site (France, Europe, the US) on a
   map with **headcount, turnover, and industry**, AI **tagging & fit scoring**
   against your ICP, **account penetration** (which sites belong to OSS accounts
   and the relationship status), and one-click **CSV export** of any subset.

---

## Tech stack

| Concern        | Choice                                                            |
| -------------- | ---------------------------------------------------------------- |
| Framework      | Next.js 14 (App Router, TypeScript)                              |
| Styling        | Tailwind CSS                                                      |
| Database       | Prisma + SQLite (dev) — swap to Postgres for production          |
| Map            | MapLibre GL + OpenFreeMap tiles (no API key required)           |
| AI             | Claude (`@anthropic-ai/sdk`) with a built-in heuristic fallback |
| Auth           | Passwordless magic links (signed JWT session cookie via `jose`) |
| Data ingestion | OpenStreetMap Overpass importer                                  |

Everything runs out-of-the-box with **no external keys** — Claude falls back to
a heuristic analyzer and magic links are printed to the server log.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (defaults work for local dev)
cp .env.example .env
#    → optionally set ANTHROPIC_API_KEY for real AI analysis

# 3. Create the database, generate the client, and load sample data
npm run setup        # = prisma db push + generate + seed

# 4. Run it
npm run dev          # http://localhost:3000
```

### Signing in (local dev)

By default e-mails are not actually sent — the magic link is printed to the
**server log** and also shown on the sign-in screen. Enter any `@oss.ventures`
address and click the link that appears.

To send real e-mails, set `EMAIL_PROVIDER=resend` and `RESEND_API_KEY` in `.env`.

---

## Loading real industrial sites (OpenStreetMap)

The seed gives you ~150 realistic sample sites. To pull **real** sites from
OpenStreetMap:

```bash
npm run import:osm -- --country FR --limit 400
npm run import:osm -- --country DE --limit 300
npm run import:osm -- --country US --limit 400
```

- `--country` — ISO-2 country code (FR, DE, ES, IT, NL, BE, PL, GB, US, …)
- `--limit`   — max sites to fetch (default 400)
- `--endpoint`— alternate Overpass endpoint (default `overpass-api.de`)

OSM does not carry headcount or turnover, so those are left empty on imported
sites — enrich them later (manually, from a registry, or via the tagging tools).
Industry is inferred from OSM tags.

> **Network note:** the importer calls the public Overpass API. In a restricted
> environment you must allow egress to `overpass-api.de` (or your chosen
> endpoint). On a normal deployment it works without configuration.

---

## How the two features work

### Signal Analyzer (`/signals`)

- Inputs: a profile name, website copy, and/or an ICP description.
- `POST /api/signals/analyze` runs `analyzeIcp()` (Claude, or heuristic if no
  key) and saves an `IcpProfile` with the structured result.
- The result lists signals grouped by category (Firmographic, Technographic,
  Trigger event, Pain point, …) with an importance level and where to observe
  each one, plus keywords and **suggested map filters**.
- "View on map →" opens `/map` pre-filtered to the suggested industries,
  countries and headcount range.

### Industrial Map (`/map`)

- Filter by search text, country, industry, relationship, headcount range and
  minimum fit score. Filters are shareable via the URL.
- Color points **by relationship** (account penetration) or **by fit score**.
- Pick an ICP profile and click **“Tag & score”** to AI-tag and fit-score the
  shown sites against that ICP.
- Click any site to open a detail panel: edit its **account & relationship**,
  add tags, or AI-tag just that site.
- **Export CSV** downloads exactly the current filtered subset.

### Accounts (`/accounts`)

Manage OSS accounts and their relationship status. Sites link to accounts from
the map; penetration metrics roll up on the dashboard.

---

## Project layout

```
prisma/
  schema.prisma          # data model (User, MagicToken, IcpProfile, Account, IndustrialSite)
  seed.ts                # sample sites + accounts
scripts/
  import-osm.ts          # OpenStreetMap Overpass importer
src/
  middleware.ts          # route protection (verifies session JWT at the edge)
  lib/
    auth.ts              # magic tokens + JWT sessions + domain allow-list
    claude.ts            # ICP analysis & site tagging (+ heuristic fallback)
    email.ts             # pluggable e-mail (console | resend)
    db.ts, types.ts, industries.ts, site-filters.ts, serialize.ts, csv.ts
  app/
    login/               # sign-in screen
    api/                 # auth, signals, sites, accounts endpoints
    (app)/               # authenticated shell: dashboard, signals, map, accounts
  components/            # SignalAnalyzer, MapExplorer, SitesMap, SiteDetail, …
```

---

## Environment variables

See [`.env.example`](./.env.example) for the full list. The important ones:

| Variable                  | Default                  | Purpose                                   |
| ------------------------- | ------------------------ | ----------------------------------------- |
| `DATABASE_URL`            | `file:./dev.db`          | SQLite file (or a Postgres URL)           |
| `AUTH_SECRET`             | _(dev placeholder)_      | Signs sessions & tokens — **set in prod** |
| `APP_URL`                 | `http://localhost:3000`  | Base URL used to build magic links        |
| `ALLOWED_EMAIL_DOMAINS`   | `oss.ventures`           | Comma-separated allowed sign-in domains   |
| `ANTHROPIC_API_KEY`       | _(empty → heuristic)_    | Enables Claude analysis & tagging         |
| `EMAIL_PROVIDER`          | `console`                | `console` or `resend`                     |
| `NEXT_PUBLIC_MAP_STYLE_URL` | OpenFreeMap "liberty"  | MapLibre style URL                        |

---

## Going to production

1. **Database** — point `DATABASE_URL` at Postgres and change `provider` in
   `prisma/schema.prisma` to `postgresql`, then `npx prisma db push`. (For
   heavy geospatial querying you can later add PostGIS; the current filters are
   plain attribute/bounding-box queries and don't require it.)
2. **Secrets** — set a strong `AUTH_SECRET` (`openssl rand -base64 32`) and a
   correct `APP_URL`.
3. **E-mail** — set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (and a verified
   `EMAIL_FROM`).
4. **AI** — set `ANTHROPIC_API_KEY` to enable Claude.
5. `npm run build && npm start`.

---

## Scripts

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Start the dev server                          |
| `npm run build`      | Generate Prisma client + production build     |
| `npm start`          | Run the production server                     |
| `npm run setup`      | db push + generate + seed (first-time setup)  |
| `npm run db:seed`    | Re-load sample data                           |
| `npm run db:studio`  | Open Prisma Studio                            |
| `npm run import:osm` | Import real sites from OpenStreetMap          |
