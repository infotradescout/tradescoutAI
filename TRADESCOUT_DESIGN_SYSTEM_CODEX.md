# Trade Scout — Design System v1.0
## Codex Implementation Handoff

**Status:** Locked for implementation  
**Reference surface:** `scout-2-showcase` (live at scoutshowcase-e5cofgwp.manus.space)  
**Stack:** React 19 + Tailwind 4 + shadcn/ui + Wouter  
**Owner:** Thomas / Trade Scout  

---

## Objective

Implement the Trade Scout design system across all surfaces of `thetradescout.com`, starting with the Scout page. The system is already designed and locked. Codex's job is to apply it surface by surface without deviation. The Scout 2.0 Showcase is the visual reference — match it exactly.

---

## 1. Fonts

Load these three fonts in `client/index.html`. Replace any existing font imports.

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

| Role | Font | Weight |
|---|---|---|
| Headlines (H1–H3, hero) | Sora | 600 / 700 / 800 |
| Body, labels, UI text | DM Sans | 400 / 500 / 600 |
| Code, tech notes, data values | JetBrains Mono | 400 / 500 |

Apply in CSS:
```css
body { font-family: 'DM Sans', system-ui, sans-serif; }
h1, h2, h3, h4, h5, h6 { font-family: 'Sora', 'DM Sans', system-ui, sans-serif; letter-spacing: -0.02em; }
code, pre, .font-mono { font-family: 'JetBrains Mono', monospace; }
```

---

## 2. Color Tokens

Replace the entire `:root` and `.dark` block in `client/src/index.css` with the following. Trade Scout has **no light mode** — dark is permanent.

```css
:root {
  /* Backgrounds */
  --background:       oklch(0.07 0.005 285);   /* page bg — near black */
  --surface:          oklch(0.11 0.005 285);   /* card / panel bg */
  --surface-raised:   oklch(0.14 0.005 285);   /* dropdowns, modals */

  /* Text */
  --foreground:       oklch(0.97 0 0);         /* primary text — near white */
  --muted-foreground: oklch(0.55 0.01 285);    /* secondary text */

  /* Accent — Orange */
  --accent:           oklch(0.70 0.19 45);     /* #f97316 */
  --accent-foreground: oklch(1 0 0);           /* white on orange */

  /* Primary = Accent */
  --primary:          oklch(0.70 0.19 45);
  --primary-foreground: oklch(1 0 0);

  /* Cards */
  --card:             oklch(0.11 0.005 285);
  --card-foreground:  oklch(0.97 0 0);

  /* Popovers */
  --popover:          oklch(0.14 0.005 285);
  --popover-foreground: oklch(0.97 0 0);

  /* Secondary */
  --secondary:        oklch(0.16 0.005 285);
  --secondary-foreground: oklch(0.85 0 0);

  /* Muted */
  --muted:            oklch(0.16 0.005 285);

  /* Borders */
  --border:           oklch(1 0 0 / 8%);
  --input:            oklch(1 0 0 / 12%);
  --ring:             oklch(0.70 0.19 45 / 50%);

  /* Semantic */
  --success:          oklch(0.65 0.15 145);    /* green — verified, high confidence */
  --warning:          oklch(0.75 0.15 75);     /* amber — medium confidence */
  --destructive:      oklch(0.60 0.22 25);     /* red — errors, risk */
  --destructive-foreground: oklch(1 0 0);

  /* Radius */
  --radius: 10px;

  /* Sidebar */
  --sidebar:                    oklch(0.09 0.005 285);
  --sidebar-foreground:         oklch(0.97 0 0);
  --sidebar-primary:            oklch(0.70 0.19 45);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent:             oklch(0.14 0.005 285);
  --sidebar-accent-foreground:  oklch(0.97 0 0);
  --sidebar-border:             oklch(1 0 0 / 8%);
  --sidebar-ring:               oklch(0.70 0.19 45 / 50%);
}
```

The `.dark` block should be identical to `:root`. No light mode exists.

---

## 3. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `6px` | Badges, tags, chips |
| `--radius-md` | `10px` | Buttons, inputs, small cards |
| `--radius-lg` | `14px` | Cards, panels, dropdowns |
| `--radius-xl` | `20px` | Large modals, hero cards |

---

## 4. Spacing

