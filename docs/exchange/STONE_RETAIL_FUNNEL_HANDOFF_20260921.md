# TradeScout stone retail continuation — atomic inquiries integrated, not deployed

## Objective
More actual connected buyer calls and distinct interested buyers than matched Facebook Marketplace offers. TradeScout owns the listings and customer relationship; JW remains the separate supplier. Public retail prices have no fabricator-membership lock. Exclude Pensacola, Florida city only, not a county, radius, surrounding cities or all Florida. Do not infer approval of reference prices from continuation requests.

## Base and current source
Repository: infotradescout/tradescoutAI
Branch: exchange/tradescout-stone-retail-20260921
PR: 690, draft and unmerged.
This slice resumed from 6763059af73548f4274bced855b72719323395af, after the prior actual screen integration at 484d40ebfb6d881691e98e7115cf1775eaf9dea6.
Current tested implementation/test commit: 15381216e1e409b981c2e0b4a91f08504a476d69.
This checkpoint is a documentation-only successor; no runtime changes follow the tested source in this update.
Original main base remains f22ddff023d24d5ca1938714619f942819afc5ce. Do not force-reset or merge without the release contract.

## Verified completed work
The existing server/routes.ts inquiry handler (around lines 17523–17728 at the base) saved an inquiry before a best-effort seller conversation/message and separately completed the Decision Card. A message failure could therefore still return success. This new stone-only adapter is registered through public-metadata, after setupAuth and effective-account binding and before that legacy handler. Ordinary listings fall through unchanged; no giant routes.ts replacement or base-module copies were introduced.

One connection and transaction now own the inquiry, protected seller conversation/message, durable in-app notification, Decision Card completion, saved-inquiry evidence, and replay receipt. A failed write rolls the whole unit back. Explicit browser request UUIDs survive lost responses/reloads; same-key changed content is a conflict. Legacy clients without durable browser storage coalesce exact same buyer/listing/seller/message/intent requests for 30 minutes. New explicit identities can represent deliberate new inquiries. Replaying returns only the authenticated buyer's previously saved receipt, not new contact authority or a current inventory promise.

The actual ExchangeListingDetail screen uses the new retry client for TradeScout retail stone. It retains the exact actor/listing/message/intent, does not treat Decision Card creation as successful delivery, and accepts success only with a saved inquiry and conversation receipt. The existing draft preparation/sign-in behavior and ordinary listing flow remain.

Measurement is written from saved inquiry evidence on that transaction, with a stable HMAC buyer key and server-held first acquisition. Callback requests remain callback requests, never completed calls. Client-supplied buyer, acquisition and production flags do not establish measurement authority. Missing first-touch evidence stays unattributed. Raw inquiry text, contact fields and supplier economics do not enter the funnel record.

The adapter requires an explicit configured TradeScout seller, current canonical seller exposure, active/unexpired correctly branded listing, positive valid price/unit, and server-held buyer market. Its exact-city guard permits adjacent towns and other US states. This is NOT completion of the national discovery-feed/SEO/geographic layer or a physical-location guarantee. Existing protected contact checks remain.

Seller in-app notification/inbox is durable with the inquiry. Existing push and email notices are supplementary best-effort sends after commit; delivery is not guaranteed by this slice and is not counted as a call. No external notification was sent by this implementation session.

## Exact files and evidence
All seven local tested files were matched to their committed Git blob hashes:

| Path | Bytes | Git blob |
|---|---:|---|
| server/services/exchangeStoneInquiryTransaction.ts | 11908 | 1ed9fa47a203e7fad9578886c707a814ad6e8286 |
| server/routes/exchange-stone-inquiries.ts | 11778 | 698a01a0cd1c2b856b52bffc092d11247b4343df |
| scripts/sql/exchange-stone-inquiry.sql | 1033 | aad3564d33386c2289647cea5cfad564e22711f6 |
| client/src/lib/exchangeStoneInquiryRequest.ts | 4535 | 50360eb7f54e25f21a07aa42b30d69d46cd79fb1 |
| server/routes/public-metadata.ts | 3532 | bdab8d472ce0930e350b364be5a62604c93eeede |
| client/src/pages/exchange/ExchangeListingDetail.tsx | 42498 | 2efde4e06d41b2c046801bd95d9e3843bc49309b |
| scripts/exchange-stone-inquiry-transaction.test.mjs | 22648 | 287fdfedcc195ccb311f951f2ef20e4332324dac |

