# Public profile and template UX continuation — 2026-09-15

Objective: Extend the UI/UX improvement scope to all TradeScout templates and public/custom profiles, retaining features, existing design identities and access rules. This is the first shared-component slice, not a complete theme redesign or release.

Base branch/commit: main / bda589173ec470e5c13044492caa4b13a6b3490d.
Current branch/commit: codex/public-profile-template-ux-20260915; the commit containing this checkpoint. Exact publication identity belongs in its PR.

Verified completed work:
- Shared owner toolbar wraps instead of hiding controls in a horizontal strip. Existing inline editor, qualified full editor, custom-domain bridge, JW inventory and photo controls remain.
- Searchable canonical template catalog with current-layout indicator, native radio selection and explicit Apply. No new template IDs or reset behavior. Search includes label, ID, description, business fit and family.
- Failed saves retain the template picker and show an inline error. A synchronous in-flight guard prevents overlapping submissions in this component. Unsaved inline edits block template application; closing/navigation and browser unload warn about losing edits. Inputs are labelled and frozen during saving. Focus returns to the template toggle after closure.
- Shared public inventory cards link images and titles through the existing destination owner, handle failed/missing images without promising future photos, allow long prices/locations to wrap, align actions and respect reduced motion. Supplied availability is neutral rather than always green. Existing price/access data and sharing behavior are unchanged.

Files changed:
- client/src/components/profile/ProfileSiteManageChrome.tsx
- client/src/components/profile/ProfileTemplatePicker.tsx
- client/src/components/profile/profileTemplateSearch.ts
- client/src/components/profile/PublicProfileProductCard.tsx
- scripts/tests/profile-ux.contract.test.mjs
- this checkpoint

Tests/evidence already run:
- NODE_PATH=$(npm root -g) node --test scripts/tests/profile-ux.contract.test.mjs: 23 passed, zero failed/skipped in isolated Node 22.16.0 with TypeScript 5.8.3.
- Breakdown: 13 executed search-behavior tests, 4 TypeScript/TSX parse checks, 6 source contracts. These are not React/browser tests, full application typechecking, API/database acceptance or release proof.

Changed but unverified work: Runtime React interactions, actual catalog integration, mobile/desktop appearance, full application typecheck/build and existing profile invariant/authority suites. No claim that every profile has been visually enhanced or accepted yet.
Tests/evidence invalidated by later changes: None reused from other PRs; their release receipts do not attest to this source.
Known blockers/risks: Desktop connector reported offline; editing container could not reach GitHub/npm to install locked application dependencies. Changes must be exercised in the canonical full workspace. Existing file-count budgets were already reported failing in platform PRs; no thresholds changed here. Native confirm remains the discard guard, not a universal SPA navigation blocker.
External side effects and retry safety: Source publication only. No main merge, production deployment, permission/membership change, customer data mutation, message, payment or inventory write. Persisted updates keep the existing authenticated endpoint and server authority.

Next exact action:
1. In the full dependency-installed workspace, run the new test above without NODE_PATH, existing profile-template/law contracts, affected React suites, scoped formatting/lint and npm run check. Add real React tests for failed apply remaining open, duplicate-submit prevention, dirty-editor protection, keyboard focus and missing-image recovery. Then verify 320/390 px and desktop views with long content.
2. Continue the remaining visual slice in the existing owners, not a new builder: BusinessProfileTheme/PreservedDefaultProfileTheme, LocalServiceProfileTheme (plumbing/electrician), WholesalerProfileTheme, JrsAutoGlassProfileTheme, VideographerProfileTheme, FinancialProfessionalProfileTheme, and profile-specific PrecisionAerial/ProFab/SteelHome routes. Include legacy PublicProfileView/BusinessProfileView and the full ProfileSiteEditor template picker. Preserve each renderer's data, trust section, qualified footer and contact route. JW-specific product changes stay in the JW lane.
3. At integration, combine with the existing Core UI release work (#658/#662), run the unchanged minimum release gate on the exact candidate, then follow release control. Shared-component work here does not supersede those branches.

Actions that must NOT be repeated: Do not restart the repository-wide audit, recreate the Core UI branch, re-audit JW membership, flatten branded themes, add public phone/email CTAs, invent inventory/prices/reviews, or represent source checks as live acceptance.
