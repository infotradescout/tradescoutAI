# Slice 75A — Staff Production KPI Smoke Runner

Date: 2026-06-01  
Status: PASS

## Goal
Remove repeated manual browser-console copy/paste for staff-gated production KPI checks by providing a local, repeatable smoke runner.

## Root Cause
Production KPI verification depended on a manual loop (open browser, run script, paste output), which slowed every Direct Connect validation cycle and made recurring checks costly.

## Fix Summary
1. Added `scripts/tradescout-staff-kpi-smoke.ts`.
2. Added `npm run smoke:staff-kpi` script entry.
3. Script behavior:
   - reads `TRADESCOUT_PRODUCTION_ORIGIN` (default `https://www.thetradescout.com`)
   - requires `TRADESCOUT_STAFF_COOKIE`
   - checks `/api/health` and prints status + `x-tradescout-build`
   - checks `/api/analytics/product-kpi/summary` with staff cookie
   - prints Direct Connect KPI counts and conversion rates
   - writes local artifact:
     - `artifacts/tradescout-staff-kpi-smoke-latest.json`
4. Security safeguards:
   - never logs cookie
   - never persists cookie
   - exits with clear message when cookie is missing
   - returns explicit message on staff auth failure (`403`)

## Validation
- `npm run smoke:staff-kpi` (missing cookie path) PASS: exits with required safety message.
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Operator Usage
1. Copy staff session cookie locally (do not store in repo).
2. Run:
   - `set TRADESCOUT_STAFF_COOKIE=<cookie value>` (Windows shell local session)
   - `npm run smoke:staff-kpi`
3. Read output and use `artifacts/tradescout-staff-kpi-smoke-latest.json` for audit docs.
