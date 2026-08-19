# TradeScout Admin OS v2 — county coverage

## Owner outcome

County Coverage must operate as one geographic workbench, not a dashboard of metric cards followed by a second card containing filters, a table, a map, and another nested county dashboard.

The operator needs to answer four questions quickly:

1. Which counties have no operating coverage?
2. Which counties have only one required coverage side?
3. Which counties have both a territory manager and an affiliate or partner?
4. What entities, notes, meetings, RSVPs, and interest records are stored inside one county?

## Native workspace

The `geo-map` tool now uses the Admin OS v2 workspace grammar:

- One coverage summary strip
- One filter toolbar
- Coverage List
- County Map & Folder
- Expandable county operating rows
- One county folder
- Controlled assignment dialogs
- Honest loading, empty, and unavailable states

## Coverage truth

Full coverage remains defined by the existing geographic storage rule:

- At least one active territory manager
- At least one active affiliate or partner

Partial coverage means only one required side is present. Unassigned means neither side is present.

The page does not infer coverage from profile visibility, public discovery, user count, county traffic, or an outside business listing.

## Existing read authority

The workspace preserves:

- `GET /api/admin/geo/coverage`
- `GET /api/admin/geo/counties/:countyFips/folder`
- `GET /api/admin/users`
- `GET /api/public-config`

The county folder displays the stored:

- Coverage entities
- County notes
- On-site dates
- RSVP records
- Interest submissions
- County aliases and FIPS identity

## Existing write authority

The workspace preserves:

- `POST /api/admin/geo/seed-counties`
- `POST /api/admin/geo/counties/:countyFips/entities`

The entity assignment path continues to create only:

- `territory_manager`
- `affiliate`
- `partner`

with active status through the existing server route.

No second county-assignment endpoint or client-only coverage state was added.

## Map boundary

The Google Maps view remains optional. Coverage data loads without the map. A missing or failed map key does not block the county list, county folder, filters, assignments, or stored coverage counts.

The map uses the current public-config key path and shows only filtered county markers. It does not determine coverage truth.

## URL continuity

The canonical route remains:

- `/admin/geo/counties`

The existing `view=map` and `fips=<countyFips>` query state remains available for direct county links and operator continuity.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- County FIPS identity
- Geographic table structure
- Coverage calculation rules
- Territory-manager roles
- Affiliate roles
- Partner status
- County notes
- Meetings
- RSVPs
- Interest submissions
- Public county pages
- Public profile discovery
- Request routing
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approvals
- Finance records

## Release proof

Release requires:

- `geo-map` registered as a native Admin OS v2 surface
- Existing county read, seed, folder, user, config, and entity paths preserved
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
