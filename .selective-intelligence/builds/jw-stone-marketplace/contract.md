# Build Contract: jw-stone-marketplace

Verdict: owner override 1.3.0 — catalog-first + New Arrivals; learning/CFA/path-guide void  
Base revision: `5796383977dfee4411b161a3f4fcbc122405642d`  
Lock version: `1.3.0`

## Included requirements and protected unchanged behavior

This build owns JW-ROUTE, JW-INVENTORY, JW-FIRST-CUT, JW-NEW-ARRIVALS, JW-ORIGIN, JW-WISHLIST, JW-CARDS, JW-DIRECT-CONNECT, JW-A11Y, JW-SEO, and JW-PROTECT.

JW-GUIDANCE customer-path guide (1.1.1), JW-LEARNING (1.2.0), and Call-for-availability / Trending Selection theater are **void**.

Protected unchanged behavior includes `/u/jw-stone`, the JW custom-domain renderer, profile editing, existing inventory routes, database presentation settings, all non-JW profiles, scalar Direct Connect consumers, production, DNS, and `main` until an explicit GO merge.

## Claimed canonical owners, dependencies, migrations, and merge order

The build claims `jw-stone-marketplace-route`, `existing-jw-profile`, `jw-stone-marketplace-state`, `jw-stone-marketplace-ui`, `jw-stone-marketplace-data`, `direct-connect-material-handoff`, and `jw-stone-public-metadata`.

It depends on the canonical JW inventory and safe-name modules plus the existing Direct Connect flow. No database migration. Publication uses branch `jw-stone/marketplace-end-user-reset`, local preview, then draft PR after owner visual GO.

## Positive, negative, concurrency, recovery, and rollback proof

Positive proof covers route reachability, immediate real inventory, one-click details, proportional learn section with sourced links, independent optional refinements and URLs, named and anonymous catalog presentation, origin fixtures, First Cut placeholders, wishlist persistence, accessible galleries, safe contact, metadata, sitemap, and responsive browser journeys.

Negative proof covers absence of customer-path guide / buyer toolbar / recommendation rails, inventory withholding, required audience input, public price, synthetic names, unsupported facts, invented origin, placeholder leakage, storage corruption and failure, automatic contact, unsafe request context, overlay bleed, runtime warnings, and horizontal overflow.

Concurrent wishlist updates remain bounded and safe. Invalid URL and storage state recover to a usable page. Rollback before release is branch closure.
