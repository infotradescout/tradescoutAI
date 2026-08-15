# Build Evidence: jw-stone-3d-visualizer

Verdict: Corrected branch implementation and automated gates pass; release remains blocked
Source: correction tree on branch `jw-stone/3d-visualizer-20260815`, parent `fb06a80a571ed8c7633c70004b2134d10d456324`, for open PR #332
Observed: `2026-08-15T13:42:56Z`
Configuration: active JW spatial-studio review-correction amendment `1.4.1`

## Planned versus actual

- The existing countertop planner lazy-loads a real Three.js/WebGL spatial studio for Kitchen, Bathroom, and Living Room without creating another inventory authority.
- One Three unit equals one foot. Entered runs and islands are not visually capped; L/U shared corners are not double-modeled; camera fitting accounts for portrait and desktop aspect ratios; fog does not erase max-size rooms.
- Complete sink, cooktop/range, and other-opening placements are modeled with longitudinal and front offsets. Incomplete placements are omitted and announced instead of invented. Seams, backsplash, floor, edges, and valid island waterfalls derive from normalized planner state.
- The selected canonical catalog photo uses a stable opaque identity across local save, design-only share, measured plan, WebGL texture, recovery image, named image route, and Direct Connect handoff. Invalid or stale shared photo identity falls back independently without discarding the remaining valid design.
- Texture transforms preserve one in-flight source load and reuse GPU-facing maps for crop/scale/vein updates. Slow loads expose a truthful loading state and timed Retry; WebGL Retry remounts a new canvas; initialization and cleanup are idempotent; idle/offscreen/reduced-motion rendering is bounded.
- Design-only sharing now bypasses affiliate lookup and makes no network request. Clipboard rejection exposes the exact URL in a selectable read-only field. Local-storage failure reports a visible, announced terminal state at mobile width instead of perpetual “Saving.”
- Two newly split inventory records no longer reuse released public identifiers. Legacy `soapstone` resolves to Marina Black Soapstone and legacy `carrara-white-brazil` resolves to Bianco Carrara across catalog lookup, URL state, SSR metadata, and saved wishlists; the new photographed records use distinct slugs.
- Public address and social identity remain readable, but map/social outbound actions no longer bypass the required intent-to-request gate.
- Shared links exclude notes and location and ask before replacing an existing saved draft. Stone purchase and fabricator requests remain separate deliberate actions, use existing Direct Connect, disclose no private price/source-count fields, and mark availability as confirmation required with JW Stone.
- Default state is primary countertop only: no island, backsplash, floor stone, sink, cooktop, other opening, seam, waterfall, or edge treatment is silently added.

## Automated evidence

- `npm run check` — pass on the settled correction tree.
- One changed-and-platform contract run across 42 Vitest files — **272/272 tests pass**. Coverage includes project model, stable photo identity/share, zero-network sharing, invalid-field recovery, save/clipboard failure recovery, pure 3D geometry/UV/camera behavior, no-WebGL recovery, JW catalog identity and legacy aliases, wishlist migration, named-route/anonymous denial, profile integration, Direct Connect gates, discovery law contracts, and public metadata.
- `npm run build` — pass. Vite transformed 4,037 modules; public-landing and built-asset URL checks passed; the server bundle completed.
- The lazy `StoneVisualizer3D-CMubO8Er.js` production chunk is 521,033 bytes with SHA-256 `a03a64881e17d6dc37d1ea90ec2ceffdf57a0127695f5511c91dff83a83f0c51`. It is not part of the six public-landing startup assets.
- `git diff --check` — pass.
- Project index refreshed from the settled dirty tree: 3,549 source files, 18,977 symbols, 1,319 components, and inventory digest `f3e074a6016e184650f953354dafd3ae2804114eaa78e1e7ab656ca191a22858`.
- Project-index doctor reports the index is not stale, but the repository-wide reuse gate remains not ready because it detects 1,115 existing exact-duplicate or competing-export-owner errors plus five raw-control warnings across the broader repository. Those pre-existing repository-wide findings were not rewritten in this JW-only slice.
- Independent review reproduced concrete P1 defects in the previous branch revision. The final settled-tree Objector found no remaining reproducible code-level P0/P1; its 10-file verification passed 92/92 tests, TypeScript, and `git diff --check` without editing the tree.

## Remote and release state

- PR #332 is open for branch `jw-stone/3d-visualizer-20260815`.
- The product owner explicitly authorized committing and pushing the correction tree. The remote ref and exact tree are verified only after that push; this ledger does not pre-claim the result.
- No merge, deployment, DNS, database, request submission, inventory mutation outside the versioned catalog projection, owner visual approval, or production live claim is authorized or recorded.

## Unperformed and blocked proof

- No real browser in this environment executed WebGL. The exact prior commit passed isolated TypeScript, 99 focused tests, and production build, but its browser attempt remained blocked; that prior revision is not substituted as visual proof for this correction tree.
- The cloud browser cannot reach this workspace localhost, the local runtime has no usable Chrome/Chromium binary, and the allowed network path could not install one. No screenshot, mobile capture, console trace, actual texture upload, gesture journey, context-loss recovery, or owner visual approval is claimed.
- The repository minimum-release gate was not attested. A disposable `TEST_DATABASE_URL` and real-browser proof are outside the available environment.
- All eight active requirements remain release-invalidated. Automated implementation evidence does not close the browser/owner or minimum-release gates.

## Release frontier

After the correction branch is pushed, run the real-browser matrix against that exact remote revision at desktop and mobile widths: all three scenes, max U plus island, simultaneous openings, exact-photo success/slow/failure, touch scroll/orbit, keyboard controls, reduced motion, context loss/Retry, cleanup, framing, and console. Then obtain owner preview GO and run the full repository minimum-release gate with its required disposable database proof. Until those steps pass, the branch may be reviewed but must not be merged or deployed as a completed release.
