# HomeID Slice 24 Manual Production Proof

Date: 2026-05-29  
Status: partial_pass_with_baseline_blocker

## Scope lock
- No new product feature scope added.
- Slice 24 target is manual/browser production proof only for:
  - HomeID -> Direct Connect -> HomeID enrichment
  - Scout HomeID context/suggestion/action visibility

## Browser smoke artifact
- Added gated Playwright smoke:
  - `tests/homeid-production-smoke.spec.ts`
- Run gate:
  - Requires `TEST_DATABASE_URL`
  - Requires `RUN_HOMEID_PRODUCTION_SMOKE=1`

## Attempted run result (this environment)
- Command:
  - `npm run test:e2e -- tests/homeid-production-smoke.spec.ts`
- Result:
  - Blocked by baseline test DB schema mismatch.
  - Error observed: `relation "user_homes" does not exist`

## Baseline blocker classification
- Type: temporary_exception
- Owner: platform/database migration owner
- Rationale: HomeID browser smoke depends on `user_homes`-backed HomeID routes.
- Removal target: 2026-06-05

## Unblocked execution path
1. Bootstrap test DB with latest schema/migrations including `user_homes`.
2. Run:
   - `RUN_HOMEID_PRODUCTION_SMOKE=1 npm run test:e2e -- tests/homeid-production-smoke.spec.ts`
3. Record PASS/FAIL and attach trace/screenshot artifacts from `.playwright/test-results`.

## Intended 12-step proof in the smoke
1. Start/create HomeID.
2. Add property detail.
3. Add component.
4. Add evidence metadata.
5. Create request packet.
6. Reach ready state.
7. Generate handoff preview packet.
8. Create Direct Connect draft.
9. Review/submit draft.
10. Confirm HomeID backlink/enrichment visibility.
11. Open Scout.
12. Confirm HomeID context + suggestions + action cards (signals when thresholded data exists).
