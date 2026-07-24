# Selective Inheritance regression — luxury showcase vs wholesaler inventory grammar

**Status:** regression fixture  
**Product:** TradeScout / ISSA Build  
**Date:** 2026-07-24

## Rule

When the owner requests a luxury showcase and supplies an existing luxury-oriented website, Selective Inheritance may inherit platform capabilities from a wholesaler implementation, but it must reject that implementation’s inventory-oriented presentation grammar.

## Inherit

| Source | Allowed |
| --- | --- |
| TradeScout | Identity, privacy, Direct Connect, sharing, auth, profile ownership |
| Owner luxury site | Luxury voice, installed-interior imagery, light/install/backlight/custom/consult story, consultation posture |
| Wholesaler / JW Stone architecture | Stable material IDs + Direct Connect source context only |

## Reject

| Source | Forbidden |
| --- | --- |
| Generic marketplace | Marketplace sludge, lead selling, pay-to-play |
| Owner site | Public phone/email, generic testimonials, combined “Honey Green” naming, unsupported specifics |
| Wholesaler presentation | Inventory browser, filters, slab counts, warehouse/yard language, stock badges, product cards, “View details”, catalog navigation |

## Proof hooks (TradeScout)

- Presentation archetype: `luxury-material-house` (reusable; not `profileSlug === "issa-build"` fork)
- Renderer: `LuxuryMaterialHouseShowcase` — not `OnyxStoneShowcase`
- Material identity preserved: `honey-onyx`, `multi-green-onyx`
- First content sections use installed-interior `/applications/` imagery
- Contracts: `server/tests/issa-build-profile.contract.test.ts`, `client/src/pages/profile-sites/PremiumProductProfileSections.test.tsx`
