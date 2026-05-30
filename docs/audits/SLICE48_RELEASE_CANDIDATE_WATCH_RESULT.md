# Slice 48 — Release Candidate Watch Result

## Decision
- Result: **FAIL**
- Reason: first-use guidance live UI regression on `/landing` (desktop + mobile smoke)
- Baseline runbook: `docs/audits/SLICE47_RELEASE_CANDIDATE_DEPLOYMENT_WATCH.md`
- Observed build header: `2886561850e274caf0e0d6b204f585d5f84264a5`
- Watch date (America/Chicago): 2026-05-30

## Checkpoint Results

### Build Header
- Check: `x-tradescout-build`
- Result: PASS
- Evidence: `2886561850e274caf0e0d6b204f585d5f84264a5` returned from live endpoints

### Health Check
- Check: `GET https://www.thetradescout.com/api/health`
- Result: PASS
- Status: `200 OK`

### Core Route Render Checks
- `/` -> PASS (`200`)
- `/homes` -> PASS (`200`)
- `/direct-connect` -> PASS (`200`)
- `/scout` -> PASS (`200`)

### Startup Fallback Visibility
- Spec: `tests/live-app-startup-fallback.spec.ts`
- Env: `RUN_LIVE_STARTUP_FALLBACK_SMOKE=1`
- Result: PASS

### HomeID Verified Smoke
- Spec: `tests/homeid-production-smoke.spec.ts`
- Env: `RUN_HOMEID_PRODUCTION_SMOKE=1`
- Result: PASS

### First-Use Guidance Live UI Smoke
- Spec: `tests/first-use-guidance-live-ui.spec.ts`
- Env: `RUN_LIVE_GUIDANCE_UI_SMOKE=1`
- Result: **FAIL**
- Failure: `Where should I start?` not visible on `/landing`

### Mobile First-Use Smoke
- Spec: `tests/mobile-first-use-smoke.spec.ts`
- Env: `RUN_MOBILE_FIRST_USE_SMOKE=1`
- Result: **FAIL**
- Failure: `Where should I start?` not visible on `/landing`

### Session Persistence
- Status: PASS (carried from locked production closeout evidence)
- Source: `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`

## Blocking Issue
- Surface: first-use guidance rendering on `/landing`
- Severity: P1 release blocker under Slice 47 alert thresholds
- Expected: launcher and six choices visible on `/landing`
- Actual: launcher text not found in live UI for both desktop and mobile smoke

## Recommended Next Slice
- Slice 49 — First-Use Guidance Live Regression Repair
- Goal: restore live launcher visibility and pass both first-use live UI smoke specs

## Commands Run
```bash
curl -s -D - https://www.thetradescout.com/api/health -o NUL
curl -s -D - https://www.thetradescout.com/ -o NUL
curl -s -D - https://www.thetradescout.com/homes -o NUL
curl -s -D - https://www.thetradescout.com/direct-connect -o NUL
curl -s -D - https://www.thetradescout.com/scout -o NUL

npx cross-env NODE_ENV=test BASE_URL=https://www.thetradescout.com E2E_BASE_URL=https://www.thetradescout.com RUN_LIVE_STARTUP_FALLBACK_SMOKE=1 RUN_LIVE_GUIDANCE_UI_SMOKE=1 RUN_MOBILE_FIRST_USE_SMOKE=1 RUN_HOMEID_PRODUCTION_SMOKE=1 playwright test tests/live-app-startup-fallback.spec.ts tests/first-use-guidance-live-ui.spec.ts tests/mobile-first-use-smoke.spec.ts tests/homeid-production-smoke.spec.ts
```
