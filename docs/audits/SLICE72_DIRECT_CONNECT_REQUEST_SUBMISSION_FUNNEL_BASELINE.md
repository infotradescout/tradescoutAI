# Slice 72 — Direct Connect Request Submission Funnel Baseline

Date: 2026-06-01  
Status: PARTIAL PASS (instrumentation + KPI visibility landed; fresh production funnel counts pending)

## Goal
Establish measurable Direct Connect funnel visibility from request start to contractor-side action.

Funnel:
1. `direct_connect_request_started`
2. `direct_connect_request_review_opened`
3. `direct_connect_request_submitted`
4. `direct_connect_request_visible_to_contractors`
5. `direct_connect_contractor_action_started`

## Production Context
- Latest confirmed production build header from Slice 70/71 evidence: `1808df640b506584733185b645fa62131a2e9642`
- Latest confirmed KPI evidence window: `2026-05-25T16:06:41.185Z` to `2026-06-01T16:06:41.185Z`
- Existing confirmed counts in that window:
  - `direct_connect_request_started`: `5`
  - `direct_connect_home_record_prompt_viewed`: `5`

## Event Coverage Audit
- Already emitted before this slice:
  - `direct_connect_request_started`
  - `direct_connect_request_submitted`
- Added in this slice:
  - `direct_connect_request_review_opened` (client, request review-open transition)
  - `direct_connect_request_visible_to_contractors` (server, when assignments make request visible to provider pool)
  - `direct_connect_contractor_action_started` (server, when provider submits assignment response)

## KPI Route Coverage
Updated allowlist in `server/routes/analytics-routes.ts` for:
- `direct_connect_request_review_opened`
- `direct_connect_request_submitted`
- `direct_connect_request_visible_to_contractors`
- `direct_connect_contractor_action_started`

## Tests
- Updated contract assertions in:
  - `server/tests/product-kpi-audit-route.contract.test.ts`

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS

## Measured Funnel Summary
Current status:
- Instrumentation coverage: complete for the target funnel events.
- Fresh live funnel conversion counts for new events: pending next staff-authenticated production pull.

Computable rates:
- Not yet computable for Slice 72 events until post-deploy event traffic is collected.

## Gaps / Risks
1. Fresh production measurements are still needed for the newly added events.
2. `contractor_action_started` currently reflects assignment response submission (accept/decline path), which is the best available contractor-side action proxy.

## Decision
Event coverage is now complete enough to baseline the submission funnel in production.  
Slice 72 remains partially complete until post-deploy KPI counts are captured.

## Next Recommended P1
After deployment and KPI pull:
1. If `request_started > 0` and `request_review_opened = 0`: recover review-step emission path.
2. If `review_opened > 0` and `request_submitted` is low: reduce review/submit friction.
3. If `request_submitted > 0` and `request_visible_to_contractors = 0`: repair publication/routing visibility path.
4. If `request_visible_to_contractors > 0` and `contractor_action_started = 0`: repair contractor engagement path.
