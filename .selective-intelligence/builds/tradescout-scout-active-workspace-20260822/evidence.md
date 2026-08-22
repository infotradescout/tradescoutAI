# D7 evidence — Scout active-task workspace

Date: 2026-08-22

Baseline: `cd3623ab1bf39502b4ad2133c90d6a5f60788ed6`

Branch: `codex/tradescout-scout-active-workspace-20260822`

Queue: `8d7ff42d-9e30-4e6e-ac27-daaa33bc27dd`

## Locked outcome

An open or resumed Scout task presents one continuous operating workspace: compact task identity and controls, latest meaningful state and one validated next action, the actual conversation and result record visibly using the center, and exactly one composer above the stable bottom taskbar.

Community remains feed-first and globally browse-only. The D6 shell remains fixed. D8 preserves the next Community interior correction as a separate bounded deliverable.

## Reuse decision

- Extend canonical `client/src/scout/ScoutOS.tsx` and `client/src/index.css`.
- Touch `client/src/scout/ScoutThread.tsx` only if its existing bounded scroll-to-latest owner requires a correction.
- Extend existing `scout-entry-framing.contract.test.ts` and `ScoutThread.evidence.test.ts`; create no new component or test owner.
- PR review exposed that the canonical fixed composer can grow beyond the original static reserve, so the bounded correction also extends its existing owner, `client/src/scout/ScoutSearchDock.tsx`; no alternate dock or layout authority is introduced.
- Objector follow-up extends the existing command-bar owner, `client/src/scout/ScoutInputRow.tsx`, only to centralize value-driven textarea auto-sizing and release the inline height when the value clears; thread viewport anchoring remains in canonical `ScoutThread.tsx`.
- Do not edit mirrored `exports/workspaces` copies.
- The project index was refreshed at the exact baseline. Its 1,104 errors are the pre-existing mirrored-export duplicate baseline and do not establish a competing canonical Scout owner.

## Definition evidence

- D2 rendered screenshots show the current defect: an eight-update active Scout task has a compact header, collapsed Conversation history, nearly empty center canvas, and fixed composer.
- The pre-lock Intent Objector sustained the OS-workbench interpretation and rejected a details-only or decorative fill patch.
- The Planner returned GO for the bounded existing-owner repair and required desktop/mobile authenticated proof, saved-task restore, Community return, focused tests, build, exact gate, and exact production identity.

## Implementation

- Replaced the collapsed `details` history in `client/src/scout/ScoutOS.tsx` with one always-visible, accessible `scout-task-work-region` between the compact task state/action and the sole composer.
- Kept the existing task title, Save, New, delete, latest-state, validated dominant-action, saved-thread, county, and Community action owners. No route, API, schema, storage, persistence, shell, taskbar, contact, or Trust/CVS authority changed.
- Made the active-task frame consume the available AppShell center while suppressing the outer AppShell scroll only for an active Scout task. The first-use `ScoutHome` and inline composer path remain unchanged.
- Kept `ScoutThread` as the single bounded scroll owner, made it keyboard-focusable and labelled, contained overscroll, and replaced `scrollIntoView` with direct internal `scrollTo` so reaching the latest turn cannot pull a page ancestor.
- Kept the validated current primary action in the task-state header and suppressed only that exact action from the latest completed assistant turn across v1 result contracts and the two supported legacy action shapes. Historical actions, current secondary actions, and result content remain visible, and an action tray is omitted when filtering leaves it empty.
- After PR review, aligned duplicate suppression with the latest completed Scout turn when a persisted system update trails its assistant result. The header and thread now still expose exactly one current action after saved-thread restore.
- After PR review, separated the fixed dock's 92/96px responsive minimum from the active workspace reserve. The canonical dock now publishes its actual rendered height through `ResizeObserver`, allowing the reserve to grow and shrink with the textarea without using the measured value as its own minimum.
- Objector follow-up now owns textarea auto-sizing in a value-keyed layout effect, so manual input, prefill, demo text, and successful-send clearing all share the same grow/shrink path and an empty value releases the inline height. A separate thread `ResizeObserver` retains the latest-turn anchor across viewport growth or shrink only while the reader was already within the near-end threshold; scrolling into older history disables that resize pull.
- Extended the existing framing and thread evidence suites for the visible work-region owner, one composer, one dominant action, sparse history, a 24-turn history, and internal latest-turn scrolling.

## Automated proof

