# Public business cards — September 15, 2026 (America/Chicago)

Objective: Show useful saved business information and approved public profile media on directory cards without changing contact, membership or publication authority.
Base branch/commit: codex/public-profile-template-ux-20260915 / 0d7947b61b19ef595efbd84b55390d8f3dcc8af1.
Current product/test branch/commit: same branch / 9d211b11a06d0e0b371ad8b7bc6eecb283d8319b. This containing documentation commit changes only this checkpoint, not the verified product/test bytes. PR #667 records its publication identity.

## Verified completed work

The previous saved-text cards remain on the business directory and trade/county pages: tagline, description, category, services, city/state and complete valid imported rating/count; public=1 browsing, existing sharing/contact navigation and neutral claim status are preserved.

Media now comes from one batch lookup of profiles explicitly linked to the already-admitted business IDs. Exact business ID/slug, published state, canonical linked-profile exposure and indexing restrictions are checked before projecting data. Private owner/preferences fields used for authorization are not returned. Newest eligible linked profiles follow the existing canonical ordering; owner-wide matching is not used.

The allowlisted preview adds a sanitized headline fallback, published logo/cover and up to three distinct gallery records. Social presentation and gallery parsing reuse their existing owners. Exact gallery links must occur in the existing publication/sitemap graph, preserving explicit opt-out and descriptive-context requirements. The shared card displays available images with lazy loading, bounded aspect ratios, exact links and broken-image hiding; business facts and actions remain available without images. No fake photos, reviews, availability or verification badges are introduced.

This first media slice accepts only TradeScout-hosted public static image paths under images, attached_assets and assets. External hosts, signed/query URLs, credentials and private/authenticated media routes are excluded. Existing directory SQL/filter/order/pagination/write handlers and the five-minute result cache remain unchanged; the route diff is one import plus the awaited batch enrichment. Lookup errors use the existing error path rather than becoming cached successful empty previews.

Files changed in the media continuation:
- shared/publicBusinessCard.ts
- client/src/components/directory/PublicBusinessCard.tsx
- client/src/components/directory/PublicBusinessCard.test.tsx
- server/services/publicBusinessCardEnrichment.ts
- server/routes/business-directory-public.ts
- server/tests/public-business-card-media.behavior.test.ts
- server/tests/directory-navigation-cache.contract.test.ts
- scripts/tests/public-business-card.behavior.test.mjs
- this checkpoint (documentation only, after execution)

## Tests/evidence already run

Exact source: 9d211b11a06d0e0b371ad8b7bc6eecb283d8319b.
Free isolated service: srv-daktreajnfac73fush30.
Deploy: dep-daku2l61egvs73bu5d20.
Pass marker: PROFILE_CARDS_ACCEPTANCE_PASS 9d211b11a06d0e0b371ad8b7bc6eecb283d8319b, emitted 2026-09-16T00:24:36.297Z.

The runner rejects inherited database/provider credentials, verifies the expected Git commit, uses a clean temporary checkout and fresh npm 10.8.2 ci --include=dev, and requires an empty final git status. Runtime serves only a noindex verification notice, not TradeScout. Automatic deployment is off.

Executed commands:

```sh
node --test scripts/tests/public-business-card.behavior.test.mjs scripts/tests/profile-ux.contract.test.mjs
node node_modules/vitest/vitest.mjs run server/tests/public-business-card-media.behavior.test.ts client/src/components/directory/PublicBusinessCard.test.tsx server/tests/canonical-business-profile-trust.behavior.test.ts server/tests/trade-county-page-seo.contract.test.ts server/tests/directory-navigation-cache.contract.test.ts --maxWorkers=2
npm run check
node node_modules/eslint/bin/eslint.js shared/publicBusinessCard.ts server/services/publicBusinessCardEnrichment.ts client/src/components/directory/PublicBusinessCard.tsx client/src/components/directory/PublicBusinessCard.test.tsx server/tests/public-business-card-media.behavior.test.ts
```

Results: 76 Node checks plus 74 Vitest checks = 150 passed, zero failed. Vitest breakdown: 44 media/policy/projection, 10 real React/JSDOM interactions, 5 canonical-profile trust, 6 SEO contracts and 9 directory-cache cases. Full application TypeScript passed. Scoped lint returned zero errors and 22 warnings (theme-token usage and ignored test-file patterns); those warnings are not cleared.

Evidence limits: React tests use the actual card, Wouter and ShareButton with auth/final sharing transport mocked. Media tests execute actual exposure, gallery and publication-graph logic with the database reader mocked. Cache tests use Express/Supertest with mocked rows. The older Node handler suite isolates enrichment; its directory-query count is not the total enriched-page query count. Nonempty pages add one batch, and neither query repeats on a cache hit. No native PostgreSQL, real sharing transport, live data-completeness or pixel-review proof is claimed.

Initial media fixtures lacked the descriptive context required by existing gallery publication. They were corrected without relaxing production rules; real explicit opt-out and sparse-gallery rejection now pass. Earlier baseline 0d7947b passed 96 checks and full TypeScript in the same isolated lane; do not add that historical count to the current 150.

## Handoff

Changed but unverified work: Built desktop/mobile appearance and real media availability; native-browser keyboard/viewport behavior; full production build, native database acceptance and unchanged minimum-release gate.
Tests/evidence invalidated by later changes: None from this documentation-only update. Further product edits need relevant targeted checks, not a repeated platform audit.
Known blockers/risks: 22 lint warnings remain. Direct container GitHub/npm DNS failed and desktop access was unavailable earlier in this conversation, but isolated Render execution now works. Do not repeat the old typecheck-unavailable claim. The inherited five-minute cache is not instant-revocation proof. FIPS inputs, pagination behavior, external public media, canonical Trust/CVS summaries and other card renderers remain outside this slice. No budgets or release thresholds changed.
External side effects and retry safety: Draft source publication and one free isolated proof service only. No main merge, production application deploy, customer/business data write, claim, inquiry, message, payment, inventory update or membership grant. Synthetic fixture reruns are safe; no business writes as probes.
Next exact action: Resume PR #667 from this source. Reconcile card theme-token warnings and verify built rich/sparse cards at 320/390 px and desktop, including disclosure/share/navigation and failed media. Run production build and normal integration with Core UI #658/#662, then the unchanged release gate. Expand external media and Trust/CVS through their existing public authority owners.
Actions that must NOT be repeated: Do not recreate the branch/proof service, restart the platform audit or card data-path investigation, conflate claim/imported reviews with verification, invent absent facts, or label fixture checks as production acceptance.
