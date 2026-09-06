# TradeScout recovery truth — September 5, 2026

Authority: Thomas's request to trace the system from its creation and recover a coherent, usable product against current intent. This is an evidence record, not approval to release.

## Scope observed

- Full available Git history and remote references fetched: 5,469 commits across 513 remote branches; 4,126 commits reachable from main at inspection.
- Main contains two initial histories, August 10, 2025 and December 3, 2025. Repository creation metadata alone does not describe the product's start.
- Recovery starts from `641052d772b1ab2e2dd5fa1dcbd1a78aa9ccba7c`; the existing Release 2 source is `0a72863b7285248a92df360c0da1624e26dfce5a`.
- Main inspected at `1db99fb635d04dddb0103266e14c354474ea7369`.
- 3,326 tracked text files scanned for UTF-8 validity. This is coverage of encoding and metadata, not a claim that every line or journey has been semantically verified.
- Live anonymous browser inspection covers the homepage, business finder, and request entry. No customer request or business contact was submitted.

## Confirmed compounded failures

1. **Corrupted saved recovery source.** The September 2 route-extraction commit `a562dd3e51eadf70226d514853f23229eae86dc3` changes `server/routes.ts` into invalid binary data at byte 393,216. The same blob survives at the required recovery starting head. TypeScript reports TS1490 (binary file), TS1128, and TS1005. The apparent loss of about 17,000 readable lines is not evidence that those routes were successfully extracted.
2. **Checks missed the broken application.** Fourteen focused identity tests passed while the complete TypeScript check failed to read that routing file. Source-string contracts alone cannot prove a working application.
3. **Request navigation regressed, then improved in the public recheck.** During the initial inspection, the live finder's “Start a Tangipahoa request” opens the Businesses directory, and “Start request” changes the address while leaving that directory visible. A final GitHub status check shows PR #574 merged at `2026-09-05T16:30:25Z`, merge commit `704cf4c7426730877c5d77cafbe5141d022fc92d`. A fresh anonymous browser navigation to the same county request URL now opens “What do you need?”; “Open directory” followed by “Start request” also returns to that composer. This closes those two observed public navigation failures. It does not prove sign-in recovery, submission, persistence, recipient delivery, or this recovery branch's browser behavior.
4. **Public entry demands extensive reading.** At a 1,363 × 936 desktop viewport, the homepage had 6,876 whitespace-delimited words, 221 heading elements, and 40,574 CSS pixels of document height. These are measurements, not a mobile usability verdict. The primary labels also vary between “Make A Request” and “Start request.”
5. **Shared intent record is scoped to one partner feature.** The repository-root Selective Intelligence intent contract identifies “JW Stone 2.0” and an August 15 planner release. That file cannot govern whole-TradeScout recovery or supersede Thomas's later pricing/source/contact decisions.
6. **Permission integration has additional interactions.** Independent execution of the real middleware with synthetic users reproduced trusted-device replacement of the effective target, an admin router intercepting impersonation exits, and a profile-account bypass using a stale session role. The repaired middleware now has executable regression coverage. Independent re-review reached the actual exit handlers and confirmed all three reproduced paths are closed with synthetic providers; database persistence and browser behavior remain separate proof.

## Recovery of the corrupted source

The surviving route prefix was compared with the exact pre-corruption parent. Its intentional changes import three extracted owners and remove the local lead-routing helper. The unreadable suffix is recovered from that same parent, with the existing extracted Admin controls and business-owner projection retained as their sole implementations. The Admin-control body is compared exactly before replacing it with its registration. The local import projection is replaced with its existing extracted service, passing the previously captured context explicitly.

This is reconstruction of damaged source against the actual extraction artifacts. The older Release 2 route file is not copied over Release 0. Direct Connect, professional application storage, schema, lead routing, and Admin owner extractions remain in place. No feature is discarded to make the routing file appear smaller. Further route decomposition remains separate work.

## Historical scale and how the debt compounded

These are snapshots from commits reachable from the inspected main, selected with `git log -1 --before=<cutoff> origin/main`. Counts describe tracked files, not delivered features or product quality. Test-file counts are names containing `.test.` or `.spec.`; they do not assert execution or coverage.

