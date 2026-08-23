# Law Exceptions Ledger

Purpose: track temporary deviations from TradeScout law with explicit ownership and removal deadlines.

## Rules

1. No temporary exception without:
   - owner
   - rationale
   - removal date
   - linked issue/pr
2. Expired exceptions block release until renewed or removed.
3. All exceptions must be reflected in `docs/audits/LAW_REALITY_MATRIX.md`.

## Current Exceptions

| Exception ID | Law ID | Current Behavior | Owner | Created | Removal Date | Issue/PR | Status |
|---|---|---|---|---|---|---|---|
| EXC-2026-04-09-001 | LAW_ID_PRECOMPUTE_ONLY | Market signal endpoints had read-time index computation. Replaced with scheduled snapshot reads (`market_signals_snapshots`) and scheduler wiring. | Platform Engineering (Data Plane) | 2026-04-09 | 2026-04-10 | PR `governance follow-up (2026-04-10)` | closed |
| EXC-2026-08-09-001 | LAW_ID_PRECOMPUTE_ONLY | Discovery Observatory Wave 1 reads non-contact public business/profile facts and derives admin-only surface classifications at request time. Replace this with a scheduled, stored public-entity intelligence snapshot before the deadline; the exception grants no contact, ranking, trust, or publication authority. | TradeScout Platform Engineering | 2026-08-09 | 2026-09-30 | PR #296 | open |
| EXC-2026-08-23-001 | LAW_ID_PRECOMPUTE_ONLY | The scheduled SEO directory snapshot build loads at most 350,001 already SQL-gated county-assignment rows so it can detect overflow, but publishes no more than 350,000 rows into governed business/trade/location crawl tables. It aborts before replacement when the 350,000-row capacity is exceeded, preserving the last complete snapshot. Replace the bounded in-process build with a paginated or database-native snapshot pipeline before the deadline; this exception grants no exposure, contact, trust, or ranking authority. | TradeScout platform owner | 2026-08-23 | 2026-09-30 | Organic acquisition recovery PR (2026-08-23) | open |
