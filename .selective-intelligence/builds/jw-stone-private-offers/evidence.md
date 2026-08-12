# Build Evidence: JW Stone Private Offers and Containers

Status: implementation and independent as-built review complete; exact-commit release gate in progress  
Revision under test: uncommitted working tree based on `29f9bdd8d0b012220b966f719b54f4a61df31e78`  
Environment: isolated clean-base worktree at `D:/AAATraderCorner/TradeScout/_wt/jwo-20260811`

## Definition evidence

- Product checkpoint locked at 2026-08-12T01:23:04Z.
- Authorized amendment `AMEND-JW-PRIVATE-OFFERS` was sealed before application edits.
- Repository base verified as `29f9bdd8d0b012220b966f719b54f4a61df31e78` on `jw-stone/private-offers-containers` tracking `origin/main`.
- Read-only storefront, operations, identity, email, and security reconnaissance completed before definition lock.
- Independent high-assurance definition review: PASS after five medium ambiguities were corrected; see `definition-review.md`.
- `start_pack.py validate --root .`: PASS with zero validation errors after implementation.

## Implemented behavior

- Every one of the 110 Current Inventory stone cards exposes Make An Offer; First Cut story items remain editorial and expose no offer control.
- Containers is a real server-backed section. With no published container records it renders an explicit unavailable/empty state instead of fabricated inventory.
- JW Express uses its own identities, password hashes, verification/reset tokens, sessions, and cookie. It does not grant or require a TradeScout account.
- First-time submission collects legal name, email, phone, business yes/no, conditional business name, password confirmation, and the offer in one flow.
- An initial offer remains `pending_verification` and is excluded from operator eligibility until the one-use email verification succeeds.
- Private offers expose no public bid count, rank, competing amount, or identity. Optional public minimums are enforced without a hidden reserve.
- Eligible container offers sort by amount descending, current-version submission time ascending, and ID ascending. A revision re-enters at its new submission time.
- Deterministically ordered target-level advisory locking serializes verification activation, submissions, revisions, withdrawals, account closure, minimum changes, container state changes, and operator decisions before account/offer row locks. The server rejects accepting a lower eligible container offer while a higher eligible offer remains.
- Operator contact is masked by default. Reveal is an explicit audited action; accepting an offer does not reveal contact and records only a decision to continue a private conversation.
- Express account closure destroys direct identity and token/session data, removes direct identifiers from all related outbox/attempt state, and preserves only pseudonymous offer/audit facts. Claimed outbox rows are fenced through provider submission, so closure either cancels before delivery starts or waits for the in-flight result before erasure completes.
- The durable email outbox uses the fixed schedule: immediate attempt, then 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours before terminal failure. Provider-skipped sends count as failures, not success.
- The exact JW owner/operator route is separately authorized and does not expose the broader Admin OS to an owner who lacks general admin access.
- No payment, reservation, title transfer, auction, or binding-sale path was added.

## Database evidence

- Disposable PostgreSQL 16 container: `tradescout-jwo-private-offers-20260811`, label `tradescout.scope=jw-private-offers-test`, bound only to `127.0.0.1:55432`.
- Upgrade proof: 117 journal-ordered migrations through 0113 were applied to a fresh database, which contained zero of the 11 private-offer tables. Migration 0114 then applied cleanly, created all 11 isolated tables with the narrowed five-purpose email constraint, and the 12-test integration suite passed against that upgraded database.
- Empty-chain proof: a database initially containing zero public tables accepted the full migration chain; required-schema verification passed with ledger count 118, final timestamp `1786499941732`, all 11 JW Express tables, and the narrowed five-purpose email constraint.
- Integration tests use `TEST_DATABASE_URL`; `DATABASE_URL` is deliberately blank and the background outbox worker is disabled so tests cannot fall through to another database or race a worker.

## Automated evidence

