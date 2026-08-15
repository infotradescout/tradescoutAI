# Architecture and Canonical Ownership — Spatial Studio 1.4.0

## Operating envelope

The studio extends the existing JW Stone planner mounted by `SteelHomePackagesProfile.tsx`. `CountertopDesigner.tsx` remains the orchestration boundary and reuses the existing planner state, measured-layout logic, request drawer, routing, and browser persistence. A dedicated visualizer component owns render-only 3D scene composition and receives typed design state; it does not own inventory, contact, or pricing.

## Canonical ownership and dependency direction

- `client/src/data/jwStoneInventory.ts` remains the source inventory projection.
- `client/src/features/jw-stone/catalog.ts`, `types.ts`, and `slabDimensions.ts` remain the read-only catalog, public identity, imagery, and parsed-dimension owners.
- `projectModel.ts` owns validated planner state, defaults, safe serialization, and request summary fields.
- `CountertopDesigner.tsx` owns the studio journey and inspector composition.
- A focused `StoneVisualizer3D` module owns Three.js scene geometry, texture transforms, cameras, controls, and WebGL recovery only.
- `SteelHomePlannerRequest.tsx` and existing Direct Connect infrastructure retain the only inquiry boundary.

Dependencies point from visualizer and planner surfaces toward the typed model and canonical catalog. The catalog never depends on the visualizer. The studio cannot write availability, source count, slab allocation, price, or inventory identity. Existing marketplace/profile modules do not depend on the studio.

## Reuse, creation, and release boundary

Reuse JW assets, catalog projection, local save envelope, measurement logic, request handoff, and accessible primitives. Create only the 3D renderer and the minimum typed state required for scene, application, texture transform, seams, and waterfalls. A rendering dependency is acceptable only if pinned, client-only, recoverable, and covered by the project dependency audit.

No database, API, authentication, inventory service, routing authority, deployment target, or migration is introduced. Rollback before release is branch closure; after separately authorized release it is an application commit revert because the amendment creates no persistent server data.
