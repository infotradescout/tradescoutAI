# TradeScout stone retail continuation — actual screen integrated, not deployed

## Objective
More connected buyer calls and distinct interested buyers than matched Facebook Marketplace offers. TradeScout owns the retail listing/customer relationship; supplier pricing and portal remain separate. Retail price visibility does not depend on fabricator membership. Pensacola means Pensacola, FL city only, not county/radius/neighbors. These are release requirements, not a claim that the geographic/import layer is already deployed.

## Base branch/commit
Resumed PR #690 on `exchange/tradescout-stone-retail-20260921` from `9fcd00a436b9fa5b7ed7b24539bbc8fe154b5197`. Original main base: `f22ddff023d24d5ca1938714619f942819afc5ce`.

## Current branch/commit
Code candidate: `484d40ebfb6d881691e98e7115cf1775eaf9dea6` on the same branch. This checkpoint is a documentation-only successor. PR remains draft; no production merge.

## Verified completed work
The previous screen integration is NOW applied to the actual `client/src/pages/exchange/ExchangeListingDetail.tsx`; do not reapply the earlier source-pinned patch. Original screen blob `781d3a43f3d3f638e2cb6114c09427c3114e4d21` was reconstructed and verified before its narrow edits. Ordinary listing, profile/catalog, bundle and existing protected inquiry functionality was retained.

New retail behavior:
- Explicit cents and per-sq-ft/per-slab display/share text. Missing price is unavailable, not zero.
- Availability and callback preparation beside the price; editable review before sign-in. No send occurs when opening/canceling, following an inquiry link, or returning from sign-in.
- Tab-local, 30-minute, listing-bound draft survives sign-in. Signed-account drafts do not transfer to a different account. Denied browser storage preserves the current form and refuses destructive navigation.
- Actual screen still invokes Decision Card then marketplace inquiry, carrying the selected listing and protected authority fields. Retail fixed-price inquiries do not submit an unsolicited proposed price.
- Explicit submission snapshot, immediate same-tick lock and disabled automatic mutation retries. Failed requests retain text. A previous listing/account's late response cannot erase the current draft. Account identity is rechecked before the inquiry after awaiting its Decision Card.
- Anonymous-to-authenticated in-place refresh preserves the edited message, including the denied-storage fallback.
- Mobile title/price stack and metadata wrap. No unverified free/available-shipping promise is added for retail stone.

## Files changed and exact Git blob identities
- `shared/exchangeStoneInquiryDraft.ts`: `382d96ddc8bed4d4e6994fd8c0296cf2feb03258` (3236 bytes)
- `client/src/hooks/useExchangeStoneInquiry.ts`: `bfcf49b99fcbb3c5a17f6a1ff0ddf36039b0543c` (5271 bytes)
- `client/src/pages/exchange/ExchangeListingDetail.tsx`: `efe55eafa2795ec41914b05b943f555d1e5dbf6d` (41809 bytes)
- `scripts/exchange-stone-inquiry-draft.test.mjs`: `fd453dd8a7af071e2fd4b9f48ab252290491ea60` (6159 bytes)
All four locally tested bytes match returned/fetched GitHub blob identities at this code candidate.

## Tests/evidence already run
- `NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-inquiry-draft.test.mjs scripts/exchange-stone-funnel-core.test.mjs`: 21 passed, 0 failed. Ten new draft/screen-contract cases and eleven existing funnel-core cases. Existing database semantics in the latter use disposable SQLite, not production PostgreSQL.
- `tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM shared/exchangeStoneBuyerFlow.ts shared/exchangeStoneInquiryDraft.ts`: passed. Strict check is limited to these shared helpers. Screen/hook transpilation syntax checks also passed; do not call this a full application typecheck.
- Offline Chromium execution of the actual transpiled screen/hook/shared modules with installed React 18.2.0 and ReactDOM: 16 passed, 0 failed. Cases cover mobile/desktop, callback/cancel, authority endpoint order, exact edited sign-in continuation, denied storage, in-place auth refresh, failed request retention, same-tick clicks, listing/account switches and late replies, ordinary listings, supplier catalog routing, and missing prices.
- Browser adapters for routing, query cache, authentication, API responses, storage and UI kit are explicitly synthetic. These are component tests, not full TanStack/Wouter/Radix/backend or live-customer acceptance. Network requests were disabled. Final fixture CSS was regenerated from the final screen and screenshots reviewed.
- Full checkout still unavailable through sandbox DNS. No new workflow, proof service or remote-desktop dependency was introduced.

## Tests/evidence invalidated by later changes
Earlier component counts of 14 cases were superseded by the final 16-case execution. Final 21 Node checks and browser evidence apply to the four blob identities above. This checkpoint adds no runtime change.

## Changed but unverified work and remaining risks
The older local catalog/geographic/media/import candidate is NOT applied by this screen integration. It includes incomplete base-alias integration; do not copy/replace large base modules to finish it. The committed landing renderer remains a component, not a proved published national catalog route.

The existing funnel/store/schema primitives from code commit `577c487b64338140fd0e7a8d036e3ae34f485b63` remain available. They are NOT yet wired to actual saved inquiry/call/quote/settled-payment transaction owners; the staged SQL is not an automatic migration. A callback request is not a connected call. Same-tick UI locking does not establish durable server idempotency after a lost response or across reloads.

No full application build, strict application typecheck, PostgreSQL integration, actual sign-in journey, product-level crawlability, production geographic filtering or `npm run gate:minimum-release` was executed. Do not merge as a finished national sales funnel.

Catalog remains 119 staged material references, 0 explicit retail-price approvals, 0 imported new live listings and 0 newly published photos. A continuation request does not approve the homeowner reference prices. No observed Facebook baseline or real buyer outcome was obtained.

## External side effects and retry safety
Only the isolated feature branch and its checkpoint changed. No main merge/deployment, production DB write, media upload, customer contact, supplier-price change or workflow provisioning. Successful individual file writes are recorded in branch history. The older blocked bulk tree update was not repeated.

## Next exact action
Continue after this integrated screen, not the obsolete client patch. Inspect only the current `POST /api/marketplace/inquiries` transaction and its storage write, then connect durable saved-inquiry/original-source evidence at the actual owner. Cover lost-response reconciliation and genuine callback/quote/payment confirmations without granting contact authority from analytics. Complete post-auth retail route mounting, seller/photo identity, city-only discovery and controlled approved-price import, then execute full application/release and real buyer-path verification.

The downloadable screen-integration package carries exact changed files, the original-screen diff, execution receipt, 21-case TAP output, 16-case offline component runner/results and synthetic screenshots. It is a continuation artifact, not a full repository or production build.

## Actions that must NOT be repeated
Do not restart discovery or reapply the previous client patch. Do not widen Pensacola, lock retail prices to fabricators, guess prices/stock/delivery, count clicks as calls, invent Facebook outcomes, apply incomplete base aliases, add GitHub Actions, provision another proof service or claim this draft is deployed.
