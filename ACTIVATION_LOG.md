# TradeScout Activation Log

Last Updated: 2026-03-19
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
| TS-INIT-001 | 2026-03-19 | Facebook | TODO | TODO | TODO | TODO | TODO | TODO | 0 | 0 | 0 | 0 | 0 | Seed row - replace with first real controlled post run |

## Operating Cadence
- Update after every campaign run.
- Review every 24 hours during active campaigns.
- Feed findings back into:
  - `SIGNAL_TAXONOMY.md` (new/invalid signal patterns)
  - `PATCH_QUEUE.md` (funnel and conversion fixes)
