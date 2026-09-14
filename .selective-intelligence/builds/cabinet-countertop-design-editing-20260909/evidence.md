# Cabinet and countertop design editing — implementation evidence

Date: 2026-09-09
Base: `60dd7379266bd22f2304a9b2833fad3e7d375759`
Implementation checkpoint before this evidence file: `837f2fda57289ddefac474c8653ea85ac3308621`
Branch: `jw-stone/cabinet-countertop-design-editing-20260909`
Verdict: Code committed; isolated geometry checks pass. Full application and browser validation remain unexecuted. Not release-ready or deployed.

## User-directed scope

Improve the existing cabinet and countertop design tools. Do not replace this with account/pricing research, a new whole-home product, or changes to flooring and metal-building tools.

## Implemented changes

Cabinets: render-only casework geometry for doors, drawer fronts, frame rails, toe-kicks, open shelves, glass and explicitly chosen handles; optional saved style/finish/hardware and per-module front arrangements; undo/redo, duplicate selected module, dimensioned review and text export. The camera is kept separate from scene updates so ordinary edits do not re-create the renderer and reset the camera. Orbit-drag selection has a movement threshold. WebGL failure/context-loss handling remains visible.

Countertops: undo/redo and a separate uniformly scaled review drawing with measured straight/L/U contours, explicit island position, opening schedule and SVG export. Both SVG axes use inches. Unknown island positions are omitted and explained rather than fabricated. The export includes a visible planning-only/field-verification warning. The existing measured editor and its stone/photo, 3D and request workflows remain in place.

The existing cabinet geometry model is preserved as `cabinetPlannerGeometry.ts` at original blob `d522f161d635d23bedd1736cb2c687a5d25300d3`. The existing measured cabinet editor is preserved as `CabinetMeasuredEditor.tsx` at original blob `47673ba85eb5f6296bcfd63d3908b8ff99bd644c`. The canonical model adapter adds optional presentation to the existing measured draft rather than introducing a new storage authority. Blank and legacy drafts do not acquire an invented appearance selection. Final field measurements, manufacturer specifications, pricing and fabrication approval are not claimed by preview geometry.

PR #614's separate furnished-room/photo-sharing upgrade is not merged into or claimed by this branch.

## Executed verification

The two dependency-free helpers were materialized in a local partial mirror and independently checked against their committed Git blob hashes:

- `cabinetCasework.ts`: `2996130379b409dc88a0e71cffd8e43c99968b3b`
- `countertopPrecisionGeometry.ts`: `0936a001d83e2673b0fb013f64b2211fa7b20011`

Node v22.16.0 executed the checked-in runner's equivalent local copy:

```sh
node /mnt/data/kitchen-validation/repro/scripts/tests/kitchen-design-geometry.node.mjs
```

Reproducible command in a dependency-installed checkout:

```sh
node scripts/tests/kitchen-design-geometry.node.mjs
```

Result: **9/9 groups passed**, including **6,400 cabinet configurations and 119,320 generated parts** checked for finite positive dimensions and containment within the measured module envelope. Other checks cover fronts and optional handles, appliance-space preservation, invalid dimensions, four-wall orientation, a 600-inch uncompressed countertop, L/U corner coordinates, unknown island placement, negative island offsets and invalid return geometry. TypeScript transpilation of these two helpers reported no syntax diagnostics. This is not whole-application type checking.

An initial local CJS test harness failed because it declared a variable named `module`; the runner was corrected and re-executed successfully. That preparation failure is not counted as a passing run.

## Added but not executed

- Fifteen Vitest tests in `kitchenDesignerStudio.test.ts` cover presentation sanitization, duplication, undo/redo and geometry. No Vitest pass is claimed.
- `scripts/prepare-kitchen-studio-review.mjs` builds a review harness from the actual editor components and existing local-draft functions, and defines desktop/mobile Playwright checks for controls, cabinet WebGL, appearance reload, duplication, history and countertop drawing export. The script has not run. No screenshot or browser pass exists yet.
- `scripts/serve-kitchen-studio-review.mjs` serves only generated review assets and strictly scoped public stone images. It provides no production API or write path.
- Full `npm run check`, existing feature/regression suites, production build and unchanged asset/bundle guards, and `npm run gate:minimum-release` have not run. No application-level baseline verdict is claimed.
- Account-backed cross-device persistence, live request delivery, supplier data and authenticated production journeys are outside this verification.

## Execution blockers and release boundary

The local container could not resolve GitHub for a full checkout and lacked the React/Three/Vitest/Playwright application dependency set. The connected desktop was offline. Creating an isolated Render review service returned `no workspace selected` before any service or build was created. The available workspace was listed and the owner was asked to confirm it; no workspace was selected or write retried without confirmation.

No main merge, deployment, database write, real request, account change, private-price exposure, GitHub Actions workflow, or production release switch occurred. Keep this PR draft until exact-head application validation and desktop/mobile editor proof succeed. Appearance rendering remains illustrative, not photorealistic material matching or manufacturing geometry.
