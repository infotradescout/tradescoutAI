# Scout execution checkpoint — PR #668

## Objective
Prove and repair Scout's existing approval, cancellation, failure and completion paths together. Do not restart the capability audit or broaden into unrelated product lanes.

## Base branch/commit
`main` at `bda589173ec470e5c13044492caa4b13a6b3490d`. The original client checkpoint is retained in Git history at `f8e11d3c00eb5a4a4642024c61ff647f760c406a`; the server continuation checkpoint is `e42de7827a1860766be71aad624d134cbb82fb42`.

## Current branch/commit
`codex/scout-action-execution-hardening-20260915`.
Latest implementation/test parent: `bb40462c12597d7c9e49c07c4c629b6616eb2469`.
This checkpoint is documentation-only. Resolve the branch head for the exact final candidate. Subsequent Render run results belong in the PR as exact-head evidence; a live report host is not release approval.

## Verified completed work
Previous client/server repairs are preserved: authentication and approval before profile-save requests; supported action checks; surfaced adapter failures; bounded guarded follow-ups; payment-start actions remain navigation-only; one server executor attempt without fake recovery success or generic retry; safe unconfirmed outcomes after errors.

Full application inspection found an additional integration bug: ScoutOS unconditionally appended "Saved" after the execution promise resolved, while cancellation and sign-in navigation resolved without saving. The router now throws a typed interruption for cancellation/auth handoffs. The existing UI error path displays exact safe outcome copy, and never reaches its Saved acknowledgement for those outcomes.

SAVE_PROFILE now requires the real endpoint's boolean `executed: true`, not just authorization/success. A model-generated payment word in the save label cannot turn the typed save into a navigation-only handoff. The production error formatter admits only anchored, application-owned cancellation/uncertainty messages rather than replacing them with generic failure or admitting arbitrary diagnostics.

`ScoutActionCompletion.integration.test.ts` extracts and compiles the actual ScoutOS callback, executes it with the real router and production error formatter, and controls only component surroundings/HTTP. It covers cancellation, guest auth, actual execution acknowledgement, malformed receipts, delayed responses, HTTP failures, post-write acknowledgement loss, payment-label ambiguity, cancelled follow-ups, and error-copy redaction. This is stronger than a duplicated caller model but is not a rendered browser/native database test.

The production sitemap generator also refreshed unchanged index timestamps on each new build date, dirtying a strict release checkout. The bounded generator repair preserves existing dates, analogous to existing URL sitemap behavior. Canonical routes, priorities and frequencies are preserved. Its new reproducibility suite tests actual generated files in private temporary directories.

## Tests/evidence already run
### Full checkout at `e42de7827a1860766be71aad624d134cbb82fb42`
- Configured router Vitest: passed.
- Client 47-case and server 49-case behavioral suites: passed in the same full checkout.
- Full `npm run check`: passed.
- `npm run build`: passed with normal production settings. An earlier harness run accidentally set NODE_ENV=test and failed a bundle budget; this was corrected without weakening the budget.

### Full checkout at `7857efcda3c8d481b216a2f0efd092fe02ceea16`
Render deploy `dep-dakudmf40ujc738teku0`:
- 36 configured application tests across 5 files: all passed, no skips.
- 47 client behavioral cases: all passed, no skips.
- 49 server behavioral cases: all passed, no skips.
- Full project typecheck: passed.
- Production build: passed.
- Chromium installation: passed.

Render deploy `dep-dakufhad0e5s73ftkl70`:
- Production-built server booted unmodified with healthy exact-commit response.
- Fresh native PostgreSQL 18.4, loopback-only, TLS verification enabled.
- All 142 production-mode migrations applied; independent required schema passed.
- Synthetic account seed passed.
- Browser journey stopped at CORS origin denial before any action was submitted. This is recorded as a failed journey, not end-to-end success. The test-only server environment now explicitly allows its single loopback origin through the existing CORS configuration.
- That older-source run restored only a proven date-only generated sitemap change in its private clone; built output was unchanged. It is not strict release attestation. The generator source fix removes this normalization requirement from later candidates.

