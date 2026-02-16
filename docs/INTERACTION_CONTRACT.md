# TradeScout Interaction Contract

TradeScout core interaction contract is:

1. `Discovery -> Request -> Decision -> Contact`
2. Awareness never grants direct authority or direct contact.
3. Marketplace ranking cannot be purchased.

## Enforcement Points

### Request-gated first contact
- `server/routes.ts:7630`
  - `POST /api/marketplace/conversations` now gates first contact through contact-permission request flow.
  - If no accepted permission exists, API returns `202` with `pending: true` and a request id.
  - Conversation is created only after permission is accepted.

### Contact redaction in public awareness routes
- `server/routes.ts:9878`
  - `GET /promo/:slug` no longer returns contractor `phone` or `email`.
  - Response includes request CTA metadata instead (`contactAccess`).

### Request object path (marketplace inquiry)
- `server/routes.ts:10671`
  - `POST /api/marketplace/inquiries` remains the request object path for Exchange flows.
  - Incoming `buyerPhone` and `buyerEmail` are force-redacted to `null` server-side.

### No pay-to-play ranking
- `server/storage.ts:4738`
  - Marketplace ordering no longer prioritizes `isPromoted` or `promotedUntil`.
- `server/routes.ts:10467`
  - `POST /api/marketplace/listings/:id/boost` now returns `410` (`PAID_RANKING_DISABLED`).

### Conversation participant redaction
- `server/storage.ts:8455`
  - Conversation list payload returns participant-safe profile fields only.
  - No raw participant phone/email is returned in this API shape.

### Authority gate vocabulary hardening
- `shared/schema.ts`
  - `authority_gate` typing is now limited to `decision_card | scout_recommendation`.
- `migrations/0043_deprecate_user_search_authority_gate.sql`
  - Legacy rows with `user_search` are normalized to `scout_recommendation`.
  - DB check constraint is tightened to the active allowlist.

## UI Contract Updates

- `client/src/components/conversation-starter.tsx`
  - CTA and flow updated from direct contact language to request language.
  - Handles `202 pending` as request-created state.
- `client/src/pages/exchange.tsx`
  - Primary listing CTA text updated to request language (`Request Quote` / `Send Request`).
- `client/src/pages/marketplace.tsx`
  - Boost UI removed and request CTA copy updated.

## API State Semantics (Marketplace Conversation Start)

`POST /api/marketplace/conversations`

- `201`: request accepted and conversation created.
- `202`: request created/pending recipient decision.
- `403`: recipient declined/blocked contact.
- `410`: listing unavailable for requests.

## Change-set (minimal)

- `server/routes.ts`
- `server/storage.ts`
- `client/src/components/conversation-starter.tsx`
- `client/src/pages/exchange.tsx`
- `client/src/pages/marketplace.tsx`
- `docs/INTERACTION_CONTRACT.md`
