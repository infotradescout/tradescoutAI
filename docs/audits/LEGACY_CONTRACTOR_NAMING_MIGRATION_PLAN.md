# Legacy Contractor Naming Migration Plan

Date: 2026-05-14
Owner: TradeScout product/engineering
Scope: Route, API, table, role, and UI names that still use contractor terminology after business-profile genericization.

## Law Integrity

| Statement | Classification | Notes |
| --- | --- | --- |
| New user-facing business surfaces should use business/provider/seller language unless they are explicitly trade-directory SEO pages. | policy_target | Guarded by `server/tests/business-genericization.contract.test.ts`. |
| Legacy contractor route, role, and table names remain compatibility handles until migrated with redirects, data backfills, and contract tests. | temporary_exception | Owner: engineering. Rationale: these names are embedded in routes, roles, tables, tests, and stored records. Removal date: 2026-08-31. |
| Contact, Trust/CVS, county, and no-lead-selling invariants must not change during naming migration. | enforced | Migration is naming/compatibility only; behavior remains gated. |

## Compatibility Inventory

| Layer | Legacy names | Target names | Migration approach |
| --- | --- | --- | --- |
| Role values | `contractor_user`, `contractor_success`, `accelerator_member` | `business_user`, `business_success`, business-provider capability flags | Initial `isBusinessProviderRole` / `userHasBusinessProviderTools` helpers are in place; migrate auth/session role mapping last. |
| Public routes | `/contractors/*`, `/contractor-apply`, `/contractor-dashboard`, `/contractor/leads` | `/businesses/*`, `/businesses/apply`, `/business-dashboard`, `/business/requests` | Keep redirects and canonical links; introduce generic aliases before changing old links. |
| Admin routes/tabs | `/admin/contractors`, `contractor-settings`, `/admin/commercial-contractors` | `/admin/business-providers`, `business-provider-settings`, `/admin/commercial-businesses` | Add new paths/tabs that render same tools; hide old names from nav; keep old paths as redirects. |
| Data tables | `contractors`, `contractor_*`, `contractor_id` fields | `business_providers`, `business_provider_*`, `provider_id` | Create views/compat columns first; migrate app reads; then rename or leave storage names as documented compatibility. |
| APIs | `/api/contractors/*`, `targetContractorIds` | `/api/business-providers/*`, `targetProviderIds` | Initial aliases are in place for provider search/top-provider lookup and Direct Connect targeting; old API remains deprecated compatibility. |
| SEO pages | trade pages with `Contractors` titles | trade-specific pages may retain contractor/trade language | Keep contractor wording only where query intent is explicitly trade/contractor. |

## Remaining Contractor-Language Classification

| Surface | Classification | Decision |
| --- | --- | --- |
| County SEO pages (`client/src/pages/county/CountyPage.tsx`) | temporary_exception | Keep contractor wording for explicit "contractors near me" search intent until county landing pages split generic local-help CTAs from trade SEO content. Owner: engineering. Removal/review date: 2026-08-31. |
| Public contractor profile pages (`client/src/pages/contractor-profile.tsx`) | temporary_exception | Keep contractor wording while `/contractors/*` public profile URLs remain indexed compatibility surfaces. Owner: engineering. Removal/review date: 2026-08-31. |
| Competitor comparison pages | policy_target | Genericize broad discovery CTAs to "Find Local Help" while allowing competitor/trade context in body copy where the page compares contractor lead models. |
| Business-provider tools under legacy `/contractor/*` paths | policy_target | User-facing copy should say business provider/business dashboard; route/file names remain compatibility handles. |
| Tests, comments, demos, and structured-data helper comments | temporary_exception | Keep only when documenting legacy behavior, test names, or implementation compatibility. Owner: engineering. Removal/review date: 2026-08-31. |

## Ordered Migration

1. **Surface copy complete**
   - Keep generic business copy on profile, dashboard, help, onboarding, nav, footer, legal, and SEO defaults.
   - Keep contractor copy only in explicit trade-directory pages and legacy compatibility docs.

2. **Alias routes and APIs**
   - Add `/businesses/apply`, `/business-dashboard`, and future `/business/requests` aliases.
   - Generic API aliases for provider search and request targeting are in place: `/api/business-providers/search`, `/api/business-providers/top`, and `targetProviderIds`.
   - Add contract tests proving old paths still resolve and new paths are preferred in visible UI.

3. **Capability-based role layer**
   - Helper predicates such as `isBusinessProviderRole` and `userHasBusinessProviderTools` are in place.
   - Replace direct string checks in UI and server logic while preserving accepted legacy role values.

4. **Schema compatibility**
   - Add views or compatibility mappings for provider reads before any destructive rename.
   - Backfill provider/business profile references from legacy contractor records.
   - Add migration notes and rollback paths.

5. **Deprecation and cleanup**
   - Log usage of legacy `/contractor*` routes and APIs.
   - Remove old visible links only after aliases and analytics prove stability.
   - Rename storage only if operational value outweighs migration risk.

## Do Not Do

- Do not break `/contractors/*` routes while search engines or old links still use them.
- Do not rename database tables without compatibility views and rollback notes.
- Do not weaken contact gating, Trust/CVS, county routing, or no-lead-selling rules under the banner of naming cleanup.
