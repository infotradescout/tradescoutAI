# Sitewide SEO Audit - 2026-03-12

## Scope
- Route-level audit for public crawl surfaces in `AppRoutes` and sitemap-driven pages.
- Checked each target for:
  - page title/description via `SEOHelmet`
  - explicit canonical
  - `noIndex` where appropriate
  - JSON-LD (`structuredData`) coverage

## Snapshot
- Core public routes audited: 40
- Routes with `SEOHelmet`: 40
- Core public routes missing page-level SEO metadata: 0
- Core public routes with explicit canonical among SEO-enabled pages: 40/40

## Immediate Fixes Applied In This Pass
- Added explicit canonical to Trust Model page:
  - `client/src/pages/trust-model.tsx`
- Marked 404 page as noindex:
  - `client/src/pages/not-found.tsx`
- Added `SEOHelmet` + canonical metadata to all 21 previously missing core public pages:
  - `community`, `direct-connect`, `contractor-apply`, `groups`, `county-directory`,
    `county-hub`, `maps`, `pricing`, `terms`, `privacy`, `privacy-request`, `compliance`,
    `leaderboard`, `foundation`, `resource-center`, `membership-portal`, `training-center`,
    `affiliate`, `vehicle-marketplace`, `handmade-marketplace`, `tradepartner county landing`
- Added metadata to remaining sitemap-listed application pages:
  - `realtor-application`, `car-salesman-application`
- Added SEO contract test to keep core pages from regressing:
  - `server/tests/core-public-pages-seo.contract.test.ts`
- (From prior SEO pass in this branch)
  - canonical query/hash stripping in shared SEO utilities
  - robots sitemap index alignment
  - sitemap index generation made deterministic in build script

## P0 Findings (High Impact)
- Resolved in this pass for the audited core route set (38/38 now have page-level metadata).

## P1 Findings (Quality/Consistency)
- Best/recent templates already define explicit canonicals in current source:
  - `client/src/pages/best/BestTradeCountyPage.tsx`
  - `client/src/pages/best/BestTradeCityPage.tsx`
  - `client/src/pages/recent/CountyRecentPage.tsx`
  - `client/src/pages/recent/CityRecentPage.tsx`
  - `client/src/pages/recent/TradeCountyRecentPage.tsx`
  - `client/src/pages/recent/TradeCityRecentPage.tsx`
- Structured data coverage added for high-intent public pages:
  - `community`
  - `direct-connect`
  - `groups`
  - `county-directory`
  - `tradepartners/cumulus-media`

## P2 Findings (Operational SEO)
- Create CI guardrail test that enforces SEO metadata on all routes in `CORE_STATIC_PATHS`.
- Add automated route SEO inventory report generation in CI output (title/description/canonical/noindex/schema).
- Add per-template defaults helper to avoid repeated manual SEOHelmet blocks.

## Recommended Next Implementation Order
1. Add `SEOHelmet` blocks (title/description/canonical) to all P0 pages.
2. Add explicit canonical props to best/recent pages.
3. Add JSON-LD blocks for top local-intent pages (community/direct-connect/groups).
4. Add SEO contract test for `CORE_STATIC_PATHS` to prevent regressions.
