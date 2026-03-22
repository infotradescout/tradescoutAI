# TradeScout Activation Log

Last Updated: 2026-03-20
Owner: Growth Execution
Status: Mandatory for Every Campaign

## Logging Rule
If results are not logged here, the campaign is treated as failed.

## Required Fields
- Campaign ID
- Date (YYYY-MM-DD)
- Source Platform (for example Facebook)
- Source Asset (group/page/profile)
- Segment (geography + category + intent level)
- Message Type (`PROBLEM_TRIGGER`, `PROOF`, `SYSTEM_EXPLANATION`, `CTA`)
- Funnel Path (`AWARENESS_LANDING`, `PROBLEM_SCOUT`, `CONTRACTOR_AUTH`)
- Destination URL/Entry
- County Target
- Clicks
- Signups
- Actions
- Completions
- Real Connections
- Notes (drop-off hypothesis, observed friction)

## KPI Formulas
- `traffic_to_action_rate = actions / clicks`
- `action_to_completion_rate = completions / actions`
- `completion_to_real_connection_rate = real_connections / completions`

## Campaign Entries
| Campaign ID | Date | Source Platform | Source Asset | Segment | Message Type | Funnel Path | Destination | County | Clicks | Signups | Actions | Completions | Real Connections | Notes |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| TS-BASE-7D-001 | 2026-03-20 | Web Organic (observed) | `default__organic__noref` | Mixed geography, homeowner/contractor mixed, intent mixed | CTA | AWARENESS_LANDING | `/landing` -> `/pre-scout-setup?mode=create` | Primary known county in new signups: `12033` | 25 | 4 | 0 | 3 | 0 | Real 7-day DB baseline from `events`, `user_completed_actions`, and `contact_permission_events`. Drop-offs: click->signup is high; new-signup->action is zero. |
| TS-BASE-7D-002 | 2026-03-20 | Product Internal (authenticated users) | Scout runtime | Existing user cohort, high-intent mixed | SYSTEM_EXPLANATION | PROBLEM_SCOUT | `/scout` | Top active county: `22105` | 21 | 0 | 18 | 21 | 1 | `scout_interactions` all completed in window; `user_completed_actions` concentrated in `22105`; one gated contact acceptance event recorded. |

## Baseline Snapshot (7-day window ending 2026-03-20 UTC)
- `demand.landing_view`: 102
- `demand.cta_click`: 25
- `demand.create_success`: 4
- `demand.setup_complete` (new signup users only): 3
- `user_completed_actions` (new signup users only): 0
- `contact_permission_events` accepted (new signup users only): 0

## Computed Rates (TS-BASE-7D-001)
- `traffic_to_action_rate`: `0 / 25 = 0.00%`
- `action_to_completion_rate`: `N/A` (actions for new-signup cohort are zero; fix instrumentation before decision use)
- `completion_to_real_connection_rate`: `0 / 3 = 0.00%`

## Operating Cadence
- Update after every campaign run.
- Review every 24 hours during active campaigns.
- Feed findings back into:
  - `SIGNAL_TAXONOMY.md` (new/invalid signal patterns)
  - `PATCH_QUEUE.md` (funnel and conversion fixes)