Commands:
```sh
node node_modules/vitest/vitest.mjs run client/src/lib/userFacingError.test.ts client/src/scout/ScoutActionCompletion.integration.test.ts client/src/scout/ScoutActionRouter.test.ts server/tests/scout-action-truthfulness.contract.test.ts server/tests/scout-profile-update-assistant.test.ts --maxWorkers=2
node --test scripts/tests/scout-action-execution-check.cjs
node --test scripts/tests/scout-server-execution-check.cjs
node --test scripts/tests/sitemap-build-reproducibility.test.mjs
npm run check
NODE_ENV=production npm run build
node node_modules/playwright/cli.js install chromium
node scripts/verify-scout-execution-flow.mjs
```

## Changed but unverified work
At this checkpoint, the newest sitemap/CORS-test-environment edits and full browser journeys are being checked by deploy `dep-dakuj5740ujc738tvrd0`, pinned to `bb40462c12597d7c9e49c07c4c629b6616eb2469`. Read its terminal results before claiming success. The strict minimum-release gate and production deployment have not been completed.

## Files changed
Relative to base: ScoutActionRouter.ts; its original Vitest suite; userFacingError.ts; ScoutActionCompletion.integration.test.ts; scoutActionGuard.ts; both standalone execution suites; verify-scout-execution-flow.mjs; generate-sitemap-core.mjs; sitemap-build-reproducibility.test.mjs; this checkpoint. ScoutOS and the actual server route were inspected and executed by tests but are not modified.

## Working verification environment
GitHub reads/writes and Render isolated builds work. There is no user action required to restore access.
- Workspace: `tea-d191jph5pdvs73drglkg`.
- Dedicated free verification service: `srv-daku6be7bikc73dmpkvg`, `tradescout-scout-execution-668-proof`.
- Auto-deploy is off. Updating its environment triggers a build automatically; do not trigger another duplicate deploy.
- Its build makes a private exact-SHA clone, checks that no provider/database credentials were inherited, installs locked dependencies, and executes `SCOUT_EXECUTION_STEP`. `SCOUT_EXECUTION_EXPECTED_SHA` must equal the build commit.
- Runtime serves inert explanatory text only. The actual TradeScout server and fresh database run on loopback during verification and are removed afterward.
- Do not repeat remote-device/DNS probes or create another worker. Builder has no GitHub push credential; use GitHub connector writes, never search for credentials.

## Tests/evidence invalidated by later changes
New product or shared contract changes require affected tests and candidate validation. Prior mocked HTTP tests do not establish native/browser behavior. Final strict release proof must name the exact clean candidate, with no generated-file restoration inside the gate.

## Known risks and remaining work
- One executor attempt is not durable idempotency or cross-request duplicate prevention.
- Lost acknowledgement may mean the write already committed; check persisted status before retrying.
- ScoutOS still wraps handleSend in a void-returning askScout callback; the router's generic await does not yet prove full UI follow-up continuity.
- Assistant-message watchdog telemetry is not yet an execution receipt. Do not claim all completion metrics are repaired.
- Generic CALL_TOOL still supports ads.feedback only; dedicated actions/workspaces provide other abilities. This slice does not complete all advertised functions.
- Follow-up auth/role/guard and cancellation are covered by real-router/callback tests; don't call them native multi-step proof without that journey.

## External side effects and retry safety
Only PR-branch code/tests/checkpoint and the isolated verification service were changed. No production deploy, main merge, real account mutation, message, broadcast, purchase or payment occurred. Native users, writes and injected failures exist only in disposable local PostgreSQL. Browser external hosts are denied. No automatic write retry was introduced.

## Next exact action
Read the running worker's final SCOUT_FLOW_SUMMARY. Fix only the failing dependency. Once all desktop/mobile approve/cancel/failure/lost-acknowledgement/authorization-only journeys pass, run the unchanged strict minimum-release contract on the exact final integration candidate with a fresh disposable TEST_DATABASE_URL and an accurate browser-evidence note. Fetch canonical main ancestry for its readiness guard. Record result, attestable flag and candidate SHA in PR #668. Merge only after that proof and current-base compatibility; then verify the actual deployment commit and read-only health/smoke.

## Actions that must NOT be repeated
Do not restart the abilities audit, rerun isolated suites as a substitute for browser proof, label missing personal-terminal access a project blocker, overwrite other branches, add GitHub Actions/approval gates, weaken release checks, send real customer actions, or claim deployed functionality from a passing test worker.

## Law classification
Approval before execution, no false completion after errors, and payment navigation-only: enforced in changed owners and tests with stated scope. Contact/county/Trust authorities: existing owners preserved. All-capability completion, durable duplicate protection and production release: policy targets, not established by this checkpoint.
