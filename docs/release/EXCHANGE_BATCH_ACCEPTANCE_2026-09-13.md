# Exchange batch acceptance — 2026-09-13

This branch retains the Exchange CSV/photo import and recovery work from PR #653, combined with `main` at `e34f02520c697ee8e52fefcf6ebdd4d06ce6d6c2` in merge `ec5a024b`. The continuation adds reviewable acceptance runners; it does not claim that browser/native acceptance or a production release has occurred.

## Runner ownership and acceptance order

- `exchange-batch-browser-journey.mjs` operates the production-built page through actual file inputs on desktop and touch. It checks invalid category handling, original single-listing access, photo order and bytes, interrupted uploads, lost successful create responses, reload recovery, changed-file conflicts and viewport containment. Lazy thumbnails are scrolled into view and decoded before checking them.
- `verify-exchange-batch-browser.mjs` uses explicitly synthetic authentication/listing/upload APIs. Its report identifies that limited frontend scope and cannot authorize native acceptance.
- `exchange-batch-workflow-fixture.ts` requires test mode, a loopback URL and the exact disposable database name before importing application owners. It removes inherited provider configuration, disables dotenv loading and schedulers, and uses synthetic accounts, real login/routes and owned local upload directories.
- `verify-exchange-batch-native.mjs` requires a clean exact commit and non-root Linux x64. It checks parser/recovery cases, typecheck/build, fresh native migrations and import uniqueness, actual desktop/touch browser journeys, anonymous/unverified denials, a concurrent duplicate identity and pending-listing privacy. Public browse must return HTTP 200 and its canonical array before privacy can pass.
- Only after those checks succeed does the native runner stop the browser/application fixture, close its database connection and fully stop its PostgreSQL cluster. It then starts a separate clean cluster on the same helper port and runs the unchanged `gate:minimum-release`. The two cluster lifetimes cannot overlap. The browser note names the actual preceding checks and their synthetic scope. Gate evidence must match the exact commit, release mode, passing result, attestable status and clean initial/final source. No `--attest` or external publication operation is invoked.

Commands produce actual exit/log entries and final JSON. A platform, setup, browser or database failure leaves overall `passed: false`; the strict gate remains `not-run` until reached. The existing database helper binds loopback port 55439, so this lane must run exclusively on that port. Its native non-root requirement remains intact.

The branch also includes the independently reviewed sitemap generator correction from `50dc2d12` and its exact 578-byte manifest update from `6c42ffae`, cherry-picked here as `90c40886` and `d9649bd0`. These remove a known cross-day dirty-tree failure without changing the strict gate, route targets, media identities or bundle budgets.

## Executed evidence

| Check | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/exchange-batch-import.test.mjs tests/exchange-batch-recovery.test.mjs` | 63 passed; zero failures/skips |
| `npm run check` | Pass for canonical client/shared/server TypeScript scope |
| `npm run build` after sitemap correction | Pass, including production client/server assets and existing budgets/media guards |
| Three runner JavaScript syntax checks and fixture TypeScript stripping/syntax check | Pass |
| Native runner invocation on source `097a98d0511bc9f69913c23a9e55a7e443c87aed` | Failed at non-root Linux prerequisite; zero native/browser checks and gate not run |
| Source status after build and guarded attempt | Clean |

The fixture is outside the repository's ordinary TypeScript project include list; the canonical typecheck is not represented as full fixture type validation. [Machine-readable evidence and log hashes](evidence/exchange-batch-2026-09-13/validation.json) retain the actual guarded failure report.

## Remaining acceptance

Use a clean checkout of the final candidate in a non-root Linux x64 verification environment with the supported Playwright browser, then run `node scripts/verify-exchange-batch-native.mjs`. The existing fixture creates its own disposable native PostgreSQL and local storage; do not supply connected database or provider credentials. This workspace cannot drop privileges and its available Chromium failed before page creation. Native route/database journeys, browser acceptance, the strict release gate and production storage remain unproved for this candidate.

Independent review accepted the product/recovery owners and four runner files, including the final strict-gate order and evidence assertions. No product route, authorization, moderation or payment rule was changed by this continuation. No external source publication, hosted mutation, production database write, provider operation or customer action occurred.
