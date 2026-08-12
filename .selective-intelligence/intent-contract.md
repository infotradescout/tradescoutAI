# Actual Intent Lock

## Amendment 2.0.0 — private offers and containers (2026-08-11)

The product owner has now authorized a genuine JW Stone offer lane. Every real Current Inventory listing receives **Make An Offer**, and the storefront receives a staff-published Containers section. A bidder creates a JW Stone Express Account—not a TradeScout account—with name, email, phone, business status, password, and offer. Offers are sealed, private, optionally subject to a posted minimum, and never competitive public bidding. Container opportunity is processed internally by highest active amount first. The complete superseding contract is `private-offers-amendment.md`; older no-database, no-authentication, and blanket no-price statements do not apply to this lane. Public asking prices and submitted amounts remain forbidden.

Project: JW Stone 2.0  
Release: jw-stone-2-0-r1 / amendment 1.3.0 (owner chat authority, 2026-08-04)  
Status: locked for definition

## Outcome and primary value event

JW Stone receives a separate, flagship stone-discovery experience at `/jw-stone`. Every visitor sees a real header and footer, First Cut, New Arrivals, and the supplied catalog immediately; can open a stone in one click; save named stones without an account; and deliberately start a Direct Connect request only when ready. Customer type (homeowner, fabricator, builder, designer, architect) is collected on the request form — never as page path theater.

## Owner authority (supersedes stale SI locks)

Owner chat of 2026-08-04 is product authority when it conflicts with prior SI locks:

- Stones must be dense and photo-first; no wasted fact-card doctrine (MATERIAL / FINISH / RECORDED SOURCE COUNTS / SUPPLIED VIEWS labels).
- Proper marketplace header and footer are required.
- Learn about stone is **void** — remove; do not restore learning theater.
- Yellow / amber eyebrow lines are **void** — never ship them.
- "Color directions" label is wrong: filter is Aesthetic (or Mood); a separate literal Color filter (e.g. White) is required.
- New Arrivals must be present (restored from the unnamed inventory photo rail; prior "Call for availability" / Trending Selection theater is **void**).
- "Call for availability" customer copy is **void** — never asked for.
- No inventing unsolicited storefront theater (path guides, recommendation rails, buyer workspaces).
- JW lane only (`jw-stone/*`); local preview before merge; no merge without GO.

## Void requirements from prior amendments

- JW-GUIDANCE customer-path guide (1.1.1) — void
- JW-LEARNING / Learn about stone section (1.2.0) — void
- Call for availability / Trending Selection marketing rail — void

## Non-negotiables

- Catalog-first storefront under `Current Inventory` with search and optional Aesthetic, Color, material, finish, and verified origin filters.
- New Arrivals presents unnamed inventory photographs without inventing product names or availability claims.
- First Cut Exclusives remains honest placeholders until JW supplies verified assignments.
- No public price surface.
- Saving is local and never itself a contact action.
- Direct Connect opens only after explicit inquiry intent; materials requests require customer role on the form.
- Legacy `?buyer=` must not drive UI.
- No visual-approval claim without desktop and mobile browser evidence from the exact commit.

## Protected page manifest

MarketplaceHeader → hero (no yellow eyebrows) → First Cut → Current Inventory (filters, New Arrivals photo rail, named catalog) → MarketplaceFooter → wishlist / detail / request overlays.

## Completion proof

Implementation + focused regression evidence + owner local preview on `/jw-stone` before any merge to `main`.
