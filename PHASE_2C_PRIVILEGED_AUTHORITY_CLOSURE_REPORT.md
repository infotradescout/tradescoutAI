# Phase 2C Privileged Authority Closure Report

Date: 2026-03-09
Status Owner: Copilot execution pass
Scope: Privileged write-capable server routes and assistant admin actions that can mutate user state, platform moderation state, impersonation state, or admin-managed system state.

## 1) Full Privileged Endpoint Inventory

Legend:
- `Immutable target required`: whether a stable target id/token is required before mutation.
- `Explicit reason required`: whether request/action requires an explicit reason field with enforcement.
- `Audit emitted`: whether handler emits standardized privileged audit (`auditPrivilegedAction`) or only legacy/non-uniform audit.
- `Test coverage`: direct proof in Phase 2C tests or existing regression tests.

| File | Route / Function | Mutation Type | Target Type | Immutable Target Required | Explicit Reason Required | Audit Emitted | Test Coverage | Status |
|---|---|---|---|---|---|---|---|---|
| `server/routes.ts` | `POST /api/admin/impersonate` | Start role-based impersonation request (fail-closed) | role token | no (intentionally denied) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes.ts` | `POST /api/admin/impersonate/start/:userId` | Start user impersonation | user | yes | yes | yes (uniform) | partial (covered via role fail-close + token router; no dedicated legacy start assert) | partial |
| `server/routes.ts` | `POST /api/admin/stop-impersonation` | Stop impersonation | user session target | yes (session target id) | fixed system reason | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/impersonate/stop` | Stop impersonation alias | user session target | yes (session target id) | fixed system reason | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/impersonate/exit` | Stop impersonation alias | user session target | yes (session target id) | fixed system reason | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/users/support-edit` | Support edit user/profile/preference fields | user | yes (`targetUserId`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes.ts` | `POST /api/admin/user-controls/suspend/:userId` | Suspend account | user | yes | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes.ts` | `POST /api/admin/user-controls/unsuspend/:userId` | Unsuspend account | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/user-controls/verify/:userId` | Force verification | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/user-controls/revoke-verify/:userId` | Revoke verification | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/user-controls/role/:userId` | Change user role | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes/admin.ts` | `POST /api/admin/users/:userId/impersonate` | Start user impersonation | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes/admin/impersonation.ts` | `POST /api/admin/impersonation/start/:userId` | Start token impersonation | user | yes | yes | yes (uniform) | yes (`server/tests/phase2c-token-impersonation.router.test.ts`) | compliant |
| `server/routes/admin/impersonation.ts` | `POST /api/admin/impersonation/exit` | Exit token impersonation | impersonation session | n/a (session-scoped) | fixed system reason | yes (uniform) | yes (`server/tests/phase2c-token-impersonation.router.test.ts`) | compliant |
| `server/routes/admin.ts` | `POST /api/admin/homescout/listings/:id/approve` | Approve listing | listing | yes | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/assistantActions.ts` | `adminResetUserPasswordAction` | Reset user password | user | yes (`userId`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/assistantActions.ts` | `adminGetUserInfoAction` | Privileged user lookup | user | yes (`userId`) | fixed action reason | yes (uniform) | indirect (covered by same module behavior) | partial |
| `server/routes.ts` | `PUT /api/admin/users/:userId/role` | Role change (legacy admin path) | user | yes (`:userId`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes.ts` | `DELETE /api/admin/users/:userId` | Delete user (legacy admin path) | user | yes (`:userId`) | yes | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/users/reset-password` | Reset password (legacy admin path) | user | yes (`userId`; email is metadata only) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes.ts` | `PUT /api/admin/users/:userId/profile` | Admin profile mutation | user | yes | yes | yes (uniform) | no direct | partial |
| `server/routes.ts` | `POST /api/admin/users/provision` | Provision account | user/email identity | no (email-first create path) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `DELETE /api/admin/users/:userId` | Delete user (admin module path) | user | yes | yes | yes (uniform + legacy) | no direct | partial |
| `server/routes/admin.ts` | `DELETE /api/admin/community/posts/:postId` | Delete community post | post | yes | yes | yes (uniform + legacy) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes/admin.ts` | `PATCH /api/admin/users/:userId/roles` | Bulk role set | user | yes | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes/admin.ts` | `PATCH /api/admin/users/:userId/badges` | Badge mutation | user | yes | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes/admin.ts` | `POST/PATCH /api/admin/feature-flags...` | Feature flag config mutation | feature flag | partial (id required on patch only) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST/PUT/DELETE /api/admin/site-settings...` | Site setting mutation | site setting | partial | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST/PUT/DELETE /api/admin/prizes...` | Prize config mutation | prize config | partial | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST/PUT/DELETE /api/admin/advertisements...` | Advertisement config mutation | advertisement config | partial | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/affiliates/:id/payout` | Create payout | affiliate program | yes (`:id`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes/admin.ts` | `PUT /api/admin/affiliates/:id/commission-rate` | Change commission rate | affiliate program | yes (`:id`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | compliant |
| `server/routes/admin.ts` | `POST /api/admin/homescout/reports/:id/close` | Close report | report | yes (`:id`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST/PATCH /api/admin/homescout/sources...` | Source config mutation | source | partial | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/homescout/sources/:id/run` | Trigger ingestion run | source/job | yes (`:id`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/geo/counties/:fips/notes` | Create county note | county note | yes (`:fips`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `PATCH/DELETE /api/admin/geo/notes/:noteId` | Edit/delete county note | county note | yes (`:noteId`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/geo/counties/:fips/entities` | Create county entity | county entity | yes (`:fips`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `PATCH/DELETE /api/admin/geo/entities/:entityId` | Edit/delete county entity | county entity | yes (`:entityId`) | no | no uniform privileged audit | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/business-directory/suggestions/:id/status` | Suggestion status mutation | suggestion | yes (`:id`) | no | partial (legacy `logAdminAction`) | no direct | unresolved |
| `server/routes/admin.ts` | `POST /api/admin/business-seeding/places-textsearch/run` | Spawn seeding job | seed run/job | n/a (job trigger) | no | partial (legacy `logAdminAction`) | no direct | exception |
| `server/routes/admin.ts` | `POST /api/admin/geo/seed-counties` | Seed system geo data | global geo dataset | n/a (system action) | no | no uniform privileged audit | no direct | exception |
| `server/routes/admin.ts` | `POST /api/admin/geo/metrics/refresh` | Refresh county metrics | global metrics job | n/a (system action) | no | no uniform privileged audit | no direct | exception |
| `server/routes/admin/user-controls.ts` | `POST /suspend|unsuspend|verify|revoke-verify|role` | Dedicated user-controls router | user | yes | yes | yes (uniform) | no runtime mounting proof | partial |
| `server/routes/admin/ui-issues.ts` | `POST/PATCH/DELETE /api/admin/ui-issues...` | UI issue intake/moderation state | issue | partial | no | no uniform privileged audit | no direct | unresolved |
| `server/assistantActions.ts` | `adminOverrideCreateAction/adminOverrideDeleteAction` | Manual override mutation | cache override key | yes (overrideType+key composite) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | partial |
| `server/assistantActions.ts` | `adminUpsertKnowledgeAction` | Knowledge mutation | cache key | yes (`key`) | yes | yes (uniform) | yes (`server/tests/phase2c-privileged.integration.test.ts`) | partial |

## 2) Exception Register

No silent exclusions were applied. Explicit exceptions are listed below.

| Path | Reason for Exception | Why Allowed | Compensating Controls | Follow-up Needed |
|---|---|---|---|---|
| `server/routes/admin.ts` `POST /api/admin/business-seeding/places-textsearch/run` | Operational job trigger, not direct user-identity mutation | Admin-only and environment-gated | `requireAdmin`, DB/API-key validation, job logging | Add uniform privileged audit envelope and optional reason field |
| `server/routes/admin.ts` `POST /api/admin/geo/seed-counties` | One-shot system seeding action | Super-admin gate | `isSuperAdmin`, non-destructive insert policy | Add uniform privileged audit envelope |
| `server/routes/admin.ts` `POST /api/admin/geo/metrics/refresh` | System refresh action | Super-admin gate + rate-limit | `isSuperAdmin`, per-user interval guard | Add uniform privileged audit envelope and reason-on-demand |

## 3) Done Criteria Check (Phase 2C Completion Standard)

| Criterion | Result | Evidence |
|---|---|---|
| All privileged mutation paths require immutable target authority | **partial** | Core impersonation/support/user-control paths comply and legacy reset-password now requires `userId`; multiple admin config/moderation mutation routes still lack full contract target discipline. |
| All privileged actions require explicit reason | **fail** | Many admin write routes do not enforce reason (`feature-flags`, `site-settings`, `prizes`, `advertisements`, county notes/entities, affiliate mutations, report close, source mutations, ui-issues). |
| All privileged actions emit uniform audit events | **fail** | Uniform audit present on Phase 2C slice; many admin writes still use legacy/no audit. |
| All impersonation routes are bounded and tested | **pass** | Role-based fail-closed + token router direct tests + user-targeted bounded checks. |
| No email-only privileged mutation authority remains | **pass** | `POST /api/admin/users/reset-password` now requires immutable `userId`; email-only targeting is denied and tested (`server/tests/phase2c-privileged.integration.test.ts`). |

## 4) Proof Map

| Path | Contract Used | Test File | Verification Result |
|---|---|---|---|
| `/api/admin/users/support-edit` | `normalizeImmutableTargetId` + `normalizePrivilegedReason` + `auditPrivilegedAction` | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/impersonate` | fail-closed role path + uniform denied audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/homescout/listings/:id/approve` | explicit reason + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/user-controls/suspend/:userId` | explicit reason + immutable target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/users/reset-password` | immutable target (`userId`) + explicit reason + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/users/:userId/role` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/users/:userId/roles` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/users/:userId/badges` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/community/posts/:postId` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/affiliates/:id/commission-rate` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/affiliates/:id/payout` | explicit reason + immutable route target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `assistant_admin_override_create` | explicit reason + immutable composite target + uniform denied audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `assistant_admin_override_delete` | explicit reason + immutable composite target + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `assistant_admin_upsert_knowledge` | explicit reason + immutable key target + uniform denied audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `assistant_admin_reset_user_password` | immutable target + reason + uniform audit | `server/tests/phase2c-privileged.integration.test.ts` | pass |
| `/api/admin/impersonation/start/:userId` | explicit reason + immutable target + uniform audit | `server/tests/phase2c-token-impersonation.router.test.ts` | pass |
| `/api/admin/impersonation/exit` | bounded exit + uniform audit | `server/tests/phase2c-token-impersonation.router.test.ts` | pass |

## Closure Summary

**Phase 2C Status: NOT DONE**

Remaining drift paths:
- Duplicate-path parity/runtime-canonical uncertainty remains for `DELETE /api/admin/users/:userId` (defined in both `server/routes.ts` and `server/routes/admin.ts`) plus partial direct-proof coverage for legacy `DELETE /api/admin/users/:userId` and `PUT /api/admin/users/:userId/profile` in `server/routes.ts`.
- Broad admin config and moderation mutations without explicit reason and uniform privileged audit (`feature-flags`, `site-settings`, `prizes`, `advertisements`, `county notes/entities`, HomeScout report/source admin writes, UI issue admin writes).
- Assistant admin override/knowledge paths now enforce contract, but proof depth is still partial (denied-path assertions for `assistant_admin_override_create` and `assistant_admin_upsert_knowledge`; completed-path expansion still needed for full closure confidence).

Recommended follow-up:
1. Migrate remaining privileged mutation handlers to shared contract (`normalizeImmutableTargetId`, `normalizePrivilegedReason`, `auditPrivilegedAction`) with explicit deny branches.
2. Add direct proof coverage for `DELETE /api/admin/users/:userId` and `PUT /api/admin/users/:userId/profile` with route-disambiguation assertions for duplicate path runtime source.
3. Add completed-path proof expansion for assistant `admin_override_create` and `admin_upsert_knowledge` to elevate those entries from partial to compliant.
4. Add Phase 2C proof expansion for each unresolved cluster (admin config mutations, county admin mutations, report/source admin writes).
5. Decide runtime source-of-truth for duplicated routers and remove non-canonical shadow paths after parity.
