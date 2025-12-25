# Scout + Navs Locked (v1.0)

**Status:** ✅ Complete and verified  
**Date:** Dec 22, 2024  
**Approval:** User directive "scout and navs perfect first"

---

## Locked Components

### 1. **Scout Chat Shell** (ScoutInputRow.tsx, ScoutInput.tsx, ScoutSuggestions.tsx)

#### Gradient (index.css `.scout-shell`)
```css
background: linear-gradient(180deg, 
  rgba(40,60,110,0.12) 0%, 
  rgba(17,22,31,0.95) 45%, 
  #11161f 100%);
```
- **Subtle blue hint** in top third only
- Fades to solid at 45%
- Prevents visual heaviness

#### Input Surface (index.css `.scout-input`)
```css
background: #1b2332;
border: 1px solid rgba(255,255,255,0.08);
border-radius: 0.5rem;
```
- **Lightest surface** in hierarchy (elevation 4)
- No glow, no shadow on focus
- Focus state: simple border brighten to `rgba(255,255,255,0.12)`

#### Suggestions (index.css `.scout-suggestion`)
```css
background: #161e2b;
border: 1px solid rgba(255,255,255,0.06);
```
- **Elevated cards** (elevation 2)
- Default opacity: 0.9
- Hover opacity: 1.0 (no transform/lift)
- Border on hover: `rgba(255,255,255,0.12)`

#### Spacing (ScoutInputRow.tsx)
- `space-y-2` (reduced from 3)
- Header + location pill
- Mobile-responsive layout

### 2. **Top Navigation Header** (AppShell.tsx)

```tsx
style={{ backgroundColor: '#0b0f14', borderColor: 'rgba(255,255,255,0.06)' }}
```
- **Darkest surface** (elevation 0 - frame)
- Fixed height: 56px
- No backdrop-blur
- Solid dark border bottom

### 3. **Bottom Navigation Bar** (MobileAppBar.tsx)

```tsx
style={{ backgroundColor: '#0b0f14', borderColor: 'rgba(255,255,255,0.06)' }}
```
- **Darkest surface** matches top (elevation 0 - frame)
- Fixed height: 68px (with safe-area-inset-bottom)
- No backdrop-blur
- Solid dark border top

### 4. **Right Tools Panel** (AppShell.tsx)

```tsx
position: fixed;
right: 0;
bottom: 0;
height: calc(100vh - 56px - 68px);
top: 56px;
overflow-y: auto;
```
- **Fixed positioning** (doesn't scroll with page)
- **Independent scroll** (scrolls own content only)
- Width: 320px
- Above bottom nav (z-index layering maintained)

---

## Color Hierarchy (Locked)

| Surface | Color | Elevation | Purpose |
|---------|-------|-----------|---------|
| Navs (top/bottom) | `#0b0f14` | 0 (frame) | Darkest framing |
| App canvas | `#11161f` | 1 | Main background |
| Card/prompt surfaces | `#161e2b` | 2 | Suggested content |
| Intermediate surfaces | `#1a2230` | 3 | Cards inside Scout |
| Input surface | `#1b2332` | 4 (lightest) | User interaction zone |

---

## What Changed (Summary)

### CSS Updates (index.css)
- **Scout shell:** Changed from radial-gradient → linear-gradient (subtle, top-focused)
- **Scout input:** Added clean #1b2332 surface, removed glow, simplified focus
- **Scout suggestions:** Elevated to #161e2b, subtle border contrast, opacity transitions
- **All surfaces:** Removed backdrop-blur effects for clean, solid hierarchy

### Component Updates
- **ScoutInputRow.tsx:** Reduced spacing (space-y-2), compact header
- **ScoutInput.tsx:** Changed to #1b2332, removed send button excess spacing (mt-1)
- **AppShell.tsx:** Top nav hardened to #0b0f14, right panel fixed positioning
- **MobileAppBar.tsx:** Bottom nav hardened to #0b0f14, matches top styling

---

## What Did NOT Change

⛔ **Other pages** (Community, Contractors, Tasks, Helpers, etc.) - **DEFERRED**  
⛔ **Theme variables system** - Left as-is (not consolidated yet)  
⛔ **Bundle size optimization** - Accepted at 1.5mb for now  
⛔ **Theme Lock documentation** - User chose Option B (tactical lock, not formal system)

---

## Verification Checklist

- ✅ Scout gradient: Subtle linear-gradient, color only in top 33%
- ✅ Scout input: Clean #1b2332 surface with simple focus state
- ✅ Scout suggestions: Elevated #161e2b with proper border contrast
- ✅ Top nav: Darkest #0b0f14, solid border, no blur
- ✅ Bottom nav: Darkest #0b0f14, matches top, no blur
- ✅ Right panel: Fixed positioning, scrolls independently
- ✅ Color hierarchy: 5-level system visible and locked
- ✅ Build: Successful, deployed to localhost:5000

---

## Next Phase Options

1. **Beta behavior testing:** Lock UI, test feature flow in Scout chat
2. **Theme documentation:** Formalize color system as Theme Lock (Option A)
3. **Other pages:** Update when Theme Lock system is documented
4. **Bundle optimization:** After visual coherence confirmed in production

---

## Guard Rails

🔒 **LOCKED:** Scout chat components, top nav, bottom nav  
🔓 **OPEN:** Everything else (other pages, future theme evolution)

Any changes to Scout, top nav, or bottom nav require explicit user approval.

