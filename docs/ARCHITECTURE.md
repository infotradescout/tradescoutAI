# TradeScout — Canonical Architecture

This document defines the authoritative system architecture.
All future changes MUST comply with this file.

---

## 1. System Spine (Non-Negotiable)

Request Flow:

Client (Vite + React)
→ AppShell (global layout + nav)
→ Feature Surface (page / workspace)
→ API Layer (Express routes)
→ Storage (Drizzle + Postgres)
→ Optional Scout Mediation (read + recommend only)

Scout does NOT own routing, layout, or persistence.

---

## 2. Ownership Boundaries

### UI
- AppShell owns:
  - navigation
  - global spacing
  - background, borders, and glass effects
- Feature surfaces MAY NOT:
  - introduce outer borders
  - introduce viewport padding
  - override body/background styles

### Routing
- All routes are declared centrally
- No feature may self-register routes dynamically
- Scout cannot create or redirect routes

### Data
- Database is the source of truth
- Scout may:
  - read
  - summarize
  - recommend
- Scout may NOT:
  - mutate data directly
  - invent state
  - bypass API validation

---

## 3. Scout Authority (Frozen)

Scout is an **advisor**, not a controller.

Allowed:
- Interpret user intent
- Suggest actions
- Summarize system state
- Guide navigation via UI prompts

Forbidden:
- Executing writes without explicit UI confirmation
- Altering layout or UI structure
- Persisting memory without API mediation

---

## 4. Frozen Layers (Phase 1 Lock)

The following layers are frozen until Phase 2+:

- Routing structure
- AppShell layout
- Auth & role gates
- Scout entry points
- Feature inventory

Changes here require explicit unfreeze.

---

## 5. Environment Rules

- `.env.example` defines required variables
- `.env.local` is dev-only
- `.env` must not be referenced by code

Environment ambiguity is a deployment bug.

---

## 6. Design Philosophy

TradeScout prioritizes:
- Predictability over novelty
- Enforcement over flexibility
- Trust over cleverness

Features are preserved.
Chaos is not.


This is now law.
