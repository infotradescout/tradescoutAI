# Scout execution receipts — resume checkpoint

## Objective
Continue from released Scout execution repair #668 with durable duplicate-request protection for prepared SAVE_PROFILE operations. Do not restart the abilities audit. PR #672 owns this bounded slice.

## Base branch/commit
Created from main `b64251d5fba399013a0cd71f5ff3c8d101a57163` (merged #668). When #672 was created, GitHub reported its current base as `e6d3c9e43b68ff150152ae9836890508e7faac2c`. Reconcile the actual current main at integration time; do not overwrite concurrent lanes or assume this branch is already integrated.

## Current branch/commit
Branch: `codex/scout-execution-receipts-20260916`.
Exact tested product head: `f5182671b61bd4c30465dfc154a02fa96cd6f04a`.
This checkpoint adds documentation only. Resolve the branch ref to obtain its documentation head. PR #672 remains draft and unmerged.

## Verified completed work
- The v1 result contract issues a fresh opaque execution identity for each prepared SAVE_PROFILE operation. Unit tests cover JSON persistence and real client action conversion; this is not yet a full saved-conversation browser proof.
- The existing guard dispatches keyed profile actions through an authenticated-owner-scoped durable receipt. Invalid supplied keys fail rather than falling back to unkeyed execution.
- A database primary key and INSERT ON CONFLICT prevent more than one invocation of the same owner/operation while pending. Twenty concurrent duplicate requests were rejected while the original was held; after completion, twenty replays returned the prior receipt without new writes.
- Replays work from a separate Node process, not only from in-memory state.
- Reusing a key with different submitted data fails. Keys are isolated between authenticated owners; guests cannot claim or replay another owner's work.
- Pending/unconfirmed receipts are never automatically reclaimed. Lost claim, write, or receipt acknowledgements do not trigger a repeat execution. This trades automatic recovery for at-most-once dispatch; it is not an exactly-once completion promise.
- Only positively acknowledged completion metadata is persisted. Submitted profile values, extra executor data, and raw exceptions are not stored in the receipt result.
- Contradictory `success: false` or `ok: false` takes precedence over `executed: true` before receipt projection. This repaired the two failures found in the first native run.
- Existing unkeyed actions retain their previous one-attempt behavior. This slice does not claim duplicate protection for all old actions or other action types.

## Changed but unverified work
The SQL file and guard/result-contract wiring exist, but the new table is NOT yet registered in `migrations/meta/_journal.json` or the independent required-production-schema verifier. Do not deploy this branch as-is. The native test applies this one migration to a disposable minimal fixture, not through the complete production migration chain.

The existing execute-action endpoint still records `scout_outcome_action_submitted` on successful replays. Completed receipt-row counts are not inflated by replay, but the existing funnel is not fixed. ScoutOS watchdog input still maps assistant messages to `action_executed`; that source remains unchanged.

Full production build, all-migrations proof, real Express/session/profile-write integration, browser repeated-click/reload paths, strict minimum-release gate and production deployment have NOT run for this receipt slice. Prior #668 evidence must not be represented as proof of these new changes.

## Files changed
- `migrations/0139_scout_execution_receipts.sql`
- `server/utils/scoutExecutionReceipts.ts`
- `server/utils/scoutActionGuard.ts`
- `server/scout/scoutResultContractV1.ts`
- `server/tests/scout-execution-identity.test.ts`
- `scripts/verify-scout-execution-receipts.mjs`
- This checkpoint.

## Tests/evidence already run
Working execution path: existing isolated Render verification service `srv-daku6be7bikc73dmpkvg` in the previously used workspace `tea-d191jph5pdvs73drglkg`. No user access repair is required. Its public runtime serves inert text, not the application or test data. Auto-deploy remains off.

The worker first verifies its own bootstrap commit, then fetches and checks out the exact candidate. For this run, the actual tested source is **f5182671b61bd4c30465dfc154a02fa96cd6f04a**, not the bootstrap commit 7306111c shown in the Render deploy metadata or SCOUT_STEP_FINISHED line.

Corrected run: `dep-dal9c4m7bikc73eqr2eg`.
Evidence completed 2026-09-16T13:15:56.534928540Z.

| Check | Result |
| --- | --- |
| `npm run check` | Passed, full-project typecheck |
| Configured affected Vitest suites | 48/48 tests, 6/6 files passed |
| `node --test scripts/tests/scout-server-execution-check.cjs` | 49/49 passed |
| `node --test scripts/tests/scout-action-execution-check.cjs` | 47/47 passed |
| `node scripts/verify-scout-execution-receipts.mjs` | 29/29 native receipt cases passed |
| Final `git status --porcelain` | Empty |

The configured suite selector passed `client/src/scout/actionValidation.test.ts`, `client/src/scout/ScoutActionRouter.test.ts`, and server/tests filenames matching `/^scout.*(?:result-contract|response-contract|primary-action|execution-identity).*\.test\.ts$/` to `npm run test:run --`.

Total: 173 passing checks/cases across the four test groups, plus full-project typecheck. These are mixed unit, isolated execution, and native database tests, not 173 end-to-end user journeys. No production customer data, accounts, provider credentials, payments or contact actions were used. The native proof executes actual production guard/receipt modules and real PostgreSQL SQL; profile executors and deliberate fault adapters are synthetic.

Native tooling reported PostgreSQL 18.4, loopback only, `embedded-postgres@18.4.0-beta.17`; the disposable tooling lock hash for this run was `316abcd3e25f228ba93309334b89b67992184bd6d975ffc253370205f1e4616d`. Production package files were not changed.

Historical first run: `dep-dal3h2uk1f9s73diqd5g`, source `ce94c5e4e7426943652d481e42dbfc545ec3c4ea`, completed 2026-09-16T06:36:47.550Z. Native receipt cases: 27 passed, 2 failed. Both failures were negative acknowledgement cases fixed by f518267; do not describe them as two distinct bugs or claim the first run passed.

## Tests/evidence invalidated by later changes
None after the exact tested product commit; this checkpoint changes documentation only. Integrating current main, modifying schema installation, action identity, receipt code or telemetry requires relevant new validation. Do not reuse these results as a complete release gate.

## Known risks / integration work
1. Register migration 0139 with a unique next index and monotonic timestamp, preserving all previous journal entries. Extend independent schema checks for the receipt table, ownership foreign key, compound key and status/result invariants. Verify fresh install and compatibility before release.
2. Make endpoint submission telemetry replay-aware and replace fabricated watchdog completion input with actual outcomes. Do not count an assistant response, authorization or replay as a new completed task.
3. Verify actual authenticated browser save/cancel, duplicate clicks, persisted conversation reload, lost acknowledgement, invalid key and changed payload. Assert real profile values and independent write counts.
4. Integrate current main without changing other lanes, then run the strict minimum-release contract on that clean exact candidate before merge. No second-person approval or new CI requirement is being introduced.
5. The claim and profile write are separate transactions by design. A crash can leave an unconfirmed operation that did not write; automatic replay is deliberately disallowed until an explicit reconciliation owner exists.
6. The old unkeyed-client compatibility path remains outside durable protection. A new generated operation intentionally gets a different identity; at-most-once is scoped to an owner and prepared operation, not arbitrary repeated user intent.

## External side effects and retry safety
Only commits to the isolated branch, draft PR #672, and one verification-worker environment/deploy update were performed in this continuation. No main merge, production migration, customer profile update, message, broadcast, purchase or payment occurred. The Render environment update itself triggered the test deploy; do not trigger a duplicate deploy. No automated mutation retry was added.

## Next exact action
Resume #672 at the tested head/checkpoint. Register and independently verify the additive receipt migration, then make the execute-action success telemetry aware of `result.data.replayed`. Inspect only those owners and their targeted tests. Add actual browser duplicate/reload proof using the existing #668 loopback production-build harness. The missing migration registration is unfinished engineering work, not a user-side access problem.

## Actions that must NOT be repeated
Do not restart the Scout ability audit, repeat #668 release proof without changes that invalidate it, reread unrelated UI/JW lanes, claim the worker's inert web deployment is a TradeScout production release, use customer accounts for tests, overwrite current main, reclaim pending receipts automatically, or claim all Scout capabilities are complete. Do not ask the user to repair access; the GitHub and isolated verification-worker paths work.

## Law classifications
- Owner-scoped keyed-profile dispatch and at-most-once receipt behavior: enforced in changed production modules and native proof; production installation not complete.
- Confirmation/contact/Trust/CVS/county authority: prior owners preserved, not newly re-attested for all flows here.
- Accurate full-platform completion telemetry, migration installation, and real browser receipt continuity: policy_target / unfinished in this checkpoint.
