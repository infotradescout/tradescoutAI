# Stone retail funnel continuation — not deployed

Objective: More connected buyer calls and distinct interested buyers than matched Facebook Marketplace offers. Preserve TradeScout seller identity, public retail pricing, existing contact authority, and Pensacola city-only exclusion. No county/radius or fabricator-viewing exclusion.

Base branch/commit: exchange/tradescout-stone-retail-20260921 at b5db3045f2b49b7539b42f2a1a864e08ff30a837; original main f22ddff023d24d5ca1938714619f942819afc5ce.
Current code commit: 577c487b64338140fd0e7a8d036e3ae34f485b63 on that branch. This checkpoint is a documentation-only successor.

## Verified completed work

Six added files are committed and their remote Git blob hashes match the locally tested files:

- shared/exchangeStoneBuyerFlow.ts — f1b9477ebdce04c737f65c3801486dcdbf5f03bc
- server/services/exchangeStoneFunnel.ts — 9aea1eb0809555a90873b213f392fe81028f86c1
- server/publicExchangeStoneHtml.ts — b39a87c23fc06957fe73ce1510d4998a7ffb3f51
- server/services/exchangeStoneFunnelStore.ts — ba5c8373cad57b676ae17cc379c632c38886cffc
- scripts/exchange-stone-funnel-core.test.mjs — 9176a59525a4ce091d5737c303b51d8d52447954
- scripts/sql/exchange-stone-funnel.sql — 8c4e2216a89ac2ed0ae3e2d76b9dc4a07f33cfd3

Implemented primitives: canonical product-specific availability/callback links; explicit cents and per-sq-ft/per-slab units; preserved initial acquisition including Facebook; source/medium ambiguity; distinct buyers; evidence-based inquiries, callbacks, connected calls, quotes and settled orders; retry deduplication/conflict refusal; matched comparison windows, offers/prices/terms, geography and promotion type.

A browser click cannot establish a completed call or paid order. Missing Facebook coverage is not zero. Provider and operator confirmation of the same call share an evidence identity.

The renderer has conditional launch indexability, visible-item-only structured data, mobile layouts, and a collapsed location selector for eligible product browsing. Generic content remains visible without leaking product data to unknown/excluded audiences. This does NOT establish that all product pages are search-crawlable.

## Changed but unverified integration

The accompanying TradeScout_Stone_Funnel_Continuation_20260921.zip preserves the 24-file local changeset, source-pinned integration script, full checkpoint and execution receipt. It is not a standalone repository.

Local-only work updates the prior retail routes to use the renderer and session acquisition, removes the pre-auth handler registration, and stages post-auth registration through public-metadata. The client patch stages exact visible/share pricing, no invented shipping promise, inquiry draft preparation and sign-in continuation. Existing Decision Card/inquiry submission authority is unchanged.

The new store/schema are NOT wired to current inquiry/call/quote/payment transactions and the schema is NOT an automatic migration. No live metrics or Facebook baseline were read. The old candidate's base-alias files are still absent from the archive; prefer narrow integration rather than unnecessary base-module duplication.

## Tests/evidence already run

- Node 22.16.0: `NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-funnel-core.test.mjs` — 11 passing, 0 failures on the committed modules.
- Combined local candidate: `NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-retail.test.mjs scripts/exchange-stone-funnel.test.mjs` — 96 passing, 0 failures. Native HTTP handlers use explicit auth/data/media fixtures; SQL semantics use disposable SQLite. Not full Express/PostgreSQL acceptance.
- Strict targeted TypeScript check of four new modules passed.
- Chromium authored-HTML fixtures at 390x844 and 1440x1000: no horizontal overflow, exact price labels, canonical callback links and minimum 44px tap targets. Screenshots are explicitly labeled synthetic local data.
- Integration-script syntax, anchor and changed-source-refusal checks passed against fragments. The complete client patch was not applied or built.

Tests invalidated by later changes: none after final local validation. Documentation-only commits do not change the six verified blobs. Runtime integration requires retesting.

## Known blockers/risks

Full checkout/dependencies were unavailable in this sandbox: ordinary git clone failed on DNS; connected GitHub reads/writes work. No full application gate/build was executed.

Catalog: 119 staged references, 0 approved retail prices, 0 new live listings, 0 new published photos. A continuation instruction is not approval of the homeowner reference prices.

Product-level crawlability, exact seller/photo identities, actual contact flow, current transaction hooks and a matched observed Facebook baseline remain unaccepted. Location uses an account or selected city/state, not a physical IP/residence guarantee.

## External side effects and retry safety

Only new source/test/schema files on the isolated branch. No main merge, deployment, database mutation, object-store upload, customer contact or supplier-price change. No new workflow/proof service. The prior blocked bulk source-tree request was not retried.

## Next exact action

Resume this code and local candidate, not repository rediscovery. Reconcile the source-pinned client patch against blob 781d3a43f3d3f638e2cb6114c09427c3114e4d21 and public-metadata against 35a282b03d30628c28d9d46aa428549bea8435f0. `registerRoutes` calls public-metadata after setupAuth and effective-account binding; retail handlers must not remain registered before it.

Wire saved outcomes at their existing authoritative transaction owners. Run full application/release and real buyer-path verification. Finish explicit price approval, image verification and controlled import before deployment. Do not replace evidence with click counts or claim Facebook outperformance from test fixtures.

Actions not to repeat: broad audit, guessed prices, geographic broadening, membership locks for public retail prices, fake leads/calls, new GitHub Actions, proof-service provisioning, or treating these primitives as a live funnel.
