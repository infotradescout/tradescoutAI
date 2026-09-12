# JW Stone member cart → checked material review → quote request

Baseline: `99e9971cbdf02982b80fa1faa7f18aeb45a17224` on `main`.
Branch: `jw-stone/cart-review-flow-20260912`.
Owner request: continue JW Stone carts, restricted to business memberships with JW Stone; keep existing membership verification policy.

## Outcome

An authorized JW Stone business member can retain a browser cart, choose exact published stock, change slab quantities, obtain a server-checked material subtotal, choose pickup or request delivery to a ZIP, retain a job/PO reference, and deliberately send the selections through the existing private Direct Connect request flow.

## Preserved decisions

- Enforced: pricing and cart review use the exact active JW Stone business membership and existing pricing entitlement. A generic business account, a membership with another supplier, a guest or an internal pricing role is not buyer-cart authority. General pending business verification remains permitted under the existing membership policy. Rejection, suspension and revocation remain blocked.
- Enforced: Google Drive remains the owner's pricing/inventory information authority through the existing adapters. This change does not supply, fabricate, publish, reserve, or alter any production inventory. Missing physical-stock details remain unavailable for a checked total.
- Enforced: browser prices and totals never become pricing authority. Browser storage migrates v1 selections into v2 without cached price fields; each review reloads current pricing and sale-ready physical inventory.
- Enforced: duplicate public stock IDs are combined before availability and quantity-tier checks. Containers, blocks, bundle-count units and fractional physical quantities cannot masquerade as slab counts.
- Enforced: a material review is not checkout readiness, a reservation, a purchase, or a final delivered quote. Delivery cost/date remain null without a fulfillment quote. No Stripe intent or stock decrement is added.
- Enforced: contact remains in the existing intent/decision/request lifecycle. Cart handoff prepopulates editable request details and does not send automatically or reveal a phone number. Customer submission still uses the existing private request, supplier assignment and notification implementation.
- Scope: cart persistence is per member on the same browser, not cross-device synchronization or multiple job carts. Job/PO and fulfillment preferences accompany an actual quote request, which has existing database persistence.

## Checks required before release

1. Exact-head clean checkout and TypeScript.
2. JW marketplace/pricing/cart, stock and profile-account regression suites.
3. Actual built desktop/touch customer journey on a fresh native loopback PostgreSQL cluster: real signup, membership, public stock selection, cart-review HTTP path, quantity tier, duplicate quantities, reload, pickup/delivery data, native quote submit, persisted private request, correct supplier notification, and revoked access.
4. Unmodified strict `gate:minimum-release` with a separate fresh loopback database and real main history.
5. Inspect desktop and touch screenshots and record exact-commit results in the PR. A successful test fixture is not evidence of a real customer order, payment or external email delivery.
6. After the PR release, verify Render's exact commit, health marker, and denied guest private endpoints.

## Roll-forward / rollback

No new production schema, membership policy or payment configuration is introduced. Prefer roll-forward for UI corrections: old code does not read the new v2 draft key after its v1 migration, although v2 selections remain stored. Never roll back by restoring browser prices as checkout authority. Testing writes only to disposable native databases; production inventory and customer records must not be rewritten for proof.

## Evidence

The verification runner writes exact-head results to `test-results/jw-cart-release/evidence.json` and native browser evidence/screenshots below `test-results/jw-workflow/`. At contract creation these checks have not yet been executed on the final candidate. The PR must record actual results and any blocker, not inferred success.
