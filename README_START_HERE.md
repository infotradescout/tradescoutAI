# START HERE - TradeScoutPro

This is the canonical entrypoint for the repo.

If you're deploying: read `PRODUCTION.md` first.
If you're developing: read `docs/CONFIG_AND_DEPLOYMENT.md` first.

## Current status (as of 2026-03-04)

- `npm run verify`: PASS (typecheck + tests + platform-law audits). If `TEST_DATABASE_URL` is set, this runs the strict no-skip DB lane.
- Scout response contract suite: PASS (`SCOUT_QUALITY_REPORT.md` shows 100%).
- Release gates: PASS when executed in a DB-backed lane (`artifacts/release-gate-metrics.json`). If DB-backed lanes are skipped/not executed, shipping is blocked.

Release-gate failures are usually execution lane issues (missing DB-backed E2E prerequisites), not code regressions.

## Quick start (local dev)

```powershell
# Repo root
npm install

# Start the app
npm run dev

# Health check
Invoke-RestMethod "http://localhost:5000/api/health"
# If 5000 is occupied locally, the app will fall back to the next port and print it in the server log.
# Example: http://localhost:5001/api/health
```

## Verification lanes (what to run)

```powershell
# Fast CI-style lane (no DB required)
npm run verify

# Build artifacts (production bundle)
npm run build
```

### DB-backed strict lanes (required for shipping)

These lanes require a dedicated disposable Postgres database. Set `TEST_DATABASE_URL` (recommended via `.env.test`).

```powershell
# Strict unit/integration lane with skip governance
npm run test:run:no-skips

# Full verify with DB enabled (wraps verify)
npm run verify:db

# Release gates (self-contained: bootstraps DB + starts a test server + runs Playwright)
npm run test:release-gates:local

# One-command pre-ship gate (DB verify + release gates)
npm run verify:release
```

Expected artifacts:
- `artifacts/test-skip-delta.no-skips.json`
- `artifacts/test-skip-delta.no-skips.md`
- `artifacts/release-gate-metrics.json`
- `.playwright/test-results/results.json`

## Release gates (why they are red)

The release gates are composed of 4 required lanes:
- `account_creation`
- `verification`
- `direct_connect` (DB-backed)
- `scout_routing` (DB-backed)

If `TEST_DATABASE_URL` is not configured for the E2E run, the DB-backed suites are skipped, and the gate status is `fail`
because "not executed" is treated as a ship blocker.

To fix this locally, run `npm run test:release-gates:local` and re-check `artifacts/release-gate-metrics.json`.

## Where to look next

- Deployment: `PRODUCTION.md`, `PRODUCTION_CHECKLIST.md`
- Local dev + env setup: `docs/CONFIG_AND_DEPLOYMENT.md`
- Release gate definition: `docs/release-gate-metrics.md`
- Skip policy evidence: `TEST_SKIP_BREAKDOWN.md`
- UI consistency audit: run `npm run audit:ui`; generated reports are written to
  `artifacts/ui-surface-audit/` and are intentionally not committed.
- Scout contracts: `SCOUT_QUALITY_REPORT.md`, `docs/SCOUT_CONTRACT.md`