| Snapshot | Commit | Tracked files | TS/TSX files | Test filenames | Main route lines | Storage lines |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 2025-08-31 | `d204018e2372` | 560 | 395 | 0 | 8,044 | 6,219 |
| 2025-12-31 | `4b21bf784800` | 1,667 | 787 | 32 | 13,280 | 10,125 |
| 2026-03-31 | `6bbabf8583b7` | 2,421 | 1,276 | 160 | 27,895 | 14,085 |
| 2026-06-30 | `244a11dde5d1` | 4,369 | 2,858 | 474 | 27,128 | 13,554 |
| 2026-08-31 | `0a72863b7285` | 3,855 | 2,398 | 805 | 26,688 | 9,075 |
| 2026-09-05 | `1db99fb635d0` | 3,902 | 2,438 | 823 | 26,690 | 9,075 |

The August 2025 snapshot already has a large shared route and storage surface. By March 2026, the main route file exceeds 27,000 lines. Later extraction reduces storage and file counts, while the route surface remains large. This is evidence of concentrated ownership and later cleanup, not evidence that every extraction was correct or every feature was used.

The verification exception history is concrete: February 21 commit `a066a274` adds automatic staff/admin verification; March 8 commits `8c505ac4` and `0ed0f8a9` extend alias handling; August 22 commit `ff0674ac` attempts to scope impersonation bypass but continues trusting a saved session role. The independent September 5 reproduction shows why that last correction was incomplete: the target's current persisted authority and the session's older role can disagree. Recovery binds one effective account per request and makes administrative verification exceptions unavailable during impersonation.

The first complete non-database run on the reconstructed working tree collected 5,413 tests across 799 files: 5,247 passed, 24 failed, and 142 were skipped. Of the 24 failed assertions, 20 searched moved implementations or old import/response/guard text; four called asynchronous identity middleware without awaiting it or supplied an identity with no ID. Existing contracts were updated to the actual extracted owners, and middleware fixtures now use complete account identities and await the result. No failing product behavior was made acceptable by changing its expected permission decision.

The 513 remote branches and 21 open pull requests in the initial snapshot include overlapping recovery, comparison, diagnostic, partner, and dependency work. They are not 513 independent defects. Current repairs remain in the existing recovery owner. Discovery-entry PR #574 subsequently showed as merged in the final status check; its refreshed public behavior is recorded separately above. A draft or merged commit alone is not live-behavior evidence.

## Repairs and remaining product work

| Area | Evidence and decision | Completion standard |
| --- | --- | --- |
| Source integrity | Reconstruct the corrupted recovery route suffix from its exact valid parent; retain extracted owners. | TypeScript and production build pass on the saved source tree. |
| Account authority | Bind the effective target before feature routers; trusted-device sign-in cannot replace an authenticated account; repeated guards restore the binding. | Actual middleware denies stale/missing targets and preserves principal/effective separation. |
| Session escape | Limit the discovery router's guard to its own eight endpoints so it cannot intercept unrelated admin exits. | All canonical exits work for valid, deleted, and inactive targets; every tool endpoint remains guarded. |
| Verification exceptions | Remove stale impersonation-role fallback; preserve normal persisted administrator behavior. | Current target authority governs account flows; impersonation grants no administrative exception. |
| Test ownership | Follow moved HomeID, Direct Connect operation, and imported-owner projection implementations; correct asynchronous fixtures. | Full suite is reported with failures and skips; source-string checks are never represented as browser or database proof. |
| Public request entry | Initial navigation failed. PR #574 is now merged; a fresh anonymous recheck opens the composer from the county URL and from the directory's “Start request” action. | Complete the county/service-to-request journey, including draft recovery after sign-in, submission, and receiving-business delivery. The public navigation check covers only the entry portion. |
| Public UI | Homepage measurement shows excessive depth and competing entry wording; no mobile verdict is claimed. | One obvious primary action, concise explanation, consistent request labels, usable keyboard/focus/error states, and verified narrow-screen flows. |
| Product intent | Root SI contract is a partner-specific snapshot, not whole-product authority. | A current product-level contract governs shared rules; partner-specific variations stay within their owners. |
| Database and live readiness | No disposable `TEST_DATABASE_URL` is available. Native PostgreSQL 18.4 runs its version probe, but this runtime rejects both changing scratch-data ownership and starting an unprivileged subprocess (`EINVAL`). A read-only connection probe to an existing Neon migration-proof database also fails DNS resolution (`EAI_AGAIN`). | Use an authorized, reachable disposable native PostgreSQL environment for transaction, concurrent lock, migration, session persistence, and authenticated application proof. Do not replace it with a source-string pass or production data. |

