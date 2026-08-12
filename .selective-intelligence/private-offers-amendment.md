# JW Stone Private Offers and Containers Amendment

Authority: product-owner request received 2026-08-11  
Checkpoint: 2026-08-12T01:23:04Z  
Base revision: `29f9bdd8d0b012220b966f719b54f4a61df31e78`  
Release: `jw-stone-private-offers-r1` / `2.0.0`

This amendment supersedes every earlier statement that JW Stone introduces no database, authentication, API, or private price data. It does not replace the existing marketplace, catalog, wishlist, or Direct Connect behavior. The user-requested offer lane is additive and remains isolated from TradeScout customer identity.

## Outcome and complete loop

A visitor can select any real Current Inventory listing or published container, choose **Make An Offer**, create or sign into a JW Stone Express Account, submit a private USD offer, and later revise or withdraw it. JW operators receive a durable private queue, review offers without exposing bidder competition, deliberately reveal contact after a recorded decision, and process container opportunities in descending offer-price order. Offer acceptance means JW has chosen to continue the private commercial conversation; it is not payment, title transfer, reservation, or a binding sale.

## Public experience

- Every canonical Current Inventory listing is offerable, including publicly anonymous listings. Safe public labels are derived server-side; internal anonymous names never leave the server.
- First Cut editorial placeholders are not listings and never receive offer actions.
- Containers appear in a dedicated storefront section. Only operator-created, published records render. An empty state is honest and contains no synthetic inventory, pricing, availability, media, or identifiers.
- `Ask` and `Make An Offer` remain separate intents.
- The first offer form requires legal/display name, email, phone, business yes/no, optional business name when applicable, password, confirmation of password, and offer amount.
- A configured minimum is public and enforced. A target without one says that no minimum is posted. Hidden reserves are forbidden.
- Customers see only their own offer, status, and history. They never see other amounts, identities, counts, rank, relative position, or outbid prompts.

## JW Express identity boundary

- JW Express accounts are stored independently from TradeScout `users`, Passport, `tradescout.sid`, work-request ownership, and TradeScout account-completion messaging. The same email may exist independently in both systems.
- Passwords use the repository bcrypt helper with production cost 12 and a 10-to-72 UTF-8-byte policy. Raw passwords, raw session tokens, and raw verification/reset tokens are never stored.
- Each host uses its own `__Host-jw-express.sid` cookie: Secure in production, HttpOnly, Path `/`, SameSite Lax, no Domain. The platform and verified custom domain share account credentials but not cookies; a user signs in separately on each host.
- Authenticated mutations require the session CSRF token plus same-origin JSON checks. Registration, login, verification, and reset use strict same-origin/Fetch-Metadata checks, generic account-discovery-safe responses, rate limits, and durable one-use tokens.
- The first account-and-offer form may capture one `pending_verification` offer version, but it is not active or visible to operators. Email verification transactionally promotes that current version to `submitted`. An unverified account may complete verification, sign out, reset its password, or withdraw its pending offer; it cannot submit or revise another offer or receive an acceptance decision.
- Reset revokes all sessions. Account closure transactionally nulls or irreversibly replaces name, normalized email, phone, business name, password hash, active sessions, and unconsumed tokens; withdraws active or pending offers; and leaves retained offer/events linked only by a non-reversible closure-specific pseudonym with no recoverable direct identifier under the existing backup lifecycle.

## Private-offer rules

- Amounts are positive integer cents in USD. Public and requester APIs serialize display strings and never use floating-point money.
- A requester has one current active offer per target. A revision creates a new immutable version with `submitted_at` equal to the revision commit time and supersedes the prior version; sent terms are never overwritten. Priority always uses the current version's timestamp, so a revision re-enters ordering at its new amount and timestamp.
- States are `pending_verification`, `submitted`, `under_review`, `accepted`, `declined`, `withdrawn`, and `expired`. Terminal changes and race-sensitive revisions use row locking or version-checked conditional updates.
- Every mutation is idempotent by JW account, operation, target, key, and request hash. Same-key/same-payload replays; same-key/different-payload returns conflict.
- Submission succeeds independently of email. A transactional JW email outbox records confirmation, verification, recovery, staff alert, and status notification work in the same database transaction. A durable authorized worker atomically claims due rows after commit with `FOR UPDATE SKIP LOCKED`, records each attempt, and retries after 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours before terminal `failed`. An authorized operator may create a new retry attempt without changing the account or offer transaction. Delivery attempts and redacted failure summaries are visible only to authorized operators.
- For containers, eligible active offers are exactly current versions in `submitted` or `under_review` state, for an accepting-offers container, whose account is not closed. `pending_verification`, `accepted`, `declined`, `withdrawn`, and `expired` versions are ineligible. Eligible offers are ordered `amount_cents DESC, submitted_at ASC, id ASC`. Acceptance locks the container and current offers and rejects selection of a lower eligible offer while a higher-priority offer remains active.
- For stone listings, optional minimum and accepting-offers state are server-owned settings keyed by canonical inventory ID. Default behavior is accepting offers with no posted minimum unless an operator explicitly closes the target.

## Intent, decision, and contact

Submitting an offer records customer intent; it does not grant contact access. Staff queue rows expose masked email and phone. Full contact is returned only after an authorized operator performs a distinct `review/reveal contact` action, which appends an immutable event naming the acting TradeScout staff principal. This staff-side principal does not turn the JW customer into a TradeScout user. Accepting an offer does not bypass this gate.

## Operator surface and authority

The dedicated `/admin/jw-stone-offers` tool permits the exact JW profile owner and narrowly authorized `superadmin`/operations principals to:

- create, edit, publish, close, and award real containers;
- set or remove public minimums and close/reopen stone offer intake;
- list private offers with masked contact and deterministic priority;
- record review, reveal contact, accept, decline, and notification retry actions;
- inspect an immutable event history and truthful email-delivery state.

General staff access is forbidden. No public endpoint returns the operator queue, contact data, private amounts, ranks, event actors, account existence, or delivery diagnostics.

## Data and API ownership

New JW-owned tables cover express accounts, sessions, account tokens, container listings, stone offer settings, immutable private-offer versions, offer events, idempotency receipts, and a transactional email outbox. None has a foreign key to TradeScout `users`; only immutable staff audit fields may record the acting platform principal.

The public API exposes published containers and offer target policy. The JW session API exposes only the current account and its own offers. Mutations create/sign in/verify/reset/close the account and submit/revise/withdraw offers. The operator API is separately authorized and never reused by the public client.

## Explicitly unchanged

- Existing JW routes, catalog ordering, truth rules, local wishlist, custom-domain rendering, metadata, saved-stone behavior, and Direct Connect remain.
- No public asking prices, submitted offers, private ranks, invented availability, payment, deposit, checkout, bid-against-others auction, automatic contact, DNS change, or new external provider is introduced.
- Merge to `main`, production database migration, and deployment require a later explicit release GO.

## Proof contract

Evidence must cover migration from an empty database and upgrade from 0113; schema isolation from `users`; duplicate signup and token races; cookie/CSRF/rate-limit behavior; cross-account 404 isolation; idempotent submit/revise/withdraw; minimum enforcement; deterministic container priority and lower-rank acceptance rejection; contact masking/reveal audit; email outbox persistence/retry; public leakage scans; desktop/mobile stone and container journeys on both route forms; existing JW and Direct Connect regressions; typecheck/build; and `npm run gate:minimum-release` against the exact commit.
