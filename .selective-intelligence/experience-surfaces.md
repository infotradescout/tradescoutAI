# Experience Surfaces — JW Stone marketplace (amendment 1.3.0)

## Amendment 2.0.0 surfaces

The protected storefront order becomes MarketplaceHeader → hero → First Cut → Containers → Current Inventory → MarketplaceFooter. Published containers and every real Current Inventory card/detail expose **Make An Offer**; First Cut does not. The JW Express overlay owns create account, sign in, verification/recovery, offer submission, and account history. The dedicated operator surface is `/admin/jw-stone-offers`. Customers never see another offer, rank, offer count, bidder, contact detail, or delivery diagnostic. Full behavior is locked in `private-offers-amendment.md`.

Every visitor begins in the same image-led introduction with a real sticky header, sees First Cut beneath it, reaches New Arrivals and Current Inventory without making a buyer-path choice, and ends on a real footer. Customer role is collected only inside the request form.

## Section order

MarketplaceHeader → protected hero → First Cut → Current Inventory (Aesthetic + Color + material + finish filters, New Arrivals photo rail, named dense cards) → MarketplaceFooter, with detail, wishlist, and deliberate request overlays outside the document sequence.

## Void surfaces

- Customer-path guide / buyer toolbar / recommendation rails
- Learn about stone
- Yellow / amber eyebrows
- Call for availability / Trending Selection marketing copy
- Doctrine fact grids on cards (Recorded source counts, Supplied views, labeled MATERIAL/FINISH cells as primary card content)

## Filters

- Aesthetic / mood (Soft & Light, Warm & Earthy, …) via `?aesthetic=`
- Literal color (White, Black, …) via `?color=`
- Material, finish, verified origin when available
- Legacy `?color=` aesthetic values map into `aesthetic`; literal colors stay on `color`

## SSR / crawler

Server emits marketplace metadata and crawler fallback for `/jw-stone` aligned to catalog-first copy. First Cut placeholders and anonymous New Arrivals photographs do not receive product URLs.
