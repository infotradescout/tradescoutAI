# JW Stone cart: exclude existing allocations

Baseline: `b64251d5fba399013a0cd71f5ff3c8d101a57163` on main.
Lane: `jw-stone/cart-held-stock-20260916`, created from that main commit.
Continuation: shipped cart-to-quote/delivery PRs #654 and #669; do not restart or overwrite employee-receiving PR #660.

## Defect and bounded repair

The current seller inventory reader exposes physical `quantity`, not net availability. The member cart review checked that physical count without reading the shared `stone_inventory_positions.held_quantity` allocation counter. Thus a lot with three physical slabs and two held could still approve a two-slab material subtotal. This finding is from the source path; executing the regression and native fixture is required before claiming test proof.

Read the existing counter for at most 50 selected public stock IDs, scoped to the resolved JW Stone seller. Subtract validated whole-slab holds before quantity and price-tier approval. Recheck publication evidence, verified/current state and freshness. Reject absent, ambiguous, malformed or changed position facts; a failed read never falls back to all physical stock. Keep counters private and do not mutate them through review.

Only the member-cart review changes. Seller physical counts, public stock/catalog counts, source imports, publication, pricing rules and every existing order/allocation write path remain unchanged. Public counts are not a reservation promise. A later inventory-wide available-vs-physical projection and reservation write integration remain separate work.

## Invariants

- enforced: same active JW Stone business membership and entitlement gate; pending general business verification is unchanged; internal/employee authority is not buyer-cart access.
- enforced: pricing remains from the existing Drive adapter; browser stock quantities, holds or prices are never authority.
- enforced: combine duplicate selections before comparing their total request to unheld stock; only then apply the configured quantity rate.
- enforced: null, malformed, negative, fractional, nonfinite or overallocated counters are not proof of availability.
- enforced: the allocation owner must release expired holds. This reader must not guess expiry, repair counters or release another order's stock.
- enforced: read-only review remains `inventoryReserved: false` and `readyForCheckout: false`; no new purchases, payment intents, freight rates or promised delivery dates.
- enforced: preserve current cart persistence, pickup/delivery details, private quote handoff and contact gates.

## Executable evidence

Focused tests: `npm run test:run -- server/tests/jw-stone-member-pricing-route.behavior.test.ts server/tests/jw-stone-cart-availability.test.ts --maxWorkers=2`.
The HTTP suite executes the actual new allocation query on PGlite with fixture authentication/schema middleware and real membership/pricing projection. Arithmetic tests explicitly exercise unknown inputs and query bounds. Neither alone is native concurrency or production-reservation proof.

The existing `scripts/jw-stone-cart-journey.mjs` now tests the actual built desktop/touch cart against native PostgreSQL: temporarily set the synthetic three-slab lot's counter to two, recheck the cart, require one available slab and removal of the old totals, price only that remaining slab, confirm review does not release the counter, restore the synthetic counter, and recheck quantity pricing. Continue the unchanged delivery, persisted supplier-request and revocation journey. These changes occur only inside the existing asserted disposable loopback fixture.

Use the unchanged `node scripts/verify-jw-cart-release.mjs` runner for affected tests, native browser proof and the strict minimum release gate. Record actual exact-head verdicts in the PR; this checkpoint does not assert that unexecuted checks passed. Do not add workflows, relax guards or bypass failed proof.

## Release and recovery

No production migration, configuration, stock mutation, employee grant or customer message is required. Main remains the automatic production release path through a tested PR. Prefer a focused roll-forward. Reverting to the baseline reintroduces the held-stock review defect, but changes no persisted schema or draft format. After merge, verify exact build health and anonymous pricing denial on both existing storefront domains. Do not use production customer writes for proof.
