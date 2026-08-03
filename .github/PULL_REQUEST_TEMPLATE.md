# Release posture

This pull request starts on **HOLD**. Merging to `main` deploys production through Render.
The premerge command is a manual local validator; GitHub does not enforce that it ran.

Complete all premerge evidence against the exact pushed head and current `main`. Then use
`npm run guard:pr-release-evidence -- --pr <number> --print-digest`, place that value in
`Evidence-Digest`, and obtain an approval from a reviewer GitHub reports can push to the
repository, on the current head, whose review body cites the digest. Change
`Release-Decision` to `GO` only after those steps. The digest covers the full premerge PR body,
excluding only the mutable postdeploy block. Any later premerge-body edit requires a new digest
and a new digest-bound approval.

<!-- pr-release-evidence:v1 -->
Release-Decision: HOLD
Release-Head-SHA: REPLACE_WITH_FULL_40_CHARACTER_PR_HEAD_SHA
Release-Base-SHA: REPLACE_WITH_CURRENT_FULL_40_CHARACTER_MAIN_SHA
Changed-Behavior-Tests: NOT-RUN
Changed-Behavior-Evidence: REPLACE_WITH_COMMANDS_AND_EXPLICIT_RESULT
Production-Build: NOT-RUN
Production-Build-Evidence: REPLACE_WITH_NPM_RUN_BUILD_AND_EXPLICIT_RESULT
Standard-Local-Verification: NOT-RUN
Standard-Local-Verification-Evidence: REPLACE_WITH_NPM_RUN_VERIFY_LOCAL_AND_EXPLICIT_RESULT
Law-Authority-Trust-Security: NOT-RUN
Law-Authority-Trust-Security-Evidence: REPLACE_WITH_RESULT_OR_NOT_APPLICABLE_RATIONALE
Database-Proof: NOT-RUN
Database-Proof-Evidence: REPLACE_WITH_RESULT_OR_NOT_APPLICABLE_RATIONALE
Browser-Proof: NOT-RUN
Browser-Proof-Evidence: REPLACE_WITH_RESULT_OR_NOT_APPLICABLE_RATIONALE
Production-Proof: POST-MERGE-REQUIRED
Production-Proof-Evidence: REPLACE_WITH_PLAN_TO_CAPTURE_RESULTING_MAIN_SHA_VERIFY_X_TRADESCOUT_BUILD_AND_RUN_SMOKE_PATHS
Known-Baseline-Failures: REPLACE_OR_NONE
Not-Run-And-Why: REPLACE_OR_NONE
Exact-Commit-Attestation: UNCHECKED
Merge-Deploys-Production-Attestation: UNCHECKED
Evidence-Digest: REPLACE_WITH_SHA256_FROM_PRINT_DIGEST_COMMAND
<!-- /pr-release-evidence -->

## Changed behavior

Describe the customer-visible or operational change.

## Commands and results

List every command and its result. Use an explicit outcome such as `=> PASS` or `result: PASS`.
Separate passed, failed, skipped, and not-run checks. A field marked `PASS` must not contain a
failed, errored, blocked, pending, skipped, cancelled, timed-out, not-run, or nonzero exit/return
outcome.

## Known failures and baselines

Name each failure and show whether this branch changed it. Write `NONE` only when there are none.

## Not run and why

Record each unexecuted check and the reason. Write `NONE` only when all relevant checks ran.

## Production verification plan

The PR head is the tested source SHA, but merge, squash, or rebase can create a different deployed
SHA. Plan to capture the resulting `main` SHA after merge, verify `X-TradeScout-Build` equals that
SHA, and run each relevant live smoke path.

After Render deploys, update the block below and run
`npm run guard:pr-release-evidence -- --pr <number> --postdeploy`. That command revalidates the
digest-bound premerge record, then directly requests
`https://www.thetradescout.com/api/health` without redirects. It requires HTTP 200, the live
`X-TradeScout-Build` value to equal the resulting main SHA, `status: healthy`, and
`database: connected`, in addition to the recorded changed-route smoke evidence.

<!-- postdeploy-evidence:v1 -->
Production-Status: PENDING
Production-Deployed-SHA: PENDING
Production-Build-Marker: PENDING
Production-Smoke-Evidence: PENDING
<!-- /postdeploy-evidence -->
