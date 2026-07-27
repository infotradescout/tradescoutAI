# TradeScout Search Index Recovery - Phase A Code Audit

| Field | Value |
|-------|--------|
| **Repo** | TradeScoutPro |
| **Branch audited** | `fix/tradescout-landing-logo` @ `38464b4f` |
| **Mode** | Phase A read-only |
| **GSC baseline** | Through **2026-07-09** only (not live today) |
| **Status** | **BLOCKED** for implementation pending live crawl + GSC URL exports |
| **PR scope** | Do **not** merge SEO recovery into landing-logo PR; later work needs an isolated branch/worktree |

---

## 1. Dual-layer SEO stack (SSR + SEOHelmet)

Public URLs are governed twice: server-rendered HTML injects `<meta name="robots">` / canonical / structured data before hydration; client routes then mutate head via `SEOHelmet` after data loads. Crawlers that execute JS can see different directives than HTML-only fetches.

| Layer | Role | Key paths |
|-------|------|-----------|
| **SSR HTML** | First response for bots and share previews | `server/publicLandingHtml.ts`, `server/publicTradeHtml.ts`, `server/publicProfileHtml.ts`, `server/publicBusinessHtml.ts`, related `server/public*Html.ts`; terminal responses in `server/utils/publicPageResponse.ts`; wiring in `server/index.ts` / `server/vite.ts` |
| **CSR head** | Post-fetch indexing rules on interactive pages | `client/src/components/SEOHelmet.tsx`; page logic e.g. `client/src/pages/landing.tsx`, `client/src/pages/trade/TradeCountyPage.tsx` |
| **Contracts** | Intended behavior encoded in tests | `server/tests/landing-seo-contracts.test.ts`, `server/tests/trade-county-page-seo.contract.test.ts`, `server/tests/public-profile-seo-contracts.test.ts`, `server/tests/sitemap-contracts.test.ts`, `server/tests/app-shell-seo-contracts.test.ts` |
| **Shared SEO data** | Trade/geo slug rules feeding directory surfaces | `shared/tradeSeo.ts`, `server/services/seoDirectoryScopeSnapshotJob.ts` |

---

## 2. Top confirmed damage patterns

1. **Combinatorial sitemap >> eligible content** - Many paginated sitemap indexes (directory trade×geo, cities, counties, “best” variants, businesses, profiles) emit URL counts driven by snapshot/cartesian expansion, not per-URL indexability or listing depth. Crawl budget and “Discovered – currently not indexed” pressure likely exceed quality inventory.

2. **CSR/SSR robots divergence** - Trade county **empty/error** states: CSR sets `noIndex` when `items.length === 0`; SSR trade HTML still injects `index, follow`. Landing **alias/query** paths: CSR noindexes `/lp/*`, `/landing/*`, and any `?query`; SSR landing fallback always injects `index, follow`. Google may record conflicting signals (HTML vs rendered).

3. **HTTP 200 + index signals on thin/stale/unpublished URLs** - Sitemap and/or SSR can still present indexable surfaces while content is empty, unpublished, or stale; profile/business handlers apply partial noindex (see §3) but sitemap inclusion and other trade/directory URLs may remain index-positive.

---

## 3. Critical mismatches (confirmed)

