# Actual Intent Lock

Project: JW Stone 2.0
Release: `jw-stone-2-0-r1` / amendment 1.4.0
Authority: Thomas, product owner, approved in the current workstream on 2026-08-15
Status: locked for definition

## Outcome and primary value event

Replace the form-led countertop planner with a real spatial studio inside the existing JW Stone planner route. A visitor chooses an actual JW catalog selection, sees it mapped onto correctly scaled kitchen, bathroom, or living-room geometry, adjusts crop, vein direction, and texture scale, optionally adds fabrication details, saves or safely shares the design, and deliberately sends the measured selection to TradeScout for confirmation.

## Non-negotiables

- The checked-in JW inventory projection remains the only inventory authority. The studio is a read-only consumer and never creates a parallel inventory ledger.
- Catalog presence, stored source counts, and slab photographs do not prove live availability. Public and handoff states say that JW confirmation is required unless a future canonical inventory field explicitly proves otherwise.
- Real JW images are used as surface textures. Crop, offset, rotation, vein direction, repeat, and physical scale are explicit design state and must survive save/share.
- Kitchen, bathroom, and living-room scenes support orbit, zoom, camera reset, and understandable real-world dimensions.
- Sinks, cooktops, seams, waterfalls, backsplashes, floors, and edge choices are optional. The default has no sink, cooktop, or opening.
- Public price and private cost never render, serialize, enter a share URL, or enter analytics. The fabricator handoff contains measurements, selections, applications, openings, seams, edge, waterfall, and slab/source context only.
- Saving is local and does not contact anyone. A share payload is bounded, design-only, and excludes address, notes, contact information, price, and internal-only facts.
- Sending remains an explicit action through the existing gated TradeScout request flow. All inquiries route to TradeScout for manual handling in this release.
- Desktop, mobile, keyboard, reduced-motion, loading, texture failure, and WebGL-unavailable recovery need observable proof.

## Preserved owner override

Earlier customer-path guidance, Learn about stone, yellow or amber eyebrows, Call-for-availability marketing, doctrine fact grids, and unsolicited recommendation theater remain void. The separate `/jw-stone` marketplace, current JW profile, canonical inventory, no-price rule, deliberate contact boundary, and no-merge-without-owner-GO rule remain protected.

## Completion proof

Definition approval does not prove implementation or release. Completion requires focused state and serialization tests, real-browser desktop/mobile/keyboard evidence from the exact revision, a WebGL failure recovery check, no-price and no-contact-on-save scans, inventory-authority reconciliation, and owner preview GO before any push, merge, or deployment claim.
