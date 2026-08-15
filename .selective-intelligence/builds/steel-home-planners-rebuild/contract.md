# Build Contract: steel-home-planners-rebuild

Verdict: Definition locked; implementation authorized; release requires exact-revision browser proof
Base revision: `0d26709d5f0fcb0baf5c1bf37a02f50d3d88022e`
Lock version: `1.0.0`

## Product outcome

Deliver one useful Steel Home Planning Tools page with three independent professional planners—Countertops, Cabinets, and Metal Buildings—plus a direct route for each planner. This is not a whole-house designer and the three planners must not silently alter one another.

## Shared truth rules

- Every planner begins blank or use-led. A fresh project must not claim a selected product, finish, opening, island, accessory, or measured geometry that the user did not choose.
- One saved, versioned planning model must drive the visible plan, elevations, orbitable 3D scene, diagnostics, saved draft, and request handoff for that planner.
- The interface must not publish invented prices. Cabinet and metal planning remain `Quote required`; stone material and fabrication remain separate requests.
- Every request goes to TradeScout for manual dispatch. Public planner language must remain partner-neutral except for the JW Stone inventory source inside the countertop studio.
- All exact dimensions remain planning intent until field measurement, manufacturer templates, engineering, code review, and supplier confirmation are complete.
- Desktop, short-laptop, tablet, and phone layouts must be usable workbenches rather than long landing-page scrolls.

## Countertop planner

- Reuse the recovered Three.js spatial studio and actual JW Stone catalog photos.
- Fresh state has no selected stone, island, sink, cooktop, other opening, backsplash, edge, seam, waterfall, or floor-stone application.
- Room shell, finished-top height and thickness, island position, and every dimensional opening must be explicitly entered or remain visibly unresolved.
- Generic sink and cooktop choices are non-dimensional coordination intent until a template size is entered. A nominal range gap may use its selected nominal width and the full saved run depth, clearly labeled as planning intent.
- The scene must not invent cabinets, tubs, sofas, fireplaces, wall openings, or room dimensions. Stone ordering and fabricator handoff stay separate.

## Cabinet planner

- Provide explicit Kitchen, Bathroom Vanity, Laundry, Pantry, Built-in, and Blank starts.
- Model a measured room shell with doors, windows, obstacles, utilities, and user-placed cabinet/appliance/island modules.
- Plan, all-wall elevation, and orbitable 3D views must use the same eighth-inch geometry.
- Users can add, select, move, resize, change walls, and remove modules. Collisions, outside-room objects, blocked openings, and unreviewed measurements prevent a request.
- No fake price or hidden default appearance may enter a request.

## Metal building planner

- Provide a dated, source-backed, partner-neutral catalog that covers the actual public sellable baseline: uses/archetypes, structural systems, roof families, dimensions, colors, placed wall/roof openings, attachments, and accessories.
- Plan, four elevations, and orbitable 3D must derive from the same measured scene.
- Specialty roof dimensions and attachment vertical geometry remain unresolved until explicitly entered; footprint-only markers must say so.
- Compatibility and geometry diagnostics must fail closed for impossible placement while routing engineering, local wind/snow/seismic/code, and product availability to professional review.
- No early price range may appear.

## Persistence, recovery, and handoff

- Preserve current supported drafts, visibly recover malformed/current data, protect future-version drafts, and prevent silent cross-tab overwrites.
- Public share links exclude private notes and location.
- Request staging must fail closed and tell the user when the plan was not attached.
- Retired catalog choices remain visible and unrequestable until explicitly resolved.

## Proof contract

Required proof includes focused model/component/route tests, TypeScript, production build, formatting/diff checks, partner-name and dollar-amount scans, browser console inspection, WebGL success and fallback, keyboard/touch controls, and rendered journeys at desktop, short-laptop, tablet, and phone widths for all three planners. No merge or deployment may be called complete without exact-revision browser evidence and owner review.

