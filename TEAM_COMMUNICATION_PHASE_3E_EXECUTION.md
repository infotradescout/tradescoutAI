# COMMUNICATION: Phase 3e Execution Plan (Locked)

---

**TO:** Engineering Team (Backend, Frontend, DevOps, Data, Design, QA)  
**FROM:** Product / Execution  
**DATE:** January 1, 2026  
**SUBJECT:** Phase 3e Execution Plan — Telemetry Bake + Multi-Profile Prep (LOCKED)

---

## Message

Team —

We're entering a protected bake window for Scout Copy Assist v1.1 and running two parallel tracks. Scope, ownership, and gates are locked.

### Track A: Telemetry Validation (START NOW)

**Owner:** DevOps / Analytics  
**Goal:** Confirm production telemetry is trustworthy for Day-7 decisions.

**Deliverables by EOD Day-3:**
- ✅ Verify all 5 events fire in production
- ✅ Validate payload integrity (no nulls, correct shape)
- ✅ Finalize Day-7 SQL queries (pre-written, ready to run)
- ✅ Sign-off: "Telemetry is trustworthy"

**Docs:**
- [TELEMETRY_VALIDATION_CHECKLIST.md](../TELEMETRY_VALIDATION_CHECKLIST.md) — event firing + payload checks
- [TELEMETRY_SQL_QUERY_PACK.md](../TELEMETRY_SQL_QUERY_PACK.md) — 9 ready-to-run Day-7 queries

**Critical:** This blocks Day-7 decisions. No data = no go/no-go decision.

---

### Track B: Phase 3e-B Pre-Work (START Day-2, NO UI / NO PROD CHANGES)

**Owners:** Backend / Design / Data (parallel, independent tasks)  
**Goal:** Remove blockers so Phase 3e-B can start immediately after bake.

**Deliverables by EOD Day-8:**

| Task | Owner | Effort | Status |
|------|-------|--------|--------|
| B-1: Profile context wiring (flagged, backend only) | Backend | 6–8h | Not started |
| B-2: Migration plan + staging dry-run | Data | 6–8h | Not started |
| B-3: Switcher UX spec (Figma design only) | Design | 4–6h | Not started |
| B-4: Data audit (check for anomalies) | Data | 4–6h | Not started |

**Docs:**
- [PHASE_3E_B_PREWORK_CHECKLIST.md](../PHASE_3E_B_PREWORK_CHECKLIST.md) — detailed task breakdown + checklists

**Important:** All pre-work is staging/feature-flagged only. Zero prod changes. Zero customer impact. All work is reversible.

---

## What is Explicitly NOT Happening During Bake

❌ No UI changes visible to users  
❌ No production migrations  
❌ No SEO v1.2 planning (data-gated; post-bake only)  
✅ All work behind flags or staging only

---

## Decision Gates (Locked)

| Gate | Owner | Criterion | Action if Pass | Action if Fail |
|------|-------|-----------|----------------|----------------|
| **Day-3 EOD** | Analytics | Telemetry validates | Day-7 review proceeds on schedule | Escalate blocker, push Day-7 by 2–3 days |
| **Day-7 EOD** | Product | Copy Assist gates met (H≥35%, S≥25%, P≥60%) | Ship Phase 3e-B (Day-8 kickoff) | Stay in Phase 3e-A, iterate copy only |
| **Day-8 EOD** | Engineering | Pre-work signed off | Begin Phase 3e-B build (5 parallel workstreams) | (Only if Day-7 = GO) |
| **Day-15** | Engineering | All QA tests pass | Phase 3e-B ships (100% rollout) | Extend rollout window |

---

## How to Proceed

**If you have questions:**
1. Check the docs first (they're comprehensive)
2. Ask in Slack #engineering
3. Do not propose scope changes (lock statement applies)

**If you find a blocker:**
1. Document exactly (not "hard" but "feature X requires Y")
2. Flag to engineering lead + product
3. We'll reassess gates, not adjust scope mid-bake

**Daily rhythm:**
- Track A (telemetry): Daily brief (~5 min, end of day)
- Track B (pre-work): Updates only at task completion or blockers

---

## Why This Structure Works

**Telemetry validation** happens first because data beats opinion. We won't iterate blind.

**Pre-work happens in parallel** because it's prep-only (zero customer risk). Unblocks Phase 3e-B instantly if Day-7 passes.

**Decisions are mechanical** (gates pre-written) so there's no re-planning, re-debating, or scope creep on Day-7.

---

## The Lock

This plan is frozen. No changes to:
- Track definitions
- Ownership assignments
- Decision gates
- Bake window isolation

Scope changes require explicit product approval + will delay both tracks.

---

**Questions?** Ask in Slack. Blockers? Escalate immediately.

Let's execute by the numbers.

---

### Reference Docs (Bookmark These)

1. [TELEMETRY_REVIEW_PHASE_3E_A1.md](../TELEMETRY_REVIEW_PHASE_3E_A1.md) — Day-7 review template (fill with Track A data)
2. [TELEMETRY_VALIDATION_CHECKLIST.md](../TELEMETRY_VALIDATION_CHECKLIST.md) — Track A detailed checklist
3. [TELEMETRY_SQL_QUERY_PACK.md](../TELEMETRY_SQL_QUERY_PACK.md) — Track A SQL queries (ready to run Day-7 morning)
4. [PHASE_3E_B_PREWORK_CHECKLIST.md](../PHASE_3E_B_PREWORK_CHECKLIST.md) — Track B detailed checklist
5. [PHASE_3E_B_BUILD_KICKOFF.md](../PHASE_3E_B_BUILD_KICKOFF.md) — Phase 3e-B build plan (use if Day-7 = GO)

---

**END COMMUNICATION**
