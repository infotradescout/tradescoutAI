# Minimum release contract (TradeScout)

Merging to `main` **is** production (Render auto-deploy). This contract is the executable pre-merge gate.

## Items

| # | Requirement | How |
| --- | --- | --- |
| 1 | Exact proposed commit | `git rev-parse HEAD` recorded in evidence |
| 2 | Clean dependency install | `npm ci` |
| 3 | Type + build | `npm run check` then `npm run build` |
| 4 | Relevant contract tests | focused Vitest set plus discovery-performance Node contract tests inside the gate |
| 5 | Database compatibility proof | migrate + `db:verify:required` on `TEST_DATABASE_URL` |
| 6 | Browser proof | `BASE_URL` public-entry smoke **or** manual note |
| 7 | Health endpoint shape | `/api/health` returns service status, DB connectivity, `commit`, `migrations.*` (no secrets) |
| 8 | Deployment commit marker | `x-tradescout-build` + `/api/health.commit` after deploy |
| 9 | Post-deploy smoke | recorded in PR / evidence (see `RELEASE_CONTROL.md`) |
| 10 | Rollback / roll-forward | recorded boundary (see `RELEASE_CONTROL.md`) |
| 11 | Solo-dev branch rule | Pull request, zero approvals, resolved review conversations; no required status checks |

## Run locally

```bash
# From a clean checkout of the exact commit under review:
export TEST_DATABASE_URL="postgres://...disposable..."
npm run gate:minimum-release -- --browser-proof=manual --browser-note="desktop+mobile / and /direct-connect OK"

# Optional: post an informational GitHub commit status (never a required merge check):
npm run gate:minimum-release -- --attest --skip-ci --browser-proof=manual --browser-note="..."
# or:
node scripts/attest-minimum-release-contract.mjs artifacts/release-contract/<sha12>/evidence.json
```

Evidence lands in `artifacts/release-contract/<sha12>/evidence.json`.

## Optional status evidence

The gate can post an informational **commit status** with context:

`tradescout/minimum-release-contract`

Do **not** require that context in a branch rule. This repository has no always-on status provider, so making it required can deadlock every pull request. The local evidence and pull-request record remain the release proof.

## Canonical solo-developer ruleset

The importable policy is [`minimum-release-ruleset.json`](minimum-release-ruleset.json). It is intentionally small:

- every change reaches `main` through a pull request;
- zero approving reviews are required;
- review conversations must be resolved;
- force pushes and branch deletion are blocked;
- no status checks, deployments, workflows, merge queue, code-owner review, or last-push approval are required.

This preserves a searchable release trail and prevents destructive branch operations without pretending a second developer or permanent CI runner exists.

To activate it in GitHub, open **Settings → Rules → Rulesets → New ruleset → Import a ruleset**, select the JSON file, review the summary, and create it as Active. Remove or relax any overlapping classic branch-protection rule that adds approvals or required checks; overlapping rules are cumulative.

If a review thread identifies a real problem, fix it and resolve the thread. If a comment is obsolete or incorrect, document why and resolve it. No outside approval is needed in either case.

**Do not** reintroduce `.github/workflows/` without explicit owner approval (`AGENTS.md`).