- Prompt queue check, before edits: `decision: continue`, position 1, queue `8d7ff42d-9e30-4e6e-ac27-daaa33bc27dd`, expected branch.
- `npm ci`: PASS; 1,389 packages added, 1,390 audited, 0 vulnerabilities.
- `npm run test:run -- client/src/scout/scout-entry-framing.contract.test.ts client/src/scout/ScoutThread.evidence.test.ts`: every D7 assertion passed. The only failure in the combined framing file is the baseline, out-of-scope `saved Scout related links can reopen stable home and vehicle records` assertion, which expects `initialHomeIdFromUrl` in unchanged `client/src/pages/homes.tsx`; baseline HEAD instead uses `requestedHomeId`. The guard also expects removed project-link symbols, so it was documented rather than weakened or hidden.
- Final required nine-file regression command after all dock, textarea, live-resize, and single-action corrections: 8 of 9 files passed and 83 of 84 tests passed. All D7 framing/thread, current-primary filtering, historical/secondary preservation, action validation, Scout home, D6 taskbar, MobileAppBar, authenticated social frame, Community surface, and Community CVS reflection assertions passed; the same unchanged HomeID symbol assertion was the only failure.
- PR review correction `3836040888`: the focused D7/action/taskbar command completed with 4 of 5 files and 53 of 54 tests passing. The new rendered-dock `ResizeObserver` regression, minimum/measured CSS contract, trailing-system current-action regression, action validation, and taskbar coverage all passed; the same unchanged HomeID symbol assertion was the only failure.
- Final Objector-follow-up rerun after centralizing textarea sizing in the value-keyed layout effect: the same focused D7/action/taskbar command completed with 4 of 5 files and 55 of 56 tests passing. Successful-send textarea growth/reset, dock reserve growth/shrink, thread viewport shrink/grow while anchored, a viewport 20px from the end inside the 32px near-end threshold, and scrolled-away history preservation all passed; the same unchanged HomeID symbol assertion was the only failure.
- `npm run check`: PASS, exit 0.
- The post-review `npm run check` rerun also passed, exit 0. Its ignored Vitest HTML output was moved out of the worktree to `C:\\Users\\flavo\\.codex\\visualizations\\2026\\08\\21\\01a0250d-e211-77c2-86f2-4d42bec787df\\scout-active-workspace\\test-results-review-3836040888-20260822` before final diff inspection; the project index was not refreshed.
- The final Objector-follow-up `npm run check` rerun passed, exit 0. Its ignored Vitest report was moved to `C:\\Users\\flavo\\.codex\\visualizations\\2026\\08\\21\\01a0250d-e211-77c2-86f2-4d42bec787df\\scout-active-workspace\\test-results-objector-followup-layout-20260822`; the project index was not refreshed.
- Final `npm run build`: PASS, exit 0; Vite transformed 4,066 modules, public landing and built asset URL verification passed, and the server bundle completed. Existing Browserslist, Tailwind ambiguous-duration, chunk-size, and Three.js mixed-import warnings remained non-blocking.
- `git diff --check`: PASS. Build-only sitemap changes were restored and 11 generated Red Graniti source SVGs were removed; no generated output remains in the working diff.
- Final project-index refresh completed after all ignored Vitest/build output was moved out of the worktree: 3,674 source files, 1,484 components, 11,164 functions/hooks, 20,045 symbols, and the repository baseline of 1,101 mirrored-export/competing-owner errors plus five raw-UI warnings. Doctor therefore remains repository-baseline red, not D7-regressed.
- The corrected production build was rerun after removing the browser fixture and passed again. Its ignored Vitest HTML report was moved outside the repository to the durable visualization evidence directory before index refresh and staging.
- The React best-practices review found no new dependency, derived-state, iteration, rendering, or accessibility blocker in the bounded Scout changes.

## Rendered proof

