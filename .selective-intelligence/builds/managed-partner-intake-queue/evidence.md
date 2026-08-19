# Managed partner intake queue — evidence

## Governing operating law

No partner waits for architecture. No architecture waits for a partner.

Partnerships can arrive while existing profiles are being repaired, shared profile systems are being improved, Stone Core is expanding, inventory is being reconciled, and production issues are being fixed. The intake system must therefore accept new work immediately without changing or pausing any live company profile.

## Problem this closes

The first managed-profile operations board could audit the known partners, but adding the next partner still required a source-code registry edit. That meant intake was visible only after development work had already begun.

The missing layer was a durable admin queue that records a partner at the moment the relationship arrives, keeps the unknown facts visible, and promotes the partner into the same live health system only after the real business profile exists.

## Intake stages

- `incoming` — the relationship has arrived and is recorded.
- `source_review` — the company’s real website, public identity, products, services, imagery, and contact presence are being studied.
- `profile_build` — the company-specific TradeScout profile is being built.
- `routing_review` — Call, Start a Request, recipient, notification, ownership, and relationship boundaries are being verified.
- `ready_to_publish` — the profile and routing are complete enough for final release checks.
- `live` — the active business and published profile have matching ownership and now join the continuous health board.
- `blocked` — an exact missing decision or fact is named in a blocker note.
- `archived` — the intake is retained for history but removed from the active queue.

## Facts recorded at intake

The queue stores:

- Partner name and proposed profile slug
- Existing public website and source links
- Profile archetype
- Ownership and stewardship mode
- Contact handling mode
- Public or direct-only exposure
- Request experience and operating recipient
- Expected public action
- Managed phone, email, and notification inbox when applicable
- Verified relationship label
- Notes describing known facts and non-negotiable boundaries
- Stage, priority, latest action, blocker, creator, and assignment

Unknown owner contact remains pending. It is never replaced with an invented person, phone, email, or company relationship.

## Promotion into live operations

An intake cannot be promoted to live merely because a card exists in the queue. The server verifies:

1. The canonical business exists.
2. The business is active.
3. The canonical profile exists.
4. The profile is published.
5. The profile belongs to that business.
6. Business and profile ownership match.

Once promoted to live, the intake becomes a runtime managed-profile definition. It enters the existing Ready / Needs Attention / Blocked audit automatically. If its contact mode is TradeScout managed, the approved phone and inbox are normalized without transferring ownership.

## Deliberate separation

The queue does not create the partner profile by itself. Company-specific profile research, design, content, imagery, product truth, service truth, and routing implementation continue independently and concurrently.

The queue also does not:

- Transfer company ownership
- Invent an owner account
- Create physical inventory
- Turn a supplier relationship into source-company ownership
- Publish a profile before its real records are ready
- Force every company into the same public layout
- Stop an existing partner because another intake is blocked

## Admin experience

The existing TradePartners and TradeDeals portal now opens with Partner Intake and keeps Live Profiles beside it.

Admins can:

- Add a partner immediately
- Capture the existing public presence
- Select the company profile lane and control mode
- Set contact and request handling
- Name a verified relationship
- Prioritize work
- Move the intake through research, build, routing, release, and live stages
- Block the intake only with a named reason
- Open live profiles and source sites directly

The queue refreshes continuously while the live profile health board continues its own audit.

## Completion proof

Release requires:

- Durable intake table and indexes
- Admin-only list, create, and update routes
- Intake editor in the existing partner portal
- Live-promotion validation against production business and profile records
- Runtime inclusion in managed-contact normalization
- Runtime inclusion in the managed-profile health board
- No ownership, inventory, profile, or user mutation from intake storage itself
- Production deployment and database verification
- Existing five managed profiles unchanged unless a separate approved profile change requires it
