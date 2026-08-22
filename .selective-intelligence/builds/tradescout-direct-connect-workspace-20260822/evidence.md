# D5 evidence - Direct Connect role-aware work desk

Date: 2026-08-22

Baseline: `4edc16222cf3ffa209d067d2116853cbe2816412`

Status: implementation complete, Objector sustained, Aligner approved, and locally verified; exact release commit, minimum-release gate, PR/merge, and production proof remain pending.

## Locked outcome

- Direct Connect uses one compact Start, Incoming, and My Requests work-desk model rather than a generic heading, guidance card, CTA card, and six-route wall before each queue.
- Requester-owned requests and provider assignments remain explicitly labeled and keep separate queries, selections, mutations, and authority.
- Successful request creation opens the exact newly owned request in the canonical My Requests inspector.
- Each queue keeps a compact list while one selected item owns the action surface; mobile progresses list to detail to Back.
- Explicit URL state wins; compatible missing state may restore only from authenticated-user-plus-role-route session state; stale selection cannot cross account, role task, county, filter, or result membership.
- The global bottom taskbar, top-right tools, canonical routes, county truth, verification, Trust/CVS, Messages ownership, lifecycle actions, and Intent to Decision Card to Contact law remain protected.

## Reuse decision

- Extend `DirectConnectShell.tsx` and `directConnectRoutes.ts` with one focused adjacent workspace-state helper and behavior tests.
- Reuse the existing request composer, provider Inbox, requester My Requests, owner-only request detail route, assignment response route, Decision Contact Gate panel, job lifecycle panels, and Messages handoff.
- Do not add a page, backend endpoint, schema, migration, workspace route, conversation owner, contact exception, matching rule, or production-data mutation.
- The only server edits allowed are narrow corrections inside the existing requester list and provider Incoming owners: preserve old nonterminal work and surface assignment/schema failure as structured non-2xx errors so the client can render Retry truthfully.
- Keep Board reachable as a secondary Direct Connect destination; protect the already released Jobs and Businesses workspaces and global shell.

## Baseline findings

- `DirectConnectShell` currently owns the composer, provider Inbox, requester My Requests, and the duplicated local chrome.
- A successful create currently invalidates request queries and navigates to `/direct-connect/inbox`, which is the provider/mixed assignment surface rather than the requester-owned lifecycle surface.
- `/api/direct-connect/requests?scope=all` already provides requester summaries, and `GET /api/direct-connect/requests/:id` is owner-authenticated and returns the existing detail/lifecycle shape.
- `/api/direct-connect/inbox` intentionally includes real provider assignments plus synthetic requester status items. Only real actionable assignment IDs may receive Accept or Decline authority.
- Accepted provider work already hands off through the returned Messages conversation ID. Direct Connect must not become another conversation/contact owner.
- Current requester list filtering drops every item older than 120 days, including nonterminal requests; the locked contract requires nonterminal work to remain visible.
- Current Inbox and requester list queries convert some failures into empty arrays or omit an error branch; the locked contract requires truthful error and retry states.

## Proof ledger

### Automated proof on the implementation tree

- `npm run test:run --` with the 17 focused client/server files covering workspace state, routes, shell hierarchy, mobile/replies controls, profile-banner clearance, Messages payload safety, requester status, provider authority, job bridge, gates, and redaction: **16 files passed, 1 intentionally skipped; 152 tests passed, 1 skipped**. The skip is the existing database-backed redaction case and explicitly requires `TEST_DATABASE_URL`; the minimum-release gate remains responsible for fresh-DB proof.
- `npm run check`: **passed** (`tsc`, exit 0).
- `npm run build`: **passed** after the final browser-derived corrections. Sitemap generation, Vite production build, public-landing bundle verification, built-asset URL verification, and server bundle all completed successfully. Existing Browserslist, ambiguous-duration, Three.js chunking, and bundle-size warnings remain non-blocking baseline output.
- `git diff --check`: **passed** with Windows line-ending warnings only.
- Independent implementation Objector: **PASS / sustained**, including a 35/35 focused rerun. It verified latest-result selection invalidation, requester/provider isolation, Messages whole-payload validation, explicit requester/provider role validation, and truthful partial-payload fallback.
- Final SI Aligner: **aligned**, no open findings, approved to advance to Verifier/release gates.

