# Scout Refactor Blueprint

## Decision

Scout should move to a **server-authoritative architecture** with a **thin client orchestration layer**.

The current instability does **not** come from weak safety or weak helper modules. It comes from two oversized controllers:

- `server/routes/scout.ts`
- `client/src/scout/ScoutOS.tsx`

These files currently duplicate decisioning, mutate outputs in too many places, and make behavior precedence hard to reason about.

---

## What stays

These modules are healthy and should remain with minimal change:

### Server
- `server/utils/extractUserMessage.ts`
- `server/scout/userFacingSanitizer.ts`
- `server/services/scoutPolicy.ts`
- `server/scout/brandGuard.ts`
- `server/services/scoutDeterministicIntent.ts`
- `server/services/unifiedScoutRouter.ts`

### Client
- `client/src/scout/localIntents.ts`
- `client/src/scout/messageBuilders.ts`
- `client/src/scout/responseQuality.ts`

---

## What changes first

### Priority 1: shrink `client/src/scout/ScoutOS.tsx`

`ScoutOS.tsx` should stop being a business-logic controller.

It should only own:
- input UX
- rendering
- explicit nav shortcuts
- action execution
- work-area presentation
- session/UI preferences

It should **not** directly own major domain behaviors such as:
- provider offer-services flow
- provider standing flow
- provider promotion flow
- community-builder donation flow
- community announcement drafting
- contractor search decisioning
- marketplace search/post decisioning
- support routing
- deep onboarding branching

These should move behind server-owned handlers.

### Priority 2: split `server/routes/scout.ts`

Extract into the following modules:

- `server/scout/scoutRequestNormalizer.ts`
- `server/scout/scoutDecisionPipeline.ts`
- `server/scout/scoutSynthesisPipeline.ts`
- `server/scout/scoutActionComposer.ts`
- `server/scout/scoutResponseContract.ts`

`server/routes/scout.ts` should become a thin composition layer only.

### Priority 3: strengthen `scout-behavior-registry.json`

Add these fields to each entry:
- `owner`
- `authoritySide`
- `precedence`
- `requiresAuth`
- `messageContract`
- `actionContract`

This turns the registry from descriptive audit metadata into a real runtime governance artifact.

---

## Target architecture

### 1. Request normalization

**Module:** `server/scout/scoutRequestNormalizer.ts`

Responsibilities:
- normalize incoming message
- derive safe user context
- derive locality payload
- extract route/session metadata
- resolve explicit auth state

Output:
- `NormalizedScoutRequest`

### 2. Decision pipeline

**Module:** `server/scout/scoutDecisionPipeline.ts`

Responsibilities:
- explicit navigation resolution
- deterministic workflow routing
- onboarding routing
- provider/community/marketplace/support routing
- governor-aware gating
- trust-aware route selection
- fallback route selection

Output:
- `ScoutDecision`

Decision types:
- `client_shortcut_passthrough`
- `deterministic_route`
- `server_behavior_handler`
- `synthesis_required`
- `blocked`
- `fallback`

### 3. Synthesis pipeline

**Module:** `server/scout/scoutSynthesisPipeline.ts`

Responsibilities:
- knowledge mode selection
- prompt assembly
- model call
- extract user message via `extractUserMessage`
- apply brand guard
- apply policy sanitation
- apply user-facing sanitation

Output:
- `ScoutSynthesisResult`

### 4. Action composer

**Module:** `server/scout/scoutActionComposer.ts`

Responsibilities:
- construct actions for each behavior
- validate actions through `UnifiedScoutRouter.validateAction`
- apply policy sanitation to action labels/subtitles/why text
- compose clusters / nav targets consistently

Output:
- `ScoutActionBundle`

### 5. Response contract

**Module:** `server/scout/scoutResponseContract.ts`

Responsibilities:
- final response shape
- message contract validation
- action contract validation
- safe fallback replacement when contract is violated

