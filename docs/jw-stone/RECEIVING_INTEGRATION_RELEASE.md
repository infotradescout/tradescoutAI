# JW employee receiving and cart integration

Working branch: `jw-stone/receiving-release-20260913`, integrating receiving PR #655 at `2a9f0bde3aabe89ea7e9872fb1544b07e4ade5ed` into production source `e34f02520c697ee8e52fefcf6ebdd4d06ce6d6c2`.

This is a source candidate. Receiving remains disabled by default. No employee was assigned, no customer inventory was changed, and no Drive receipt or public photo was uploaded during this integration. Publication and activation require the remaining acceptance steps below.

## Required order

1. Preserve the production quote-cart contract and customer selections while integrating receiving.
2. Verify employee assignment/revocation, durable local drafts, exact source receipts, publication rollback, private projections, and cart math.
3. Execute the full application typecheck, build, and affected regressions on the combined candidate. Keep failures explicit.
4. Publish the reviewed candidate to its isolated branch after publication approval, then run native PostgreSQL and supported-browser journeys in an existing isolated proof environment.
5. Obtain JW preview/release acceptance, merge the reviewed release, verify the deployed commit and public paths, and only then enable receiving with the intended private source folder and approved staff identities.

## One cart owner

The existing `JwStoneMemberPricingProvider` and `JwStoneMemberCart` own the customer cart. Receiving and saved-lot controls add exact public stock identifiers to that cart. The separate cart implementation from PR #655 is consolidated into this owner.

The API continues to accept `{lines, fulfillment}` and returns `materialReady`, `inventoryReserved:false`, `readyForCheckout:false`, fulfillment details, and null delivery cost/timing. Duplicate physical stock identifiers are combined before availability and quantity-rate checks. Ready lines add an explicit `priceUnit` so a per-slab receipt cannot be displayed as a square-foot rate. Legacy square-foot responses remain parseable.

Prices for received stock come only from its validated immutable receipt. Missing or invalid receipt prices never fall back to a same-name catalog price. Non-receiving stock uses a freshly checked workbook snapshot. Independent member authorization allows received-stock review during workbook failure. Source timestamps use the original receipt date or workbook source date; missing source dates are explicit nulls. Re-publication does not pretend a receipt price was updated.

The public quote remains a request, with editable job/PO context, selected stock, pickup or delivery ZIP, and the existing private Direct Connect submission. It does not charge, reserve stock, or calculate freight.

Browser carts preserve up to 100 selections and their stock identifiers, with review/request batches of at most 50. Existing raw-array v1/v2 data must remain readable. Mounting, signing out, or changing accounts must never overwrite another account's saved cart. Unreadable data remains untouched; failed writes retain the current in-memory draft with a visible persistence notice. Favorites and carts retain their existing browser/origin scope.

If a storage failure is followed by temporary cart edits, a later successful storage read does not silently replace the previously saved cart. Those edits stay explicitly temporary for that mounted cart session. This also prevents a recovery read from discarding the temporary selection.

## Receiving integrity corrections

- Drive retries compare the actual blob checksum and MIME type as well as receipt identity, folder, and application hash. Stale application properties alone cannot acknowledge edited source content.
- A first local freeze becomes authoritative only after IndexedDB commits. A failed pre-upload save leaves fields, photo removal, and discard usable. Once a network attempt has occurred, retries preserve the frozen receipt and photo bytes.
- Publication remains after durable private receipt and sanitized photo writes. A failed inventory transaction leaves a private pending receipt with the same allocated source IDs for retry.
- Employee grants use the existing direct delegation owner, independently of buyer membership. Revision conflicts and mandatory audit failures roll back the change. Explicit revocation overrides configured employee fallback.

## Evidence and release limits

The integration adds an executed 34-case HTTP/PGlite pricing suite and a five-case actual Stone Core migration/PGlite receiving suite with real image decoding. The latter covers publication, SQL-trigger failure and retry, duplicate lot labels, staff grant/revoke/revision conflicts, and audit rollback. Focused Drive and component-handler regressions exercise unchanged/altered source retries and pre-network storage failures. PGlite is not evidence of native multi-connection PostgreSQL concurrency. Mocked cloud boundaries do not prove production Drive or object-storage write authority.

The final local affected run passed **433 tests across 71 files**, with no skips, using `npm run test:run -- client/src/features/jw-stone server/tests/jw-stone server/tests/stone-inventory server/tests/profile-account --maxWorkers=2`. The combined Node run passed **212 checks**, with no skips, covering the cart/store/saved-lot, receiving, employee, deferred-component, public-verifier and sitemap suites listed in `scripts/verify-jw-cart-release.mjs`. `npm run check` passed. These are executed local candidate checks; they are not native/browser or production acceptance.

Browser scripts or native runners are not passing evidence merely because they exist. The current workspace cannot launch native PostgreSQL or Chromium; those acceptance steps remain open until executed in a supported isolated runtime.

The cart release runner now executes the added Node receiving, media, employee, persistence and production-verifier regressions before its existing native cart journey. It validates the strict gate's exact commit, release mode, passing result, attestable flag, and initial/final clean source state. Its receipt explicitly records `receivingPhonePublicationTested:false`: a successful existing cart proof cannot establish the new employee phone workflow.

| Acceptance boundary | Executed local evidence | Still required |
| --- | --- | --- |
| Employee access | Actual migrated SQL grant/revoke/revision/audit rollback and entry controls | Native concurrent transactions and intended real staff identity |
| Durable receipt and photos | Exact bytes, checksum/MIME/folder validation, pre-upload storage failure and retry regressions | Supported browser IndexedDB/file picker, actual private Drive permissions |
| Inventory publication | Actual migrated SQL publication, injected rollback, retry and duplicate-lot checks | Native application upload-to-publication journey |
| Customer cart | HTTP pricing/stock isolation, exact lot/quantity math and rendered persistence/account tests | Built desktop/touch receiving-to-cart journey and private quote persistence |
| Existing production | Read-only health/version/migration/redirect and matching public asset checks at deployed `e34f0252` | New candidate preview acceptance and post-release exact-version smoke |

GitHub Actions is not a TradeScout release gate. The workflow introduced by the old receiving branch was removed during integration to comply with current repository governance. Use the unchanged `gate:minimum-release` contract, the affected regression suites, and actual native/browser evidence. Never attest a skipped database or browser step as passed.

Real source-folder permissions, supported-phone sign-in→capture→publish→member review, production readiness, and employee activation remain unverified. Stock correction/decrement, cross-device pending-receipt recovery, subsequent Drive-edit reconciliation, payment checkout, and freight calculation remain separate capabilities. This release must not label them complete.

The sign-in journey must include an assigned employee who has no buyer business/account. The existing Fabricator Portal dialog continues buyer-account setup after login, while the receiving dialog opens independently after employee authorization. Their modal/focus handoff has not been executed in this integration. The acceptance journey must demonstrate that the employee can reach receiving without being required to create a buyer business; source review alone does not establish that outcome.
