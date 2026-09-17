# JW Stone: base site and optional sales enhancements

## Owner-requested boundary

**Base site only** preserves the paid public website/branding, public catalog/media, account access, contact requests, Direct Connect messages/attachments and existing request history. It is not a profile suspension, tenant deletion or customer-data lockout.

**Sales enhancements on** permits the additional JW tools, subject to their existing membership, ownership and payment controls. The master key is `jw_stone_sales_enhancements`. No feature flag grants membership, employee authority, contact permission or payment authorization.

The feature set covers JW builders/visualization, BidRock, private pricing/cart, bundles, offers/commercial quoting, and additional inventory/sales tools. The incomplete integration boundaries below prevent declaring this a finished all-feature switch.

## Implemented controls (enforced in the candidate's code)

The authenticated TradeScout super-administrator page is `/admin/jw-stone-features`. It submits an explicit mode, revision, operation identity, private reason and a required base-service-preservation acknowledgment. The JSON endpoint is `/api/admin/jw-stone/features`; the public availability-only manifest is `/api/u/jw-stone/features`.

Only the dedicated control changes the protected row. Generic flag mutations/deletions are blocked for this key/id, including encoded IDs. The existing role-bound middleware and same-origin check protect writes. The flag's configuration records append-only-at-the-application-layer receipts in the same transaction as the setting, under a PostgreSQL advisory/row lock. No new migration or runtime DDL is introduced.

Missing configuration preserves current availability without creating a row. Malformed/unavailable persisted state fails closed for guarded add-ons, not for base services. The UI starts with no feature grant, refreshes from the server, does not store an entitlement in localStorage, and polls every 15 seconds. Server admission checks do not wait for that UI poll. An operation admitted before a change may finish; this is not destructive process cancellation.

The middleware is registered by the existing member-pricing route registrar after authenticated authority binding and before downstream add-on routes. Covered rules include JW pricing/cart review, `make_offer` intake (not ordinary requests), new commercial actions/payment-handoff paths, direct JW inventory writes, JW builder namespaces, saved-stone email and the currently JW-default BidRock API. Readable existing commercial/order records and named release/cancellation/settlement/fulfillment paths retain their original authorization.

The member-pricing provider suppresses prices/cart access when unavailable and retains stored carts. The card/detail View in room link is hidden by the same manifest. The base catalog, account dialog and Direct Connect UI are not wrapped in a blocking screen. Customer responses do not disclose the private reason or payment-dispute language.

## Coverage and release gates (policy_target, not yet proven)

Complete genuine route/job coverage before release, rather than assuming a declared feature key gates every implementation. In particular, shared Steel Home planners are independent platform tools: disable JW handoffs/operations using canonical ownership without shutting down another business's builders. Do not rely on request-supplied tenant labels or on hiding navigation.

Reconcile PR #683 and local commercial commit `001194f4`, hold work #674, and separate employee receiving work. Test alternate API paths, existing open tabs, custom domains, already-saved projects, drafts, cancellation/expiry and real supplier/buyer workflows. Do not suppress reconciliation of already-paid orders or settled payment events. Background premium jobs need their own admission checks; this HTTP layer does not claim to cover them.

Require native PostgreSQL plus real built-app browser tests: super-admin can change the setting; JW business owners/employees/customers cannot; base site/contact/DC work with add-ons off; new premium operations are blocked; re-enabling restores access without deleting saved data or charging anyone. Run full type/build and the exact-candidate strict release gate. Until then the candidate remains a draft, not an operational nonpayment control.

## Verification performed

52 Node tests passed against the isolated policy/store/gateway/page subset, including a simulated transaction lock, not native PostgreSQL. Strict TypeScript compilation covered those dependency-free modules only. No production setting, deployment, customer contact, inventory or payment was changed. See the resumable checkpoint under `.selective-intelligence/builds/jw-stone-feature-control-20260917.md`.
