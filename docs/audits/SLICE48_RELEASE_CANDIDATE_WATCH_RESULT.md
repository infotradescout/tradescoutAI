# Slice 48 — Release Candidate Watch Result

## Decision
- Initial Result (2026-05-30): **FAIL**
- Current Result (2026-05-31): **PASS (recovered)**
- Recovery Reason: first-use guidance launcher now renders on `/landing`; both live first-use specs pass
- Baseline runbook: `docs/audits/SLICE47_RELEASE_CANDIDATE_DEPLOYMENT_WATCH.md`
- Observed build header (initial fail): `2886561850e274caf0e0d6b204f585d5f84264a5`
- Observed build header (recovery pass): `139c11900ec432da26d6538c70368eab1a460b9b`
- Watch dates (America/Chicago): 2026-05-30 to 2026-05-31

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
- Initial Result: **FAIL**
- Recovery Result: **PASS** (2026-05-31)

### Mobile First-Use Smoke
- Spec: `tests/mobile-first-use-smoke.spec.ts`
- Env: `RUN_MOBILE_FIRST_USE_SMOKE=1`
- Initial Result: **FAIL**
- Recovery Result: **PASS** (2026-05-31)

### Session Persistence
- Status: PASS (carried from locked production closeout evidence)
- Source: `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`

## Blocking Issue
- Initial blocker (2026-05-30): first-use guidance rendering on `/landing` (P1)
- Current status (2026-05-31): **resolved**

## Recovery Outcome
- Slice 49 / Slice 50 recovery path validated live on build `139c1190`.
- `/landing` launcher visible with required six choices.
- Desktop and mobile live first-use specs both pass.
- Slice 48 watch failure is closed.

## Commands Run
```bash
curl -s -D - https://www.thetradescout.com/api/health -o NUL
curl -s -D - https://www.thetradescout.com/ -o NUL
curl -s -D - https://www.thetradescout.com/homes -o NUL
curl -s -D - https://www.thetradescout.com/direct-connect -o NUL
curl -s -D - https://www.thetradescout.com/scout -o NUL

npx cross-env NODE_ENV=test BASE_URL=https://www.thetradescout.com E2E_BASE_URL=https://www.thetradescout.com RUN_LIVE_STARTUP_FALLBACK_SMOKE=1 RUN_LIVE_GUIDANCE_UI_SMOKE=1 RUN_MOBILE_FIRST_USE_SMOKE=1 RUN_HOMEID_PRODUCTION_SMOKE=1 playwright test tests/live-app-startup-fallback.spec.ts tests/first-use-guidance-live-ui.spec.ts tests/mobile-first-use-smoke.spec.ts tests/homeid-production-smoke.spec.ts
```
