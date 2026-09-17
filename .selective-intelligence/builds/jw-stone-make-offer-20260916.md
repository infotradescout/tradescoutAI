# JW Stone member offers — resume checkpoint

Objective: Add Make an offer beside unlocked stone prices and the checked cart total, using the existing request system. The owner explicitly prohibits taking payment until JW Stone confirms the offer and final total.
Base branch/commit: jw-stone/build-a-bundle-20260916 at 11d601d87b6ee9e0d5d8fce6fc3809216cb96e1d (bundle candidate based on origin/main 6031a5a2).
Current branch/commit: jw-stone/build-a-bundle-20260916; this checkpoint belongs to its enclosing commit. Resolve git HEAD before continuing.
Workspace: D:/ts-jw-bundle-20260916 on TSCommandCenter. Existing draft PR: infotradescout/tradescoutAI#683.

Verified completed work:
- enforced: member-only stone and whole-cart offer entry points; stone offers do not change the saved cart. Existing quote requests remain available.
- enforced: exact stock, quantities, pickup/delivery selection, listed subtotal, proposed material total in integer cents, notes, explicit terms acknowledgment. Cart offers use the already-discounted listed total.
- enforced: server resolves active business membership and reruns authoritative inventory/pricing review before saving; unreviewable stock, changed totals, and invalid client-supplied authority fields are rejected.
- enforced: private pending_review offer metadata, paymentAllowed=false, inventoryReserved=false, no confirmed total; existing Intent -> Decision Card -> Contact transaction and business notification path remain in use. No checkout, card authorization, deposit, stock hold or payment is initiated. Ordinary contact acceptance does not mutate offer confirmation.
- policy_target: operator confirmation/counteroffer UI and versioned final-quote/payment handoff are NOT implemented by this intake slice. They must explicitly require confirmation before any future payment path. Do not equate a request receipt or contact acceptance with an accepted offer.
Changed but unverified work: Desktop/mobile offer browser proof script is added and syntax-checked but was not executed. A tool safety check blocked its loopback-fixture launch; no alternative execution path was used. Production build, native-PostgreSQL offer journey, strict minimum release gate and deployed verification remain unrun.
Files changed: shared/jwStoneOffer.ts; server/services/jwStoneOfferReview.ts; server/routes/{jw-stone-member-pricing,tradepartner-express}.ts; client/src/features/jw-stone/{JwStoneOfferFields,JwStoneMemberPricing,JwStoneMemberCart}.tsx; client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx; offer/client/cart/HTTP tests; scripts/jw-stone-offer-browser-proof.mjs; this checkpoint and bundle continuation pointer.

Tests/evidence already run:
- npm.cmd run test:run -- server/tests/express-request-contact-delivery.behavior.test.ts server/tests/jw-stone-bundle.behavior.test.ts server/tests/jw-stone-cart-availability.test.ts server/tests/jw-stone-direct-connect-route.contract.test.ts server/tests/jw-stone-member-pricing-route.behavior.test.ts server/tests/jw-stone-member-pricing.test.ts server/tests/jw-stone-offer.behavior.test.ts server/tests/jw-stone-pricing-import.test.ts server/tests/tradepartner-express-authority-lifecycle.regression.test.ts server/tests/tradepartner-express-identity-gate.regression.test.ts server/tests/tradepartner-express-phone-gate.regression.test.ts client/src/features/jw-stone/JwStoneMemberCart.test.tsx client/src/features/jw-stone/JwStoneMemberPricing.test.tsx client/src/features/jw-stone/JwStoneOffer.test.tsx client/src/pages/profile-sites/ExpressDirectConnectPanel.test.tsx --maxWorkers=2 --reporter=json --outputFile=artifacts/jw-stone-offer/focused-tests.json
- Result: 293/293 passing tests across 15 files. Local JSON and log: artifacts/jw-stone-offer/focused-tests.{json,log}. This includes mocked HTTP transaction/email boundaries and real React component behavior under jsdom; it is NOT native-DB or live delivery proof.
- npm.cmd run check: passed after final application and test edits.
- node --check scripts/jw-stone-offer-browser-proof.mjs: passed (syntax only).
- git diff --check: passed.
Tests/evidence invalidated by later changes: Prior bundle-only desktop/mobile browser proof applies to 11d601d8, not this updated UI candidate. Earlier test attempts failed on a BigInt target issue and a test-fixture release-authority mismatch; both were corrected without weakening production access controls and are superseded by the final run.
Known blockers/risks: No production release evidence or operator confirmation/payment integration. Preserve the seven-slab source pricing policy and the prior mixed-material approval boundary.
External side effects and retry safety: Local source/test/checkpoint edits and mocked tests only, followed by a normal branch commit/push to draft PR #683. No production account, membership, price, inventory, order, message, hold or payment changes. No migration or environment changes. Only local artifacts are untracked.
Next exact action: Inspect the new offer UI and complete permitted desktop/mobile validation; run native-DB offer/quote journeys and exact-commit minimum release gate before owner GO and any merge. For commercial lifecycle work, build explicit confirmation/counteroffer and final-total authorization rather than treating the existing request/contact status as payment approval.
Actions that must NOT be repeated: Do not restart pricing/cart discovery, change source rates, auto-approve offers, collect a card/deposit at submission, reserve stock at submission, broaden public price exposure, bypass contact gates or tool safety checks, merge main without the release gate/GO, or claim this draft is live.
Business KPI: Track bundle completion and offer-to-confirmed-order conversion once the corresponding production flows exist; no conversion uplift is measured here.

## Superseding verification checkpoint — 2026-09-17
Resume from `.selective-intelligence/builds/jw-stone-offer-verification-20260917.md`.
The unchanged b2c87c9c application/test source now has a passing desktop/mobile mocked-API offer browser proof and a passing complete production build. Those steps above are no longer unexecuted.
Native preparation was blocked by a tool safety-status check and was not rerouted. Native/built-browser/release/deployment proof remains outstanding. This is not a shipped feature or proof of commercial confirmation/payment support.
