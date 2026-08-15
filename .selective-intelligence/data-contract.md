# Data Contract — Spatial Studio 1.4.0

## Canonical facts

The selected material is referenced by a stable public JW catalog ID and rejoined from the current canonical catalog for name, images, material, finishes, source evidence, and parsed slab dimensions. Catalog inclusion and recorded source counts are historical/source evidence, not live availability. The studio-derived availability state is always `confirmation_required` until a future canonical field explicitly supplies a stronger state.

## Design state

The versioned design envelope contains only allowlisted presentation and fabrication fields: room/scene, layout and physical dimensions, selected public stone ID, supported surface applications, texture crop offsets, texture scale, vein rotation, edge, backsplash, optional sink/cooktop/other openings, seams, waterfalls, and non-sensitive design notes when stored locally. Values are bounded, finite, normalized, and independently recoverable.

Defaults are Kitchen, the existing measured layout, a valid catalog selection, and no sink, cooktop, other opening, seam, or waterfall. Surface applications default to the primary countertop only. Changing scenes preserves compatible state and safely ignores incompatible placements.

## Save, share, handoff, and lifecycle

Local save may include the full bounded design envelope and contains no contact, address, public/private price, or duplicated inventory facts. Share state is a smaller design-only projection: it excludes notes, location, contact, job identifiers, availability assertions, source counts, and internal labels. It is versioned, length-bounded, and allowlisted on parse.

The request projection is generated at deliberate handoff and includes measurements, safe stone identity, image/source reference, scene/applications, crop/vein/scale, openings, seams, edge, waterfall, and the `confirmation_required` inventory note. Existing request infrastructure owns contact retention and deletion. No new server persistence, inventory mutation, backup, restore, or migration exists.
