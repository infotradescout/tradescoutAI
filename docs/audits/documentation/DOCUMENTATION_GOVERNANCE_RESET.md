# TradeScout Documentation Governance Reset

Last updated: 2026-03-20
Status: Active plan
Purpose: Restore a trusted documentation layer before additional product work increases drift.

## Inventory Snapshot

This snapshot excludes `node_modules`, build output, generated reports, `.git`, Playwright output, and `__trash_candidate__`.

- Total Markdown docs in active repo surface: **200**
- Markdown docs at repo root: **124**
- Non-root Markdown docs: **76**
- Files with completion/ready/locked-style claim language: **23**
- Audit/report-style docs: **13**
- Reference/spec/contract/state docs: **31**
- Runbook/checklist/guide docs: **11**
- Unclassified docs: **113**

## Core Problem

The repo currently mixes too many roles in the same namespace:

- source of truth
- implementation notes
- historical status declarations
- audits and evidence
- design/specification
- rollout claims
- runbooks

This creates epistemic failure:

1. outdated docs appear current
2. multiple files claim authority over the same topic
3. root-level markdown creates false prominence
4. completion language persists after reality changes
5. audits, plans, and historical notes compete with canonical truth

## Governance Goal

TradeScout should have a small, explicit set of canonical docs and a larger, clearly-labeled set of supporting docs.

## Canonical Root Docs (Proposed)

These are the only docs allowed to define current project reality at the repo root:

1. `README.md` — top-level project overview
2. `README_START_HERE.md` — human entrypoint / orientation
3. `ARCHITECTURE_STATE.md` — current verified truth snapshot
4. `docs/TRADESCOUT_MASTER_PLAN.md` — canonical master plan
5. `PRODUCTION.md` — deployment and production operations
6. `SECURITY.md` — security posture and operational rules

Optional root docs only if they are actively needed:
- `AGENTS.md`
- `QUICK_REFERENCE.md`

All other root markdown files should be moved, merged, archived, or explicitly marked historical.

## Target Documentation Topology

```text
/
  README.md
  README_START_HERE.md
  ARCHITECTURE_STATE.md
  docs/TRADESCOUT_MASTER_PLAN.md
  PRODUCTION.md
  SECURITY.md
  AGENTS.md
  QUICK_REFERENCE.md

/docs
  /canonical
  /reference
    /scout
    /direct-connect
    /trust
    /messaging
    /county-intelligence
    /homescout
    /theme
    /user-system
  /runbooks
  /audits
  /decisions
  /history
    /2025
    /2026
    /superseded
```

## Classification Rules

Every documentation file should be assigned one primary type:

- **canonical** — authoritative current truth
- **reference** — current architecture, contracts, vocab, or specs
- **runbook** — operational procedure or checklist
- **audit** — validation, evidence, coverage, or violation report
- **decision** — ADR-style design choice or policy decision
- **history** — old status docs, phase completions, rollout claims, prior snapshots

## Mandatory Header For Important Docs

Important docs should include a machine-readable-ish header block near the top:

```md
Status: canonical | active reference | active runbook | active audit | historical | superseded
Owner: <team/person>
Last verified: YYYY-MM-DD
Source of truth: <path or none>
Supersedes: <path(s) or none>
Superseded by: <path or none>
```

## Filename Policy

Avoid using these words in filenames unless the doc is explicitly historical evidence:

- COMPLETE
- LOCKED
- READY
- FINAL
- SIGNOFF

If retained, they should usually live under `/docs/history/` or `/docs/audits/`, not the repo root.

## Initial Triage Rules

### Keep at root
- `README.md`
- `README_START_HERE.md`
- `ARCHITECTURE_STATE.md`
- `docs/TRADESCOUT_MASTER_PLAN.md`
- `PRODUCTION.md`
- `SECURITY.md`
- `AGENTS.md`
- `QUICK_REFERENCE.md` (if still useful)

### Move to `/docs/reference`
Examples:
- architecture docs
- execution contracts
- vocabularies
- charters
- specs
- system design docs

### Move to `/docs/runbooks`
Examples:
- checklists
- guides
- quick starts
- seeding/deploy/operator procedures

### Move to `/docs/audits`
Examples:
- validation reports
- violation reports
- test coverage and quality audits
- telemetry review docs

### Move to `/docs/decisions`
Examples:
- decision card policy docs
- stream decisions
- integration decision docs
- metric decision cards

### Move to `/docs/history`
Examples:
- phase completion docs
- rollout manifests
- production-ready declarations
- complete/locked/final docs
- outdated progress summaries

## Reorganization Strategy

### Phase B — Audit and Map
1. Generate inventory
2. Classify root docs
3. Identify canonical docs
4. Build move/archive map
5. Tag ambiguous docs for review

### Phase C — Reorganize
1. Create target directories
2. Move obviously historical docs first
3. Move audits/reports next
4. Move reference/spec docs by domain
5. Leave canonical docs in place
6. Add headers / status labels to survivors
7. Update cross-links and README pointers

## Immediate Priority

The root directory is the highest-value cleanup surface.
Root markdown should be reduced aggressively first.

## Success Criteria

This reset is successful when:

- current truth can be found in under 30 seconds
- no outdated status doc can be mistaken for current truth
- root markdown count is dramatically reduced
- each topic has one obvious canonical home
- historical docs remain available without competing with live docs
