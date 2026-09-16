# Scout request-selection checkpoint — 2026-09-16

Objective: Fix competing saved-request selections in the existing Continue with Scout flow without restarting the capability audit or changing request/contact authority.

Base branch/commit: codex/scout-direct-connect-completion-20260916 at 70cb7b18114579da58e2bdfd4c7df426ee36e9cb; base tree c46dc26c18698ffcba521d52d1cc859ca3ce35b3. Prior request capability checkpoint: SCOUT_REQUEST_CONTINUATION_CHECKPOINT_2026-09-16.md.

Current branch/commit: Same #677 branch, this containing commit. The PR description records the exact final commit. No main merge or deployment.

Verified completed work:
- Reproduced the prior callback defect: two different request buttons sent both contexts, in either response order. Both regression cases failed on the exact prior button blob b6a394cdaf717cf5e002a849b9a5775c826a81e3.
- One owner-scoped selection coordinator per mounted work list. Selecting B aborts pending A. Late A success/failure cannot enter the conversation, display a stale failure, or clear B's pending state.
- Abort releases the old button's loading state immediately, even when its HTTP promise does not settle. A -> B -> A starts a fresh final A read; all six settlement orders retain only that final context.
- Same-button duplicate protection, session/record guards, explicit read failures and normal workspace links remain. No automatic retry or fallback to an older request.
- List owner change/removal cancels pending selection. The coordinator retains only an AbortController, not request text or credentials. No module-global selection state.

Files changed:
- client/src/scout/scoutRequestSelection.ts (new)
- client/src/scout/ScoutRequestContinueButton.tsx
- client/src/scout/ScoutWorkPanel.tsx
- scripts/tests/scout-request-selection-check.cjs (new)
- scripts/tests/scout-request-context-check.cjs (one dependency-injection line; assertions unchanged)
- this checkpoint

Tests/evidence already run:
```sh
NODE_PATH=$(npm root -g) node --test scripts/tests/scout-request-context-check.cjs scripts/tests/scout-request-selection-check.cjs
tsc --noEmit --strict --target ES2022 --module commonjs client/src/scout/scoutRequestSelection.ts shared/scoutRequestContext.ts
node --check scripts/tests/scout-request-selection-check.cjs
```
63/63 isolated tests passed, zero failed/skipped/cancelled: 32 existing context checks and 31 new selection/list-wiring checks. Strict typecheck of the two named standalone modules passed. Changed TS/TSX transpilation passed in the tests. Full project typecheck/build was NOT run.

The local snapshot's six fetched source/test baselines were checked against their Git blob identities before editing. Tests execute the actual selection module, shared projection, route handler, client loader and AST-extracted button callback. Request/network/SQL adapters, component refs/state and React hooks/JSX are simulated. Five checks execute the actual work-list render with a small simulated hook runtime. These are NOT mounted React/browser, real PostgreSQL or model-quality evidence. The prior 43 request-creation callback checks were not rerun in this slice; their owning ScoutOS/save files are unchanged.

Tested source/test blob identities:
- `client/src/scout/ScoutRequestContinueButton.tsx`: `d1ac1d1219151d800b4fc614fa3cb63f64f41b62`
- `client/src/scout/ScoutWorkPanel.tsx`: `9d49c15e502441dc62004f5535d825424a7c72aa`
- `client/src/scout/scoutRequestSelection.ts`: `0b292981f6fefffa239051a5a6c96ab48623857b`
- `scripts/tests/scout-request-context-check.cjs`: `1bd16cd4c9ebc1c2e69393595dce2ae51236b2fb`
- `scripts/tests/scout-request-selection-check.cjs`: `592c47e4fc54033df14e2170828886c70357aa5c`

Changed but unverified work: Real mounted account/list transitions, actual fresh authenticated request reads, desktop/mobile Continue with Scout, real React scheduling and full release candidate behavior. This branch remains draft.

Tests/evidence invalidated by later changes: Any edit to these five source/test owners requires rerunning the two named checks. Previous #675 release proof is not proof for #677; previous single-button checks did not prove cross-button selection. Do not add previous and current counts into an end-to-end success total.

Known blockers/risks: Desktop connector reported TSCommandCenter offline. This sandbox could not resolve GitHub/npm and has no complete application dependency checkout. GitHub source access and offline TypeScript/Node execution worked. No attempt repeated or bypassed the prior rejected verification-worker environment write. No cloud configuration changed.

External side effects and retry safety: Source-only commit on existing draft #677. No production account, customer record, request, contact, message, payment, deployment or account provisioning. No existing local worktree was modified. Smoke matrix #680 remains prepared but native account/browser execution is still unproven (0 accounts created and 0 native matrix cases executed by this continuation). No forced ref updates or safety-gate changes.

Next exact action: Use the authorized complete runtime to run configured focused suites and mount the two-request flow at desktop/mobile. Exercise A/B, A/B/A, unmount/account-switch, latest-read failure, cancel/create/428/retry, and verify actual session-owned persisted context. Integrate #680 with the final #677 candidate and execute its account matrix; preserve explicit unrun workflow groups. Then run the unchanged strict minimum-release gate on the exact clean integration commit before merging main.

Actions that must NOT be repeated: Broad Scout audit, rebuilding this coordinator/handoff, claiming synthetic callback checks are browser journeys, overwriting independent JW/profile work, marking planned matrix cases passed, production account flooding or bypassing rejected tool operations.
