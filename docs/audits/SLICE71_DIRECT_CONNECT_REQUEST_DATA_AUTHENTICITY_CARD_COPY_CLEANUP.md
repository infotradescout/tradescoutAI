# Slice 71 — Direct Connect Request Data Authenticity + Card Copy Cleanup

Date: 2026-06-01  
Status: PASS (code + tests + build validation)

## Goal
Determine whether Direct Connect board cards were showing seeded/test/preview artifacts and prevent internal/generated copy from leaking into normal production request cards.

## Root Cause
Primary root cause: **HomeID preview-generated draft artifacts** were surfacing in the normal requester board with machine/internal copy.

Evidence in code paths:
- Home draft creation generated machine-like title text in [homes.tsx](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/homes.tsx):
  - `"{requestType} request for {homeType}"` (e.g. `single_family`)
- Home draft creation injected internal wording into descriptions:
  - `Prepared from HomeID request preview.`
- Request cards could then render this raw content directly on `/direct-connect`.

Classification:
- `enforced`: no contact gate bypass introduced.
- `temporary_exception` (before this slice): HomeID preview artifacts could appear on normal board.
- `enforced` (after this slice): preview artifacts are filtered from normal user-facing board.

## What Changed

### 1) Provenance/preview guard from event history
- Extended requester list enrichment in [server/routes/direct-connect.ts](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/server/routes/direct-connect.ts):
  - Detect `homeid_draft_created` without `homeid_draft_submitted`.
  - Add `isHomeIdPreviewDraft` flag on request payloads.

### 2) Production board filter tightened
- Added board-level suppression in [requestCardPresentation.ts](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/direct-connect/requestCardPresentation.ts):
  - Hide `isHomeIdPreviewDraft` items from normal requester board.
  - Hide known preview/test markers (`Prepared from HomeID ... preview`, e2e markers, etc.).

### 3) User-facing copy cleanup
- Added presentation sanitizers in [requestCardPresentation.ts](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/direct-connect/requestCardPresentation.ts):
  - `inspection request for single_family` -> `Home inspection request`
  - Internal preview line -> `Direct Connect is preparing this request for local providers.`
  - `single_family` text normalized to human-readable form.
- Wired these into card rendering in [DirectConnectShell.tsx](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/direct-connect/DirectConnectShell.tsx).
- Updated state copy wording in [interpretWorkRequestState.ts](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/utils/interpretWorkRequestState.ts) to remove agent-like Scout framing.

### 4) Source copy cleanup at creation path
- Updated HomeID draft creation copy in [homes.tsx](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/homes.tsx):
  - Humanized title generation for home type.
  - Replaced internal description prefix with user-facing wording.

### 5) Status hierarchy clarity
- Added non-contradictory display status mapping:
  - `ready_to_send` -> `Ready to send`
  - `waiting_on_pros` -> `Waiting on pros`
  - `active_conversation` -> `Open`

## Required Test Coverage (Slice 71)
- New test file: [requestCardPresentation.test.ts](c:/Users/flavo/OneDrive/AAATraderCorner/TradeScout/TradeScoutPro/client/src/pages/direct-connect/requestCardPresentation.test.ts)
- Validates:
  - enum formatting
  - preview-copy suppression
  - preview/test artifact hiding
  - real-request visibility
  - non-contradictory status copy

## Validation
- `npm run check` PASS
- `npm run test` PASS
- `npm run build` PASS

## Closeout
- Commit hash: pending commit
- Working tree: dirty (includes Slice 70 partial docs and this Slice 71 change set)
- Files changed (Slice 71 scope):
  - `server/routes/direct-connect.ts`
  - `client/src/pages/direct-connect/DirectConnectShell.tsx`
  - `client/src/pages/direct-connect/requestCardPresentation.ts`
  - `client/src/pages/direct-connect/requestCardPresentation.test.ts`
  - `client/src/pages/homes.tsx`
  - `client/src/utils/interpretWorkRequestState.ts`

## Decision
Slice 71 fixed the identified production leakage path for generated/preview-like request cards and cleaned card copy/status semantics without removing HomeID handoff functionality.

## Next Recommended P1
Validate in staff production session that:
1. preview artifact cards no longer appear in normal requester board,
2. real user requests still render,
3. Direct Connect lifecycle and contact gating behavior remain unchanged.
