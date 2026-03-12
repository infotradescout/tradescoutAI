# Sitewide SEO Audit - 2026-03-12

## Scope
- Route-level audit for public crawl surfaces in `AppRoutes` and sitemap-driven pages.
- Checked each target for:
  - page title/description via `SEOHelmet`
  - explicit canonical
  - `noIndex` where appropriate
  - JSON-LD (`structuredData`) coverage

## Snapshot
- Core public routes audited: 38
- Routes with `SEOHelmet`: 17
- Core public routes missing page-level SEO metadata: 21
- Core public routes with explicit canonical among SEO-enabled pages: 16/17

## Immediate Fixes Applied In This Pass
- Added explicit canonical to Trust Model page:
  - `client/src/pages/trust-model.tsx`
- Marked 404 page as noindex:
  - `client/src/pages/not-found.tsx`
- (From prior SEO pass in this branch)
  - canonical query/hash stripping in shared SEO utilities
  - robots sitemap index alignment
  - sitemap index generation made deterministic in build script

## P0 Findings (High Impact)
These are crawlable/core pages without page-specific metadata (fallback shell metadata only):
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `client/src/pages/community.tsx`
- `client/src/pages/contractor-apply.tsx`
- `client/src/pages/groups.tsx`
- `client/src/pages/county-directory.tsx`
- `client/src/pages/county-hub.tsx`
- `client/src/pages/maps.tsx`
- `client/src/pages/pricing.tsx`
- `client/src/pages/terms.tsx`
- `client/src/pages/privacy.tsx`
- `client/src/pages/privacy-request.tsx`
- `client/src/pages/compliance.tsx`
- `client/src/pages/leaderboard.tsx`
- `client/src/pages/foundation.tsx`
- `client/src/pages/resource-center.tsx`
- `client/src/pages/membership-portal.tsx`
- `client/src/pages/training-center.tsx`
- `client/src/pages/affiliate.tsx`
- `client/src/pages/vehicle-marketplace.tsx`
- `client/src/pages/handmade-marketplace.tsx`
- `client/src/pages/TradePartnerCountyLanding.tsx`

## P1 Findings (Quality/Consistency)
- Recent and best pages currently rely on default canonical behavior (works after shared canonical normalization), but should set explicit canonicals for long-term route stability:
  - `client/src/pages/best/BestTradeCountyPage.tsx`
  - `client/src/pages/best/BestTradeCityPage.tsx`
  - `client/src/pages/recent/CountyRecentPage.tsx`
  - `client/src/pages/recent/CityRecentPage.tsx`
  - `client/src/pages/recent/TradeCountyRecentPage.tsx`
  - `client/src/pages/recent/TradeCityRecentPage.tsx`
- Add structured data coverage for high-intent local intent pages currently missing it:
  - `community`, `direct-connect`, `groups`, `county-directory`, `tradepartners/:countySlug`

## P2 Findings (Operational SEO)
- Create CI guardrail test that enforces SEO metadata on all routes in `CORE_STATIC_PATHS`.
- Add automated route SEO inventory report generation in CI output (title/description/canonical/noindex/schema).
- Add per-template defaults helper to avoid repeated manual SEOHelmet blocks.

## Recommended Next Implementation Order
1. Add `SEOHelmet` blocks (title/description/canonical) to all P0 pages.
2. Add explicit canonical props to best/recent pages.
3. Add JSON-LD blocks for top local-intent pages (community/direct-connect/groups).
4. Add SEO contract test for `CORE_STATIC_PATHS` to prevent regressions.
