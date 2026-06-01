# Slice 78 - Direct Connect Request Assignment Integrity Harness

Date: 2026-06-01
Commit: pending
Scope: TradeScout only

## Decision
PASS (code-only harness)

## Root Cause
After contractor action hardening (Slice 77), assignment/routing integrity still needed targeted regression coverage to ensure:
- only eligible providers become request-visible
- visibility events remain tied to real assignment creation
- draft/preview paths do not accidentally become routing paths
- contact redaction and authorization remain intact

## Fix Summary
Added assignment integrity contract coverage in:
- `server/tests/direct-connect-assignment-integrity.contract.test.ts`

Coverage confirms:
1. Eligible contractor/business filtering gates assignment creation.
2. `direct_connect_request_visible_to_contractors` remains emitted when assignments are created.
3. Home Record/HomeID is optional and not a routing prerequisite.
4. HomeID draft submit path remains event-only (non-routing).
5. HomeID preview draft markers remain available for artifact suppression.
6. Unauthorized/non-eligible access/action paths remain blocked.
7. Requester contact remains redacted before gate release.
8. Routing logic remains independent of paid/featured/subscription fields.

## Platform/Law Integrity Check
- Intent -> Decision Card -> Contact preserved.
- Visibility does not grant contact preserved.
- No paid placement or ranking advantage introduced.
- No staff auth/cookie/live KPI flow touched.

## Validation
- `npm run check`: PASS
- `npm run test`: PASS
- `npm run build`: PASS

## Next P1
Resume deferred live KPI pull after session rotation:
- Slice 75B via `npm run smoke:staff-kpi`
- Measure live funnel drop-off from started -> review -> submitted -> visible -> contractor action.
