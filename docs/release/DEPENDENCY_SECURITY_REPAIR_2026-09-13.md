# Platform dependency security repair

Base: `e34f02520c697ee8e52fefcf6ebdd4d06ce6d6c2`. Branch: `platform/dependency-security-20260913`.

This platform change patches image decoding, multipart request handling and the affected development dependency trees. It preserves the existing upload route authentication, storage, file filters, file-size limits and response handling. No database schema, contact authorization, county routing or trust policy changes are included.

## Changes

| Dependency | Before | After |
| --- | --- | --- |
| Sharp | 0.35.3 | 0.35.4 in both root and runtime manifests/locks |
| Bundled libheif | 1.23.1 | 1.23.2 verified from the installed native module |
| Multer | 2.2.0 locked | 2.3.0; manifest minimum raised to 2.3.0 |
| Vitest and its companion packages | 4.1.10 | 4.1.11 |
| `@humanfs/node`, `@humanfs/core` | 0.16.7, 0.19.1 | 0.16.8, 0.19.2 |
| Browserslist, baseline-browser-mapping | 4.28.1, 2.9.11 | 4.28.9, 2.11.23 and their compatible data dependencies |
| js-yaml | 4.3.1 | 4.3.2 |

The [Sharp advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) concerns untrusted HEIF/AVIF processing in its prebuilt native dependency. Format support is retained. Actual PNG, JPEG, WebP and AVIF bytes are encoded, decoded and resized in the regression suite.

[Multer 2.3.0](https://github.com/expressjs/multer/releases/tag/v2.3.0) repairs crafted-field error handling, asynchronous file-size enforcement and aborted disk-upload cleanup. Its [sparse-array protection](https://github.com/advisories/GHSA-535w-7cp7-47q4) is opt-in: updating the package alone still permits enormous array indexes. The canonical `server/utils/multipartUpload.ts` helper sets `fieldArrayIndexLimit: 1000` for every existing upload owner. Existing route options remain intact. The helper bounds numeric multipart text-field array indexes; it does not change normal file contents or import-row limits.

Seven existing upload owner files now import this helper: main routes, Scoutfitters, admin Scout knowledge, commercial directory, admin job media, Hardrock and worker tasks. No route authorization or handler logic was edited.

Root and runtime locks were generated with the repository's npm 10.8.2 authority, followed by the canonical root lock projection. A shared `vitest.vite: 6.4.3` override retains the existing Vite version while updating Vitest. Its broad supported peer range otherwise led npm into an unrelated Vite 8/devtools peer resolution; no forced or legacy-peer install was used. Runtime dependencies do not acquire Vitest. Sharp remains an explicitly declared runtime external; Multer remains bundled by the existing server build.

The package-manager guard now recognizes one immutable historical external-source receipt. The allowance requires its exact path, LF-normalized SHA256, source repository/revision and byte-identical reproduction record. Only the historical install field is removed from scanning; the original receipt bytes are untouched. Altered receipts, copied commands, current guidance and arbitrary vendor JSON remain checked. Updating that receipt requires a new review of the allowance.

## Executed verification

Environment: Node 24.19.0, Linux x64; npm 10.8.2 for clean installs and lock generation. `TMPDIR` points to a writable workspace directory because this environment has no `/tmp`.

| Check | Result |
| --- | --- |
| Clean root `npm ci --include=dev` | Passed; 1,313 installed packages |
| Clean runtime `npm ci --omit=dev` | Passed; 309 installed packages |
| Root/runtime `npm audit --json` | Both zero vulnerabilities; initial root report contained 9 |
| Root `npm ls --depth=0` | Passed |
| Canonical lock projection | Passed; 1,497 records |
| New actual multipart/native image tests | 12 passed |
| Existing media, upload, image and preview suites including the new cases | 169 passed across 25 suites |
| Minimum-release focused application contracts | 251 passed across 25 suites |
| TypeScript `npm run check` | Passed |
| Full `npm run build` | Passed, including client asset/media boundaries and server/release bundles; no tracked build dirtiness |
| `runtime/smoke-runtime-dependencies.mjs` | Passed with actual native Sharp and the existing dependency smoke |
| `npm run test:dependency-cleanup` | 9 passed, including new historical-receipt boundary regressions |
| Minimum release, runtime boundary and release bundle contracts | 23 passed before the independent package-manager guard correction |
| Discovery performance contracts | 15 passed |
| Law drift, authority gates, Scout response contract and no-Vite-in-production guards | Passed |

The multipart suite sends the upstream crafted overflow through actual HTTP middleware and confirms controlled rejection plus a subsequent healthy response. It also verifies sparse-index rejection, ordinary fields and the exact existing size limit, asynchronous filter rejection, MIME filtering, and a real disk write interrupted by a client abort. The abort assertion observes the actual file stream close and partial-file deletion. No production uploads, provider transactions or external storage writes are performed.

Independent SI Objector review accepted the seven owner import changes, shared helper, root/runtime lock consistency and runtime scope. The reviewer independently reran the 12 new cases and five runtime-boundary contracts, plus actual HTTP index-boundary probes. This is bounded source and local runtime evidence.

The first dependency-contract attempt failed because of the missing default temporary directory; the corrected workspace temporary path resolved it. A separate pre-existing package-manager false positive on the unchanged Infinity receipt was reproduced and repaired without editing historical proof. These are retained as explicit verification history.

## Integration and release boundary

Keep this change in the platform lane and integrate the security prerequisites before the feature release candidates. Each feature candidate must retain these manifests, locks and the canonical upload helper when reconciling its own changes. The independent JW receiving branch introduces `server/routes/jw-stone-receiving.ts`; that new owner must use this helper when integrated. It is not present in this main-based patch, and no JW feature files were copied here.

Repeat the final exact-candidate minimum release proof after integration, including disposable database compatibility and desktop/mobile browser evidence required by `RELEASE_CONTROL.md`. Those checks and production deployment verification have not been performed for this branch. Local audit, native image and build passes are not a production release attestation.

There are no migrations or persistent data changes. The base commit is the source rollback boundary, but reverting the dependency patch would restore the known vulnerabilities; prefer a reviewed fix forward. Production merges, deployment and live build-marker verification remain the release owner's responsibility.
