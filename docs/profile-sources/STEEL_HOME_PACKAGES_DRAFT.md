# Steel Home Packages working profile source record

Last reviewed: 2026-08-11

Operator-approved working profile. It remains unlisted while the final brand identity, owner account, service area, resale operations, and contact routing are completed.

## Current identity and route

- Working database label: **Steel Home Packages**.
- User-facing experience label: **TradeScout Steel Home Studio**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, and Direct Connect entry paths are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`; the row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Customer relationship and operating model

- TradeScout is the customer's package contact from the first request through outside ordering and package coordination.
- The customer starts a TradeScout request, shares the property and design starting point, reviews a TradeScout-coordinated written scope, and returns to TradeScout with package questions or problems.
- Public marketing must not hand the visitor to a maker, distributor, dealer, or affiliate checkout. Do not publish outside-company cards, outbound purchase links, or relationship labels on this page.
- Product makers, model numbers, certifications, written warranty parties, freight terms, exclusions, and local professional responsibilities are disclosed in the final written scope when relevant.
- A company name can appear in product specifications or the final quote when accuracy, certification, warranty, or customer consent requires it. That disclosure does not change TradeScout's role as the package contact.
- Do not claim that a product is private-label, white-label, exclusive, or sold by TradeScout until the controlling agreement, resale requirements, payment flow, returns, freight damage, and warranty workflow are documented.

## Approved public scope

- The public package covers only three material choices: metal structure, natural stone, and cabinets.
- A visitor may choose one, two, or all three. No whole-home completion claim is made.
- The visitor may begin with plans, a 3D concept, a sketch, photos, or only a starting idea.
- No future material category, tiny-home concept, mechanical preference, warranty program, financing program, or HomeID feature belongs on this page.
- TradeScout labor matching is a separate location-aware request. A visitor may request labor by itself or alongside the material package without assigning the labor request to a material source.
- Final decisions remain subject to the jobsite, written scope, engineering, permits, inspections, code requirements, delivery conditions, availability, and installation responsibility.

## Internal Phase 1 sourcing record

These relationships support behind-the-scenes scoping. They are not public page copy or outbound customer destinations.

- Metal structure and roofing: the existing Worldwide Steel Buildings relationship.
- Natural stone: JW Stone Logistics.
- Cabinets: A+ Cabinets in Ocean Springs.
- Owner confirmation is the current source of relationship evidence. Written agreements and project quotes remain controlling for economics, territory, scope, lead time, freight, and warranty terms.
- Future category candidates and open programs are tracked separately in `STEEL_HOME_PACKAGE_GAP_COVERAGE.md`. Nothing in that research file is approved public inventory.

## Media and visual-claim boundary

- The exterior and cabinet scenes are original AI-generated design-direction imagery created for this profile. They are labeled as inspiration, not completed TradeScout projects.
- The stone interior and slab images are existing TradeScout/JW Stone collection assets. They show material direction and do not establish live availability or a project-history claim.
- Do not add borrowed builder portfolio photography, customer testimonials, ratings, prices, financing terms, production volume, delivery coverage, certifications, guarantees, or schedules without attributable approval and evidence.
- Image-generation record:
  - Exterior: built-in image generation; photorealistic, premium-but-attainable Gulf South steel home, charcoal metal, warm wood porch, natural-stone accents, wide hero composition, no logos, text, or people.
  - Cabinets: built-in image generation; warm premium steel-home kitchen, white-oak cabinets, soft off-white uppers, quartzite island, no logos, text, or people.

## Direct Connect

- Every package action uses the existing Direct Connect route with `profile`, `profileName`, `source`, `intent`, `subject`, title, and package intake context preserved.
- The backend resolves the same exact profile slug before creating the targeted package request. Contact remains inside the existing gated workflow.
- Every labor action opens the canonical Direct Connect work-request composer with labor intake context prefilled.
- The labor route deliberately omits `profile`, `target`, and provider identifiers. It routes by the actual project location instead of assigning work to a material source or the temporary profile steward.
- Package purchasing and labor matching remain distinct requests. A customer who needs both may create both.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future owner decisions and rename path

Publication requires explicit decisions for the final brand name, owner account, private package-request routing, service territory, customer payment flow, sourcing evidence, returns, freight claims, and warranty support. The public material scope remains metal structure, natural stone, and cabinets unless the operator explicitly changes it.

For a future rename:

1. Update the centralized display label, canonical slug, and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary or legacy slug. The idempotent provisioner will migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the same reviewed release that activates the linked business and intentionally enables the approved discovery surfaces.

No database migration is required for the draft or rename path.
