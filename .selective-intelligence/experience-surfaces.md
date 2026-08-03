# Experience, Journeys, and Surfaces

## Actors and lifecycle journeys

Every visitor begins in the same protected image-led introduction, sees First Cut directly beneath it, and reaches the real supplied catalog without making a choice. The catalog retains the approved `Current Inventory` heading without implying live quantity or availability. A compact audience control offers Fabricator, Builders & Developers, Architects & Designers, and Homeowner paths. One click expands useful guidance and a small recommended-stone rail in place while the same storefront remains visible.

Fabricator guidance explains review of actual slab variation, proposed layout and sequence, supplied finishes, image coverage, and source-count evidence. Builders & Developers receive guidance on actual-slab approval, selection timing, finish continuity, and source-count evidence. Architects & Designers receive guidance on full-slab movement, sequential layout or bookmatching, finish effects, imagery, and verified origin when present. Homeowners receive plain-language guidance on sample-to-slab variation, reviewing actual slabs, finish and material care, and what to bring to a selection conversation. Guidance is concise, attributed, and limited to facts supported by the Natural Stone Institute or canonical JW data.

Each path's recommended rail follows the exact evidence contract in `data-contract.md`, contains no more than six named stones, and renders a visible factual reason for the rail and each item. Where repository evidence cannot connect an item to an audience preference, the interface calls the items examples or a starting edit rather than “best,” “likely,” or “recommended for” that role. The rail supplements the complete collection and never filters it.

Named stones may be saved, reopened, removed, cleared, shared through safe detail state, and deliberately handed to Direct Connect. Anonymous Trending Selection presentations remain browseable as `Call for availability` but cannot leak an internal identity into the URL, wishlist, metadata, or contact copy.

## Routes, navigation, and reachability

`/jw-stone` is the sole marketplace route and its canonical URL. Safe query parameters restore an optional customer path, optional color, material, finish, verified origin, and eligible named-stone detail state independently. Unsupported values are dropped without discarding other valid state or manufacturing an audience choice.

`/u/jw-stone`, the JW custom-domain profile, profile editing, inventory routes, and every non-JW route keep their existing resolution priority and renderer. The custom-domain host decision remains above the marketplace path check so a coincident path on a mapped host cannot replace that profile.

The server emits marketplace metadata and crawler fallback for `/jw-stone`; the sitemap exposes the route. First Cut placeholders and anonymous items do not receive product URLs.

The continuous section order is MarketplaceHeader → protected hero → First Cut → compact customer-path guide → Current Inventory → existing footer, with detail, wishlist, and deliberate request overlays outside the document sequence. The header, hero, First Cut placement, Current Inventory and JW Stone Picks labels, footer, and approved copy are baseline-locked. No unapproved story, trust, FAQ, recommendations, or sales-copy section is introduced by this amendment.

## Loading, empty, error, offline, retry, success, and recovery states

Lazy route loading uses a neutral branded fallback. A filter combination with no matches explains the empty result and exposes immediate refinement changes or a full reset. Filters cannot create a dead end without a reset control.

Wishlist storage reads and writes fail safely in memory when browser storage is unavailable, blocked, full, or malformed. Corrupt and stale IDs are ignored. Clearing requires confirmation. An empty wishlist explains how to add stones without opening contact.

Image failures preserve stone identity and controls without broken overlays. Direct Connect remains closed if it cannot initialize and no inquiry is sent automatically. Offline discovery continues for already loaded data and local wishlist interactions; the existing Direct Connect surface owns its own network error and retry behavior.

## Responsive and accessibility contract

The route must remain strong near 1440-pixel desktop and 390-pixel mobile widths with no horizontal overflow. The closed customer-path selector is one toolbar row. One click may add only an inline panel with at most three knowledge points and a horizontal rail capped at six stones. The complete guide must render under 520 pixels high at both proof widths, use no viewport/minimum-height class, require no second choice, and never unmount, reorder, or filter Current Inventory. Semantic headings, buttons, lists, dialogs, labels, live wishlist count, visible focus, Escape handling, focus return, arrow-key gallery navigation, swipe-friendly gallery controls, and adequate text contrast are required.

Drawers and dialogs cannot trap users. Body scroll restoration is deterministic. Reduced-motion preference disables nonessential transitions. Save controls expose the stone name and saved state. Images receive useful alt text without invented geological claims. Exact-head desktop and mobile evidence must include console and hydration inspection.
