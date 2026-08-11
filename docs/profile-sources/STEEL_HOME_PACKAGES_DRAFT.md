# Steel Home TradePartners working profile source record

Last reviewed: 2026-08-11

Operator-approved unlisted profile. It remains unlisted while the final profile ownership, service area, commercial workflows, and contact routing are completed.

## Governing public truth

- This is a premium showcase of three named TradePartners, not an all-in-one home product.
- TradeScout is not presented as a homebuilder, architect, engineer, manufacturer, or complete-home supplier.
- Each TradePartner keeps a separate public scope and a separate useful next step.
- TradeScout is the go-between for project requests. The customer can explore the real company, product tool, or collection and then continue the exact scope through TradeScout.
- Phase 1 covers only metal structure and roofing, natural stone, cabinets, and an optional separate local-labor request.

## Current identity and route

- Working database and user-facing label: **Steel Home TradePartners**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, partner request contexts, and Direct Connect entry paths are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`; the row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Phase 1 TradePartners and integrations

### Worldwide Steel Buildings

- Public scope: custom steel building kit, metal structure, and roofing system.
- The page links to Worldwide's real [3D Building Designer](https://www.worldwidesteelbuildings.com/3d-building-designer/) and [residential project gallery](https://www.worldwidesteelbuildings.com/projects/type/residential-barndominiums/).
- The 3D tool is described only for the controls Worldwide publicly documents: size, roof style and rise, openings, porches or overhangs, accessories, and exterior colors.
- The TradeScout request asks for the saved design reference, screenshots, plans, project location, intended use, approximate dimensions, known loads, and timing.
- The structural scope is not presented as a complete residential plan. Floor plans, site design, foundation adaptation, energy compliance, utilities, permits, and construction remain separate unless included in writing.
- The generic 3D Designer URL is the current public integration. Replace it with the approved dealer-specific URL or project-code flow as soon as that identifier is available.

### JW Stone Logistics

- Public scope: natural stone.
- The page uses the existing TradeScout JW Stone catalog as the source of current named selections and exact photographs.
- Four real stone records link to their exact `/jw-stone/stones/:slug` pages.
- The full JW Stone collection remains available at `/jw-stone`, including its existing gallery, saved-selection, and request flows.
- The partner-specific TradeScout request asks for the exact stone name or collection link, rooms or uses, approximate quantity, fabrication or installation needs, location, and timing.
- Availability, quantity, dimensions, finish, freight, fabrication, and installation are confirmed for the selected material before approval.

### A+ Cabinets

- Public scope: cabinetry only for this Phase 1 page.
- Public display name: **A+ Cabinets**. Location label: **Ocean Springs, Mississippi**.
- The cabinet request asks for rooms, plans or measurements, cabinet schedule, inspiration, appliance sizes, finish direction, delivery or installation needs, location, and timing.
- Kitchens, bathroom vanities, pantries, built-ins, and storage are supported by the operator-provided relationship and the company's public cabinetry descriptions.
- No cabinet catalog, product line, price, lead time, service territory, or completed-project gallery is invented.
- The current cabinet image is clearly labeled as design inspiration, not A+ completed-project photography. Replace it with approved A+ project media when received.

## Customer relationship and operating model

- The named companies are visible because the page exists to showcase the TradePartners.
- The customer may explore each partner's real tool, catalog, or public examples.
- Partner-specific project requests return to the Steel Home TradePartners coordination profile so TradeScout can remain the go-between.
- Each partner keeps responsibility for its own products, specifications, written quote, warranty, availability, pricing, delivery, and fulfillment terms.
- Structure, stone, cabinets, and local labor remain separate scopes. Do not advertise a combined package, a single whole-home price, or a complete-home delivery promise without a later approved operating model.
- Do not claim private-label, white-label, exclusive, dealer economics, territory, discounts, or commissions on the public page unless the controlling agreement authorizes the exact statement.

## Media and visual-claim boundary

- The exterior image is original steel-home design-direction imagery. It is not presented as a Worldwide completed project.
- JW Stone images are existing TradeScout/JW Stone collection assets tied to exact catalog records.
- The cabinet image is original design-direction imagery. It is not presented as an A+ completed project.
- Do not add borrowed builder photography, testimonials, ratings, prices, financing terms, production volume, delivery coverage, certifications, guarantees, or schedules without attributable approval and evidence.

## Direct Connect

- The generic partner action and all three partner-specific actions use the existing Direct Connect route with the Steel Home TradePartners profile as the coordination target.
- Each partner-specific action carries a distinct source, product subject, title, named TradePartner, and relevant intake questions.
- The backend resolves the exact coordination profile before creating a targeted request. Contact remains inside the existing gated workflow.
- Every labor action opens the canonical Direct Connect work-request composer with labor intake context prefilled.
- The labor route deliberately omits `profile`, `target`, and provider identifiers. It routes by the actual project location instead of assigning labor to a material TradePartner or the temporary profile steward.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future owner decisions and rename path

Publication requires explicit decisions for the final owner account, service territory, customer payment flow, partner routing, dealer attribution, returns, freight claims, warranty support, and approved partner media. The public scope remains the three named TradePartners and separate local labor unless the operator explicitly changes it.

For a future slug change:

1. Update the centralized canonical slug and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary or legacy slug. The idempotent provisioner will migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the same reviewed release that activates the linked business and intentionally enables the approved discovery surfaces.

No schema migration is required for this showcase correction.