Output:
- single canonical `ScoutResponse`

---

## Client target shape

### `client/src/scout/ScoutOS.tsx`

Refactor into these client modules:

- `client/src/scout/useScoutController.ts`
- `client/src/scout/useScoutComposer.ts`
- `client/src/scout/useScoutAutoRoute.ts`
- `client/src/scout/useScoutWorkArea.ts`
- `client/src/scout/useScoutOnboardingBridge.ts`

### What remains in `ScoutOS.tsx`
- layout
- thread rendering
- input row wiring
- top-level hooks composition
- dialog/sheet mounting

### What moves out
- business intent branch blocks
- direct contractor/marketplace/provider/community logic
- fallback route construction logic not strictly UI-local
- most auto-decision logic

---

## Authority rules

### Server-authoritative behaviors
These should be resolved on the server only:
- onboarding branch selection
- provider intent flows
- contractor search intent flows
- marketplace intent flows
- community announcement flows
- support routing
- trust/governor constrained routing
- all final message shaping
- all policy language enforcement

### Client-authoritative behaviors
These may remain on the client:
- explicit nav shortcuts like “open settings”
- quick action chip shortcuts
- local note opening
- local work-area opening
- immediate UI affordances that do not affect business truth

### Shared but server-final
These may exist on both sides, but the server must remain final authority:
- fallback handling
- response quality shaping
- action labels

---

## Implementation order

### Phase 1 — isolate interfaces
1. Create `NormalizedScoutRequest`, `ScoutDecision`, `ScoutResponse` types.
2. Create `scoutResponseContract.ts` with hard validation.
3. Route all final server responses through that contract.

### Phase 2 — pull domain behaviors out of `ScoutOS.tsx`
Move these one by one into server handlers:
1. provider offer services
2. provider standing
3. provider promotion
4. community builder donation
5. community announcement
6. contractor search
7. marketplace search/post
8. support routing

Client should call `/api/scout` with intent/context and render the returned result.

### Phase 3 — split `server/routes/scout.ts`
1. extract request normalization
2. extract decision pipeline
3. extract synthesis pipeline
4. extract action composer
5. leave route file as composition only

### Phase 4 — strengthen registry
Update `scout-behavior-registry.json` entries with:
- owner function
- authority side
- precedence
- auth requirements
- contract expectations

Update enforcement script to fail when required runtime metadata is missing.

### Phase 5 — test the contracts, not just helpers
Add tests for:
- exact winning behavior precedence
- server-authoritative provider flow
- server-authoritative contractor flow
- server-authoritative marketplace flow
- response contract fallback behavior
- sanitize + policy + brand guard sequencing
- blocked/guest/auth-required behavior consistency

---

## Anti-patterns to eliminate

- client performs business routing before server truth is consulted
- multiple stages mutate the same response text
- route-level early returns without registry precedence tracking
- behavior discovery via comments without full runtime ownership mapping
- final UX depending on client rescue logic for server mistakes

---

## Success criteria

Scout is “working properly” when:

1. similar prompts resolve through the same winning behavior path
2. the server is the final authority on message/action output
3. the client does not contain large business decision branches
4. the registry can explain ownership and precedence for every behavior
5. route-level tests cover each authoritative behavior family
6. output sanitation and policy enforcement happen once in a canonical order

---

## Practical next PRs

### PR 1
Create:
- `server/scout/scoutResponseContract.ts`
- shared response/decision types

### PR 2
Extract `useScoutController.ts` from `ScoutOS.tsx`

### PR 3
Move provider/community/marketplace/support branches out of `ScoutOS.tsx` into server handlers

### PR 4
Split `server/routes/scout.ts` into pipeline modules

### PR 5
Expand registry schema + enforcement script

---

## Bottom line

Scout does not need more cleverness.
Scout needs **less duplicated control**.

The repo already has strong safety and contract pieces. The fix is to let those pieces govern runtime cleanly and remove oversized controllers from both client and server.
