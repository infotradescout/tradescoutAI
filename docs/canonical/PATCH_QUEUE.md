# TradeScout Patch Queue (Ordered)

Last Updated: 2026-03-20
Owner: Execution Layer
Status: Active

## Queue Rules
- Ordered top-to-bottom by execution sequence.
- Each item must include: problem, impact, dependency, status.
- One session should target one outcome.
- If an item spans multiple systems, split it before execution.

## Queue
1. Problem: `demand.landing_view` to `demand.cta_click` drop-off is 102 -> 25 in the last 7 days.
Impact: 75%+ of landing traffic never enters the funnel.
Dependency: None (can run immediately on landing + CTA surfaces).
Status: In progress

2. Problem: `demand.cta_click` to `demand.create_success` drop-off is 25 -> 4 in the last 7 days.
Impact: High leak at auth/create step blocks real user growth despite active traffic.
Dependency: Item 1 (for cleaner attribution) and pre-scout auth instrumentation hardening.
Status: In progress

3. Problem: New-signup cohort has 0 `user_completed_actions` in the same 7-day window.
Impact: Acquisition is not converting into downstream action behavior.
Dependency: Items 1-2 and action instrumentation alignment for new users.
Status: In progress

4. Problem: Segment intake sources (geography/category/intent) into repeatable campaign tags.
Impact: Unsegmented traffic creates noisy signals and weak conversion interpretation.
Dependency: Activation log now exists; add segment enforcement at event capture.
Status: Pending

5. Problem: Define one canonical dashboard view for action-completion KPIs.
Impact: Prevents decorative analytics and enforces flow reality checks.
Dependency: Items 1-4 (reliable source labels and outcome logging).
Status: Pending

6. Problem: Decompose `server/routes.ts` into bounded modules without changing gating behavior.
Impact: Reduces regression risk and improves review speed.
Dependency: Contract tests for gating and trust flows.
Status: Pending

7. Problem: Close active lint/type debt in touched routing and funnel test files.
Impact: Improves change safety and long-term velocity.
Dependency: Item 6 for stable file boundaries.
Status: Pending

8. Problem: Add funnel drop-off telemetry checkpoints at Intent, Decision Card, and Contact transitions.
Impact: Enables direct diagnosis of flow leakage.
Dependency: Item 5 (canonical KPI model).
Status: Pending

9. Problem: Create county-by-county activation readiness checklist.
Impact: Prevents activation in counties where funnel or trust logic is incomplete.
Dependency: Items 5 and 8.
Status: Pending
