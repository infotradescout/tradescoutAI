# TradeScout Admin OS v2 — commercial work

## Owner outcome

Commercial work must operate as one project-procurement workspace. The former page used a marketing-style command banner, metric tiles, a verification dashboard, a project registry card, a selected-project card, a project-creation card, and a bid-adjudication card stacked together.

The required operator jobs are:

1. Review commercial license and insurance evidence.
2. Select and control an existing project package.
3. Issue addenda and inspect project documents.
4. Review, shortlist, reject, or award bids.
5. Create a new commercial solicitation package.

## Native workspace

The `commercial-directory` tool now uses four operating lanes:

- Projects
- Bid Review
- Verification
- New Project

The workspace uses the Admin OS v2 summary strip, subnavigation, toolbars, lists, empty states, and unavailable states. The former compact-density mode was removed.

## Project authority

The existing project sources remain authoritative:

- `GET /api/admin/commercial-directory/projects`
- `GET /api/commercial-directory/projects/:projectId`
- `POST /api/admin/commercial-directory/projects`
- `PUT /api/admin/commercial-directory/projects/:projectId`
- `POST /api/admin/commercial-directory/projects/:projectId/documents`

Project creation remains multipart and preserves the stored title, summary, scope, requirements, county FIPS, state code, budget guidance, bid due time, project start time, campaign settings, campaign copy, hero image, and initial files.

Project control remains limited to the current status and campaign-enabled fields.

## Bid authority

The existing bid sources remain authoritative:

- `GET /api/admin/commercial-directory/projects/:projectId/bids`
- `PUT /api/admin/commercial-directory/projects/:projectId/bids/:bidId`

The current actions remain:

- `shortlist`
- `reject`
- `accept`

Shortlist and award remain blocked when server-provided eligibility reports an inactive provider, missing provider profile, missing license verification, or missing insurance verification.

Accepting a bid continues to use the existing server action that moves the project to awarded.

## Verification authority

The existing verification sources remain authoritative:

- `GET /api/admin/commercial-directory/verification/pending`
- `POST /api/admin/commercial-directory/verification/documents/:documentId/review`

License and insurance evidence remains subject to human review. The A and R keyboard shortcuts remain available only while the Verification workspace is open and no editable field has focus.

## Public boundary

The existing public landing route remains:

- `/commercial/p/:slug`

The admin workspace controls whether the campaign landing page is enabled but does not change public route ownership, provider eligibility, bid submission rules, or commercial business management.

Commercial business management remains a separate registered admin tool.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- Commercial project schema
- Contractor eligibility rules
- License or insurance verification truth
- Bid amounts or proposals
- Award behavior
- Project status options
- Campaign ownership
- Document storage
- Public commercial landing routes
- Commercial business records
- Request routing
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approval records
- Finance records

## Release proof

Release requires:

- `commercial-directory` registered as a native Admin OS v2 surface
- Existing project, detail, bid, verification, document, and creation paths preserved
- Eligibility checks still blocking shortlist and award
- Verification keyboard shortcuts scoped to the Verification workspace
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
