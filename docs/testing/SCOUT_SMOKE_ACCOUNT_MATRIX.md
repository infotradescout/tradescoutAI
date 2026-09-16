# Scout smoke accounts and interaction coverage

## Scope
The opt-in native extension is configured for **30 new accounts: 15 personas on desktop and mobile**. It covers new/incomplete users, unverified homeowners, separate same-county owners, another county, buyers/sellers, property managers, contractor accounts, businesses, community users, moderators, operations administrators and super administrators.

These are identity fixtures, not provider approvals, JW memberships or financial entitlements. A business login cannot count as proof of supplier access.

Seven implemented checks per account form a planned **210-case core matrix**: wrong-password denial; correct login/session owner; ignored client owner override; private-work contract and bounded results; actual Scout browser entry; session preservation after reload; and loss of private access after logout.

The existing ten profile/receipt and two work-overview journeys remain unchanged. `--account-matrix` adds the new matrix after them. Earlier failures stop execution rather than silently passing later cases.

The catalog keeps **34 broader workflow groups marked not_run**: signup/recovery, multi-step Scout/request execution, conversations, Direct Connect lifecycle/contact gates, messaging/notifications, community, Exchange/batch imports, business profiles/bookings, homes/projects, supply runs, design tools, quotes/invoices, sandbox payments, JW employee/membership/cart flows, administration, account switching, uploads, accessibility, network recovery and throttling. Each needs its actual owning workflow's fixtures and postconditions. Even a passing core matrix leaves `allPossibleInteractionsCovered=false`.

A separate AST inventory lists static route/link and UI-event declarations plus existing test declarations. It preserves disabled/focused/dynamic tests. It does not claim exhaustive runtime interaction discovery or treat source declarations as passing tests.

## Isolation
Provisioning requires the existing loopback application, named disposable database, loopback database server address and native harness proof table. It rejects inherited master-admin and provider credentials. Canonical application password hashing and profile version are used. Database role values are validated before insert-only parameterized SQL; every identity is independently read back before creation is confirmed. Existing users and businesses are never upserted or reclassified.

An uncertain commit is recorded as unconfirmed, not falsely reported as zero created accounts; there is no automatic reseed. The parent harness disposes its fresh database. Separate browser contexts isolate actors; credentials are excluded from reports. Existing rate limits/proxy are unchanged, and a 429 remains a failed check. No cloud deployment setting, production customer account or live provider credential is used.

Screenshots and evidence are saved only after execution, under the already-ignored `test-results/scout-smoke-accounts/<runId>/`. Zero assertions, duplicate cases, missing actors, incomplete browser coverage and fatal setup/cleanup errors cannot produce core-matrix success.

## Commands in an authorized complete checkout

```sh
node --test scripts/tests/scout-smoke-account-matrix.test.mjs
npm run build
node scripts/verify-scout-execution-flow.mjs --account-matrix
node scripts/smoke/interaction-inventory.mjs .
```

Use the existing non-root Linux native verification environment, not a deployed site. The unchanged strict minimum-release gate belongs on the final integration candidate after native/application proof.

## Actual evidence in this editing session
**65/65 local harness tests passed; zero skipped.** These cover account policy, mocked transaction/readback behavior and TypeScript AST inventory. They are not authenticated user journeys. One initial test assertion falsely matched `updated_at` as an UPDATE statement; the SQL-keyword assertion was corrected without weakening requirements. JavaScript syntax and TypeScript transpilation diagnostics were checked, not full-project typechecking.

**Application accounts created: 0. New native/browser matrix cases executed: 0.** The remote development connector returned no device, and the local sandbox could not resolve repository/package hosts. The previous verification-worker safety rejection was not retried or routed around. No cloud settings were changed.

## Resume checkpoint
Objective: execute and expand actual role/account smoke coverage while preserving unfinished #677 request continuation.
Base branch/commit: codex/scout-direct-connect-completion-20260916 at 8326628efd6b21b8b2576b687e2a0c8fda4e9978. It advanced independently from initially inspected 4e7e4527; the added product work is preserved.
Current branch/commit: codex/scout-smoke-accounts-20260916; resolve the branch head for this test-only extension. Stack integration onto #677, not production directly.
Verified completed work: account policy, insert-only/readback provisioner, native runner, coverage-gap ledger, AST inventory, and 65 local harness checks.
Changed but unverified work: actual PostgreSQL provisioning, canonical hash subprocess, all 30 account/browser sessions, full application typecheck/build, expanded native run and release gate.
Files changed: five scripts/smoke modules; scripts/tests/scout-smoke-account-matrix.test.mjs; four-line opt-in extension to scripts/verify-scout-execution-flow.mjs; this document.
Tests/evidence already run: local Node tests with installed global TypeScript via NODE_PATH, syntax and transpilation diagnostics. Existing native-driver baseline bytes matched GitHub blob 38f6e1ede516a8a6310d1c10b0803d7e751eeece before the four-line extension.
Tests/evidence invalidated by later changes: changes to fixture/runner require targeted checks; earlier #675 evidence is not proof of this extension or new #677 behavior.
Known blockers/risks: native execution unverified; specialized entitlement/workflow adapters not implemented. Investigate role/login failures against the actual authentication policy rather than automatically declaring a product defect.
External side effects and retry safety: test-code branch/PR only; no production accounts, customer writes, messages, purchases, payments or deployment. No automatic provisioning retry or account overwrite.
Next exact action: execute the native driver with --account-matrix in the authorized complete runtime, inspect account readback/session evidence and failures, and implement the next owned workflow adapters without hiding missing coverage.
Actions that must NOT be repeated: broad Scout audit, #675 rediscovery, overwriting concurrent #677 work, claiming all interactions passed, using only business_owner fixtures, production smoke-account flooding, safety-check bypass or release without required proof.
