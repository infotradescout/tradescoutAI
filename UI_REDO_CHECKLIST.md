# UI Redo – Quick Visual Checklist

## Desktop (Chrome / Edge)
- Home `/` renders with charcoal background and readable text.
- Top nav + primary CTAs use orange accent and remain readable.
- Scrolling works on long pages (no clipped content / no locked scroll).
- Modals/drawers are above the UI (no background bleed or z-index issues).
- Settings → Appearance routes to Profile Settings and palette changes apply immediately after save.

## Installed Web App (Desktop PWA)
- Window has the same layout as desktop web (no mobile-only scroll lock behavior).
- Resizing the window does not break navigation or content layout.

## Mobile (iOS Safari + Android Chrome)
- Scroll-lock behavior only applies where expected (no double scroll).
- Bottom nav is reachable and content is not hidden behind it.
- Theme colors remain readable (contrast) across primary flows.

## Theme / Palette
- Default theme is charcoal with white text + orange accent.
- Saving the 6-color palette in `/profile-settings` updates:
  - In-app theme (background + UI surface)
  - Public profile color scheme (primary/secondary/background/text)
