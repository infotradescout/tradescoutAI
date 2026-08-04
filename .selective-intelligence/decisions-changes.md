# Decisions and Semantic Changes

## Governing invariants

- `DEC-SEPARATE-ROUTE`: JW Stone 2.0 exists only as a separate `/jw-stone` experience; the existing profile is protected unchanged.
- `DEC-TRUTH-ONLY`: canonical explicit source data governs published stone facts and missing facts remain absent.
- `DEC-NO-PRICE`: public price and price-derived surfaces are prohibited.

## Active release commitments

- `DEC-CATALOG-FIRST`: inventory discovery is the product; learning is proportional and optional.
- `DEC-LOCAL-WISHLIST`: eligible named-stone IDs persist in a bounded versioned browser-local wishlist without an account or contact gate.
- `DEC-OWNER-PREVIEW`: merge to `main` requires owner local desktop and mobile preview GO.

## Reversible implementation choice

- `DEC-VISUAL-COLOR`: color directions are explicit editorial visual classifications derived from supplied imagery. They are navigation labels, not geological, origin, suitability, availability, or material assertions.

## Deferred data decisions

Actual First Cut stone assignments and verified country-of-origin values remain deferred until JW supplies source-authorized facts.

## Authorized amendment: AMEND-END-USER-RESET

Authority: Thomas's direct August 4 correction as the product owner.

- ADDED: proportional Learn about stone section with Natural Stone Institute / Use Natural Stone sources.
- MODIFIED: page manifest is MarketplaceHeader → hero → First Cut → Current Inventory → Learn about stone → footer.
- REMOVED: customer-path guide, buyer-type toolbar, recommendation rails, role-gated knowledge product, and SI lock `1.1.1` JW-GUIDANCE requirements.
- RENAMED: public title from Guided Stone Discovery to Stone Discovery.
- UNCHANGED: route separation, canonical truth rules, current `/u/jw-stone` profile, wishlist, galleries, deliberate Direct Connect, no-price rule, First Cut honesty.

Compatibility impact: legacy `?buyer=` query values are ignored and not serialized.

Proof impact: prior path-guide evidence is invalid. Replacement proof must show catalog-first storefront, learn section, no customer-path UI, and desktop/mobile captures.
