# TradeScout OS shell evidence

Status: implementation complete, locally verified, and committed on branch `codex/tradescout-os-shell-20260821`; no push, merge, or deployment performed.

## Baseline

- Community production capture: `C:\Users\flavo\AppData\Local\Temp\codex-clipboard-8639d45b-98ec-4c7d-9956-59b64095a085.png`
- Scout production capture: `C:\Users\flavo\AppData\Local\Temp\codex-clipboard-7960f320-6dde-4d98-bfcf-6ff1a0a5a5cc.png`
- Jobs production capture: `C:\Users\flavo\AppData\Local\Temp\codex-clipboard-8b83db79-6b47-494d-b8ec-aeeb17a56717.png`

The captures show a competing desktop route bar, universal account/activity rails around app-owned layouts, hidden or absent first-view Scout input, and clipped Community and Jobs controls. The owner clarified that TradeScout should behave like an operating system rather than a HomeAdvisor dashboard: primary navigation always lives in the bottom taskbar and system/account controls live at the top right.

## Reuse decision

`manual_unverified`: the project index was refreshed at the initial base `82f9c069b06c8f68c1eb31c0d39c03bcbbc97785`, but the doctor reports pre-existing exact duplicates and ambiguous owners from mirrored `exports/workspaces` trees. This build therefore uses only the canonical `client/src` and `server/tests` owners and does not add another shell, taskbar, feed, or Scout input abstraction. During verification, `origin/main` advanced to `991aa6a3d4d4e709f70529857a109a1c8474e68f` through non-overlapping profile-account and JW changes; the local implementation commit rebased cleanly onto that base.

## Post-change proof

The duplicate incoming-request fetch was removed from the outer `AppShell` wrapper. The capability remains owned by `AppShellCore`, which still queries `/api/social/conversations/requests/incoming`, derives `contactRequestCount`, routes the top-right Messages and helpers action to Direct Connect inbox (including the requests filter), and passes the count to `RightToolsPanel`.

### Implemented contract

- Signed-in primary route navigation is the persistent bottom taskbar on desktop and mobile.
- The top bar contains TradeScout identity plus compact guide, inbox, notification, and account/tool controls; the duplicate horizontal route strip is gone.
- App-owned workspaces render without the universal account/activity side frame.
- The old `VITE_PIN_RIGHT_TOOLS_V1` escape hatch, fixed right rail, width reservation, and rail-only collapse state are removed; account tools remain available on demand from the top-right control.
- Scout owns one primary outcome input: inline in the first view, then fixed above the taskbar after the first submitted message.
- Community owns its responsive feed, local context, and action grid without inherited global rails.
- Jobs keeps its existing implementation; removing competing shell rails restores the intended full-width layout.
- The authenticated profile-readiness banner clears the desktop taskbar and retains its mobile safe-area offset.

### Automated proof

- `npm run check` — pass after the clean rebase onto observed `origin/main` `991aa6a3d4d4e709f70529857a109a1c8474e68f`.
- `npm run test:run -- server/tests/authenticated-social-frame.contract.test.ts server/tests/community-app-surface-ux.contract.test.ts client/src/scout/scout-home-personalization.contract.test.ts client/src/pages/direct-connect/directConnectShellHierarchy.contract.test.ts client/src/components/onboarding/ProfileCompletionBanner.state.test.ts` — 5 files, 34 tests passed after the final persistent-rail removal and again after the clean rebase.
- `npm run build` — pass after the clean rebase; public landing assets and 556 JavaScript bundles were verified, and the server bundle completed.
- `npm run gate:minimum-release` — on the pre-rebase source commit, clean install passed, TypeScript passed, production build passed, 16 release-contract files / 137 tests passed, and 15 discovery-performance tests passed. The gate then stopped at its required disposable-database boundary: `TEST_DATABASE_URL required for disposable migration proof`. No database rule was weakened and no attestation was created. The complete gate still must run against the exact release commit with a fresh disposable `TEST_DATABASE_URL`.
- `git diff --check` — no whitespace errors; Git emitted only the repository's normal LF-to-CRLF working-copy warnings.

### Rendered proof

Browser proof used an authenticated test profile and deterministic API fixtures against the local Vite build. Final measurements are in `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\metrics.json`.

- Seven scenarios passed: Scout, Community, and Jobs at 1440px desktop and 390px mobile, plus Community at 1920px.
- Every scenario reported `horizontalOverflow: false`, no Vite error overlay, and no console errors.
- Every scenario showed the bottom taskbar and compact top-right menu; none rendered `.ts-desktop-primary-nav` or `authenticated-social-frame`.
- The strengthened visibility pass checks viewport intersection and center-point occlusion for each taskbar control. Every scenario reports `allTaskbarItemsVisible: true`.
- Jobs desktop: Scout, Direct Connect, Businesses, Jobs, Community, and Menu all intersect the 1440px viewport, are unoccluded, use opacity 1, and use white or 66%-white text. Its top-right menu spans x=1392..1424 within the viewport.
- Jobs mobile: Requests, Inbox, Community, Jobs, and Menu all intersect the 390px viewport and are unoccluded at opacity 1. Its top-right menu spans x=342..378.
- Scout submission proof: one input before and after submission; after submission `fixedInputCount: 1`, `inlineInputCount: 0`, the submitted prompt was visible, and the fixed input cleared the taskbar.
- Community action controls measured 172px each at desktop and 320px each at 390px, with no clipping.
- Readiness-banner geometry at 1440px: banner bottom 926, taskbar top 943. At 1920px: banner bottom 1006, taskbar top 1023.

Final captures:

- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\scout-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\scout-mobile-390.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\community-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\community-desktop-1920.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\community-mobile-390.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\jobs-desktop-1440.png`
- `C:\Users\flavo\.codex\visualizations\2026\08\21\01a0250d-e211-77c2-86f2-4d42bec787df\jobs-mobile-390.png`

### Independent closeout

- React best-practices review found no new material hook, fetching, rendering, accessibility, or state-management issue in the final TSX diff.
- SI Aligner: `aligned` for this active UI deliverable, no open findings. This does not claim whole-product or release completion.
- SI Verifier: `done` for the bounded local shell/Scout/Community/Jobs formatting deliverable. The source was then committed locally, cleanly rebased over non-overlapping upstream changes, and rechecked. Disposable-database, live, attestation, push, merge, and release proof remain open.
