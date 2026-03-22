# Direct Connect Request Model

This document defines the **conceptual model** for a Direct Connect request. It is **doctrine only**, not an implementation spec: it describes how the system should *think* about requests, independent of UI tabs or specific form layouts.

It sits alongside:
- DIRECT_CONNECT_STATE_VOCABULARY.md (how requests are interpreted over time)
- REQUESTER_VOCABULARY.md (the words we use with humans)

During the 14‑day observation window, this document is **guidance only**. No new flows or forms should be built from it yet.

---

## 1. Canonical object

There is **one canonical object** for coordination:

> **Direct Connect Request**

Everything else (jobs, projects, gigs, employment, one‑off help) is an **interpretation** of the same underlying request.

Internally this aligns with the existing `work_requests` record; the doctrine is:

- One object per coordination effort.
- Many ways to *view* and *interpret* it.
- No parallel “job posting” or “project tracker” object types for requesters.

---

## 2. Core fields (conceptual)

A Direct Connect request captures **intent**, not just a raw description. Conceptually, it has these field groups:

1. **Who / where**
   - Requester identity (user, household, or organization)
   - Locality (county + state as the canonical “local” scope)

2. **What needs to happen**
   - Freeform description (user’s own words)
   - High‑level category (e.g., home repair, mechanic work, admin help, HOA issue)
   - Optional sub‑category or trade (e.g., electrician, mechanic, estimator)

3. **Shape of the work (intent signals)**
   - Duration signal (one‑off, short‑term, ongoing)
   - Commitment signal (one task vs ongoing help vs employment)
   - Urgency (now, soon, flexible)
   - Location requirements (on‑site, remote, hybrid)

4. **Visibility & routing preferences**
   - Visibility mode: public feed vs targeted vs community‑only.
   - Routing mode: auto‑routing vs manual invites.
   - Target lists (saved providers, specific contractors, invited individuals).

5. **Coordination / attachments**
   - Attachments (photos, documents, links) where relevant.
   - Constraints (budget guidance, timing windows, access constraints).

These are **conceptual fields**. The current live forms may expose only a subset; future flows should **extend** this model, not create separate object types.

---

## 3. Visibility modes

Visibility is a **property of the request**, not a separate posting type.

1. **Public Direct Connect**
   - Request can appear in public or provider‑facing feeds where appropriate.
   - Eligible audiences are controlled by routing rules (see below).

2. **Community‑scoped**
   - Request is visible only to members of a defined community scope (e.g., HOA, neighborhood, organization).

3. **Private coordination**
   - Request is routed only to:
     - Explicitly selected contractors
     - Saved providers
     - Directly invited individuals
   - No general public feed entry.

The **same Direct Connect request** can move between these visibility modes over time (e.g., start private, later widen to public) as part of coordination, but that is always a **state change on one object**, not a re‑posting.

---

## 4. Routing modes

Routing describes **how** the request finds the right eyes; it is separate from visibility.

1. **Auto‑routing**
   - System uses rules + available data to:
     - Match to providers (contractors, pros, helpers)
     - Surface in relevant community feeds
     - Trigger notifications where allowed
   - Scout’s role: explain what routing is happening and surface status, not invent new routing logic.

2. **Invite‑based routing**
   - Requester (or an admin) selects specific targets:
     - Saved contractors / providers
     - Known individuals or organizations
   - System handles messaging and coordination, but the invitation list is curated.

3. **Hybrid routing**
   - Start private (invites only), then optionally expand to:
     - Community scope
     - Broader provider pools

Routing mode is **chosen or inferred per request**, not encoded as a separate object type.

---

## 5. Employment vs project vs one‑off help

These are **interpretations of shape**, not different request types.

Given the same Direct Connect request, the system (and Scout) can interpret it as:

- **Employment‑shaped**
  - Ongoing, role‑like work (e.g., “full‑time estimator”, “part‑time bookkeeper”).
  - No single completion milestone; coordination focuses on fit and onboarding.

- **Project‑shaped**
  - Bounded scope with a natural “done” state (e.g., kitchen remodel, deck build).
  - Progress often maps to phases; outcome confirmation is meaningful.

- **Task / one‑off shaped**
  - Narrow, discrete work (e.g., “fix my brakes”, “mount this TV”).
  - High urgency, simple completion.

The **same object model** supports all three by varying:

- Required vs optional fields (e.g., employer details, ongoing budget band).
- Default routing and visibility choices.
- How outcomes are phrased in UI (per DIRECT_CONNECT_STATE_VOCABULARY).

The system should **infer** this shape from content + signals wherever possible, instead of forcing users to pick “job vs project vs gig” upfront.

---

## 6. Intent handling doctrine

Intent handling should follow a **progressive narrowing** pattern, not magical guessing:

1. Start from the user’s words (freeform description).
2. Apply known context:
   - Saved home county / locality
   - User role (homeowner, contractor, HOA board, admin)
   - Past coordination history
3. Narrow to a working shape:
   - Immediate, one‑off, ongoing
   - On‑site vs remote
   - Skill/trade/domain
4. Ask the **minimum additional questions** necessary to:
   - Route correctly
   - Avoid compliance or expectation traps
   - Set up outcome and follow‑through cleanly

Scout’s role:

- Explain what is happening (“I’ll treat this as a one‑off Direct Connect request for mechanic work near you”).
- Guide the user through clarifying questions.
- Never require the user to **name** the posting type (“project vs job vs gig”).

---

## 7. Views, not types

All “tabs” or “sections” in Direct Connect are **views on the same request model**, not separate posting systems. Examples of future views:

- **Post a request**
  - The single, intent‑first capture flow that adapts based on signals.

- **Open requests**
  - Requests currently visible to providers or communities, filtered by interpreted shape (employment, project‑shaped, one‑off, etc.).

- **Private coordination**
  - Requests currently limited to invites / saved providers.

- **My coordination**
  - What exists today: active / resolved / abandoned Direct Connect requests for this requester.

Doctrine:

- ❌ Do **not** create multiple “post job” / “post project” forms that write to different tables.
- ✅ Evolve **one** Direct Connect request creation flow that adapts in real time.

---

## 8. Freeze‑phase rules

While the 14‑day observation window is active:

- This model is **for thinking and documentation only**.
- Bug‑level fixes are allowed where current behavior violates doctrine, e.g.:
  - Scout referring to multiple requester‑facing object types (“project tracker”, “task board”, “project on my board”).
  - Scout routing requester intent away from Direct Connect.
- Product evolution based on this model (new forms, new tabs, new posting flows) is **frozen** until outcome triggers fire per OUTCOME_DECISION_CHARTER.md.

When triggers do fire, future changes should:

1. Reuse this **single object model**.
2. Start with **one adaptive request flow**, not parallel posting types.
3. Treat tabs and filters as **views**, not new schemas.
