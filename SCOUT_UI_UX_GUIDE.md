# Scout UI/UX Design Guide

## Overview

Scout is the Community-Powered assistant for Trade Scout. This guide ensures Scout's UI/UX reflects trust, clarity, and accuracy through:

1. **Source Attribution** — Clear labeling of where data comes from
2. **Confidence Indicators** — Visual signals of data reliability
3. **Mobile-First Design** — Optimized for on-site contractor use
4. **Dark Mode** — Default theme for outdoor readability
5. **Accessibility** — WCAG 2.1 AA compliance

---

## Design Principles

### 1. Trust First
- **Never hide sources.** Every answer shows where it came from.
- **Be honest about uncertainty.** If data is incomplete, say so.
- **Distinguish data types.** Local data ≠ web search ≠ user-generated.
- **No paid placement disguise.** Sponsored content is clearly labeled.

### 2. Clarity Over Cleverness
- **Plain language.** Avoid jargon unless necessary.
- **Scannable.** Use headers, bullets, and short paragraphs.
- **Visual hierarchy.** Most important info first.
- **Consistent.** Same patterns across all screens.

### 3. Mobile-First
- **Thumb-friendly.** Tap targets are 44px minimum.
- **Fast loading.** Optimize for 3G/4G networks.
- **Minimal scrolling.** Stack content vertically.
- **Readable text.** 16px minimum font size.

### 4. Dark Mode (Default)
- **Outdoor readability.** Reduces glare in sunlight.
- **Battery efficient.** OLED screens use less power.
- **Professional.** Matches contractor/tradesperson aesthetic.
- **Consistent.** All UI elements use dark palette.

---

## Color Palette

### Dark Mode (Primary)

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Dark Gray | `#111827` | Main background |
| Surface | Darker Gray | `#0F172A` | Cards, inputs |
| Border | Gray | `#374151` | Dividers, borders |
| Text Primary | Light Gray | `#F3F4F6` | Body text |
| Text Secondary | Medium Gray | `#9CA3AF` | Secondary text |
| Accent | Warm Orange | `#F97316` | CTAs, highlights |
| Success | Green | `#22C55E` | Verified, confirmed |
| Warning | Amber | `#FBBF24` | Caution, limited data |
| Error | Red | `#EF4444` | Errors, problems |

### Confidence Indicators

| Level | Color | Icon | Label |
|-------|-------|------|-------|
| High | Green (`#22C55E`) | ✓ | Verified |
| Medium | Blue (`#3B82F6`) | ℹ | Reliable |
| Low | Amber (`#FBBF24`) | ⚠ | Limited Data |

---

## Component Library

### 1. Scout Answer Card

**Purpose:** Display Scout's response with source attribution

**Structure:**
```
┌─────────────────────────────────────┐
│ Scout's Answer Text                 │
│                                     │
│ This is the main response to the    │
│ user's question. It should be       │
│ clear, concise, and actionable.     │
├─────────────────────────────────────┤
│ ✓ Verified | 📋 Building Codes      │
│ 📍 Local Data (Travis, TX)          │
│ Updated: 2 days ago                 │
└─────────────────────────────────────┘
```

**Responsive Behavior:**
- Mobile: Full width, padding 16px
- Tablet: Max width 600px, centered
- Desktop: Max width 800px, centered

### 2. Source Attribution Component

**Purpose:** Show where data came from and how reliable it is

**Elements:**
- **Confidence Badge** (top-left)
  - Icon + Label + Description
  - Color-coded (green/blue/amber)
  - Example: "✓ Verified - Based on verified TradeScout data"

- **Source Pills** (horizontal scroll on mobile)
  - Icon + Source name
  - Clickable to see more details
  - Examples:
    - 📋 Building Codes Database
    - 💰 Pricing Database
    - 🔧 Trade Guides
    - 📍 Local Data (Travis, TX)
    - 🌐 Web Search

- **Last Updated** (if applicable)
  - Clock icon + Relative date
  - Example: "Updated: 2 days ago"

