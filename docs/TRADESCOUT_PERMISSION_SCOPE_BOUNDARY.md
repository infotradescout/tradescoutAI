# TradeScout permission scope boundary

Status: Draft convergence evidence  
Authority: Infinity System Convergence Standard, approved by Thomas on
2026-09-04

## Governing rule

A role name is not a universal level of power. Product participation,
business/provider capability, community responsibility, platform staff work,
and administrative authority are separate scopes. A larger legacy role-rank
number cannot grant access to an unrelated scope.

Every protected action must distinguish:

1. authentication: which account is acting;
2. platform role: which explicitly named platform boundary applies;
3. resource authority: which record the person owns or may act on;
4. scoped membership or permission: which organization, county, group,
   property, conversation, or workflow grants the action; and
5. contact consent: whether discovery may progress to direct contact.

None of those facts substitutes for another.

## Current authority map

| Boundary | Current owner | Meaning | Disposition |
| --- | --- | --- | --- |
| Authenticated request | `server/auth.ts` | Binds the current effective account and impersonation context | Canonical product-local owner |
| Platform role gate | `server/auth.ts` `requireRole` | Requires one of the roles explicitly listed by the route | Converged in this draft |
| Named role permission | `server/auth.ts` `requirePermission` plus `shared/roles.ts` | Checks a named platform permission for the current primary legacy role | Retain as migration evidence; candidate-role sources still need reconciliation |
| Business/provider access | `server/auth.ts` `isBusinessProvider` | Allows product tools based on provider capability or named administrative authority | Product-local policy requiring a later business-membership model |
| Record ownership | Repositories, services, and route-local predicates | Proves authority over one business, profile, listing, project, property, vehicle, or other record | Correctly scope-specific but still distributed |
| Community authority | Community and county services | Grants action in a specific community/county context | Must remain scoped; never inferred from global visibility |
| Contact authority | Contact-permission and Direct Connect flows | Converts stated intent and a decision into permission to contact | Separate from role, discovery, and ownership |
| HOA, group, property, and conversation membership | Capability-specific tables and services | Grants only the actions defined for that membership and scope | Keep separate until shared semantics are proved |

## Corrected in this draft

`requireRole` and the matching client visibility helper now use explicit role
membership. Previously they compared numbers from `ROLE_HIERARCHY`. Because
that list mixes unrelated scopes, a platform support role could satisfy a
community-role boundary simply by having a larger number. Unknown and future
roles could also inherit unintended behavior from numeric fallback values.

The hierarchy remains available only for administrative role-assignment and
display workflows. Every existing server caller already names its intended
administrative, staff, or community roles, so this change removes accidental
inheritance without inventing a new grant.

## Remaining gates

- Reconcile `role`, `activeRole`, `roles`, legacy admin booleans, and configured
  recovery aliases into explicit, auditable grants.
- Inventory every privileged mutation and bind it to its resource owner,
  membership, permission, denial behavior, and impersonation rule.
- Replace generic business-provider role inference with business membership
  and capability evidence where the workflow acts for a business.
- Keep public visibility, verification, trust, payment, and contact consent as
  separate decisions.

This draft does not migrate accounts or permissions, remove a recovery path,
merge, deploy, or select an Infinity-wide identity owner.
