# Build Evidence: jw-stone-marketplace

Verdict: partial as-built; implementation and automated verification complete, rendered visual approval blocked

Tested code revision: `a5938e4f838ccfe0187ea7636ba051d82c274716`

Branch: `codex/jw-stone-2-0-current-main`

Base revision: `999481b602c2f99499c69a0c90b3840d4af0a158`

Environment: isolated feature worktree; production, `main`, DNS, database schema, and the current JW profile untouched

## Planned versus actual

All twelve locked requirements were implemented on current `main` as a separate `/jw-stone` experience. The implementation contains:

- Buyer-first, then color-first discovery with reversible and shareable URL state.
- Five image-audited editorial color directions covering all 119 current inventory presentations exactly once.
- Four materially different buyer workspaces: Fabricator Desk, Builder Project Room, Designer Selection Board, and Homeowner Stone Finder.
- Real named-stone search and filters derived from canonical material, finish, size, source-count, translucency, and verified-origin data.
- A truthful 119-record projection: 109 source-named stones, 10 publicly nameless Trending Selection presentations, and 433 verified source images.
- Three data-driven First Cut reveal positions with zero stone assignments and no path into inventory, search, metadata, storage, or contact.
- A verified-only nullable origin contract. Production inventory exposes zero origins and therefore no origin filter; a React fixture proves the real card/workspace rendering path when a verified value is supplied.
- A versioned, bounded 50-item local-browser wishlist with safe failure for unavailable, corrupt, stale, removed, or quota-failed storage.
- Optional bounded single/plural Direct Connect handoff for named stones only. Saving and browsing perform no contact mutation; anonymous public IDs or labels cannot enter the handoff; scalar and plural payloads are mutually exclusive.
- Image-led cards, keyboard gallery controls, touch swipe handling, reduced-motion handling, responsive structures, and a platform-overlay-free flagship route.
- Server and client canonical metadata, `CollectionPage` structured data, social metadata, crawler fallback, and sitemap/sitemap-index inclusion.

The existing `/u/jw-stone` path, JW custom-domain routing, canonical inventory source, `WholesalerProfileTheme`, profile editing, database presentation state, migrations, and existing Direct Connect scalar consumers were not changed.

## Independent comparison and branch recovery

The previously pushed prototype remains preserved at `origin/feature/jw-stone-2-0` revision `5da5e52d0280266d3f2ef2b5d7337d8b57de7d84`. It was inspected and its 56 focused tests plus TypeScript passed at that exact revision. It was not overwritten or force-pushed.

The current-main implementation was retained as the safety spine because it adds named search, image-audited classification, catalog-validated filters, a verified First Cut assignment contract, real React origin proof, bounded wishlist/contact limits, scalar/plural exclusivity, all-asset verification, stronger route/profile regressions, and `CollectionPage` metadata. One prototype improvement was ported: `/jw-stone` suppresses platform prompts and overlays. The two implementations were not combined wholesale.

## Validation results and feature states

Exact tested code revision `a5938e4f838ccfe0187ea7636ba051d82c274716`:

- `npm run verify:local` under Node 20: passed.
  - Forbidden-pattern, law-drift, architecture-hygiene, HTTP-semantics, authority-gate, observability, Direct Connect, and sitemap-integrity guards passed.
  - Production build passed, including sitemap generation, Vite client build, public-landing bundle checks, built-asset URL checks, and server bundle.
  - Broad test result: 523 test files passed; 3,682 tests passed; 24 files and 131 database-only tests intentionally skipped by the repository's local gate.
- Focused JW Stone 2.0 and Direct Connect verification: passed, including buyer/color gating, four workspace structures, URL restoration, catalog truth, forbidden labels, origin fixtures, First Cut isolation, wishlist failure modes, route separation, metadata, anonymous request safety, and scalar/plural handoff.
- Asset verification: passed for all 433 canonical inventory images plus the JW logo, hero, and social assets.
- Existing JW profile, inventory, adapter, presentation, custom-domain, social-preview, sitemap, and Direct Connect regression sets: passed.
- TypeScript, theme audit, blur audit, architecture caps, and `git diff --check`: passed.
- Playwright discovery: two journeys register and define fifteen desktop/mobile evidence captures.

Feature state is `verified` for canonical inventory integrity and SEO contracts. Route, journey, workspaces, First Cut, origin presentation, wishlist, cards, Direct Connect, accessibility, and the total release protection remain `usable` rather than `verified` because their acceptance contracts include real rendered browser review.

## Browser evidence and blocker

No visual proof is claimed.

The local static preview served `/jw-stone`, but every available Chromium launch path failed before page startup. The Playwright/Puppeteer launch error was `Failed to launch the browser process: Code: null`; direct Chromium exited with `SIGTRAP`/code 133 because this sandbox does not provide the process filesystem required by the browser. No cloud-browser capability is available in this workspace.

Consequences:

- No desktop or mobile screenshot was produced.
- No exact-head visual review, console inspection, mobile swipe journey, or real return-visit persistence journey can be claimed.
- The branch may be pushed and opened as a held draft PR, but it must not be merged, deployed, or called visually approved until the fifteen-shot Playwright journey runs successfully in a browser-capable environment and the captures are reviewed.

Expected screenshot directory after that gate succeeds: `artifacts/screenshots/jw-stone-2/`.

## Release boundary

The tested code is committed locally and the normal HTTPS push was rejected because this workspace has no Git username credential. Publication will use the connected GitHub account to create a new branch and held draft PR. The existing prototype branch remains untouched. This build does not authorize a merge, deployment, production migration, DNS change, or existing-profile replacement.
