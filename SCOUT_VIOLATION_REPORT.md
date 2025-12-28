# Scout Violation Report

Date: 2025-12-27
Scope: TradeScoutPro repo (Scout-related code only)
Contracts: ARCHITECTURE.md, SURFACE_CONTRACT.md, SCOUT_CONTRACT.md

This report is strictly evidence-based. All findings below are backed by concrete code or wiring in the current repo. No hypothetical issues are included.

---

## 1. Axis Summary (Pass / Fail by Axis)

| Axis | Topic                          | Status   | Notes |
|------|--------------------------------|----------|-------|
| 1    | Authority (routing, writes)    | **Partial / Fail** | Canonical ScoutOS mostly advisory, but several flows perform writes based solely on chat text; legacy Chatbot performs direct data writes and account creation without explicit UI confirmation. |
| 2    | Lifecycle Phases               | **Partial / Pass** | ScoutOS explicitly models phases via `ScoutStatus` and never streams partial reasoning; legacy Chatbot has only a generic loading state and no phase separation. |
| 3    | Output Discipline              | **Partial / Fail** | ScoutOS enforces a hard cap on first answers and trims content; legacy Chatbot streams unconstrained LLM text with no intent-length discipline. |
| 4    | UI ↔ Scout Alignment           | **Pass (ScoutOS)** | ScoutOS exposes explicit status for each phase and drives UI loaders via `ScoutThread`; no invisible work detected. Legacy Chatbot uses a generic loader only (not the canonical surface). |
| 5    | Performance Perception         | **Pass** | No clear evidence of wasted context loads or double work in ScoutOS; most heavy operations are guarded and scoped. |
| 6    | Contract Drift (legacy vs law) | **Fail (Legacy Surfaces)** | Legacy Chatbot and older AI flows (root components using `@google/genai`) predate the contracts and violate multiple Scout constraints when used as Scout-like experiences. |

---

## 2. Confirmed Violations

Each item lists: file/component, axis, contract section, and the concrete reason.

### 2.1 Authority Violations (Axis 1)

### Marketplace Listing Creation from ScoutOS

**Status:** ✅ Resolved

**Previous Issue**
ScoutOS marketplace tools could directly create or draft marketplace listings via write-capable assistant actions, violating SCOUT_CONTRACT.md §1 (Advisor-only role) and §3 (Explicit confirmation before writes).

**Resolution**
The write-capable Scout marketplace tool was removed and replaced with a pure proposal helper:
- Scout now emits a `MARKETPLACE_LISTING_PROPOSAL` object (data only).
- Scout navigates the user to the Exchange sell surface with a prefilled draft.
- All marketplace writes occur only after explicit user confirmation via the Exchange UI submit action.

**Current State**
- Scout cannot perform marketplace writes from chat-only intent.
- Exchange UI remains the sole authority for listing creation.
- Authority boundary is contract-compliant.

**Audit Axis**
- Axis 1 (Authority): PASS

### Provider Profile Upsert from ScoutOS

**Status:** ✅ Resolved

**Previous Issue**
ScoutOS could create or update provider profiles by calling a write-capable `upsertProviderProfile` tool from the provider-offer branch, based solely on chat intent and heuristics, violating SCOUT_CONTRACT.md §1 (Advisor-only) and ARCHITECTURE.md rules that reserve writes for explicit UI-confirmed flows.

**Resolution**
The write-capable provider upsert tool was removed and replaced with a pure proposal helper:
- Scout now emits a `PROVIDER_PROFILE_PROPOSAL` object (data only) via `proposeProviderProfileUpdate`.
- Scout navigates the user to the provider setup surface (`/offer-services?review=1`) where changes can be reviewed.
- All provider profile writes occur only after explicit user confirmation through the Provider UI submit action.

**Current State**
- Scout cannot upsert or modify provider profiles from chat-only intent.
- The Provider setup UI at `/offer-services` remains the sole authority for saving provider profile changes.
- Authority boundary for provider configuration is contract-compliant.

