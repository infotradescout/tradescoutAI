# D4 evidence - Jobs role-aware workspace

Date: 2026-08-22

Baseline: `e16deb9fd46d084b77d307e806ef005d2ccb222f`

Status: implementation, integrated browser proof, and focused source proof complete; exact release gate, pull request, and production proof pending.

## Locked outcome

- Jobs is one local employment desk at `/direct-connect/opportunities`, not a duplicate page heading, guidance card, and route-button wall around a generic board.
- A compact list preserves context while one inspector exposes the real next action for an external job, owned post, external resume, or existing application.
- Explicit canonical URL state wins; missing state may restore from user-scoped session storage; stale selection cannot survive a mode, filter, jurisdiction, result, or account change.
- The bottom taskbar, top-right tools, county truth, verification, employment route ownership, and Intent to Decision Card to Contact law remain protected.

## Reuse decision

- Extend `EmploymentBoard` and its current employment/application owners.
- Let the employment section own its workspace presentation inside `DirectConnectShell` while leaving every sibling Direct Connect route intact.
- Add only a bounded Jobs state owner and focused contracts if the refreshed project index confirms no competing canonical owner.
- Reuse `sanitizePublicListingText` and `redactContactDetails` at the existing employment write/response boundaries so public listings and application intent cannot expose contact before the current gated handoff. This is narrow enforcement of existing law: no route, schema, eligibility, migration, or contact owner was added.
- Do not edit the unrelated root JW Stone lock or mirrored `exports/workspaces` tree.

## Proof ledger

- Implemented the single Jobs-owned heading, compact Hiring/Resumes work desk, staged area and filter controls, dense result list, role-aware inspector, progressive mobile list/detail flow, and canonical user-scoped continuity.
- Implemented truthful loading/error states, including fail-closed application status, applicant retry, account-scoped queries/dialogs, and `X-Data-Disabled` handling.
- Removed raw applicant email from the owner response and applied the existing public-listing/contact sanitizers on employment listing and application write/read boundaries.
- Rebased the implementation through current `origin/main` at `ba6fb8966525ddea75a5bd01201eeab976032840`; the intervening JW profile and image-quality changes did not overlap the Jobs implementation. The generated project index was refreshed from the combined tree after reconciliation.
- Project-index doctor retains the repository baseline of 1104 duplicate/competing-owner errors and 5 raw-UI warnings, dominated by mirrored export trees. The initial `e16deb9f`, integrated `origin/main`, and implementation refreshes have the same error/warning counts; this slice added no new index finding and continued to use the traced canonical owners.
- Focused Vitest run passed 6 files / 66 tests and `npm run check` passed on the integrated tree. The added regression preserves explicit URL selection on initial/same-user hydration and clears it when the authenticated user scope changes, even if the same post remains visible. The DB-backed `server/tests/direct-connect-redaction.test.ts` was discovered and correctly skipped without `TEST_DATABASE_URL`; the disposable-DB minimum-release gate remains required.
- Authenticated deterministic browser proof at 1440x1000 showed one Jobs work desk, owned-post Applicants/Close, external Apply, pending application without a duplicate Apply, closed-post no-action, and external-resume Start reply. The bottom taskbar and top-right system tools remained present.
- App-switch proof navigated Jobs -> Businesses -> Jobs and restored the selected owned job at the canonical URL. Reload restored the same valid selection. Area-change proof used the existing state/county selector to move FL/Escambia -> AL/Baldwin; the URL became `?mode=job&state=AL&county=01003`, the old selection cleared, and only the Baldwin fixture remained.
- Mobile proof at 390x844 showed list-first browsing, selected-record detail with Back to results, focus return to the list, the bottom taskbar, and the compact top-right account/tools control. A separate unverified fixture kept Start reply disabled and showed the verification explanation without collision.
- Viewport and full-page captures were both 1440 wide on desktop and 390 wide on mobile, proving no page-level horizontal overflow. State/county options were operable through keyboard Enter, and result rows/actions remained native buttons in the accessibility tree.
- After correcting the proof fixture response shapes and adding an accessible area-dialog description, a fresh browser log window covering Jobs, the area dialog, Businesses, and the return to Jobs contained zero warnings or errors.
- Browser artifacts: `jobs-desktop-1440.png`, `jobs-mobile-390.png`, and `jobs-unverified-mobile-390.png` under the retained Codex visualization workspace `jobs-workspace` directory.
- Removed the ignored Vitest HTML report from the repository inventory by moving it to the retained visualization workspace, then regenerated the project index at 211 directories / 3,663 source files with no `test-results` entry.
- Independent Objector accepted the corrected source implementation and narrowed the remaining hold to exact-current-main rendered proof, disposable-DB/minimum-release proof, and final evidence. Integrated rendered proof is now complete; the minimum-release gate remains.
- Independent implementation Aligner verified the account-scope invalidation regression and clean index snapshot, accepted the narrow contact-law hardening, and found no remaining implementation blocker.
- Exact production build, minimum-release, pull request, merge, and production observations remain pending.