Recovery order is shared authority and persisted data, then county-to-request-to-response journeys, then UI consistency and remaining feature owners. This preserves existing capabilities while repairing the decisions they share. Release 3, merging main, and deployment remain held until the required earlier proof is complete.

## Current intent that must survive recovery

Thomas's approved September 4 convergence standard makes historical implementation evidence, not permanent authority. This audit preserves historical, current, product, and future truth separately.

Law classification for the acceptance constraints below: **policy_target**. Their inclusion records current intent; it does not assert that every corresponding behavior has been verified.

- Direct Connect submission grants permission to send the sender's name and phone to the receiving business. Recovery must preserve that explicit request handoff and avoid premature unrelated disclosure.
- Administrative manual profile onboarding retains its explicit administrative exception to normal verification requirements. It must not depend on promoting an email alias or borrowing a stale impersonation role.
- JW Stone member prices belong to eligible member businesses, TradeScout administrators, and JW Stone owners. The designated Google Drive source governs future prices, images, and supplied information; old "remove all prices" notes are not current global policy.
- Realtor and car-sales lanes remain active closed-beta work. No capability is declared abandoned merely because its older branch was closed.
- No lead selling, pay-per-lead, or pay-to-play is introduced. SMS and postcards are not presented as operational while their setup remains incomplete.
- Infinity is the ecosystem register. Dormant Screen Pass and AI-camera scope belong to Continuum; unrelated products are not absorbed into TradeScout during this repair.

These are acceptance constraints for the remaining journeys, not claims that each has been newly implemented or proved in this pass.

## Verification corrections and limits

The saved account-authority checkpoint `9c1394e1d2b9a3397d3de1c3768bc116790dd08a` completed the serialized `verify:local` chain: 773 test files passed, 26 skipped; 5,278 tests passed, 142 skipped. TypeScript and the production client/server build also passed. The prior default parallel run failed before a complete report, with two timeout failures; using the repository's supported `VITEST_SERIAL=true` mode completed the same suite. Skipped tests remain unproved.

Additional required audits found four raw error-message expressions across three Admin pages. Those now use the existing user-facing error formatter. Checkpoint `bb6ee2d27accc8d589f6eedf45ada91928ebf79b` completed the serialized local suite with 774 files passed, 26 skipped; 5,286 tests passed, 142 skipped.

The shell verifier confused a physical-room data type and a lower-camel-case geometry predicate with React page components. Its component-export rule now targets PascalCase runtime values, including default and async exports. That stronger detection also exposed two pre-existing feature workspace owners: `pages/admin.tsx` / `AdminShell` and `pages/direct-connect/DirectConnectShell.tsx` / `DirectConnectShell`. `AppRoutes.tsx` already mounts both inside the shared global `AppShell`. The verifier now recognizes those exact path/name pairs. Fourteen behavior fixtures preserve rejection of misplaced copies, wrong export names, inter-shell imports, and the legacy Community shell. No feature layout was moved or redesigned to satisfy a filename heuristic.

## Bounded dependency correction

