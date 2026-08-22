# TradeScout SEO / Discovery Architecture (New & True Only)

## Boundaries (Public vs Private)

TradeScout exposes a **crawlable discovery layer** while keeping routing, trust intelligence, and contact flows private.

**Public (crawlable)**
- `/business/:slug` (directory + published business presence)
- `/trade/*` (trade directories)
- `/city/:stateCode/:citySlug` (city discovery)
- `/county/:stateCode/:countySlug` (county discovery)
- `/best/*` (verified-only “best” scopes; transparent definition)
- `/datasets/*` (HTML dataset pages)
- `/sitemap*.xml`, `/robots.txt`, `/llms.txt`
- `/indexnow-key.txt` when `BING_INDEXNOW_KEY` or `INDEXNOW_KEY` is configured

**AI/search discovery**
- `robots.txt` includes explicit groups for Meta crawlers (`facebookexternalhit`, `Facebot`, `meta-externalagent`, `meta-externalfetcher`), Bing/Microsoft legacy discovery (`bingbot`, `msnbot`), DuckDuckGo (`DuckDuckBot`, `DuckAssistBot`), Apple (`Applebot`, `Applebot-Extended`), Yandex (`YandexBot`), Yahoo (`Slurp`), OpenAI search/training/user fetchers (`OAI-SearchBot`, `GPTBot`, `ChatGPT-User`), and Perplexity (`PerplexityBot`).
- These agents may crawl the same public discovery layer as other crawlers, but remain blocked from `/api/*`, `/admin/*`, `/dashboard/*`, `/scout/*`, `/messages/*`, `/settings/*`, and `/auth/*`.
- `/llms.txt` dynamically lists the same-host profiles and opted-in profile content that currently pass public exposure and indexing gates. It is supplemental machine-readable guidance, not proof or a guarantee of search/AI inclusion, ranking, or citation.
- Bing is the priority non-Google setup target because Bing Webmaster Tools plus IndexNow can speed discovery for Bing and participating downstream search engines.
- TradeScout serves the IndexNow ownership key at `/indexnow-key.txt`; submit URLs with `keyLocation=https://www.thetradescout.com/indexnow-key.txt`.

**Private (never crawlable)**
- `/api/*` (robots disallowed; JSON used by SPA)
- `/admin/*`, `/dashboard/*`, `/scout/*`, `/messages/*`, `/settings/*`, `/auth/*`

## Platform Law (Preserved)

- **Awareness ≠ Authority**: discovery pages never grant contact power.
- **Contact remains gated**: discovery pages do not expose phone/email and do not bypass intent/decision/contact gates.
- **No pay-to-play**: discovery ordering does not affect trust/routing and does not use paid boosts.
- **Counties are operational containers**: public scopes are still county/state/city constrained.

## “New & True Only” Enforcement

Source of truth:
- `ts_publication_rules` (row id=`default`) defines staleness windows + recency windows.

Shared logic:
- `shared/publication.ts` implements:
  - `isPublicAndCrawlableBusiness(...)`
  - `isPublicAndCrawlableActivity(...)`

### Business listing is public/crawlable only if:
- `businesses.public_discovery_enabled = true`
- Has minimum identity signals: `name`, `slug`, **trade match**, **county + state** (derived at render time)
- Passes tier-based staleness window (based on claim + verification tier)

### Stale listing behavior
- Removed from public lists and sitemaps.
- If URL remains accessible, HTML renders with `noindex,nofollow` and an “inactive/out of date” message.

## Route Map

Entity pages:
- `/business/:slug`
- `/trade`
- `/trade/:tradeSlug`
- `/trade/:tradeSlug/:stateCode`
- `/trade/:tradeSlug/:stateCode/:countySlug`
- `/trade/:tradeSlug/:stateCode/city/:citySlug`
- `/city/:stateCode/:citySlug`
- `/county/:stateCode/:countySlug`

Long-tail “intent” pages:
- `/best/:tradeSlug/:stateCode/:countySlug`
- `/best/:tradeSlug/:stateCode/city/:citySlug`

