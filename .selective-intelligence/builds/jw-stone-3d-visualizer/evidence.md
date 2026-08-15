# Build Evidence: jw-stone-3d-visualizer

Verdict: Implemented and automated local gates pass; release remains blocked
Source: uncommitted working tree on branch `jw-stone/3d-visualizer-20260815`, based on `31225f09b58531e83f7c787110aa964a99145fd7`
Observed: `2026-08-15T07:23:47Z`
Configuration: active JW spatial-studio amendment `1.4.0`

## Planned versus actual

- The existing countertop planner now lazy-loads a real Three.js/WebGL spatial studio for Kitchen, Bathroom, and Living Room without changing public routes or creating another inventory authority.
- One Three unit equals one foot. Entered runs and islands are not visually capped; L/U shared corners are not double-modeled; camera fitting accounts for portrait and desktop aspect ratios; fixed fog does not erase max-size rooms.
- All complete sink, cooktop/range, and other-opening placements are modeled with longitudinal and front offsets. Incomplete placements are deliberately omitted and announced instead of invented. Seams, backsplash, floor, edges, and valid island waterfalls are represented from normalized planner state.
- The selected canonical catalog photo uses a stable opaque identity across local save, design-only share, measured plan, WebGL texture, recovery image, named image route, and Direct Connect handoff. Per-photo dimensions are applied only where supported; hand/close-up photos say scale is unverified.
- Texture transforms preserve one in-flight source load and reuse GPU-facing maps for crop/scale/vein updates. Slow loads expose a truthful loading state and timed Retry; WebGL Retry remounts a new canvas; initialization and cleanup are idempotent; idle/offscreen/reduced-motion rendering is bounded.
- Shared links exclude notes and location and ask before replacing an existing saved draft. Stone purchase and fabricator requests remain separate deliberate actions, use existing Direct Connect, disclose no private price/source-count fields, and mark availability as confirmation required with JW Stone.
- Default state is primary countertop only: no island, backsplash, floor stone, sink, cooktop, other opening, seam, waterfall, or edge treatment is silently added.

## Automated evidence

- `npm run check` — pass.
- One exact changed-and-platform contract run across 23 Vitest files — **216/216 tests pass**. It includes project model, stable photo identity/share, pure 3D geometry/UV/camera behavior, no-WebGL recovery, JW catalog truth, named-route/anonymous denial, profile integration, Direct Connect gates, discovery law contracts, and production schema/migration contract shapes.
- `npm run build` — pass from the resulting working tree. Vite transformed 4,036 modules; public landing and built-asset URL checks passed; the server bundle completed.
- The lazy `StoneVisualizer3D` production chunk is 521,033 bytes minified and 133,425 bytes gzip. It is not part of the six public-landing startup assets. The raw-size warning remains a browser-performance observation item, not a startup-bundle regression claim.
- `git diff --check` — pass.
- Project index refreshed at the same dirty base: 3,547 source files, 18,973 symbols, 1,319 components, and inventory digest `a172740a8c2109d58af8383503f27b705ed655c3bc7b8282be053db1267e1f34`.
- Project-index doctor reports the refreshed index is not stale, but the repository-wide reuse gate remains not ready because it detects 1,115 existing exact-duplicate or competing-export-owner errors plus five raw-control warnings across the broader repository. Those pre-existing cross-repository consolidation findings were not rewritten as part of this JW-only slice.
- Independent implementation Objector final verdict: no remaining code-level P0 or P1 defect. The Objector separately sustains the browser-proof blocker below.

## Unperformed and blocked proof

- No real browser in this environment executed WebGL. JSDOM intentionally proves only the truthful no-WebGL recovery path; it does not prove texture upload, visual scene quality, actual orbit/pinch, one-finger page scrolling, reduced motion, context loss/recovery, GPU cleanup, or desktop/mobile framing.
- The cloud browser cannot reach this workspace's localhost, and the local runtime has no usable browser binary. No screenshot, mobile capture, console trace, or owner visual approval is claimed.
- The repository minimum-release gate was not attested: the tree is intentionally uncommitted, no disposable `TEST_DATABASE_URL` was in scope, and browser proof is missing. Running its remaining contract files directly produced 98/98 passing tests, but that is not a release-gate pass.
- No push, PR, merge, deploy, DNS, database, inventory, request submission, or production mutation occurred.

## Release frontier

Before any release claim, commit the authorized slice, run the real-browser matrix against that exact revision at desktop and mobile widths (all three scenes, max U plus island, simultaneous openings, exact-photo success/slow/failure, touch scroll/orbit, keyboard controls, reduced motion, context loss/Retry, cleanup and console), obtain owner preview GO, then run the full repository minimum-release gate with its required disposable database proof. Until then all eight active requirements remain release-invalidated even though the local implementation and automated build checkpoint are usable.