Use Tailwind's default scale. Key values:

| Usage | Class |
|---|---|
| Section padding (standard) | `py-16 md:py-20` |
| Section padding (compact) | `py-12 md:py-16` |
| Card inner padding | `p-6` |
| Between components | `gap-8` |
| Content max-width (features) | `max-w-5xl mx-auto` |
| Content max-width (text) | `max-w-4xl mx-auto` |
| Global container max-width | `1280px` |

---

## 5. Component Specs

### Header

```
- Fixed, full-width, z-50
- bg-background/95 backdrop-blur-md border-b border-border/50
- Height: 64px desktop / 56px mobile
- Left: S2 badge (orange gradient) + "Scout 2.0" in Sora bold
- Center: Nav items — icon + label + chevron, click opens dropdown panel
- Right: Ghost "Sign In" + Orange "Open Scout" buttons linking to thetradescout.com
- Mobile: hamburger → stacked accordion menu
```

### Header Dropdown Panel

```
- Full-width below header, bg-background, border-b, shadow-2xl
- Two-column layout:
    Left col: icon block + headline + "New in 2.0" badge + description + bullet list
    Right col: "Under the Hood" label + monospace tech note block + CTA button
- Close on outside click or Escape key
- Orange accent on active nav item (bg-accent/10 text-accent)
```

### Feature Card (Accordion Row)

```
- Full-width, rounded-xl, border border-border/40 bg-surface
- Hover: border-border/70
- Expanded: border-accent/60 bg-surface shadow-lg shadow-accent/5
- Header row (always visible, clickable):
    - Icon block: p-2.5 rounded-lg bg-accent/10 text-accent (default)
                  bg-accent text-white (expanded)
    - Title: font-bold text-base
    - Subtitle: text-sm text-muted-foreground
    - Chevron: rotates 180° when expanded
- Expanded content:
    - Summary paragraph
    - "How it works" label (uppercase, tracked, text-accent) + bullet list
    - "Real Example" callout: bg-accent/5 border border-accent/20 rounded-lg p-4
```

### Section Structure

```
- Section label: text-xs font-semibold uppercase tracking-widest text-accent (above headline)
- Headline: text-3xl md:text-4xl font-bold (Sora), text-center
- Subheadline: text-muted-foreground text-center max-w-2xl mx-auto
- Alternating bg: bg-background / bg-surface/30
```

### Buttons

| Variant | Classes |
|---|---|
| Primary | `bg-accent hover:bg-accent/90 text-white font-semibold` |
| Ghost | `text-muted-foreground hover:text-foreground hover:bg-surface` |
| Outline | `border border-border/50 hover:border-accent/40 bg-transparent text-foreground` |
| Destructive | `bg-destructive text-white` |

Sizes: `h-8 px-3 text-sm` (sm) / `h-10 px-4` (default) / `h-12 px-6 text-lg` (lg / hero CTA)

### Badges

```tsx
// New in 2.0
<span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white font-semibold">New in 2.0</span>

// Category
<span className="text-xs px-2 py-0.5 rounded-md bg-accent/10 text-accent font-medium uppercase tracking-wide">Pricing</span>

// High Confidence
<span className="text-xs px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 font-medium">High Confidence</span>

// Warning
<span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-medium">Verify</span>

// Risk
<span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 font-medium">Risk Flagged</span>
```

### Hero Section

```
- bg-background with orange grid overlay (opacity 6%, 50px grid)
- Pill badge: bg-accent/10 text-accent text-sm font-semibold px-4 py-2 rounded-full
- Headline: Sora 800, clamp(3rem, 8vw, 5rem), white, tracking-tight
- Subheadline: DM Sans 400, text-xl text-muted-foreground, max-w-2xl mx-auto
- No buttons unless linking to a real, live destination
```

Orange grid CSS:
```css
background-image:
  linear-gradient(to right, oklch(0.70 0.19 45) 1px, transparent 1px),
  linear-gradient(to bottom, oklch(0.70 0.19 45) 1px, transparent 1px);
background-size: 50px 50px;
opacity: 0.06;
```

### Footer

```
- bg-surface border-t border-border/30
- Three columns: brand + tagline | nav links | legal
- text-sm text-muted-foreground
- No cross-brand references (Trade Scout footer never mentions MealScout or Trader's Corner)
```

