# TradeScout Stone Core

## Governing rule

One stone truth, many authorized views.

A company profile is not an inventory database. A supplier relationship is not ownership. A material name is not a physical slab. A marketplace publication is not proof that inventory exists.

JW Stone's photo catalog is a **Material Library**, not a statement of physically confirmed stock. R.E.D. Graniti source materials never become JW Stone inventory unless a physical asset is received, verified, passported, and assigned to a current inventory position.

The JW Stone storefront currently presents that catalog as **Browse Full Inventory**. That is a brand-facing browse label, not a physical-stock assertion. Only the separately governed **New Arrivals** surface may show real stock, and only after the freshness, publication, verification, and explicit-selection rules below pass.

## Separate records

### 1. Company profile

The existing `businesses` and `profiles` records represent the company itself.

Current mapping:

- R.E.D. Graniti: independent source company; TradeScout-admin-controlled profile.
- JW Stone: independent distributor profile and operating business.

### 2. Stone material

`stone_materials` stores the canonical material identity and official source reference once.

A material record does not claim that a physical block, bundle, slab, or container has been received.

### 3. Physical asset passport

`stone_asset_passports` represents a real physical block, bundle, slab, or container.

A passport is created only when an actual physical asset is known. Source-material seeding must never manufacture passports.

### 4. Inventory position

`stone_inventory_positions` records where a physical passported asset sits, who holds it, its lifecycle state, and whether availability may be published.

No R.E.D. Graniti source material is treated as JW Stone inventory until a physical asset is received, verified, and given an inventory position.

### 5. Distribution right

`stone_distribution_rights` stores the verified relationship separately from both company profiles.

Current relationship:

- Source company: R.E.D. Graniti
- Distributor: JW Stone
- Right: distribution
- Scope: first cut
- Exclusivity: exclusive
- Territory: not publicly specified
- Status: active
- Evidence: operator confirmed

### 6. Publication

`stone_publications` controls which profile or channel is authorized to present a canonical material record.

Current authorized targets:

- R.E.D. Graniti source-company view
- JW Stone authorized-distributor view

Both begin as `authorized_not_published` with `inventory_claim = none`. A dedicated view must be built and deliberately released before either becomes published. BidRock receives its own publication records only when a business listing is created; it does not inherit profile or inventory claims automatically.

## Current R.E.D. Graniti correction

The R.E.D. Graniti public profile contains only:

- Company identity
- Company background
- Company services
- Company/quarry imagery
- A concise statement of the separate JW Stone first-cut relationship
- TradeScout-admin-controlled request entry

The profile no longer contains a copied quarry-material catalog, copied inventory, material-category sitemap, or JW Stone phone routing.

## Non-negotiable rules

1. Never copy the same material into multiple profile-owned catalogs.
2. Never turn a source material into available inventory without a physical asset passport and inventory position.
3. Never store distributor ownership on the source-company profile.
4. Never infer or publish exclusivity territory that has not been confirmed.
5. Never let BidRock, JW Stone, a source profile, or a visualizer create competing material truth.
6. Public availability must come from the current inventory position, not from a supplier page or partnership.
7. HomeID receives the installed physical material history after installation; it does not become the source catalog.
