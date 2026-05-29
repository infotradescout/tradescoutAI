# HomeID / HomeScout Product Deep Dive

## Core Product Law

- HomeID is the durable truth layer for a property.
- HomeScout is the exchange and action layer built on top of HomeID.
- Direct Connect is a verified service cycle that can enrich HomeID through evidence-backed events.
- Users control authority, visibility, and transfer.

## Listing-Side HomeID Creation and Handoff

Realtors and property managers are HomeID accelerators. They can prepare, enrich, and package a HomeID before a buyer claims the property.

When the property changes hands, HomeScout should prompt the listing-side party and seller to hand off the HomeID to the new owner with transfer-safe records only.

### Product law additions

1. A HomeID can be created or enriched by an authorized listing-side party before the future owner claims it.
2. When the rightful owner or buyer claims the property, HomeID authority transfers through explicit handoff, not by overwriting record identity.
3. Listing-side authority is scoped and temporary; it does not grant permanent control of HomeID truth.
4. Private seller-only evidence does not transfer by default.

### Listing-side workflow

1. Listing prep prompt: agent/property manager is prompted to build HomeID confidence context.
2. Seller collaboration: seller approves what is private, buyer-visible, and transfer-safe.
3. Buyer confidence packet: HomeScout can surface verified, seller-approved, transfer-safe context for listing trust.
4. Claim and handoff: sale/claim triggers authority close/open flow while keeping `homeId` constant.

### Roles for handoff flows

- `listing_agent_delegate`
- `property_manager_delegate`
- `seller_collaborator`
- `buyer_pending_claimant`
- `buyer_packet_recipient`
- `new_owner_pending_handoff`

### KPI

- Every listed property is a potential HomeID onboarding event.
- Every buyer handoff is a homeowner activation event.
- Every listing-side operator is a HomeID distribution channel.
