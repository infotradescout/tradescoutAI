# Build Contract: jw-stone-marketplace

Verdict: amended definition locked; implementation must replace the rejected staged model
Base revision: `10cbc151c6952904cdd32a5d6205fee890614d9a`
Lock version: `1.1.1`

## Included requirements and protected unchanged behavior

This build owns JW-ROUTE, JW-JOURNEY, JW-GUIDANCE, JW-INVENTORY, JW-FIRST-CUT, JW-ORIGIN, JW-WISHLIST, JW-CARDS, JW-DIRECT-CONNECT, JW-A11Y, JW-SEO, and JW-PROTECT.

Protected unchanged behavior includes `/u/jw-stone`, the JW custom-domain renderer, profile editing, existing inventory routes, database presentation settings, all non-JW profiles, scalar Direct Connect consumers, production, DNS, and `main`.

## Claimed canonical owners, dependencies, migrations, and merge order

The build claims `jw-stone-marketplace-route`, `existing-jw-profile`, `jw-stone-marketplace-state`, `jw-stone-marketplace-ui`, `jw-stone-marketplace-data`, `direct-connect-material-handoff`, and `jw-stone-public-metadata`.

It depends on the canonical JW inventory and safe-name modules plus the existing Direct Connect flow. No database migration or deployment step exists. The customer-card draft is an independent lane and is excluded. Publication order is implementation and proof, exact-head commit, pushed feature branch, then an unmerged draft pull request.

## Positive, negative, concurrency, recovery, and rollback proof

Positive proof covers route reachability, immediate real inventory, one-click details, four compact sourced guidance paths, validated recommended named stones, independent optional refinements and URLs, named and anonymous catalog presentation, origin fixtures, First Cut placeholders, wishlist persistence, accessible galleries, safe contact, metadata, sitemap, and responsive browser journeys.

Negative proof covers current-profile or protected-chrome changes, inventory withholding, required audience/color input, viewport-height guidance, workspace/page swapping, unsourced knowledge, unsupported recommendations, public price, synthetic names, unsupported facts, invented origin, placeholder leakage, storage corruption and failure, automatic contact, unsafe request context, overlay bleed, runtime warnings, and horizontal overflow.

Concurrent wishlist updates remain bounded and safe across state transitions and storage events. Invalid URL and storage state recover to a usable stage. Rollback before release is branch closure; a later application release can be reverted without a data migration.
