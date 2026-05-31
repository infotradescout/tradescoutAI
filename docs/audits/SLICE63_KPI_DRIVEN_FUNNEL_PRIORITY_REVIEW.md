# Slice 63 — KPI-Driven Funnel Priority Review

Date: 2026-05-31  
Status: PASS  
Scope: Prioritization decision only (no feature/code behavior changes)

## Inputs
- Baseline source:
  - `docs/audits/SLICE62_KPI_BASELINE_REPORT.md`
- Snapshot window:
  - `2026-05-24T17:53:23.019Z` to `2026-05-31T17:53:23.019Z`

## Baseline Comparison

### First-Use Funnel
- `first_use_guidance_viewed`: 0
- `first_use_launcher_viewed`: 0
- `first_use_option_clicked`: 0
- `first_use_task_prompt_clicked`: 0
- Read: no observed first-use funnel traffic in this window.

### HomeID Funnel
- `homeid_started`: 0
- `homeid_first_detail_added`: 0
- `homeid_component_added`: 0
- `homeid_request_packet_created`: 0
- `homeid_request_packet_ready`: 0
- `homeid_direct_connect_draft_created`: 0
- `homeid_direct_connect_request_submitted`: 0
- Read: no observed HomeID funnel traffic in this window.

### Direct Connect Funnel
- `direct_connect_request_started`: 5
- `direct_connect_homeid_link_selected`: 0
- `direct_connect_homeid_created_from_request`: 0
- `direct_connect_homeid_updated_from_request`: 0
- Read: active request starts, but zero HomeID bridge conversion.

### Scout Funnel
- `scout_homeid_context_viewed`: 0
- `scout_homeid_action_card_clicked`: 0
- Read: no observed Scout HomeID funnel traffic in this window.

## Weakest Drop-Off Identified
Priority funnel drop-off:
- **Direct Connect Request Started -> HomeID Link Selected**
- Observed conversion: `0 / 5 = 0%`

Why this is the best next priority:
1. It is the only funnel with non-zero top-of-funnel activity in the baseline window.
2. Improving this bridge directly compounds HomeID durability and downstream Scout context quality.
3. It is a high-value conversion point without requiring new marketplace/dispatch/payment systems.

## Selected P1 Product Improvement
Selected next improvement:
- **P1: Direct Connect HomeID Link Prompt Clarity + Placement Improvement**

Decision rationale:
- Preserve current behavior and safety boundaries.
- Improve visibility and comprehension of linking a HomeID during request prep.
- Target the observed zero-conversion step before expanding feature surface.

## What This Slice Does Not Do
- No UI/route/schema changes.
- No new product features.
- No lifecycle changes.
- No Scout/HomeID logic expansion.

## Next Execution Target (for implementation slice)
Implementation objective:
- Increase `direct_connect_homeid_link_selected / direct_connect_request_started` from `0%` toward initial threshold (`>=20%` from Slice 62 target set).
