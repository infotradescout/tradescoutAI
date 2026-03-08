# Direct Connect Charter

Execution contract companion (required layer): `DIRECT_CONNECT_EXECUTION_CONTRACT.md`

## 1. Purpose

Direct Connect (the `/tasks` surface) is the **primary hub for people who want to get something done locally**.

It represents **active needs and coordination attempts**, regardless of role or category.

It exists to:

- Serve as the default destination when a user thinks "I need this handled" (work, services, help).
- Hold **stateful representations of real-world coordination** (not just ideas or notes).
- Provide a single place where users can **see and manage what Scout and the community are helping them coordinate**.
- Anchor outcome measurement so that actions have a clear "home" in the product.

Direct Connect is **not** a passive backlog or job board; it is the live coordination and connection layer.

---

## 2. Position in the System

Direct Connect sits in the core loop as the middle layer:

> **Scout → Direct Connect → Outcome**

- **Scout (AI + chat)**
  - Interprets user intent.
  - Proposes actions (e.g., capture as a Work Request, send to board, contact providers).
  - May initiate coordination directly on the user's behalf.

- **Direct Connect (`/tasks`)**
  - The **stateful board** of Work Requests and coordination items.
  - The place where community posts, provider outreach, and other flows can attach when they represent ongoing coordination.

- **OutcomeConfirmationCard + analytics**
  - Capture whether a given coordination attempt actually helped: `local_action_outcome` events with `actionType`, `result`, location, and timing.
  - Provide the data used in the Outcome Decision Charter.

Direct Connect is the **anchor object** between Scout’s suggestions and the outcome measurement.

---

## 3. Invariants

These invariants must hold for features that involve coordination:

1. **Intent & representation**
  - If a user wants to **get something done locally**, that intent should live in Direct Connect.
  - If something is **actively being coordinated**, it must have a representation on Direct Connect.
  - This can be a thin Work Request shell, but it must exist.

2. **Anchor for flows**
   - Community posts sent "to the board" create or attach to a Direct Connect item.
   - Provider coordination flows (e.g., quote requests, helper tasks, promos) should be **linkable** to a Direct Connect item, even if indirectly.

3. **Scout language**
   - When Scout opens or updates coordination, it should **name Direct Connect explicitly**, e.g.:
     - "I've added this to your Direct Connect board."
     - "I've updated your Direct Connect item for this project."

4. **Outcome interpretation**
   - Outcome events (e.g., `local_action_outcome`) are interpreted as the result of **Direct Connect–anchored flows**, even if the card appears in another UI surface (community feed, request-quote, promos).

5. **Statefulness**
   - Direct Connect holds ongoing state; Scout is advisory and initiatory; outcome analytics are evaluative.
   - Direct Connect items should be updated over time rather than re-created for every minor change.

---

## 4. Explicit Non-Goals

Direct Connect is **not** intended to be:

- A general-purpose **task manager** (personal to-dos, reminders, non-local chores).
- A generic **job board** for one-off gigs.
- A **contractor directory** or search surface (those live elsewhere, e.g., Contractors, Helpers).
- A **review system** (ratings/reviews belong in reputation surfaces, not the coordination board).

If a proposed feature primarily serves one of the above without strengthening coordination flows, it does **not** belong in Direct Connect.

---

## 5. Guardrail Sentence

> **If a feature introduces coordination without a Direct Connect representation, it is incomplete.**

This guardrail prevents:

- "Hidden" coordination flows that bypass the canonical board.
- Fragmentation of coordination state across multiple pages or ad-hoc UIs.
- Future rewrites caused by flows that cannot be traced back to a Direct Connect item.

Any new coordination feature must:

- Either create a new Direct Connect item, or
- Attach to an existing one via a clear identifier.

---

## 6. Implementation Notes (Current State)

- Route: Direct Connect lives at `/tasks`.
- Data model: built on top of existing **Work Requests** and related APIs (e.g., `/api/work-requests`).
- Entry points (non-exhaustive):
  - AppShell and Mobile bottom nav: "Direct Connect" link to `/tasks`.
  - CommunityShell: rotating banner and header link to Direct Connect.
  - Helpers / Worker Marketplace: CTA "Start a project (Direct Connect)" linking to `/tasks`.
  - Community posts: actions like "Send to Direct Connect" and "View Direct Connect".
- Outcome integration:
  - OutcomeConfirmationCard is used in multiple flows (community notices, provider coordination, promotions) whose actions are conceptually anchored in Direct Connect.

These notes are descriptive, not prescriptive; they will evolve as long as they respect the invariants above.

---

## 7. Change Management

- Renaming of internal field names or schemas **is not required** to respect this charter.
- Any future expansion of Direct Connect (e.g., richer status, threading, multi-party flows) should:
  - Keep the Scout → Direct Connect → Outcome loop intact.
  - Preserve the invariants and non-goals above.
- During outcome-focused freeze periods, Direct Connect’s conceptual role must remain stable; only documentation and analytics interpretation should change.