- **Disclaimers** (if needed)
  - Warning background (amber/dark)
  - Icon + Text
  - Example: "⚠️ Verify with local building department before starting work"

### 3. Trust Signals

**Purpose:** Build confidence in Scout's recommendations

**Elements:**
- **Verification Badge** (✓ Verified)
  - Green checkmark
  - Indicates data is from official sources

- **Endorsement Count** (👍 42 endorsements)
  - Shows community verification
  - Clickable to see endorsers

- **Community Rating** (⭐ 4.8)
  - Star rating from verified users
  - Shows reliability

### 4. Quick Answer Format

**Purpose:** Fast answers for simple questions

**Structure:**
```
Q: "Do I need a permit for a deck?"

A: Yes, in Texas. Deck permits are required if:
   • Deck is higher than 30 inches
   • Deck is larger than 200 sq ft
   • Deck is attached to the house

   ✓ Verified | 📋 Building Codes
   📍 Texas | Updated: Today
```

### 5. Detailed Answer Format

**Purpose:** Comprehensive answers with multiple sections

**Structure:**
```
Q: "How much does a roof replacement cost?"

A: Typical roof replacement in Texas costs $5,000-$25,000

FACTORS AFFECTING COST:
• Roof size (1,500-3,000 sq ft)
• Material type (asphalt, metal, tile)
• Labor rates ($50-$85/hour)
• Removal of old roofing
• Structural repairs

BREAKDOWN:
- Materials: $3,000-$8,000
- Labor: $2,000-$15,000
- Permits & Inspections: $500-$1,500

NEXT STEPS:
1. Get 3 quotes from licensed roofers
2. Verify insurance coverage
3. Schedule inspection

💰 Pricing Database | 🌐 Web Search
📍 Texas | Updated: 1 week ago

⚠️ Prices vary by location and contractor
⚠️ Verify with local building department
```

---

## Mobile-First Responsive Layout

### Mobile (< 640px)
- Full width minus 16px padding
- Single column layout
- Bottom sheet for details
- Thumb-friendly tap targets (44px)
- Vertical scrolling

### Tablet (640px - 1024px)
- Max width 600px, centered
- Two column for complex content
- Side panel for details
- Balanced spacing

### Desktop (> 1024px)
- Max width 800px, centered
- Multi-column layout
- Hover states for interactions
- Keyboard navigation

---

## Interaction Patterns

### 1. Message Streaming
- **Show typing indicator** while Scout is thinking
- **Stream text** as it arrives (token by token)
- **Animate source badges** in after text completes
- **Smooth scroll** to new content

### 2. Source Interaction
- **Tap source badge** to see full source details
- **Swipe** between sources on mobile
- **Hover** shows tooltip on desktop
- **Click** opens external link if available

### 3. Action CTAs
- **Primary CTA** (Accent color, full width on mobile)
  - "Get 3 Quotes" / "Post This Project" / "View Contractors"
- **Secondary CTA** (Outline style)
  - "Learn More" / "See Details" / "Ask Follow-up"
- **Tertiary CTA** (Text only)
  - "Dismiss" / "Not Helpful" / "Report Issue"

### 4. Error States
- **Network error:** Show retry button, keep previous message
- **LLM error:** Show "Scout is thinking..." with fallback message
- **Invalid input:** Show inline validation message
- **Rate limit:** Show friendly message with wait time

---

## Accessibility Requirements

### Color Contrast
- **AA Standard:** 4.5:1 for normal text, 3:1 for large text
- **AAA Standard:** 7:1 for normal text, 4.5:1 for large text
- **Test:** Use WebAIM Contrast Checker

### Keyboard Navigation
- **Tab order:** Logical flow (top to bottom, left to right)
- **Focus visible:** Clear focus indicator (outline or highlight)
- **Keyboard shortcuts:** Ctrl+Enter to send message
- **Screen reader:** Semantic HTML, ARIA labels

