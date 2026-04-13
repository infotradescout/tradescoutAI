# Law Rewrite Proposal (Post-Reality Audit)

Date: 2026-04-09  
Goal: Rewrite law files so they match enforceable current truth, then re-harden gaps.

## Rewrite Principles

1. Keep non-negotiable product ethics.
2. Remove absolute statements not true in runtime.
3. Label policy vs enforced contract explicitly.
4. Add "exceptions ledger" for temporary deviations.

## Proposed Edits

## 1) Replace absolute Scout bridge claim

- Current statement:
  - "Scout is the only bridge from discovery to action."
- Proposed:
  - "Scout is the primary guided bridge from discovery to action. Direct action routes must still pass Intent/Authority/Trust gates and must not bypass platform law."
- Why:
  - Runtime contains non-Scout action routes (`/api/decision-cards`, marketplace request flows).

## 2) Split "Admin/UI never computes intelligence" into target vs current

- Current statement:
  - "Admin/UI never computes intelligence; jobs precompute and store snapshots."
- Proposed:
  - "Target contract: intelligence should be precomputed and snapshot-backed. Current transitional paths that derive read-time indices are allowed only with explicit deprecation owner/date."
- Why:
  - Market-signal endpoints compute indices at read time.

## 3) Clarify Trust/CVS strictness and fallback behavior

- Current statement:
  - "Trust/CVS governs exposure."
- Proposed:
  - "Trust/CVS governs exposure. Any fallback score, bypass mode, or manual override must be explicit, auditable, and environment-scoped."
- Why:
  - Current trust defaulting and environment bypasses are real behavior.

## 4) Add TradeScout-only scope enforcement language

- Current statement:
  - "Never import MealScout/Trader's Corner assets, copy, or concepts."
- Proposed addition:
  - "No cross-product brand mentions in production user-facing copy unless explicitly approved in a documented exception."
- Why:
  - MealScout appears in active UI copy.

## 5) Add runtime-contract section to law files

- Add a section with:
  - "Enforced By Code" (routes/services/tests)
  - "Policy Intent (not yet fully enforced)"
  - "Known Exceptions"
- Why:
  - Prevents law docs from silently drifting into aspirational-only text.

## Recommended File Updates

Update these files in one lockstep PR:

- `AGENTS.md`
- `docs/TRADESCOUT_PRODUCT_AND_COPY_LAW.md`
- `docs/reference/DOCTRINE.md`
- `docs/ARCHITECTURE.md` (cross-reference alignment)
- `docs/SCOUT_CONTRACT.md` (consistency wording)

## Proposed Canonical Wording Block

Use this block consistently in all law docs:

> Platform law is authoritative only when tied to enforceable contracts.  
> Every law line must be marked as one of: `enforced`, `policy_target`, or `temporary_exception`.  
> Temporary exceptions require owner, rationale, and removal date.

## Immediate Fixes Before Rewrite Merge

1. Add CI brand-scope guard to prevent future cross-product copy drift.
2. Add explicit "transitional compute path" annotation to market-signal endpoints.
3. Add bypass mode visibility to admin dashboards by default (already partly present via authority config routes).

## Acceptance Criteria for Law Rewrite

- No contradiction between law docs and runtime behavior in top-level claims.
- Each law has at least one implementation anchor or an exception note.
- CI includes at least one non-skipped gating contract suite in protected branches.
