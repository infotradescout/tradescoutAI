# Law Exceptions Ledger

Purpose: track temporary deviations from TradeScout law with explicit ownership and removal deadlines.

## Rules

1. No temporary exception without:
   - owner
   - rationale
   - removal date
   - linked issue/pr
2. Expired exceptions block release until renewed or removed.
3. All exceptions must be reflected in `docs/audits/LAW_REALITY_MATRIX.md`.

## Current Exceptions

| Exception ID | Law ID | Current Behavior | Owner | Created | Removal Date | Issue/PR | Status |
|---|---|---|---|---|---|---|---|
| EXC-2026-04-09-001 | LAW_ID_PRECOMPUTE_ONLY | Some market signal endpoints still compute derived indices at read time. | unassigned | 2026-04-09 | 2026-06-01 | TDB | open |

