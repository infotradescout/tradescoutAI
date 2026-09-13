# Weekly platform and JW receiving integration

This JW lane combines published receiving candidate `c460004ee757037e6ec2e2d4dc5a10f7578292ec` with reviewed platform candidate `3c0bd84ac0d35f7aec7bece4186346db260b01fd` (PR #662). The platform parent contains Core UI #658, Infinity consumer #657, Exchange #659 and dependency security #661. Their published ancestry is preserved.

The original product merge had no textual conflicts. The later HomeID formatting overlap was resolved to the exact published platform file. Normal commit hooks formatted existing input files; each was checked against the configured formatter applied to the original merged blob, with no unexplained changes. The platform parent also contains an equivalent HomeID if/else cleanup required by its lint rule. Its only additional product change routes JW receiving uploads through the platform's shared multipart owner. This preserves memory storage, photo limits, filters and existing authentication while enforcing the reviewed field-array index limit with patched Multer. Platform manifests, locks and security helpers remain authoritative; no JW feature files were added to the platform branch.

The account-to-receiving handoff, immutable photo draft and receipt retry, private Drive boundary, sanitized public media, employee authorization and existing quote cart retain the reviewed receiving implementation. Receiving remains disabled by default.

## Exact combined proof

`scripts/verify-weekly-integrated-release.mjs` requires a full published commit SHA. It verifies the executed launcher bytes and canonical Git object, creates a fresh clean checkout, and uses an isolated environment with the reviewed npm version. The hosted build uses `npx --yes --package=npm@10.8.2 -- node scripts/verify-weekly-integrated-release.mjs --commit="$RENDER_GIT_COMMIT"` with Node 24 and a 4096 MiB Node heap.

The proof runs the explicit consumer, private Exchange identity and multipart suites, dependency contracts and native CLI failure regressions. It executes JW receiving first, followed by Core and Exchange, so the remaining receiving acceptance failure surfaces early. All wrappers run sequentially because their native PostgreSQL helpers share port 55439. Release order remains platform before JW. Each wrapper retains its unchanged strict release gate. Every gate must identify the same commit, contain all 16 passing steps, be attestable in release mode, and begin and finish with clean source. Both receiving device receipts and every original-photo/publication assertion are mandatory. Final root and runtime dependency audits must report zero advisories.

Only verified, sanitized evidence is published after all checks and temporary-resource cleanup succeed. A failed subprocess, missing receipt, mismatched source, skipped gate, cleanup failure or report-writing error must fail the proof. A historical pass from an input branch does not establish acceptance of this combined candidate.

## Release order and acceptance boundary

1. Finish the exact combined hosted proof and attach its immutable commit/tree bindings to PR #662 and the stacked JW PR #660.
2. Obtain the repository's required owner release GO. Main auto-deploys production; isolated-proof authorization does not approve this step.
3. Release the reviewed platform parent through PR #662, then the reviewed JW layer through PR #660. Verify the deployed source identity and the existing public health, asset and customer paths after each release.
4. Keep receiving disabled until the intended staff identities, actual private Drive folder permissions and physical-phone sign-in, camera, retry and member-review journey are accepted.

The isolated fixture uses synthetic identities, native PostgreSQL, real browser IndexedDB/file input and real image processing. Its Drive transport is an exact-URL simulation. No real staff grants, customer inventory edits, provider uploads, payments, inventory reservations or delivery promises are authorized or proved by this receipt.

Current executed results belong in the PR evidence and exact-source hosted summary. This runbook defines the required checks; it does not claim they passed merely because the scripts exist.
