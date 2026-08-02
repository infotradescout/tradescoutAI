# Traceability

Trace: intent/prohibition → requirement → journey → canonical owner → data/API → acceptance → test → feature state → evidence.

| Intent or prohibition | Requirement | Journey and surface | Canonical owner | Data or API | Planned acceptance proof |
| --- | --- | --- | --- | --- | --- |
| Separate marketplace; current profile untouched | JW-ROUTE | `/jw-stone`, `/u/jw-stone`, custom domain | `jw-stone-marketplace-route`, `existing-jw-profile` | Route flags and explicit server HTML route | Route priority, profile regressions, diff audit, desktop/mobile captures |
| Buyer before color before results | JW-JOURNEY | Landing, role step, color step, workspace | `jw-stone-marketplace-state` | Allowlisted URL state | Parser round trip, invalid recovery, component gating, browser history |
| Four materially different buyer paths | JW-WORKSPACES | Desk, project room, selection board, stone finder | `jw-stone-marketplace-ui` | Shared read-only catalog projection | Distinct DOM contracts and four visual journeys |
| Canonical truth; anonymous names private; no price | JW-INVENTORY | Search, cards, details, sharing, contact | `jw-stone-marketplace-data` | `JwStoneInventoryStone`, safe-name helpers | Record reconciliation, forbidden scans, named and anonymous rendering |
| Upcoming First Cut positions are not products | JW-FIRST-CUT | First Cut Exclusives editorial section | `jw-stone-marketplace-data` | Presentation-only placeholders | Zero catalog membership and no search/storage/metadata/contact path |
| Origin only from explicit verified source | JW-ORIGIN | Filters, cards, details, designer board | `jw-stone-marketplace-data` | Nullable verified-origin contract | Current filter hidden; test fixture proves verified path and rejects unverified |
| No-account persistent saved selection | JW-WISHLIST | Save controls and wishlist panel | `jw-stone-marketplace-state` | Versioned bounded local-storage envelope | Persistence, failure recovery, maximum, stale ID, clear and empty tests |
| Truthful accessible cards and details | JW-CARDS | Four workspaces, gallery dialog | `jw-stone-marketplace-ui` | Catalog presentation model | Field-selection, keyboard, touch, save state, anonymous, responsive proof |
| Contact only after deliberate action | JW-DIRECT-CONNECT | Single-card and wishlist inquiry | `direct-connect-material-handoff` | Existing express-request endpoint with backward-compatible safe context | No pre-submit fetch, scalar regression, bounded multi payload, server sanitation |
| Desktop, mobile, keyboard, reduced motion | JW-A11Y | Every stage and overlay | `jw-stone-marketplace-ui` | Semantic DOM and UI primitives | Automated a11y contracts plus 1440/390 real-browser inspection |
| Accurate canonical and safe sharing | JW-SEO | Server HTML, sitemap, discovery URLs | `jw-stone-public-metadata` | Route metadata helper and URL parser | SSR/sitemap extraction and forbidden metadata scans |
| Evidence before merge or deployment | JW-PROTECT | Branch, draft PR, release gate | `existing-jw-profile` | Git and verification ledger | Exact commands, counts, revision, screenshots, diff, branch and PR state |

Feature state begins at `specified`. Implementation may advance individual requirements only after their code is wired and reachable; verification requires exact observed proof recorded in the build evidence.
