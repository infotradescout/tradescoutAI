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
3. **Live request navigation fails.** From the live finder, “Start a Tangipahoa request” opens the Businesses directory. Clicking “Start request” changes the address to `/direct-connect` but leaves that directory visible. Draft PR #574 already owns the query-navigation repair; its existence does not make the live journey repaired.
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

The 513 remote branches and 21 open pull requests observed include overlapping recovery, comparison, diagnostic, partner, and dependency work. They are not 513 independent defects. Current repairs remain in the existing recovery owner, while discovery-entry repair remains owned by draft PR #574. A draft or merged commit is not live-behavior evidence.

## Repairs and remaining product work

| Area | Evidence and decision | Completion standard |
| --- | --- | --- |
| Source integrity | Reconstruct the corrupted recovery route suffix from its exact valid parent; retain extracted owners. | TypeScript and production build pass on the saved source tree. |
| Account authority | Bind the effective target before feature routers; trusted-device sign-in cannot replace an authenticated account; repeated guards restore the binding. | Actual middleware denies stale/missing targets and preserves principal/effective separation. |
| Session escape | Limit the discovery router's guard to its own eight endpoints so it cannot intercept unrelated admin exits. | All canonical exits work for valid, deleted, and inactive targets; every tool endpoint remains guarded. |
| Verification exceptions | Remove stale impersonation-role fallback; preserve normal persisted administrator behavior. | Current target authority governs account flows; impersonation grants no administrative exception. |
| Test ownership | Follow moved HomeID, Direct Connect operation, and imported-owner projection implementations; correct asynchronous fixtures. | Full suite is reported with failures and skips; source-string checks are never represented as browser or database proof. |
| Public request entry | Live finder/request navigation fails; existing PR #574 owns the query parsing and query-only navigation fix. | A person can go from county/service discovery to the request composer and recover their draft after sign-in. |
| Public UI | Homepage measurement shows excessive depth and competing entry wording; no mobile verdict is claimed. | One obvious primary action, concise explanation, consistent request labels, usable keyboard/focus/error states, and verified narrow-screen flows. |
| Product intent | Root SI contract is a partner-specific snapshot, not whole-product authority. | A current product-level contract governs shared rules; partner-specific variations stay within their owners. |
| Database and live readiness | No disposable test database was supplied. Native PostgreSQL 18.4 runs its version probe, but this runtime rejects both changing scratch-data ownership and starting an unprivileged subprocess (`EINVAL`). | Use an authorized disposable native PostgreSQL environment for transaction, concurrent lock, migration, session persistence, and authenticated application proof. Do not replace it with a source-string pass or production data. |

Recovery order is shared authority and persisted data, then county-to-request-to-response journeys, then UI consistency and remaining feature owners. This preserves existing capabilities while repairing the decisions they share. Release 3, merging main, and deployment remain held until the required earlier proof is complete.

## Current intent that must survive recovery

Thomas's approved September 4 convergence standard makes historical implementation evidence, not permanent authority. This audit preserves historical, current, product, and future truth separately.

- Direct Connect submission grants permission to send the sender's name and phone to the receiving business. Recovery must preserve that explicit request handoff and avoid premature unrelated disclosure.
- Administrative manual profile onboarding retains its explicit administrative exception to normal verification requirements. It must not depend on promoting an email alias or borrowing a stale impersonation role.
- JW Stone member prices belong to eligible member businesses, TradeScout administrators, and JW Stone owners. The designated Google Drive source governs future prices, images, and supplied information; old "remove all prices" notes are not current global policy.
- Realtor and car-sales lanes remain active closed-beta work. No capability is declared abandoned merely because its older branch was closed.
- No lead selling, pay-per-lead, or pay-to-play is introduced. SMS and postcards are not presented as operational while their setup remains incomplete.
- Infinity is the ecosystem register. Dormant Screen Pass and AI-camera scope belong to Continuum; unrelated products are not absorbed into TradeScout during this repair.

These are acceptance constraints for the remaining journeys, not claims that each has been newly implemented or proved in this pass.

## Verification corrections and limits

The saved account-authority checkpoint `9c1394e1d2b9a3397d3de1c3768bc116790dd08a` completed the serialized `verify:local` chain: 773 test files passed, 26 skipped; 5,278 tests passed, 142 skipped. TypeScript and the production client/server build also passed. The prior default parallel run failed before a complete report, with two timeout failures; using the repository's supported `VITEST_SERIAL=true` mode completed the same suite. Skipped tests remain unproved.

Additional required audits found four raw error-message expressions across three Admin pages. Those now use the existing user-facing error formatter. The shell verifier also confused a physical-room data type and a lower-camel-case geometry predicate with React page components. Its component-export rule now targets PascalCase runtime values; regression fixtures still reject misplaced components, inter-shell imports, and the legacy Community shell. Domain geometry is not renamed merely to satisfy an unrelated layout heuristic.

Guard labels have narrow meanings. `audit:trust-leaks` searches four unfinished-copy phrases; it is not a contact-data leakage proof. `audit:production-debt` checks one in-memory-storage comment marker; it is not a whole-product debt assessment. Build generation also refreshes the tracked sitemap index's date. That generated-only working-tree difference is recorded and restored before saving source; it is not silently included in a repair checkpoint.

All four database-backed commands exited 2 without a disposable `TEST_DATABASE_URL`: `test:run:db:strict`, `test:run:no-skips`, `verify:db`, and `test:release-gates:local`. A native PostgreSQL installation was attempted only in scratch and could not initialize an unprivileged process in this runtime. No production database was substituted. Latest saved-head proof and any remaining gates are recorded in [draft PR #561](https://github.com/infotradescout/tradescoutAI/pull/561).

## Standards used for acceptance

Use [WCAG 2.2](https://www.w3.org/TR/WCAG22/) for accessible interaction and [consistent navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html), and [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) for authentication, authorization, session, and data-protection acceptance. These are criteria for verification, not a claim of certification or a completed accessibility/security audit.

## Release boundary

Keep the existing recovery pull request draft. No merge to main, deployment, production data, new hosting service, or GitHub Actions gate. Compile, build, database, behavior, browser, and live proof are separate states; any incomplete state stays explicit.