Freshness pages:
- `/county/:stateCode/:countySlug/recent`
- `/city/:stateCode/:citySlug/recent`
- `/trade/:tradeSlug/:stateCode/:countySlug/recent`
- `/trade/:tradeSlug/:stateCode/city/:citySlug/recent`

## Structured Data (JSON-LD)

Implemented as SSR-injected JSON-LD:
- Business pages: `LocalBusiness` (no phone/email; area served via county/city when present)
- Trade/county/city/best pages: `ItemList` or `CollectionPage` (URLs + names only)

## Sitemaps

`/sitemap.xml` is an index sitemap pointing to:
- Core routes: `/sitemap-core.xml`
- Profiles: `/sitemap-profiles.xml`
  - `/sitemap-u-profiles.xml` always lists eligible same-host profile canonicals and may also list child material/category/gallery canonicals only when that profile's `publicDiscovery.sitemap` data explicitly opts them in.
- Directory businesses: `/sitemap-directory-businesses.xml` (paged)
- Directory counties/cities: `/sitemap-directory-counties.xml`, `/sitemap-directory-cities.xml`
- Trade scopes: `/sitemap-directory-trades.xml`, `/sitemap-directory-trade-cities.xml` (from snapshot tables)
- Best scopes: `/sitemap-best-pages.xml` (from snapshot tables)
- Recent activity: `/sitemap-recent-activity.xml` (from `ts_public_activity`)

### Snapshot tables
To keep sitemaps “new & true only” without expensive per-request computation:
- `ts_seo_trade_county_pages`
- `ts_seo_trade_city_pages`

These are rebuilt by a scheduled job from recent, crawlable businesses.

## Scheduled Jobs

Jobs run only when `SCHEDULER_ENABLED=true`.

- `seo_publication_prune` (hourly by default)
  - Deactivates stale directory listings by setting `businesses.public_discovery_enabled=false`
  - Expires `ts_public_activity` rows whose `expires_at <= now()`
  - Logs to `ts_seo_prune_log`

- `seo_directory_scope_snapshot` (every 6 hours by default)
  - Rebuilds `ts_seo_trade_county_pages` + `ts_seo_trade_city_pages`

## Verification Checklist

1) **Crawlers see content in view-source**
   - Open `/business/:slug`, `/trade/...`, `/city/...`, `/county/...`, `/best/...`
   - Confirm the initial HTML contains the listing links (SSR summary).

2) **Robots**
   - Open `/robots.txt` and confirm:
     - Allows `/business/`, `/trade/`, `/city/`, `/county/`, `/datasets/`, `/best/`
     - Disallows `/api/`, `/admin/`, `/dashboard/`, `/scout/`
      - Includes explicit Bing, DuckDuckGo, Apple, Yahoo, Meta, OpenAI, and Perplexity crawler groups

3) **Sitemaps are pruned**
   - Open `/sitemap.xml` and confirm it references sub-sitemaps.
   - Open `/sitemap-directory-businesses-0.xml` and confirm it contains only public discovery listings.

4) **Bing / IndexNow**
   - Generate an IndexNow key in Bing Webmaster Tools.
   - Set `BING_INDEXNOW_KEY` or `INDEXNOW_KEY` in production.
   - Confirm `https://www.thetradescout.com/indexnow-key.txt` returns only the key.
   - Submit changed URLs with `keyLocation=https://www.thetradescout.com/indexnow-key.txt`.

5) **Stale business removal**
   - Pick a business slug and set `updated_at` to older than its tier threshold.
   - Run the prune job (or wait for scheduler).
   - Verify:
     - The business disappears from `/sitemap-directory-businesses-*.xml`
     - `/business/:slug` renders `noindex,nofollow` and “inactive/out of date”

6) **No PII leakage**
   - Confirm public SSR pages do not show phone/email.
   - Confirm public “recent” pages show only `ts_public_activity.public_text` and activity labels (no addresses, no contact).
