# County Price Signal Snapshots

Purpose: keep Scout price and trend answers grounded in precomputed county facts.
Scout reads these signals from `county_metrics`; user-facing Scout surfaces should
not derive them directly from source tables at read time.

## Metric Families

- HomeScout: `homescout_median_price`, `homescout_median_dom_days`,
  `homescout_price_drops_7d`.
- TradeDeals: `tradedeals_active`, `tradedeals_claimed_30d`.
- Completed Jobs: `completed_jobs_30d`,
  `completed_job_median_receipt_usd_30d`.

## Manual Refresh

Admins can refresh each family from the observability dashboard Snapshot Status
panel. The protected routes are:

```http
POST /api/admin/observability/homescout-price-snapshots/refresh
POST /api/admin/observability/tradedeals-price-snapshots/refresh
POST /api/admin/observability/completed-job-price-snapshots/refresh
```

Each route uses the same job-level advisory lock as the scheduler, so a manual
refresh returns `409` if that family is already running.

## Contract

- Visibility does not grant contact access.
- Price signals are facts in `county_metrics`.
- Admin observability may trigger jobs, but Scout still reads precomputed
  county facts instead of source-table derivations.
