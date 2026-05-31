# Slice 65 — Direct Connect Home Record Prompt KPI Re-baseline

Date: 2026-05-31  
Status: PASS (measurement + decision slice)  
Scope: KPI visibility and re-baseline only (no Direct Connect redesign)

## Context
- Slice 64 implementation commit: `b2296620`
- Baseline issue from Slice 63:
  - `direct_connect_request_started -> direct_connect_homeid_link_selected = 0%`

## KPI Audit Visibility Check
Verified in code/contracts:
- Product KPI event family includes all Slice 64 prompt-conversion events:
  - `direct_connect_home_record_prompt_viewed`
  - `direct_connect_home_record_link_selected`
  - `direct_connect_home_record_create_selected`
  - `direct_connect_home_record_skipped`
  - `direct_connect_request_submitted_after_home_record_skip`
- Existing bridge event remains included:
  - `direct_connect_homeid_link_selected`

Visibility artifacts:
- Route/event allowlist:
  - `server/routes/analytics-routes.ts`
- Audit route contract:
  - `server/tests/product-kpi-audit-route.contract.test.ts`
- Delivery contract:
  - `server/tests/core-product-kpi-event-delivery.contract.test.ts`

## Re-baseline Snapshot
Latest available live baseline snapshot (pre-Slice 64 traffic window):
- Source: `docs/audits/SLICE62_KPI_BASELINE_REPORT.md`
- Window: `2026-05-24T17:53:23.019Z` -> `2026-05-31T17:53:23.019Z`

Counts (required fields):
- `direct_connect_request_started`: `5`
- `direct_connect_home_record_prompt_viewed`: `0`
- `direct_connect_home_record_link_selected`: `0`
- `direct_connect_home_record_create_selected`: `0`
- `direct_connect_home_record_skipped`: `0`
- `direct_connect_request_submitted_after_home_record_skip`: `0`
- `direct_connect_homeid_link_selected`: `0`

Rates:
- prompt view rate:
  - `direct_connect_home_record_prompt_viewed / direct_connect_request_started`
  - `0 / 5 = 0%` (pre-Slice 64 traffic window)
- link/select rate from prompt viewed:
  - `direct_connect_home_record_link_selected / direct_connect_home_record_prompt_viewed`
  - `0 / 0 = N/A (no prompt views recorded in this window)`
- create rate from prompt viewed:
  - `direct_connect_home_record_create_selected / direct_connect_home_record_prompt_viewed`
  - `0 / 0 = N/A`
- skip rate from prompt viewed:
  - `direct_connect_home_record_skipped / direct_connect_home_record_prompt_viewed`
  - `0 / 0 = N/A`
- submit-after-skip rate from skipped:
  - `direct_connect_request_submitted_after_home_record_skip / direct_connect_home_record_skipped`
  - `0 / 0 = N/A`
- request abandonment after prompt:
  - Not inferable from this window because no prompt-view events are present.

## Delivery-Proof Fixture Result
Contract fixture confirms all new events are deliverable through `/api/analytics/shell`:
- `direct_connect_home_record_prompt_viewed`
- `direct_connect_home_record_link_selected`
- `direct_connect_home_record_create_selected`
- `direct_connect_home_record_skipped`
- `direct_connect_request_submitted_after_home_record_skip`

Result: event visibility path is confirmed; live movement remains traffic-dependent.

## Decision Rules Applied
1. Prompt viewed low vs request started:
   - **Current read**: true in latest recorded window (0 vs 5), but this is a pre-Slice 64 traffic window.
2. Link/create low despite healthy prompt view:
   - Not yet measurable (no prompt views recorded in available window).
3. High skip with high submit-after-skip:
   - Not yet measurable.
4. Prompt causing submission drop:
   - Not inferable yet.
5. Link/create improves without submit loss:
   - Pending traffic.

## Next Recommended P1
**P1: Slice 66 — Direct Connect Home Record Prompt Render Coverage + Live KPI Refresh**

Why:
- Slice 64 changed the UX and event model, but available production counts are still pre-change.
- Next step is not redesign; it is post-deploy KPI refresh + live verification that prompt-view events are flowing in current traffic windows.

Execution focus for next slice:
- Pull a fresh 7-day + 24-hour KPI snapshot from `/api/analytics/product-kpi/summary`.
- Confirm non-zero `direct_connect_home_record_prompt_viewed` when Direct Connect requests start.
- Only if prompt-view remains zero in current traffic should placement/render reliability work begin.
