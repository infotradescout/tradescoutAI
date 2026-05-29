# HomeID / HomeScout Separation Ledger

## Boundary Summary

- HomeID owns durable property truth and evidence history.
- HomeScout owns exchange/action surfaces and user intent.
- Direct Connect can attach to HomeID and propose timeline updates through verified evidence.

## Listing-Side HomeID Creation and Handoff

### Classification

- `enforced`: record identity and authority separation (`homeId` persists across handoffs).
- `policy_target`: listing-side creation and enrichment flows available on listing prep paths.
- `temporary_exception`: none currently declared for this section.

### Operating rule

A listing-side delegate (realtor/property manager) may create or enrich a HomeID before owner claim, but authority must be scoped and handoff-driven. Listing-side actions cannot overwrite record identity or grant permanent ownership control.

### Handoff invariants

1. Seller/listing-side authority closes at handoff.
2. Buyer/homeowner authority opens at handoff.
3. `homeId` remains unchanged.
4. Private seller-only evidence is excluded unless explicitly approved.
5. Transfer-safe packet drives what moves to the buyer.

### History and attribution

Listing-side contributions remain in HomeID history with attribution for trust and provenance, but attribution does not imply ongoing control.

### Scope guard

This handoff model is doctrine and contracts-first:

- no schema lock in this doc
- no API shape lock in this doc
- no UI lock in this doc

Implementation must conform to AssetID contracts and platform law.
