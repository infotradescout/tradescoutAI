# TradeScout Admin OS — production acceptance

## Owner outcome

The acceptance workspace must be a real registered Admin OS route backed by current production sources. It cannot be a promised URL, a static checklist, or an unknown-route fallback.

## Registered routes

The client recognizes both:

- `/admin/acceptance`
- `/admin/production-acceptance`

Both routes render the same Super Admin-only production acceptance workspace before generic Admin OS route resolution.

The server exposes:

- `GET /api/admin/production-acceptance`

The endpoint is mounted under the existing authenticated Super Admin router and is not public.

## Operating lanes

The report checks:

1. Requests
2. Partner Operations
3. County Coverage
4. Commercial Work
5. Procurement
6. Sales Pipeline
7. System Status
8. Finance

Each lane is classified as:

- Working
- Genuinely empty
- Unavailable
- Blocked

A genuinely empty lane proves its source is reachable and contains no real records. It is not represented as unavailable or broken.

## Controlled write canary

The report opens a database transaction, creates a temporary transaction-only table, inserts one random canary identifier, reads it back, and rolls the transaction back.

It does not insert or change:

- Users
- Businesses
- Profiles
- Partner intakes
- Requests
- Assignments
- Commercial projects or bids
- Procurement orders or quotes
- CRM contacts or deals
- Wallet transactions
- Vault entries
- HomeID records
- Stone Core or inventory

## Production schema repairs

The acceptance pass exposed three county aggregation jobs querying removed or nonexistent columns.

### Users aggregation

Replaced removed `verified_at` and `user_role` assumptions with current production authority:

- `verification_status = approved`
- `verified_badge = true`
- Primary role
- Active role
- Roles array
- Current `county_fips`

### Affiliate aggregation

Affiliate accounts do not own `county_fips`. County scope now resolves through the affiliate user's current county assignment.

### TradeDeals aggregation

The current TradeDeals table has no county-attribution column. The job now checks the live schema before querying county fields and skips county aggregation honestly when county attribution is unavailable, rather than failing every schedule.

## Preserved authority

This release does not change:

- Admin roles or permission middleware
- Request lifecycle or contact gates
- Partner ownership
- County assignment truth
- Commercial bid authority
- Procurement order writes
- CRM writes
- Finance writes
- Public profile routing
- HomeID
- Stone Core or inventory

## Release proof

Release requires:

- Both client routes render before unknown-route fallback.
- The authenticated server endpoint exists.
- The production client and server bundle complete.
- The production service starts.
- The live endpoint returns all eight lanes.
- The controlled write canary passes and retains no production record.
- Users and affiliate metrics repopulate after the repaired scheduled jobs run.
- TradeDeals aggregation no longer throws when county attribution is absent.
