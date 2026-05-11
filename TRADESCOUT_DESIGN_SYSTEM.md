# Trade Scout — Design System v1.0

**Status:** Locked  
**Reference Surface:** Scout 2.0 Showcase (`scout-2-showcase`)  
**Last Updated:** May 2026  
**Owner:** Thomas / Trade Scout

---

## Purpose

This document defines the single source of truth for all Trade Scout UI surfaces. Every page, component, dashboard, and feature across Trade Scout must conform to this system. Updates to the system are made here first, then rolled out surface by surface.

**Surfaces covered by this system:**
- Scout (reference — locked)
- Direct Connect
- Commercial
- Community
- Exchange
- Dashboard
- Onboarding
- Settings
- MealScout (separate brand — see brand separation rules)
- Trader's Corner (separate brand — see brand separation rules)

---

## 1. Brand Identity

Trade Scout is a neutral, trust-first intelligence platform for contractors, realtors, vendors, small businesses, and local entrepreneurs. The visual identity must communicate:

- **Reliability** — dark, structured, precise
- **Clarity** — nothing hidden, nothing ambiguous
- **Speed** — fast-loading, minimal clutter, direct paths
- **Neutrality** — no paid placement, no bias signals, no ranking manipulation

---

## 2. Color System

All colors are defined as CSS custom properties in `index.css`. Never hardcode color values in components.

### Core Palette

| Token | Value (OKLCH) | Hex Equivalent | Usage |
|---|---|---|---|
| `--background` | `oklch(0.07 0.005 285)` | `#0d0d0f` | Page background |
| `--surface` | `oklch(0.11 0.005 285)` | `#111115` | Card/panel background |
| `--surface-raised` | `oklch(0.14 0.005 285)` | `#161619` | Elevated surface (modals, dropdowns) |
| `--foreground` | `oklch(0.97 0 0)` | `#f8f8f8` | Primary text |
| `--muted-foreground` | `oklch(0.55 0.01 285)` | `#7a7a85` | Secondary text, labels |
| `--border` | `oklch(1 0 0 / 8%)` | `rgba(255,255,255,0.08)` | Default borders |
| `--border-hover` | `oklch(1 0 0 / 16%)` | `rgba(255,255,255,0.16)` | Hover borders |

### Accent (Orange)

| Token | Value | Usage |
|---|---|---|
| `--accent` | `oklch(0.70 0.19 45)` | `#f97316` — Primary CTA, active states, icons |
| `--accent-hover` | `oklch(0.65 0.19 45)` | `#ea6c0a` — Button hover |
| `--accent-muted` | `oklch(0.70 0.19 45 / 10%)` | Icon backgrounds, card hover tints |
| `--accent-foreground` | `oklch(1 0 0)` | Text on orange backgrounds |

### Semantic Colors

| Token | Usage |
|---|---|
| `--success` | `oklch(0.65 0.15 145)` — Confirmed, verified, high confidence |
| `--warning` | `oklch(0.75 0.15 75)` — Medium confidence, needs review |
| `--destructive` | `oklch(0.60 0.22 25)` — Errors, risks, watchdog alerts |
| `--info` | `oklch(0.65 0.12 240)` — Informational, neutral signals |

### Color Rules

- **Never** use purple, violet, or teal as primary or accent colors on Trade Scout surfaces.
- **Never** use white backgrounds. The minimum background lightness is `--surface`.
- **Always** pair `bg-*` with the corresponding `text-*-foreground` token.
- Sponsored or paid content must use a visually distinct border and label — never match organic content styling.

---

## 3. Typography

### Font Stack

```css
--font-display: 'Sora', 'DM Sans', system-ui, sans-serif;
--font-body: 'DM Sans', 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

Load via Google Fonts in `client/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

### Type Scale

| Role | Class | Size | Weight | Font |
|---|---|---|---|---|
| Hero | `.text-hero` | `clamp(3rem, 8vw, 5rem)` | 800 | Sora |
| H1 | `.text-h1` | `2.5rem / 40px` | 700 | Sora |
| H2 | `.text-h2` | `2rem / 32px` | 700 | Sora |
| H3 | `.text-h3` | `1.25rem / 20px` | 600 | DM Sans |
| Body | `.text-body` | `1rem / 16px` | 400 | DM Sans |
| Small | `.text-small` | `0.875rem / 14px` | 400 | DM Sans |
| Label | `.text-label` | `0.75rem / 12px` | 600 | DM Sans — uppercase, tracked |
| Mono | `.text-mono` | `0.875rem / 14px` | 400 | JetBrains Mono |

