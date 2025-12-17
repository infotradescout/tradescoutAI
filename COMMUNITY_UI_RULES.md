# Community UI Ruleset

This document defines the UI guidelines for the TradeScout Community feed so new components stay consistent with the current social feel.

## 1. Layout & Containers

- Use a vertical feed with `space-y-*` utilities to separate posts; spacing, not heavy borders, should create rhythm.
- Default card container: single thin border + light shadow.
  - Example: `bg-[#0f1624] border border-[#1f2937] shadow-md hover:shadow-xl`.
- Avoid `border-2` and overly heavy chrome on cards.
- Do not nest multiple heavy containers inside a post; prefer padding and subtle background shifts.

## 2. Identity & Meta Hierarchy

Order of visual importance:

1. Avatar + name
2. Role / trust badges
3. Type chip (Question / Project / Recommendation / etc.)
4. Timestamp + location

Guidelines:

- Avatar: slightly larger than typical UI avatars, with a ring for emphasis where appropriate.
- Name: bolder and/or larger than the post title. Never let the title overpower the person.
- Meta info (time/location): smaller, muted text; always a supporting line under identity.

## 3. Typed Content & Badges

Every post should expose its intent via a type chip and accent, derived from the existing `category` field.

- Type chip: icon + label + color, rendered under identity.
- Accent: subtle left border/background using the same color family on the content block.

Current types:

- **Question** – sky/blue
- **Project** – purple
- **Recommendation** – emerald/green
- **Safety** – red
- **Default** – neutral/slate "Update"

Adding a new type requires:

- Choosing a color family.
- Providing an icon + label.
- Reusing the chip + accent pattern.

## 4. Content Block

- Title (optional): medium weight, smaller than name, e.g. `text-sm`–`text-base`.
- Body text: `text-sm` or `text-base`, `leading-relaxed`, `whitespace-pre-wrap`.
- Tags: small chips (`text-xs`) with soft borders/backgrounds; tags should never visually dominate the post.

## 5. Actions & Stats

- Stats row:
  - Compact line above the actions, e.g. `X likes · Y comments` in muted text.
- Action row:
  - Use icon + label pairs (Like, Comment, Share).
  - No full-width buttons; no solid background fills by default.
  - Hover feedback is primarily color (e.g. brand orange), not large background blocks.
  - Actions should feel like micro-reactions, not form controls.

## 6. Composer

- Placement: near the top of the feed, not on a separate page.
- Visual style:
  - Looks like a feed item: avatar + text area, same general spacing and background as posts.
  - Placeholder copy explains context (e.g. "Share an update with your community…").
  - Attachment options (Photo/Video/Feeling) are small, muted buttons; secondary to the text area.
- Behavior:
  - No modal walls by default.
  - Auth gating is handled via toasts + copy, not by hiding the composer entirely.

## 7. Tabs & Navigation

- Tabs are intent-based filters, not separate pages:
  - **For You** – default, pinned/trending/newest blend
  - **Projects** – project posts
  - **Questions** – question posts
  - **Pros** – posts from contractors / verified users
- Visual treatment:
  - Active tab: stronger background + subtle bottom border highlight.
  - Inactive tabs: muted text; slight background change on hover.
- Tab switches filter the existing feed surface; they should not remount the page or cause scroll jumps.

## 8. System Bands (Pinned / Trending)

- Use only existing flags (`pinned`, `trending`); do not introduce synthetic system-only posts.
- Band behavior:
  - Slim strip at the top of the card with a small icon + label.
  - Copy examples:
    - `Pinned · From TradeScout`
    - `Trending in your area`
  - Muted background and thin border; smaller and less prominent than the identity row.
- Pinned posts:
  - In For You, surface at most 1–2 pinned posts at the very top.
  - Pinned posts scroll like any other—no sticky behavior.

## 9. Spacing, Motion, and Restraint

- Prefer vertical spacing (`space-y-5` / `space-y-6`) over stacking many borders and dividers.
- Use separators sparingly, with soft colors, to break sections inside a card.
- Motion:
  - Limit to hover and short color transitions.
  - Avoid complex animations, sliding panels, or long transitions in the feed.
- Do **not** introduce, without separate data-driven decisions:
  - Additional reaction types beyond Like.
  - Infinite scroll or major pagination changes.
  - Heavy tooltip/hover card systems.

## 10. Change Policy

- Structural/layout changes to Community should be rare and data-driven.
- Acceptable future tweaks:
  - Ordering adjustments (e.g., unanswered-first in Questions).
  - Copy changes.
  - Small affordance nudges that do not add visual weight.
- Avoid reworking spacing, adding new animations, or expanding reaction surfaces unless metrics clearly justify it.
