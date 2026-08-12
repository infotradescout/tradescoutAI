# API and Integration Contract

## Amendment 2.0.0 API boundary

The lane introduces separate public target-policy/container reads, JW Express identity/session mutations, requester-owned offer mutations, and restricted operator APIs. Authenticated mutations require a JW session CSRF token and same-origin JSON checks. All offer mutations are idempotent and transactional with immutable events and outbox work. The operator API returns masked contact until an explicit audited reveal. Existing Direct Connect stays separate and unchanged. No new external provider or key is introduced. See `private-offers-amendment.md`.

## Interfaces, schemas, consumers, auth, errors, and versioning

Discovery uses checked-in client data and requires no new API. The only mutation path is the existing Direct Connect flow, opened after an explicit inquiry action. The marketplace supplies safe public context through optional backward-compatible props: a stable eligible item ID and safe public label for a single stone, or a bounded selection of eligible named stones for a wishlist request if the existing payload supports that context.

Anonymous presentations never supply their internal display name. Existing Direct Connect authentication, validation, endpoint shape, and non-JW callers remain canonical. The wishlist envelope is independently versioned as browser-local state and is not sent until the visitor deliberately starts a request.

## Idempotency, ordering, retries, timeouts, backpressure, and degradation

Opening Direct Connect does not send a message. Submission idempotency, network retry, timeout, and error feedback remain owned by the existing Direct Connect implementation. Marketplace code must not retry or duplicate an inquiry outside that contract.

Selection context is deduplicated, order-stable, and bounded before it reaches the panel. If safe context cannot be formed, the panel may open without stone labels; discovery and the wishlist remain usable. Storage errors degrade to current-session state without network fallback.

## External capability, cost, policy, freshness, and exit path

No new third-party service, API key, variable cost, tracking claim, or external policy dependency is introduced. The feature reuses TradeScout's current Direct Connect capability under its existing privacy policy and operational ownership.

If the optional marketplace handoff extension is removed, the standalone route can fall back to a generic deliberate Direct Connect opening without losing discovery or local wishlist behavior. If Direct Connect is unavailable, the marketplace remains read-only and never substitutes public phone or email contact details.
