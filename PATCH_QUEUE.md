# TradeScout Patch Queue (Ordered)

Last Updated: 2026-03-19
Owner: Execution Layer
Status: Active

## Queue Rules
- Ordered top-to-bottom by execution sequence.
- Each item must include: problem, impact, dependency, status.
- One session should target one outcome.
- If an item spans multiple systems, split it before execution.

## Queue
1. Problem: Establish canonical activation logging contract and process.
Impact: Without this, distribution traffic cannot be tied to real action outcomes.
Dependency: `ACTIVATION_LOG.md` schema lock.
Status: In progress

2. Problem: Segment intake sources (geography/category/intent) into repeatable campaign tags.
Impact: Unsegmented traffic creates noisy signals and weak conversion interpretation.
Dependency: Queue item 1.
Status: Pending

3. Problem: Define one canonical dashboard view for action-completion KPIs.
Impact: Prevents decorative analytics and enforces flow reality checks.
Dependency: Items 1-2 (reliable source labels and outcome logging).
Status: Pending

4. Problem: Decompose `server/routes.ts` into bounded modules without changing gating behavior.
Impact: Reduces regression risk and improves review speed.
Dependency: Contract tests for gating and trust flows.
Status: Pending

5. Problem: Close active lint/type debt in touched routing and funnel test files.
Impact: Improves change safety and long-term velocity.
Dependency: Item 4 for stable file boundaries.
Status: Pending

6. Problem: Add funnel drop-off telemetry checkpoints at Intent, Decision Card, and Contact transitions.
Impact: Enables direct diagnosis of flow leakage.
Dependency: Item 3 (canonical KPI model).
Status: Pending

7. Problem: Create county-by-county activation readiness checklist.
Impact: Prevents activation in counties where funnel or trust logic is incomplete.
Dependency: Items 3 and 6.
Status: Pending