**Audit Axis**
- Axis 1 (Authority): PASS

#### 2.1.3 Legacy Chatbot direct writes and account creation

- File / component: components/Chatbot.tsx — `handleToolCall`
- Contracts:
  - ARCHITECTURE.md — Scout does not own persistence; no direct data mutation
  - SCOUT_CONTRACT.md — Section 1 (Scout must not mutate data without confirmation)
- Evidence:
  - `createAccount` tool:
    - Calls `onSignup(username, bio)`.
    - Reads all users via `db.getUsers()`, mutates the user’s `role`, and calls `db.addUser(newUser)`.
    - Returns a success string indicating the user is now logged in.
  - `submitQuoteRequest` tool:
    - Assembles a `Lead` object with a new id and `status: 'open'` and calls `db.addLead(newLead)`.
  - These writes are initiated when the LLM decides to call these tools in response to natural-language user input — there is no additional, separate UI confirmation step for the lead or account payload.
- Why this is a violation:
  - Account creation and lead submission are **state-changing operations** performed inside the Chatbot tool handler, driven solely by model tool calls.
  - This bypasses the "Scout is an advisor" rule and the requirement that writes be mediated by explicit UI confirmation.

### 2.2 Lifecycle Phase / Output Discipline Violations (Axes 2 & 3)

#### 2.2.1 Legacy Chatbot has no explicit lifecycle phases

- File / component: components/Chatbot.tsx
- Contracts:
  - SCOUT_CONTRACT.md — Section 2 (Scout Lifecycle Phases)
- Evidence:
  - The Chatbot component uses a single `isLoading` boolean and a three-dot loader while awaiting a `GoogleGenAI` response.
  - There is no representation of distinct phases like "Resolving Context", "Checking System State", "Reasoning & Planning", or "Responding" in its state machine or UI.
  - All work (intent interpretation, data lookup via tools, reasoning, final response synthesis) is collapsed under one opaque loading state.
- Why this is a violation:
  - The contract requires **discrete, visible phases** and explicitly calls out that certain phases must not emit user-facing output.
  - The legacy Chatbot does not expose any such phases; users only see a generic loader, and the internal flow is not aligned with the canonical phase model.

#### 2.2.2 Legacy Chatbot unconstrained response length

- File / component: components/Chatbot.tsx — main `handleSend` body
- Contracts:
  - SCOUT_CONTRACT.md — Section 3 (Output Discipline)
- Evidence:
  - The Chatbot calls `ai.chats.create(...).sendMessage(...)` and then appends `response.text()` (or `finalResult.response.text()`) directly to the message list.
  - There is **no enforcement** of:
    - Short vs medium vs long intent distinctions.
    - Maximum character or sentence count for short intents.
    - Structured/bulleted responses for medium/long intents.
  - The content and length are wholly determined by the model, without runtime guards.
- Why this is a violation:
  - The Scout contract requires output length and structure to be dictated by **intent**, and forbids defaulting to verbose answers.
  - This Chatbot path can produce arbitrarily long responses to very short prompts, violating the discipline rules.

### 2.3 Contract Drift / Legacy Surfaces (Axis 6)

#### 2.3.1 Multiple AI entry points with divergent behavior

- Files / components (non-exhaustive but observed):
  - components/Chatbot.tsx ("Scout Guide"-style helper)
  - components/AddBusinessModal.tsx (uses `GoogleGenAI` for external business lookup)
  - components/CommunityForum.tsx, components/ContractorCard.tsx, components/ComparisonModal.tsx, components/AdminDashboard.tsx (each imports `GoogleGenAI` and uses it directly)
- Contracts:
  - ARCHITECTURE.md — Scout is optional and advisory; core flows should go through the spine and tools
  - SCOUT_CONTRACT.md — Intended to be the canonical behavioral law for Scout
