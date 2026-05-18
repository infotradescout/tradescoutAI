# Completed Job Price Snapshots

Purpose: keep Scout price intelligence snapshot-backed. Scout reads completed-job price signals from `county_metrics`, not directly from finance documents.

## Metrics

- `completed_jobs_30d`: issued receipt count in the last 30 days, grouped by the receipt creator's canonical `users.county_fips`.
- `completed_job_median_receipt_usd_30d`: median issued receipt amount in USD over the same 30-day county window.

## Schedule

The scheduler runs `completed_job_price_snapshots` daily by default:

```bash
COMPLETED_JOB_PRICE_SNAPSHOT_SCHEDULE="0 2 * * *"
```

Disable with:

```bash
DISABLE_COMPLETED_JOB_PRICE_SNAPSHOTS=true
```

## Manual Backfill

Run once against the configured database:

```bash
npm run snapshot:completed-job-prices
```

Admins can also trigger the same snapshot job from the observability dashboard. In
the Snapshot Status panel, use the refresh action on the Completed Jobs county
price family. The protected route is:

```http
POST /api/admin/observability/completed-job-price-snapshots/refresh
```

For the full county price signal family runbook, including HomeScout and
TradeDeals refresh routes, see `docs/runbooks/county-price-signal-snapshots.md`.

## Scout Contract

Scout home price cards may read these metrics through `/api/scout/home-snapshot`. Do not derive completed-job pricing directly from `documents`, `pricing_data`, or job-specific read-time queries in user-facing Scout surfaces.
