# Build Contract: JW Stone Private Offers and Containers

Build ID: `jw-stone-private-offers`  
Lock version: `2.0.0`  
Base revision: `29f9bdd8d0b012220b966f719b54f4a61df31e78`  
Branch: `jw-stone/private-offers-containers`

## Owned requirements

`JW-OFFER-ENTRY`, `JW-EXPRESS-IDENTITY`, `JW-PRIVATE-OFFERS`, `JW-CONTAINERS`, `JW-OFFER-PRIORITY`, `JW-OFFER-STAFF`, `JW-OFFER-NOTIFICATIONS`, `JW-OFFER-PRIVACY`, `JW-OFFER-RECOVERY`, and `JW-OFFER-PROTECT`.

## Write scope

- New JW Express schema, migration 0114, API contracts, session/security helpers, offer/store/outbox services, and focused server tests.
- JW marketplace offer actions, Express Account/offer panel, Containers section, account/history surface, and focused client/browser tests.
- Dedicated JW operator API/page registered in the existing Admin OS.
- Existing email-service purpose allowlist and route registration only where necessary.
- SI control artifacts and release evidence for this build.

## Constraints

- No TradeScout customer account, Passport principal, shared customer cookie, `users` foreign key, public private-offer field, hidden minimum, auction leaderboard, payment, auto-contact, First Cut offer action, invented container, or unrelated product change.
- Existing marketplace, profile, catalog, wishlist, Ask/Direct Connect, SSR, sitemap, and custom-domain contracts stay green.
- Offer and account persistence must commit before notification delivery is attempted.
- Any new migration is forward-only and must pass the supported disposable-database path from empty state.
- No merge, production migration, or deployment is authorized.

## Completion evidence

Record exact commands, results, revision, database configuration class, browser routes/viewports, email mode, known baseline failures, unexecuted production proof, independent council verdicts, and draft PR state in `evidence.md`.
