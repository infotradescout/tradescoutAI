# TradeScout Admin OS v2 — Sales Pipeline

## Owner outcome

Sales Pipeline must be an operating CRM, not a dashboard of summary cards followed by three more card lists. The operator needs to see current relationship state, move opportunities, and record real activity without leaving the Admin OS workbench.

## Native workspace

The `crm` tool now uses:

- One sales summary strip
- Contacts
- Deals
- Activity
- Search and status filters
- Compact expandable records
- Controlled creation dialogs
- Existing contact-status and deal-stage updates
- Honest loading, empty, and unavailable states

## Existing read authority

The workspace preserves:

- `GET /api/crm/contacts`
- `GET /api/crm/deals`
- `GET /api/crm/activities`

The page displays stored contact identity, company, phone, notes, status, assignment, and timestamps; stored opportunity title, value, stage, contact, description, expected close date, assignment, and timestamps; and stored activity type, subject, description, relationship links, sender/recipient evidence, creator, visibility, and timestamp.

## Existing write authority

The workspace preserves:

- `POST /api/crm/contacts`
- `POST /api/crm/deals`
- `POST /api/crm/activities`
- `PUT /api/crm/contacts/:contactId`
- `PUT /api/crm/deals/:dealId`

Creation remains validated around the same required fields:

- Contact: first name, last name, valid email
- Deal: title and linked contact
- Activity: subject and description

The native page exposes only contact-status and deal-stage updates from the broader existing update routes. It does not add a second pipeline, duplicate activity store, local-only status state, or delete action.

## Server permission boundary

The CRM server continues to use the existing role guard:

- Operations Admin
- Super Admin

No CRM route is made available to ordinary authenticated users, public profiles, contractors, homeowners, or partner-account visitors.

## Pipeline truth

Open pipeline totals are presentation-only calculations over deals that are not `closed_won` or `closed_lost`. Won value is calculated only from `closed_won` records.

These summaries do not rewrite deal values, stage history, contact status, assigned owner, or activity records.

## Activity boundary

The workspace records the existing activity types:

- Call
- Email
- Meeting
- Note
- Task
- Internal message

Logging an internal-message activity through the activity route does not claim that an outbound notification, email, or direct message was delivered. Dedicated CRM email and internal-message routes remain separate existing authorities and are not duplicated in this release.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- CRM schemas
- Contact identity or assignment
- Deal amount or ownership
- Activity history
- Email templates
- Pipeline configuration
- Outbound email behavior
- Internal-message delivery behavior
- Public profiles
- Request routing
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approvals
- Finance records

## Release proof

Release requires:

- `crm` registered as a native Admin OS v2 surface
- Existing contact, deal, and activity read and create paths preserved
- Existing contact and deal update paths preserved
- CRM role guard unchanged
- No client-side delete action added
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
