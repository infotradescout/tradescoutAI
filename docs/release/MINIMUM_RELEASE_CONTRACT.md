# Minimum release contract (TradeScout)

Merge/push to `main` **is** production (Render auto-deploy). This contract is the executable pre-merge gate.

## Items

| # | Requirement | How |
| --- | --- | --- |
| 1 | Exact proposed commit | `git rev-parse HEAD` recorded in evidence |
| 2 | Clean dependency install | `npm ci` |
| 3 | Type + build | `npm run check` then `npm run build` |
| 4 | Relevant contract tests | focused vitest set inside the gate |
| 5 | Database compatibility proof | migrate + `db:verify:required` on `TEST_DATABASE_URL` |
| 6 | Browser proof | `BASE_URL` public-entry smoke **or** manual note |
| 7 | Health endpoint shape | `/api/health` returns service status, DB connectivity, `commit`, `migrations.*` (no secrets) |
| 8 | Deployment commit marker | `x-tradescout-build` + `/api/health.commit` after deploy |
| 9 | Post-deploy smoke | recorded in PR / evidence (see `RELEASE_CONTROL.md`) |
| 10 | Rollback / roll-forward | recorded boundary (see `RELEASE_CONTROL.md`) |
| 11 | Branch rule requires gate | GitHub commit status `tradescout/minimum-release-contract` (no Actions) |

## Run locally

```bash
# From a clean checkout of the exact commit under review:
export TEST_DATABASE_URL="postgres://...disposable..."
npm run gate:minimum-release -- --browser-proof=manual --browser-note="desktop+mobile / and /direct-connect OK"

# Optional: post GitHub commit status (needs gh auth or GITHUB_TOKEN):
npm run gate:minimum-release -- --attest --skip-ci --browser-proof=manual --browser-note="..."
# or:
node scripts/attest-minimum-release-contract.mjs artifacts/release-contract/<sha12>/evidence.json
```

Evidence lands in `artifacts/release-contract/<sha12>/evidence.json`.

## Status check without GitHub Actions

The gate posts (or you attest) a **commit status** with context:

`tradescout/minimum-release-contract`

A repository ruleset can require that context before merge to `main`. This does **not** need `.github/workflows/`.

## Proposed ruleset (owner GO required — do not apply blindly)

Classic branch protection on `main` currently requires **1 approving review** and has **empty** required status checks. There is **no** modern ruleset yet (`GET /repos/.../rulesets` → `[]`).

Owner-safe apply (creates a ruleset; does not delete classic protection — review overlap in the GitHub UI):

```bash
gh api --method POST repos/infotradescout/tradescoutAI/rulesets \
  --input docs/release/minimum-release-ruleset.json
```

Or interactive dry-run inspection of the JSON first:

```bash
type docs\release\minimum-release-ruleset.json   # Windows
# cat docs/release/minimum-release-ruleset.json  # Unix
```

**Do not** reintroduce `.github/workflows/` without explicit owner approval (`AGENTS.md`).

## PR #265 disposition

Do **not** merge [PR #265](https://github.com/infotradescout/tradescoutAI/pull/265) as-is (draft, CONFLICTING, behind `main`). This branch extracts the release-critical CRLF verifier fix onto current `main`. Close or refresh #265 after this gate lands.
