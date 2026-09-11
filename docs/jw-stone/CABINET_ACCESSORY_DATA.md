# Cabinet accessory data and release boundary

Scope: generic measured filler strips and finished end panels in the existing cabinet planner. Corner assemblies, manufacturer catalogs, structural approvals and automatic gap bridging are not included.

## Data

The existing local project draft and nested cabinet planner gain two recognized module kinds: `filler` and `end-panel`. Accessories also retain `wallInsetIn`, the measured distance from the named wall to the back of the actual panel. The field is ignored for floor placement and omitted from ordinary cabinet/appliance modules. Existing valid drafts without accessories retain their previous shape and geometry.

All dimensions are inches on the existing 1/8-inch grid. Library addition and setback application reject missing, non-finite, off-grid, out-of-range, intersecting or out-of-room proposals. Width/depth/height describe the actual rectangular panel, not a full-depth cabinet envelope. The displayed starter sizes and setback are explicit editable choices, not field measurements or manufacturer specifications.

No database table, schema migration, account, price book or contact-routing change is involved. The local project storage key remains v9; nested planner version remains 1 with additive kinds/field. This is compatibility with prior valid DATA, not compatibility with older application binaries. Older deployed code does not recognize these module kinds. Reload older open planners before editing new accessory designs. A roll-forward repair must retain the accessory-aware reader; do not blindly roll back the reader or downgrade/export accessory data as ordinary cabinets. Keep a copy of local draft JSON before any operator-directed downgrade.

## Rendering and quantities

Accessories use one exact rectangular panel in the shared 3D/front geometry, with selected finish but no cabinet doors, drawers or handles. They remain movable/selectable in the existing plan. Duplicates retain type and wall setback. Schedules show accessory quantities separately from cabinet and appliance counts, including exact dimensions and wall setback. CSV exports continue to exclude notes/contact details and escape user-controlled fields.

## Countertops

Only existing base/island cabinet kinds qualify as supports. Accessories are shown as excluded objects. A front filler never supplies the missing support depth behind it, and a side panel does not automatically extend a countertop. Existing footprint gap, intersection, exact-save, approval and review checks stay in effect. A panel that intersects the proposed finished top must still block import. Independent structural, material, field-templating and working-clearance decisions are not inferred.

## Verification

`node scripts/verify-cabinet-accessories.mjs` deterministically extends the hash-pinned existing cabinet-library verifier with additional actual-parent desktop/touch accessory journeys before its unchanged strict release gate. The extension is executed in memory, without rewriting tracked files or the gate. New unit tests cover actual save reconciliation, every wall orientation, thin-panel bounds, counts, duplicate/move behavior, setback rejection and countertop support exclusion. Browser checks cover preview/add/setback, complete Undo/Redo, separate counted CSV/elevations, reload/3D, unsupported filler gaps and an exact supported countertop import.

Passed, failed and unexecuted results must be recorded on the PR. A report host being live is not a passing verdict. Production verification targets the exact merged build marker and uses synthetic anonymous local drafts with non-GET/HEAD requests blocked.
