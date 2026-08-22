# D8 evidence — Community mobile feed views

Date: 2026-08-22

Baseline: `b21d638fcf642db7601ae7469f4037f66183df2a`

Branch: `codex/tradescout-community-interior-20260822`

Candidate identity rule: this tracked record does not embed its own future commit SHA. The authoritative exact candidate identity is the full commit recorded in `artifacts/release-contract/<sha12>/evidence.json` after the final tree is committed and verified clean.

Release state: **HOLD**. The bounded implementation is local. Exact-candidate browser proof, minimum gate, attestation, PR review, merge, Render deployment, and production identity remain required.

## Locked outcome

Every Community geography and feed-view control is visible on initial mobile render without asking the user to guess a horizontal gesture. At 640 CSS pixels and below, the existing divider keeps the geography axis before the feed axis. Normal text renders `Near me` / `Explore`, then `For you` / `Newest` / authenticated `Saved` as two rows; enlarged text may wrap each axis further without clipping or reordering controls. At 641 pixels and wider, the released single-row layout remains and reserves enough inset for its existing keyboard focus paint.

## Observed defect

- Exact production identity: `b21d638fcf642db7601ae7469f4037f66183df2a`; health was healthy, database connected, migrations compatible `124/124`, and required schema present.
- Authenticated `390x844`: viewbar client width `354`, scroll width `399`, scroll left `0`. `Saved` was only about `17/57.8px` visible, or roughly 71 percent clipped.
- Authenticated `360`: `Saved` was fully outside the initial view and `Newest` was partly clipped.
- Authenticated `320`: `Saved` was fully outside the initial view and only about `18.6/66px` of `Newest` was visible.
- Guest global view also clipped `Newest` at 320 and 360. Desktop `2048x1018` fit every present control.

Privacy-safe baseline capture: `C:\Users\flavo\.codex\visualizations\2026\08\22\01a02a0c-1488-7b91-8baa-a89ee2760d68\community-d8-b21\community-mobile-390x844-viewbar-clipped-safe.png`, SHA-256 `0815ACF167679DB71883B3A03BFA56D588A30F5FA4DE8E31AB6B2ED756399CCD`.

## Reuse decision

- Extend only the existing `.ts-community-viewbar` and `.ts-community-viewbar__divider` owners in `client/src/index.css`.
- Keep the existing button markup, order, labels, `aria-pressed`, authentication condition, and `handleCommunityView` handlers in `client/src/pages/community-feed.tsx` unchanged.
- Update the existing Community shell/surface contracts and Community feed Playwright owner; add no competing component or route.
- Do not edit AppShell, Scout, post/action/contact flows, APIs, schemas, persistence, counties, or Trust/CVS.

## Implementation

- At `max-width: 640px`, the viewbar wraps and exposes overflow instead of clipping it.
- The already-present semantic divider becomes a zero-height, full-basis flex break. At normal text sizing, geography controls occupy the first row and feed controls the second; enlarged text may wrap each axis further while the divider preserves geography-before-feed order.
- At `641px+`, nowrap, scrolling, labels, icons, and the divider remain unchanged; four logical pixels of top and inline padding keep the existing 3–4px focus paint inside that scrollport.
- No label, icon, target, action, URL, authentication, or product-law behavior was removed.

## Rendered proof

- A page-only prototype on exact production b21 passed authenticated and guest widths 320, 360, 390, and 640.
- Every present button was fully contained, retained its original width and 44px height, and the last control's existing focus-visible ring was unclipped.
- Viewbar `scrollWidth` equaled `clientWidth`; page and body had no horizontal overflow.
- Authenticated row order was Near me / Explore, then For you / Newest / Saved. Guest omitted Saved and retained the same axes.
- The temporary style was removed, viewport overrides reset, isolated tabs closed, and no Community control, form, POST, or production data was touched.
- The actual current source then passed authenticated 320, 360, 390, and 640 at normal text with the same two rows, `scrollWidth == clientWidth`, 44px targets, following content below the viewbar, and no page horizontal overflow.
- At 320 and 200% root text size, all five controls occupied five contained visual rows while preserving geography-before-feed order, visibility, focus access, 44px targets, and zero horizontal overflow.
- At actual current-source 641, 768, and 1440, all five controls remained in one nowrap row. The scrollport padding was top/right/bottom/left `4/4/8/4px`; Near me, For you, and Saved each rendered the existing focus paint without clipping. Near me had 4px logical-start clearance, and every tested control had 4px top and 9px bottom clearance.
- Guest global `390` retained Near me / Explore, then For you / Newest; Saved was absent, Explore was pressed, `Explore · Browse only` was visible, Create post and the composer were absent, and no horizontal overflow or framework overlay appeared.

