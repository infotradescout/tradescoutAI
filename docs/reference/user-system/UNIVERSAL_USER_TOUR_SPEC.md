# Universal User Tour Specification

This document defines the **one universal tour system** for TradeScout. It is a **doctrine + UX spec**, not a build order. During the current freeze, it guides cleanup and future implementation without adding new product behavior.

---

## 1. Purpose

The Universal User Tour exists to:

- Teach users the **one coherent mental model** of TradeScout:
  - Scout is the command center.
  - Direct Connect is where work lives.
  - Helpers and contractors respond; outcomes matter.
- Replace fragmented, role‑specific, and legacy tours.
- Make the first visit to a surface feel guided without overwhelming users.

It is **not** for feature dumping, role selection, or upselling.

---

## 2. Core rules

1. **One system**
   - All tours come from a single tour mechanism, not many ad‑hoc components.

2. **Page‑scoped**
   - Tours are defined per surface (e.g., Scout, Direct Connect, Community, Contractors), not per role.

3. **Triggered once per page**
   - On first meaningful visit to a page/surface.
   - Dismissed or completed state is remembered (e.g., localStorage or equivalent), so users are not re‑nagged.

4. **Never role‑specific in content**
   - Copy speaks to what the page does, not who the user “is”.
   - No “Are you a homeowner or contractor?” branches inside tours.

5. **Never all at once**
   - Each page teaches at most **3 key ideas**.
   - No multi‑page wizards for generic users during the initial tour.

6. **Aligned with doctrine**
   - Language must follow REQUESTER_VOCABULARY.md and DIRECT_CONNECT_VISION.md.
   - Scout is described as orchestrator; Direct Connect as the coordination engine.

---

## 3. What the tour teaches (only three things)

Every surface’s tour should reinforce a subset of the same three pillars:

1. **Scout is your command center**
   - Example phrasing: “Ask Scout what you want to get done. Scout can turn that into a Direct Connect request and keep you oriented.”

2. **Direct Connect is where work lives**
   - Example phrasing: “Anything you want done becomes a Direct Connect request. Your active coordination lives in Direct Connect.”

3. **People respond, outcomes matter**
   - Example phrasing: “Helpers and contractors respond to your Direct Connect requests. We care about real outcomes, not just posts.”

No tour should introduce new mental models beyond these pillars.

---

## 4. Per‑surface tour goals

### 4.1 Scout (/scout)

**Goal:** Make Scout feel like the natural starting point.

- Teach:
  - “Type what you need; Scout helps turn it into a Direct Connect request.”
  - “Scout can also help you understand what’s already in motion.”
- Must not:
  - Mention “project tracker”, “boards”, or legacy task language.
  - Offer role selection or mode toggles inside the tour.

### 4.2 Direct Connect (/tasks)

**Goal:** Anchor Direct Connect as the coordination hub.

- Teach:
  - “This is where your Direct Connect requests live.”
  - “Active coordination shows what Scout and your community are working on.”
  - “Resolved items stay here so you can see what actually got done.”
- Must not:
  - Present multiple posting types (“job vs project vs gig”).
  - Introduce separate concepts like “Project Tracker” or “Task Board”.

### 4.3 Community (/community and related feeds)

**Goal:** Explain community as context and amplification, not a separate work system.

- Teach:
  - “This is your local feed — posts, updates, and coordination around your area.”
  - “Some Direct Connect requests may surface here when it helps the right people see them.”
- Must not:
  - Suggest that posting in the community is the primary way to hire help.
  - Conflict with Direct Connect as the coordination hub.

### 4.4 Contractors (/contractors)

**Goal:** Explain discovering and learning about providers.

- Teach:
  - “Browse and learn about contractors who can respond to Direct Connect requests.”
  - “Save providers so Scout and Direct Connect can invite them when relevant.”
- Must not:
  - Introduce a parallel “job posting” concept.
  - Frame Contractors as the only responders (Helpers must be conceptually allowed).

### 4.5 Helpers (/helpers or equivalent, when present)

**Goal:** Frame Helpers as first‑class responders, not a separate marketplace.

- Teach:
  - “Helpers are individuals with skills and availability who can respond to your Direct Connect requests.”
  - “Their digital resume helps match them to the right requests.”
- Must not:
  - Suggest a separate “Helper job board” disconnected from Direct Connect.
  - Ask users to choose “contractor vs helper” at posting time.

---

## 5. Anti‑goals (what tours must never do)

Tours **must not**:

- Ask users to choose roles or product modes (“Are you a homeowner or a pro?”).
- Describe multiple competing ways to start work (e.g., “start a project”, “post a job”, “request a quote” as separate systems).
- Teach legacy or deprecated concepts:
  - “Project Tracker” as a primary concept.
  - “Task board” / “Work board” for requesters.
  - Any path that bypasses Direct Connect for requester coordination.
- Over‑explain internal objects or schemas.

Tours **may** mention pro‑side surfaces (e.g., project management views) only when:

- Clearly framed as **how responders manage their side**, not how requesters start work.

---

## 6. Legacy tours and onboarding flows

The following classes of tours are considered **deprecated** and should be removed or folded into the universal system:

- Contractor‑specific dashboard tours (e.g., ContractorDashboardTour) that:
  - Teach separate “project tracker” workflows.
  - Duplicate concepts already taught by the universal tour.
- Old community tours that:
  - Treat feed posting as the primary way to get help.
- Project Tracker / work‑board tours.
- One‑off onboarding modals that:
  - Re‑educate users on basic navigation in ways that conflict with Scout + Direct Connect.

Doctrine:

- These are treated as **bugs**, not product variants.
- Removing or suppressing them is allowed during the freeze because it reduces fragmentation and restores the intended mental model.

---

## 7. Implementation constraints (for when the freeze lifts)

When it is time to implement or refactor tours:

- Use a single, shared tour infrastructure:
  - One storage mechanism for “has seen tour for this surface”.
  - One component or pattern for rendering steps.
- Keep each surface to **1–3 short steps**.
- Ensure copy is:
  - Consistent with REQUESTER_VOCABULARY.md.
  - Consistent with DIRECT_CONNECT_REQUEST_MODEL.md and DIRECT_CONNECT_VISION.md.
- Validate that:
  - Scout’s links into a page and that page’s tour tell the **same story**.

Until then, this spec is the north star for:

- Deciding which existing tours should be deleted or suppressed.
- Guarding against new, ad‑hoc onboarding flows that fragment the experience.
