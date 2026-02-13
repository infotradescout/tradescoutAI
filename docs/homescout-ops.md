# HomeScout Ops (Dev/Staging Bootstrap)

HomeScout is designed DB-first and job-driven:

- Jobs write canonical facts into `home_scout_*` tables.
- Jobs write precomputed county intelligence snapshots into `county_metrics`.
- UI reads only; it does not compute intelligence.

## One-command bootstrap (dev)

1. Ensure DB connection env vars are set (see `.env.example`).
2. Run:

```bash
npm run homescout:bootstrap
```

This will:

- Deploy Drizzle migrations (`drizzle-kit migrate:deploy`)
- Ensure a HomeScout source exists: `seed_22105` (file: `data/homescout/seed-22105.json`)
- Run ingestion for that source
- Run bucket metrics + county metrics jobs (so listing pages show context)

## Advanced usage

Run ingestion for all enabled sources:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --runAllSources
```

Use a JSON URL source:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --sourceKey my_feed --sourceType json_url --url https://example.com/feed.json
```

Override the default seed file path:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --path data/homescout/seed-22105.json
```

