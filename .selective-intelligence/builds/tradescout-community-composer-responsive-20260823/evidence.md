# D10 evidence — Community composer responsive containment

Date: 2026-08-23

Baseline: `468f4dfd24430dc953a16263392e5b8aa0f610ab`

Branch: `codex/tradescout-community-composer-d10-20260823`

Candidate identity rule: this tracked record does not embed its own future commit SHA. The authoritative exact candidate identity is the full commit recorded in `artifacts/release-contract/<sha12>/evidence.json` after the final tree is committed and verified clean.

Release state: **HOLD**. Working-tree implementation, rendered proof, Objector review, and Verifier alignment pass. Exact-candidate minimum gate, attestation, PR review, merge, Render deployment, and production identity remain required.

## Locked outcome

The canonical authenticated Community composer contains its body, textarea, accessory actions, and primary Post action at narrow mobile widths. Photo, Video, and Poll may scroll inside their own strip while Post remains visible and at least 44 pixels high. Desktop heights of 480 pixels or less release only this composer from sticky positioning so every control remains reachable inside `#app-scroll-root`; normal-height desktop remains sticky eight pixels below that scroll root. No production or local Community post is submitted as proof.

## Observed defect

- Exact production baseline was the D9 merge `468f4dfd24430dc953a16263392e5b8aa0f610ab`, healthy with connected database, compatible migrations `124/124`, and required schema present.
- At `390x844`, the composer card was about 334 pixels wide while the body, textarea, and action row were about 669 pixels wide. The card's `overflow-hidden` masked the overflow and placed Post around x644 through x704, fully outside the viewport.
- The main composer flex item lacked `min-w-0`; its category chips therefore imposed their intrinsic width on the textarea and actions. The mobile no-wrap action row could then displace its primary action.
- An ancestor used `overflow-x-hidden`, establishing a competing overflow container for sticky behavior, while `md:top-16` duplicated the header inset already represented by the shell's app scroll root.
- At `768x320`, the complete composer cannot physically fit between fixed shell chrome. Focus movement could displace the upper controls; each control must instead remain reachable through normal scrolling.
- Production inspection was read-only. No Create submission, Community POST, or production data mutation occurred.

## Reuse decision

- Reuse the one routed `client/src/pages/community-feed.tsx` composer and its existing handler, category, attachment, and request-payload owners.
- Extend only the existing Community responsive CSS in `client/src/index.css`.
- Extend the existing `tests/community-feed.e2e.spec.ts` rendered owner and add one source contract beside existing Community surface contracts.
- Create no parallel composer, action owner, route, API, schema, migration, or shell.

## Implementation

- Replaced the page ancestor's `overflow-x-hidden` with `overflow-x-clip`, which clips paint without creating a competing scroll container.
- Changed normal desktop sticky inset from 64 pixels to eight pixels because `#app-scroll-root` already begins below the fixed header.
- Added `min-w-0` to the composer body and attachment flex child.
- At widths through 640 pixels, the attachment child owns internal horizontal overflow while Post uses `flex: 0 0 auto`, remains visible, and retains a 44-pixel minimum height.
- At desktop heights through 480 pixels, only the composer becomes static; the input and card retain scroll margins for shell clearance.
- Added stable test hooks only. Existing Create, Cancel, category, attachment, and Post handlers and the `!isGlobalView && isComposerOpen` authority guard remain unchanged.

## Automated proof

- `npm run check` — **PASS** on the final working tree.
- Five-file Community/CVS contract set — **PASS**, 5 files / 21 tests.
- Focused responsive/surface contracts — **PASS**, 2 files / 9 tests.
- `npm run build` — **PASS** on the final working tree. Existing Browserslist age, Tailwind arbitrary-duration, mixed Three.js import, and large-chunk warnings remained non-blocking. Generated sitemap timestamps and Red Graniti source caches were restored or removed after proof.
- `npm run guard:law-drift` — **PASS**.
- `npm run audit:authority-gates` — **PASS**.
- `npm run audit:http-semantics` — **PASS**.
- `git diff --check` — **PASS**, with informational Windows line-ending notices only.
- Authenticated disposable-database Playwright proof — **PASS**, 1/1 in 12.7 seconds. It covered `320x844`, `390x844`, `640x844`, `641x844`, `768x320`, `1440x480`, and `1440x844`.
- The rendered proof observed actual attachment overflow at 320, focused Photo and Poll through the internal strip without displacing Post, contained every card and page width, focused first/middle/last categories plus Photo/Video/Poll, textarea, Cancel, and Post on short-height desktops with four-sided app-root clearance, then scrolled `#app-scroll-root` past the normal-height composer's natural sticky threshold and proved its rendered top remained within one pixel of the eight-pixel inset.
- The browser regression records any `POST /api/community/posts` and asserted an empty list. It filled only `D10 local layout proof — do not submit`, never activated Post, and created no Community data.
- The disposable fresh database emitted background `GET /api/social/conversations/requests/incoming` 500 responses because its notifications fixture lacks the optional `priority` field; Vite HMR WebSocket requests also produced the known local CSP warning. Those warnings did not affect Community composer rendering or issue a Community mutation, so the run is not described as console-clean.

## Independent review

- SI Objector initially held three proof gaps: accessory-strip reachability, representative short-height control coverage, and an explicit no-write guard. A final adversarial pass also held the normal-height check because computed sticky styles alone did not prove pinning. The regression now scrolls the actual app root beyond the natural sticky threshold and measures the composer at the eight-pixel inset; Objector re-review returned **PASS / GO**, no open finding.
- SI Verifier/Aligner independently confirmed the four product/test owners, reran TypeScript and Community contracts, inspected the expanded Playwright evidence, and rechecked the final three-file proof amendment plus refreshed index. Verdict: **GO to create the proof-only amendment**; release status remains partial until the new candidate's exact gate, PR review, deployment, and production proof complete.

## Project index and reuse gate

- The final working-tree refresh indexed 212 directories, 3,680 source files, 20,064 symbols, 1,484 components, and 11,179 functions/hooks. The new responsive contract is present and the canonical Community page, CSS, and E2E owners remain reused.
- Doctor reports `stale: false`. It remains repository-wide not-ready on the unchanged historical baseline of 1,099 duplicate-owner errors and five raw-element warnings, matching the post-D9 baseline. D10 introduced no competing Community component, route, handler, hook, schema, or persistence owner.
- Reuse disposition: extend the established routed Community page, responsive CSS, and rendered test owner; the one new file is a contract test, not a product implementation owner.

## Law integrity classification

- Visibility does not equal access: **enforced**, unchanged. Responsive containment grants no contact or action authority.
- Intent → Decision Card → Contact: **enforced**, unchanged; no contact path changed.
- Counties are operational containers: **enforced**, unchanged; no location or write owner changed.
- Read-only global Community view: **enforced**, unchanged; the existing global composer guard remains.
- Trust/CVS governs exposure: **enforced**, unchanged; no exposure or scoring logic changed.
- Short-height static composer positioning: **enforced responsive behavior for D10**, not an authority exception.
- Temporary exceptions: none introduced.

## Release boundary

Do not attest, push, merge, or claim production correction until the final tracked SI artifacts and project index are validated, a clean exact commit passes `npm run gate:minimum-release`, the exact status and exact-head review are green, Render deploys the returned merge SHA, `/api/health` and `/community` return the exact build identity, and read-only production Community smoke passes at the affected mobile and short-height viewports. Production verification must not submit a Community post.