Node 22.16.0 command:
`NODE_PATH=$(npm root -g) node --experimental-strip-types --test scripts/exchange-stone-inquiry-transaction.test.mjs scripts/exchange-stone-inquiry-draft.test.mjs scripts/exchange-stone-funnel-core.test.mjs`
Result: 48 passed, 0 failed, 0 skipped; 27 new cases plus the 21 existing cases.

New cases execute the actual transaction and retry modules, including rollback failures, lost COMMIT acknowledgement, 20 attempted concurrent submissions, same-key conflicts, Decision Card ownership/scope, legacy retries, callback classification and client account changes. HTTP adapter tests use explicit dependency fixtures; source fields and exact-city logic are checked. SQLite provides real commit/rollback/uniqueness through a translation adapter; PostgreSQL advisory/row locks and concurrency are NOT proved by it. The fixture serializes BEGIN and substitutes locks. Do not report these as PostgreSQL or full Express acceptance.

Strict targeted TypeScript check passed for the transaction module and browser request helper (and their imported pure dependencies):
`tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --types node --typeRoots /opt/nvm/versions/node/v22.16.0/lib/node_modules/ts-node/node_modules/@types server/services/exchangeStoneInquiryTransaction.ts client/src/lib/exchangeStoneInquiryRequest.ts`
The explicit typeRoots is this sandbox's global installation path, not an application requirement. Transpilation syntax checks passed on all five changed TypeScript/TSX files. This is not full application typechecking.

Previous 16 offline browser-component scenarios have NOT been rerun for this changed submission path. Earlier UI evidence remains historical, not current end-to-end evidence. Full React/auth/Express/PostgreSQL and production acceptance remain open.

## Changed but unverified / release requirements
- scripts/sql/exchange-stone-funnel.sql and the new inquiry receipt schema are still staged SQL, not registered production migrations. Enroll both in the runtime ledger/required-schema checks through controlled release, with real PostgreSQL validation. No request-time DDL or live database mutation was performed.
- Configure a stable, dedicated STONE_METRICS_SECRET (at least 24 characters) and the verified seller's site_settings value: category general, key exchange_stone_retail_seller_user_id. The adapter refuses absent/ambiguous seller identity. Do not use a supplier account or guess it. Do not derive buyer keys from rotating session secrets.
- Verify the actual authorizeOffer/Drizzle notification adapter against the real schema and seller authority, concurrent processes and lost responses. Retest the actual screen/helper with real API responses and sign-in/session preservation.
- National product discovery, post-auth catalog/media routes, Pensacola-only discovery filtering, source-photo identity, controlled approved-price import and release build remain unfinished. Older archive-only retail integration must not be mistaken for committed code.
- Record connected calls, quote and payment outcomes at their real owners; this slice connects saved inquiries/callback requests only. No matched observed Facebook baseline was read, and no Facebook outperformance is established.
- Catalog state remains 119 staged references, 0 explicit retail-price approvals, 0 new live listings and 0 newly published photos from this work. Reference homeowner prices are not approved Exchange prices.

## Tests invalidated by later changes
None after the final seven-file verification at 15381216e1e409b981c2e0b4a91f08504a476d69. Documentation does not change runtime. Broader application/build, real database and browser evidence must be produced before release; source-level fixtures do not substitute for them.

## Known execution limits
Ordinary repository checkout/download and dependency resolution failed on sandbox DNS; connected GitHub reads/writes worked. No full application build/typecheck, actual PostgreSQL run or npm run gate:minimum-release was executed. Do not merge this draft as production-ready.

## External side effects and retry safety
Only the isolated feature branch, its draft PR and checkpoint changed. No main merge, deployment, live database mutation, media upload, customer contact, supplier-price change, new workflow or proof service. A metadata-copy typo was corrected before the final hash verification. The older blocked bulk tree update was not retried.

## Next exact action
Resume after this actual saved-inquiry integration, not at the older detached helpers. Validate/enroll the staged schema and real transaction/authorization adapter, then advance the remaining catalog discovery/media/import lane and real buyer-path release checks. Existing source/test files and the current screen should be reused, not rewritten. A matching database receipt must prove the actual inquiry route creates one inbox message and one inquiry under concurrent/lost-response retries before release.

## Actions not to repeat
No broad rediscovery, reapplication of older client patches, guessed prices, repeated price-approval questions, county/radius expansion, membership locks on retail prices, fake calls/leads, new GitHub Actions, base-module duplication or unverified production claims. The owner's standard remains calls, distinct buyers and sales, not test volume.
