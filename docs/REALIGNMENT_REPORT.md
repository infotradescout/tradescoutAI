# TradeScout Realignment Report

Date: 2026-02-16

## Current State

### User Types
- Identity taxonomy: `shared/userTypes.ts`
- Runtime permission roles: `shared/roles.ts`
- Canonical auth/signup + claim path: `server/routes.ts` (`/api/auth/register`)

### Key Flows (Browse -> Request -> Decision -> Contact)
1. Marketplace discovery/request:
- Browse listings: `server/routes.ts` (`/api/marketplace/listings`)
- Request-gated conversation start: `server/routes.ts` (`/api/marketplace/conversations`)
- Contact permission mediation: `server/utils/contactRequests.ts`

2. Social/community:
- Decision cards: `server/social-features.ts` (`/api/decision-cards`)
- Conversation authority gates: `server/social-features.ts` (`/api/social/conversations/start`)

3. Promo/public awareness:
- Public promo route: `server/routes.ts` (`/promo/:slug`)
- Contact is redacted, request CTA only.

4. New maps discovery layer (v1):
- API: `server/routes.ts` (`/api/map/providers`)
- UI: `client/src/pages/maps.tsx` (`/maps`)
- Feature flags: `FEATURE_MAPS_V1`, `VITE_FEATURE_MAPS_V1`

### Feature Modules
- Interaction contract doc: `docs/INTERACTION_CONTRACT.md`
- Maps v1 doc: `docs/MAPS_V1.md`
- Preload + claim doc: `docs/PRELOAD_AND_CLAIM.md`
- Acceptance tests doc: `docs/ACCEPTANCE_TESTS.md`

## Violations

### V1 (Medium): `authorityGate` still uses `user_search` in marketplace thread metadata
- Evidence:
  - `server/routes.ts` (`/api/marketplace/conversations`) sets `authorityGate: "user_search"`.
- Why this matters:
  - Runtime behavior is request-gated, but metadata naming drifts from decision-first language.

### V2 (Medium): Legacy/static pages still contain direct-contact language patterns
- Evidence (examples):
  - `client/src/pages/vehicle-marketplace.tsx` ("Contact Dealer")
  - Several legacy mock/demo pages include static phone/email strings.
- Why this matters:
  - UX language drift can confuse users about request-gated contract.

### V3 (Low): Import pipeline currently script-driven; no dedicated admin UI for staging merge review
- Evidence:
  - CLI pipeline exists under `scripts/import/*`, but no operator dashboard route yet.
- Why this matters:
  - Operational review relies on terminal workflows.

## Proposed Fixes (file-level pointers)

1. Normalize authority metadata language
- Update `server/routes.ts` marketplace request metadata from `user_search` to a request/decision-aligned gate label.
- Update any enum/docs references in `shared/schema.ts` and `docs/INTERACTION_CONTRACT.md`.

2. Sweep user-facing copy for direct-contact phrasing
- Prioritize high-traffic pages under `client/src/pages/`:
  - `exchange.tsx`
  - `marketplace.tsx`
  - `vehicle-marketplace.tsx`
  - onboarding/signup/request surfaces
- Replace with request-first language only.

3. Add optional admin merge-review surface for preload pipeline
- Read from `listing_import_staging` (`shared/schema.ts`).
- Add review endpoint(s) and simple admin UI for batch status + retry.

## Prioritized Plan

### P0
1. Remove remaining `user_search` metadata drift in marketplace request flow.
2. Complete copy sweep on top traffic discovery pages.

### P1
1. Add lightweight admin import batch review endpoint.
2. Add UI badge/filters for staged/failed import rows.

### P2
1. Expand automated tests to include authority metadata assertions after gate rename.
2. Add smoke test for map feature-flag off/on behavior.

## Minimal Change Set
1. `server/routes.ts`: replace marketplace `authorityGate` metadata value with request/decision-aligned label.
2. `shared/schema.ts`: align enum/typing if gate label is normalized.
3. `client/src/pages/vehicle-marketplace.tsx`: remove direct contact wording.
4. `server/routes/admin.ts` (or existing admin route module): expose import batch summary endpoint for `listing_import_staging`.
5. `client/src/pages/admin-business-import.tsx`: add batch review state indicators (pending/merged/failed/skipped).
