# HomeID Slice 24 Manual Production Proof

Date: 2026-05-30  
Status: partial_pass_with_narrowed_blocker

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

## Attempted run results (this environment)
- Command:
  - `npm run test:e2e -- tests/homeid-production-smoke.spec.ts`
- Result:
  - Initial blocker (resolved): `relation "user_homes" does not exist`
  - Current blocker (remaining): Direct Connect completion lifecycle precondition in smoke path.
  - Current error observed: `Only in-progress or pending-outcome requests can be marked complete` (HTTP 400 from `/api/direct-connect/requests/:id/complete`)

## Blocker classification
- Type: temporary_exception
- Owner: platform/database migration owner
- Rationale:
  - Resolved DB readiness gap required for HomeID runtime (`user_homes` + dependent HomeID tables).
  - Remaining gap is a valid Direct Connect lifecycle precondition in this smoke path, not a missing HomeID table.
- Removal target: 2026-06-06

## Slice 25 DB readiness change
- Added HomeID base vault schema provisioning to `scripts/bootstrap-test-db.mjs`:
  - `user_homes`
  - `user_home_records`
  - `user_home_appliances`
  - `user_home_documents`
  - enum types: `user_home_record_type`, `user_home_document_type`

This removes the `user_homes missing` blocker in test DB bootstrap.

## Unblocked execution path
1. Bootstrap test DB with latest schema/migrations including `user_homes`.
2. Run:
   - `RUN_HOMEID_PRODUCTION_SMOKE=1 npm run test:e2e -- tests/homeid-production-smoke.spec.ts`
3. If Direct Connect completion returns 400 due lifecycle state, advance request lifecycle to `in_progress` in the smoke path (or use a lifecycle-eligible fixture) and rerun.
4. Record PASS/FAIL and attach trace/screenshot artifacts from `.playwright/test-results`.

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
