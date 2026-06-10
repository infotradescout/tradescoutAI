# Slice 84 - Direct Connect Doctrine Regression Matrix

Date: 2026-06-01

## Decision
PASS (consolidated doctrine regression matrix added)

## Scope
TradeScout only. Code-only/local validation. No production auth/cookie/live KPI work.

## Root Cause
Direct Connect had many focused hardening slices, but lacked one consolidated doctrine regression matrix proving the core TradeScout laws remain preserved together.

## Fix Summary
Added:
- `server/tests/direct-connect-doctrine-regression-matrix.contract.test.ts`

Matrix coverage now locks:
1. no pay-to-play routing/visibility influence (`paymentStatus`, `featuredPlacement`, `subscriptionLevel` remain non-authoritative)
2. no lead selling / no premature contact exposure (`homeownerContact: null` pre-gate)
3. decision-before-contact gate release invariant (`user_approved` release condition)
4. Home Record optionality through create/review/submit/routing path
5. preview/test/HomeID artifact suppression markers
6. staff/admin oversight boundary with role gate + audit trace
7. human-readable lifecycle copy (no raw enums/internal status leakage)
8. KPI allowlist contains key submission funnel events

Also verifies the focused harness stack remains present (Slices 76-83 test surfaces).

## Law Integrity Classification
- Visibility does not equal access: `enforced`
- All contact is gated (Intent -> Decision Card -> Contact): `enforced`
- No pay-to-play / no ranking advantage: `enforced`
- Home Record optionality: `enforced`
- Staff oversight boundary: `enforced`
- Temporary exceptions in this slice: none

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Deferred
- Slice 75B live KPI pull remains deferred until staff session rotation hygiene.

## Next P1
- Option A: rotate session and resume live KPI pull with `npm run smoke:staff-kpi`.
- Option B: produce Direct Connect Production Launch Gate v1 summary.

## P6 Extension - Contact Gate Production Smoke + Regression Matrix (2026-06-10)

Expanded regression coverage now includes an explicit contact-gate state matrix and production smoke probes for:
- `contact_hidden`
- `provider_requested_contact`
- `requester_approved`
- `contact_released`
- unknown state fail-closed behavior
- missing state fail-closed behavior
- truthy `releasedContact` payload ignored unless normalized state is exactly `contact_released`

Added smoke/runbook artifact:
- `docs/runbooks/DIRECT_CONNECT_CONTACT_GATE_SMOKE.md`

Validation target for this extension:
- Server payloads: no pre-release contact serialization.
- Requester card surfaces: no raw contact before release.
- Share surface: contact remains locked and redacted.

