# Direct Connect Vision

This document describes, in plain English, what Direct Connect is *for* and how Helpers, Contractors, Scout, and outcomes fit together.

It is **doctrine only**, not a spec to build from during the current freeze. It guides future decisions so that new features extend a coherent system instead of creating parallel products.

---

## 1. What Direct Connect is

Direct Connect is the **universal hiring and coordination engine** for TradeScout.

- It is where **any job is posted** – literally anything a human can hire another human for.
- It is where **coordination happens** – who is involved, what needs to be done, and how it moves toward an outcome.
- It is the **single source of truth** for in‑flight work on the requester side.

Everything else in the product (community, Helpers, contractors, dashboards, outcome views) either:

- Feeds context into Direct Connect, or
- Reflects and explains what is happening inside Direct Connect.

---

## 2. One object, many interpretations

Direct Connect has **one canonical object**:

> **Direct Connect request**

This object represents a single coordination effort. It does **not** care if the work is called a job, a project, a gig, or a favor.

Different real‑world shapes – like:

- One‑off help ("fix my brakes")
- A bounded project ("remodel my kitchen")
- Ongoing employment ("hire a part‑time estimator")

…are all **interpretations of the same Direct Connect request**, not separate posting types.

Tabs and filters are **views on requests**, not new schemas.

---

## 3. Who responds: Contractors and Helpers

There are two primary responder types in this vision:

- **Contractors** – businesses and organizations.
- **Helpers** – individuals with skills and availability.

Both are **first‑class participants in Direct Connect**:

- Both can respond to Direct Connect requests.
- Both can be matched to tasks and to employment‑shaped work (when appropriate).
- Both are discovered and evaluated through their profiles.

Key doctrine:

- Helpers are **not** a separate marketplace or job system.
- Helpers are **another lens** on who can respond to a Direct Connect request.

---

## 4. Profiles, not parallel posting systems

Responder profiles answer a single question:

> "Is this human or organization a good match for this Direct Connect request?"

For Contractors, this is a **business profile**:

- Services and trades
- Service areas
- Photos, reputation, licenses (where available)

For Helpers, this is a **digital resume**:

- Skills and experience
- Availability and location
- Interest in tasks vs ongoing employment

Profiles do **not** create their own posting flows. They:

- Make responders discoverable when Direct Connect requests need them.
- Shape how Scout explains and recommends who might be a good fit.

---

## 5. How intent flows through Direct Connect

When someone wants to get something done, the path should be:

1. **Express intent** in their own words (often via Scout).
2. The system interprets that intent into a **Direct Connect request**.
3. Based on content + context, the system infers:
   - Shape (one‑off, project‑shaped, employment‑shaped).
   - Skill/domain (e.g., mechanic, landscaping, admin, HOA issue).
   - Urgency and locality.
4. Direct Connect routes that request to the right responders:
   - Contractors, Helpers, or both.
   - Publicly, to a community scope, or privately to invited responders.
5. Scout and the UI explain what’s happening in terms of:
   - **Direct Connect requests** and **active coordination**, not raw database types.

The user should **never** have to decide between "job", "project", or "gig" as a posting type. Those are internal interpretations, not form choices.

---

## 6. Scout’s role in this vision

Scout is the **orchestrator and explainer**, not a separate work system.

Scout should:

- Listen to how people describe what they need.
- Help turn that into a Direct Connect request.
- Explain how the request is being routed and who is seeing it.
- Surface the state and options (via panels like "Your Active Coordination").

Scout should **not**:

- Invent new posting types.
- Route requesters into legacy or parallel systems when Direct Connect is the canonical path.
- Force users to pick between "employment" and "project" as separate modes.

Doctrine: Scout always talks in the language of **Direct Connect requests**, **active coordination**, and **outcomes**, per REQUESTER_VOCABULARY.md.

---

## 7. Outcomes as the measure of success

Success is defined in terms of **outcomes**, not just posts or messages.

- Direct Connect requests move through canonical states (Created, Routing, Awaiting responses, In discussion, Pending outcome, Resolved, Abandoned).
- Outcome events (e.g., local_action_outcome) describe what actually happened.
- The system learns which patterns of routing, visibility, and responder mix (Contractors vs Helpers vs both) lead to better outcomes.

Outcome data – interpreted through OUTCOME_DECISION_CHARTER.md – is what should eventually drive:

- Amplifying successful flows.
- Fixing bottlenecks.
- Deciding when to invest more in Helpers, Contractors, or specific types of work.

---

## 8. Freeze‑phase commitments

While the current **14‑day observation window** is active:

- Direct Connect remains the **one** requester‑side coordination surface.
- Scout and UI language is cleaned up to align with:
  - Direct Connect as the hub.
  - Direct Connect requests as the object.
  - Contractors and Helpers as responders, not parallel systems.
- No new tabs, posting types, or Helper UIs are introduced.

This vision is meant to:

- Prevent future fragmentation ("Helpers Marketplace", duplicate job boards, separate project trackers).
- Keep all evolution anchored to a single, coherent engine: **Direct Connect**, with **one request model** and **multiple responder types**.
