# TradeScout recovery and LSS release continuation

## Outcome and authority

The user asked where work stopped, received the saved recovery and LSS checkpoints, and said "do it" to finishing the follow-up integration and verification and completing the already-authorized LSS release. This continues that bounded work in the existing TradeScout application. It does not authorize unrelated product, billing, access-policy, or infrastructure changes.

The primary checkout remains untouched at e979c2a9 with County Map WIP. The root integration checkout is D:/ts-release-recovery-20260908, branch codex/finish-recovery-20260908, initially 85cb2849; current production-source baseline is origin/main 5e6b298c. Prior evidence at 7c60610f remains historical and is not proof of this combined revision.

## Ordered deliverables

1. Active: finish the recovered county request/contact and account-authority loop, including explicit roles, provider-subject sign-in ownership, copy/storage ownership, and canonical platform components. Reconcile current public discovery behavior. Verify login, request creation/reopen, gated contact, denial cases, fresh migrations, and exact-commit release contract before release.
2. LSS: finish the business-first service profile and native optional-service request path, review desktop/mobile renders, update only the authorized saved content, release through the existing PR/Render path, and verify the deployed marker and public result. Prepare independently and refresh against the delivered platform baseline before final release proof.
3. Preserved later work: JW-specific changes stay in a jw-stone branch; County Map, remaining HomeID/release-stack disposition, membership/crawl WIP, dependency PRs, and real external-provider exercises retain their own evidence and ownership. This continuation does not claim whole-portfolio completion.

## Owners, constraints, and evidence

Root owns integration and release sequencing. OAuth and component workers own their existing isolated recovery branches; the LSS worker owns its separate profile candidate. Generated source inventory is regenerated after integration. Existing JW governance files are not the lock for this TradeScout platform slice and are preserved.

Contact remains Intent -> Decision Card -> Contact; visibility never grants access. Counties and Trust/CVS retain canonical owners. No email-only OAuth attachment, privilege inferred from email aliases, or external return redirect is acceptable. Fresh local databases use only loopback PostgreSQL on port 55437 with explicit test-prefixed names; real provider transports remain disabled in local runs.

Acceptance requires current-source type/build and affected tests, full deterministic suite and law/authority guards for the broad recovery, native transaction/schema and desktop/mobile request proof, and the exact clean-commit minimum release gate. Fixed bloat budgets are unchanged; baseline and candidate failures are reported separately. Render auto-deploy remains on; production is proved by the deployed SHA, health/migrations, and changed user paths. No user-facing completion claim precedes that evidence.

## Current-main integration

The sitemap-index conflict contains only generated last-modified dates; current-main September 8 output is retained. The Exchange sitemap test follows current-main public indexability rules, excluding gated Exchange shells. Generic gallery tests keep exact URL assertions so a generic slug cannot falsely match an unrelated completed-project slug. Auto-merged profile, server bootstrap, and gate changes receive independent overlap review and combined tests.

Validation and release results will be appended as observed, with failures and unperformed proof retained.

## Observed integration proof and remaining exact-candidate check

- Current-main merge review found no lost public-discovery registrations, listing authority filters, or release contract tests. The four overlapping discovery suites passed 99 tests.
- Component recovery was committed at 8db97db7 with typecheck and 74 focused tests passing. The new explicit /help-demo base route is owned by the existing platform-shell registry family.
- The native loopback release database applied the complete 139-migration journal and passed independent required-schema verification. Native professional/booking/address transactions, negative schema/lineage cases, and notification/recommendation/privacy preservation passed. These migrations reject ambiguous legacy rows rather than deleting them.
- At 9435af02 the desktop/mobile request walkthrough passed: county 22005 persists, selected recipient receives exactly one recorded in-app delivery, drafts survive authentication, request and cancellation state reopen, and signed-out contact/private-request access is denied. No browser errors, request-server failures or horizontal overflow were observed. See test-results/recovery-request-journey/report.json.
- Full deterministic run at 9435af02: 5,902 passed, 14 failed, 160 skipped (853 files). Three platform assertions were repaired to follow the canonical setupAuth options, explicit role-guard response, and shared business-page metadata. The other 11 failures reproduce by exact test name and first assertion on main 5e6b298c. They concern existing JW presentation, media and layout contracts, not new platform regressions. The separate preserved JW branch 602277cf passes all 68 cases across those eight suites; it is not included or released by this platform slice. Attribution: tmp/verify-tail-20260908/jw-complete-baseline-attribution.json.
- Broader verify stops at fixed bloat counts. Main has 3,975 tracked files / 3,954 unique blobs / 3,148 Docker-context files; candidate 9435af02 has 4,063 / 4,042 / 3,228 against unchanged limits 3,950 / 3,900 / 3,125. Direct Connect and storage are below their monolith caps. All remaining verify audits were executed separately: 20 passed, the help-demo ownership finding was corrected and rechecked, and the affiliate DB spotcheck remains explicitly unrun. Docker-engine proof is unavailable: the local DockerDesktopLinuxEngine named pipe does not exist.
- OAuth independent review found and required repairs for login CSRF state, new-user onboarding/email continuation, and custom-domain cookie/callback origin compatibility. Provider-subject ownership and collision-lock review found no additional bypass. Real external-provider exchange and pool saturation remain outside the local synthetic-provider proof.
- LSS integration at 89f0f9b2 passes 124 focused tests. Its persisted-content update and production release still follow this platform release.

The final release record must name the final commit and attach its clean minimum-release gate, final affected/native/browser proofs and exact deployment marker. The generated index excludes only untracked tmp and test-results proof directories, verified to contain no tracked files, so compiled preview dependencies are not misrepresented as application owners. Existing 11 source-index findings and five warnings remain explicit.

Final OAuth integration ae77b4aa passed all 36 native HTTP scenarios and the repeated authenticated desktop/mobile county-request walkthrough. Authority, trust-leak, law-drift and production-readiness guards passed. Independent migration review then found that 0133 assigned homeowner to unrelated role-null accounts. The unreleased migration now preserves their unselected role while retaining approved professional grants and the existing revocation policy. Nine native fixtures execute the actual SQL and verify unfinished, unrelated, pending, rejected, inactive-approved, approved and revoked accounts, with all fixtures and DDL rolled back. The fresh local r3 database applied all 139 migrations and passed required-schema verification; the native schema suite passed with those additional cases. The ae77b4aa release gate/full run was stopped and superseded before release; final exact-commit evidence must be rerun after this fix. No production data was changed during this review.
