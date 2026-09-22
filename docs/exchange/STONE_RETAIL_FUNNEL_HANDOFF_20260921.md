# TradeScout stone retail — storefront and discovery integrated, not deployed

## Objective
Generate real connected buyer calls and distinct interested buyers against comparable Facebook Marketplace offers. TradeScout is the retail seller and owns the customer relationship. JW remains the separate supplier; its portal/prices are not modified. Retail prices are public, including to fabricators. Pensacola means Pensacola, Florida city only, not county/radius/neighbors. Continuation is not approval of reference prices.

## Base branch/commit
Repository: infotradescout/tradescoutAI
Branch: exchange/tradescout-stone-retail-20260921
PR: 690, draft, not a production release.
Original main base: f22ddff023d24d5ca1938714619f942819afc5ce.
This continuation resumed from 385ecd68956c3beed9713423257c6ea43f006877, after registered migrations and native schema proof. Do not restart that work.

## Current branch/commit
Tested implementation/test commit: 2809b94f238a741902d58d1af253b6fafba9132b.
This handoff is a checkpoint-only successor. The PR metadata records the resulting branch head.

## Verified completed work
- Bound discovery to all 119 prior staged material IDs/names. Exact identity parity passed; no prices, source-photo links or supplier economics were added to the identity catalog.
- Added a bounded catalog reader using the existing marketplace table, the explicitly configured TradeScout seller, active Building Materials & Surfaces category, canonical exposure predicate, active/unexpired state, and signed price/copy/photo approval. Public output is an explicit allowlist, not a redacted supplier record.
- Mounted /exchange/stone, /api/exchange/stone and /api/exchange/stone-media/:id through the existing post-auth metadata owner. The landing supports material/name search, cents and price units, stone-specific availability/callback links, and selected-market photo URLs. Browsing prices does not require sign-in or fabricator membership.
- Added approved national retail rows to the existing Exchange merge before global sorting/pagination. Hidden retail source rows do not fill native-source page windows. Native/profile content remains in its established flow. Existing public detail projection uses the same request-approved retail record.
- Scoped live Scout marketplace reads to the same approved source, excluding raw retail rows from ordinary queries and the unlocalized crawler cache.
- Implemented request/account/selected-market eligibility: exact normalized Pensacola + FL is excluded; adjacent cities and other states are not. Malformed/unknown locations remain unresolved, not inferred from county or ZIP. Known excluded accounts cannot be reenabled by a search parameter. Request scopes and private/no-store responses prevent one resolved market's catalog from being reused for another.
- Neutral photo delivery validates the expected TradeScout object key, WebP signature and approved SHA-256. It does not redirect to JW or Drive.
- Fixed two pre-checkpoint issues: JSON-LD escaping during source transport and using a Drizzle array chunk as an ANY array value. The final query uses a parameterized IN list. Both have regression coverage.

These are exact-source code and bounded test results. The complete deployed application has not been accepted.

## Files changed and exact Git blob identities
All 12 local implementation/test files matched the GitHub write/read blob identities at the tested commit.

| File | Git blob SHA-1 |
|---|---|
| server/data/exchangeStoneCatalogIdentity.ts | a2d016020ef64b98bed85ca12ae7cbd3c5c86ee3 |
| server/services/exchangeStoneDiscovery.ts | 3f227f59dff2babe06cba9bb04a1c75dcea620f8 |
| server/services/exchangeStoneCatalogReader.ts | c04e1c7ca0a9c8d80e7a28be48ec13d8eac13b9c |
| server/routes/exchange-stone-catalog.ts | 39e0f33912ea612bfd993d1a063bc71d7fe57e33 |
| server/exchangeDiscovery.ts | d96e1af8adccd9897252befd0fe5e3eb2dc2ab27 |
| server/publicExchangeListing.ts | 526573f57384da3ff77bd57be8805e79d797f61e |
| server/services/marketplaceService.ts | 2013807251e954f97c4fde99913c5cf434eb14de |
| server/crawler/extractors/marketplace.ts | fcda5dc03b423a232545934c19062d19c80419b9 |
| server/publicExchangeStoneHtml.ts | 38cb81656260a80be810174b928b677972f31a7d |
| server/routes/public-metadata.ts | c577c8841c46c2151e304217f559928f9652d59d |
| scripts/exchange-stone-discovery.test.mjs | 134e9b2643c6f93ec4d648ae601a87a26237e600 |
| scripts/exchange-stone-query-shape.test.mjs | 8b6ddff6707732a0c84e3d13d4c1e166dd982fcb |

