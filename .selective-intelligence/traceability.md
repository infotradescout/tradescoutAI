# Traceability

Trace: intent/prohibition → requirement → journey → canonical owner → data/API → acceptance → test → feature state → evidence.

| Intent or prohibition | Requirement | Journey and surface | Canonical owner | Data or API | Planned acceptance proof |
| --- | --- | --- | --- | --- | --- |
| Separate marketplace; current profile untouched | JW-ROUTE | `/jw-stone`, `/u/jw-stone`, custom domain | `jw-stone-marketplace-route`, `existing-jw-profile` | Route flags and explicit server HTML route | Route priority, profile regressions, diff audit, desktop/mobile captures |
| Stone visible immediately; no role theater | JW-JOURNEY | Hero, First Cut, Current Inventory | `jw-stone-marketplace-state` | Independent allowlisted URL state | Initial cards, one-click detail, independent round trip, invalid recovery |
| Proportional sourced learning only | JW-LEARNING | Learn about stone section | `jw-stone-marketplace-ui` | Static sourced topics | Topic count, safe hosts, no role tabs/rails |
| Canonical truth; anonymous names private; no price | JW-INVENTORY | Search, cards, details, sharing, contact | `jw-stone-marketplace-data` | `JwStoneInventoryStone`, safe-name helpers | Record reconciliation, forbidden scans, named and anonymous rendering |
| Upcoming First Cut positions are not products | JW-FIRST-CUT | First Cut Exclusives editorial section | `jw-stone-marketplace-data` | Presentation-only placeholders | Zero catalog membership and no search/storage/metadata/contact path |
| Origin only from explicit verified source | JW-ORIGIN | Filters, cards, details | `jw-stone-marketplace-data` | Nullable verified-origin contract | Current filter hidden; fixture proves verified path |
| No-account persistent saved selection | JW-WISHLIST | Save controls and wishlist panel | `jw-stone-marketplace-state` | Versioned bounded local-storage envelope | Persistence, failure recovery, maximum, stale ID |
| Truthful accessible cards and details | JW-CARDS | Shared collection and gallery dialog | `jw-stone-marketplace-ui` | Catalog presentation model | Keyboard, touch, save state, anonymous, responsive proof |
| Contact only after deliberate action | JW-DIRECT-CONNECT | Single-card and wishlist inquiry | `direct-connect-material-handoff` | Existing express-request endpoint | No pre-submit fetch, scalar regression, bounded multi payload |
| Desktop, mobile, keyboard | JW-A11Y | Collection, learning, overlays | `jw-stone-marketplace-ui` | Semantic DOM and UI primitives | 1440/390 real-browser inspection |
| Accurate canonical and safe sharing | JW-SEO | Server HTML, sitemap, discovery URLs | `jw-stone-public-metadata` | Route metadata helper and URL parser | SSR/sitemap extraction and forbidden metadata scans |
| Evidence before merge or deployment | JW-PROTECT | Branch, draft PR, release gate | `existing-jw-profile` | Git and verification ledger | Exact commands, revision, screenshots, owner GO |

Feature state begins at `specified`. Customer-path JW-GUIDANCE is void.
