# JW Stone customer reservation actions — 2026-09-19

Objective: Finish the customer-facing JW Stone temporary stock reservation lifecycle on PR #684 without reopening the broader project. Preserve the paid base site, contact, accounts and Direct Connect. JW Stone sales enhancements remain ON unless Thomas explicitly says OFF.

Source branch: `jw-stone/feature-access-control-20260917`
Candidate before the exact-source verifier continuation: `7d033da558bb3613b286c18359c9cd5ac23b5d89`
Current exact source at this checkpoint: `7f9437ae80aaa10176312ee958bdba94c82cebf2`
PR: #684 remains draft. No main merge, production deploy, production flag change, live stock write, payment, customer message or account change was performed in this continuation.

## Implemented on the live branch

- Customer Reserve mutation is mounted through the real member-pricing composition.
- Customer Release mutation is mounted and remains available to the original owner after pricing membership revocation.
- Reserve requires the canonical JW member authority and the JW sales suite to be enabled.
- Reserve and Release mutations require the production same-origin write-intent guard and production PostgreSQL-backed mutation limiter.
- Reserve uses a durable UUID operation identity. The browser reuses one operation ID for the same canonical cart fingerprint across ambiguous retries.
- A lost Reserve response recovers by `/operations/:operationId` before any retry can create another hold.
- Terminal replay/recovery receipts retire the stored browser operation identity so a later valid cart is not poisoned by a released/expired operation.
- A stale/cross-tab `active_hold_exists` rejection immediately refreshes the owner-scoped `/active` recovery state and disables a second Reserve.
- Successful/recovered holds populate the shared price-free owner-status cache and invalidate stock/review projections.
- The confirmed active-hold cache survives cart close/reopen long enough to block a duplicate Reserve without waiting for another network poll.
- Release uses an explicit two-step confirmation and no payment authority.
- A lost Release response immediately refetches owner status; if no active hold remains, the UI reconciles and stock/review projections refresh.
- The owner reservation panel displays identity, quantities, immutable expiration, live monotonic countdown, refresh and Release controls.
- Countdown reaching zero triggers authoritative status recovery; browser time never grants stock authority.
- Production composition starts the existing idle expiry worker once per process.
- The worker discovers due active sellers from the ledger, serializes seller cleanup, and is independent of membership and sales-toggle state.
- Feature policy explicitly blocks new reservations while the JW sales suite is OFF while preserving existing owner recovery/release.

## New focused proof committed

- `server/tests/jw-stone-cart-hold-route.behavior.test.ts`
  - guarded Reserve
  - member-only reservation creation
  - revoked-owner Release
  - read-only operation recovery
  - production composition source contract
- `server/tests/jw-stone-cart-hold-worker.test.ts`
  - immediate interval run
  - no overlapping expiry passes
  - clean stop
- `server/tests/jw-stone-cart-hold-production-composition.test.ts`
  - real production-mode registrar composition with mocked external dependencies
  - full mutation router wiring
  - persistent limiter construction
  - same-origin guard behavior
  - expiry worker starts exactly once
- Existing cart/status tests now cover stable retry IDs, lost Reserve recovery, first-open active-hold gating, cart reopen duplicate blocking, cross-tab conflict recovery, explicit Release and lost Release reconciliation.
- Strict mutation response schemas reject payment/checkout/private-cost authority.

## Native integrated acceptance prepared

`scripts/jw-stone-cart-hold-journey.mjs` now exercises the real built client and disposable PostgreSQL through:

1. real customer Reserve from the saved seven-slab cart;
2. exact database hold/items/held-quantity checks;
3. no marketplace transaction, work request, checkout or payment creation;
4. visible countdown that actually decreases;
5. reload recovery of the same reservation;
6. exact immutable `expires_at` across reload;
7. duplicate Reserve blocked after reopen;
8. explicit browser Release;
9. stock returned and terminal ledger receipt;
10. no extra Reserve or Release network mutation.

The surrounding native driver also covers:
- sales-suite OFF blocks new reservation creation;
- actual owner Release UI after membership revocation;
- existing hold recovery while enhancements/membership are unavailable when `--owned-hold-status` is enabled;
- focused reservation, feature-policy and TypeScript/build preflight.

Exact fresh verification command intended for this candidate:
`npm run verify:jw-stone:cart-holds`

That command now fail-closes through `scripts/verify-jw-stone-cart-hold-actions.mjs`: it requires a clean source tree, clones the exact HEAD to a detached local checkout, runs fresh `npm ci --include=dev`, then executes the integrated browser/native driver without `--reuse-preflight`. The integrated driver reuses `scripts/verify-jw-cart-holds.mjs --exact-copy` so the same candidate must also pass the existing real-PostgreSQL ledger, two-worker expiry, concurrency and full-schema compatibility proof. Backend and browser receipts are both SHA-bound to the detached HEAD. Desktop and touch must both pass before `customerReservationActionsProved` can become true. Failure at install, native execution, evidence copy or receipt validation writes `test-results/jw-cart-hold-actions/exact-source.json` with the failed stage instead of disappearing without a receipt. The final copy is itself fail-closed, and the receipt distinguishes the native child exit code from verifier-level failure.

## Evidence that remains applicable

The core `server/services/jwStoneCartHolds.ts` and `server/services/jwStoneCartHoldWorker.ts` implementations are unchanged from verified backend candidate `763f5e19131a0fb65be5b281397a9817cebd1c05`.

That September 17 exact-source backend proof established:
- 29/29 native hold lifecycle/HTTP checks;
- 24 actual competing-writer races;
- two actual interval workers retiring the same due hold exactly once while OFF/revoked;
- 10/10 full-schema integration groups;
- canonical migration/schema verification;
- price-free owner recovery and revoked-owner release.

Do not reinterpret that historical backend proof as fresh proof of the newly mounted browser/runtime composition. The new UI/router/composition still needs the fresh native command above.

## Current execution boundary

Fresh execution is not claimed in this checkpoint.

- This repository has no GitHub Actions workflow directory, so no GitHub CI run is attached to these commits.
- The configured `TSCommandCenter` verification machine is currently offline (last observed 2026-09-18 08:56:38 UTC).
- Therefore the newly added/changed tests, TypeScript/build, native customer journey and broad release gate have not been executed from this continuation.
- No green result should be inferred from committed test source alone.

## Next exact actions when an execution runner is available

1. Run `npm run verify:jw-stone:cart-holds` and inspect both `test-results/jw-cart-hold-actions/evidence.json` and `test-results/jw-cart-holds/evidence.json`, plus `exact-source.json` and screenshots.
2. Fix only demonstrated failures on the exact candidate.
3. Run `npm run verify:release` with its disposable database prerequisites and retain exact-source evidence.
4. Only after both integrated native proof and release gate are green should PR #684 be considered for merge/release handling.
5. Keep production enhancements ON unless Thomas explicitly says OFF.

Do not repeat: broad TradeScout/JW Stone rediscovery, the stale five-day audit as a resume point, old commercial recovery, production OFF testing, source-price invention, fixture-created holds presented as customer Reserve proof, or production writes/deployments merely to obtain a green signal.