- Evidence:
  - The repo contains **two distinct AI patterns**:
    1. Canonical ScoutOS + tool layer + status machine (client/src/scout/** and client/src/agent/tools/**).
    2. Legacy point-in-time uses of `@google/genai` in root components that:
       - Do not use the Scout status machine.
       - Do not share the output discipline or sanitization logic.
       - Sometimes fetch external data (e.g., Google Maps / Search in AddBusinessModal) and synthesize content directly.
  - The contract files (ARCHITECTURE.md, SCOUT_CONTRACT.md) describe a single, disciplined Scout role, but the codebase currently exposes multiple AI surfaces with inconsistent behaviors.
- Why this is a violation (Axis 6 — contract drift):
  - These legacy flows appear to predate the Scout contracts and have not been brought under the same behavioral envelope.
  - When they are presented to users as "Scout" or Scout-adjacent, their behavior contradicts the law (no phases, unconstrained output, direct writes, external data pulls without the same locality rules, etc.).

---

## 3. Ambiguities (Needs Clarification, Not Counted as Violations Yet)

These items are **not** asserted as violations; they are edge cases where the contracts could be interpreted more than one way.

### 3.1 Are cluster NAVIGATE actions considered "Scout controlling routing"?

- Context:
  - In ScoutOS, clusters and smart suggestions produce actions of type `NAVIGATE`.
  - `ScoutThread` and `handleClusterAction` validate these actions and then call `navigate()` only when the **user clicks** a cluster button or suggestion.
- Why ambiguous:
  - ARCHITECTURE.md says "Scout cannot create or redirect routes" and that routing is owned by AppShell.
  - Here, navigation is an immediate result of a user click on a Scout-generated action chip.
- Interpretation used for this audit:
  - Treated as **compliant**, because the user performs an explicit UI action and the routing remains owned by the UI/router, not Scout autonomously.
  - If the product definition requires Scout to only ever suggest text (and never own actionable nav chips), this would need to be tightened.

### 3.2 Auto-sent onboarding and help intents

- Context:
  - ScoutOS reads localStorage markers like `"__SCOUT_ONBOARDING__"` and `"scout:help-intent"` and, on first clean `/scout` load with no prior user messages, may auto-send a stored prompt via `handleSend`.
- Why ambiguous:
  - SCOUT_CONTRACT.md phases assume a fresh **user action** precedes entering Resolving Context.
  - Auto-sent prompts triggered by other parts of the app blur the definition of "new user action".
- Interpretation used for this audit:
  - Treated as **within contract**, since the originating action (signup or Help Center use) is still a user-initiated event and Scout status is correctly surfaced.
  - If the product requirement is that **only explicit typing or tile clicks** may initiate Scout work, this could be reclassified as a violation.

### 3.3 "Advisor vs. controller" and guarded writes

- Context:
  - Both `postMarketplaceListing` and `upsertProviderProfile` write through the API layer, with `postMarketplaceListing` hitting a guarded assistant endpoint.
- Why ambiguous:
  - The contracts forbid Scout from acting as a controller or performing writes without explicit UI confirmation.
  - One reading: a guarded assistant endpoint + the user’s original text intent is sufficient confirmation.
  - Another reading (stricter): there must be a **separate, explicit confirmation screen** between intent and write.
- Interpretation used for this audit:
  - Classified as violations under a **strict reading** (no writes without a dedicated confirm step).
  - If product leadership confirms that chat text + guard rails count as explicit confirmation, these could be downgraded to non-violations.

---

## 4. Non-Issues (Look Suspicious, But Are Contract-Compliant)

These are behaviors that could look like violations but are aligned with the contracts on closer inspection.

### 4.1 ScoutOS phase modeling via ScoutStatus

- Files:
  - client/src/scout/state.ts — `ScoutStatus` and reducer
  - client/src/scout/ScoutThread.tsx — progress and status labels
  - client/src/scout/ScoutOS.tsx — `setStatus` usage
- Why it looks suspicious:
  - The statuses (`"resolving_context"`, `"checking_documents"`, `"executing_action"`, `"ready"`) do not match the exact phase names in SCOUT_CONTRACT.md.
- Why it is compliant:
  - There is a **clear, explicit state machine** that:
    - Moves from user message → `resolving_context` → `checking_documents` (when calling `/api/scout`) → `ready` → `idle`.
    - Does not stream intermediate reasoning text.
    - Drives visible UI labels like "Checking your account and location...", "Scanning your community...", "Preparing your answer...".
  - This satisfies the requirement that phases be discrete, visible, and that reasoning not leak into Phase 2/3 UI.

### 4.2 Watchdog forcing idle after 12 seconds

- File: client/src/scout/ScoutOS.tsx — `useEffect` with 12s timeout on `isBusy`
- Why it looks suspicious:
  - The watchdog forcibly sets status to `"idle"` even if an underlying request is still in flight.
- Why it is compliant for contract purposes:
  - The contract focuses on **behavioral clarity and trust**, not exact timing.
  - The watchdog prevents the user from being stuck in an indeterminate phase; if a request later resolves, ScoutOS still handles errors and logs telemetry.
  - This is a UX hardening measure, not a phase violation.

### 4.3 Geolocation-based county updates

- Files:
  - client/src/scout/ScoutOS.tsx — `handleUseDeviceLocation`
  - client/src/agent/tools/geoPreferences (called by ScoutOS)
- Why it looks suspicious:
  - Scout seems to be updating locality based on device geolocation.
- Why it is compliant:
  - The update is triggered only via an explicit UI button (`Use device location`).
  - The implementation calls `updateGeoPreferencesFromDeviceLocation` and then `refetchUser()`; it does not silently change county without the user-initiated action.
  - ARCHITECTURE.md allows such flows as long as they go through the API layer and are user-confirmed.

---

## 5. Fix Priority Order (When You Choose to Implement)

This is a suggested order of operations if/when you decide to fix the violations. It is **not** implementation work.

1. **Lock down chat-initiated writes (highest impact)**  
   - Decide a single rule for what counts as "explicit UI confirmation" for writes.  
   - For `postMarketplaceListing` and `upsertProviderProfile`, either:
     - Insert a confirmation screen before sending the write, or
     - Reclassify these flows as out of scope for Scout (Scout suggests, UI owns the action).  
   - For legacy Chatbot tools (`createAccount`, `submitQuoteRequest`), either retire this surface or route these actions through the canonical ScoutOS + tool layer with explicit confirmation.

2. **Retire or gate the legacy Chatbot as a Scout surface**  
   - If components/Chatbot.tsx is still reachable in production:
     - Either block it behind a pilot/dev flag or hard-redirect users to the canonical `/scout` surface.
     - Alternatively, retrofit it to use the same phase + output discipline rules as ScoutOS (status machine, capped first answer, no direct writes).

3. **Unify output discipline across all Scout-labeled experiences**  
   - Ensure any UI presented as "Scout", "Scout Guide", or similar:
     - Uses the same short/medium/long intent rules from SCOUT_CONTRACT.md.
     - Enforces caps on first answers and trims or sections long outputs.  
   - For components like AddBusinessModal and CommunityForum that use `GoogleGenAI` directly, either:
     - Treat them as pure tools (not Scout) with their own contracts, or
     - Route them through the ScoutOS/tool layer so their behavior inherits Scout’s discipline.

4. **Clarify the formal stance on guarded assistant actions**  
   - Explicitly document in SCOUT_CONTRACT.md or ARCHITECTURE.md whether:
     - Chat text + a server-side guard is sufficient justification for writes, or
     - A dedicated client-side confirmation step is always required.  
   - Update the affected flows in ScoutOS accordingly once this policy is decided.

5. **Optionally tighten phase naming and telemetry**  
   - If you want 1:1 naming between the textual phases in SCOUT_CONTRACT.md and `ScoutStatus`, rename or alias statuses so logs and UI exactly mirror the contract language.

---

This concludes the Scout Violation Audit. No runtime code was modified; all findings are derived from the current repository state at the time of this report.
