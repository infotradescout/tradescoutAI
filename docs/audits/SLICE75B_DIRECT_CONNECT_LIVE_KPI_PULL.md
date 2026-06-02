# Slice 75B - Direct Connect Live KPI Pull

Date: 2026-06-01
Status: DEFERRED (staff-authenticated production KPI pull not yet successful)

## Decision
Slice 75B remains deferred. Production is live on the expected launch-gate chain, but staff-authenticated KPI API access from the local smoke runner still returns `401 Authentication required`.

## Production Evidence Captured
- Health status: `200`
- Build header: `691c0f1f9a78bff91ced1722aef1ef9e9ec125a4`
- KPI status: `401`
- KPI URL used: `https://www.thetradescout.com/api/analytics/product-kpi/summary`

Observed response:
- `{"message":"Authentication required"}`

## What This Proves
1. Deployment is live and reachable (`/api/health` PASS).
2. KPI endpoint is still properly staff-gated (no auth bypass introduced).
3. Remaining blocker is session/cookie auth material alignment for local staff smoke runner execution, not application runtime logic.

## Runner Hardening Applied
Updated `scripts/tradescout-staff-kpi-smoke.ts` to reduce false-positive outcomes:
1. Tries both KPI candidates:
   - `/api/analytics/product-kpi/summary`
   - `/direct-connect/api/analytics/product-kpi/summary`
2. Logs `KPI URL used`.
3. Rejects non-JSON HTML app-shell responses as invalid KPI API success.
4. Normalizes copied cookie text (prefix/whitespace/smart-quote cleanup) without logging secret material.

## Remaining Gate To Close Slice 75B
Run local staff-auth smoke with valid current session cookie and obtain:
- KPI status: `200`
- Measurement window
- Direct Connect funnel counts
- Computed rates
- Artifact output:
  - `artifacts/tradescout-staff-kpi-smoke-latest.json`

Until then, Slice 75B is intentionally deferred and must not be marked PASS.
