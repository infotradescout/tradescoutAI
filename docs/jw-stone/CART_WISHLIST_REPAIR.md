# JW Stone cart and wishlist repair — September 12, 2026

Historical branch record. The September 13 integration supersedes its cart contract, storage migration, and release instructions: see [Receiving integration release](RECEIVING_INTEGRATION_RELEASE.md). In particular, production fulfillment support and selected stock IDs are preserved, duplicate stock requests are combined, and the active workflow does not use GitHub Actions.

Implementation continuation on `jw-stone/ops-employee-receiving-mvp`, PR #655. Not a live release. No payments, reservations, emails, employee assignments, or production inventory changes were performed during development.

## Cart behavior

The existing material-price display now delegates to one JW Stone cart. Cart access is checked by an authenticated endpoint independently of the catalog workbook; ordinary signed-in accounts and staff authority alone do not grant buyer membership. The existing JW Stone membership resolver remains authoritative.

An arrival card adds the exact physical lot identifier. Catalog cards add a clearly labeled catalog selection requiring a real lot before a priced order. Existing legacy cart entries are interpreted as catalog selections, never physical stock. The current cart is bounded to 50 selections and 999 requested slabs per selection. Browser persistence stores account-scoped identifiers, names, kinds, and quantities, not stale price estimates or internal costs. Legacy carts exceeding the current 50-selection limit are not fully migrated; review that limit before deploying to accounts with larger saved carts.

Opening a cart reviews its lot IDs and quantities against server inventory. The backend reads the exact JW Stone business's positions in one query, rejects duplicate request IDs, verifies publication and freshness, and subtracts held quantities. It uses a receiving lot's own saved receipt price or the current catalog price for non-receiving stock. Invalid receipt pricing never falls back to a same-name catalog rate. A workbook outage does not block received lots with valid receipt pricing.

Rates explicitly distinguish dollars per slab from dollars per square foot. Bundle thresholds apply to the requested quantity for that individual lot. Missing units/dimensions, unsupported physical units, unavailable lots, or unpriced lines prevent a complete subtotal. Client-side stale prices are not substituted. A review is a point-in-time read, not a hold or transaction: `readyForRequest` can be true, but `readyForCheckout` and `reservationCreated` remain false.

The cart uses the shared Sheet primitive, explicitly receives JW Stone brand variables, and provides quantity, removal, clear, retry, and continue-shopping controls. A customer can open an editable JW Stone request containing lot identifiers and requested quantities. Opening that form sends nothing and does not clear the cart. Payment checkout, delivery estimates, and reservation creation are not implemented.

Cart state remounts per authenticated viewer. Browser storage events including full storage clears refresh the displayed state. Sequential changes in separate tabs read the latest persisted value; this is not an atomic conflict-resolution protocol for simultaneous multi-tab edits. Storage failures preserve in-memory edits and show that they are not saved. There is no account-backed, cross-device, or cross-origin cart sync.

## Wishlist behavior

Saved stones remain the existing named-catalog, browser-local wishlist. This patch does not add individual receiving-lot favorites or account-backed wishlist storage.

Mutations are centralized outside React state updater callbacks. Shared subscribers keep controls in the same browser page consistent; other-tab storage events, including `key = null`, refresh the list. Capacity and persistence failures are visible. Clear commits an authoritative empty current-version record before attempting legacy cleanup, preventing old selections from returning after a partial cleanup failure. Malformed current records do not revive the old legacy record.

The panel distinguishes loading from an empty list, fits narrow screens with bounded scrolling, and explains that bookmarks do not reserve stock. Email uses the configured API helper, credentials, a timeout, a real honeypot value, and a synchronous pending guard. Closing the panel or changing account/selection aborts stale response handling. Only a server response with `sent: true` produces a sent confirmation. This is not server-side email idempotency: an ambiguous network failure can still require the user to check their inbox before retrying. No actual email was sent in this continuation.

## Verification performed

Node 22.16.0:

```sh
node --experimental-strip-types --experimental-vm-modules --test scripts/jw-stone-cart-wishlist.test.mjs
```

47 tests passed; zero failures, cancellations, or skips. Tests load the actual shared cart, cart store, wishlist/store, price route, and cart service. They cover monetary units, thresholds, reserved quantities, missing inventory, duplicate IDs, private projections, storage isolation, legacy clearing, storage failure behavior, membership rejection, receipt-price lookup, and workbook outages. Database, authentication integration, receipt parsing/freshness integration in service fixtures, and external storage dependencies are mocked where the test harness supplies them. These are not a live system test or a React/browser interaction proof.

Strict TypeScript checking passed for `shared/jwStoneCart.ts` and `jwStoneCartStore.ts`. Eleven local implementation TS/TSX modules passed syntax transpilation. Six updated implementation-file blob hashes were checked against GitHub's returned blob SHAs and matched. Neither the limited strict check nor transpilation is a full project typecheck.

The existing HTTP regression suite was updated to use PGlite physical-stock tables, current publication/freshness fields, held-quantity cases, duplicate-line rejection, and request-versus-checkout semantics. Price rendering tests now isolate the independently queried cart permission component. Those application suites were committed but were not executed locally because the full application's dependencies were unavailable. The GitHub workflow includes a dependency-free cart/wishlist contract job as well as the pre-existing application and receiving-browser jobs; workflow existence is not a passing result.

## Still required before release

Run all existing JW regressions and the full typecheck/build, resolve any failing contract/fixture expectations, and prove signed-in cart behavior in a real browser on supported JW Stone domains. Exercise member revocation, account switching, storage failures, quantity changes during an in-flight review, exact lot/quantity transfer into a request, saved-stone email, and mobile panel scrolling. Confirm production Drive/media write access and the employee receiving journey separately. Preserve the JW branch's required preview and release approval.

The earlier employee-receiving scope still has unfinished correction/decrement controls, server-draft repair, and automatic reconciliation of subsequent Drive changes. This cart/wishlist continuation does not enable receiving, deploy the branch, reserve physical stock, or finish payment checkout.
