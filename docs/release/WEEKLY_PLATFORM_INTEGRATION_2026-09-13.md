# Weekly platform integration — September 13, 2026

This isolated candidate combines four reviewed platform lanes from canonical main. It does not include new JW Stone receiving or cart features. No feature branch or main was changed to prepare it, and this record is not production approval.

## Exact inputs and ancestry

| Input | Published commit | Tree | Review |
| --- | --- | --- | --- |
| Main | `e34f02520c697ee8e52fefcf6ebdd4d06ce6d6c2` | `3c31e5c578d332cf8c9315661ae38d7fcd3288b2` | Production baseline |
| Core UI | `5b749e714eedf562e0efc77b99fa10fd4ab5dd11` | `b199ffae28b6f094378b1a4e4148d9c4c3b86448` | [PR 658](https://github.com/infotradescout/tradescoutAI/pull/658) |
| Infinity consumer | `63aee2f6e55d27cb82757ed93a99e6d448c9faf7` | `be00a16b7a34f88d6f593542d40c86e972149fc3` | [PR 657](https://github.com/infotradescout/tradescoutAI/pull/657) |
| Exchange batch | `83d188e33e23daff26dac4ffe74c07890192fab4` | `b6a66ce4249bcc452a216d9a343fc80c12ac0006` | [PR 659](https://github.com/infotradescout/tradescoutAI/pull/659) |
| Dependency security | `ebdf03b0edb7834806097f3fc7b091f22591d9d9` | `b4b2885bb5d3b7b98946e4142168b440d2bdd745` | [PR 661](https://github.com/infotradescout/tradescoutAI/pull/661) |

Worktree branch: `platform/weekly-release-proof-20260913`. Local merge sequence: Core `99e82198363f2f331b79787bdbc30623db692487`, consumer `bb5b3518297457b53bd6b92770f570c362e7bac2`, Exchange `5b1a70308696c9745ae8142b2321c7d3b01ba007`, reviewed local security `b7a394e74aa5eb2e02a83496e6e27afcee871f11`, then equivalent published security ancestry `44b6e4aa54cd68454f90363d3fdaf3c802a59242`. The last two have the same product tree, `c258115d2dfaf963aaaddca0ac0f197c96a8ed4d`. Adding this ledger changes the final tree; the final commit and tree must be taken from Git, not inferred from this pre-ledger identifier.

All merges completed without conflicts. Shared sitemap fixes are identical. The only overlapping server owner, `server/routes.ts`, retains both the validated private Exchange import identity restoration and the new bounded multipart upload helper. Public serialization still strips both private import keys. Security manifests and locks are unchanged from the security input; the consumer's provenance extension does not alter the immutable historical receipt allowed by the package-manager guard. No JW-named path differs from main.

## Local verification

- Dependency cleanup and package authority: 9 passed, including immutable receipt boundary tests; lock projection passed with 1,497 package records.
- Fresh clean install with npm 10.8.2: 1,313 packages installed successfully.
- Fresh explicit consumer and integration checks: 189 passed across 32 files. This comprises 173 consumer tests across 30 files, four private Exchange identity/redaction tests, and 12 upload/security tests. The exact commands are below; both test lists were passed to one serial Vitest invocation for the captured local run.
- Full TypeScript (`npm run check`): passed.
- Full production build (`npm run build`): passed with unchanged guards. Baseline JW cold delta was 237,917 raw / 71,843 gzip bytes; the new JW feature lane is not part of that measurement. Server and release bundles passed, with no tracked build changes.
- Native PostgreSQL/browser proof of this combined tree remains unexecuted here: this workspace runs as root, and switching OS groups is not permitted. Prior Core and Exchange hosted passes describe their individual input commits only.

Local logs are `platform-integration-install.log`, `platform-integration-consumer-security.log`, `platform-integration-dependency-guard.log`, `platform-integration-typecheck.log`, and `platform-integration-build.log` in the parent workspace. Tests/build checked the merged product source at local `44b6e4aa54cd68454f90363d3fdaf3c802a59242`; subsequent changes are this ledger and the proof-command failure controls described below. The final combined hosted proof must bind the final published commit, including documentation, rather than reusing these local runs as exact-commit release evidence.

## Proof-command failure control

An actual dependency behavior required a follow-up: the embedded database's asynchronous exit hook calls `process.exit(0)` during `beforeExit`. Setting `process.exitCode = 1` after cleanup cannot reliably preserve a failed CLI verdict. The previous individual Core and Exchange reports passed their actual assertions, but that did not establish safe future failure handling.

The shared `finishProofCli` helper now waits for both output pipes to settle and explicitly exits with the verdict after cleanup and evidence. A failed flush forces failure. Core's outer command records `upgrade-report.json`, requires every intermediate report to pass on the exact HEAD, checks strict release/clean-tree evidence, and captures stage or finalization failures. It also immediately rejects a nonzero imported-stage exit code and any recorded error, cleanup error or finalization error. Independent review reproduced a legacy shell output failure that leaves `passed=true` alongside an error and exit code 1; the outer command now stops before a later database cleanup can erase that signal. Direct strict-release and native-property commands use the helper only when invoked as the main module; imported stages return or throw to the outer command. Exchange independently attempts all six cleanup operations, records cleanup failures, and retries failed evidence after a write error. Terminal console failures also rewrite failed evidence where possible. An unwritable evidence destination still terminates with failure.

Verification: `node --experimental-vm-modules --test scripts/platform-proof-cli.test.mjs` passed all 37 tests. These execute the actual wrapper source with explicit dependency fixtures, including five actual child-process cases with a fixed-zero `beforeExit` hook, a failed strict gate plus throwing cleanup, persistent evidence-write failures, console failures and mixed success/error signals from an imported stage. This tests process-control correctness; it is not a native database/browser acceptance run. Log: `platform-proof-cli-tests.log` in the parent workspace. The shared helper's blob is identical to the separately reviewed JW helper, `1061a384196cac1551219b9f43d50c22d0e650d5`.

The earlier consumer report of 155 tests across 29 suites did not retain its exact command. Do not use that count as a reproducible combined-candidate receipt. The following explicit set covers current tests importing the ten changed callers plus package distribution and the existing shadow adapter.

```sh
VITEST_SERIAL=true DATABASE_URL= TEST_DATABASE_URL= npm run test:run -- \
  client/src/pages/profile-sites/JrsAutoGlassProfileTheme.test.tsx \
  client/src/pages/profile-sites/LocalServiceProfileTheme.test.tsx \
  server/tests/contractor-photo-share.test.ts \
  server/tests/contractor-promo-sharing.test.ts \
  server/tests/handmade-product-share.test.ts \
  server/tests/home-scout-listing-share.test.ts \
  server/tests/infinity-shadow-adapter.test.ts \
  server/tests/infinity-text-package.contract.test.ts \
  server/tests/issa-build-public-discovery.test.ts \
  server/tests/issa-service-discovery-recovery.test.ts \
  server/tests/live-readiness.contract.test.ts \
  server/tests/profile-child-route-publication-parity.behavior.test.ts \
  server/tests/profile-discovery-graph-html.behavior.test.ts \
  server/tests/profile-gallery-share-metadata.test.ts \
  server/tests/profile-offer-share.test.ts \
  server/tests/profile-portfolio-share-metadata.test.ts \
  server/tests/profile-service-offer-share.test.ts \
  server/tests/profile-service-share.test.ts \
  server/tests/project-proof-discovery.contract.test.ts \
  server/tests/public-business-gallery-html.test.ts \
  server/tests/public-business-listing-cards.test.ts \
  server/tests/public-contractor-profile-html.test.ts \
  server/tests/public-helper-profile-html.test.ts \
  server/tests/public-profile-indexnow-reconciliation.test.ts \
  server/tests/public-profile-item-html.test.ts \
  server/tests/public-profile-publishing-provenance.test.ts \
  server/tests/public-profile-service-html.test.ts \
  server/tests/public-profile-social-preview.test.ts \
  server/tests/red-graniti-quarry-discovery.contract.test.ts \
  server/tests/scout-live-readiness-response.test.ts

VITEST_SERIAL=true DATABASE_URL= TEST_DATABASE_URL= npm run test:run -- \
  server/tests/exchange-import-identity.test.ts \
  server/tests/upload-dependency-security.test.ts
```

## Final combined proof sequence

Run against one exact clean published candidate in a non-root Linux x64 proof environment with Node 24 and npm 10.8.2. Prune connected database, payment, email, Drive, and object-provider credentials before execution. Use only the runners' disposable loopback databases, synthetic accounts and local object bytes. Keep output directories outside tracked source. The release coordinator will add the reviewed JW lane to this platform candidate and wire its new receiving route to the canonical multipart helper before running the final sequence.

1. Verify the checkout equals the expected published SHA; use `npm ci --include=dev` with npm 10.8.2 and run the explicit consumer/integration commands above. Run `npm run test:dependency-cleanup`.
2. Set `CORE_UI_PROOF_DIR` to a fresh output directory and run `node scripts/verify-core-ui-upgrade.mjs`. This includes scoped suites, full typecheck/build, actual browser checks, native property editing and the unchanged strict release gate.
3. After Core fully exits and cleans up its database, set `EXCHANGE_BATCH_OUTPUT` to a different fresh directory and run `node scripts/verify-exchange-batch-native.mjs`. The browser installed by Core can be reused. This retains parser/recovery tests, typecheck/build, native migrations, actual upload/reconciliation/privacy browser journeys and a second fresh cluster for its unchanged strict release gate.
4. Run the reviewed JW native receiving/cart proof on the final combined candidate. Its exact command and receiving coverage remain owned by that lane. Do not claim that the older cart-only proof demonstrates receiving publication.
5. Assert all reports' overall `passed` flags and exact `head` values, including Core's aggregate `upgrade-report.json`. Each strict-gate receipt must match the candidate commit and have `mode=release`, `result=pass`, `attestable=true`, `initialDirtyTree=false`, and `dirtyTree=false`. Assert Git still has the same HEAD and a clean tree. Successful hosting alone is not sufficient.

Core, Exchange, and JW native helpers share fixed loopback port 55439. Run them sequentially as separate Node subprocesses with complete cleanup; do not parallelize their database phases or import the outer CLI commands into another runner. Keep each unchanged strict gate even though it repeats some install/build checks. No acceptance step may substitute an invented browser note for an unexecuted journey. The current runners create their browser notes only after their corresponding actual checks pass.

Suggested release preparation order is dependency security, Core UI, consumer, Exchange, then the separately reviewed JW lane. This document authorizes no main merge or production deployment; final approval must refer to the exact combined candidate and its actual evidence.
