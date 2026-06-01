# Slice 79 - Direct Connect Requester Lifecycle Status Integrity

Date: 2026-06-01
Commit: pending
Scope: TradeScout only

## Decision
PASS (code-only status hardening + contract coverage)

## Root Cause
Requester lifecycle status presentation could become confusing by blending raw request statuses and internal phrases into contradictory card labels (for example draft/open/waiting semantics overlapping).

## Fix Summary
Updated requester card status presentation mapping in:
- `client/src/pages/direct-connect/requestCardPresentation.ts`

Added/updated contract coverage in:
- `client/src/pages/direct-connect/requestCardPresentation.test.ts`

Status integrity changes:
1. Draft state is rendered as `Draft ready`.
2. Submitted/open state is rendered as `Submitted`.
3. Routed state is rendered as `Waiting on pros`.
4. In-progress/responded state is rendered as `Provider responded`.
5. Pending outcome state is rendered as `Choose next step`.
6. Contact gate override (`contractor_requested`) renders `Review contact request`.
7. Completed/cancelled states render one clear terminal label.
8. Internal/raw enum phrases are not used as primary status labels.

## Safety/Doctrine Check
- No contact release logic changed.
- No contractor visibility/routing behavior changed.
- No paid placement/ranking behavior changed.
- HomeID preview/test artifact suppression remains intact through existing guards/tests.

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS

## Next P1
Resume deferred live KPI measurement once session rotation is complete:
- Slice 75B via `npm run smoke:staff-kpi`
