# Scout execution checkpoint — 2026-09-15

This is the current resume point for PR #668, not a replacement roadmap or production-readiness attestation. The first client checkpoint remains in Git history at `f8e11d3c00eb5a4a4642024c61ff647f760c406a`.

## Objective
Make existing Scout actions execute predictably and report truthful results before expanding advertised abilities. Preserve existing workspaces, drafts, authentication, contact gates, county ownership, Trust/CVS, and payment handoffs.

## Base branch/commit
`main` at `bda589173ec470e5c13044492caa4b13a6b3490d`.
This continuation resumed PR #668 at `f8e11d3c00eb5a4a4642024c61ff647f760c406a`; it did not restart the abilities audit.

## Current branch/commit
Branch: `codex/scout-action-execution-hardening-20260915`.
Current product/test commit: `82a192c9e473fb14ef27533dfe2e3a09030a98fb`.
Server implementation commit: `3f1b6433260e36808f3797dbbc408a54ca661484`.
This checkpoint update is documentation-only; resolve the branch head for its final SHA.

## Verified completed work
### Previously checked client behavior, unchanged in this continuation
- SAVE_PROFILE authentication and approval precede the executing guard request.
- Explicit approval flags apply across action types; sensitive/tool requests require positive acknowledgement.
- ASK_SCOUT handles top-level and payload prompts, awaits handlers, and surfaces failures.
- Follow/unfollow/broadcast and feedback errors propagate; feedback awaits its HTTP result.
- Payment-start types remain navigation-only, independent of label text.
- The existing single follow-up uses auth, role, supported-tool, approval, and server checks.
- Direct Connect, Exchange, and Community draft handoffs remain intact.

### Server continuation
The actual `runScoutAction` implementation previously retried every rejected executor once. Selected classified errors then returned `ok: true` with a recovery instruction despite no successful execution. Falsy thrown values could also bypass the failure branch. The Scout route consumes this result to choose its success response and submission telemetry; its failure response forwards `error.context`.

The changed guard now:
- Invokes an executor once per guard call, with no generic automatic retry.
- Returns failure for every thrown value, including null, undefined, false, zero, empty strings, and values the classifier cannot stringify.
- Does not wrap an explicit `{ok: false}` or `{success: false}` acknowledgement in success.
- Returns an unconfirmed outcome after an execution error rather than claiming rollback, successful recovery, or completion.
- Does not emit an automatic retry instruction for an uncertain outcome.
- Replaces execution-failure diagnostics with safe context: action, executionState, and attempt count. Raw exception contents, submitted payloads, and profile data are not copied into this result or its diagnostic log.
- Preserves pre-execution sign-in/location/business prerequisites, successful result data, and safeExecute's success/failure behavior.
- Rejects missing, blank, and non-string action types before calling an executor.

These are guard-level guarantees, not new invoice/message/HOA capabilities. Test action names exercise the generic guard; they do not prove corresponding product endpoints exist. The production route's registered server executor remains SAVE_PROFILE. No new API, schema migration, checkout, contact exposure, or customer action was introduced.

## Changed but unverified work
No HTTP/Express/session/database/browser journey or full application check was executed. The server route's consumption of the result was inspected in source, not exercised as an integrated HTTP endpoint. The existing router Vitest case was updated in the first slice but remains unexecuted. Frontend cancellation/completion telemetry and duplicate clicks across distinct requests remain to be traced and verified.

## Files changed
Relative to main:
1. `client/src/scout/ScoutActionRouter.ts` — previous slice, unchanged now.
2. `client/src/scout/ScoutActionRouter.test.ts` — previous slice, unchanged now.
3. `scripts/tests/scout-action-execution-check.cjs` — previous 47-case suite, unchanged now.
4. `server/utils/scoutActionGuard.ts` — this continuation.
5. `scripts/tests/scout-server-execution-check.cjs` — this continuation, 49 cases.
6. This checkpoint.

`server/utils/scoutErrorMapping.ts` was read, executed by tests, and typechecked but NOT modified.

## Tests/evidence already run
### New server evidence
Command on a checkout with the existing TypeScript dependency:

```sh
node --test scripts/tests/scout-server-execution-check.cjs
```

Sandbox ran this command with SCOUT_TEST_ROOT selecting the pinned source snapshot and NODE_PATH selecting installed TypeScript. Node 22.16.0; TypeScript 5.8.3. Tests load the actual guard AND error-mapping modules. Executor, timer, and diagnostic sink are synthetic. No writes leave the test process.

- Pre-continuation server source: 49 tests, 20 passed, 29 failed.
- Changed server source: 49 tests, 49 passed, 0 failed, 0 skipped.
- The 29 failures are failing test cases, not 29 distinct defects.
- Passed targeted strict semantic typecheck, not just transpilation:

