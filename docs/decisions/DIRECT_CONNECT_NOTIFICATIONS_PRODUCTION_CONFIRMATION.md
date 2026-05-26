# Direct Connect Notification UI Production Confirmation

**Status:** ✅ Pending production confirmation (awaiting build header flip)  
**Date:** 2026-05-25  
**Scope:** Direct Connect notification lifecycle UI  
**Build target:** `db3fd8ce...`

## Current source-of-truth mapping

- Backend durability (DB/service layer): `a6e02500`
- Notification UI code push: `db3fd8ce`
- Production UI confirmation: pending (`x-tradescout-build` header mismatch check)

## Decision

Hold status as **pending production confirmation** until the production header confirms the expected build commit.

This prevents a false release claim: `main` can contain the UI, but only the production header confirms it is live.

The verification is only accepted when:

- `x-tradescout-build` header shows `db3fd8ce...` on production responses.

## Next-step verification matrix

Run the final production matrix once the header is expected:

```powershell
curl -I "https://www.thetradescout.com/scout?unlock=exchange"
curl -I "https://www.thetradescout.com/direct-connect"
curl -I "https://www.thetradescout.com/api/dashboard"
curl -i "https://www.thetradescout.com/api/direct-connect/notifications"
```

Expected outcomes:

1. `/scout?unlock=exchange` → `200`
2. `/direct-connect` → `200`
3. `/api/dashboard` unauthenticated → `403`
4. `/api/direct-connect/notifications` unauthenticated → `403` (not `500`)
5. `x-tradescout-build` header → `db3fd8ce...`

## Completion condition

When all checks are green:

- `Notification UI live: ✅ db3fd8ce`

## Follow-up QA

After this confirmation passes, next pass is authenticated lifecycle QA to verify users can:

- receive Direct Connect notifications,
- read them in-context,
- archive notifications end-to-end.
