# Scout execution checkpoint — 2026-09-15

This is a bounded implementation/evidence checkpoint, not a replacement roadmap or a production-readiness attestation.

## Objective
Make existing Scout actions execute predictably before expanding advertised capabilities. Preserve existing workspaces, drafts, contact gates, county ownership, Trust/CVS, and payment handoffs.

## Base branch/commit
`main` at `bda589173ec470e5c13044492caa4b13a6b3490d`.

## Current branch/commit
Branch: `codex/scout-action-execution-hardening-20260915`.
Product/test parent of this documentation commit: `e22839e8bb757adeea2321a1e1b733893c2b9d7e`.
This checkpoint commit changes documentation only; resolve the branch head for the final checkpoint SHA.

## Verified completed work
The production router now:
- Requires authentication and explicit approval for SAVE_PROFILE before its server execution request. Cancellation cannot reach the save endpoint through this dispatcher.
- Honors explicit approval requirements for CALL_TOOL and EXTERNAL_LINK rather than losing them inside type-specific branches.
- Rejects sensitive actions and tool calls when the guard fails or does not positively acknowledge success, while preserving low-risk navigation fallback.
- Accepts ASK_SCOUT prompts from either the top level or payload, awaits asynchronous handlers, and reports missing prompts/handlers.
- Propagates follow, unfollow, and broadcast adapter failures rather than swallowing them. Invalid connection/broadcast inputs also fail explicitly.
- Awaits ad-feedback HTTP completion and exposes HTTP/network, disabled-feature, and invalid-input failures.
- Treats the two payment-start action types as navigation-only regardless of generated label text.
- Runs the existing single server-returned follow-up through the same authentication, role, supported-tool, confirmation, and guard checks. Follow-up chaining stays bounded.

No business capability, UI surface, destination workflow, backend endpoint, or payment execution was added or removed. Existing checkout adapter code remains, but payment-start actions are intercepted before it. Dedicated draft handoffs are preserved.

## Changed but unverified work
The changes above have isolated production-module behavioral proof, not full application proof. The original Vitest profile-save case now supplies authenticated approval and asserts confirmation; that Vitest suite itself has not been run here. The server-returned follow-up guard round trip needs actual Express/session/browser verification before release.

## Files changed
1. `client/src/scout/ScoutActionRouter.ts`
2. `client/src/scout/ScoutActionRouter.test.ts`
3. `scripts/tests/scout-action-execution-check.cjs`
4. This checkpoint.

## Tests/evidence already run
The isolated runner loads and transpiles the actual production router and both real registries. It does not duplicate their implementation. HTTP, browser APIs, and write adapters are mocked; no external write is performed.

Command on a complete checkout with the project TypeScript dependency:

```sh
node --test scripts/tests/scout-action-execution-check.cjs
```

Sandbox command used the same command with `NODE_PATH` pointing to installed global TypeScript because a full dependency checkout was unavailable.

Results:
- Original production-module snapshot at the base commit: **47 tests, 12 passed, 35 failed**. These are failing test cases, not 35 distinct defects.
- Changed production-module snapshot: **47 tests, 47 passed, 0 failed, 0 skipped**.
- Covered approvals/cancellation, profile guard outages and malformed acknowledgements, guest auth, explicit tool/link approval, prompt representations and async failure, follow/unfollow/broadcast failures, feedback completion, unlabeled payment starts, follow-up role/guard checks, bounded chaining, and preserved Direct Connect/Exchange/Community drafts.
- Transpile diagnostics were checked. Transpilation is not a project TypeScript typecheck.
- Original fetched source was reconstructed byte-for-byte and checked against GitHub blob SHAs before testing. Pushed router and runner blobs match the tested bytes.

Verified blob identities:

```text
Base ScoutActionRouter.ts: 0d9f29402b78d71317eb5ec4d1769137dd771ee9
Changed ScoutActionRouter.ts: 893452a194c8a679a01ff820df95aceceb602330
Execution check runner: 32b8f55760a261b026caacdb4334353a29678a60
Unchanged scoutCommandRegistry.ts: c0391f3f1bcf5b92caf806e9408440cd4beaed1d
Unchanged shared/scoutSupportedTools.ts: 2f0ae3d1d9eeb63505ba909031e7316f26e9010f
Updated original Vitest file: fc45260d56a1ff5db9b575cd6d4d688dd04a8ec0
```

## Tests/evidence invalidated by later changes
None within this checkpoint. Changes to the router or registries require rerunning the targeted checks. Integration with other branches requires validation of the combined candidate, not reuse of these results as a full release gate.

## Known blockers/risks
- Remote Desktop Commander returned no available device. Sandbox outbound GitHub DNS resolution failed. GitHub connector reads/writes succeeded.
- Full repository dependencies, Vitest, project typecheck/build, database integration, browser journeys, and `gate:minimum-release` were NOT executed. Do not merge this checkpoint to production on isolated tests alone.
- At the base commit, the generic `SUPPORTED_SCOUT_TOOLS` registry contains only `ads.feedback`. This is not the total Scout capability count: dedicated actions and destination workspaces exist. Broad tool execution remains unfinished.
- Existing action validation and route allowlists still need parity checks against actual destination routes. This patch does not claim to validate every URL, payload, advertised ability, or server authorization path.
- Payment detection still uses label/name heuristics for other action types. Typed capability policy, explicit execution receipts, durable multi-step continuity, and duplicate/retry protection remain unimplemented in this slice.
- Actual completion depends on destination workflow/backend ownership. A workspace handoff or draft must not be described as a completed listing, purchase, message, invoice, or project.
- Other open release/UI/JW work was not merged, rebased, or overwritten. Reconcile only overlapping owners when integrating.

## External side effects and retry safety
GitHub branch commits and a reviewable draft PR are the only intended external changes. No production release, customer account change, profile save, follow, broadcast, feedback submission, purchase, or payment was performed. Test inputs are synthetic. No automated mutation retry was introduced. An uncertain guard result tells the user to check current state before retrying.

## Next exact action
On the authorized full workspace, fetch this branch and check out its head without disturbing other active work. Run the existing `ScoutActionRouter.test.ts` Vitest suite using the repository's configured runner plus the standalone 47-case check. Verify authenticated approve/cancel and follow-up guard behavior against the real server and browser. Run the minimum release gate only on the integration/release candidate; merge only with that evidence.

After that proof, continue the existing capability inventory by tracing each advertised action to its owned read/draft/approved-write endpoint and an observable result. Prioritize actual workflow completion over adding capability labels. No fresh repository-wide audit is needed to resume this slice.

## Actions that must NOT be repeated
Do not restart the Scout abilities audit, copy MealScout context into this repository, broaden this branch into JW inventory/UI lanes, overwrite active branches, re-add GitHub Actions, or claim that passing isolated tests makes Scout fully functional or deployed. Do not rerun repository-wide gates after each bounded edit.

## Law classification for this slice
- Approval before SAVE_PROFILE execution: enforced in the changed dispatcher and isolated tests; full browser/server release proof pending.
- No direct payment execution through Scout payment-start actions: enforced in the changed dispatcher and isolated tests.
- Contact, county, and Trust/CVS authorities: preserved owners, not re-audited or newly attested by this slice.
- End-to-end completion for every advertised capability: policy_target, not achieved by this checkpoint.
