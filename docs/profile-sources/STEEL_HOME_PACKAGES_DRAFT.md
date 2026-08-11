# Steel Home Packages draft profile source record

Last reviewed: 2026-08-11

Operator-approved working profile. It is intentionally unlisted while ownership, final brand identity, service area, contact routing, and any future media are decided.

## Current identity and route

- Working display label: **Steel Home Packages**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, and Direct Connect entry path are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`; the row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Approved scope

- Primary audiences: owner-builders, builders, and contractors.
- Phase 1 covers only three material categories:
  - metal structure and roofing through the existing Worldwide Steel Buildings relationship;
  - natural stone through JW Stone Logistics;
  - cabinets through A+ Cabinets in Ocean Springs.
- The Worldwide Steel Buildings 3D Building Designer is the approved starting tool for a customer-created structural concept. It does not replace final engineering or permit documents.
- No future material category, whole-home completion claim, single-wide concept, tiny-home concept, mechanical preference, warranty program, financing program, or HomeID feature belongs on the Phase 1 page.
- Final decisions remain subject to the jobsite, written supplier scopes, engineering, permits, inspections, code requirements, delivery conditions, and installation responsibility.
- TradeScout labor matching is a separate service path. A visitor may request labor only or labor pricing alongside the Phase 1 materials without assigning that request to a material supplier.

## Evidence and public-claim boundary

- This Phase 1 profile is text-first. It contains no stock, generated, or borrowed home imagery.
- Do not add prices, financing terms, production volume, delivery coverage, testimonials, ratings, certifications, guarantees, schedules, or additional supplier relationships without attributable approval and evidence.
- The three named Phase 1 partner relationships are owner-confirmed. Their written agreements and project quotes remain controlling for economics, territory, scope, and warranty terms.
- Do not publish a final company name, person, phone, email, street address, website, service area, or owner identity until those decisions are confirmed.
- The disclosure in the shared content is required. Construction, engineering, permitting, inspections, financing, insurance, warranties, and regulated services remain with the appropriate qualified providers and authorities.

## Direct Connect

- Both **Start a Package Request** actions use the existing Direct Connect route with `profile`, `profileName`, `source`, `intent`, `subject`, title, and Phase 1 intake context preserved.
- The backend resolves the same exact profile slug before creating a targeted package request. Contact remains inside the existing gated workflow.
- Every **Start a Labor Request** action opens the canonical Direct Connect work-request composer with labor intake context prefilled.
- The labor route deliberately omits `profile`, `target`, and provider identifiers. It must remain available for labor-only visitors and route by the actual project location instead of assigning the work to Worldwide Steel Buildings, JW Stone Logistics, A+ Cabinets, or the temporary profile steward.
- Package purchasing and labor matching remain distinct requests. A customer who needs both may create both.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future owner decisions and rename path

Publication requires explicit decisions for the final brand name, owner account, private package-request routing, service territory, partner evidence, and any real media. The Phase 1 material scope is already fixed to the metal structure, natural stone, and cabinets unless Thomas explicitly changes it.

For a future rename:

1. Update the centralized display label, canonical slug, and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary/legacy slug. The idempotent provisioner will migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the same reviewed release that activates the linked business and intentionally enables the approved discovery surfaces.

No database migration is required for the draft or rename path.
