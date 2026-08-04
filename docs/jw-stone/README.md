# JW Stone lane (TradeScout monorepo)

JW Stone product, ops, and strategy work lives in this folder and on **`jw-stone/*` git branches**.

TradeScout platform law, contact gating, county intelligence, and non-JW profiles are **not** JW work. Do not mix JW experiments into Dean recovery, non-JW audit remediation, or unrelated platform branches.

## Canonical docs in this folder

| Doc | Purpose |
| --- | --- |
| [BRANCH_LANES.md](./BRANCH_LANES.md) | Branch naming, merge rules, what must not land on `main` casually |
| [CLOSED_LOOP_STRATEGY.md](./CLOSED_LOOP_STRATEGY.md) | Corrected closed-loop market plan (JW sources; Levon sells; five customer bases) |

## Related repo areas (already on `main` — change only from `jw-stone/*`)

- `client/src/features/jw-stone/`
- `client/public/images/businesses/jw-stone/`
- `server/publicJwStoneMarketplaceHtml.ts`
- `.selective-intelligence/builds/jw-stone-marketplace/`
- JW runbooks under `docs/runbooks/JW_STONE_*` and audits under `docs/audits/JW_STONE_*`

## Public storefront reset (2026-08-04)

`/jw-stone` is **catalog-first** with a proportional Learn about stone section. The customer-path guide / buyer-type theater is void (SI lock `1.2.0`). Branch lane for that work: `jw-stone/marketplace-end-user-reset`.

## Owner rule

Merge JW changes to `main` only with explicit GO and JW-scoped evidence. Merge to `main` deploys production.
