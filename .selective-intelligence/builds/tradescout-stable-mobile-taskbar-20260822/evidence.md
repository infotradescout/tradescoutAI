# D6 stable mobile taskbar evidence

## Locked outcome

- Exact baseline: `4c2aa11efa9e363d3dc6502ab313f8b442235088`.
- The owner-provided mobile captures show the bottom bar rewritten into contextual `Requests`, `Inbox`, `Community`, `Start`, and `Menu` controls.
- The approved D6 outcome is a fixed global app order: `Scout`, `Direct Connect`, `Businesses`, `Jobs`, `Community`, then `Menu`.
- `Menu` is the secondary-app launcher. Account, profile, settings, notifications, security, verification, permissions, privacy, and authorized admin controls remain under the top-right system owner.
- Direct Connect keeps its own Start, Incoming, Inbox, Requests, and workflow actions. The existing global Start-here help control is a separate protected shell control.

## Reuse decision

- `client/src/components/layout/AppShellCore.tsx` already owns mobile shell visibility, core and advanced app availability, account tools, progressive exposure, and the fixed bottom host.
- `client/src/components/navigation/MobileAppBar.tsx` already owns route matching, primary versus overflow rendering, the bottom Menu sheet, safe-area padding, and accessible links.
- `client/src/components/layout/AppShell.tsx` already owns the released desktop taskbar and is regression-only for D6 unless the D6 diff proves a necessary correction.
- `client/src/pages/direct-connect/directConnectWorkspaceState.ts` already owns the Direct Connect last-task resume href and must be reused, not duplicated.
- The shell already reserves `--bottom-nav-h` below mobile content, so the first implementation choice is to preserve and verify that inset rather than create a second spacer system.
- No new shell, taskbar, launcher, route registry, or navigation-state component is permitted.

## Planner validation

- `execution_contract.py validate` passed for `execution-contract.json` with no errors.
- Product implementation, local rendered verification, independent implementation Objector review, and implementation Aligner review are complete. The exact release gate and production identity proof remain pending.

## Implemented owner corrections

- `AppShellCore.tsx` now builds one mobile app taskbar from the fixed labels `Scout`, `Direct Connect`, `Businesses`, `Jobs`, and `Community`, followed by secondary apps. The Direct Connect slot reuses `DIRECT_CONNECT_TASKBAR_RESUME_HREF`.
- Contextual mobile workflow ordering and simplified-drawer duplication were removed. The reversible flag-off `RightToolsPanel` owner and desktop shell remain intact.
- `MobileAppBar.tsx` now supports stable-primary partitioning, query-safe active matching, most-specific route precedence, fixed 44-pixel minimum targets, understandable labels, and a fixed Menu slot that becomes active for secondary routes without swapping a primary app.
- Browser proof found and corrected two D6 defects before review: canonical `/community-feed` and `/community-post/*` now keep Community active, and Share now uses the existing progressive-exposure filter instead of appearing while its route remains locked.
- No routes, APIs, schemas, migrations, county behavior, contact behavior, role authority, or Trust/CVS owner changed.

## Automated proof

- `npm run test:run -- client/src/components/navigation/MobileAppBar.test.ts client/src/components/layout/appShellMobileTaskbar.contract.test.ts client/src/pages/direct-connect/directConnectWorkspaceState.test.ts server/tests/authenticated-social-frame.contract.test.ts client/src/lib/progressiveFeatureGating.contract.test.ts client/src/lib/progressiveFeatureUnlocks.test.ts` passed: 6 files, 40 tests.
- `npm run check` passed.
- `npm run build` passed after the final browser-discovered corrections: 4,064 Vite modules transformed, public landing startup assets and 558 JavaScript bundle URLs verified, and the server bundle built successfully. Existing browserslist, Tailwind duration, Three import, and large-chunk warnings remain baseline warnings.
- `git diff --check` passed with Windows line-ending warnings only.
- The broader Worker regression batch passed 36/36. The unchanged Direct Connect hierarchy suite still contains one baseline source-string assertion that expects `selectedRequest ? [selectedRequest].map` on one line while the protected D5 source splits it across lines; the D6-owned tests and product owner are green.
- Independent implementation Objector: **PASS** with no corrective Worker round required. Its independent focused rerun passed 6 files / 40 tests, and it sustained the fixed order, Direct Connect resume ownership, active-route precedence, app/system separation, 390x844 responsive proof, shell exclusions, and unchanged platform-law owners.
- Final SI Aligner: **provisionally aligned**, no required corrections, and approved to resume the exact release sequence. The provisional qualifier refers only to the still-pending clean-commit gate, PR/merge, Render identity, `/api/health`, and exact `x-tradescout-build` proof.
- Final SI Verifier: **done for the bounded local D6 deliverable** and safe to proceed. Its independent rerun passed the 6-file / 40-test focused suite and `npm run check`; it confirmed that only intended D6 files and artifacts remain, the temporary harness is absent, proof ports are free, and no blocker prevents locking the commit and running the release gate.

