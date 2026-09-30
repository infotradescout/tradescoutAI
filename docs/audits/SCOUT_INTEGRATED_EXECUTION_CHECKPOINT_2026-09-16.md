# Scout integrated execution checkpoint — 2026-09-16

Objective: Complete the owner-delegated Scout application/account/browser verification, combining the request fixes and smoke matrix before the production release gate.

Base branch/commit: #677, codex/scout-direct-connect-completion-20260916, 125890237260ec0d4ff911992adf0843117e7812; tree 8daa1cf59bec462821850faa97dfc83927583e7d.
Additional integration parent: #680, codex/scout-smoke-accounts-20260916, 4a182cba0ba037eddb581e6a1c4a741ba58c1b8a. Shared ancestor: 8326628efd6b21b8b2576b687e2a0c8fda4e9978. The smoke branch was one commit ahead and seven behind the request branch.
Current branch/commit: The containing two-parent integration commit on #677. Resolve the PR head; no main release is authorized by this checkpoint alone.

Verified completed work: Source composition preserves the entire #677 tree except the existing native driver's four-line opt-in. All eight #680 file blobs are reused verbatim, including its five modules, unit test, driver and documentation. The current #677 native-driver blob is 38f6e1ede516a8a6310d1c10b0803d7e751eeece, the exact base of the reviewed four-line patch. Its integrated blob is bdc53b1ebde8d07c71861dd29abe3dd2c271aa20. No product logic, ownership/contact/verification rules or release guard is removed or rewritten.

Files changed: docs/testing/SCOUT_SMOKE_ACCOUNT_MATRIX.md; scripts/smoke/{account-matrix.mjs,hash-passwords.ts,interaction-inventory.mjs,provision-accounts.mjs,run-account-matrix.mjs}; scripts/tests/scout-smoke-account-matrix.test.mjs; scripts/verify-scout-execution-flow.mjs; this checkpoint.

Tests/evidence already run: This continuation verified branch ancestry, source blob identities and the exact four-line integration patch. It did NOT execute a new application, unit, browser, database, build or release test. Historical evidence remains in SCOUT_REQUEST_SELECTION_CHECKPOINT_2026-09-16.md (63 isolated checks) and docs/testing/SCOUT_SMOKE_ACCOUNT_MATRIX.md (65 isolated harness checks). Historical counts are not current integration results and are not user journeys.
Changed but unverified work: The combined runner and request behavior together; real React mounting; real Express/session/PostgreSQL ownership; native provisioning; desktop/mobile account and continuation flows; full typecheck/build; unchanged strict release gate.
Tests/evidence invalidated by later changes: This is a new integration candidate. Exact-candidate application/build/browser/release evidence remains absent even though all inherited source/test blobs are unchanged. Rerun affected checks on this combined candidate. Earlier #675 release proof is not proof for this source.

Execution attempts: The user explicitly authorized PC or Chrome-debug access. Remote Desktop Commander list_devices returned TSCommandCenter with connector status offline and last_seen 2026-09-05T04:11:29.703Z; the direct device ping returned No devices available. This establishes a missing remote connection, NOT that the user's computer itself is off. No PC terminal or Chrome debug session was reached. The local sandbox cannot resolve GitHub/npm, lacks a complete application checkout/dependencies and native PostgreSQL. Installed legacy React assets do not match the application's React 18.3.1 version; they were not substituted as application proof. The existing Render verifier is pinned to an earlier branch/revision and is not evidence for this candidate. No prior rejected cloud environment write was repeated or bypassed.

External side effects and retry safety: GitHub source integration on the existing nonproduction #677 branch only. A real second parent preserves #680 history. No force-push, production deployment, live customer mutation, message, contact, purchase or payment. No account provisioning attempted; application accounts created by this continuation: 0; native account/browser matrix cases executed: 0. Do not reseed after an uncertain provisioning commit.

Known blockers/risks: Missing connected execution terminal; no matched complete local runtime in this chat. The matrix has 30 planned accounts and 210 planned core checks, not executed successes. Its 34 broader workflow groups remain explicitly not_run; a green core matrix must never mean all Scout functions are complete.

Next exact action: When the authorized PC is connected, read Desktop Commander configuration and inspect the established TradeScout checkout, active worktrees and available native Linux/WSL/container environment without overwriting local work. Use an isolated worktree of the current #677 integration commit and the existing non-root disposable Linux verification harness. Do not redirect the harness to production or reuse a customer database.

Run in that complete environment (not claimed executed here):
```sh
node --test scripts/tests/scout-direct-connect-callback-check.cjs scripts/tests/scout-request-context-check.cjs scripts/tests/scout-request-selection-check.cjs scripts/tests/scout-smoke-account-matrix.test.mjs
npm run check
npm run build
node scripts/verify-scout-execution-flow.mjs --account-matrix
```
Then complete native desktop/mobile selected-request create/cancel/428/retry, A/B and A/B/A continuation, same-browser account switching, ownership-denial and uncertainty flows using disposable fixtures. The core matrix alone does not prove these additional transitions. Fix observed failures and preserve evidence. Finally run the unchanged gate:minimum-release on the exact clean integration commit with genuine browser/database evidence before merging main; verify the production commit and read-only health afterward.

Actions that must NOT be repeated: Broad Scout audit, rebuilding the existing context/selection coordinator or smoke suite, redoing this integration, asking for permission already supplied, disabling release/contact/rate-limit guards, overwriting unrelated local or JW work, counting source checks as native journeys, production account flooding, or routing around rejected tool operations.
