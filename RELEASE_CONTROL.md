# Release control

**Status:** `main` is the production release channel. Render auto-deploys every merge to `main`.

## Control plane

| Layer | Posture |
| --- | --- |
| Render auto-deploy | **On Commit** for production web service (`tradescoutAI`) |
| Production path | Merge a pull request to `main` → Render builds and deploys |
| GitHub Actions | **Not used**; `.github/workflows/` is intentionally empty |
| Release evidence | Local commands against the exact commit, recorded on the pull request |
| Minimum gate | `npm run gate:minimum-release` → evidence under `artifacts/release-contract/` |
| `main` protection | Pull request required; zero approvals; resolve review conversations; no required checks |

Repo file `render.yaml` sets `autoDeployTrigger: commit`. **Dashboard Auto-Deploy must stay On** (or Blueprint sync must keep commit) so merges to `main` reach production.

## Operating rule

**Merge a pull request to `main` to deploy production via Render. GitHub Actions is not part of validation or deployment.**

## JW Stone lane isolation

JW Stone product and strategy work uses **`jw-stone/<topic>`** branches only. Do not mix JW changes into Dean recovery, non-JW remediation, or unrelated platform PRs. See `docs/jw-stone/BRANCH_LANES.md`. JW merges to `main` still deploy production and require explicit GO plus JW-scoped evidence.

## Minimum release contract (required before merge)

Canonical details: [`docs/release/MINIMUM_RELEASE_CONTRACT.md`](docs/release/MINIMUM_RELEASE_CONTRACT.md).

From a clean checkout of the **exact** commit under review:

```bash
export TEST_DATABASE_URL="postgres://...disposable..."
npm run gate:minimum-release -- --browser-proof=manual --browser-note="desktop+mobile paths reviewed"
# Optional GitHub status (no Actions):
npm run gate:minimum-release -- --attest --skip-ci --browser-proof=manual --browser-note="..."
```

Gate covers: exact commit, `npm ci`, typecheck, build, focused contract tests, disposable DB migrate+verify, browser proof attestation. Public health shape (`/api/health` with `commit` + `migrations`) is asserted by contract tests.

Optional informational status context: `tradescout/minimum-release-contract`. It is evidence only and must not be required by branch protection.

## Local release verification

Run verification from a clean checkout of the exact commit under review.

1. Use the repository-supported Node version and install the lockfile exactly with `npm ci`.
2. Run the affected tests for the changed behavior.
3. Run `npm run gate:minimum-release` (minimum contract) or `npm run verify:local` for the broader PR lane.
4. For broad or law-sensitive changes, also run `npm run verify`.
5. For database-backed changes, set a disposable `TEST_DATABASE_URL` and run the applicable strict lane, up to `npm run verify:release`.
6. For user-interface changes, complete authenticated desktop and mobile walkthroughs.
7. Record every command and result on the pull request. Separate passed, failed, skipped, and not-run checks.

Known baseline failures do not become invisible. Record them with file/test names and prove whether the branch changed them.

## Pull request requirements

- Exact head commit SHA.
- Minimum-release evidence path (or equivalent command results).
- Changed-behavior test results.
- Production build result.
- Relevant law, authority, trust, and security guard results.
- Database/browser checks when applicable.
- Explicit list of anything not run and why.
- Deliberate self-review or automated review for production-risk changes; outside review is optional when available and never a merge prerequisite.

Repository rules must not require GitHub Actions, local-attestation, deployment, merge-queue, code-owner, last-pusher, or approval checks. There is one developer and no always-on check provider. Use the importable policy in `docs/release/minimum-release-ruleset.json`: require a pull request with zero approvals, require review-conversation resolution, and block force pushes and deletion.

## Solo-maintainer merge flow

1. Create a short-lived branch and pull request, even for urgent fixes.
2. Run risk-appropriate local checks and record passed, failed, skipped, and not-run proof on the pull request.
3. Address and resolve every review conversation. No approving review is required.
4. Merge when the diff and evidence are acceptable. The merge triggers the existing Render production service automatically.
5. Verify the live build marker, health endpoint, and changed user path. If production fails, use a focused follow-up pull request or rollback; do not create a second service or ad-hoc deployment path.

## Post-deploy smoke (item 9) — record format

After Render finishes deploying the merged SHA, record on the PR (or in `artifacts/release-contract/<sha12>/postdeploy.md`):

```text
<!-- postdeploy-evidence:v1 -->
Production-Status: pass|fail
Production-Deployed-SHA: <full sha>
Production-Build-Marker: x-tradescout-build=<sha> ; /api/health.commit=<sha>
Production-Health: status=<healthy|degraded|unhealthy> database=<connected|disconnected> migrations.compatibility=<...>
Production-Smoke-Evidence: <commands + results, e.g. curl /api/health ; public entry paths>
<!-- /postdeploy-evidence -->
```

Minimum live checks:

1. `GET https://www.thetradescout.com/api/health` → JSON includes `commit`, `database`, `migrations`; header `x-tradescout-build` matches merged SHA.
2. One changed user path smoke (desktop/mobile as applicable).

## Rollback / roll-forward boundary (item 10) — record format

Before merge, name the boundary on the PR:

```text
<!-- release-boundary:v1 -->
Rollback-SHA: <last known good main SHA>
Roll-Forward-Plan: <re-deploy same SHA after fix | merge follow-up commit | disable feature flag ...>
DB-Compat-Decision: compatible|migrate-first|blocked
DB-Compat-Evidence: <ledger note / gate step 5 / prod health migrations field>
Boundary-Owner: <name>
<!-- /release-boundary -->
```

If production `migrations.compatibility` is not `compatible`, **do not** treat the release as green — choose migrate-first (owner GO) or rollback to `Rollback-SHA`.

## Human checklist (Render)

1. Open production web service `tradescoutAI` (tradescoutai.onrender.com).
2. **Settings → Build & Deploy → Auto-Deploy → On** (On Commit).
3. Confirm platform health-check path is set to `/api/health` when changing Render settings (Docker `HEALTHCHECK` alone is not the Render probe).
4. Keep Runtime=`Docker` and Pre-Deploy=`npm run db:migrate && npm run db:verify:required`. The production image must retain `scripts/`, `drizzle.config.ts`, `shared/`, `migrations/`, and production `drizzle-kit`; see `docs/DEPLOYMENT_TARGET.md`.
5. Confirm the live service executes that pre-deploy command on the next deploy (deploy logs must show migrate + verify before instance start). CRLF verifier fix must be on the deployed commit **before** enabling predeploy with the old verifier.
6. Use Render Dashboard Manual Deploy only when a manual redeploy is needed.
7. Verify production with the live build/commit marker and the post-deploy smoke block above.

## Migration recovery (not routine predeploy)

- Default forward migrate: `npm run db:migrate` then `npm run db:verify:required`.
- If a later journal tag is already in `drizzle.__drizzle_migrations` while earlier tags are missing (**watermark trap**), normal migrate skips the gaps. Recovery: `npm run db:migrate:fill-gaps` (see `docs/runbooks/DB_MIGRATE_FILL_GAPS.md`), then verify. Optional ledger cleanup: `npm run db:ledger:prune-orphans`.

## Agent rules

- Treat merge to `main` as a production release.
- Do not claim production is updated from a green local command alone; confirm the live build marker.
- Do not create or require GitHub Actions workflows without explicit owner approval.
- See `AGENTS.md` release-control section.
- See `docs/release/MINIMUM_RELEASE_CONTRACT.md` for ruleset JSON and attestation.
