# Scout Performance Micro-Wins

Date: 2025-12-27  
Scope: Scout-only behavior (no new features, no routing/layout changes)

This document captures small, behavior-preserving performance and clarity tweaks applied to the live Scout surface. All changes stay inside the Scout boundary and do not alter authority, contracts, or feature set.

---

## 1. Context Trim

**Goal:** Avoid loading heavy context when the UI cannot yet use it.

### 1.1 Tile personalization queries gated by committed county

**Files:**
- client/src/scout/ScoutOS.tsx

**Before**
- Saved contractors, dashboard projects, and invoices for tile context were fetched whenever a user was logged in:
  - `/api/saved-contractors`
  - `/api/dashboard`
  - `/api/invoices`
- These ran for all authenticated Scout visitors, even when the home county was not yet committed. In that state, the primary hero block does not render tiles; it renders a county-setup prompt instead.

**Change**
- Added a `countyCommitted` guard to the React Query `enabled` flags:
  - Saved contractors: `enabled: !!user && countyCommitted`
  - Dashboard projects: `enabled: !!user?.id && countyCommitted`
  - Invoices: `enabled: !!user?.id && countyCommitted`

**Effect**
- When the user has not yet committed a home county, Scout no longer preloads dashboard/contractor/invoice context that the tiles UI cannot render.
- Once the user commits a county (the only state where tiles appear), the behavior is unchanged: queries fire and tiles remain fully personalized.

**Perceived benefit**
- Less background network traffic on first-time or partially-onboarded users.
- Slightly faster initial feel on `/scout` for guests and new accounts, with no change to tile behavior once the area is set.

---

## 2. Phase Tightening

**Goal:** Reduce redundant phase transitions without changing what Scout does.

### 2.1 Remove redundant RESOLVING_CONTEXT dispatch

**Files:**
- client/src/scout/ScoutOS.tsx
- client/src/scout/state.ts (unchanged; reducer behavior relied upon)

**Before**
- `recordUserMessage(value)` enqueued a `USER_MESSAGE` event, which set `state.status` to `"resolving_context"`.
- Immediately after, `handleSend` called `setStatus("resolving_context")` again.

**Change**
- Removed the extra `setStatus("resolving_context")` call and documented that `recordUserMessage` already handles the phase transition.

**Effect**
- One fewer state dispatch per request while entering the first phase.
- Phase sequence remains the same from the UI’s point of view:
  - `idle → resolving_context → (intent branches or checking_documents/ready) → idle`.
- No impact on loaders, watchdogs, or error handling.

### 2.2 Remove unused activeTool bookkeeping

**Files:**
- client/src/scout/ScoutOS.tsx

**Before**
- `handleSend` declared `let activeTool: string | null = null;` and updated it around certain intents (provider offers, provider standing, contractor search, marketplace search).
- This variable was not surfaced in state, UI, or telemetry; it only updated local state and was then nulled.

**Change**
- Removed the `activeTool` declaration and all assignments.

**Effect**
- Eliminates invisible per-request bookkeeping with zero functional impact.
- Tool usage is still fully represented via `toolResult` on `ScoutMessage` and existing telemetry.

**Perceived benefit**
- Micro reduction in per-request work and slightly simpler mental model for future readers.

---

## 3. Output Caps by Intent

**Goal:** Enforce short-intent discipline at the responder boundary, without changing core answers.

### 3.1 Short-intent trimming helper

**Files:**
- client/src/scout/ScoutOS.tsx

**Before**
- Scout already enforced a hard character cap (`MAX_FIRST_MESSAGE_CHARS = 280`) on the **first** answer to prevent walls of text.
- Frame-aware rendering in `ScoutThread` trimmed overlapping truth/meaning/direction lines from the displayed content.
- There was no explicit, per-intent cap for short “what/why/what is this?” style prompts; if the backend returned a long answer, the full text (subject to the first-answer cap) would render.

**Change**
- Introduced `enforceShortIntentDiscipline(userMessage, content, intentLabel)` in ScoutOS:
  - Detects likely short intents when:
    - The user message is \<= ~120 characters, and
    - It starts with `what/why/who/where/when`, **or**
    - The backend `metadata.intent` matches a small set of short-style labels (`"short"`, `"definition"`, `"why"`).
  - For detected short intents:
    - Splits the sanitized response into sentences.
    - Keeps only the first 1–3 sentences.
    - If content is truncated, re-joins and appends an ellipsis when needed.
- The helper is applied **after** `sanitizeScoutMessage` and **before** any enrichment (e.g., pre-filled drafts).

**Effect**
- Short, “what/why” prompts now reliably produce 1–3 sentence answers, even if the backend responds with a longer paragraph.
- Medium/long intents are untouched; only very short prompts that look like quick questions are affected.
- Pre-filled drafts for quote requests remain attached to template-style answers and are not trimmed by this helper.

**Perceived benefit**
- Short questions feel snappier and more direct, with less explanatory filler.
- Answers stay within the contract: short intent → short, legible response.

---

## 4. Invisible Work Elimination

**Goal:** Remove or gate work that users cannot see, especially in production.

### 4.1 Dev-only logging for intro demo gating

**Files:**
- client/src/scout/ScoutOS.tsx

**Before**
- A `useEffect` around the `isFirstGuestVisit` logic logged intro demo gating state on every relevant change:
  - `console.log("[INTRO DEMO CHECK]", { ... })`
- This ran in all environments, including production, even though the output was only useful during development.

**Change**
- Wrapped the effect body with a dev guard:
  - `if (!import.meta.env.DEV) return;`

**Effect**
- In development, the diagnostic log remains available for debugging intro demo behavior.
- In production, the effect becomes a no-op and does not emit logs.

**Perceived benefit**
- Eliminates invisible console work in production while preserving the debugging tool locally.

---

## 5. Validation

- `npm run build`  
  - ✅ Successful; no routing or layout changes introduced.
- `npm run verify:scout-purity`  
  - ✅ Passed; no write-capable calls added to Scout tools.

No other contracts or governance docs were changed as part of these micro-wins.

---

## 6. Before/After Perceived Latency (Qualitative)

**Before**
- First-time or uncommitted-county users triggered dashboard/invoice/saved-contractor queries that could not yet influence the visible tiles.
- Every request dispatched an extra `SET_STATUS` back into `resolving_context` even though the reducer had already entered that phase.
- Short “what/why” questions sometimes produced answers that were slightly longer than the 1–3 sentence budget.
- Intro demo diagnostics wrote to the console in all environments.

**After**
- `/scout` feels lighter for new/guest users and pre-setup accounts, since tile-related data only loads once the home county is committed.
- Fewer internal status dispatches per request, with the same visible phase progression.
- Short, direct questions consistently result in tight, capped answers while preserving the core content.
- No extra console noise or overhead from intro diagnostics in production.

All changes are intentionally small and local; they prepare Scout for future streaming and eval work without altering its authority or feature surface.
