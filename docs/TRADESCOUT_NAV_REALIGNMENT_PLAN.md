# TradeScout Navigation Realignment Plan

Last Updated: 2026-03-30
Status: Working plan
Depends On: `docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md`

## Goal
Reduce the feeling that TradeScout is a pile of unrelated products by simplifying what gets top-level emphasis.

This is a product-priority document, not a route-deletion document. Existing features stay in the product unless explicitly removed later. The immediate job is to decide which surfaces deserve top-level navigation weight.

## 1. Current Top-Level Shell Surfaces
Current `AppShell` bottom navigation exposes:
- Scout
- Direct Connect
- Community
- TradeDeals
- Exchange
- HomeScout Listings
- Maps
- Commercial
- Leaderboard
- Community Builders
- Help
- Share
- Admin (conditional)

Current route tree confirms these are all real top-level surfaces in the app:
- `/scout`
- `/direct-connect`
- `/community`
- `/exchange`
- `/trade-deals`
- `/homescout-listings`
- `/maps`
- `/commercial-directory`
- `/leaderboard`
- `/foundation`
- `/share`
- `/help`

## 2. Problem
This navigation advertises too many product centers at once.

As a result:
- users cannot immediately tell what TradeScout primarily is
- secondary tools compete with core workflows
- the shell feels like a capability dump instead of a guided operating system
- public positioning and in-product navigation do not reinforce the same story

## 3. Locked Priority Model
Per product law, TradeScout should center on:
- Scout
- Direct Connect
- Community
- Exchange

These are the core top-level surfaces because together they tell the strongest coherent story:
- `Scout` = entry point and operating guide
- `Direct Connect` = trusted action and gated coordination
- `Community` = social trust and local signal layer
- `Exchange` = local commerce / listings layer

## 4. Recommended Navigation Tiers

### Tier 1: Primary navigation
- Scout
- Direct Connect
- Community
- Exchange

### Tier 2: Secondary but important
- Maps
- Help
- Admin

These are useful, but they are not the main public identity of the product.

### Tier 3: Contextual or role-based
- HomeScout Listings
- Commercial
- TradeDeals
- Community Builders
- Leaderboard
- Share

These can stay in the product without competing as primary product pillars.

## 5. Surface Decisions

### Keep primary
`Scout`
- Keep as the main front door.
- Should be the strongest entry point across landing, shell, and onboarding.

`Direct Connect`
- Keep primary.
- This is the clearest embodiment of gated contact and trusted action.

`Community`
- Keep primary.
- This strengthens trust, recommendations, and local visibility.

`Exchange`
- Keep primary.
- This is broad enough to justify a core slot and already maps to a recognizable user need.

### Demote from top-level emphasis
`TradeDeals`
- Do not treat as a top-level product pillar.
- Better as a contextual growth/partner surface.

`HomeScout Listings`
- Important, but too vertical-specific for the main shared nav.
- Better as a role-aware or contextual destination.

`Commercial`
- Important for some users, but not a clear universal top-level destination.
- Better as a contextual or role-based path.

`Leaderboard`
- Useful as a trust/community adjunct, not as a product pillar.

`Community Builders`
- Important to TradeScout’s ecosystem, but not a first-stop destination for most users.

`Share`
- Utility surface, not a core product category.

## 6. Recommended Shell Changes

### Bottom navigation
Reduce the always-visible shared bottom nav to:
- Scout
- Direct Connect
- Community
- Exchange
- More

`More` should open or route to a secondary tools tray that can include:
- Maps
- Help
- TradeDeals
- HomeScout
- Commercial
- Leaderboard
- Community Builders
- Share
- Admin (when allowed)

### Right-side tools rail
Keep the right rail, but make it feel utility-oriented rather than like a second competing navigation system.

The right rail should prioritize:
- profile/tools
- messages
- notifications
- role-specific utilities

It should not become a duplicate catalog of every product surface.

## 7. Landing Alignment
Landing should mirror the same center of gravity:
- Start with Scout
- Explain Direct Connect
- Show trust/CVS and recommendations
- Clarify gated contact
- Then branch into role-specific or vertical-specific stories

Landing should not imply that every product surface is equally central.

## 8. Implementation Order
1. Lock product and copy law.
2. Lock nav realignment plan.
3. Refactor shared shell nav.
4. Refactor onboarding and landing entry points.
5. Re-home contextual surfaces into secondary menus, role-aware links, or page-level CTAs.

## 9. Non-Goals
- This plan does not delete routes.
- This plan does not remove features.
- This plan does not change gating law.
- This plan does not collapse admin access.

It only changes what TradeScout emphasizes first.
