# Complete Steel-Home Packages draft profile source record

Last reviewed: 2026-08-11

Operator-approved working profile. It is intentionally unlisted while ownership, final brand identity, service area, contact routing, and any future media are decided.

## Current identity and route

- Working display label: **Complete Steel-Home Packages**.
- Temporary and canonical working slug: `steel-home-packages`.
- Exact review route: `/u/steel-home-packages`.
- Identity, route, release state, approved copy, and Direct Connect entry path are centralized in `shared/steelHomePackagesProfile.ts`.
- The profiles schema has only `draft` and `published`; the row uses `published` solely so the exact route can render. The linked business remains `draft`, public discovery stays disabled, and the shared release state remains `unlisted`.

## Approved scope

- Primary audiences: owner-builders, builders, and contractors.
- Available now: steel structures and metal-building packages, cabinet packages, and natural stone.
- Housing paths: full-size steel homes are the first focus; the next-generation single-wide line is in development; steel tiny homes are a future line.
- Mini-split heating and cooling and electric or gas tankless water heating are preferences only where layout, load, climate, code, manufacturer, utility, and project conditions support them.
- Final decisions remain subject to project location, local codes and amendments, zoning, structural loads, flood conditions, energy rules, utilities, engineering, permits, and inspections.
- HomeID is described only as a long-term goal for preserving verified home records. It is not presented as an included or currently available package feature.

## Evidence and public-claim boundary

- This v1 profile is text-first. It contains no stock, generated, or borrowed home imagery.
- Do not add prices, financing terms, production volume, delivery coverage, testimonials, ratings, certifications, guarantees, schedules, or supplier relationships without attributable approval and evidence.
- Do not publish a final company name, person, phone, email, street address, website, service area, or owner identity until those decisions are confirmed.
- The disclosure in the shared content is required. Construction, engineering, permitting, inspections, financing, insurance, warranties, and regulated services remain with the appropriate qualified providers and authorities.

## Direct Connect and HomeID

- Both **Start a Request** actions use the existing Direct Connect route with `profile`, `profileName`, `source`, `intent`, and `subject` context preserved.
- The backend resolves the same exact profile slug before creating a targeted request. Contact remains inside the existing gated workflow.
- HomeID has no CTA on this draft. It remains a stated long-term recordkeeping goal only.

## Unlisted visibility contract

Until the shared `publiclyReleased` switch is deliberately changed, this profile must:

- resolve only at the exact canonical profile URL and as a targeted Direct Connect destination;
- remain absent from public profile search, maps, directory discovery, profile sitemaps, and profile-specific `llms.txt` output;
- emit `noindex` at both server-rendered and client-rendered boundaries;
- emit no Organization or LocalBusiness structured data;
- keep its linked business in `draft` with `publicDiscoveryEnabled: false` and the exact operator-approved provisioning source marker.

## Future owner decisions and rename path

Publication requires explicit decisions for the final brand name, owner account, private request routing, service territory, supported package scope, evidence, and any real media. These decisions are not inferred by the current draft.

For a future rename:

1. Update the centralized display label, canonical slug, and route in `shared/steelHomePackagesProfile.ts`.
2. Keep the current slug as the temporary/legacy slug. The idempotent provisioner will migrate the one matching business and profile only after confirming there are no duplicate or ownership conflicts.
3. Add a permanent 301 from `/u/steel-home-packages` to the new canonical slug, following the existing single-record alias pattern.
4. Update the exact Direct Connect profile context and contract tests.
5. Change `publiclyReleased` only in the same reviewed release that activates the linked business and intentionally enables the approved discovery surfaces.

No database migration is required for the draft or rename path.
