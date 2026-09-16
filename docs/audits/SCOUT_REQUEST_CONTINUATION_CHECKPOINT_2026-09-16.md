# Scout request continuation checkpoint — PR #677

## Objective
Continue from released #675 into selected-request conversational continuity and truthful request-creation outcomes. Do not restart the Scout abilities audit.

## Base branch/commit
`main` at `a80272ee8642e9ce4793a592bd265cf6475bf2d0` (#675). At the final PR read, main still matched that base.

## Current branch/commit
`codex/scout-direct-connect-completion-20260916`.
Implementation/test head: `392db28746be5c73fb6a890edf41847402bb3e0a`.
This checkpoint adds documentation only. PR #677 remains draft and unmerged. No deployment for this slice.

## Verified completed work
- Scout home passes its existing conversation callback into the work panel. Saved requests now expose Continue with Scout alongside their existing workspace link.
- A fresh authenticated GET `/api/scout/work/requests/:requestId` loads only the selected owner's request. The query is parameterized, read-only, and uses session ownership, not client-supplied ownership. Private no-store responses vary by Cookie/Authorization. Missing and other-owned requests share the same 404; failures return safe 503 responses.
- The continuation snapshot includes request ID, saved title/scope, trade, budget, county/state, recorded status, update time and exact existing workspace path. Scope is limited to 1,200 characters and marked when truncated. Unknown data stays unknown. No unrelated contact columns, internal notes, raw SQL or response-supplied URLs are projected.
- The prompt treats saved text as quoted data, not authority to execute instructions. It asks to continue the existing request rather than make a duplicate, preserve known facts, and identify only missing next-step information. This is context preparation, not a guarantee of model response quality or autonomous action completion.
- The continuation click has a synchronous in-flight guard and rejects late results after account/request changes, abort or unmount.
- Actual HTTP 428 PROFILE_BASICS_REQUIRED / VERIFICATION_REQUIRED errors from the create endpoint now become fixed internal recovery actions. HTTP 401 leads to sign-in; other errors remain unconfirmed. No write retry is performed by this adapter.
- Idempotent replay refreshes the work view but does not count another request-created activity. Malformed replay flags fail closed.
- Existing pending-save protection, exact request links, operation-key reuse for an explicitly retried unchanged draft, and failure-preserving result validation remain.

## Two important corrections to prior assumptions
1. `autoRoute: false` does NOT mean a private unshared draft. The current untargeted create endpoint inserts an `open`, `community` request even when automatic routing is disabled. The confirmation now explicitly discloses county-board posting, no automatic invitations, and gated contact details. Server behavior and permissions were not changed.
2. The normal create endpoint rejects prerequisites using HTTP 428. `apiRequest` throws an `ApiError` with status/code/details. The original HTTP-200-only guidance branch did not handle that path. The adapter now handles the real error contract.

Source owners inspected: `server/routes/direct-connect.ts` creation handler, approximately lines 5770–6100, and `client/src/lib/queryClient.ts`, approximately lines 1–210, at starting head 4e7e4527. Do not search the entire route monolith again.

## Tests/evidence already run
Offline sandbox, Node 22.16.0, global TypeScript 5.8.3. The local source snapshot is partial, not a full application checkout. All new tested modules are complete; the ScoutOS callback was reconstructed from its fetched source excerpt and inspected patch, then extracted with the TypeScript AST. HTTP, database, React state/ref adapters, error formatter and cache adapters are simulated.

```sh
node --test scripts/tests/scout-direct-connect-callback-check.cjs scripts/tests/scout-request-context-check.cjs
tsc --noEmit --strict --target ES2022 --module commonjs shared/scoutRequestContext.ts client/src/scout/scoutRequestCompletion.ts
```

The sandbox supplied `NODE_PATH=$(npm root -g)` for its installed TypeScript dependency.

- Request-save callback runner: **43/43 passed**.
- Request-context/handler/loader/click runner: **32/32 passed**.
- Combined: **75 passed, zero failed, zero skipped**.
- Strict isolated TypeScript check of the request-result helper and shared context module: passed, exit 0. This is NOT a full-project typecheck.
- New modules' transpile diagnostics: no syntax errors. Transpilation is not typechecking.
- Competing callback tests invoke 20 additional callbacks while the original is pending: one simulated create request; analogous continuation test performs one read and one conversational handoff. These are not real browser double-click or native database tests.

Verified Git blob identities matching the tested local bytes:

```text
client/src/scout/scoutRequestCompletion.ts 8af2cc4665287571cafb1fc32d30a1d3025a9913
shared/scoutRequestContext.ts 086a4295d52ef810f3acbe334c80d57d678b4403
server/scout/scoutRequestContextRoutes.ts 18e61faa30a7c1494f74ea779e6e8d5bd549df58
client/src/scout/scoutRequestContinuation.ts f03d8857c3ca1b23692c8930a51e547cdea816a3
client/src/scout/ScoutRequestContinueButton.tsx b6a394cdaf717cf5e002a849b9a5775c826a81e3
scripts/tests/scout-direct-connect-callback-check.cjs b240a51feb87daa175259f256c421d73010d2a54
scripts/tests/scout-request-context-check.cjs 21d88682d7c3c38fba10bd2f3962f816fa38a546
```

The composed full ScoutOS blob is `119c4ad8f4f90959c32e571ab69913d8b7aeec43`. Its two-file integration diff was inspected; the local callback-only source is not claimed to have this full-file hash.

## Changed but unverified work
Full configured Vitest suites, full-project typecheck/build, mounted React interaction, real Express/PostgreSQL ownership path, authenticated browser create/cancel/428/retry, the actual Scout model response after continuation, and the strict minimum-release gate have NOT run for this candidate. No production release or customer mutation was performed. Prior #675 release proof does not establish these new behaviors.

The configured Vitest tests were updated to import the real submission adapter and include the replay field in the result contract, but those configured suites themselves remain unexecuted here.

## Files changed
Existing: ScoutOS.tsx, ScoutHome.tsx, ScoutWorkPanel.tsx, actionValidation.ts, scoutWorkRoutes.ts.
New: scoutRequestCompletion.ts and its configured tests; ScoutDirectConnectCompletion.test.ts; scoutRequestContext.ts; scoutRequestContextRoutes.ts; scoutRequestContinuation.ts; ScoutRequestContinueButton.tsx; the two Node test runners; this checkpoint. Paths remain within TradeScout Scout/client/shared/server owners.

## Tests/evidence invalidated by later changes
The original 27 helper-only cases and 29 baseline callback cases are historical. Current helper/callback coverage is the 43-case runner above. Current context coverage is 32 cases. New source edits require their targeted rerun. No source edit followed the reported combined passing run other than repository copies of the matching tests and documentation.

## Known risks / remaining verification
- Existing endpoint creation posts to the community board. The accurate disclosure is intentional; no private-draft API was invented.
- Context is a read-time snapshot, not permanent authority for a later write. Existing workflow approval/contact/county guards remain the authority.
- Read only supports owned requests, not provider-assigned incoming work. Unrelated private columns are excluded, but user-authored scope remains quoted text.
- The new continuation is wired on Scout home. The existing work drawer does not receive its conversation callback and retains its previous workspace links.
- An in-memory unsubmitted draft and operation reference are not promised to survive logout/page reload. Server-saved requests can be freshly loaded.
- The previous Render environment-update attempt was rejected by tool safety. No attempt to bypass that rejection was made. Remote Desktop returned no device this session; offline targeted verification and GitHub source work proceeded. No user access repair is requested.

## External side effects and retry safety
Only implementation-branch commits, PR/checkpoint updates and temporary nonproduction patch-composition refs were changed. No main merge, deployment-setting change, production record, contact, broadcast, purchase or payment was executed.

Temporary #679 closed UNMERGED. #678 was automatically marked merged into its nonproduction base when a common descendant containing both temporary tips advanced that base; it was not a main merge or release. Ordinary implementation commit 3baf9101 copies only the two inspected final source blobs onto the real branch. Synthetic transport ancestry is excluded from #677. Do not deploy temporary branches or repeat this composition.

## Next exact action
On the authorized full development checkout, resume #677 at the recorded implementation/checkpoint head. Run the two committed Node suites plus configured `ScoutDirectConnectCompletion.test.ts`, `scoutRequestCompletion.test.ts`, existing ScoutWorkPanel and actionValidation suites. Verify the real mounted Continue with Scout button loads the selected owned request, starts one conversation with the stored scope, rejects foreign/changed-account responses, and does not create a duplicate request. Verify real creation disclosure and HTTP 428 recovery against native synthetic accounts, then full typecheck/build and strict release gate on the final clean integration candidate. Merge only after that proof; no new broad audit is needed.

## Actions that must NOT be repeated
No Scout abilities audit, unrelated JW/UI repository scans, recreation of this context handoff, false private-draft claims, inferred completion from navigation, release claims based on isolated tests, tool-safety bypass, or requests for user access repair.

## Law classification for this slice
- Session-owned request-context SELECT and no mutation in context loading: enforced in source and isolated handler checks; native integration verification pending.
- Fresh selected-request/owner validation and late-response rejection: enforced in source and isolated tests; mounted-browser proof pending.
- Contact/Trust/CVS/county execution authority: existing owners preserved, not newly attested across all flows.
- Complete conversational multi-step task execution and production readiness of this slice: policy_target, not yet achieved.