Current-source captures under `C:\Users\flavo\.codex\visualizations\2026\08\22\01a02a0c-1488-7b91-8baa-a89ee2760d68\d8-community`:

- `auth-320-clean.png`, SHA-256 `8A4A61125ADCC36AC568774A3BD6A1265F953F870AD2765F9477EBA2588BDE2B`.
- `auth-641-clean.png`, SHA-256 `3729FC1A2C4A1988D4871BD02E85F6FF122060474733F5A13DC943CCB0A262C7`.
- `guest-global-390.png`, SHA-256 `AA151F063BB0ED4C55395B86AB4F7BCF26F956C247352CF99D7DF4C571022D1E`.

Privacy-safe accepted-prototype capture: `C:\Users\flavo\.codex\visualizations\2026\08\22\01a02a0c-1488-7b91-8baa-a89ee2760d68\community-d8-b21\community-mobile-390x844-viewbar-row-break-safe.png`, SHA-256 `1B9DFE34A4A1BD02E77579FA81754C150540CBA4A0FF71574ABC0513747F6F01`.

## Automated proof

- `npm run test:run -- server/tests/authenticated-social-frame.contract.test.ts server/tests/community-app-surface-ux.contract.test.ts`: **PASS**, 14/14.
- Broader Community parity/CVS set: **PASS**, 24 tests passed; the two database-gated Community feed API tests remained explicitly skipped by their existing harness condition.
- `npm run check`: **PASS**.
- `npm run guard:law-drift`: **PASS**.
- `npm run guard:scout-response-contract`: **PASS**.
- `npm run audit:authority-gates`: **PASS** (`contactButtons=0`, `startRefs=1`, `outsideAllowed=0`, `contactBypassRefs=0`).
- `npm run audit:trust-leaks`: **PASS**.
- `npm run verify:scout-purity`: **PASS**.
- `git diff --check`: **PASS** with informational Windows line-ending notices only.
- Selective Intelligence project index refreshed at baseline b21 with `dirty: true`, 3,675 source files, 20,049 symbols, 1,484 components, and 11,168 functions/hooks. Doctor reported `stale: false`; the existing mirrored-source ownership baseline remains 1,101 errors and 5 warnings.
- `npx playwright test tests/community-feed.e2e.spec.ts --grep "keeps every authenticated feed view visible at mobile widths" --project=chromium --reporter=list` against the isolated authenticated server/database: **PASS**, 1/1. The exact modified test was rerun after the 641px focus inset landed.
- The isolated PostgreSQL 16 browser database migrated and passed required-schema verification at `124/124`. Its optional-fixture-only `notifications.priority` and `feature_flags` warnings did not affect the 200/304 Community endpoints or target UI. Browser sessions, dev server, container, and ports were verified cleanly stopped after proof.
- Full build and exact-candidate minimum release gate are pending and must not be claimed until recorded here.

## Council

- SI Intake: **SUSTAINED**. The defect is production-observed and bounded to the Community interior.
- SI Objector: **SUSTAINED**. Intentional mobile grouping is robust; padding/font/icon compaction and a fade-only affordance were rejected as brittle.
- SI Aligner: **ALIGNED**. The implementation preserves existing owners and product law. Historical D2 nowrap evidence remains historical; this D8 record supersedes only mobile behavior.
- SI Verifier: **PENDING exact candidate**.

## Law integrity classification

- Visibility does not equal access: **enforced**, unchanged. Showing every view selector grants no contact or action authority.
- Intent → Decision Card → Contact: **enforced**, unchanged; no contact path changed.
- Counties are operational containers: **enforced**, unchanged; geography handlers and county queries are untouched.
- Read-only global Community view: **enforced**, unchanged; Explore remains browse-only.
- Trust/CVS governs exposure: **enforced**, unchanged; no exposure logic changed.
- Temporary exceptions: none introduced.

## Release boundary

Do not attest, push, merge, or claim production correction until a clean exact commit passes the modified Playwright regression, focused and broader suites, typecheck, build, source guards, exact minimum release gate, exact-head review, Render deploy, exact `x-tradescout-build` and health identity, and read-only authenticated/guest production smoke.
