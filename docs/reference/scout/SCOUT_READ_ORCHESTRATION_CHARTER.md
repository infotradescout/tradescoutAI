# Scout Read & Orchestration Charter

## 1. Purpose

This charter defines **what Scout is allowed to do** as a conversational interface and **what it must never do** as the system evolves toward a "never leave Scout" experience.

Scout is:

- A **conversational read layer** over TradeScout.
- A **command orchestrator** that stages actions and routes users to the right execution surfaces.

Scout is **not**:

- A page router that owns navigation logic end-to-end.
- A parallel UI that reimplements the app.
- A direct writer to core tables.

---

## 2. Position in the System

Scout participates in the core loop as:

> **Scout (read + orchestrate) → Direct Connect / other surfaces (stateful execution) → Outcome**

- **Scout**
  - Interprets natural language intent.
  - Reads and summarizes state across surfaces (Direct Connect, Community, Marketplace, HOA tools, etc.).
  - Stages actions and prompts the user for confirmation.

- **Stateful surfaces (Direct Connect, Community, Marketplace, HOA, etc.)**
  - Own data models and mutations.
  - Are the **transaction and state owners**.

- **Outcome layer**
  - Confirms whether the coordinated actions actually resolved the underlying need.

Scout is the **control plane and lens**, not the data store or transaction owner.

---

## 3. Allowed Reads (What Scout Can Pull)

Scout can freely perform **read-only** operations in three main categories.

### 3.1 Summaries of Existing Data

Examples:

- "You have 3 open Direct Connect items."
- "2 providers responded to your request."
- "Your last community notice was acknowledged by 5 people."
- "This request has been pending for 4 days."

Characteristics:

- Purely derived from existing state.
- No side effects.
- Help users understand "what is happening" across the system.

### 3.2 Scoped Previews (Not Full UIs)

Examples:

- Compact list of Direct Connect items with title + status + age.
- Snippet of a community post (title + first lines).
- Provider card summary (name, rating, high-level fit).
- HOA notice highlights.

Characteristics:

- Minimal slices of data to support a decision.
- **Not** full management interfaces.
- Always accompanied by clear CTAs like:
  - "Open in Direct Connect"
  - "Review details"
  - "View in Community"

### 3.3 State Explanations

Examples:

- "This request is in Direct Connect because you asked for local help. Two providers have viewed it, but no one has responded yet."
- "This community notice is pinned and visible to your county, but no replies have been posted."

Characteristics:

- Explain **why** something is in its current state.
- Clarify where coordination lives and what happens next.
- Improve user understanding without making changes.

---

## 4. Action Pattern (Stage → Confirm → Execute)

All Scout-initiated actions must follow this pattern:

> **Scout stages → User confirms → Owning surface executes**

Examples:

- "Send this post to Direct Connect?" → user sees the plan → confirms → system calls the existing send-to-board API.
- "Draft a neighborhood notice?" → Scout prepares a draft → user reviews (possibly on a dedicated surface) → confirms publish.
- "Reach out to these providers?" → Scout suggests which providers → user confirms outreach → existing provider-contact flow runs.

Rules:

- **Scout may stage** actions, but **may not execute mutations without explicit user confirmation**.
- The actual mutation happens via the **owning surface's** APIs and models (e.g., Direct Connect, Community, Marketplace), not via a bespoke Scout write path.

---

## 5. Prohibited Behaviors (What Scout Must Not Do)

Scout must never:

1. **Own core writes**
   - No direct POST/PUT/PATCH/DELETE to core tables without going through the same paths used by the primary surfaces.
   - No "Scout-only" mutations that bypass Direct Connect, Community, Marketplace, or HOA ownership.

2. **Replace entire UIs**
   - No attempt to rebuild full management interfaces inside the chat (e.g., full Direct Connect board, full community moderation UI).
   - Previews and summaries are allowed; full CRUD consoles are not.

3. **Mutate state implicitly**
   - No background changes based solely on conversational context.
   - Every meaningful mutation requires an explicit, surfaced confirmation step.

4. **Become a god-object**
   - Scout may not grow ad-hoc responsibilities that belong in typed tools, services, or surfaces.
   - All operations should continue to flow through well-defined tool/route layers.

If Scout ever feels like it is "doing everything itself," this charter is being violated.

---

## 6. Relationship to Direct Connect

This charter is intentionally aligned with the Direct Connect Charter:

- Direct Connect is the **primary hub** for users who want to get something done locally.
- Scout is the **interactive dashboard** and **decision engine** that:
  - Surfaces Direct Connect items.
  - Explains their state.
  - Stages next steps.

Invariants:

- Direct Connect remains the **stateful truth** and ledger of coordination.
- Scout surfaces a "Direct Connect overview" as a read-only or minimally interactive panel (when allowed by the Outcome Decision Charter), not as a full replacement board.
- OutcomeConfirmationCard and outcome analytics still close the loop outside Scout's internals.

---

## 7. Future Extensions (When Freeze Allows)

When the Outcome Decision Charter allows product changes, the **first Scout-side evolution** toward "never leaving Scout" should be:

- A **read-only Direct Connect overview inside Scout**, showing:
  - Open items.
  - Status.
  - Age / freshness.
- Each item offers only high-level actions such as:
  - "View details" (navigates to Direct Connect).
  - "Take next step" (stages an action for confirmation on the owning surface).

Even then:

- No new schemas.
- No new Scout-only persistence.
- No bypassing of Direct Connect or other surfaces as state owners.

This keeps Scout as the control plane that **collapses cognitive distance** without collapsing the architecture.
