# UI Surface Violation Report

Date: 2025-12-27  
Scope: Live routes only (per AppShell/App router)  
Contract: docs/SURFACE_CONTRACT.md

This report is analysis-only. No code changes are proposed or implied.
All findings are backed by concrete code in the current repo.

---

## 1. Summary by Contract Area

| Area                    | Status          | Notes |
|-------------------------|-----------------|-------|
| Layout spine usage      | Partial / Pass  | AppShell provides a single scroll root; most pages plug into it, but some pages behave as if they own the whole viewport. |
| Borders & padding       | Partial / Fail  | Multiple pages apply full-viewport backgrounds and padding that belong to AppFrame/AppShell, not FeatureSurface. |
| Background ownership    | Partial / Fail  | Many FeatureSurfaces set `min-h-screen` + page-level backgrounds, effectively shadowing the app canvas. |
| Scroll containment      | Partial / Pass  | AppShell defines a single vertical scroll container (`#app-scroll-root`); feature pages mostly avoid extra page-level scroll areas, with some local scroll inside dialogs (allowed). |
| Navigation ownership    | Pass            | AppShell clearly owns main navigation; pages do not define alternate nav bars. |

---

## 2. Confirmed Surface Violations

Each item: file, component/route, contract section, and reason. Only live routes (as wired in `client/src/App.tsx`) are included.

### 2.1 FeatureSurfaces claiming viewport background & height

**Pattern**: Many page components treat themselves as full-screen surfaces using `min-h-screen` plus their own background color/gradient. This conflicts with the contract:
- AppSurface owns `<body>` background and viewport height.
- AppFrame owns the inner canvas and scroll container.
- FeatureSurface must be transparent relative to AppFrame and must not set its own viewport background.

Representative examples (non-exhaustive but confirmed):

1. `client/src/pages/accelerator.tsx`
   - Snippet: `div` with `className="min-h-screen gradient-bg"` at the top level.
   - Contract: Sections 1–4 (Layout Spine, Background Rules).
   - Why it violates:
     - The page declares its own viewport-height surface and background gradient instead of rendering inside the AppFrame canvas.
     - This effectively re-creates an AppSurface-like background inside FeatureSurface.

2. `client/src/pages/about.tsx`
   - Snippet: `div` with `className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"` wrapping the page.
   - Contract: Background Rules; FeatureSurface may use transparent backgrounds only.
   - Why it violates:
     - Sets a full-page gradient background anchored to the viewport rather than allowing `AppShell` / `AppFrame` to own the canvas.

3. `client/src/pages/address-verification.tsx`
   - Multiple wrappers: `div` elements with `className="min-h-screen bg-[#0f1419] ..."`.
   - Contract: Background & Layout spine.
   - Why it violates:
     - The feature page asserts its own viewport-sized background multiple times, layering over the app canvas.

4. `client/src/pages/admin-affiliates.tsx`
   - Top-level wrapper: `div className="min-h-screen bg-slate-950 text-white pt-24 px-4 pb-16"`.
   - Contract: Background Rules; FeatureSurface may not apply viewport padding.
   - Why it violates:
     - Uses `min-h-screen` plus heavy padding as if it owns AppFrame.
     - Combines background color and outer padding at the page root, which should live in AppFrame.

5. `client/src/pages/admin-attachments.tsx`
   - Wrappers include `div className="min-h-screen bg-navy-900 text-white p-6"`.
   - Contract: Sections 2–4.
   - Why it violates:
     - FeatureSurface assigns a full-viewport background and global padding at the route level.

6. `client/src/pages/admin-panel.tsx`
   - Uses `div className="min-h-screen bg-slate-950 ..."` and a secondary `min-h-screen` wrapper.
   - Contract: Layout spine & Background Rules.
   - Why it violates:
     - Duplicates an AppFrame-like surface inside a FeatureSurface.

7. `client/src/pages/affiliate.tsx`
   - Several `div` wrappers with `className="min-h-screen gradient-bg ..."`.
   - Contract: Background Rules.
   - Why it violates:
     - Defines its own full-screen gradient background and global padding around all content.

8. `client/src/pages/analytics.tsx`
   - Wrapper: `div className="min-h-screen bg-gradient-to-br ... p-6"`.
   - Contract: Background & Borders & Padding Rules.
   - Why it violates:
     - Uses `min-h-screen` and global padding on the feature page surface instead of deferring to AppFrame.

9. `client/src/pages/chat.tsx`
   - Wrapper: `div className="min-h-screen gradient-bg ..."`.
   - Contract: Background & Layout spine.
   - Why it violates:
     - Chat behaves as a full-screen surface with its own gradient background instead of a FeatureSurface inside the AppFrame.

10. `client/src/pages/contractor-dashboard.tsx`
    - Wrapper: `div className="min-h-screen bg-tsBg text-tsTextMain"`.
    - Contract: Background Rules.
    - Why it violates:
      - Sets a page-level background color tied to the viewport; should render against the AppFrame canvas.

11. `client/src/pages/county-directory.tsx`, `client/src/pages/crm.tsx`, `client/src/pages/county-hub.tsx`, `client/src/pages/application-tracker.tsx`, and similar routes
    - All share the `min-h-screen` + gradient/bg pattern at the top of the page.
    - Contract: Sections 1–4.
    - Why they violate:
      - Each page declares itself as the viewport owner (height + background), instead of being a transparent FeatureSurface stacked over AppFrame.

