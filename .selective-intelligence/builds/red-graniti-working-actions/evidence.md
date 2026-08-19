# R.E.D. Graniti working actions — evidence

## Reported failure

The production R.E.D. Graniti website recreation rendered, but the owner reported that none of its controls responded. Production request logs showed repeated successful page and profile-data loads for `/u/red-graniti`, while no corresponding first-cut call reveal or express-request endpoint was reached during the reported interaction window.

The visible page was therefore not enough. The release failed the primary human action test even though the build and deployment had succeeded.

## Corrected outcome

The existing R.E.D. presentation remains unchanged. This correction makes the interaction boundary resilient to both failure classes:

1. A stale `pointer-events: none`, `pointer-events-none` class, or `inert` attribute left behind by a prior dialog or interrupted route transition.
2. A rendered control whose React synthetic click fails to open the expected R.E.D. contact panel.

## Recovery behavior

On the exact R.E.D. profile only:

- The page clears stale interaction locks from the document and the R.E.D. root when no real modal is open.
- Links, buttons, inputs, selects, and textareas are explicitly restored to `pointer-events: auto`.
- A mutation observer catches a stale lock that reappears after route mount.
- Pointer and keyboard entry re-check interactivity before an action.
- The existing protected Call panel and detailed first-cut request panel remain the preferred path.
- If the expected panel does not appear after the click, Call falls back to the native managed telephone action.
- If the expected request panel does not appear, the control falls back to a prefilled Direct Connect route targeted to the JW Stone operating profile with R.E.D. first-cut context.

## Covered actions

- Desktop Call
- Mobile Call
- Desktop Start a Request
- Mobile Start a Request
- Request a Quote
- Start a Request inside the quotation action
- Get a Quotation Now
- Section navigation and ordinary official links remain native anchors and become usable once the interaction lock is cleared.

## Boundaries preserved

- R.E.D. Graniti remains a TradeScout-admin-controlled company profile.
- The fallback does not hardcode an owner account id or transfer profile ownership.
- JW Stone remains the operating recipient for first-cut requests.
- The managed phone remains `(850) 543-0748`.
- No inventory, physical availability, distribution territory, or Stone Core record changes.
- JW Stone, ISSA Build, and every other profile remain outside this exact-profile recovery boundary.

## Completion standard

A successful build is not sufficient. Completion requires:

- Production deployment live on the exact revision.
- Page and profile data load successfully.
- Call produces either the protected contact panel or the native telephone destination.
- Start a Request produces either the detailed first-cut panel or the prefilled Direct Connect destination.
- No stale document interaction lock remains after a closed or interrupted dialog.
