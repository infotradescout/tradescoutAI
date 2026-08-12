# Traceability

## Amendment 2.0.0 trace additions

| Intent or prohibition | Requirement | Surface | Canonical owner | Planned proof |
| --- | --- | --- | --- | --- |
| Offer on every real listing, never First Cut | JW-OFFER-ENTRY | Cards, details, offer overlay | `jw-stone-offer-ui` | Catalog reconciliation and component/browser coverage |
| JW account is not TradeScout identity | JW-EXPRESS-IDENTITY | Express create/sign-in/recovery | `jw-stone-express-identity` | Schema isolation, cookie/auth and duplicate-email tests |
| Sealed requester-owned offers | JW-PRIVATE-OFFERS | Offer form and account history | `jw-stone-private-offers` | Idempotency, ownership, revision/withdraw and race tests |
| Truthful published containers | JW-CONTAINERS | Containers section and operator editor | `jw-stone-containers` | Empty-state, publication, validation and leakage tests |
| Highest amount first for containers | JW-OFFER-PRIORITY | Private operator queue | `jw-stone-offer-operations` | Deterministic ordering and lower-priority acceptance rejection |
| Deliberate contact decision | JW-OFFER-PRIVACY | Masked queue and reveal action | `jw-stone-offer-privacy` | Redaction, authorization and immutable event tests |
| Durable truthful email | JW-OFFER-NOTIFICATIONS | Outbox and delivery state | `jw-stone-offer-notifications` | Persist-before-send, allowlist, failure/retry tests |
| Exact-head release evidence | JW-OFFER-PROTECT | Build ledger and draft PR | `jw-stone-offer-release` | Migration, tests, browser, gate and council evidence |

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
