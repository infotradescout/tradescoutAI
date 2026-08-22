# D4 evidence - Jobs role-aware workspace

Date: 2026-08-22

Baseline: `e16deb9fd46d084b77d307e806ef005d2ccb222f`

Status: implementation and focused source proof complete; exact-current-main browser and release proof pending.

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
- Focused contracts and TypeScript pass on the implementation lane; the rendered 1440x1000 work desk has no horizontal overflow and shows the protected bottom taskbar/top-right tools. This observation preceded current-main reconciliation and is design evidence only.
- Independent Objector accepted the corrected source implementation and held release for exact-current-main rendered proof, disposable-DB/minimum-release proof, and final evidence.
- `origin/main` advanced from the initial `e16deb9f` baseline through non-overlapping JW profile changes. Exact integrated browser, build, minimum-release, pull request, merge, and production observations remain pending.