---

## 6. Motion Rules

```
- Default transition: transition-colors duration-150 ease-out
- Chevron: transition-transform duration-200
- Dropdown panels: instant open/close (no animation)
- Page entrance: opacity-0 → opacity-100 over 300ms only
- NO: bounce, spin, scale-on-hover for cards, slide-in animations
```

---

## 7. Iconography

```
- Library: lucide-react only
- Sizes: w-4 h-4 (inline/nav) | w-5 h-5 (card headers) | w-6 h-6 (feature icons)
- Color: text-accent for primary icons, inherit for secondary
- No emoji in UI components
```

---

## 8. Trust & Neutrality Rules (Non-Negotiable)

These apply to every Trade Scout surface without exception:

1. No paid ranking — listings are never sorted or highlighted based on payment.
2. Sponsored content must have a visible "Sponsored" label, visually distinct from organic content.
3. No fake data — no placeholder testimonials, invented metrics, or sample reviews.
4. Confidence scores must reflect actual source agreement — never inflated.
5. Watchdog alerts must include a clear next step — never show a risk without guidance.

---

## 9. Brand Separation

Three separate brands. Never mix UI, copy, or audience targeting across them.

| Brand | Accent | Audience |
|---|---|---|
| Trade Scout | Orange `oklch(0.70 0.19 45)` | Contractors, realtors, vendors, businesses |
| MealScout | Green `oklch(0.65 0.15 145)` | Food parks, food trucks, vendors |
| Trader's Corner | Blue `oklch(0.60 0.18 240)` | Traders, sports bettors, community |

All three share the same dark background (`oklch(0.07 0.005 285)`) and base font stack. Only the accent color and brand copy differ.

---

## 10. Rollout Order

Apply the design system to each surface in this sequence. Do not skip ahead.

| # | Surface | Status | Notes |
|---|---|---|---|
| 1 | Scout | ✅ Reference — locked | `scout-2-showcase` is the visual reference |
| 2 | Header / Nav | 🔲 Next | Apply to main `thetradescout.com` header first |
| 3 | Direct Connect | 🔲 | Match card and section patterns |
| 4 | Community | 🔲 | Feed items use Feature Card accordion pattern |
| 5 | Exchange | 🔲 | Listing cards use surface + border-hover pattern |
| 6 | Commercial | 🔲 | |
| 7 | Dashboard | 🔲 | Sidebar layout: 240px fixed, bottom nav mobile |
| 8 | Onboarding | 🔲 | |
| 9 | Settings | 🔲 | |
| 10 | MealScout | 🔲 | Green accent — separate brand |
| 11 | Trader's Corner | 🔲 | Blue accent — separate brand |

---

## 11. What Codex Must NOT Do

- Do not introduce new accent colors, gradients, or purple/teal tones.
- Do not add light mode support.
- Do not use Inter as a headline font.
- Do not use fully rounded (`rounded-full`) on rectangular content blocks.
- Do not add bouncing, spinning, or scale-on-hover animations.
- Do not mix Trade Scout, MealScout, or Trader's Corner components on the same surface.
- Do not invent placeholder testimonials, fake metrics, or sample user data.
- Do not deviate from the rollout order without explicit instruction from Thomas.

---

## 12. Reference Files

| File | Location | Purpose |
|---|---|---|
| Visual reference (live) | `scoutshowcase-e5cofgwp.manus.space` | Match this exactly |
| Scout OS visual reference | `docs/design/SCOUT_OS_VISUAL_REFERENCE.md` | Locked May 2026 visual direction for Scout/action-card surfaces |
| Design system doc | `scout-2-showcase/TRADESCOUT_DESIGN_SYSTEM.md` | Full spec |
| This handoff | `scout-2-showcase/TRADESCOUT_DESIGN_SYSTEM_CODEX.md` | Codex instructions |
| CSS tokens | `scout-2-showcase/client/src/index.css` | Token reference |
| Header component | `scout-2-showcase/client/src/components/Header.tsx` | Reference implementation |
| Scout page | `scout-2-showcase/client/src/pages/Home.tsx` | Reference implementation |

---

*This document is the single source of truth for Codex implementation. Any deviation requires explicit approval from Thomas before proceeding.*
