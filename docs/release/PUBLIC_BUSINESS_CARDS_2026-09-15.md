# Public business cards — 2026-09-15 continuation

Objective: Replace thin public business name/status rows with useful business information already stored by TradeScout. Continue profile UX PR #667 without changing business publication/contact authority.
Base branch/commit: codex/public-profile-template-ux-20260915 / ef2cc12cc40e0c32917e9f3227a549f586763815.
Current branch/commit: same branch; exact containing commit and published blob comparisons recorded in PR #667.

Verified completed work:
- The existing public directory query already fetched profileData but discarded it. Add one bounded allowlisted card projection after the existing publication decision, without adding queries or changing SQL, ordering, pagination, cache, exposure policy or any write handler.
- Expose saved tagline, description, category, services, city/state and valid imported rating/count. Reuse the canonical public-text sanitizer. No raw profileData, private fields, contact URLs, exact address, notes or owner identity are added to the response. Invalid/incomplete review evidence remains absent.
- Shared PublicBusinessCard now serves the business directory and trade/county page: wrapping identity and location, service chips, description, native expanded details, imported-review label, accessible View business and existing ShareButton. No invented photos, availability, reviews or credentials. Claim status is neutral, not a verification shield. County assignments are labelled Listed in, not asserted full service coverage.
- Both public consumers explicitly request public=1 so signing in does not switch public browsing to the owner API. Existing route and full-profile contact continuation remain.
- Existing trade/county SEO contract follows the shared card owner while retaining metadata, request-path and noindex assertions.

Files changed:
- shared/publicBusinessCard.ts
- client/src/components/directory/PublicBusinessCard.tsx
- client/src/pages/business-directory.tsx
- client/src/pages/trade/TradeCountyPage.tsx
- server/routes/business-directory-public.ts
- server/tests/trade-county-page-seo.contract.test.ts
- scripts/tests/public-business-card.behavior.test.mjs
- this checkpoint

Tests/evidence already run:
- NODE_PATH=$(npm root -g) node --test scripts/tests/public-business-card.behavior.test.mjs: 53 passed, 0 failed/skipped on Node 22.16.0 / TypeScript 5.8.3 in the isolated editing container. 33 projection/rating/safety cases, 7 evaluated JSX-output cases, 7 actual directory-handler cases, 1 consumer contract and 5 syntax checks. JSX runtime, router/icon/share components are stubs, not real React. Handler dependencies (Express registration, DB and publication policy) are mocked. This proves the executed projection/control flow, not native SQL, real authorization, browser interaction or live data accuracy.
- tsc --noEmit --strict --target ES2022 --module commonjs shared/publicBusinessCard.ts shared/publicListingSafety.ts: passed for those two helpers only.
- Original server reconstruction was checked against Git blob ab56f81fbc986c28af1b7525b6653d9f69fc82d8. A reconstruction omission in the unrelated trade-city recent scope was caught by the remote diff, restored before branch publication, and the full original blob then matched. Final intended server delta is exactly the import plus card projection; all 53 tests were rerun after restoration.
- Original TradeCountyPage matched 611bd2b70d1804a09387d8d3f0891eb434a145a3, original SEO contract d9eedb1179acceb16d1ae0ca9db43e94ecf6a5c2, unchanged safety helper 27fd98f21e8acbedc116029a7212fcdacb4136c4.

Changed but unverified work: Actual React/DOM behavior, built styling and layout at 320/390 px and desktop, real ShareButton/native sharing, full application typecheck/build/lint/formatting, existing Vitest profile/SEO/authority suites, native database checks and exact-candidate release gate. No live business data was read to measure record completeness. These cards do not yet aggregate published logos/project photos, profile galleries, services stored in other public sources, availability or canonical Trust/CVS summaries. Other public-card renderers remain outside this slice.
Tests/evidence invalidated by later changes: The earlier 23 profile-UX source checks are historical, not rerun or added to this 53-test total; no earlier release receipt attests to this new candidate.
Known blockers/risks: Remote desktop process attempt returned no devices; container GitHub/npm DNS failed, so locked application dependencies were unavailable. Existing directory pagination, default filters and FIPS input remain outside the card fix. No file-count thresholds or release budgets changed.
External side effects and retry safety: Source publication only, on the existing draft branch. No main merge/deployment, customer/business data change, permission/membership change, message, payment, inquiry or claim action. Tests use synthetic fixtures. Retry public reads only; do not execute business writes as a test.

Next exact action: In the dependency-installed workspace, run the new suite, existing trade/county SEO and directory authority/cache suites, scoped formatting/lint and full typecheck/build. Add actual React/browser checks for sparse/rich cards, keyboard disclosure, destination/share behavior and long-content overflow at 320/390 px and desktop. Then enrich approved public media and canonical trust data through their existing owners, not private profileData spreads. Integrate with #667 and the existing core UI lane only at the normal release checkpoint.
Actions that must NOT be repeated: Do not restart a repository-wide audit, recreate this branch, repeat the data-path investigation, conflate imported reviews/claim status with verification, fabricate absent fields, or describe these tests as production/browser acceptance.
