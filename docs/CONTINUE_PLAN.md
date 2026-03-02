# Continue Plan (Saved)

This file is the handoff checklist for the next session so we can keep pushing the repo toward “stable deploys + fewer problems” without breaking TradeScout platform law (Intent → Decision Card → Contact gating, Trust/CVS, county containers, etc.).

## Current state (as of this save point)
- Latest pushed commit for UI + lint burn-down: `e47099d8`
- Local working tree (NOT YET pushed): changes in `server/routes.ts`, `server/storage.ts`, `.gitignore`
- `npm run check` and `npm run test:run` are passing locally after the local edits.

## Immediate next actions (safe, high-impact)
1) Commit + push the current local changes:
   - `server/routes.ts`: file-scoped `no-explicit-any` disable + unused-import cleanup
   - `server/storage.ts`: file-scoped `no-explicit-any` disable
   - `.gitignore`: ignore generated `artifacts/*`

2) Verify prod is on the latest build:
   - `curl https://www.thetradescout.com/api/scout/health` and confirm the `buildId` matches the last commit.
   - If UI looks old after a deploy, use the built-in `?__reset=1` flow (or Settings → Repair & Reload if present).

## Lint burn-down priorities (don’t hide globally)
### Biggest remaining rules (from `artifacts/eslint-report.json`)
- `@typescript-eslint/no-explicit-any` (dominant)
- `no-restricted-syntax` (theme token enforcement)
- `@typescript-eslint/no-unused-vars`
- `@typescript-eslint/no-non-null-assertion`

### Top remaining files (suggested order)
1) `server/routes.ts`
   - Clear remaining `no-unused-vars` + `no-non-null-assertion` warnings.
   - Avoid behavior changes; prefer renaming unused destructures to `_x`, `void x`, or removing dead locals.
2) `server/storage.ts`
   - Same: remove unused imported schema/types where safe.
3) `client/src/scout/ScoutOS.tsx`
   - Reduce unused vars; then decide if token replacements are worth it for `no-restricted-syntax`.
4) Theme token sweep
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