## Tests/evidence already run
1. NODE_PATH=$(npm root -g) node --test scripts/exchange-stone-discovery.test.mjs scripts/exchange-stone-query-shape.test.mjs
   Result: 34 passed, 0 failed, 0 skipped. Actual policy, request-scope, projection, merge, renderer, reader and route modules execute; database, Drizzle, media storage, HTTP/session and exposure dependencies use explicit adapters. Includes 119 retail + one native item across three pages, 24 concurrent asynchronous request contexts, geographic/direct/photo/cache isolation, signature tampering, query filtering, unavailable responses and JSON-LD script closure. One test is an explicit query source-contract check, not native query execution.
2. NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-schema.test.mjs scripts/exchange-stone-inquiry-transaction.test.mjs scripts/exchange-stone-inquiry-draft.test.mjs scripts/exchange-stone-funnel-core.test.mjs
   Result: 75 passed, 0 failed, 0 skipped. These existing tests retain their previously documented SQLite/HTTP/schema-snapshot/launcher adapters. They are not 75 new PostgreSQL executions.
3. tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --types node --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types server/services/exchangeStoneDiscovery.ts server/exchangeDiscovery.ts server/data/exchangeStoneCatalogIdentity.ts server/publicExchangeStoneHtml.ts
   Result: passed for this pure dependency closure. Syntax transpilation passed for all ten changed TypeScript files. This is not a full application typecheck/build.
4. Exact staged source catalog parity: all 119 ID/name pairs match. Canonical pair digest SHA-256: c02d397e949362b6056b65663fb73eec1b73a02d527448518fd02e9c936d8dee.

Prior 23 native PostgreSQL schema assertions remain earlier evidence; they were not repeated in this continuation. No new native application transaction/concurrency proof was executed.

## Changed but unverified work
- Full application route precedence, actual Express/session persistence, authentication return, existing API-to-screen behavior, production Drizzle query generation and PostgreSQL execution, real immutable object storage and mobile/desktop browser acceptance.
- Complete native inquiry transaction against the application schema with multiple processes, and npm run gate:minimum-release at the final integration commit.
- Main has other ongoing work; reconcile the exact integration candidate without overwriting concurrent branches or importing their unrelated changes.

## Tests/evidence invalidated by later changes
Earlier standalone landing/browser evidence does not accept this modified search form, scoped image URLs or middleware. Earlier screen browser evidence also predates the durable submission path. Rerun the actual integrated browser journey before release. Pure inquiry/schema behavior tests were rerun above; their bounded scope is unchanged.

## Known blockers/risks
- 119 staged material references, zero explicit retail-price approvals, zero newly published listings or photos. This code does not insert marketplace rows or upload images.
- Configure the verified TradeScout seller setting general.exchange_stone_retail_seller_user_id, review/copy exact source photos and run the approved-price importer. Do not substitute a supplier account, estimate stock, or infer price approval.
- Signed publication currently uses SESSION_SECRET for compatibility with the earlier staged manifest. Session-secret rotation invalidates publication signatures until explicitly re-signed. Buyer metrics continue to require their separate stable STONE_METRICS_SECRET.
- This is selected/account-market filtering, not proof of physical IP/city-boundary location or control of third-party search results. Unknown visitors choose a state and Florida city before products are shown. Published landing pages can be indexed, but nationwide product crawl/distribution still needs real acceptance; no crawler-only bypass was added.
- Catalog lookups are bounded but currently repeated per scoped request/photo. Validate production latency and cache behavior without allowing cross-market or stale-publication leakage.
- Full checkout/dependencies were not available through sandbox network resolution; this package is a partial source/evidence continuation, not a full repository build.

## External side effects and retry safety
Only the isolated feature branch, draft PR and local files changed. No main merge/deployment, production database changes, seller setting changes, photo uploads, supplier price changes, customer contact, workflow or new infrastructure. No caller-visible success may be represented as a completed call. Original atomic inquiry/replay behavior is retained, not replaced with a second contact endpoint.

## Next exact action
Resolve and inspect the actual staged catalog import/media owner and verified TradeScout seller record, then wire its approved outputs into this catalog reader. In parallel, obtain exact-candidate full application execution for the existing Exchange feed -> detail -> sign-in -> protected inquiry -> seller inbox journey, including native PostgreSQL retries. Complete real price/photo import and full release verification before merging. Missing price approval must not halt independent configuration, media and runtime work, but no price may be published without approval.

## Actions that must NOT be repeated
Do not recreate the catalog identity set, UI helpers, atomic inquiry transaction or migrations; do not repeat unchanged native schema proof. Do not use the older incomplete base-alias wrappers or retry the previously blocked bulk tree request. Do not create workflows/proof services, modify JW portal pricing, broaden Pensacola, or claim Facebook outperformance without observed matched outcomes.
