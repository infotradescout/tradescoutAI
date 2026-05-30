# Slice 39 — Post-Closeout Production Watch

Date: 2026-05-30
Owner: TradeScout core team
Window: 24 hours after release-candidate lock

## KPI
Release Candidate Locked -> 24h Production Stability PASS

## Scope
Track only:
- auth/session failures
- HomeID route errors
- Direct Connect request errors
- Scout route errors
- first-use guidance rendering issues
- startup fallback visibility
- 500/timeout spikes

No new feature work during this watch window.

## Baseline
- Closeout commit: `4c944237`
- Closeout artifact: `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`

## Monitored Routes
- `GET /api/auth/user`
- `POST /api/auth/login`
- `GET /api/homes/:homeId/homeid-dashboard`
- `POST /api/homeid/create`
- `POST /api/homes/:homeId/homeid/request-packet`
- `POST /api/direct-connect/requests`
- `POST /api/direct-connect/requests/:id/submit`
- `GET /scout`
- `GET /direct-connect`
- `GET /homes`
- `GET /`

## Alert Criteria (Watch Window)
1. Auth/session:
- Fail if repeated unexpected auth failures block valid users.
- Fail if refresh/session persistence regresses for customer, linked_food_truck, or super_admin paths.

2. Route health:
- Fail if any core route returns sustained 500s.
- Fail if timeout behavior appears on HomeID dashboard or Direct Connect core paths.

3. UI startup:
- Fail if app shell does not mount on `/`, `/homes`, `/direct-connect`, or `/scout`.
- Fail if startup fallback is visibly rendered to users.

4. First-use guidance:
- Fail if guidance components crash route rendering.
- Fail if launcher path routing regresses.

5. Error spikes:
- Fail if 500/timeout frequency shows sustained spike versus normal baseline.

## Check Cadence
- T+0h (immediate post-lock)
- T+1h
- T+4h
- T+8h
- T+24h

At each checkpoint capture:
- route health status
- auth/session status
- known incidents (if any)
- blocker classification: `none`, `degraded`, `blocking`

## PASS Criteria (24h)
- No blocking incidents in tracked scope.
- No sustained 500/timeout spikes on tracked routes.
- Auth/session persistence remains stable for key roles.
- Startup fallback remains hidden on core routes.
- First-use guidance remains render-safe.

## FAIL Criteria
- Any blocking incident unresolved at T+24h.
- Session persistence regression in production.
- Core route startup or rendering regression.

## Output
At T+24h, append one of:
- `24h Production Stability: PASS`
- `24h Production Stability: FAIL` (with incident list and fix owners)

Update file:
- `docs/audits/TRADESCOUT_PRODUCTION_READINESS_CLOSEOUT.md`