- A deterministic authenticated local fixture used the real AppShell, Scout controller surfaces, saved-task UI, work-area Community sheet, and production styles while stubbing only API responses. It covered sparse, eight-update, and 24-update Escambia County tasks. The fixture is proof-only and is removed before the exact commit.
- Final eight-update task at 390x844: the current-task block was 270.45px high; the visible work region was 249.24px; the internal thread was 193px high with 1,047px scroll height and landed at its end (`scrollTop 852.8`). The 96px composer dock ended at y=782 and the 52.8px taskbar began at y=787.2. The AppShell root stayed fixed (`clientHeight == scrollHeight == 734`, `scrollTop 0`), with no horizontal overflow, one composer, one current primary-action marker, no duplicate result or next-step tray, and 44px controls.
- Final eight-update task at 1440x1000: the current-task block was 136.6px high; the visible work region was 529.4px; the internal thread was 473px high with 852px scroll height and landed at its end (`scrollTop 378.4`). The 92px composer dock ended at y=934 and the taskbar began at y=943.2. The AppShell root stayed fixed with no horizontal overflow, one composer, one current primary-action marker, no duplicate result or next-step tray, and reachable top-right tools.
- Sparse task: at 390x844 the work region was 318.94px and its 263px thread needed no overflow; at 1440x1000 the work region was 550.15px and its 494px thread needed no overflow. Both kept exactly one composer, no fabricated next action, no page scroll, and clean dock/taskbar separation.
- 24-update task: at 1440x1000 the 473px thread had 3,167px scroll height and landed at `scrollTop 2692.8`; on a fresh 390x844 load the 193px thread had 3,993px scroll height and landed at `scrollTop 3799.2`. The outer root remained stationary and the latest update was visible.
- Save -> New -> Conversations -> reopen restored the identical task title, eight updates, latest meaningful state, the single validated `Open local Community` header action, Escambia County context, visible record, one composer, and latest-turn position.
- Opening the validated local Community action used the existing work-area sheet and rendered the real feed-first Community surface. Closing it returned to the same Scout URL and preserved the task title, update count, latest state, single action, county, visible record, and composer. A fresh-tab repeat had zero console errors; it retained one pre-existing Radix warning that the work-area dialog has no description. Navigating to the Community app restored normal AppShell outer scrolling.
- The labelled `role=log` accepts keyboard focus and exposes a visible focus outline. All automated latest-turn motion uses the internal thread's `scrollTo`; no `scrollIntoView` page pull remains.
- Durable final captures after the single-action correction: `C:\\Users\\flavo\\.codex\\visualizations\\2026\\08\\21\\01a0250d-e211-77c2-86f2-4d42bec787df\\scout-active-workspace\\scout-task-8-desktop-1440-final.png` and `scout-task-8-mobile-390-final.png`. Long and sparse evidence remains in `scout-task-24-desktop-1440.png` and `scout-task-2-mobile-390.png`.
- The renewed authenticated 24-update browser proof closed the earlier live-resize hold. At 1440x1000, the empty composer measured 92px and published a 92px reserve; four lines grew it to 127.6px with a 128px reserve, reduced the thread from 473px to 437px, and retained a 0.2px latest-turn distance. Submit cleared the value and inline height, restored the dock/reserve to 92px, and kept the thread at a 0.4px latest-turn distance.
- When the reader was 319.6px from the end, composer growth left `scrollTop` unchanged at 2566.4 and clearing restored the original distance without a jump. At 390x844, the 96px dock/reserve grew to 111.6/112px, the thread reduced from 263px to 247px while remaining 0.2px from the end, and clearing restored the 96px reserve. Live desktop -> mobile -> desktop resizing remained at the latest update with no horizontal overflow and exactly one composer.
- Selecting New removed the active-task shell, fixed dock, and measured reserve (`activeShell=false`, `fixedDockCount=0`, reserve absent) while restoring the single inline first-use composer. The correction flow introduced no browser console error; the only later warning was the pre-existing Radix description warning after explicitly opening the unrelated Requests sheet.
- Durable post-review captures: `C:\\Users\\flavo\\.codex\\visualizations\\2026\\08\\21\\01a0250d-e211-77c2-86f2-4d42bec787df\\scout-active-workspace\\scout-task-desktop-dock-correction.png` and `scout-task-mobile-dock-correction.png`.

## Independent review

- `si-objector`: PASS after the final review corrections. It confirmed the value-keyed textarea sizing, measured dock reserve, near-end thread anchoring, one-way observer chain, cleanup, and duplicate-action truth. Its independent focused ScoutThread/action run passed 32 of 32 tests and `git diff --check` passed.
- `si-aligner`: ALIGNED after reopening both durable post-review captures. It returned no open findings, approved resume, and confirmed that the reviewed source, 83/84 bounded test result, check/build/diff proof, independent 32/32 Objector PASS, D8 boundary, and release caveats match the locked contract.

## Release proof

PR #425 is open from `codex/tradescout-scout-active-workspace-20260822`. The prior candidate `e53314ea363a86ec71556807930d194a2e9a38e4` was committed, pushed, and passed the exact minimum-release contract, but the reviewed dock/resize corrections above are newer than that candidate. They must be committed as a new exact SHA, gated again on a fresh zero-table PostgreSQL 16 database, pushed with lease, reviewed, merged, deployed, and matched by the production `x-tradescout-build` header plus `/api/health` before any release claim.