```sh
tsc --noEmit --strict --target ES2022 --module commonjs server/utils/scoutActionGuard.ts server/utils/scoutErrorMapping.ts
```

Scope is these two modules only, not the project configuration or full build.

Fetched source snapshots were reconstructed byte-for-byte and checked against GitHub blob SHAs before execution. Pushed implementation and runner match tested bytes:

```text
Base guard: 4573a3d2794ae97f497e367f64152fa2a84923e5
Changed guard: 9dcb2fd0cc656984d7c1ec42c3565fea6fd40043
Unchanged error mapping: e6b6ee281d0b20f2abf129414cf198821c95a81e
Server test runner: 7c7dc5d3658595164b24367b8a8a2b08a54ada25
```

### Preserved client evidence; not rerun here
The original client slice's isolated real-router/registry checks recorded 47 cases: 12 passed/35 failed before, 47 passed/0 failed after. Browser/HTTP/write adapters were mocked. Client source and dependencies used by that suite did not change in this continuation. Preserve this evidence but do not call it a fresh combined 96-case integration run.

```text
Changed client router: 893452a194c8a679a01ff820df95aceceb602330
Client runner: 32b8f55760a261b026caacdb4334353a29678a60
Command registry: c0391f3f1bcf5b92caf806e9408440cd4beaed1d
Tool registry: 2f0ae3d1d9eeb63505ba909031e7316f26e9010f
Updated original Vitest file: fc45260d56a1ff5db9b575cd6d4d688dd04a8ec0
```

## Tests/evidence invalidated by later changes
The new guard changes real server execution behavior. Prior mocked-client checks do NOT establish client/server compatibility; it needs fresh integration proof. No implementation changed after the new 49-case suite and targeted typecheck; this update changes documentation only. Any guard/mapping change invalidates the new targeted evidence.

## Known blockers/risks
- Remote Desktop Commander was retried on continuation and still returned no available device. Sandbox DNS failed for GitHub and npm; GitHub connector reads/writes succeeded.
- Full project dependencies, existing Vitest, project typecheck/build, DB/session/browser proof, and minimum-release gate remain unavailable/unexecuted in this environment. Do not merge on isolated tests alone.
- One attempt per guard call is NOT durable idempotency, cross-request deduplication, or exactly-once execution. Independent requests still run independently; a test explicitly records this limit.
- An uncertain result may mean a write already committed. Reconcile actual status before another attempt; do not add blanket retries.
- Classifier behavior outside this guard was not changed or fully audited. The guard redacts its own execution failures; this is not a platform-wide error-redaction claim.
- The generic supported-tool registry still contains only ads.feedback; other abilities have dedicated actions/workspaces. No broad capability-completion claim is supported.
- Route allowlist parity, durable execution receipts, task continuity, and destination completion remain follow-on work. A handoff or draft is not a completed listing, purchase, message, invoice, or project.
- Other release/UI/JW branches were not rebased, merged, or overwritten.

## External side effects and retry safety
Only PR-branch source/tests/checkpoint commits and PR metadata were changed. No main merge, deployment, customer profile update, message, follow, broadcast, feedback, purchase, or payment occurred. Test executors are synthetic. No retry was added; generic automatic retries were removed from this guard.

## Next exact action
Use an isolated full-workspace checkout of PR #668 without disturbing other lanes. Run the configured router Vitest suite and both targeted execution checks. Then prove the actual authenticated SAVE_PROFILE approve/cancel/failure path through Express and the browser, including an uncertain post-write acknowledgement and the bounded follow-up path. Check frontend completion telemetry and duplicate action handling against those real outcomes. Run `gate:minimum-release` on the exact integration/release candidate only, and merge only with that evidence.

If the full workspace remains unavailable, continue only a bounded source-level slice with explicit validation limits; do not represent another isolated test as an integrated release. Trace each advertised ability to its owned read/draft/approved-write endpoint and observable result after the execution boundary is proven.

## Actions that must NOT be repeated
Do not restart the Scout audit or re-fetch unchanged client modules just to reconstruct already-recorded state. Do not broaden this branch into JW inventory or unrelated UI, import another product, overwrite active branches, add GitHub Actions, introduce a generic automatic write retry, or claim this branch is deployed. Do not rerun repository-wide gates after each small edit.

## Law classification
- Client approval-before-execution and payment navigation-only: enforced in changed dispatcher with prior isolated proof; integrated release proof pending.
- No success-after-exception and no generic automatic executor retry: enforced in changed server guard with 49-case targeted proof.
- Contact, county, and Trust/CVS authorities: existing owners preserved; not newly attested here.
- End-to-end completion for all advertised abilities, durable duplicate protection, and production release: policy_target, not achieved by this checkpoint.
