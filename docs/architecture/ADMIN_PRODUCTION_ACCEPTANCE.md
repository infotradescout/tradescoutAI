# Admin Production Acceptance

TradeScout treats production acceptance as a live operating check rather than a build-success claim.

The authenticated acceptance report covers Requests, Partner Operations, County Coverage, Commercial Work, Procurement, Sales Pipeline, System Status, and Finance. Each lane is classified as Working, Genuinely Empty, Unavailable, or Blocked from current production sources.

The report is read-only by default. Its optional full run writes one temporary database record inside a transaction and rolls it back. It never uses a real customer, partner, request, payment, profile, inventory, or finance record as test material.

The human-readable report is available at `/admin/production-acceptance`. The JSON report is available at `/api/admin/production-acceptance`. Both require the existing authenticated-admin authority.

A production instance also schedules one full acceptance run after startup and writes only aggregate lane results to application logs. The scheduled audit does not become a second source of truth and does not mutate operating records.
