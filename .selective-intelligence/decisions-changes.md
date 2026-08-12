# Decisions & Changes — JW Stone marketplace amendment 1.3.0

## Owner amendment 2.0.0 (2026-08-11)

- ADDED: Make An Offer on every real Current Inventory listing, including publicly anonymous catalog listings.
- ADDED: staff-published Containers section with no synthetic seed records.
- ADDED: JW Stone Express Account isolated from TradeScout customer identity.
- ADDED: sealed private offer history, optional posted minimums, highest-offer-first container processing, masked contact, audited reveal, and durable email outbox.
- MODIFIED: the no-price rule now permits only an optional public offer minimum; seller asking prices and submitted amounts remain private.
- MODIFIED: the earlier no-database/no-authentication architecture is superseded for this bounded persistent lane.
- UNCHANGED: Ask/Direct Connect separation, catalog truth, First Cut non-product status, wishlist, custom-domain behavior, no payment, no merge/deploy without GO.
- DEFERRED: real container publication content remains operator-entered because no authoritative container inventory exists in the repository.

Authority, exact behavior, and proof are recorded in `private-offers-amendment.md`.

## Owner override (2026-08-04)

Owner chat is product authority over stale SI locks for this recovery slice.

## Changes

- ADDED: New Arrivals section restored from unnamed inventory photo rail (replaces Call-for-availability / Trending Selection theater).
- ADDED: Separate Aesthetic and literal Color filters (`aesthetic` + `color` URL state).
- ADDED: Real MarketplaceFooter; header section nav includes New Arrivals.
- ADDED: Customer role field on materials request form (ExpressDirectConnectPanel).
- REMOVED: Learn about stone section and related modules.
- REMOVED: Yellow / amber eyebrow copy.
- REMOVED: Customer-facing "Call for availability" marketplace copy.
- REMOVED: Card doctrine fact grids (source counts / supplied views as customer UI).
- MODIFIED: Dense photo-first stone cards with compact meta line.
- VOID: path-guide theater; learning theater; CFA theater.
- UNCHANGED: `/u/jw-stone` profile, deliberate Direct Connect, wishlist, galleries, no-price rule, First Cut honesty, JW lane isolation, no merge without GO.

## Deferred

Actual First Cut stone assignments and verified country-of-origin values remain deferred until JW supplies source-authorized facts.
