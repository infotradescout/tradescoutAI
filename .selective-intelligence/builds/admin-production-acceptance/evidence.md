# TradeScout Admin OS — production acceptance

## Outcome

Run a live production acceptance pass across the eight highest-value operator lanes instead of treating a successful build as proof that the work is usable.

The acceptance lanes are:

- Requests
- Partner Operations
- County Coverage
- Commercial Work
- Procurement
- Sales Pipeline
- System Status
- Finance

## Classification

Each lane is classified from current production sources as one of:

- Working — the source is queryable, required invariants hold, and real records are available.
- Genuinely Empty — the source and required structure are healthy but no operating records exist.
- Unavailable — a required source cannot be resolved or queried.
- Blocked — the source is available but an invariant, orphan record, incomplete national dataset, invalid state, or missing required operating authority prevents acceptance.

No missing source is converted into a successful zero.

## Read authority

The audit reads production database catalog metadata and the same underlying records used by the existing Admin OS lanes. Partner Operations uses the established managed-profile health and intake services directly.

The audit does not replace the existing lane APIs or become a second source of truth.

## Safe write proof

The optional full acceptance action creates one dedicated temporary PostgreSQL record inside a transaction and rolls the transaction back. It verifies that the application can perform a controlled database write without persisting a business, profile, request, payment, inventory, partner, or customer record.

The write proof does not:

- Send a customer or partner message
- Release contact details
- Change request status
- Assign a partner or territory manager
- Create a commercial project or bid
- Create a procurement order or quote
- Start a checkout
- Upload a production proof file
- Change CRM contacts or deals
- Create a ledger transaction
- Change inventory or Stone Core

## Production execution

The production service schedules one full acceptance run after startup. Results are logged with lane status and summary only. The same audit remains available to authenticated admins at:

- `/admin/production-acceptance`
- `/admin/acceptance`
- `GET /api/admin/production-acceptance`
- `POST /api/admin/production-acceptance/run`

The human-readable page is deliberately outside the primary navigation so it does not add another permanent dashboard to Admin OS.

## Permission boundary

Every acceptance route uses the existing authenticated-admin guard. No public health endpoint exposes partner, request, commercial, procurement, CRM, or finance operating detail.

## Preserved boundaries

This work does not change:

- Admin roles or permission middleware
- Database schemas or migrations
- Existing operating APIs
- Company or profile ownership
- Public profile presentation
- Public contact routing
- Request recipients or lifecycle
- County assignments
- Commercial projects, bids, or verification
- Procurement orders, quotes, checkout, supplier links, or proof files
- CRM contacts, deals, or activities
- Observability source records
- Wallet transactions or Vault Contributions
- Partner records
- HomeID records
- Stone Core or inventory

## Release proof

Release requires:

- TypeScript check passes
- Production client and server bundle passes
- The acceptance service is registered through the existing professional-partnership route bootstrap
- Production deployment reaches live state
- Startup logs contain the production acceptance completion marker
- The authenticated acceptance page returns the current eight-lane report
- No persistent acceptance-test business record remains
