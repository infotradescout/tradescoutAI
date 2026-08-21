# Admin OS v2 — core workspace migrations

## Owner outcome

The Admin OS v2 foundation is not complete while the operating tools still present themselves as separate dashboards inside the shared shell. Core queues must become native workspaces while every remaining tool stays reachable through the adapted surface.

This release migrates the first high-value review and publication workflows without changing their route authority, API authority, permissions, or stored data.

## Native workspaces added

### Error Reports

The prior two-column card wall and repeated page title are replaced with:

- Pending, open, in-progress, and critical summary
- Status and report-type filters
- One compact operating list
- Inline status and priority controls
- One review dialog for reporter, environment, URL, screenshot, and notes

Preserved endpoints:

- `GET /api/admin/error-reports`
- `PATCH /api/admin/error-reports/:id`

### Address & Identity

The prior filter card, table card, and one dialog per row are replaced with:

- Submitted, pending, approved, and overdue summary
- Search across user, email, address, city, and method
- Status filter
- One compact review queue
- One controlled review dialog

The update call is corrected to the repository API contract order:

- `GET /api/admin/address-verifications?status=...`
- `PUT /api/admin/address-verifications/:id`

Only verification status and admin notes are written.

### Business Verification

The prior table with nested requirement controls is replaced with:

- Profile, submitted-field, approved-field, and missing-evidence summary
- Search and overall-status filter
- Expandable profile rows
- Requirement-level evidence state
- Independent approve or reject actions for each required field

Preserved endpoints:

- `GET /api/admin/profile-verifications?status=...`
- `PUT /api/admin/profile-verifications/:profileId`

Requirements remain profile-specific. The UI does not impose contractor credentials on unrelated business types.

### Business Directory

The prior dashboard card stack is replaced with one native workspace containing:

- Directory Supply and Suggested Changes tabs
- Pensacola and Escambia aggregate supply summary
- Verified-active category list
- Places text-search seed form
- Recent seed runs
- Expandable log stream
- Suggestion status queue
- Resolve and reject actions

Preserved endpoints:

- Seed run list and logs
- Places text-search run
- Pensacola liquidity summary
- Directory suggestions list
- Suggestion status update

The page continues to expose aggregated supply counts only. It does not create contact exports or sell leads.

### Marketplace Listings

The prior card grid and sticky card review panel are replaced with:

- Pending count, asking value, locations, and selected-listing summary
- Search across listing, category, location, and seller
- Compact pending-list queue
- One sticky decision workspace
- Seller-facing rejection reason separated from internal notes

Preserved endpoints:

- `GET /api/admin/marketplace/pending`
- `POST /api/admin/marketplace/listings/:id/approve`
- `POST /api/admin/marketplace/listings/:id/reject`

No listing changes until an explicit approval or rejection is submitted.

## Native surface registry

The following tool IDs now bypass the temporary adapted-v1 presentation layer:

- `overview`
- `tradepartner-ops`
- `direct-connect-requests`
- `verification`
- `business-verifications`
- `business-directory-ops`
- `listings`
- `errors`

## Preserved boundaries

This migration does not change:

- Admin roles or permissions
- Route registry
- API endpoint ownership
- Partner profiles
- User accounts
- Contact routing
- Request recipients
- Marketplace approval rules
- Verification requirements
- Directory source authority
- Stone Core or inventory
- Finance records

## Completion proof

Release requires:

- Production client and server build
- No critical schema drift
- Error Reports read and update route verification
- Address verification read and update route verification
- Business verification read and field decision route verification
- Business Directory run, log, summary, and suggestion route verification
- Marketplace pending, approve, and reject route verification
- Native surface markers for all migrated tools
- Existing adapted tools remain reachable
- Desktop and mobile screenshots from the authenticated production Admin OS