### Text & Font
- **Minimum 16px** for body text
- **Line height 1.5** for readability
- **Max line length 80 characters** for optimal reading
- **Sans-serif font** (Geist, Inter, or system font)

### Images & Icons
- **Alt text** for all images
- **Icon labels** or tooltips
- **Color not only indicator** (use icon + color)
- **Sufficient contrast** for icons (3:1 minimum)

---

## Implementation Examples

### ScoutSourceAttribution Component

```tsx
import { ScoutSourceAttribution, ScoutAnswerCard } from "@/scout/ScoutSourceAttribution";

export function MyScoutAnswer() {
  return (
    <ScoutAnswerCard
      sources={[
        "TradeScout Building Codes Database",
        "Local Data (Travis, TX)",
      ]}
      confidence="high"
      lastUpdated="2026-05-07"
      disclaimers={[
        "Verify with local building department before starting work",
      ]}
    >
      <p>Yes, you need a permit for a deck in Texas if:</p>
      <ul className="list-disc list-inside space-y-1 mt-2">
        <li>Deck is higher than 30 inches</li>
        <li>Deck is larger than 200 sq ft</li>
        <li>Deck is attached to the house</li>
      </ul>
    </ScoutAnswerCard>
  );
}
```

### Integration with ScoutThread

```tsx
import { ScoutThread } from "@/scout/ScoutThread";
import { ScoutAnswerCard } from "@/scout/ScoutSourceAttribution";

export function ScoutChat() {
  return (
    <ScoutThread
      messages={messages.map((msg) => ({
        ...msg,
        // Add source attribution to Scout messages
        sources: msg.role === "assistant" ? msg.sources : undefined,
        confidence: msg.role === "assistant" ? msg.confidence : undefined,
      }))}
      onAction={handleAction}
    />
  );
}
```

---

## Dark Mode Implementation

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: "class", // or "media"
  theme: {
    extend: {
      colors: {
        scout: {
          bg: "#111827",
          surface: "#0F172A",
          border: "#374151",
          text: "#F3F4F6",
          muted: "#9CA3AF",
        },
      },
    },
  },
};
```

### Component Usage

```tsx
// Always use dark mode classes
<div className="bg-scout-bg text-scout-text border border-scout-border">
  <p className="text-scout-muted">Secondary text</p>
</div>
```

---

## Testing Checklist

### Visual Testing
- [ ] All text is readable (16px+ body, 14px+ secondary)
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Source badges are visible and scannable
- [ ] Dark mode looks good on all backgrounds
- [ ] Mobile layout works on small screens (320px+)

### Interaction Testing
- [ ] Tap targets are 44px minimum
- [ ] Buttons have clear hover/active states
- [ ] Messages stream smoothly
- [ ] Source badges are clickable
- [ ] Keyboard navigation works

### Accessibility Testing
- [ ] Screen reader announces all content
- [ ] Focus order is logical
- [ ] Images have alt text
- [ ] Icons have labels or titles
- [ ] Error messages are clear

### Performance Testing
- [ ] Page loads in < 3 seconds
- [ ] Messages appear instantly
- [ ] Scrolling is smooth (60 fps)
- [ ] No layout shift when loading
- [ ] Images are optimized

---

## Files to Update

| File | Changes |
|------|---------|
| `ScoutThread.tsx` | Integrate ScoutAnswerCard component |
| `ScoutOS.tsx` | Add source attribution to messages |
| `ScoutInputRow.tsx` | Add keyboard shortcut (Ctrl+Enter) |
| `tailwind.config.js` | Add Scout color palette |
| `globals.css` | Add dark mode base styles |

---

## References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Tailwind Dark Mode](https://tailwindcss.com/docs/dark-mode)
- [Mobile-First Design](https://www.nngroup.com/articles/mobile-first-design/)
- [Accessibility Best Practices](https://www.a11y-101.com/)

---

**Last Updated:** 2026-05-07  
**Version:** 1.0  
**Status:** Design Guide Ready for Implementation
