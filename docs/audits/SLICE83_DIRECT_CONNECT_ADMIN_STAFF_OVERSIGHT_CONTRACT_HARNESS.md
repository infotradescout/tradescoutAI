# Slice 83 - Direct Connect Admin/Staff Oversight Contract Harness

Date: 2026-06-01

## Decision
PASS (code-only admin/staff oversight invariants harness added)

## Scope
TradeScout only. Local/test runtime only. No production auth/cookie/KPI or live API work.

## Root Cause
Direct Connect already had requester, contractor, assignment, lifecycle, and notification hardening coverage, but staff/admin oversight invariants were not explicitly contract-locked in one place.

## Fix Summary
Added:
- `server/tests/direct-connect-staff-oversight.contract.test.ts`

Coverage now asserts:
1. admin/staff mutation surface is explicit and role-gated (`/api/admin/direct-connect/requests` with `isStaff`)
2. admin mutation path is audited (`logAdminAction`, bypass audit trace)
3. lifecycle metadata remains available for support inspection
4. read-only oversight paths do not emit contractor visibility/action events by read alone
5. requester contact remains redacted until contact-gate release state
6. requester-facing detail payload avoids contractor direct-contact leakage fields
7. HomeID preview/test provenance markers remain explicit (`isHomeIdPreviewDraft`)
8. assignment visibility integrity remains independent of paid/featured/subscription flags

## Law Integrity Classification
- Visibility does not equal access: `enforced`
- All contact is gated (Intent -> Decision Card -> Contact): `enforced`
- Trust/CVS exposure boundaries: `enforced`
- No pay-to-play / no ranking advantage: `enforced`
- Temporary exceptions in this slice: none

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Deferred
- Slice 75B live staff-auth KPI pull remains deferred pending session rotation hygiene.

## Next P1
- If session rotation is completed: resume live KPI with smoke runner.
- If staying code-only: move to notification/email delivery lifecycle depth or admin analytics guardrail harness.