### Typography Rules

- Hero and H1 headlines use Sora at weight 700–800. Never use Inter for headlines.
- Body copy uses DM Sans at weight 400–500. Line height: 1.6.
- Labels and badges use uppercase with `letter-spacing: 0.08em`.
- Monospace is reserved for technical notes, code references, and data values.
- **Never** set body text below `oklch(0.55 0.01 285)` on dark backgrounds — minimum contrast ratio 4.5:1.

---

## 4. Spacing System

Based on a 4px base unit. All spacing uses Tailwind's default scale.

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Tight gaps between inline elements |
| `space-2` | 8px | Icon-to-label gaps |
| `space-3` | 12px | Compact padding |
| `space-4` | 16px | Default padding, card inner spacing |
| `space-5` | 20px | Section inner padding |
| `space-6` | 24px | Card padding |
| `space-8` | 32px | Between components |
| `space-12` | 48px | Between sections (mobile) |
| `space-20` | 80px | Between sections (desktop) |

Section padding: `py-16 md:py-20` for standard sections, `py-12 md:py-16` for compact sections.

---

## 5. Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `6px` | Badges, tags, small chips |
| `--radius-md` | `10px` | Buttons, inputs, small cards |
| `--radius-lg` | `14px` | Cards, panels, dropdowns |
| `--radius-xl` | `20px` | Large modals, hero cards |

**Rule:** Never use fully rounded (`rounded-full`) on rectangular content blocks. Reserve pill shape for badges and avatar indicators only.

---

## 6. Component Specifications

### 6.1 Header

- Fixed, full-width, `z-50`
- Background: `bg-background/95 backdrop-blur-md`
- Border: `border-b border-border`
- Height: `64px` desktop, `56px` mobile
- Logo: S2 badge (orange gradient) + "Scout 2.0" wordmark in Sora
- Nav items: icon + label + chevron, open dropdown panels on click
- CTA: Ghost "Sign In" + Orange "Open Scout" — both link to real destinations
- Mobile: hamburger toggle, full-width stacked menu with accordion items

### 6.2 Dropdown Panel

- Full-width, appears below header
- Background: `bg-background` with `border-b border-border shadow-2xl`
- Two-column layout: left = description + bullets, right = technical note
- Close on outside click or Escape key
- "New in 2.0" badge on upgraded features: `bg-accent text-white text-xs px-2 py-0.5 rounded-full`

### 6.3 Feature Card (Accordion)

- Full-width row, rounded-xl border
- Default: `border-border/40 bg-surface`
- Hover: `border-border-hover`
- Active/expanded: `border-accent/60 bg-surface shadow-lg shadow-accent/5`
- Header row: icon block + title + subtitle + chevron
- Icon block: `p-2.5 rounded-lg bg-accent/10 text-accent` (default), `bg-accent text-white` (expanded)
- Expanded content: summary paragraph + "How it works" bullets + "Real Example" callout block
- Example callout: `bg-accent/5 border border-accent/20 rounded-lg p-4`

### 6.4 Section

- Max content width: `max-w-5xl` for feature sections, `max-w-4xl` for text-heavy sections
- Alternating background: `bg-background` / `bg-surface/30`
- Section label: uppercase, tracked, `text-accent`, `text-xs font-semibold` above headline
- Headline: H2 in Sora, centered
- Subheadline: body in DM Sans, `text-muted-foreground`, centered, `max-w-2xl mx-auto`

### 6.5 Button

| Variant | Style | Usage |
|---|---|---|
| Primary | `bg-accent hover:bg-accent/90 text-white` | Main CTA |
| Ghost | `text-muted-foreground hover:text-foreground hover:bg-surface` | Secondary actions |
| Outline | `border border-border/50 hover:border-accent/40 bg-transparent` | Tertiary actions |
| Destructive | `bg-destructive text-white` | Delete, remove, risk actions |

Button sizes: `sm` (32px height), `md` (40px height, default), `lg` (48px height for hero CTAs).

### 6.6 Badge / Tag

```tsx
// New in 2.0
<span className="text-xs px-2 py-0.5 rounded-full bg-accent text-white font-semibold">
  New in 2.0
</span>

// Category tag
<span className="text-xs px-2 py-0.5 rounded-md bg-accent/10 text-accent font-medium uppercase tracking-wide">
  Pricing
</span>

// Confidence: High
<span className="text-xs px-2 py-0.5 rounded-md bg-success/10 text-success font-medium">
  High Confidence
</span>
```

