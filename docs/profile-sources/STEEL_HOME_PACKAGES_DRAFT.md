# Steel Home Project Workspace source record

Last reviewed: 2026-08-12

Operator-approved unlisted profile. It remains unlisted while final ownership, service area, commercial workflows, fulfillment routing, and customer-support responsibilities are completed.

## Governing public truth

- The public identity is **TradeScout Steel Home Project Workspace**. Fulfillment-company and trade-partner names do not appear in public page copy, labels, links, visible handoffs, image descriptions, or customer-facing asset URLs.
- TradeScout owns every customer-facing designer, saved project, project summary, request, and conversation.
- The page starts by identifying whether the customer is a self-contracted homeowner, already has a builder, is a builder or contractor, or needs help managing the whole build.
- The page contains three working project tools: a steel-building and included-roof preview designer, a photo-backed natural-stone-and-engineered-quartz countertop designer, and a cabinet-layout designer.
- The building and cabinet tools show itemized early estimates. Stone and every added home need stay visibly marked **Quote needed** and are never represented as free or included in a numeric total.
- Customers may add house plans, windows and doors, insulation, interior framing/drywall/trim, flooring, plumbing and electrical fixtures, mini-split HVAC, tankless water heating, appliances, appliance or home-systems protection, site/foundation work, septic/utilities, and installation support to their project. These are customer selections, not product-availability or fulfillment claims.
- This is not an all-in-one homebuilder, turnkey-home, complete-package, architectural, engineering, or permit-plan product.
- Customers may include any design or added home need in a TradeScout project request. Local trade work remains a separate, location-aware request.
- No request is submitted while the customer plans. Direct Connect opens only after a role, city/address, canonical state and county, and at least one design or home need are present.
- Early material estimates are not quotes. Taxes, site work, foundation, and installation are excluded unless a line says otherwise. Final field measurements, structural engineering, location requirements, codes, permits, product specifications, availability, delivery, fabrication, and installation work are confirmed in writing before approval.

## Current identity and route

- Database and user-facing label: **Steel Home Project Workspace**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, and fallback Direct Connect paths are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`; the row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Customer-facing tools

### Building preview designer

- Controls intended use, width, length, eave height, roof style and pitch, wall/roof/trim colors, garage-door openings, exterior entry doors, windows, porch, porch depth, and notes.
- The live SVG preview changes with the selected dimensions, roof, colors, openings, and porch.
- The output is explicitly an early preview, not structural engineering or a permit drawing.
- The completed design carries its exact values into the TradeScout project summary.
- The itemized early material estimate uses temporary public prices. The base metal roof is included once with the building shell; roof upgrades may add an estimated price but never create a second base-roof charge. Site work, foundation, engineering, taxes, and installation remain outside this estimate.

### Photographed natural-stone-and-engineered-quartz countertop designer

- `JW_STONE_NAMED_CATALOG` is the sole customer-selectable stone authority.
- Every option must retain the exact catalog ID, public stone name, confirmed material label when present, and exact inventory photograph belonging to that record.
- Anonymous or placeholder arrivals are excluded because they cannot truthfully become a named customer selection.
- The customer-facing image URL uses the vendor-neutral `/images/stone-designer/:stoneId/:imageNumber.webp` route. The server resolves it to the exact named catalog photograph and refuses anonymous records.
- Controls room, straight/L/U layout, wall runs, optional island, edge, backsplash, sink and cooktop cutouts, and notes.
- The displayed square footage is an approximate area. Final templating and field measurement remain required.
- The selected public name, material, measurements, cutouts, and approximate area carry into the TradeScout project summary. Internal record IDs and asset paths do not appear in customer-facing copy.
- Do not introduce generated stone textures, stock slab photography, invented names, or image/name mismatches.

### Cabinet designer

- Controls room, layout, wall and ceiling dimensions, door style, finish, hardware, upper height, refrigerator/range/sink-base sizes, pantry and drawer-base groups, optional island, and notes.
- The live elevation changes with the selected modules, style, finish, measurements, uppers, and island.
- Module width is compared with the primary wall as an early fit warning, not a final cabinet order or shop drawing.
- The completed design carries its exact values into the TradeScout project summary.
- The itemized early material estimate uses temporary linear, module, hardware, trim, island, and delivery prices. Countertops, field measurement, taxes, and installation remain outside the estimate. It is not a catalog price, bill of materials, or order.

## Private fulfillment relationships

The following are internal operational relationships only. Their names must not be projected into the public tools page or initial Direct Connect handoff:

- Worldwide Steel Buildings: prospective structure/roof system fulfillment and later manufacturer documentation.
- JW Stone Logistics: source inventory and operational natural-stone fulfillment.
- A+ Cabinets: prospective cabinetry fulfillment.

These identities may appear later only where the controlling manufacturer specification, certification, warranty, quote, order, invoice, delivery, or legally required disclosure genuinely requires the responsible entity. Their private presence does not authorize public co-branding, exclusivity claims, territory claims, dealer economics, discounts, or commission statements.

## Direct Connect

- The project action targets the unlisted `steel-home-packages` profile under the visible name **Steel Home Project Workspace**.
- That recipient label is valid only while the profile and linked business share a verified TradeScout `head_admin` or `super_admin` owner. The public route, provisioner, and request-creation route all fail closed if custody changes.
- The customer sees a concise project summary, the estimated range, the **Quote needed** list, and expandable project details before opening Direct Connect.
- The same title, description, location, timing, role, selected packages, and added home needs are projected into the existing request fields.
- The project summary includes only designs and home needs the customer deliberately selects.
- The selected stone's public name and material are retained whenever the countertop design is included; private record IDs and image paths remain out of the customer summary.
- The active handoff stores the sanitized context for ten minutes in tab-scoped browser storage and puts an opaque token plus non-sensitive destination fields in the Direct Connect URL. If the private token is unavailable or expires, the request still opens the correct TradeScout destination without exposing the jobsite or project details. The existing query parser remains as a compatibility fallback for other entry routes.
- The project route removes stale intent, contractor, provider, or target parameters before opening the TradeScout handoff.
- The labor route deliberately omits `profile`, `profileName`, `target`, provider, contractor, and business identifiers. It sends the selected jobsite county FIPS and matching state into Direct Connect, so routing does not fall back to the requester's account county, while retaining concise related-design details.
- Existing Direct Connect authentication, contact, consent, and creation gates remain authoritative. The tools never submit a request directly.

## Media and visual-claim boundary

- Building and cabinet imagery is design-direction imagery, not a fulfillment company's completed-project claim.
- Stone imagery is exact existing inventory photography tied to named catalog records.
- Customer-facing stone image aliases must continue resolving to those records; an alias must never substitute a generated or unrelated image.
- Do not add borrowed project photography, testimonials, ratings, prices, financing terms, production volume, delivery coverage, certifications, guarantees, or schedules without attributable approval and evidence.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future owner decisions and rename path

Publication requires explicit decisions for the final owner account, service territory, customer payment flow, private fulfillment routing, manufacturer attribution, returns, freight claims, warranty support, and approved media. Those decisions do not change the default public rule that TradeScout owns the customer-facing experience.

For a future slug change:

1. Update the centralized canonical slug and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary or legacy slug. The idempotent provisioner will migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the same reviewed release that activates the linked business and intentionally enables the approved discovery surfaces.

No schema migration is required for this project-center correction. The v5 saved project remains device-local in this phase. Existing v4 projects migrate to the self-contracted role language without losing selected designs. A durable, account-backed project/version/quote record is still required before this becomes a cross-device customer workspace.
