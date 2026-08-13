# Steel Home Planning Tools source record

Last reviewed: 2026-08-13

Operator-approved unlisted profile. It remains unlisted while final ownership, service area, commercial workflows, fulfillment routing, and customer-support responsibilities are completed.

## Current delivery truth

- The public identity is **Steel Home Planning Tools**.
- The current product is exactly three separate planners in this order: **Countertops**, **Cabinets**, and **Metal Buildings**.
- Each planner works independently and has its own **Start a Request** path.
- The Countertop Planner uses real catalog photos, shows approximate area, and marks pricing **Quote needed**.
- The Cabinet Planner shows a live preview and early price estimate.
- The Metal Building Planner shows a live preview and early price estimate.
- The planner intake recognizes **Self-contracted homeowner**, homeowner with a builder, builder or contractor, and customers who need project-management help. The wording does not promise that TradeScout has already selected a trade professional.
- A request requires a role, city or address, canonical state and county, and one active planner. Saved legacy whole-home selections remain in older local drafts but are not displayed and do not make a current request ready.
- A current planner request contains only the active planner. Other saved planner data is not added automatically.
- This release has no whole-home planner, unified project dashboard, setup workspace, progress tracker, or combined-project review.
- Early estimates are not quotes. Taxes, site work, foundation, and installation are excluded unless a line states otherwise. Final field measurements, structural engineering, location requirements, codes, permits, product specifications, availability, delivery, fabrication, and installation work are confirmed in writing before approval.

## Current identity and route

- Database and user-facing label: **Steel Home Planning Tools**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, and fallback request paths are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`. The row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Countertop Planner

- `JW_STONE_NAMED_CATALOG` is the customer-selectable surface authority.
- Every option retains the exact catalog ID, public surface name, confirmed material label when present, and exact inventory photograph belonging to that record.
- The common material name for man-made quartz is **Engineered Quartz**. Natural quartzite is labeled **Quartzite**. Those materials must not be collapsed into one term.
- Anonymous or placeholder arrivals are excluded because they cannot truthfully become a named customer selection.
- Customer-facing images use the vendor-neutral `/images/stone-designer/:stoneId/:imageNumber.webp` route. The server resolves each request to the exact named catalog photograph and refuses anonymous records.
- Controls room, straight, L-shaped or U-shaped layout, wall runs, optional island, edge, backsplash, sink and cooktop cutouts, and notes.
- The displayed square footage is an approximate area. Final templating and field measurement remain required.
- The selected public name, material, measurements, cutouts, and approximate area carry into the Countertop Planner request. Internal record IDs and asset paths do not appear in customer-facing copy.
- Do not introduce generated stone textures, stock slab photography, invented names, or image and name mismatches.

## Cabinet Planner

- Controls room, layout, wall and ceiling dimensions, door style, finish, hardware, upper height, refrigerator, range and sink-base sizes, pantry and drawer-base groups, optional island, and notes.
- The live elevation changes with the selected modules, style, finish, measurements, uppers, and island.
- Module width is compared with the primary wall as an early fit warning, not a final cabinet order or shop drawing.
- The completed design carries its exact values into the Cabinet Planner request.
- The itemized early price estimate uses temporary linear, module, hardware, trim, island, and delivery numbers. Countertops, field measurement, taxes, and installation remain outside the estimate. It is not a catalog price, bill of materials, or order.

## Metal Building Planner

- Controls intended use, width, length, eave height, roof style and pitch, wall, roof and trim colors, garage-door openings, exterior entry doors, windows, porch, porch depth, and notes.
- The live preview changes with the selected dimensions, roof, colors, openings, and porch.
- The output is an early preview, not structural engineering or a permit drawing.
- The completed design carries its exact values into that planner's request.
- The itemized early price estimate uses temporary public numbers. The base metal roof is included once with the building shell. Roof upgrades may add an estimated price but never create a second base-roof charge. Site work, foundation, engineering, taxes, and installation remain outside this estimate.

## Private fulfillment relationships

The following relationships are internal operations only. Their names must not appear in the public planning tools, initial requests, image descriptions, or customer-facing asset URLs:

- Worldwide Steel Buildings: prospective structure and roof fulfillment and later manufacturer documentation.
- JW Stone Logistics: source inventory and operational natural-stone fulfillment.
- A+ Cabinets: prospective cabinetry fulfillment.

These identities may appear later only where a controlling manufacturer specification, certification, warranty, quote, order, invoice, delivery, or legally required disclosure genuinely requires the responsible entity. Their private presence does not authorize public co-branding, exclusivity claims, territory claims, dealer economics, discounts, or commission statements.

## Start a Request

- The planner action targets the unlisted `steel-home-packages` profile under the visible name **Steel Home Planning Tools**.
- That recipient label is valid only while the profile and linked business share a verified TradeScout `head_admin` or `super_admin` owner. The public route, provisioner, and request-creation route fail closed if custody changes.
- The request description uses **Planner:** when exactly one planner is selected and **Planners:** only for a legacy or defensive multi-planner summary.
- The request includes the active planner's design, estimate or area result, role, location, county, state, and desired timing.
- The selected surface's public name and exact material label are retained whenever the Countertop Planner is active. Private record IDs and image paths stay out of the customer summary.
- The active action stores sanitized details for ten minutes in tab-scoped browser storage and puts an opaque token plus non-sensitive destination fields in the Direct Connect URL. If the private token is unavailable or expires, the request still opens the correct TradeScout destination without exposing the jobsite or design details.
- The request route removes stale intent, contractor, provider, and target parameters before opening TradeScout.
- The reserved local-trade compatibility route remains untargeted and location-aware. It uses the source `steel_home_planning_tools_labor`, but it is not a fourth public planner.
- Existing Direct Connect authentication, contact, consent, and creation gates remain authoritative. The planners never submit a request directly.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future work, not part of this release

A unified or whole-home experience is a future goal only. It must not appear in the current navigation, copy, readiness rules, or request flow. Future work may address broader package coordination, account-backed cross-device projects, quotes, service providers, warranties, payments, and fulfillment after the product and operating rules are separately approved.

Publication still requires explicit decisions for the final owner account, service territory, customer payment flow, private fulfillment routing, manufacturer attribution, returns, freight claims, warranty support, and approved media. Those decisions do not change the rule that TradeScout owns the customer-facing experience.

For a future slug change:

1. Update the centralized canonical slug and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary or legacy slug. The idempotent provisioner may migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the reviewed release that activates the linked business and intentionally enables approved discovery surfaces.

No schema migration is required for this three-planner correction. The v5 saved draft remains device-local. Existing v4 drafts migrate to the self-contracted role language without losing saved planner designs. A durable account-backed record is future work.
