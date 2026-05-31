# Slice 66 — Direct Connect Home Record Prompt Render Coverage + Live KPI Refresh

Date: 2026-05-31  
Status: PASS (render coverage + KPI refresh audit)  
Scope: verification only (no UX redesign)

## Commits
- Slice 64 commit: `b2296620`
- Slice 65 commit: `a84a5c0d`
- Current commit at audit start: `a84a5c0d`

## Render Coverage Verification
Source inspected:
- `client/src/pages/direct-connect/DirectConnectShell.tsx`

Coverage result: **PASS**

Verified states:
1. Prompt renders in normal request prep flow:
   - `Home record (optional)` module is in the request form block before review/final submit controls.
2. Existing-home-record state:
   - `hasExistingHomes` computed from `homes` query.
   - saved-home selector defaults to `"Select a saved home"` and auto-switches intent to `link_existing`.
3. No-home-record state:
   - selector displays `"No saved homes yet"`.
   - create CTA option remains available (`"Create a home record"`).
4. Skip path visible:
   - option `"Continue without a home record"` is present.
   - explicit non-blocking copy remains: `"You can skip this for now. Your request will still be created."`
5. Skip path non-blocking:
   - `handleSkipAndAutoRoute` submits via `createMutation.mutate(...)` with `autoRoute: true`.

## Event Delivery Verification
Status: **PASS**

Verified event wiring in UI logic:
- `direct_connect_home_record_prompt_viewed` on prompt render path (`useEffect` with once-ref guard)
- `direct_connect_home_record_link_selected` on link/select interactions
- `direct_connect_home_record_create_selected` on create selection
- `direct_connect_home_record_skipped` on skip interactions
- `direct_connect_request_submitted_after_home_record_skip` on submit-after-skip path
- existing `direct_connect_homeid_link_selected` still emitted on submit bridge

Verified event visibility in KPI audit allowlist:
- `server/routes/analytics-routes.ts` includes all above event types.

## Required Test Coverage (Slice 66)
Updated/verified:
- `server/tests/direct-connect-home-record-link-prompt.contract.test.ts`
  - prompt renders in request prep
  - existing-home and no-home render branches
  - skip path visible + non-blocking submission hook
  - prompt/event wiring checks
- `server/tests/core-product-kpi-event-delivery.contract.test.ts`
  - delivery for prompt/link/create/skip/submitted-after-skip events
- `server/tests/product-kpi-audit-route.contract.test.ts`
  - KPI route event allowlist includes Slice 64 event family

## Live KPI Refresh Read
Live build header check:
- `/api/health`: `200`
- `x-tradescout-build`: `a84a5c0d0945f035ea7304dedb0b00d2af958c75`

Product KPI endpoint check (unauthenticated/non-staff context):
- `GET /api/analytics/product-kpi/summary`: `403` (staff-gated as expected)

Latest available numeric KPI snapshot:
- Source: `docs/audits/SLICE62_KPI_BASELINE_REPORT.md`
- Window: `2026-05-24T17:53:23.019Z` -> `2026-05-31T17:53:23.019Z`

Counts:
- `direct_connect_request_started`: `5`
- `direct_connect_home_record_prompt_viewed`: `0`
- `direct_connect_home_record_link_selected`: `0`
- `direct_connect_home_record_create_selected`: `0`
- `direct_connect_home_record_skipped`: `0`
- `direct_connect_request_submitted_after_home_record_skip`: `0`
- `direct_connect_homeid_link_selected`: `0`

Rates:
- prompt view rate: `0 / 5 = 0%` (pre-Slice-64 traffic window)
- link rate from prompt viewed: `N/A (0/0)`
- create rate from prompt viewed: `N/A (0/0)`
- skip rate from prompt viewed: `N/A (0/0)`
- submit-after-skip rate from skipped: `N/A (0/0)`
- request abandonment after prompt: not inferable (no prompt views in available numeric window)

## Data Sufficiency for Product Decision
Result: **not yet sufficient for conversion-direction decisions**.

Reason:
- render coverage and event wiring are now verified.
- latest numeric counts are pre-Slice-64 traffic.
- fresh staff-authenticated KPI pull is still required to evaluate post-Slice-64 conversion behavior.

## Decision Rules Outcome
1. Prompt render coverage fails?  
   - No. Coverage passed.
2. Prompt renders but prompt_viewed still zero after fresh live usage?  
   - Pending fresh staff-authenticated KPI window.
3. Prompt_viewed exists but link/create/skip all zero?  
   - Pending fresh data.
4. Skip high + submit-after-skip high?  
   - Pending fresh data; keep skip path.
5. Prompt interaction lowers submission?  
   - Pending fresh data.
6. Link/create improves without submit loss?  
   - Pending fresh data.

## Next Recommended P1
**Slice 67 — Staff-Authenticated Live KPI Pull + Funnel Decision**

Why:
- No redesign should occur until post-Slice-64 counts are visible.
- Next step is a fresh staff-authenticated `/api/analytics/product-kpi/summary` read and funnel decision using real post-change traffic.
