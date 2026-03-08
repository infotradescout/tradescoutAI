# HomeScout Ops (Dev/Staging Bootstrap)

HomeScout is designed DB-first and job-driven:

- Jobs write canonical facts into `home_scout_*` tables.
- Jobs write precomputed county intelligence snapshots into `county_metrics`.
- UI reads only; it does not compute intelligence.

## One-command bootstrap (dev)

1. Ensure DB connection env vars are set (see `.env.example`).
2. Run with an explicit real source:

```bash
npm run homescout:bootstrap -- --sourceKey northern_va_mls --path data/homescout/live-feed.json
```

This will:

- Apply required SQL migrations for HomeScout + county intelligence containers (without relying on `drizzle-kit push` prompts)
- Ensure the explicit HomeScout source you passed exists
- Run ingestion for that source
- Run bucket metrics + county metrics jobs (so listing pages show context)

HomeScout no longer ships with repo seed listing data. Bootstrap now requires either an explicit source or previously configured enabled sources.

## Advanced usage

Run ingestion for all enabled sources:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --runAllSources
```

Use a JSON URL source:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --sourceKey my_feed --sourceType json_url --url https://example.com/feed.json
```

Run against already-configured enabled sources without creating a new one:

```bash
tsx -r dotenv/config scripts/homescout-bootstrap.ts --runAllSources
```
*** Delete File: c:\Users\FlavorGood\Documents\AAATraderCorner\TradeScout\TradeScoutPro\data\homescout\seed-22105.json
