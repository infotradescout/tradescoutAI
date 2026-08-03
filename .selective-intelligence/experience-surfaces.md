# Experience, Journeys, and Surfaces

## Actors and lifecycle journeys

Every visitor begins in the same image-led introduction, then chooses Fabricator, Builder, Designer, or Homeowner. The chosen role reveals the color-direction step. A color selection opens the appropriate workspace; changing either selection updates the public URL without a full restart.

Fabricator Desk emphasizes supported specifications, source counts, finishes, galleries, comparison, and saved items. Builder Project Room groups choices as a project review with material and source evidence. Designer Selection Board uses large imagery, visual rhythm, finish and verified-origin context, and a board-like wishlist. Homeowner Stone Finder uses plain language and visual explanation with fewer trade details.

Named stones may be saved, reopened, removed, cleared, shared through safe detail state, and deliberately handed to Direct Connect. Anonymous Trending Selection presentations remain browseable as `Call for availability` but cannot leak an internal identity into the URL, wishlist, metadata, or contact copy.

## Routes, navigation, and reachability

`/jw-stone` is the sole marketplace route and its canonical URL. Safe query parameters restore buyer, color, material, finish, verified origin, and eligible named-stone detail state. Unsupported values are dropped and the visitor recovers at the nearest valid stage.

`/u/jw-stone`, the JW custom-domain profile, profile editing, inventory routes, and every non-JW route keep their existing resolution priority and renderer. The custom-domain host decision remains above the marketplace path check so a coincident path on a mapped host cannot replace that profile.

The server emits marketplace metadata and crawler fallback for `/jw-stone`; the sitemap exposes the route. First Cut placeholders and anonymous items do not receive product URLs.

## Loading, empty, error, offline, retry, success, and recovery states

Lazy route loading uses a neutral branded fallback. A color direction with no matches explains the empty result and exposes immediate color or filter changes. Filters cannot create a dead end without a reset control.

Wishlist storage reads and writes fail safely in memory when browser storage is unavailable, blocked, full, or malformed. Corrupt and stale IDs are ignored. Clearing requires confirmation. An empty wishlist explains how to add stones without opening contact.

Image failures preserve stone identity and controls without broken overlays. Direct Connect remains closed if it cannot initialize and no inquiry is sent automatically. Offline discovery continues for already loaded data and local wishlist interactions; the existing Direct Connect surface owns its own network error and retry behavior.

## Responsive and accessibility contract

The route must remain strong near 1440-pixel desktop and 390-pixel mobile widths with no horizontal overflow. Semantic headings, buttons, lists, dialogs, labels, live wishlist count, visible focus, Escape handling, focus return, arrow-key gallery navigation, swipe-friendly gallery controls, and adequate text contrast are required.

Drawers and dialogs cannot trap users. Body scroll restoration is deterministic. Reduced-motion preference disables nonessential transitions. Save controls expose the stone name and saved state. Images receive useful alt text without invented geological claims. Exact-head desktop and mobile evidence must include console and hydration inspection.
