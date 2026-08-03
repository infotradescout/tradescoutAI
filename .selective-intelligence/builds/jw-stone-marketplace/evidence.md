# Build Evidence: jw-stone-marketplace

Verdict: source and test implementation aligned; as-built partial because exact rendered browser proof is unavailable; release blocked

Working branch: `repair/jw-stone-2-luxury-below-hero`

Local base revision: `f8a59e47d1a3e822084f1654b04298debd49b0a6`

Base against `main`: `10cbc151c6952904cdd32a5d6205fee890614d9a`

Published branch revision before this correction: `8c02f82d377a8ce828e4f0926a5c5958bb365541`

Draft pull request: `https://github.com/infotradescout/tradescoutAI/pull/264`

Environment: isolated feature branch; production, `main`, DNS, database schema, and the existing JW profile remain untouched

## Authorized correction

The product owner rejected the buyer-to-color gate and the four-workspace interpretation. Customer paths are not the product, a filter, a questionnaire, or a replacement page. Each path is now one compact click that exposes actual source-attributed knowledge and up to six evidence-safe real JW selections while the same complete storefront remains visible.

`AMEND-AUDIENCE-LENS` and `AMEND-CATALOG-SNAPSHOT-TRUTH` supersede the earlier workspace proof. Catalog presence and recorded source counts are supplied-source evidence rather than live quantity or availability. The approved `Current Inventory` heading remains customer-facing wording; current availability still requires a deliberate inquiry.

## Implemented correction

- The active `/jw-stone` route renders the protected JW header, restored profile-owned hero wording, First Cut, one compact customer-path guide, one always-visible collection, the protected footer, galleries, saved stones, and deliberate Direct Connect.
- Real stone appears immediately. Twenty-four named selections render initially; the visitor can progressively reach all 110 named selections, while 38 publicly anonymous presentations remain a separate horizontal photography rail.
- Fabricator, Builder & Developer, Architect & Designer, and Homeowner buttons reveal two source-linked knowledge points and six real named selections with visible factual reasons.
- Customer-path state never reaches catalog filtering, ordering, card facts, detail facts, wishlist behavior, or contact behavior.
- Search, color, material, finish, verified origin, and named detail state are independent and optional. Active material and finish values remain visible even when another refinement produces no overlap.
- One click opens a named stone. The URL does not manufacture buyer or color state.
- The route-local projection remains 148 selections and 433 supplied photographs: 110 named selections and 38 anonymous presentations. Panda remains one five-photo selection.
- All four guidance rails reject missing, duplicate, anonymous, or unshareable items. Designer and Homeowner use the six existing owner-curated JW Stone Picks; Fabricator and Builder use deterministic documentation/source-review rules.
- Current production data exposes zero verified origins and zero First Cut products. Origin UI appears only for explicitly verified fixture data; three owner-authorized First Cut positions remain non-product placeholders.
- Saving never starts contact. Anonymous presentations cannot be saved, shared, named publicly, or sent into Direct Connect.
- The old active `BuyerJourney` / `BuyerWorkspace` implementation and the two unrouted `jw-stone-2` duplicate directories were removed so the rejected staged model cannot be restored accidentally. The deletions remain recoverable from Git.

## Protected boundary

The following remain diff-clean and behaviorally separate:

- existing `/u/jw-stone` route and profile renderer;
- `client/src/data/jwStoneProfilePresentation.ts`;
- custom-domain profile routing and presentation settings;
- canonical source inventory;
- database schema, migrations, and production state.

The rejected branch sentence about choosing a role, color, and workspace was not restored. The hero uses the profile-owned approved sentence: “Search the full collection or ask JW Stone about your project.”

## Source and truth review

Independent truth review passed:

- all eight knowledge points map to the sealed Use Natural Stone or Natural Stone Institute sources;
- all four six-item rails follow their deterministic or owner-curated rules;
- each displayed item reason matches catalog evidence;
- no live availability, audience preference, suitability, origin, pricing, performance, or First Cut product claim is invented;
- anonymous items remain nameless, unshareable, and unsaveable.

Independent product/scope review passed:

- the active route never gates or replaces the collection;
- the complete ordered 148-item rendered identity set is invariant across every path;
- all four paths are covered at 1440- and 390-pixel widths;
- stale staged renderers are deleted and guarded by the routing contract;
- protected profile sources and page chrome remain unchanged.

## Verification

Commands were run against the current working tree after the correction:

- Focused JW inventory, route, profile, guidance, wishlist, origin, Direct Connect, metadata, and rendered-DOM suite: 18 files passed, 86 tests passed.
- Repository-wide Vitest suite: 526 files passed, 3,710 tests passed; 24 files and 131 database-only tests were intentionally skipped by the repository gate.
- `npm run check`: passed.
- `npm run build`: passed; 3,989 modules transformed, public landing bundle verified, 544 built JavaScript asset URLs verified, and server bundle built.
- ESLint on the amended route, guide, filters, and visual contract: zero errors. Remaining warnings are pre-existing non-null assertions in catalog/state tests and implementation.
- `git diff --check`: passed.
- Playwright discovery: two journeys register, one desktop and one mobile. Each exercises all four customer paths, complete 148-item order invariance, compact-guide bounds, overflow, filters, detail access, anonymous protection, wishlist persistence, and no contact mutation.

## Rendered-browser gate

No visual approval or screenshot is claimed.

The Playwright web-server configuration originally resolved `server/index.ts` from `tests/`; that harness defect was fixed by pinning the repository working directory. The real application server then started and served the route.

The remaining failure occurs before a page or browser context exists:

1. Playwright 1.57 requires Chromium build `chromium_headless_shell-1200`.
2. The official installer reached every configured mirror, but this environment returned empty archives or `GatewayExceptionResponse`; the exact browser could not be installed.
3. A registry-delivered `@sparticuz/chromium@143.0.4` fallback was extracted and passed to Playwright with its documented launch arguments.
4. That executable launched and exited before the debugging pipe or first page existed. Both desktop and mobile journeys therefore stopped before page load.

Consequences:

- the desktop/mobile assertions are implemented and discoverable but not observed in a real rendering engine here;
- no screenshot, console review, horizontal-overflow observation, or measured guide height is claimed;
- draft PR publication is allowed, but merge, deployment, or visual approval remains blocked until the exact PR head runs in a browser-capable environment and the captures are reviewed.

Expected evidence directory after that gate succeeds: `artifacts/jw-stone-2/`.

## Release boundary

The existing draft PR may be updated with this correction. It must remain unmerged and undeployed. No production, `main`, DNS, migration, or current-profile action is authorized by this build.
