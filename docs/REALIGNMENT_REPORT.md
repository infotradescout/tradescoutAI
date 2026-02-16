# TradeScout Realignment Report

Date: 2026-02-16

## Current State

### User Types (current model)
- UI/identity taxonomy lives in `shared/userTypes.ts:55` and account-creation options in `shared/userTypes.ts:370`.
- Permission/authority taxonomy lives in `shared/roles.ts:3` with hierarchy in `shared/roles.ts:138`.
- Result: the product currently runs two role systems (user-type UX model + permission role model), which is workable but increases flow drift risk.

### Key Browse -> Contact/Request Flows
1. Contractor discovery flow (mostly aligned):
- Browse: `GET /api/contractors*` in `server/routes.ts:4231`, `server/routes.ts:4270`, `server/routes.ts:4318`
- Contact path: Direct Connect request + routing in `server/routes/direct-connect.ts:644` and `server/routes/direct-connect.ts:44`
- Contact redaction: `sanitizeContractorPublic` in `server/routes.ts:103`

2. Social/community flow (aligned):
- Decision object creation: `POST /api/decision-cards` in `server/social-features.ts:110`
- Contact start is authority-gated: `POST /api/social/conversations/start` in `server/social-features.ts:510`
- First-contact mediation: `ensureContactRequest` usage in `server/social-features.ts:748`

3. HomeScout listing flow (aligned):
- Listing browse: `GET /api/homescout/listings/:id` in `server/routes.ts:14976`
- UI explicitly request-gated: `client/src/pages/homescout-listing.tsx:824`
- Contact action opens request/gated modal: `client/src/pages/homescout-listing.tsx:846`

4. Marketplace flow (misaligned, see Violations):
- Direct conversation creation endpoint: `POST /api/marketplace/conversations` in `server/routes.ts:7630`
- UI CTA still direct-contact framing: `client/src/components/conversation-starter.tsx:86`

5. Promo/public campaign flow (misaligned, see Violations):
- Public promo endpoint: `GET /promo/:slug` in `server/routes.ts:9878`
- Share links point to public promo route: `client/src/pages/contractor-promos.tsx:386`

### Feature Modules (current)
- Core route composition: `server/routes.ts:17203` through `server/routes.ts:17283`
- Social/contact authority: `server/social-features.ts`
- Direct Connect routing: `server/routes/direct-connect.ts`
- Profiles/public presence: `server/routes/profiles.ts`, `server/routes/business-profile.ts`
- Commercial directory: `server/routes/commercial-directory.ts`
- HomeScout: `server/routes.ts:14976` onward + `client/src/pages/homescout-listing.tsx`
- Marketplace: `server/routes.ts:7619`, `server/routes.ts:10358` onward + `client/src/pages/marketplace.tsx`
- Promotions/boosts: `server/routes.ts:9878`, `server/routes.ts:10467`, `server/routes.ts:17417`

## Violations

### V1 (Critical): Public promo endpoint exposes direct contact data from awareness flow
- Rule violated: awareness != authority.
- Evidence:
  - Public endpoint: `server/routes.ts:9878`
  - Raw contact returned: `server/routes.ts:9925`, `server/routes.ts:9926` (phone/email)
- Impact: any user can discover direct contact from public promo browse without request/decision gate.

### V2 (Critical): Marketplace allows direct buyer->seller conversation creation without request/decision gate
- Rule violated: routing happens through request/decision flow.
- Evidence:
  - API allows direct conversation create: `server/routes.ts:7630`
  - No authority gate/decision-card checks in this handler.
  - UI entry point is direct: `client/src/components/conversation-starter.tsx:86`
- Impact: bypasses Intent -> Decision Card -> Contact contract.

### V3 (High): Pay-to-play ranking exists in marketplace ordering
- Rule violated: no pay-to-play ranking.
- Evidence:
  - Ranked first by promotion flags: `server/storage.ts:4743`, `server/storage.ts:4744`
  - Paid boost purchase path: `server/routes.ts:10467`
  - Promotion fields in schema: `shared/schema.ts:3858`, `shared/schema.ts:3859`
