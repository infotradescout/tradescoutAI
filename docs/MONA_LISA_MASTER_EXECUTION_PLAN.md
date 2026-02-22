# The “Mona Lisa” Master Execution Plan (Locked)

Status: **Locked (do not execute yet)**  
Date locked: **2026-02-22**  
Repo scope: **TradeScout only** (MealScout work lives in its own repo; this document captures cross-platform intent without importing assets/code).

This document is the definitive blueprint for transforming TradeScout (and later, MealScout) into a **global Source of Truth** for:
- blue-collar work (TradeScout)
- local food ecosystem (MealScout)

It is written as an execution plan suitable for Codex-style implementation, while preserving platform law:
- Awareness ≠ Authority
- Intent → Decision Card → Contact
- Trust/CVS governs exposure
- Counties are operational containers (facts in `county_metrics`, assignments in `county_entities`, context in `county_notes`)
- No UI/admin computed intelligence (jobs precompute + store snapshots)
- No pay-to-play; no lead selling

---

## 1) The “Universal Scout” Foundation (Immediate)

### 1.1 Parent OS / organ model
- **TradeScout is the Parent OS**.
- **MealScout is a specialized organ** (“Food & Supply”).

### 1.2 The bridge
- Integrate Scout with MealScout via the existing `/api/actions` contract.
- Scout must be able to **read/write** across both domains to provide a unified “Universal Local” experience.

### 1.3 Unified identity
- Use a stable cross-app identifier (e.g., `tradescout_id`) inside MealScout.
- Scout must understand multi-domain roles (e.g., “Pro” in TradeScout, “Food Truck Owner” in MealScout).

**Non-goals (for TradeScout repo right now):**
- No MealScout schema/code is added here.
- No cross-repo DB access is implemented here yet.

---

## 2) The “High-Definition” Intake (Phase 1)

### 2.1 Project Clarifier (work_request)
Enhance the `work_request` flow so Scout asks **2–3 high-value, trade-specific questions** before matching/routing, e.g.:
- plumbing: “Is the leak behind a wall or exposed?”
- electrical: “Repair an existing circuit or add a new one?”
- HVAC: “Completely down or underperforming?”

Goal: every request is actionable for pros, reducing declines and back-and-forth.

### 2.2 Pro-Brief summarizer
For each request, auto-generate a 1-sentence “Pro-Brief” that captures:
- Trade
- County
- Budget band (if available)
- Urgency
- Key constraint (materials on hand vs needs supply)

Pros should see “the meat” immediately in the first notification.

### 2.3 Pre-flight checklists
Scout provides a short prep checklist for:
- homeowners (TradeScout)
- food truck owners (MealScout)

Purpose: make first human-to-human call 10x more productive.

---

## 3) The “Trust-First” Credential (Phase 2)

### 3.1 CVS as a portable asset
Make CVS a badge pros can embed externally (e.g., their website), turning external presence into a Trust/CVS-driven acquisition channel **without pay-to-play**.

### 3.2 Automated signal harvesting
Scout proactively identifies trust markers (certifications, awards, licenses, experience claims) from:
- chats
- profiles

Scout flags them for admin review (never auto-verifies). Target implementation hook: `profileVerificationService.ts`.

### 3.3 Golden Fork / Golden Plate
MealScout-only:
- Automate “Golden Standard” award signals based on:
  - high review counts
  - consistent verified bookings
- Use drift detection (e.g., `reviewerLevelDriftDetector.ts`) to keep awards meaningful over time.

---

## 4) The “Blue-Collar Bloomberg” (Phase 3)

### 4.1 Market Pulse dashboard
Use precomputed data (`county_metrics`, `search_query_events`) to surface demand signals:
- “HVAC demand up 40% in Harris County”
- “Late-night tacos surging near the university”

Rules:
- Intelligence is computed by jobs and stored as snapshots.
- UI reads snapshots only.
- Access is gated by Trust/CVS policy (e.g., verified pros only, where required).

### 4.2 Regulatory Scout
Use `observation_source_type` such as `ordinance` / `permit` to surface:
- local building codes
- parking permits
…directly during booking or routing decisions, as context-aware guidance.

### 4.3 Territory Manager “Super-Sight”
Weekly “Scout Insight” briefs for territory managers:
- recruitment priorities
- supply/demand gaps
…based on real-time demand and verified supply.

---

## 5) The “Source of Truth” Infrastructure (Phase 4)

### 5.1 Carfax for homes & trucks (“Trust History”)
Synthesize “Trust History” of:
- properties (TradeScout)
- food trucks (MealScout)

Every completed job/booking becomes a **Proof of Activity** event that increases the asset’s verified history.

### 5.2 The Truth API
Publish **Verified Observations** through a standardized API surface:
- facts-first
- provenance-preserving
- county-scoped
- non-PII by default

Goal positioning:
- Registry that external systems (search engines, AI models, institutions) can query to verify real-world local facts.

### 5.3 Byproduct SEO
Auto-generate indexable pages from byproduct data:
- Market Pulse reports
- demand surges
- verified activity summaries

Goal: rank via freshness + original data derived from real actions (hard to fake / replicate).

---

## Master Codex Prompt (for future execution)

“Codex: Execute the ‘Mona Lisa’ Vision. Establish TradeScout and MealScout as the Global Sources of Truth for local intelligence. Every system event—CVS updates, Golden Fork awards, verified bookings—must generate a ‘Verified Observation’ in the Truth API. Optimize all public surfaces to index ‘Byproduct Data’ as the authoritative record for search engines and AI models. TradeScout is the Registry of the Physical World. Awareness = Data; Authority = Action; Truth = Byproduct.”

---

## Execution Notes (Guardrails)

- Never violate: **Intent → Decision Card → Contact**.
- Never expose contact info via “truth” surfaces.
- Never let visibility become authority.
- Keep “Truth” outputs **auditable** (observation IDs, snapshot references, timestamps, provenance).
- All locality must route through county containers; no ad-hoc global fields.