**Impact & Priority**:
- Impact: Visual inconsistency across routes; harder to maintain a single theming and layout spine; increases risk of “mystery borders” and scroll anomalies.
- Priority: Medium–High for heavily used surfaces (e.g., `/chat`, `/contractor-dashboard`, `/community-feed`-style layouts); Medium elsewhere.


### 2.2 Page-level padding that belongs to AppFrame

**Pattern**: Many of the same pages above apply large, route-level padding (e.g., `p-6`, `py-10 px-4`) on top of `min-h-screen`, effectively acting as the AppFrame.

Representative examples:

1. `client/src/pages/admin-affiliates.tsx`
   - `div className="min-h-screen bg-slate-950 text-white pt-24 px-4 pb-16"`.
   - Contract: Borders & Padding Rules.
   - Why it violates:
     - Outer padding on the viewport surface conflicts with the rule that AppShell/AppFrame own global spacing margins.

2. `client/src/pages/county/transparency.tsx`
   - Wrapper: `div className="min-h-screen bg-gradient-to-br from-slate-50 to-white py-10 px-4"`.
   - Contract: Borders & Padding Rules; Background Rules.
   - Why it violates:
     - Combines viewport background and route-level padding at a FeatureSurface layer.

3. `client/src/pages/community-builder/dashboard.tsx`
   - Wrappers like `div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4"`.
   - Same reasoning as above.

**Impact & Priority**:
- Impact: Mixed spacing regimes; difficult to achieve consistent gutters and scroll behavior across routes.
- Priority: Medium; fixing will centralize padding in AppFrame and simplify future layout work.


### 2.3 Potential edge-case scroll layering

**Pattern**: The contract demands **one** vertical scroll container per route, owned by AppFrame. AppShell complies with this via:
- `client/src/components/layout/AppShell.tsx`:
  - `main#app-scroll-root` is `absolute` with `overflow-y-auto`, bounded between top and bottom nav heights.

Within that, some components create local scroll areas that are likely compliant (dialogs), but they require awareness to avoid “page inside a page” scroll.

Examples (not counted as hard violations, but noteworthy):

1. `client/src/pages/admin-error-reports.tsx`
   - `DialogContent` with `className="... max-h-[80vh] overflow-y-auto"`.
   - Contract: Scroll Rules.
   - Why it is *likely compliant*:
     - Localized scroll inside a modal; the outer AppFrame still owns primary scroll. This behaves like FeatureContent-local scroll, which is allowed.

2. `client/src/pages/chat.tsx`
   - `DialogContent` with `className="... max-w-6xl max-h-[90vh] overflow-y-auto"`.
   - Same reasoning: dialog-local scroll within the main scroll container.

**Impact & Priority**:
- Impact: Low; behavior matches “horizontal or local scroll allowed in FeatureContent”.
- Priority: Low; no change needed unless UX reports nested-scroll friction.

---

## 3. Non-Issues (Explicitly Considered, Not Violations)

### 3.1 Single scroll container in AppShell

- File: `client/src/components/layout/AppShell.tsx`.
- Implementation:
  - `main#app-scroll-root` is the **only** vertical scroll container at the shell level (`overflow-y-auto`, bounded by top/bottom nav heights).
  - `AppShell` itself is `h-full w-full overflow-hidden` and does not scroll.
- Contract: Scroll Rules.
- Why it is compliant:
  - Exactly one primary vertical scroll area per route as required.
  - Feature pages render inside this `main`, rather than creating their own page-level scroll roots.

### 3.2 Dialog-local scrolling

- Files: various pages with `DialogContent` + `max-h-[80vh]` / `max-h-[90vh]` + `overflow-y-auto`.
- Contract: Scroll Rules.
- Why it is compliant:
  - These are FeatureContent-local scroll regions inside modals, which is allowed and often necessary for usability.

### 3.3 Borders inside FeatureContent

- Many pages use borders for cards, tables, and badges (e.g., `border-b` on table rows, `border` on cards).
- Contract: Borders & Padding Rules.
- Why they are compliant:
  - These are explicitly allowed: “Borders BETWEEN cards” and “Section dividers inside FeatureSurface”.
  - No evidence of borders wrapping the entire viewport or page root from these snippets.

---

## 4. Fix Priority Order (When You Choose to Implement)

This section is *planning only* and does not reflect any code changes.

1. **Normalize feature page roots to transparent surfaces**  
   - Replace `min-h-screen` + background on page roots with containers that assume AppFrame’s inner canvas and use transparent backgrounds.  
   - Target high-traffic surfaces first: `/chat`, `/contractor-dashboard`, `/affiliate`, `/analytics`, `/community`-adjacent pages.

2. **Centralize global padding in AppFrame**  
   - Move `p-6`, `py-10 px-4`, etc., from page root wrappers into AppFrame-level layout (or consistent section components), especially on admin and dashboard pages.

3. **Audit “theme” backgrounds against AppSurface/AppFrame**  
   - Confirm that color tokens like `bg-tsBg`, gradients, and `bg-navy-900` are applied at the correct layer (AppFrame vs. FeatureContent).

4. **Add lint/CI checks for `min-h-screen` on pages**  
   - Lightweight static rule: flag `min-h-screen` on any component under `client/src/pages/` as a warning to review against the Surface Contract.

---

This concludes the UI Surface Violation Map (analysis-only).  
No runtime code was modified; all findings are derived from the current repository state.
