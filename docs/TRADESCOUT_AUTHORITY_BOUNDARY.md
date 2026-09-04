# TradeScout authority boundary

Status: Draft convergence evidence  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Intended boundary

TradeScout has one product-local request-authority spine:

- `server/auth.ts` owns authenticated-request binding and the canonical
  authentication, role, permission, admin, and super-admin route guards.
- `server/utils/requestEffectiveUser.ts` resolves principal and effective users
  during impersonation.
- Extracted routers consume those guards. They do not reinterpret roles or
  recreate authentication checks.

Compatibility export names may remain while routes migrate, but they must be
aliases to a canonical guard rather than separate implementations.

## Converged in this change

- `requireAuth` is an alias of `isAuthenticated`.
- `requireAdmin` and `isModerator` are aliases of `isAdmin`.
- `isHeadAdmin` is an alias of `isSuperAdmin`.
- The local `requireAdmin` implementation in `server/routes.ts` is retired.
- Prompt administration, Admin Control, and extracted super-admin routers use
  the central guards.

All of these consumers now share fresh effective-account resolution and the
same impersonation privilege boundary.

## Evidence still requiring convergence

This change does not declare the whole identity system aligned:

- Local, Facebook, and Google Passport strategies now live in `server/auth.ts`.
  Product routes still own their HTTP entry, callback, attribution, and
  post-login behavior.
- Provider subject identifiers now govern social login. Email coincidence no
  longer writes a provider onto an existing account, but the authenticated
  link and unlink experience has not yet been built.
- Legacy admin flags and configured alias emails still participate in authority
  decisions. Their removal or retention requires account-by-account evidence
  and recovery proof.
- Product role, active presentation role, assigned roles, business membership,
  and permission remain overlapping concepts.
- Additional route-local predicates perform record ownership and specialized
  operational checks; each must be classified before it is reused or retired.

## Next proof gates

1. Build explicit authenticated provider linking, unlinking, collision review,
   and recovery on top of the new fail-closed identity policy.
2. Inventory every privileged mutation and record its required product role,
   business membership, permission, and denial behavior.
3. Reconcile legacy alias and boolean authority with explicit grants before
   deleting any recovery path.
4. Keep the Infinity-wide human identity owner unassigned until cross-product
   linking, unlinking, deletion, consent, and audit behavior are proved.

This document describes a draft branch. It does not claim a merge, deployment,
live migration, or Infinity-wide identity decision.