| Surface | SSR (first byte) | CSR (SEOHelmet / page logic) | Risk |
|---------|------------------|------------------------------|------|
| Trade county **empty / error** | `server/publicTradeHtml.ts` → `index, follow` | `TradeCountyPage.tsx` → `noIndex` when `!isLoading && (isError \|\| items.length === 0)` | Crawled-not-indexed, soft-404, wasted recrawl |
| Landing **stable /** | `publicLandingHtml.ts` → always `index, follow` | `landing.tsx` → index when not alias and no query | OK for `/` if aligned |
| Landing **`/lp/*`, `/landing/*`, `?query`** | SSR still `index, follow` | CSR `noIndex` | Split signal on marketing/variant URLs |
| Unpublished **`/u/*`** | `publicProfileHtml.ts` → `noindex,follow` | Client may differ after hydration | Unpublished URLs in sitemap vs noindex |
| Stale **`/business/*`** | `publicBusinessHtml.ts` → `noindex,nofollow` when stale path | Verify CSR parity | Stale URLs still discoverable via sitemap/directory |

---

## 4. Sitemap architecture

- **Dynamic index hub**: `server/routes/profiles.ts` - `/sitemap.xml` (sitemap index), `/robots.txt`, and many child sets (`sitemap-core.xml`, `sitemap-profiles.xml`, directory trade/city/county paginated indexes, exchange, homescout, tradepartners, etc.).
- **Core vs variants**: Commented contract - `sitemap-core` focuses canonical intent URLs; **variant landing routes stay out of core** (aliases/query landings not promoted in core set).
- **Trade × geo**: Directory trade/city/county URL sets driven by DB + **`seoDirectoryScopeSnapshotJob`** snapshot materialization (not live eligibility per row at emit time).
- **Supporting**: `server/repositories/sitemapRepository.ts`, `server/sitemapUrlSet.ts` (`prepareSitemapUrlSetEntries`), `server/services/seoPublicationPruneJob.ts`, `server/tests/sitemap-url-set-limit.test.ts`.

---

## 5. Ranked hypotheses (GSC buckets → code causes)

| Priority | GSC symptom | Likely code cause |
|----------|-------------|-------------------|
| 1 | **Crawled – currently not indexed** (directory/trade×geo) | Sitemap over-emits combinatorial URLs; thin empty trade counties; SSR index vs CSR noindex |
| 2 | **Duplicate / alternate with wrong canonical** | Landing SSR always index + CSR canonical/noindex rules on `/lp` and query variants |
| 3 | **Soft 404** | 200 responses with empty trade grids or minimal SSR shell while sitemap still lists URL |
| 4 | **Excluded by noindex** (expected) | Unpublished `/u` (`noindex,follow`), stale `/business` (`noindex`) - confirm URLs are **removed from sitemap**, not only tagged |
| 5 | **Discovered – not indexed** | Sitemap index depth + paginated 40k chunks vs crawl budget |

---

## 6. Priority fix files (list only - no Phase A edits)

- `server/routes/profiles.ts`
- `server/publicTradeHtml.ts`
- `server/publicLandingHtml.ts`
- `server/publicProfileHtml.ts`
- `server/publicBusinessHtml.ts`
- `server/services/seoDirectoryScopeSnapshotJob.ts`
- `server/services/seoPublicationPruneJob.ts`
- `server/repositories/sitemapRepository.ts`
- `server/sitemapUrlSet.ts`
- `server/index.ts` (public HTML route wiring)
- `client/src/pages/trade/TradeCountyPage.tsx`
- `client/src/pages/landing.tsx`
- `client/src/components/SEOHelmet.tsx`
- `shared/tradeSeo.ts`
- SEO contract tests under `server/tests/*seo*`, `server/tests/sitemap*.test.ts`

---

## 7. Gaps - requires live crawl + GSC exports

- URL samples per issue type from GSC (export CSV): crawled-not-indexed, soft 404, duplicate, excluded by noindex, valid with warnings.
- Live fetch matrix: HTML-only vs rendered DOM for trade empty, landing `/lp` + `?query`, unpublished `/u`, stale `/business` (robots, canonical, status).
- Sitemap URL ∈ GSC “Indexed pages” cross-check: which child sitemaps feed problem URLs.
- Post–2026-07-09 trend: confirm whether issues worsened after snapshot/sitemap changes on audited commit.
- Production vs `38464b4f` deploy parity if branch is not on prod.

---

## 8. Release hard stops (objector)

- **No blanket removal** of noindex on thin/unpublished/stale surfaces without URL-level eligibility rules and sitemap de-listing.
- **No “Validate Fix” in GSC** before deploy and post-deploy verification on a representative URL sample.
- **No recovery claim** until live crawl + GSC exports prove issue counts move on targeted URL classes.
- **No SEO work on** `fix/tradescout-landing-logo`; open dedicated recovery branch/worktree when unblocked.

---

*Artifact: Phase A code audit. Agent session f977a59e confirmed findings. Generated 2026-07-25.*

