# JW Stone lane (TradeScout monorepo)

JW Stone product, ops, and strategy work lives in this folder and on **`jw-stone/*` git branches**.

TradeScout platform law, contact gating, county intelligence, and non-JW profiles are **not** JW work. Do not mix JW experiments into Dean recovery, non-JW audit remediation, or unrelated platform branches.

## Canonical docs in this folder

| Doc | Purpose |
| --- | --- |
| [BRANCH_LANES.md](./BRANCH_LANES.md) | Branch naming, merge rules, what must not land on `main` casually |
| [CLOSED_LOOP_STRATEGY.md](./CLOSED_LOOP_STRATEGY.md) | Corrected closed-loop market plan (JW sources; Levon sells; five customer bases) |
| [MARKETPLACE_DOMAIN_CUTOVER.md](./MARKETPLACE_DOMAIN_CUTOVER.md) | Custom domain → marketplace replace-profile cutover |
| [PUBLIC_MEDIA_MIGRATION.md](./PUBLIC_MEDIA_MIGRATION.md) | R2 media ownership, safe cutover, rollback, and proof |

## Related repo areas (already on `main` — change only from `jw-stone/*`)

- `client/src/features/jw-stone/`
- JW Stone public media manifest and persistent server-storage compatibility routes
- `server/publicJwStoneMarketplaceHtml.ts`
- `.selective-intelligence/builds/jw-stone-marketplace/`
- JW runbooks under `docs/runbooks/JW_STONE_*` and audits under `docs/audits/JW_STONE_*`

## Public storefront reset (2026-08-04)

`/jw-stone` and `jwstonelogistics.com` are the **only** public JW home (marketplace replaces the legacy `/u/jw-stone` storefront). Catalog-first: light JW header, First Cut, dense inventory, Aesthetic + Color filters, trust strip, path-based stone/material URLs. Customer type is collected on the request form. See `MARKETPLACE_DOMAIN_CUTOVER.md`.

## Ops truth (inventory / wish list) — do not confuse labels

| System | What it is | In this repo? |
| --- | --- | --- |
| Drive photo backlog cleanup → `jw_stone_reconciled_backlog.csv` | Clean filenames (`Category_Name_WxH.jpg`) pairing stone ↔ category ↔ dimensions ↔ Drive link | **Not in repo** (owner Sheet/Drive artifact). Closest in-repo evidence: `client/src/data/jwStoneSourceNames.generated.json`, `jwStoneInventoryReconciliation.json`, `docs/audits/JW_STONE_PROFILE_INVENTORY_RECONCILIATION_2026-07-13.md` |
| Google Sheet Wish List + Apps Script | Buyer requests (e.g. 3cm Taj Mahal) matched to Inventory “Available”; Email/WhatsApp notify; duplicate-tag | **Not in repo** — Sheet workflow remains source of truth. No in-app WhatsApp spam engine. |
| JW STONE Drive → `JW_Stone_Fabricator_Pricing_Draft_119 (1).xlsx` | Canonical slab, bundle, and internal landed-cost prices | **Values not in repo** — the server reads and validates the exact Drive file. Slab/bundle prices are private to active JW Stone business members plus authorized staff; landed cost is staff-only. |
| Marketplace **Saved** | Browser-local saved stones on `/jw-stone` | In repo (`wishlist.ts`). Label stays **Saved** — not JW’s Sheet Wish List. |

Marketplace cards may show slab size inches when Drive source filenames / reconciliation evidence include them. That is source meta, not a live availability claim.

The member-pricing endpoint must fail closed when its selected source fails validation. Never copy workbook values into catalog code, public HTML, structured data, logs, analytics, or browser storage.

### Private price delivery

The Drive workbook remains the master price list. `JW_STONE_PRICING_SOURCE=drive` (default) reads it directly and fails closed on authorization or validation failure. There is no automatic fallback after a denied Drive read.

`JW_STONE_PRICING_SOURCE=approved_import` deliberately selects a private import obtained through the owner's authorized connection. The server-only `JW_STONE_PRICING_APPROVED_IMPORT` configuration contains the exact file/folder identity, source modification and retrieval dates, and validated integer-cent rows. The same member/admin projections, exact stone-name matching, and access checks apply. Values never enter Git or the public catalog. This does not change Drive sharing.

An import does **not** refresh itself when the workbook changes. Refresh it from the same authorized workbook and retain its source dates, or switch to direct Drive mode only after production proves the connection works. Never describe an import as automatic synchronization.

An active JW Stone business membership unlocks pricing immediately. General business verification remains separate and continues to govern BidRock and other protected features. Pricing accepts legacy pending-verification entitlements for active memberships; no second signup or unrelated verification step is required. Explicitly rejected business identities, revoked/suspended entitlements, and closed/suspended memberships remain blocked.

## Owner rule

Merge JW changes to `main` only with explicit GO and JW-scoped evidence. Merge to `main` deploys production.
