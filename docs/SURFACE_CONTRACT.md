# TradeScout — App Surface Contract

This document defines the single authority for layout, spacing, borders,
backgrounds, scrolling, and navigation.

If a UI element violates this contract, it must be corrected.
No exceptions.

---

## 1. Layout Spine (Single Source of Truth)

All UI must conform to this hierarchy:

AppSurface
→ AppShell
→ AppFrame
→ FeatureSurface
→ FeatureContent

No layer may skip levels.
No feature may invent its own surface.

---

## 2. Ownership Rules (Non-Negotiable)

### AppSurface
Owns:
- <body> background
- viewport height (100vh)
- global overflow behavior
- root glass / blur effects

May NOT:
- render feature UI
- contain feature padding

---

### AppShell
Owns:
- global navigation (top, side, mobile)
- global spacing margins
- app-wide borders and dividers
- global z-index layering

May NOT:
- introduce feature-specific layout
- manage feature scroll areas

---

### AppFrame
Owns:
- primary content frame
- inner background surface
- scroll containment for the app body

Rules:
- Only ONE scroll container is allowed per page
- That scroll container lives here

---

### FeatureSurface
Owns:
- feature-local layout (columns, grids)
- internal spacing between feature sections

May NOT:
- apply outer borders
- apply viewport padding
- set background on <body> or AppShell
- introduce glass, blur, or shadow at the app edge

---

### FeatureContent
Owns:
- cards
- forms
- tables
- modals
- dialogs
- widgets

This is where visual variation is allowed.

---

## 3. Borders & Padding Rules (The Border Kill Switch)

Allowed:
- Borders BETWEEN cards
- Borders INSIDE FeatureContent
- Section dividers inside FeatureSurface

Forbidden:
- Borders at the viewport edge
- Borders wrapping entire pages
- Padding on <body> or AppSurface
- “Just this one exception” borders

If you see a mystery border:
→ It is a contract violation, not a CSS bug.

---

## 4. Background Rules

- AppSurface defines the app background
- AppFrame defines the inner canvas
- FeatureSurface may use transparent backgrounds only
- FeatureContent may define card backgrounds

No feature may:
- override the app background
- set body or html background styles

---

## 5. Scroll Rules (Critical)

- ONE vertical scroll container per route
- That container lives in AppFrame
- Features may not create competing scroll contexts

Horizontal scrolling is allowed only inside FeatureContent.

---

## 6. Navigation Authority

- AppShell is the ONLY owner of navigation
- Features may request navigation via callbacks
- Features may not:
  - render nav bars
  - reposition global nav
  - conditionally hide nav

---

## 7. Enforcement Philosophy

TradeScout UI favors:
- consistency over customization
- predictability over clever layouts
- enforcement over flexibility

Features remain powerful.
Surfaces remain disciplined.

This is how the app feels cohesive.


This document is now law.
