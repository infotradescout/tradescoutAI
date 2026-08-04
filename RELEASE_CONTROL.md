# Release control

**Status:** `main` is the production release channel. Render auto-deploys on every push/merge to `main`.

## Control plane

| Layer | Posture |
| --- | --- |
| Render auto-deploy | **On Commit** for production web service (`tradescout-pro`) |
| Production path | Merge/push to `main` → Render builds and deploys |
| GitHub Actions | **Not used**; `.github/workflows/` is intentionally empty |
| Release evidence | Local commands against the exact commit, recorded on the pull request |

Repo file `render.yaml` sets `autoDeployTrigger: commit`. **Dashboard Auto-Deploy must stay On** (or Blueprint sync must keep commit) so merges to `main` reach production.

## Operating rule

**Push/merge to `main` deploys production via Render. GitHub Actions is not part of validation or deployment.**

## JW Stone lane isolation

JW Stone product and strategy work uses **`jw-stone/<topic>`** branches only. Do not mix JW changes into Dean recovery, non-JW remediation, or unrelated platform PRs. See `docs/jw-stone/BRANCH_LANES.md`. JW merges to `main` still deploy production and require explicit GO plus JW-scoped evidence.

## Local release verification

Run verification from a clean checkout of the exact commit under review.

1. Use the repository-supported Node version and install the lockfile exactly with `npm ci`.
2. Run the affected tests for the changed behavior.
3. Run `npm run verify:local` for the standard PR guard, build, and source/contract test lane.
4. For broad or law-sensitive changes, also run `npm run verify`.
5. For database-backed changes, set a disposable `TEST_DATABASE_URL` and run the applicable strict lane, up to `npm run verify:release`.
6. For user-interface changes, complete authenticated desktop and mobile walkthroughs.
7. Record every command and result on the pull request. Separate passed, failed, skipped, and not-run checks.

Known baseline failures do not become invisible. Record them with file/test names and prove whether the branch changed them.

## Pull request requirements

- Exact head commit SHA.
- Changed-behavior test results.
- Production build result.
- Relevant law, authority, trust, and security guard results.
- Database/browser checks when applicable.
- Explicit list of anything not run and why.
- Independent review for production-risk changes.

Repository rules must not require GitHub Actions status checks. If an old required check remains in GitHub settings, remove that requirement rather than bypassing it per pull request.

## Human checklist (Render)

1. Open production web service `tradescout-pro` (tradescoutai.onrender.com).
2. **Settings → Build & Deploy → Auto-Deploy → On** (On Commit).
3. Use Render Dashboard Manual Deploy only when a manual redeploy is needed.
4. Verify production with the live build/commit marker and the relevant production smoke path.

## Agent rules

- Treat merge to `main` as a production release.
- Do not claim production is updated from a green local command alone; confirm the live build marker.
- Do not create or require GitHub Actions workflows without explicit owner approval.
- See `AGENTS.md` release-control section.
