# JW Stone: Build a Bundle

Objective: Implement the owner's seven-slab bundle target, add-X-more progress, and actual existing bundle-rate savings in the business-member cart.
Base branch/commit: origin/main at 6031a5a2 (fetched for this slice).
Current branch/commit: jw-stone/build-a-bundle-20260916; this checkpoint belongs to the enclosing feature commit. Resolve git HEAD before continuing; do not switch another worktree's branch.
Workspace: D:/ts-jw-bundle-20260916 on TSCommandCenter.

## Pricing behavior and scope

The seven-slab threshold is explicit owner direction. Mixed-material eligibility is the implementation interpretation, not a separately approved source-price change. Each eligible material uses its existing private source bundle rate. No percentage or dollar price was invented.

- enforced: seven fully reviewed eligible slabs across stock selections unlock their respective source bundle rates; all additional eligible slabs retain the same rates. Fourteen slabs represent two bundles but do not create an extra discount tier.
- enforced: combine duplicate public stock identities before availability review. Existing held-stock, seller, publication, freshness, slab-unit and dimensions checks remain in force.
- enforced: source minimums below seven keep their existing per-stock quantity rate. Source minimums above seven are not overridden or counted toward the mixed seven-slab offer. Equal/higher bundle prices do not become a discount.
- enforced: unavailable, unpriced, unsized and non-slab rows do not contribute eligible quantities. A partly unreviewable cart does not claim an unlocked bundle or total savings.
- enforced: a one-click completion action is offered only for a fully reviewable cart and enough server-checked remaining stock; the changed quantity is reviewed again.
- enforced: active JW Stone business membership remains required. Private cost/source identifiers are not exposed. Browser prices, cached totals and supplied discount flags are not authority.
- enforced: quantity changes, removal, review failure and membership rejection clear stale claims. Existing fulfillment details, private quote handoff, account-scoped saved carts and contact gates remain intact.

Verified completed work: Shared bundle rules; two-pass server pricing; response validation; member-cart builder/progress; stock-bounded add-X button; exact regular subtotal and quantity savings; catalog invitation; quote context; threshold and adversarial tests.
Changed but unverified work: No known failing focused behavior. Full production build/release gate and native-PostgreSQL mixed-material journey have not been executed for this feature candidate.
Files changed: shared/jwStoneBundle.ts; shared/jwStoneCart.ts; server/routes/jw-stone-member-pricing.ts; server/tests/jw-stone-bundle.behavior.test.ts; client/src/features/jw-stone/JwStoneBundleBuilder.tsx; JwStoneMemberCart.tsx; JwStoneMemberCart.test.tsx; JwStoneMemberPricing.tsx; scripts/jw-stone-bundle-browser-proof.mjs; this checkpoint.

## Evidence

Tests/evidence already run:
- npm.cmd run test:run -- server/tests/jw-stone-bundle.behavior.test.ts server/tests/jw-stone-member-pricing-route.behavior.test.ts server/tests/jw-stone-member-pricing.test.ts server/tests/jw-stone-pricing-import.test.ts server/tests/jw-stone-cart-availability.test.ts client/src/features/jw-stone/JwStoneMemberCart.test.tsx client/src/features/jw-stone/JwStoneMemberPricing.test.tsx --maxWorkers=2 --reporter=default: 169 passing across seven files.
- npm.cmd run check: passed (tsc).
- node --import tsx scripts/jw-stone-bundle-browser-proof.mjs: real cart components passed on 1280x1000 desktop and 390x844 touch viewport with isolated API fixtures. Six-to-seven mixed-material threshold, exact source-rate fixture savings, automatic repricing at six, reload persistence, zero horizontal overflow and zero page errors.
- Browser artifacts: artifacts/jw-stone-bundle/{desktop-unlocked.png,mobile-unlocked.png,result.json}. This is fixture-backed component proof, not a live inventory, native DB, full marketplace, purchase or reservation proof.
- Prior 88 existing stock/pricing tests also passed before the expanded suite. This is not an additional 88 unique tests.
Tests/evidence invalidated by later changes: None after the final focused/browser rerun; checkpoint-only edits do not change application behavior.
Known blockers/risks: Production release proof is outstanding. Mixed-material interpretation must be considered at preview approval. Non-blocking pre-existing Browserslist/Tailwind warnings appear in the Vite proof; do not expand this slice into dependency cleanup.
External side effects and retry safety: Read remote main, created an isolated JW branch/worktree, reused installed dependencies via junction, ran disposable local fixtures. No production accounts, prices, memberships, stock, orders, holds, payments or messages were written. No migration or environment change is required. Rerun browser proof only on its loopback fixture; it cleans up its unique source/HTML files and its own browser/server.
Next exact action: Review the focused JW-only PR/preview. Extend the native JW cart journey with mixed-material seven-to-six behavior, then run the existing strict minimum release contract against the exact release candidate. Merge to main only after the required owner GO; verify the deployed head and live member behavior afterward.
Actions that must NOT be repeated: Do not rediscover JW pricing/cart architecture, rerun unrelated repository audits, change Drive rates, remove lower published quantity tiers, weaken membership/contact gates, bypass a release gate, or describe the feature as live before deployment proof.
Business target: Bundle completion rate and average slabs per quote. No conversion uplift or revenue claim has been measured.
