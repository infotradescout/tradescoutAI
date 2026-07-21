# Profile site template taxonomy

Status: active reference  
Purpose: Lock the selectable v1 gallery and plan the ~200 business-specific templates without inventing a page builder.

## V1 gallery (ship now)

Anyone can pick one of these and run:

| id | Label | Renderer today | Seed examples |
|----|--------|----------------|---------------|
| `wholesaler` | Wholesaler | `WholesalerProfileTheme` | JW Stone, ISSA Build |
| `auto-glass` | Auto glass | `JrsAutoGlassProfileTheme` | JR's Auto Glass |
| `plumbing-company` | Plumbing company | `LocalServiceProfileTheme` | LA Plumbing Solutions |
| `electrician-solo` | Electrician (solo) | `LocalServiceProfileTheme` + electrician seed | New owners |

Runtime-only (not in gallery):

| id | Purpose |
|----|---------|
| `default` | Untemplated / legacy profiles and temporary shells (e.g. Pro Fab until a fabrication template ships) |

Storage:

```json
{ "type": "siteTemplate", "data": { "id": "plumbing-company" } }
```

Resolution order: explicit `siteTemplate` block → slug/partner seed → `default`.

## Product rules (stable)

1. Templates are **business-specific layouts**, not freeform builders.
2. Owners and super-admins edit on the live profile + `/u/:slug/edit`.
3. Contact stays gated (Intent → Decision Card → Contact). Visibility ≠ access.
4. New templates add: catalog entry, seed presentation, renderer mapping, contracts — not a new CMS.
5. Prefer **families** (shared chrome + slots) with **business skins** (copy, icons, default services, imagery) over 200 unrelated React trees.

### Hard law on every public profile (v1 and all ~200 later)

These are not optional theme chrome. Every selectable and default renderer must include:

| Invariant | Required surface |
|-----------|------------------|
| Trust section | `trustActions` / `PublicProfileTrustActions` always rendered |
| TradeScout footer | `TradeScoutProfileHandoff` at the absolute bottom (Scout / Community / Exchange / HomeID) |
| Contact path | Direct Connect only (`ExpressDirectConnectPanel` / `startDirectConnect`) — no public `tel:` / `mailto:` / raw phone-email CTAs |

Ship checklist item 6 already requires Direct Connect stay gated; items above are contract-tested in `profile-site-law-invariants.contract.test.ts`.

## Target: ~200 business-specific templates

### How to count without chaos

- **Family** = shared layout shell + editable slots (hero, services, gallery, trust, CTA, optional inventory).
- **Business template** = family + default copy/services/imagery cues for one business type (e.g. `hvac-residential`, `roofing-company`, `landscaping-crew`).
- Goal band: **180–220** selectable business templates over time; v1 ships **4**.

### Family backlog (priority order)

| Family | Est. templates | Notes |
|--------|----------------|-------|
| Mechanical trades | 35–45 | Plumbing (done), HVAC, septic, boiler, drain cleaning, gas fitting, … |
| Electrical | 15–20 | Solo electrician (done), residential electrician company, low-voltage, solar install, generator, … |
| Vehicle / mobile | 20–25 | Auto glass (done), mobile mechanic, detailing, tire, towing, body shop, … |
| Inventory / wholesale | 15–20 | Wholesaler (done), lumber, HVAC supply, electrical supply, appliance parts, … |
| Building envelope | 20–25 | Roofing, siding, windows, insulation, waterproofing, … |
| Finish trades | 25–30 | Painting, flooring, tile, drywall, cabinetry, countertops, … |
| Outdoor / site | 15–20 | Landscaping, fencing, concrete, excavation, tree service, … |
| Specialty fabrication | 10–15 | Metal fab (Pro Fab path), welding, millwork, glass shop, … |
| Home services other | 20–25 | Cleaning, pest, appliance repair, locksmith, moving, … |
| Professional / B2B light | 10–15 | Inspection, estimating, design-build PM — only where TradeScout law fits |

Sum of midpoints ≈ **200**. Exact IDs land when a county path needs them; do not pre-build empty React themes.

### Naming convention

```
{trade}-{scale?}
```

Examples: `plumbing-company`, `electrician-solo`, `hvac-residential`, `roofing-company`, `auto-glass`, `wholesaler`.

- `solo` = individual / small crew lean layout  
- `company` = multi-crew / multi-service company layout  
- omit scale when the business type already implies it (`auto-glass`, `wholesaler`)

### Ship checklist for each new template

1. Add id + meta to `shared/profileSiteTemplates.ts` (`selectable: true`).
2. Add seed presentation (or inventory) in the same module or a sibling seed file.
3. Map id → renderer in `ProfileSiteView` (reuse a family shell whenever possible).
4. Expose editable slots in editor + live chrome.
5. **Law chrome:** trust section + `TradeScoutProfileHandoff` footer + Direct Connect–only contact (pass `profile-site-law-invariants` contract).
6. Contract: resolution, seed, and one happy-path save.
7. One county path proof (publish → public view → Direct Connect still gated).

### Explicit non-goals

- Not 200 unique visual design systems.
- Not MealScout / cross-product templates.
- Not pay-to-play featured placement inside templates.

## Next slices after v1

1. Finish owner/super-admin live edit + template gallery for the four v1 ids.
2. Add `hvac-residential` and `roofing-company` as the first expansion from mechanical / envelope families.
3. Retire Pro Fab’s slug-only path into `metal-fabrication` (specialty fabrication family).
