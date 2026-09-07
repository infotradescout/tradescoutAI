# Outstanding TradeScout recovery

User outcome: finish outstanding work, preserving existing work in progress. TradeScout is the active repository; portfolio breadth was asked as an optional clarification and has not been answered. This deliverable reconciles the interrupted Release 0+2 candidate with current TradeScout main and proves the resulting county/request/profile behavior. It does not close separate portfolio or JW product work.

## Source and authority

- Starting main: `64e99ca14db7553494265f7f1d8d3257ae0e3b86`.
- Main advanced by one landing-metadata commit during recovery: `a531323772cebd57ea49694a29a5b9c0fbd83031`; include it before final release verification.
- Recovery source: `cabb75c8fc14fc1d522f1f50594edfbba7af69cd`.
- Isolated working branch: `integration/outstanding-recovery-20260907`, `D:/ts-outstanding-20260907`.
- Primary dirty County Map checkout and interrupted `D:/ts-weekly-20260906` remain untouched.
- Current user authorizes implementation and verification. Existing push/draft-PR preference applies to verified in-scope work. Main merge is a production release requiring its existing release decision.
- TradeScout contact, identity, trust and county laws remain authoritative. Current explicitly approved business contact exceptions must survive integration; ordinary visibility must not grant private contact.

## Active deliverable and proof

Reconcile current production and recovery without silently dropping features, then run type/build/contracts, native disposable schema proof, and authenticated desktop/mobile request recovery and address paths. Passing local checks is not release or production proof. Preserve new failure evidence and fix underlying defects, not test expectations that protect required behavior.

Canonical reuse: existing Direct Connect shell and authority/operations modules; profile visibility and provisioning owners; existing schema verifier and subprocess runner. No replacement product or parallel runtime is introduced. Generated project-index duplicate-owner findings are existing architecture leads; this integration cannot claim complete architectural consolidation.

## Integration decisions

- New recovery migrations are renamed to 0132, 0133 and 0134 and appended after all released journal entries. SQL bodies and schema markers retain their original identity; later timestamps prevent Drizzle from skipping them behind production's watermark.
- Current public discovery/ISSA/Onyx routes and approved business contact policy are retained. Separate active presentation/discovery PRs #599 and #611 remain independently owned.
- Recovered drafts retain deliberate edits, deletions, skipped HomeID context and alternative home choices.
- Existing profile provisioner updates omit release/status fields, preserving concurrent revocation; already-authorized new seeds write the canonical release column.
- Native executable dispatch on Windows keeps executable/argument arrays intact so a spaced Node path can run independent verification.
- Native journal replay exposed missing notification, contractor-recommendation and account-privacy schema used by existing request and login paths. Append-only migration 0135 restores the current runtime definitions without re-stamping older SQL or resetting stored preferences.
- Actual browser tests found and repaired missing default county in the request composer, a stale post-login onboarding redirect, and an admin address-review select displayed beneath its modal.
- Native concurrent professional submission exposed Drizzle's wrapped PostgreSQL errors. Duplicate-user handling now reads the actual error cause while unrelated constraints still fail.
- Private runtime uploads are excluded from Git. The test-environment writer preserves existing settings on failure and creates private files with POSIX 0600 or a verified Windows owner-only DACL before writing connection data.

## Address workflow browser evidence

Against the separately migrated `tradescout_test_browser_20260907` database and local app on `127.0.0.1:5199`, a synthetic ordinary homeowner signed in through the actual UI and uploaded a clearly labeled local-test PDF. No network request interception or mocked APIs were used.

- Desktop submission returned 201, saved immutable private evidence, and displayed submitted/unverified.
- Admin rejected with a reason; member reload displayed the rejection and retained the submitted address.
- Mobile 390x844 resubmission returned to submitted state on the same verification record.
- Admin's private-document download returned 200 with a PDF body. The ordinary member received 403 and an unauthenticated request received 401 for that same admin URL.
- Pointer selection after the modal fix and mobile admin approval succeeded. Member reload displayed Address verified.
- Screenshots: `test-results/recovery-address-submitted.png`, `recovery-address-mobile-resubmitted.png`, `recovery-address-review-fixed.png`, `recovery-address-mobile-approved.png`.

This proves the local document-backed path and actual session/authorization boundaries. Remote object storage and production verification were not exercised. Postcard and phone methods correctly remain unavailable.

## Outstanding dependencies beyond this candidate

- Separate profile design #592 and presentation #599; discovery #611.
- Authority/component/OAuth realignment stack #568 through #572; reconcile only after current integration, preserving any overlapping recovery repairs.
- Release 3 / HomeID golden-path stacks and historical diagnostic PR dispositions.
- Primary County Map commit and runtime WIP; large membership, migration and crawl worktrees.
- Four dependency PRs and remaining repository audit findings require current-source disposition.
- Native concurrency, actual storage/email provider delivery, production-specific migration preflights, release and live behavior must not be inferred from unit/synthetic browser proof.

## Pre-freeze validation

- Complete production build and all bundle/media/asset checks passed; typecheck passed.
- Strict integration: 3 files, 31 tests passed, zero skips. Focused integration and controlled suites: 9 files, 149 tests passed, zero skips (34 real database cases and 115 controlled/unit cases).
- Fresh native PostgreSQL database `tradescout_test_native_final_20260907`: all 139 journal migrations and independent required-schema checks passed, then repeat migration passed. No additive test bootstrap was used for this proof.
- Durable native transaction harness: 6 scenarios passed, including actual in-app notification delivery. Contact runtime schema harness: 8 deliberate failures rejected plus preservation/repeat-SQL proof. Recovery schema harness: all 26 deliberate failures rejected, rolled back and reverified, with the released 135-entry prefix unchanged.
- Durable desktop/mobile browser harness passed actual sign-in/draft restoration, county request creation, selected recipient assignment, reload, cancellation/reopening, in-app notification delivery, and signed-out denials. General contact stayed locked. Explicit sender-consented receipt details remain a separate existing authority path.
- Full law/authority/architecture/readiness/sitemap and identity guards passed. Broader audits passed after moving the mobile admin-navigation blur into its existing stylesheet's pseudo-element. Bloat tests pass 9 cases with 5 explicitly reported Windows filesystem limitations; clean-tree bloat enforcement awaits the committed candidate.
- Independent reconciliation review found no blocker in profile-source preservation, forwarding contracts, PostgreSQL wrapped-error handling or migration ordering. The source ownership index reports the same 16 existing duplicate-owner errors and 5 warnings; no claim of portfolio-wide architectural cleanup is made.
- Remaining native observation: the county suite reports an absent `feature_flags` table through an existing fallback. This proof does not establish all optional runtime tables or provider integrations.

Exact final-commit release-gate results and full-suite results belong in generated `artifacts/release-contract/<sha>/` evidence and the pull request. These pre-freeze results do not substitute for that final gate.