The automatic approval review rejected `npm audit --omit=dev --json` because it would upload the dependency inventory to the npm registry. The alternative downloaded the public GitHub-reviewed advisory database and compared versions locally; it did not upload that inventory. The source snapshot is [`6d3aba94b45563b2202a6f7bfa7223bfa46bf3f9`](https://github.com/github/advisory-database/commit/6d3aba94b45563b2202a6f7bfa7223bfa46bf3f9). The comparison checks published npm version ranges, excludes withdrawn advisories and development-only entries, and verifies its version-boundary logic against a known vulnerable/fixed package pair.

Five known advisory matches across four package families were corrected:

| Package | Version correction | Advisory and observed use |
| --- | --- | --- |
| `postcss-selector-parser` | Two copies: 6.1.2 → 6.1.4 | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92): build-time Tailwind/PostCSS dependency. Typography's separate exact 6.0.10 pin is outside the affected range and remains unchanged. |
| `fflate` | 0.8.2 → 0.8.3 | [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98): malformed ZIP64 decompression. The inspected client jsPDF path uses compression, so the version match alone does not prove an exploitable application path. |
| `@xmldom/xmldom` | 0.8.14 → 0.8.15; development copy 0.9.10 → 0.9.12 | [GHSA-6gmq-8vp8-gcm6](https://github.com/advisories/GHSA-6gmq-8vp8-gcm6): entity-reference serialization. Inspected server usage is Mammoth DOCX parsing; no application entity-reference serialization was found. Independent review identified the separate development copy as affected too, so it was also patched within its parent range. |
| `qs` | 6.15.3 → 6.16.0 in root and runtime locks | [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) and [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx): request parsing and Stripe form serialization. Express/body-parser's minor-range restriction requires matching explicit root/runtime overrides. The application's parser does not enable the advisory's `comma` option. |

The patch updates fit their existing parent ranges. The `qs` minor update has six behavior checks using actual Express parsers and the public Stripe client with a synthetic transport: repeated/bracketed filters, encoded sender identity, nested/indexed fields, literal commas, prototype safety, and Stripe form encoding. These checks pass without contacting Stripe or creating a payment. Root and runtime locked installs, runtime smoke, and runtime-boundary contracts pass. This is a bounded known-advisory correction, not proof that the application has no security defects. Final saved-head comparison and verification results belong in PR #561.

The dependency-manager contract also flagged two closed-PR explanations as commands. Those explanations now name the actual retired `pnpm-lock.yaml` file explicitly; their historical disposition and npm-only authority remain the same. The existing command guard is unchanged.

## Completed code-checkpoint proof

Saved code checkpoint: `5f2d722a43feb838a5a7f3983ff7bf6101f60c1c`, tree `bfff69bb31de14188d218f8748089eaf9b83c733`. Its local and remote objects match, and the working tree was clean before and after verification. This final evidence correction changes only this audit document; it does not relabel the earlier full-suite execution as a new execution on the audit-only child commit.

| Command or check | Result at the saved code checkpoint |
| --- | --- |
| `VITEST_SERIAL=true npm run verify:local` | Exit 0. Production build and local guards pass. 775 files passed, 26 skipped; **5,298 tests passed, 142 skipped**. |
| `npm run gate:minimum-release` | Exit 2. Clean locked install, readiness/release contracts, TypeScript, production build, 160 relevant tests, and discovery-performance contracts pass. Execution stops at missing disposable database proof; browser and later stages do not execute. |
| Runtime locked install and dependency smoke | Both exit 0, including native bcrypt/sharp and the Drizzle CLI check. |
| `npm run test:dependency-cleanup` | Exit 0; all eight contracts pass. |
| Additional audits and guards | All ten exit 0: trust-copy markers, user-facing errors, production-debt marker, legacy guard, Scout purity, shell ownership, city branding, brand scope, Admin aliases, and identity-authority spine. Their individual scopes remain narrow. |
| Four database-backed commands listed below | Each exits 2 at the missing-test-database preflight. No database proof is counted as passed. |
| Local public-advisory comparison | Zero scoped version matches and zero unclassified ranges across 956 non-development root package versions and 385 runtime package versions, against the recorded GitHub-reviewed snapshot. Development-only entries are excluded; this is not an application-security certification. |

Dependency installation disables npm's inventory-upload audit (`npm_config_audit=false`); the separate public-advisory comparison runs locally. The 142 skipped tests remain unproved. The follow-up document commit's minimum-release result and exact final head are recorded in PR #561.

Guard labels have narrow meanings. `audit:trust-leaks` searches four unfinished-copy phrases; it is not a contact-data leakage proof. `audit:production-debt` checks one in-memory-storage comment marker; it is not a whole-product debt assessment. Build generation also refreshes the tracked sitemap index's date. That generated-only working-tree difference is recorded and restored before saving source; it is not silently included in a repair checkpoint.

All four database-backed commands exited 2 without a disposable `TEST_DATABASE_URL`: `test:run:db:strict`, `test:run:no-skips`, `verify:db`, and `test:release-gates:local`. The local minimum gate also fails for missing authenticated browser proof. Native PostgreSQL initialization and the existing remote migration-proof endpoint were both investigated; neither provides a usable application database in this runtime. No database, hosting service, or production data was created or modified. Latest saved-head proof and any remaining gates are recorded in [draft PR #561](https://github.com/infotradescout/tradescoutAI/pull/561).

## Standards used for acceptance

Use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessible interaction and [consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), and [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) for authentication, authorization, session, and data-protection acceptance. These are criteria for verification, not a claim of certification or a completed accessibility/security audit.

## Release boundary

Keep the existing recovery pull request draft. No merge to main, deployment, production data, new hosting service, or GitHub Actions gate. Compile, build, database, behavior, browser, and live proof are separate states; any incomplete state stays explicit.


## September 6 continuation: request recovery and submission contact

The test setup now accepts only a dedicated disposable test connection or dedicated test-server admin connection. It no longer borrows `DATABASE_URL`, prints the connection URL, or replaces unrelated `.env.test` settings. Test database creation requires a recognizable disposable database name and explicit remote creation opt-in. An independent review reproduced the PostgreSQL query-host override bypass; creation and full-sync checks now reject alternate query representations of the connection target. Twenty-four focused filesystem/driver-boundary checks passed; these are not native database proof.

Request composer behavior now preserves user edits and deletions ahead of the original prefill, separates county/state/account contexts, retains selected recipients, and copies guest handoffs into authenticated storage before consuming them. Missing profile details open the actual profile settings with a saved return path. Those settings collect name, phone, state, and county. The profile update handler preserves omitted canonical location fields instead of clearing them. Verification navigation retains the request return path; an unknown HTTP 428 is no longer treated as address verification. Profile-business links use the supported profile recipient; legacy owner-only links require an explicit business selection.

New ordinary and Express submissions capture a server-authored name/phone receipt in the created event and bind its availability to the actual assigned recipient. The guarded contact endpoint checks request identity, requester/event identity, immutable recipient binding, canonical contractor/worker ownership, receipt format, and active states. It returns the captured name and phone, without changing general conversation or public-profile contact gates. Existing requests without the new receipt keep their prior authority handling; malformed present receipts cannot fall back. Express business email uses the committed contact snapshot and the server-resolved notification address. No real email or customer request was sent during verification.

A board volunteer does not gain sender contact merely by volunteering. Explicit selection by the requester now upgrades an eligible active existing assignment atomically, preserving its metadata and rejecting conflicting bindings. The owner check also runs before the routing endpoint's idempotent response.

Independent source review found no receipt leakage in the inspected inbox, admin detail, dispatch timeline, HomeID, or ecosystem-summary projections. Tests execute the actual React forms, actual profile update handler, and server authority owner with controlled API/storage boundaries. Native transactions, concurrency, database persistence, real delivery, and authenticated browser operation remain distinct unexecuted proof. No schema migration is required; the new receipt/binding use the existing event metadata and assignment score snapshot.

The local UI preview could not run: Vite failed in this runtime's network-interface discovery (`uv_interface_addresses`), and the browser rejected the local preview address (`ERR_BLOCKED_BY_CLIENT`). A DOM component test is not counted as visual browser proof. The remote disposable database remains unreachable through the supplied connection paths; no production data, hosting service, or database was modified.

Further confirmed verification debt remains outside this saved request/contact repair: the legacy address page recommends postcards, and the postcard endpoint generates/logs a code and claims dispatch without a mailing integration. Document submission also needs a complete private upload/review path and server-owned validation fields. Those are unresolved product failures, not operational verification services or completed recovery proof.

The code checkpoint and fresh executable results are recorded in draft PR #561. Release 0+2 stays held for the missing native database and browser proof; Release 3, main merge, and deployment remain held.
