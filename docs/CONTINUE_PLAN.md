# Continue Plan (Saved)

This file is the handoff checklist for the next session so we can keep pushing the repo toward "stable deploys + fewer problems" without breaking TradeScout platform law (Intent -> Decision Card -> Contact gating, Trust/CVS, county containers, etc.).

## Current state (as of this save point)
- Latest pushed commit: `a722b827`
- Working tree: clean
- `npm run check` and `npm run test:run` are passing at `a722b827`
- Prod health `buildId` currently reports `2c9433cf` (server build may lag behind client-only commits depending on deploy pipeline)

## Immediate next actions (safe, high-impact)
1) Verify prod is on the latest build:
   - `curl https://www.thetradescout.com/api/scout/health` and confirm the `buildId` matches the last commit.
   - If UI looks old after a deploy, use the built-in `?__reset=1` flow (or Settings → Repair & Reload if present).

2) Continue lint burn-down (prioritize low-risk rules first):
   - `client/src/scout/ScoutOS.tsx`: remaining dominant rules are `@typescript-eslint/no-explicit-any` + `no-restricted-syntax` (unused vars + non-null assertions are cleared).
   - Theme token sweep: start with `client/src/components/layout/AppShell.tsx` (address `no-restricted-syntax`).

## Lint burn-down priorities (don’t hide globally)
### Biggest remaining rules (from `artifacts/eslint-report.json`)
- `@typescript-eslint/no-explicit-any` (dominant)
- `no-restricted-syntax` (theme token enforcement)
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/no-non-null-assertion`

### Top remaining files (suggested order)
1) `client/src/scout/ScoutOS.tsx`
   - Remaining: `@typescript-eslint/no-explicit-any` + `no-restricted-syntax` (theme tokens).
2) Theme token sweep
   - Replace hardcoded tailwind colors with tokens in the worst offenders (start with `client/src/components/layout/AppShell.tsx`).

## “Manus” repo hygiene items (incremental)
- Add/confirm `.gitignore` for root clutter (already has `*.log`, `*.rar`, etc.).
- Move long-term docs into `docs/` (don’t add more root markdown).
- Convert PowerShell-only scripts that are in npm scripts to Node (`.mjs`) equivalents where feasible.
- Avoid changing CI/CD expectations without confirming Render/Windows compatibility.

## Guardrails (must preserve)
- Never bypass gating: Intent → Decision Card → Contact stays enforced.
- No admin-side intelligence computation; precompute into county containers.
- Trust/CVS governs exposure.
