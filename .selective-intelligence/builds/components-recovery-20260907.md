# Platform component ownership recovery

Updated: 2026-09-08T20:55:02Z.

Bounded deliverable: adapt the safe platform portion of #569 (`53edb56b522a244b487361de2a2e8f591b3ca685`) onto frozen recovery `75f8ff8447231e0dc6df46049044456c3ed72a91` in isolated branch `integration/components-recovery-20260907`. Local commits are authorized; no push, PR, merge or deployment is included. The separate copy, authority, storage and root recovery worktrees remain untouched.

## Canonical owners and preservation

- `client/src/components/ui/states.tsx` owns EmptyState. Nine existing page consumers now request `scope="page"` with the same titles, descriptions, card/spacing classes, Inbox icon and requester action. Existing section consumers keep their heading, description and button behavior. No page feature was added or removed.
- `client/src/hooks/use-mobile.tsx` owns useIsMobile. Four old-hook consumers now import it. The consolidated implementation preserves the replaced hook's eager first viewport result and optional breakpoint, while retaining matchMedia subscription cleanup. Existing canonical-hook consumers also receive the correct initial mobile result instead of an initial desktop value.
- AppShellCore, AppShell, ScoutOS and the landing experiment each change only one import line. No shell export, navigation content, contact behavior or recovered request feature changes.
- AppRoutes, onboarding owner/compatibility modules, JW Stone files and WholesalerProfileThemeLegacy are byte-for-byte unchanged in this component commit.

## Retired module evidence

Source/import searches across client, server, shared, scripts and tests found no application or dynamic-registry consumers for `components/LoadingSkeleton.tsx`, `components/contractor-card-skeleton.tsx`, `components/MasterAdminSetup.tsx`, `components/auth/MasterAdminSetup.tsx`, `components/layout/navigation.tsx` or `components/ui/page-header.tsx`. The only consumer of `components/ui/navigation.tsx` was the unreferenced page-header module; all three retired navigation/header files were unreachable from the current shell. No import.meta.glob/require.context registry was found that would load them. Their seven removals retire unused implementations; current routed setup and navigation owners remain.

The old EmptyState module was removed only after all nine consumers migrated. The old useIsMobile module was removed only after all four consumers migrated. Post-change source searches and the TypeScript/production build find no stale imports. The business-copy contract now inspects the actual AppShellCore owner and keeps the same business-only copy prohibitions.

## Prior validation (September 7)

- Isolated `npm ci --no-audit --no-fund`: 1,305 packages; lockfiles unchanged.
- `npm run check`: passed.
- Focused Vitest: 10 files, 73 tests passed. This includes 16 new behavior cases proving all nine page consumers, the requester action, existing section behavior, first mobile render, threshold changes, optional breakpoint changes and listener cleanup. Existing onboarding, shell, mobile, login and request-composer contracts passed.
- Prettier and diff checks passed. Changed-file ESLint reported zero errors and 270 warnings, primarily in unchanged shell/Scout code plus ignored test-file notices. No unrelated style cleanup was made.
- `node node_modules/vite/bin/vite.js build`: passed, 4,216 modules. Existing Browserslist, ambiguous duration utility and large-chunk warnings remain.
- App-entry, public-shell deduplication, public-landing, built-asset URL and wholesaler chunk checks all passed. Landing startup: 230,464 bytes; asset verifier: 588 JavaScript bundles and 10 HTML references.
- Static built app on loopback port 5205 rendered `/help-demo/example` at 1440x1000 and 390x844. Screenshots `test-results/components-help-desktop.png` and `components-help-mobile.png` were inspected. This was visual proof only: no backend ran, and expected auth/analytics proxy failures do not establish an authenticated journey.
- Independent root objector review found no blocker in preservation, import scope, retired owners or the updated business-copy contract.

The refreshed Selective Intelligence index reduces duplicate-owner errors from 16 to 11 and keeps 5 raw-control warnings. Doctor reports no stale index or missing canonical declaration. Remaining collisions belong to the explicitly deferred owner work below; this slice does not claim a clean architecture inventory.

## Remaining #569 work

JW CurrentInventorySection/NewArrivals/marketplace, material terminology, the inventory rewrite script and associated contracts remain on the required JW lane. WholesalerProfileThemeLegacy remains untouched. Duplicate procurement exports, AppShell export naming, home/landing owner labels, onboarding alias-file retirement and PostCSS cleanup were not absorbed into this bounded consolidation. All existing onboarding URLs continue to use the canonical Onboarding component.

Visual verification also exposed the existing `/help-demo` and `/help-demo/` Not Found behavior: the unchanged `/help-demo/:rest*` route matches `/help-demo/example` but requires a nonempty rest segment. Root authorized a separate follow-up commit for that specific base-route gap, preserving the deep link and component/auth behavior. No other route redesign is authorized by this slice.

No database, full server release gate, live provider delivery or production action was performed. A combined candidate still requires its own exact release verification.

## September 8 recovery revalidation

The staged implementation was recovered unchanged from the September 7 checkpoint and inspected against its original parent and the platform portion of #569. It requires no additional component or hook implementation. The current worktree still has no upstream; this pass creates a local scoped commit for root integration only.

- `npm run check`: passed.
- `npm run test:run -- client/src/components/ui/states.behavior.test.tsx client/src/hooks/use-mobile.test.tsx server/tests/business-genericization.contract.test.ts server/tests/onboarding-flow-contracts.test.ts server/tests/shell-architecture-verifier.behavior.test.ts client/src/pages/home-mobile-action-surface.contract.test.ts client/src/pages/direct-connect/direct-connect-mobile-ux.contract.test.ts client/src/AppRoutes.onboarding.test.ts server/tests/app-shell-seo-contracts.test.ts server/tests/public-shell-aliases.test.ts`: 10 files, 74 tests passed, including the 16 page/mobile behavior cases.
- Source searches again found no imports of any retired component/hook or dynamic glob registry that would consume them. The staged paths contain no JW implementation.
- Project index refreshed with the bundled Python runtime: 2,770 source files, 942 components, 8,910 functions/hooks, 14,558 symbols, 11 existing owner/duplicate errors and five raw-control warnings. Doctor reports those retained findings; it reports no stale index or missing canonical owner.
- `git diff --cached --check`: passed. The initial `npm run guard:bloat` refused the dirty worktree; its deterministic budget result will be checked from the clean local commit and reported with the integration handoff.

Production build, rendered screenshots, database proof, and the full release gate were not rerun in this bounded recovery pass. The September 7 build/render evidence above remains historical; the integrated release candidate needs its own verification.
