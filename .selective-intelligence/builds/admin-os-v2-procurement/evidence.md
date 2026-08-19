# TradeScout Admin OS v2 — procurement

## Owner outcome

The primary Procurement route must be an order operating queue, not the public Supply Run presentation shell reused inside Admin OS.

The operator needs to:

- See how many orders require review
- Separate active fulfillment from closed orders
- Filter by status, source channel, and fulfillment workspace
- Search by order, customer, supplier, or address
- Open one order's existing detail workspace for quotes, assignment, delivery progress, messages, and proof

## Native workspace

The `procurement` tool now uses:

- One procurement summary strip
- One server-backed filter toolbar
- One local search field
- One expandable order list
- One direct path into each order workspace
- One direct path into fulfillment workspaces
- Honest loading, empty, and unavailable states

The admin route no longer re-exports the shared public procurement page shell.

## Existing read authority

The order queue continues to use:

- `GET /api/procurement/orders`

The existing server query parameters remain:

- `status`
- `sourceChannel`
- `fulfillmentWorkspace`

The queue displays stored order number, status, customer, source, order mode, fulfillment workspace, ETA, delivery address, pickup address, preferred supplier, vehicle, urgency, quoted total, approved total, budget limit, created time, and updated time when those fields are present.

## Existing write authority

This primary queue remains read-only.

Order writes stay in the existing detail route:

- `/admin/procurement/:id`

The queue does not create a second quote, assignment, status, proof, supplier-request, message, payment, or fulfillment mutation path.

## Route continuity

The existing routes remain:

- `/admin/procurement`
- `/admin/procurement/:id`
- `/admin/procurement/workspaces`

Public Supply Run, Grunt ordering, supplier response, customer detail, and fulfillment detail pages remain in the existing shared procurement module.

## Status vocabulary

The queue preserves the complete existing procurement status list from submitted through quote, approval, fulfillment, purchase, pickup, delivery, proof, completion, cancellation, failure, and refund.

Summary groups are presentation-only and do not rewrite stored status.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- Procurement order schema
- Public order access tokens
- Quote calculation
- Payment behavior
- Fulfillment assignment
- Grunt acceptance or rejection
- Supplier quote requests
- Product-link resolution
- Private file upload
- Delivery proof
- Procurement messages
- Customer data
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approvals
- Finance records

## Release proof

Release requires:

- `procurement` registered as a native Admin OS v2 surface
- Existing order list and filter authority preserved
- Existing order-detail and workspace routes preserved
- No procurement writes in the primary queue
- Production client and server bundle completion
- Schema preflight with no critical drift
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
