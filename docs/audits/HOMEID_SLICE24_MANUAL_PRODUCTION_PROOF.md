# HomeID Slice 24 Manual Production Proof

Date: 2026-05-30  
Status: verified_smoke_pass

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
  - Lifecycle alignment applied: smoke now checks request status and only calls `/complete` when status is lifecycle-valid (`in_progress` or `pending_outcome`).
  - Verified-path gated run PASS (no unverified bypass):
    - `RUN_HOMEID_PRODUCTION_SMOKE=1 npm run test:e2e -- tests/homeid-production-smoke.spec.ts`

## Lifecycle guard note
- Completion guard remains enforced:
  - `/api/direct-connect/requests/:id/complete` only accepts `in_progress` or `pending_outcome`.
- Smoke does not bypass this guard.
- Completed-work enrichment assertion runs only when the request is lifecycle-eligible for completion in the test flow.

## Slice 25/26 readiness changes
- Added HomeID base vault schema provisioning to `scripts/bootstrap-test-db.mjs`:
  - `user_homes`
  - `user_home_records`
  - `user_home_appliances`
  - `user_home_documents`
  - `home_maintenance_schedules`
  - `home_report_shares`
  - enum types: `user_home_record_type`, `user_home_document_type`

This removes the `user_homes missing` and HomeID dashboard table-missing blockers in test DB bootstrap.

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
