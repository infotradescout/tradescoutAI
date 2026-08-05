# Build Evidence: jw-stone-marketplace

Verdict: SI worker slice implemented on `jw-stone/marketplace-end-user-reset`; owner local preview required before merge  
Lock version: `1.3.0`

## Authorized correction (owner chat 2026-08-04)

Owner voided Learn-about-stone, Call-for-availability, yellow eyebrows, path-guide theater, and doctrine fact cards. Required New Arrivals restore, Aesthetic + separate Color filters, dense photo-first cards, real header/footer, and customer role on the request form.

## Implemented

- New Arrivals section restored from unnamed inventory photo rail (`NewArrivalsSection.tsx`); TrendingSelectionRail / CFA theater removed from marketplace UI.
- Aesthetic (`?aesthetic=`) and literal Color (`?color=`) filters wired; legacy aesthetic-in-color mapped.
- Dense photo-first `StoneCard`; doctrine fact grids gone from cards.
- Learn about stone modules removed; yellow eyebrows absent from hero/First Cut.
- MarketplaceHeader + MarketplaceFooter with New Arrivals nav; customer role on materials Direct Connect form.
- SSR crawler summary aligned (New Arrivals present; CFA/Learn absent).
- SI locks updated to amendment `1.3.0` with owner chat as product authority over voided prior surfaces.

## Proof run (this slice)

```
npx vitest run client/src/features/jw-stone/JWStoneMarketplace.test.tsx \
  client/src/features/jw-stone/catalog.test.ts \
  client/src/features/jw-stone/urlState.test.ts \
  client/src/features/jw-stone/stoneColors.test.ts \
  server/tests/public-jw-stone-marketplace-html.test.ts
```

Result: 5 files / 23 tests passed.

## Remaining for owner

- Local preview of `/jw-stone` (desktop + mobile) — not yet claimed as owner-seen.
- Playwright visual suite against a running local server when owner is ready.
- Explicit GO before commit/push/merge to `main`.