- Impact: paid listing state directly affects ordering in discovery results.

### V4 (Medium): Schema still allows deprecated `user_search` authority gate
- Rule risk: weakens authority contract enforcement.
- Evidence:
  - Enum still includes `user_search`: `shared/schema.ts:3388`
  - Runtime docs say this gate is deprecated/unsupported: `server/social-features.ts:13`
- Impact: policy drift risk between schema and runtime checks.

## Proposed Fixes (file-level pointers)

1. Redact promo contact fields and route to request CTA
- Update `server/routes.ts:9878` response shape:
  - Remove `contractor.phone` and `contractor.email`.
  - Return `contactPolicy` + `requestCta` (e.g. `/direct-connect` with prefill).
- Update `client/src/pages/contractor-promos.tsx:386`:
  - Keep share link if needed, but UI copy must indicate "Request via TradeScout", not direct contact.

2. Replace direct marketplace messaging with request-gated initiation
- Update `client/src/components/conversation-starter.tsx`:
  - Replace "Contact Seller" action with "Request via TradeScout".
  - Create request object (Direct Connect or marketplace request abstraction), not immediate conversation thread.
- Update `server/routes.ts:7630`:
  - Block direct conversation creation without authority state.
  - Require existing approved request/decision reference before creating a conversation.

3. Remove pay-to-play ranking from marketplace ordering
- Update `server/storage.ts:4743` and `server/storage.ts:4744`:
  - Remove promotion-first ordering from base browse query.
  - Keep neutral sort + locality relevance only.
- Update `server/routes.ts:10467`:
  - Disable listing boost endpoint (410) or convert to non-ranking ad placement that does not alter listing order.
- Update `client/src/pages/marketplace.tsx:1258`:
  - Remove/retitle promoted badges if they imply rank influence.

4. Tighten authority gate contract in schema and handlers
- Update `shared/schema.ts:3388`:
  - Remove `user_search` from authority gate enum (or hard-block everywhere until migration complete).
- Add hard checks where conversations are created (`server/routes.ts:7630`, `server/social-features.ts:510`) so schema/runtime cannot drift.

5. Add regression tests for contract invariants
- Add/extend tests under `server/tests`:
  - Promo endpoint redaction (no phone/email in public payload)
  - Marketplace conversation creation blocked without approved request/decision
  - Marketplace listing order not affected by paid flags

## Prioritized Plan

### P0 (Do first)
1. Patch promo endpoint redaction (`server/routes.ts:9878`).
2. Block ungated marketplace conversation creation (`server/routes.ts:7630`).
3. Remove pay-ranked ordering from marketplace query (`server/storage.ts:4743`).

### P1
1. Swap marketplace UI CTA to request-first (`client/src/components/conversation-starter.tsx`).
2. Disable/retire marketplace boost purchase path (`server/routes.ts:10467`).
3. Align authority enum with enforcement (`shared/schema.ts:3388`).

### P2
1. Add automated regression coverage for all three contract rules.
2. Document centralized interaction contract and ownership boundaries for future modules.

## Minimal Change Set
1. `server/routes.ts`: redact `/promo/:slug` contact fields and return request CTA metadata.
2. `server/routes.ts`: enforce authority/request prerequisite in `POST /api/marketplace/conversations`.
3. `server/storage.ts`: remove `isPromoted/promotedUntil` precedence from marketplace listing ordering.
4. `server/routes.ts`: disable or repurpose `POST /api/marketplace/listings/:id/boost` to non-ranking behavior.
5. `client/src/components/conversation-starter.tsx`: convert direct contact flow to request-first CTA.
6. `shared/schema.ts`: remove/deprecate `user_search` authority gate and migrate dependent writes.
7. `server/tests/*`: add redaction + gating + ranking-invariant tests.