### Authenticated deterministic browser proof

- Proof used local requester-1, requester-2, and provider fixtures only; it did not mutate production data.
- Desktop requester at `/direct-connect/active?county=12033&selected=req-routed`: compact role-labeled task switcher, persistent list plus one selected owned-request inspector, bottom taskbar, top-right tools, no readiness-banner overlap, and no page-level horizontal overflow. Screenshot: `C:/Users/flavo/.codex/visualizations/2026/08/21/01a0250d-e211-77c2-86f2-4d42bec787df/direct-connect-workspace/direct-connect-requester-desktop-final.png`.
- Desktop provider at `/direct-connect/inbox?county=12033&selected=assign-suggested`: provider-only Incoming list plus one action inspector; synthetic requester rows were absent; request images and Prepare response, Open Messages, and Archive remained visible above the bottom taskbar. The profile-readiness nudge is now deferred on focused Incoming/My Requests routes so it cannot cover live actions. Screenshot: `C:/Users/flavo/.codex/visualizations/2026/08/21/01a0250d-e211-77c2-86f2-4d42bec787df/direct-connect-workspace/direct-connect-provider-desktop-final.png`.
- Provider at 390x844: document width remained `390 == 390`; filter controls, Back, and inspector actions measured 44px; both request images completed at natural width 640; Back returned focus to the originating native-button row. Screenshots: `direct-connect-provider-mobile-list-final.png` and `direct-connect-provider-mobile-detail-final.png` in the same proof folder.
- Requester mobile list/detail proof retained one-surface-at-a-time progression, Back focus, and `390 == 390` page width. Screenshots: `direct-connect-requester-mobile-list.png` and `direct-connect-requester-mobile-detail.png` in the same proof folder.
- Successful Start submission landed on the exact created item at `/direct-connect/active?county=12033&selected=req-created` and rendered that owned-request inspector without clearing selection during the invalidation fetch.
- Reload, copied URL, and bottom-taskbar `?resume=last-task` restored the same still-valid role task and selection; bare `/direct-connect` still opened Start. A rapid authenticated Start to My Requests to Start round trip retained the unfinished draft and staged guest handoff remained one-shot.
- Switching requester-1 to requester-2 cleared the prior account's selected URL and inspector; switching back restored only requester-1 state. Changing from county `12033` to `12091` without an explicit selection produced the neutral “Choose one of your requests” inspector and no `selected` query parameter.
- Old nonterminal work and `pending_outcome` remained visible. API failure fixtures rendered truthful requester/provider Retry states and recovered after Retry rather than presenting false empty queues.
- Locked contact hid raw phone/email; the released completed request exposed contact only after the existing Decision Card transition. Provider actions applied only to a real assignment, and an accepted assignment handed off to the existing Messages route.
- Messages rendered the full accepted-job card for a complete payload and a non-crashing “details temporarily unavailable” fallback for a successful partial payload. Invalid `viewerRole` is rejected before requester/provider labeling or routing.
- A fresh final desktop tab on the final source recorded **zero browser warn/error console entries**. The bottom taskbar ended 4px above the viewport edge and the page had `clientWidth == scrollWidth == 1280`.

### Verifier / release boundary

- Active D5 status: **done for the bounded local deliverable**. This does not claim whole-product or production completion; D6 remains later.
- Verified build/test churn was removed from the worktree: the two generated sitemap files were restored exactly to `HEAD`; the ignored Vitest report and untracked Red Graniti build cache were moved recoverably into the proof folder.
- Still required: lock the exact release commit, run `npm run gate:minimum-release` with fresh PostgreSQL and the recorded manual browser note, publish the local `tradescout/minimum-release-contract` status, open the PR with this ledger, merge after review, and prove production `/api/health`, database/migrations/schema, and exact `x-tradescout-build` equality to the merge SHA.
