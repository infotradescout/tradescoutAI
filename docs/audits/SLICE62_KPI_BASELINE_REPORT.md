# Slice 62 — KPI Baseline Report

Date: 2026-05-31  
Status: PASS (baseline recorded)  
Scope: KPI baseline snapshot only (no product behavior changes)

## Source
- Endpoint: `GET /api/analytics/product-kpi/summary`
- Access mode: authenticated super-admin
- Live status: `200`
- Snapshot window:
  - from: `2026-05-24T17:53:23.019Z`
  - to: `2026-05-31T17:53:23.019Z`

## Raw Baseline Counts
- totalEvents: `5`
- first_use_guidance_viewed: `0`
- first_use_launcher_viewed: `0`
- first_use_option_clicked: `0`
- first_use_task_prompt_clicked: `0`
- homeid_started: `0`
- homeid_first_detail_added: `0`
- homeid_component_added: `0`
- homeid_evidence_added: `0`
- homeid_request_packet_created: `0`
- homeid_request_packet_ready: `0`
- homeid_direct_connect_draft_created: `0`
- homeid_direct_connect_request_submitted: `0`
- direct_connect_request_started: `5`
- direct_connect_homeid_link_selected: `0`
- direct_connect_homeid_created_from_request: `0`
- direct_connect_homeid_updated_from_request: `0`
- scout_homeid_context_viewed: `0`
- scout_homeid_action_card_clicked: `0`

## Baseline Breakdowns
- bySurface:
  - unknown: `5`
- byUserState:
  - unknown: `5`
- byOptionId: none
- byTargetRoute: none
- byComponentType: none
- byActionCardType: none

## Funnel Baseline

### First-Use Funnel
- guidance_viewed -> launcher_viewed -> option_clicked -> task_prompt_clicked
- Baseline: `0 -> 0 -> 0 -> 0`
- Current read: no first-use funnel activity captured in the sampled window.

### HomeID Funnel
- homeid_started -> first_detail_added -> component_added -> request_packet_created -> request_packet_ready -> draft_created -> request_submitted
- Baseline: `0 -> 0 -> 0 -> 0 -> 0 -> 0 -> 0`
- Current read: no HomeID funnel activity captured in the sampled window.

### Direct Connect Funnel
- direct_connect_request_started -> direct_connect_homeid_link_selected -> direct_connect_homeid_created_from_request / updated_from_request
- Baseline: `5 -> 0 -> 0 / 0`
- Current read: request starts are occurring; HomeID bridge attachment/update events are not yet showing in this window.

### Scout Funnel
- scout_homeid_context_viewed -> scout_homeid_action_card_clicked
- Baseline: `0 -> 0`
- Current read: no Scout funnel activity captured in the sampled window.

## What “Good” Means Next (Operational Targets)
- First-use:
  - `first_use_launcher_viewed > 0` each 7-day window.
  - `first_use_option_clicked / first_use_launcher_viewed >= 25%`.
- HomeID:
  - `homeid_started > 0` each 7-day window.
  - `homeid_first_detail_added / homeid_started >= 40%`.
- Direct Connect bridge:
  - `direct_connect_homeid_link_selected / direct_connect_request_started >= 20%`.
  - `direct_connect_homeid_created_from_request + updated_from_request > 0`.
- Scout:
  - `scout_homeid_context_viewed > 0` each 7-day window.
  - `scout_homeid_action_card_clicked / scout_homeid_context_viewed >= 15%`.
- Data quality:
  - Reduce `bySurface.unknown` and `byUserState.unknown` to < 20% of events.

## Notes
- This is the first baseline snapshot after Slice 61 live KPI verification PASS.
- No feature or routing changes are included in Slice 62.
