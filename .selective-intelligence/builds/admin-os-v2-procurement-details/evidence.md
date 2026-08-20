# TradeScout Admin OS v2 — procurement detail workspaces

## Owner outcome

The primary Procurement queue is native, but opening an order or fulfillment workspace still dropped the operator into the shared public Supply Run presentation shell. The next operating layer must stay inside the same Admin OS workbench.

This release rebuilds:

- Individual procurement order workspaces
- Procurement workspace registry
- Individual procurement workspace settings

Public Supply Run, Grunt ordering, supplier response, and customer order pages remain in the shared public procurement module.

## Native procurement order workspace

The admin order route remains:

- `/admin/procurement/:id`

It is organized into four lanes:

- Overview
- Quote & Suppliers
- Fulfillment
- Evidence

The page presents stored customer, route, supplier preference, vehicle, urgency, budget, item, event, message, quote, supplier response, fulfillment, file, and proof evidence.

## Existing order read authority

The workspace preserves:

- `GET /api/procurement/orders/:id`
- `GET /api/procurement/orders/:id/files/:fileId/download`

Private file and proof downloads remain protected by the order-access route. The client does not turn private object keys into public URLs.

## Existing order write authority

The workspace preserves:

- `PATCH /api/procurement/orders/:id`
- `POST /api/procurement/orders/:id/quote`
- `POST /api/procurement/orders/:id/assign-fulfillment`
- `POST /api/procurement/orders/:id/supplier-quotes`
- `POST /api/procurement/orders/:id/approve`
- `POST /api/procurement/orders/:id/checkout-session`
- `POST /api/procurement/orders/:id/verify-checkout`
- `POST /api/procurement/orders/:id/status`
- `POST /api/procurement/orders/:id/proof`

The existing server transition rules, order access checks, fulfillment access checks, admin-only operational fields, supplier response tokens, payment authority, and private-object validation remain authoritative.

The page does not add direct database writes, alternate quote calculations, alternate payment capture, alternate fulfillment assignment, or alternate proof storage.

## Procurement workspace registry

The registry route remains:

- `/admin/procurement/workspaces`

It preserves:

- `GET /api/procurement/workspaces`
- `POST /api/procurement/workspaces`

It presents platform, fulfillment-partner, supplier, and admin workspaces with status, branding, support, and available registry evidence.

The current server returns branding fields flattened onto each workspace row. The native registry reads:

- `public_name`
- `tagline`
- `primary_color`
- `support_email`
- `support_phone`

It also tolerates a nested branding object if the server response evolves later.

## Procurement workspace detail

The detail route remains:

- `/admin/procurement/workspaces/:id`

It preserves:

- `GET /api/procurement/workspaces`
- `PATCH /api/procurement/workspaces/:id`

The page updates only the existing workspace identity, type, status, branding, and support fields. It creates no order, member, supplier quote, payment, proof, or public procurement record.

## Public boundary

The following remain public or customer-facing procurement surfaces and are not converted into admin pages:

- TradeScout Supply Run order creation
- Grunt direct ordering
- Customer order detail
- Grunt fulfillment detail
- Supplier quote response

The public pages retain their current access tokens, customer actions, product-link resolution, upload, checkout, and messaging behavior.

## Honest unavailable states

A failed order or workspace source remains unavailable. Missing quotes, items, files, proofs, supplier responses, workspace branding, support details, or registry counts are not represented as completed work.

## Preserved boundaries

This release does not change:

- Admin roles or permission middleware
- Procurement schemas
- Order ownership or access tokens
- Order status-transition rules
- Quote line types or totals
- Stripe checkout authority
- Supplier quote token authority
- Grunt acceptance or rejection
- Private object storage
- Message visibility
- Workspace membership
- Partner records
- HomeID records
- Stone Core or inventory
- Marketplace approvals
- Finance records

## Release proof

Release requires:

- The three admin routes to use native Admin OS workspace primitives
- Existing order and workspace endpoints preserved
- Current flattened branding response supported
- Public procurement pages left in the shared module
- Production client and server bundle completion
- Critical schema preflight success
- Production service startup
- Authenticated desktop and mobile inspection before final visual approval