## Rendered proof

- Evidence root: `C:/Users/flavo/.codex/visualizations/2026/08/21/01a0250d-e211-77c2-86f2-4d42bec787df/stable-mobile-taskbar`.
- Machine-readable observations: `metrics.json`.
- At an exact inner viewport of 390x844, every ordinary route rendered the fixed order `Scout`, `Direct Connect`, `Businesses`, `Jobs`, `Community`, `Menu`. All six targets measured at least 61.46x50.40 pixels; page-level horizontal overflow was zero.
- Scout, Direct Connect, Businesses, Jobs, and Community each retained the correct single active app. Jobs, at `/direct-connect/opportunities?...`, activated Jobs rather than the broader Direct Connect parent. Community retained its active state after canonicalizing to `/community-feed`.
- The existing Direct Connect taskbar href remained `/direct-connect?resume=last-task`: a tab with a stored task resumed `/direct-connect/active?county=12033`; a fresh tab with no pointer safely fell back to Start.
- Menu open contained secondary apps only. Profile, Settings, Notifications, Admin, and Direct Connect workflow shortcuts were absent. Escape closed the Sheet and returned focus to Menu.
- Progressive exposure remained truthful: locked Share was absent for the requester fixture, while the authorized admin fixture exposed Share and other advanced apps; Admin itself stayed out of Menu and remained reachable from the top-right account/system owner.
- Authenticated, guest, and admin top-right drawers were rendered. The authenticated drawer kept Profile, Settings, Permissions and roles, Verification, Notifications, Privacy, and Security; guest showed `Create free account` and `Sign in`; authorized admin access appeared only in the top-right owner. No secondary-app launcher was duplicated there.
- `/login` and `/admin` each rendered zero stable mobile taskbars, preserving existing exclusions.
- Community content ended 262.38 pixels above the fixed taskbar in the deterministic empty-feed scene. At 1440x1000, the released desktop taskbar remained present with zero horizontal overflow; `.ts-shell-main` ended at 942px and the taskbar began at 943.2px.
- A fresh browser tab traversed Scout, Direct Connect, Businesses, Jobs, Community, Menu, and Help after all corrections with zero runtime overlays and zero console errors.
- Representative captures: `scout-mobile-390-bottom.png`, `direct-connect-mobile-390-bottom.png`, `businesses-mobile-390-bottom.png`, `jobs-mobile-390-bottom.png`, `community-mobile-390-bottom.png`, `menu-mobile-390-open.png`, `account-tools-mobile-390-open.png`, `guest-tools-mobile-390.png`, `admin-tools-mobile-390.png`, `help-secondary-mobile-390.png`, `desktop-community-1440x1000-bottom.png`, and `desktop-community-1440x1000-tools.png`.
- The temporary responsive harness, proof-only API additions, generated sitemap churn, Red Graniti source cache, and ignored HTML test report were removed or moved to the evidence root after proof. Ports 4176 and 5000 were verified free.

## Release status

- D6 is locally implemented and rendered, but it is not yet released.
- Implementation Objector, Aligner, and Verifier review passed. An exact clean-commit minimum-release gate, PR/merge proof, Render deployment identity, and production `/api/health` plus exact `x-tradescout-build` remain required.
