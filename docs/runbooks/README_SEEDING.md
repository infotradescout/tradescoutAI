# Business Directory Seeding (Unclaimed Listings)

TradeScout supports seeding real business listings as **Unclaimed** directory entries. A business is **never** marked claimed unless a verification step succeeds.

## Guardrails (non-negotiable)

- Seeded listings are **Unclaimed** (`claim_status = unclaimed`).
- Public directory endpoints **never expose** phone, email, or website. Contact stays Scout/Decision-Card gated.
- Users can submit **Suggest edit** / **Request removal**; these go to an admin queue.

## Prerequisites

- Neon Postgres (or any Postgres) reachable via `DATABASE_URL`
- Google Places API (New) enabled + an API key (`GOOGLE_PLACES_API_KEY`)
- Migrations/tables pushed (Drizzle)

## Database setup (Neon)

Point `DATABASE_URL` at your Neon database, then run:

```bash
npm run db:push
```

This creates/updates the schema, including:

- `business_external_refs` (dedupe/provenance)
- `business_seed_runs`, `business_seed_run_logs` (seeding logs + metrics)
- `business_suggestions` (edit/removal queue)

Alternative (SQL-only / Neon editor friendly):

- Run `migrations/0070_business_directory_seeding.sql` (idempotent), or:

```bash
npm run db:apply:sql migrations/0070_business_directory_seeding.sql
```

## Seeding via CLI (one command)

The seed script uses Google Places API (New) `places:searchText` with a FieldMask and pagination/backoff.

### Required env vars

- `DATABASE_URL`
- `GOOGLE_PLACES_API_KEY`
- `SEED_LOCATION` (example: `Pensacola, FL`)
- `SEED_TERMS` (comma-separated, example: `contractor,plumber,electrician`)
- `SEED_COUNTY` (**5-digit county FIPS**, example: `12033`)
- `SEED_STATE` (2-letter, example: `FL`)

Optional:

- `SEED_DELAY_MS` (default `1500`)

### PowerShell (Windows)

```powershell
$env:DATABASE_URL="postgres://..."
$env:GOOGLE_PLACES_API_KEY="..."
$env:SEED_LOCATION="Pensacola, FL"
$env:SEED_TERMS="contractor,plumber,electrician,roofing"
$env:SEED_COUNTY="12033"
$env:SEED_STATE="FL"
$env:SEED_DELAY_MS="1500"

npm run seed:businesses
```

### Bash/Zsh (Mac/Linux)

```bash
export DATABASE_URL="postgres://..."
export GOOGLE_PLACES_API_KEY="..."
export SEED_LOCATION="Pensacola, FL"
export SEED_TERMS="contractor,plumber,electrician,roofing"
export SEED_COUNTY="12033"
export SEED_STATE="FL"
export SEED_DELAY_MS="1500"

npm run seed:businesses
```

## Seeding via Admin OS (recommended for ops)

1) Start the app: `npm run dev`
2) Open Admin OS: `/admin/business-directory`
3) Use **Seeding** tab to spawn a run and watch logs

The server spawns `scripts/seed_businesses_places_new.mjs` and tracks everything in `business_seed_runs` and `business_seed_run_logs`.

## Browsing the directory

- Directory page: `/directory/businesses?countyFips=12033&stateCode=FL&claimed=unclaimed`
- Business page: `/business/:slug`
  - Unclaimed listings show an **Unclaimed** badge and a **Suggest Edit** action.

## Safety statement

Seeded listings are directory entries marked **Unclaimed**. TradeScout does not impersonate businesses, does not sell leads, and does not expose direct-contact vectors from seeded data. Claiming is a verification workflow, and contact remains intent/decision gated.
