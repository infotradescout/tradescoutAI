# TradeScout Markdown Audit (Master Plan Alignment)

Date: 2026-05-19  
Owner: Product/Engineering Docs Audit  
Scope: `docs/**/*.md` (full repository docs tree)

## Executive Summary

- Total markdown files audited under `docs/`: **180**
- Core authority conflict with Master Plan: **no active parallel roadmap authority found**
- Files still carrying potentially stale/ambiguous status language: **5**
- Files with formal governance header signals in first 20 lines:
  - `Status:` present: **13 / 180**
  - `Owner:` present: **13 / 180**
  - `Last verified:` present: **0 / 180**
  - `Superseded by:` present: **2 / 180**

The docs layer is no longer in a hard authority conflict after Master Plan adoption, but it still has major consistency drift and historical-status noise.

## Master Plan Authority Check

Canonical authority file:
- `docs/TRADESCOUT_MASTER_PLAN.md`

Result:
- `docs/audits/EXECUTION_ROADMAP_2026Q2.md` is marked superseded and points to Master Plan.
- `docs/plans/PROGRESSIVE_EXPOSURE_ROLLOUT_PLAN.md` is marked superseded and points to Master Plan.
- No remaining doc still claims “current execution roadmap” as `EXECUTION_ROADMAP_2026Q2.md`.

## High-Risk Documentation Findings

### 1. Ambiguous “active” status docs that can be mistaken as current authority

These files should be explicitly classified as `reference`, `historical`, or `superseded`:

1. `docs/audits/documentation/DOCUMENTATION_GOVERNANCE_RESET.md` (`Status: Active plan`)
2. `docs/CODEX_SECURITY_HARDENING_EXECUTION_CHECKLIST.md` (`Status: Approved execution guide`)
3. `docs/MODULAR_GTM_HOA_SYSTEM_BLUEPRINT.md` (`Status: Draft for execution alignment`)
4. `docs/runbooks/BOT_ARMY_QUICK_START.md` (`Status: Production Ready`, last-updated 2024)
5. `docs/design/SCOUT_OS_VISUAL_REFERENCE.md` (`Status: locked as forward visual reference`)  
: this one is likely valid as design reference, but should keep explicit “non-roadmap authority” tag.

### 2. Governance header coverage is very low

Most docs do not include normalization headers (`Status`, `Owner`, `Last verified`, `Superseded by`).
This makes stale docs hard to distinguish from active docs.

### 3. Root docs are still mixed-purpose

There are many top-level docs under `/docs` that read like execution declarations, reports, or old plans without explicit classification.

## Distribution Snapshot

Top-heavy directories by markdown volume:

- `docs/reference`: 54
- `docs/history`: 26
- `docs/audits`: 25
- `docs/runbooks`: 9
- `docs/decisions`: 5
- `docs/canonical`: 3
- `docs/plans`: 2

This distribution is healthy for retention/history, but only if status headers are normalized.

## Conflict Matrix

### Authority conflicts with Master Plan

- **Critical conflicts:** none found
- **Soft conflicts:** language overlap where “source of truth” is used for local subsystem docs (acceptable if scoped)

Scoped “source of truth” language is acceptable when it refers to a local subsystem (e.g., CSS variables, schema, navigation config) and not platform roadmap authority.

## Required Remediation Plan

### Phase A: Authority hardening (immediate)

1. Keep `docs/TRADESCOUT_MASTER_PLAN.md` as sole roadmap authority.
2. Ensure every roadmap/plan doc has one of:
   - `Status: superseded`
   - `Status: historical`
   - `Roadmap authority: docs/TRADESCOUT_MASTER_PLAN.md`

### Phase B: Header normalization (high priority)

Add headers to all non-history docs:

- `Status: ...`
- `Owner: ...`
- `Last verified: YYYY-MM-DD`
- `Superseded by: ...` (when applicable)

### Phase C: Historical quarantine (medium priority)

For old “complete/ready/locked” reports, enforce:

- move/retain under `docs/history/**` or `docs/audits/**`
- clear “historical evidence only” annotation at top

## Immediate File Action Queue

1. `docs/audits/documentation/DOCUMENTATION_GOVERNANCE_RESET.md`  
: set to `Status: reference` or `Status: superseded` and add last-verified.
2. `docs/runbooks/BOT_ARMY_QUICK_START.md`  
: update status and last-verified, or mark historical.
3. `docs/CODEX_SECURITY_HARDENING_EXECUTION_CHECKLIST.md`  
: classify as active runbook vs historical checklist.
4. `docs/MODULAR_GTM_HOA_SYSTEM_BLUEPRINT.md`  
: classify as draft reference or superseded.
5. Batch-add header normalization to all docs in:
   - `docs/reference/**`
   - `docs/runbooks/**`
   - top-level `docs/*.md`

## Audit Conclusion

Master Plan authority replacement is working.

The remaining problem is not major authority conflict; it is **status clarity drift at scale** across 180 docs.  
Next step is a structured header-normalization sweep and historical labeling pass.