### 6.7 Hero Section

- Background: near-black with subtle orange grid overlay (`opacity-[0.06]`, `50px 50px` grid)
- Pill badge above headline: `bg-accent/10 text-accent text-sm font-semibold px-4 py-2 rounded-full`
- Headline: Sora 800, `clamp(3rem, 8vw, 5rem)`, white
- Subheadline: DM Sans 400, `text-xl text-muted-foreground`, `max-w-2xl mx-auto`
- No hero buttons unless linking to a real destination

### 6.8 Footer

- Background: `bg-surface border-t border-border/30`
- Three-column layout: brand + tagline, links, legal
- Text: `text-sm text-muted-foreground`
- Brand separation: Trade Scout footer never references MealScout or Trader's Corner

---

## 7. Grid & Layout

- Base grid: 12-column CSS grid via Tailwind
- Content max-width: `1280px` (container default)
- Breakpoints: `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`
- Mobile-first: all components designed at 375px width first, then scaled up
- **No full-page centered layouts** — prefer asymmetric or two-column structures for dashboards
- Sidebar layouts use `240px` fixed sidebar on desktop, bottom nav on mobile

---

## 8. Motion & Animation

- Default transition: `transition-colors duration-150 ease-out`
- Hover effects: border color, background tint, text color — no scale transforms on cards
- Chevron rotation: `transition-transform duration-200`
- Dropdown panels: no animation (instant open/close for performance)
- Page entrance: `opacity-0 → opacity-100` over `300ms` — no slide-in animations
- **Never** use bouncing, spinning, or attention-seeking animations on Trade Scout surfaces

---

## 9. Iconography

- Library: `lucide-react` exclusively
- Size: `w-4 h-4` (inline/nav), `w-5 h-5` (card headers), `w-6 h-6` (feature icons)
- Color: inherit from parent or `text-accent` for primary icons
- Never use emoji as icons in UI components

---

## 10. Trust & Neutrality Rules

These rules apply to all Trade Scout surfaces without exception:

1. **No paid ranking.** Contractor or business listings must never be sorted, highlighted, or badged based on payment.
2. **Sponsored content must be labeled.** Any sponsored or promoted content must have a visible "Sponsored" label that is visually distinct from organic content.
3. **No fake data.** No placeholder testimonials, invented metrics, fake user counts, or sample reviews.
4. **Confidence scores must be honest.** High/Medium/Low confidence must reflect actual source agreement — never inflated for marketing purposes.
5. **Watchdog alerts must be actionable.** Never show a risk alert without a clear next step.

---

## 11. Brand Separation Rules

Trade Scout, MealScout, and Trader's Corner are separate brands. Their design systems share the same base tokens but use different accent colors and must never share UI components, copy, or audience targeting.

| Brand | Accent Color | Background | Audience |
|---|---|---|---|
| Trade Scout | Orange `#f97316` | Near-black `#0d0d0f` | Contractors, realtors, vendors, businesses |
| MealScout | Green `oklch(0.65 0.15 145)` | Near-black `#0d0d0f` | Food parks, vendors, food truck operators |
| Trader's Corner | Blue `oklch(0.60 0.18 240)` | Near-black `#0d0d0f` | Traders, sports bettors, community members |

---

## 12. Rollout Order

Design system is applied surface by surface in this order:

- [x] Scout (reference — complete)
- [ ] Direct Connect
- [ ] Community
- [ ] Exchange
- [ ] Commercial
- [ ] Dashboard
- [ ] Onboarding
- [ ] Settings
- [ ] MealScout (separate accent)
- [ ] Trader's Corner (separate accent)

---

## 13. File References

| File | Purpose |
|---|---|
| `client/src/index.css` | All CSS custom properties and base styles |
| `client/src/components/Header.tsx` | Reference header implementation |
| `client/src/components/Footer.tsx` | Reference footer implementation |
| `client/src/pages/Home.tsx` | Reference Scout page implementation |
| `client/index.html` | Font imports |
| `TRADESCOUT_DESIGN_SYSTEM.md` | This document |
| `docs/design/SCOUT_OS_VISUAL_REFERENCE.md` | Locked Scout OS visual reference for future UI direction |

---

*This document is the single source of truth. Any deviation from these specifications must be approved and documented here before implementation.*