- `npm ci`: PASS; 1,333 packages installed. Baseline audit output reported 49 existing dependency findings (3 low, 22 moderate, 21 high, 3 critical); no dependency or audit-fix change is included in this lane.
- `npm run check`: PASS after the final identity, concurrency, outbox-fencing, and operator-authorization hardening.
- Latest focused storefront, Express account, operator, schema, discovery/SSR, email, and disposable-database run: 25 files and 174 tests PASS. The 12-test integration suite also passed independently against both full-chain and 0113-upgrade databases.
- Integration coverage includes pending-verification event/queue invisibility, one-use verification, deterministic login replay/conflict, negative operator authorization and CSRF, cross-account denial, duplicate-signup serialization, verification-token races, submit idempotency, amount/time ordering, concurrent high/low acceptance, verification/late-submit/container-award safety, closure/acceptance serialization, closure replay and complete PII erasure scans, in-flight email fencing, stale-claim scheduling, exact retry exhaustion, and provider-accepted send recording.
- `npm run build`: PASS; Vite transformed 4,024 modules, public startup/bundle checks passed, 548 JavaScript bundles and 13 HTML asset references were verified, and the server bundle completed.
- `git diff --check`: PASS. Locked Selective Intelligence artifacts retain their byte-preserving and whitespace-check-safe `.gitattributes` treatment.
- Scoped wording scans found no auction/outbid/public-rank claims in the customer or operator implementation; references to payment appear only in explicit no-payment/non-binding disclaimers.

## Browser evidence

- Ran the isolated worktree server on port 5003 and verified its process command line before testing. An unrelated pre-existing server on port 5002 belonged to another worktree and was left untouched.
- `/api/jw-stone/containers` returned HTTP 200 with `{"containers":[]}` and the storefront rendered the truthful Containers empty state.
- On `/jw-stone`, Full Inventory rendered 110 articles and 110 Make An Offer actions; First Cut rendered zero offer actions.
- Repeated the storefront journey through a local host-rewriting proxy for the verified custom-domain form (`jwstonelogistics.com` routed only to the isolated server). It rendered the Containers empty state and Offers action; expanding Full Inventory produced 110 articles and 110 Make An Offer actions, with zero First Cut offer actions.
- Verified the Offers header action, required Express signup fields, conditional business-name field, pending-verification state, account view, and private offer history.
- Created a synthetic disposable-browser account and confirmed in PostgreSQL that the account was active/unverified, its first offer was `pending_verification`, the amount was stored in cents, and the verification outbox row had zero attempts before a worker run.
- Checked desktop and 390x844 mobile layouts. The new dialog had no horizontal overflow, the corrected title color computed to `rgb(23, 23, 23)`, and no browser errors or runtime overlay appeared.
- Both isolated browser server/process trees and the temporary host-rewriting proxy were stopped after proof; ports 5003 and 5004 had no remaining listeners.

## Email truth

- Provider-accepted mode is verified with a mocked accepted provider response and stored provider message ID. An in-flight provider call is row-fenced so irreversible closure cannot complete before delivery state is known and scrubbed.
- Provider-unconfigured mode is verified to remain unsent, retry exactly six times on the fixed schedule, and end in terminal failure.
- Real production-provider delivery is not verified in this worktree. No live customer email was sent and no production delivery claim is made.
- Account closure returns an immediate in-product receipt and does not send a separate closure email; this avoids retaining or fire-and-forgetting a direct identifier after irreversible erasure.

## Independent review and release state

- Definition Objector: PASS; see `definition-review.md`.
- As-built Objector: initial FAIL identified four actionable gaps; all were corrected. Independent re-review: PASS with no remaining P0/P1/P2 findings.
- Aligner: ALIGNED; no requirement conflicts found. Exact-commit gate, live provider delivery, and production release remain explicit held proof states.
- Verifier: VERIFIED FOR HELD DRAFT; no remaining P0/P1/P2 issue found. Exact-commit gate, live provider delivery, production migration/deployment, and merge remain held.
- Exact-commit `gate:minimum-release`: pending the final review corrections and commit.
- Draft pull request: pending exact-commit gate.
- No merge to `main`, production migration, deployment, provider reconfiguration, or production data mutation has occurred. Release remains blocked until explicit owner authorization.
