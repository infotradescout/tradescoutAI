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

## Final premerge evidence validator

The pull request body is the release record. Keep the machine-readable
`pr-release-evidence:v1` block from `.github/PULL_REQUEST_TEMPLATE.md` complete and current.

1. Rebase or merge current `main` into the branch, commit and push every intended change, then
   record the full 40-character PR head and current base SHAs.
2. Record explicit command outcomes for changed behavior, `npm run build`,
   `npm run verify:local`, applicable law/security guards, database proof, and browser proof. A
   `NOT-APPLICABLE` result requires a real rationale. All client paths require browser proof;
   runtime server paths conservatively require database and law/security proof; current and
   previous names of renamed files are classified.
3. Record known baseline failures, every unexecuted optional check and its reason, and a production
   plan that captures the resulting `main` SHA after merge, verifies `X-TradeScout-Build` against
   that SHA, and names the smoke paths. The tested PR head is not necessarily the deployed SHA.
4. Set the final release decision and attestations, then run
   `npm run guard:pr-release-evidence -- --pr <number> --print-digest` and record the digest. The
   digest covers the complete premerge PR body except the mutable postdeploy block.
5. Only after the premerge body and digest are final, obtain approval from a reviewer GitHub
   reports can push to the repository, on the current PR head, whose review body cites that digest.
   Any later premerge-body edit requires a new digest and approval.
6. Remove blocking labels and run `npm run guard:pr-release-evidence -- --pr <number>` from a clean
   checkout of the exact PR head. It must confirm the head contains GitHub's current `main`, the PR
   merge state is `CLEAN`, the complete current-and-previous changed-path list was classified, and
   the final evidence is digest-bound to a push-authorized current-head approval. Merge only when it
   exits zero.
7. After Render deploys, capture GitHub's resulting `main` commit SHA, update the separate
   `postdeploy-evidence:v1` block with relevant smoke results, and run
   `npm run guard:pr-release-evidence -- --pr <number> --postdeploy`. The command revalidates the
   approved premerge record and directly checks the canonical production health URL for HTTP 200,
   the exact live `X-TradeScout-Build`, healthy application status, and connected database.

The command fails closed when invoked, but it is a **manual premerge validator**, not a
GitHub-enforced required check. It does not introduce GitHub Actions. Repository settings or an
approved external required check are needed if server-side enforcement is required.

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
