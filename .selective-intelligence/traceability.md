# Traceability — Spatial Studio 1.4.0

| Intent or prohibition | Requirement | Surface | Canonical owner | Planned proof |
| --- | --- | --- | --- | --- |
| Navigable real 3D rooms | JW-3D-SCENES | Kitchen, Bathroom, Living Room viewport | `jw-stone-3d-scene` | Component/state tests plus desktop/mobile orbit, zoom, reset, and scale captures |
| Actual JW imagery with controllable mapping | JW-3D-MATERIAL-TRUTH | Stone selector and texture inspector | `jw-stone-3d-material` | Catalog ID/image reconciliation and crop/offset/scale/vein round trips |
| Optional fabrication, no-opening default | JW-3D-FABRICATION | Fabrication inspector and measured summary | `jw-stone-planner-model` | Default/geometry/serialization tests and visible scene comparison |
| One inventory authority; confirmation required | JW-3D-INVENTORY-TRUTH | Selection details and handoff summary | `jw-stone-catalog` | Canonical import audit, forbidden live-stock assertions, no mutation path |
| Local save and safe design-only share | JW-3D-SAVE-SHARE | Save/share actions | `jw-stone-planner-model` | Persistence, corruption, URL bounds, privacy and no-contact tests |
| Existing gated TradeScout handoff; no prices | JW-3D-HANDOFF | Request drawer and summary | `jw-stone-planner-request` | No request on open/save/share, payload allowlist, scalar compatibility |
| Mobile, keyboard, reduced-motion, and failure recovery | JW-3D-ACCESS-RECOVERY | Viewport, inspector, fallback summary | `jw-stone-3d-studio-ui` | 390/1440, keyboard, reduced-motion, texture and WebGL failure evidence |
| No implementation or release claim without proof | JW-3D-PROOF | Build and release gates | `jw-stone-3d-build` | Exact revision ledger, tests, screenshots, independent review, owner GO |

Earlier JW-GUIDANCE and JW-LEARNING behavior remains void. Existing marketplace/profile behavior is protected unchanged by every included requirement.
