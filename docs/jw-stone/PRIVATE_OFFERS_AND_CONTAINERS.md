# JW Stone private offers and containers

Status: build lane on `jw-stone/private-offers-containers`
Authority: product-owner request, 2026-08-11
Release boundary: draft PR only; no production migration or merge without explicit GO

## Customer contract

- Every real Current Inventory listing can receive a private offer. First Cut placeholders cannot.
- Containers appear only after JW staff create and publish truthful records. The empty state is intentional.
- The first offer creates a separate **JW Stone Express Account** with name, email, phone, business yes/no, optional business name, password, and offer amount.
- A JW Express Account does not create or authenticate a TradeScout customer account.
- Offers are sealed. A customer sees only their own amount, status, and history—never another bidder, amount, count, or rank.
- A target may have no minimum or one public enforced minimum. There is no hidden reserve.
- Offer acceptance means JW has chosen to continue a private conversation. It is not payment, reservation, title transfer, or a binding sale.

## Container priority

Eligible current container offers are `submitted` or `under_review` offers from non-closed accounts while the container is accepting offers. The server orders them by:

1. amount in cents, descending;
2. current-version submission time, ascending;
3. offer ID, ascending.

Revising an offer creates a new immutable version and a new submission timestamp. The server rejects acceptance of a lower-priority offer while a higher eligible offer remains active.

## Contact and staff contract

Offer submission records intent; it grants no contact access. The operator queue masks email and phone until an authorized JW owner, operations administrator, or super administrator records a separate review/reveal decision. Acceptance does not replace that decision.

Operators use `/admin/jw-stone-offers` to manage published containers, optional minimums, offer intake, masked review, contact decisions, statuses, event history, and email delivery retries. General staff access is not sufficient.

The exact JW profile owner can enter that same URL through a JW-specific server authorization check without receiving access to the broader Admin OS. Operations and super administrators keep the normal Admin OS route.

## Identity and delivery

JW Express uses separate account/session/token tables, host-only cookies, database-backed verification and recovery, and no foreign key to TradeScout `users`. Platform and custom-domain hosts share credentials but not cookies.

Account and offer transactions persist before email delivery. A durable outbox retries verification, recovery, confirmation, staff alert, and status messages without rolling back the underlying action when a provider is unavailable.

## Release proof

Required evidence includes empty/upgrade migration, identity separation, CSRF/cookie/rate-limit behavior, requester isolation, idempotency and races, minimum and priority enforcement, contact masking/reveal audit, email retry, public leakage scans, desktop/mobile customer and operator journeys, current JW/Direct Connect regressions, and the exact-commit minimum release gate.
