# TradeScout Signal Taxonomy (Locked Operating Reference)

Last Updated: 2026-03-20
Owner: Signal Governance
Status: Locked Core + Expandable Leaves

## Purpose
Define which signals matter, which are missing, and how signals map to real actions.
If a signal cannot be mapped to flow completion, it is diagnostic only.

## Core Signal Families (Exist)
1. Discovery Signals
- User entered via landing, scout entry, profile/auth entry, or direct campaign route.
- Source context: campaign tag, channel, county target.

2. Intent Signals
- Structured user intent captured (need type, county, urgency, role context).
- Entry state captured before contact eligibility.

3. Gating Signals
- Decision Card viewed.
- Decision Card completed/accepted.
- Contact unlocked only after gating completion.

4. Trust/CVS Signals
- Exposure level assigned by trust logic.
- Verification state transitions captured.

5. Completion Signals
- Action completed by user.
- Real connection event recorded.

## Missing or Under-Specified Signals
- Campaign source-to-action lineage in one canonical log format.
- Segment tags (geography/category/intent level) normalized across acquisition paths.
- Explicit drop-off reason taxonomy at each gate transition.
- County attribution on pre-auth funnel events (`demand.landing_view`, `demand.cta_click`) is often absent.
- UTM/source attribution is mostly null (`utmSource = none`, `campaignKey = default__organic__noref` in current 7-day baseline).
- New-signup action telemetry mapping is incomplete (new signups reached setup completion, but 0 mapped `user_completed_actions`).

## Signals That Matter (Primary)
- `traffic_to_action_rate`
- `action_to_completion_rate`
- `completion_to_real_connection_rate`

## Signals That Do Not Define Success (Secondary/Diagnostic)
- Impressions
- Raw reach
- Reactions/comments without flow progression

## Minimum Event Fields (Per Actionable Signal)
- `timestamp`
- `campaign_id`
- `source_channel`
- `source_segment`
- `county`
- `funnel_path` (`AWARENESS_LANDING`, `PROBLEM_SCOUT`, `CONTRACTOR_AUTH`)
- `signal_family`
- `event_name`
- `user_role` (`homeowner`, `contractor`, `mixed`, `unknown`)
- `result_stage` (`click`, `signup`, `action`, `completion`, `real_connection`)

## Field Additions Required (Immediate)
- `county_fips` on all pre-auth funnel events where determinable.
- `attribution.utm_source`, `attribution.utm_campaign`, `attribution.utm_medium` (non-null policy if provided).
- `segment_category` (`homeowner`, `contractor`, `mixed`).
- `segment_intent_level` (`passive`, `problem_aware`, `actively_looking`).
- `dropoff_reason_code` for abandonment points in auth/setup/action flows.

## Current Baseline Notes (7-day window ending 2026-03-20 UTC)
- Funnel signal volume:
  - `demand.landing_view = 102`
  - `demand.cta_click = 25`
  - `demand.create_success = 4`
  - `demand.setup_complete (new-signup cohort) = 3`
- Action signal mismatch:
  - `user_completed_actions (new-signup cohort) = 0`
- County/action concentration:
  - Highest action concentration in `county_fips = 22105`.
  - Highest new-signup concentration in `county_fips = 12033` (with some null county records).
