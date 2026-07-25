# Phase B-lite LIVE Production Crawl — TradeScout

- **Site:** https://www.thetradescout.com
- **Crawled at:** 2026-07-25T18:22:25.717Z
- **Supplement at:** 2026-07-25T18:24:08.769Z
- **Disclaimer:** Live HTTP sample only. Does not claim Search Console indexed/excluded counts (e.g. July 9) are current. No Validate Fix requested.

## Executive verdict (live HTTP only)

- **noindex hypothesis (strongest live hit):** Sampled `/business/*` directory pages return **200 + meta robots=`noindex,nofollow`** while **146** `/business/{slug}` URLs remain in the expanded sitemap. Missing `/u/*` correctly returns **404 + `noindex,follow`**. Published `/u/*` samples are `index, follow`.
- **Thin / soft-404 hypothesis (also strong):** Googlebot SSR `/trade/*`, `/county/*`, `/city/*`, `/best/*` shells stay thin (~28–132 unique words) with weak/no listing signals; several `/city/al/-*` slugs look corrupted (soft-404 candidates). Browser UA often sees SPA chrome only (~21–29 words) while Googlebot gets fuller HTML on marketing/directory SSR routes — use **googlebot** columns for indexability.
- **Near-duplicate landings (strong):** Googlebot SSR `/landing` and `/landing/*` share homepage H1 (“Connection Without Compromise”) with ~0.99–1.0 5-gram Jaccard; titles look phrase-substituted. `/` canonicalizes to `/landing`.
- **robots.txt:** Disallows `/scout/`, `/dashboard/`, `/auth/`, `/api/`, `/admin/`, etc. Public directory paths are Allow'd. Note: HTTP still returns 200 SPA shells for some Disallow paths (robots blocks crawl, not status).

## User-Agents

- Browser: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36`
- Googlebot smartphone: `Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.84 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)`

## Sitemap

- Index: https://www.thetradescout.com/sitemap.xml
- First-pass child counts (index level): see prior byChild
- **Expanded page URLs (recursive):** **636**

### Expanded patterns

- `/county/{state}/{county}`: 305
- `/business/{slug}`: 146
- `/city/{state}/{city}`: 66
- `/exchange/{cat}/{id}`: 16
- `/trade/{trade}/{state}/{countyOrCity+}`: 14
- `/best/{...}`: 14
- `/homescout/listings/{id}`: 10
- `/u/{slug}`: 9
- `/trade/{trade}/{state}`: 4
- `/homescout/{state}/{fips}`: 2
- `/trade/{trade}`: 2
- `/`: 1
- `/about`: 1
- `/affiliate`: 1
- `/community`: 1
- `/community-feed`: 1
- `/compare`: 1
- `/compare/angi`: 1
- `/compare/community`: 1
- `/compare/coordination`: 1

### Sitemap files fetched (recursive)

- `https://www.thetradescout.com/sitemap.xml`: {"count":15,"isIndex":true}
- `https://www.thetradescout.com/sitemap-index.xml`: {"count":15,"isIndex":true}
- `https://www.thetradescout.com/sitemap-profiles.xml`: {"count":3,"isIndex":true}
- `https://www.thetradescout.com/sitemap-u-profiles.xml`: {"count":9,"isIndex":false}
- `https://www.thetradescout.com/sitemap-business-profiles.xml`: {"count":0,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-businesses.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-directory-trades.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-directory-trades-0.xml`: {"count":7,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-cities.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-directory-cities-0.xml`: {"count":66,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-trade-cities.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-directory-trade-cities-0.xml`: {"count":7,"isIndex":false}
- `https://www.thetradescout.com/sitemap-best-pages.xml`: {"count":2,"isIndex":true}
- `https://www.thetradescout.com/sitemap-best-trade-counties.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-best-trade-cities.xml`: {"count":1,"isIndex":true}
- `https://www.thetradescout.com/sitemap-core.xml`: {"count":62,"isIndex":false}
- `https://www.thetradescout.com/sitemap-homescout-counties.xml`: {"count":2,"isIndex":false}
- `https://www.thetradescout.com/sitemap-homescout-listings.xml`: {"count":10,"isIndex":false}
- `https://www.thetradescout.com/sitemap-tradepartners.xml`: {"count":1,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-counties.xml`: {"count":305,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-trade-navigation.xml`: {"count":7,"isIndex":false}
- `https://www.thetradescout.com/sitemap-recent-activity.xml`: {"count":0,"isIndex":false}
- `https://www.thetradescout.com/sitemap-exchange-listings.xml`: {"count":1,"isIndex":false}
- `https://www.thetradescout.com/sitemap-handmade-products.xml`: {"count":0,"isIndex":false}
- `https://www.thetradescout.com/sitemap-profile-service-offers.xml`: {"count":0,"isIndex":false}
- `https://www.thetradescout.com/sitemap-directory-businesses-0.xml`: {"count":146,"isIndex":false}
- `https://www.thetradescout.com/sitemap-best-trade-counties-0.xml`: {"count":7,"isIndex":false}
- `https://www.thetradescout.com/sitemap-best-trade-cities-0.xml`: {"count":7,"isIndex":false}

### Live sitemap examples

- /u/*: https://www.thetradescout.com/u/issa-build, https://www.thetradescout.com/u/jrs-auto-glass, https://www.thetradescout.com/u/la-plumbing-solutions, https://www.thetradescout.com/u/moulding-millwork-supply, https://www.thetradescout.com/u/ernesto-garcia
- /business/*: https://www.thetradescout.com/business/2h-v-construction-services-llc-2, https://www.thetradescout.com/business/360-reflective-renovations-llc, https://www.thetradescout.com/business/3pa-coastal-renovation, https://www.thetradescout.com/business/a-b-septic-tank-services, https://www.thetradescout.com/business/a-bear-refrigeration-inc-3
- deep /trade/*: https://www.thetradescout.com/trade/electrical/fl/bay, https://www.thetradescout.com/trade/electrical/fl/santa-rosa, https://www.thetradescout.com/trade/electrical/ma/barnstable, https://www.thetradescout.com/trade/plumbing/al/baldwin, https://www.thetradescout.com/trade/plumbing/al/mobile

## robots.txt (summary)

- Status: 200
- Sitemap directives: https://www.thetradescout.com/sitemap.xml, https://www.thetradescout.com/sitemap-index.xml
- Notable Disallow: /api/, /admin/, /dashboard/, /settings/, /messages/, /scout/, /auth/
- Notable Allow: /u/, /business/, /trade/, /county/, /city/, /exchange/, /homescout/, /tradepartners/

## Findings by route family

### homepage (1)

#### https://www.thetradescout.com/

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/landing | https://www.thetradescout.com/landing |
| Title | TradeScout \| Connection Without Compromise | (prefer bot) |
| H1 | Connection Without Compromise | (prefer bot) |
| Unique body words | 25 | 1852 |
| Substantive listings (bot) | — | true |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | true | h1: browser=null | googlebot="Connection Without Compromise"; approxUniqueBodyWords: browser=25 | googlebot=1852; substantiveListings: browser=false | googlebot=true |

### robots (1)

#### https://www.thetradescout.com/robots.txt

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | — | — |
| googlebot meta | — | — |
| Canonical | — | — |
| Title |  | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 39 | 39 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

### sitemap (2)

#### https://www.thetradescout.com/sitemap-index.xml

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | — | — |
| googlebot meta | — | — |
| Canonical | — | — |
| Title |  | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 24 | 24 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

#### https://www.thetradescout.com/sitemap.xml

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | — | — |
| googlebot meta | — | — |
| Canonical | — | — |
| Title |  | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 24 | 24 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

### scout (1)

#### https://www.thetradescout.com/scout

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### landing (3)

#### https://www.thetradescout.com/landing/homeowner-hvac

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/landing/homeowner-hvac | https://www.thetradescout.com/landing/homeowner-hvac |
| Title | Homeowner Hvac \| TradeScout | (prefer bot) |
| H1 | Connection Without Compromise | (prefer bot) |
| Unique body words | 24 | 1855 |
| Substantive listings (bot) | — | true |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | true | h1: browser=null | googlebot="Connection Without Compromise"; approxUniqueBodyWords: browser=24 | googlebot=1855; substantiveListings: browser=false | googlebot=true |

#### https://www.thetradescout.com/landing/supplier-addition-contractor

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/landing/supplier-addition-contractor | https://www.thetradescout.com/landing/supplier-addition-contractor |
| Title | Supplier Addition Contractor \| TradeScout | (prefer bot) |
| H1 | Connection Without Compromise | (prefer bot) |
| Unique body words | 25 | 1855 |
| Substantive listings (bot) | — | true |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | true | h1: browser=null | googlebot="Connection Without Compromise"; approxUniqueBodyWords: browser=25 | googlebot=1855 |

#### https://www.thetradescout.com/landing

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/landing | https://www.thetradescout.com/landing |
| Title | TradeScout \| Connection Without Compromise | (prefer bot) |
| H1 | Connection Without Compromise | (prefer bot) |
| Unique body words | 25 | 1852 |
| Substantive listings (bot) | — | true |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | true | h1: browser=null | googlebot="Connection Without Compromise"; approxUniqueBodyWords: browser=25 | googlebot=1852; substantiveListings: browser=false | googlebot=true |

### profile_u (6)

#### https://www.thetradescout.com/u/does-not-exist-phase-b-lite-audit-404

| Field | Browser | Googlebot |
|---|---|---|
| Status | 404 | 404 |
| Redirect | 404 | 404 |
| X-Robots-Tag | — | — |
| meta robots | noindex,follow | noindex,follow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/does-not-exist-phase-b-lite-audit-404 | https://www.thetradescout.com/u/does-not-exist-phase-b-lite-audit-404 |
| Title | Public profile unavailable \| TradeScout | (prefer bot) |
| H1 | This public profile is not available. | (prefer bot) |
| Unique body words | 68 | 68 |
| Substantive listings (bot) | — | true |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

#### https://www.thetradescout.com/u/issa-build

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/issa-build | https://www.thetradescout.com/u/issa-build |
| Title | ISSA Build \| Luxury Translucent Onyx \| TradeScout | (prefer bot) |
| H1 | ISSA Build | (prefer bot) |
| Unique body words | 27 | 40 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="ISSA Build"; approxUniqueBodyWords: browser=27 | googlebot=40 |

#### https://www.thetradescout.com/u/jrs-auto-glass

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/jrs-auto-glass | https://www.thetradescout.com/u/jrs-auto-glass |
| Title | JR&#39;s Auto Glass \| Ponchatoula Mobile Auto Glass \| TradeScout | (prefer bot) |
| H1 | JR&#39;s Auto Glass | (prefer bot) |
| Unique body words | 27 | 36 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="JR&#39;s Auto Glass"; approxUniqueBodyWords: browser=27 | googlebot=36 |

#### https://www.thetradescout.com/u/la-plumbing-solutions

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/la-plumbing-solutions | https://www.thetradescout.com/u/la-plumbing-solutions |
| Title | LA Plumbing Solutions \| Hammond, Louisiana \| TradeScout | (prefer bot) |
| H1 | LA Plumbing Solutions | (prefer bot) |
| Unique body words | 27 | 46 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="LA Plumbing Solutions"; approxUniqueBodyWords: browser=27 | googlebot=46 |

#### https://www.thetradescout.com/u/moulding-millwork-supply

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/moulding-millwork-supply | https://www.thetradescout.com/u/moulding-millwork-supply |
| Title | Moulding & Millwork Supply \| Harahan, Louisiana \| TradeScout | (prefer bot) |
| H1 | Moulding & Millwork Supply | (prefer bot) |
| Unique body words | 28 | 37 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="Moulding & Millwork Supply"; approxUniqueBodyWords: browser=28 | googlebot=37 |

#### https://www.thetradescout.com/u/ernesto-garcia

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/u/ernesto-garcia | https://www.thetradescout.com/u/ernesto-garcia |
| Title | Ernesto Garcia \| TradeScout | (prefer bot) |
| H1 | Ernesto Garcia | (prefer bot) |
| Unique body words | 24 | 22 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="Ernesto Garcia"; approxUniqueBodyWords: browser=24 | googlebot=22 |

### auth (4)

#### https://www.thetradescout.com/login

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/signup

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/auth

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/auth/login

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### account_dashboard (4)

#### https://www.thetradescout.com/dashboard

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/account

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/business-dashboard

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/my-tradescout

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### community (2)

#### https://www.thetradescout.com/community

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/community-feed

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### exchange (4)

#### https://www.thetradescout.com/exchange

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/exchange | https://www.thetradescout.com/exchange |
| Title | TradeScout Exchange \| Buy, Sell & Discover Local Listings | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 29 | 29 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/exchange/list

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/exchange | https://www.thetradescout.com/exchange |
| Title | TradeScout Exchange \| Buy, Sell & Discover Local Listings | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 29 | 29 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/tradedeals

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/exchange/business

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/exchange/business | https://www.thetradescout.com/exchange/business |
| Title | Sell Your Business \| TradeScout Exchange | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 26 | 26 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### legacy_business (4)

#### https://www.thetradescout.com/business/does-not-exist-phase-b-lite

| Field | Browser | Googlebot |
|---|---|---|
| Status | 404 | 404 |
| Redirect | 404 | 404 |
| X-Robots-Tag | — | — |
| meta robots | — | — |
| googlebot meta | — | — |
| Canonical | — | — |
| Title |  | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 3 | 3 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

#### https://www.thetradescout.com/business/2h-v-construction-services-llc-2

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | noindex,nofollow | noindex,nofollow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/business/2h-v-construction-services-llc-2 | https://www.thetradescout.com/business/2h-v-construction-services-llc-2 |
| Title | 2H&V Construction Services, LLC. in Harvey Cou… \| TradeScout | (prefer bot) |
| H1 | 2H&V Construction Services, LLC. | (prefer bot) |
| Unique body words | 29 | 22 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="2H&V Construction Services, LLC."; approxUniqueBodyWords: browser=29 | googlebot=22 |

#### https://www.thetradescout.com/business/360-reflective-renovations-llc

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | noindex,nofollow | noindex,nofollow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/business/360-reflective-renovations-llc | https://www.thetradescout.com/business/360-reflective-renovations-llc |
| Title | 360 Reflective Renovations LLC in Okaloosa Cou… \| TradeScout | (prefer bot) |
| H1 | 360 Reflective Renovations LLC | (prefer bot) |
| Unique body words | 29 | 22 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="360 Reflective Renovations LLC"; approxUniqueBodyWords: browser=29 | googlebot=22 |

#### https://www.thetradescout.com/business/3pa-coastal-renovation

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | noindex,nofollow | noindex,nofollow |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/business/3pa-coastal-renovation | https://www.thetradescout.com/business/3pa-coastal-renovation |
| Title | 3pa coastal renovation in Okaloosa County, FL \| TradeScout | (prefer bot) |
| H1 | 3pa coastal renovation | (prefer bot) |
| Unique body words | 29 | 22 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="3pa coastal renovation"; approxUniqueBodyWords: browser=29 | googlebot=22 |

### trade_geo (12)

#### https://www.thetradescout.com/trade/electrical

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical | https://www.thetradescout.com/trade/electrical |
| Title | Find Electrical Contractor Contractors by State \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor | (prefer bot) |
| Unique body words | 28 | 114 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor"; approxUniqueBodyWords: browser=28 | googlebot=114 |

#### https://www.thetradescout.com/trade/plumbing

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/plumbing | https://www.thetradescout.com/trade/plumbing |
| Title | Find Plumbing Contractor Contractors by State \| TradeScout | (prefer bot) |
| H1 | Plumbing Contractor | (prefer bot) |
| Unique body words | 28 | 114 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Plumbing Contractor"; approxUniqueBodyWords: browser=28 | googlebot=114 |

#### https://www.thetradescout.com/trade/electrical/fl

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical/fl | https://www.thetradescout.com/trade/electrical/fl |
| Title | Electrical Contractor Contractors in Florida \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor in Florida | (prefer bot) |
| Unique body words | 27 | 132 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor in Florida"; approxUniqueBodyWords: browser=27 | googlebot=132 |

#### https://www.thetradescout.com/trade/electrical/ma

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical/ma | https://www.thetradescout.com/trade/electrical/ma |
| Title | Electrical Contractor Contractors in Massachus… \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor in Massachusetts | (prefer bot) |
| Unique body words | 27 | 76 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor in Massachusetts"; approxUniqueBodyWords: browser=27 | googlebot=76 |

#### https://www.thetradescout.com/trade/plumbing/al

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/plumbing/al | https://www.thetradescout.com/trade/plumbing/al |
| Title | Plumbing Contractor Contractors in Alabama \| TradeScout | (prefer bot) |
| H1 | Plumbing Contractor in Alabama | (prefer bot) |
| Unique body words | 27 | 129 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Plumbing Contractor in Alabama"; approxUniqueBodyWords: browser=27 | googlebot=129 |

#### https://www.thetradescout.com/trade/plumbing/fl

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/plumbing/fl | https://www.thetradescout.com/trade/plumbing/fl |
| Title | Plumbing Contractor Contractors in Florida \| TradeScout | (prefer bot) |
| H1 | Plumbing Contractor in Florida | (prefer bot) |
| Unique body words | 27 | 132 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | trade_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Plumbing Contractor in Florida"; approxUniqueBodyWords: browser=27 | googlebot=132 |

#### https://www.thetradescout.com/tradepartners/escambia-fl

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | false | — |

#### https://www.thetradescout.com/trade

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade | https://www.thetradescout.com/trade |
| Title | Find Contractors by Trade \| TradeScout | (prefer bot) |
| H1 | Trades Directory | (prefer bot) |
| Unique body words | 26 | 122 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Trades Directory"; approxUniqueBodyWords: browser=26 | googlebot=122 |

#### https://www.thetradescout.com/trade/electrical/fl/bay

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical/fl/bay | https://www.thetradescout.com/trade/electrical/fl/bay |
| Title | Electrical Contractor in Bay County, FL \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor in Bay County, FL | (prefer bot) |
| Unique body words | 28 | 78 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor in Bay County, FL"; approxUniqueBodyWords: browser=28 | googlebot=78 |

#### https://www.thetradescout.com/trade/electrical/fl/santa-rosa

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical/fl/santa-rosa | https://www.thetradescout.com/trade/electrical/fl/santa-rosa |
| Title | Electrical Contractor in Santa Rosa County, FL \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor in Santa Rosa County, FL | (prefer bot) |
| Unique body words | 29 | 79 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor in Santa Rosa County, FL"; approxUniqueBodyWords: browser=29 | googlebot=79 |

#### https://www.thetradescout.com/trade/electrical/ma/barnstable

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/electrical/ma/barnstable | https://www.thetradescout.com/trade/electrical/ma/barnstable |
| Title | Electrical Contractor in Barnstable County, MA \| TradeScout | (prefer bot) |
| H1 | Electrical Contractor in Barnstable County, MA | (prefer bot) |
| Unique body words | 28 | 78 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Electrical Contractor in Barnstable County, MA"; approxUniqueBodyWords: browser=28 | googlebot=78 |

#### https://www.thetradescout.com/trade/plumbing/al/baldwin

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/trade/plumbing/al/baldwin | https://www.thetradescout.com/trade/plumbing/al/baldwin |
| Title | Plumbing Contractor in Baldwin County, AL \| TradeScout | (prefer bot) |
| H1 | Plumbing Contractor in Baldwin County, AL | (prefer bot) |
| Unique body words | 28 | 83 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Plumbing Contractor in Baldwin County, AL"; approxUniqueBodyWords: browser=28 | googlebot=83 |

### county (3)

#### https://www.thetradescout.com/county/al/baldwin

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/county/al/baldwin | https://www.thetradescout.com/county/al/baldwin |
| Title | Find Contractors in Baldwin County, AL \| TradeScout | (prefer bot) |
| H1 | Baldwin County, AL | (prefer bot) |
| Unique body words | 28 | 47 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Baldwin County, AL"; approxUniqueBodyWords: browser=28 | googlebot=47 |

#### https://www.thetradescout.com/county/al/mobile

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/county/al/mobile | https://www.thetradescout.com/county/al/mobile |
| Title | Find Contractors in Mobile County, AL \| TradeScout | (prefer bot) |
| H1 | Mobile County, AL | (prefer bot) |
| Unique body words | 28 | 40 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Mobile County, AL"; approxUniqueBodyWords: browser=28 | googlebot=40 |

#### https://www.thetradescout.com/county/al/coffee

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/county/al/coffee | https://www.thetradescout.com/county/al/coffee |
| Title | Find Contractors in Coffee County, AL \| TradeScout | (prefer bot) |
| H1 | Coffee County, AL | (prefer bot) |
| Unique body words | 28 | 38 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Coffee County, AL"; approxUniqueBodyWords: browser=28 | googlebot=38 |

### direct_connect (2)

#### https://www.thetradescout.com/direct-connect

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/directconnect

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow | index, follow |
| googlebot meta | — | — |
| Canonical | — | — |
| Title | TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 21 | 21 |
| Substantive listings (bot) | — | false |
| In sitemap? | false | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

### city (3)

#### https://www.thetradescout.com/city/al/-agnolia-prings

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/city/al/-agnolia-prings | https://www.thetradescout.com/city/al/-agnolia-prings |
| Title | Agnolia Prings, AL Contractors Directory \| TradeScout | (prefer bot) |
| H1 | Agnolia Prings, AL | (prefer bot) |
| Unique body words | 27 | 29 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Agnolia Prings, AL"; approxUniqueBodyWords: browser=27 | googlebot=29 |

#### https://www.thetradescout.com/city/al/-airhope

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/city/al/-airhope | https://www.thetradescout.com/city/al/-airhope |
| Title | Airhope, AL Contractors Directory \| TradeScout | (prefer bot) |
| H1 | Airhope, AL | (prefer bot) |
| Unique body words | 26 | 28 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Airhope, AL"; approxUniqueBodyWords: browser=26 | googlebot=28 |

#### https://www.thetradescout.com/city/al/-araland

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/city/al/-araland | https://www.thetradescout.com/city/al/-araland |
| Title | Araland, AL Contractors Directory \| TradeScout | (prefer bot) |
| H1 | Araland, AL | (prefer bot) |
| Unique body words | 26 | 28 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words; directory_shell_no_listings |
| UA differs? | true | h1: browser=null | googlebot="Araland, AL"; approxUniqueBodyWords: browser=26 | googlebot=28 |

### best_pages (3)

#### https://www.thetradescout.com/best/electrical/fl/bay

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/best/electrical/fl/bay | https://www.thetradescout.com/best/electrical/fl/bay |
| Title | Best Electrical Contractor in Bay County, FL \| TradeScout | (prefer bot) |
| H1 | Best Electrical Contractor in Bay County, FL | (prefer bot) |
| Unique body words | 29 | 36 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="Best Electrical Contractor in Bay County, FL"; approxUniqueBodyWords: browser=29 | googlebot=36 |

#### https://www.thetradescout.com/best/electrical/fl/santa-rosa

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/best/electrical/fl/santa-rosa | https://www.thetradescout.com/best/electrical/fl/santa-rosa |
| Title | Best Electrical Contractor in Santa Rosa Count… \| TradeScout | (prefer bot) |
| H1 | Best Electrical Contractor in Santa Rosa County, FL | (prefer bot) |
| Unique body words | 29 | 38 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="Best Electrical Contractor in Santa Rosa County, FL"; approxUniqueBodyWords: browser=29 | googlebot=38 |

#### https://www.thetradescout.com/best/electrical/ma/barnstable

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 | index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1 |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/best/electrical/ma/barnstable | https://www.thetradescout.com/best/electrical/ma/barnstable |
| Title | Best Electrical Contractor in Barnstable Count… \| TradeScout | (prefer bot) |
| H1 | Best Electrical Contractor in Barnstable County, MA | (prefer bot) |
| Unique body words | 28 | 37 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | true | h1: browser=null | googlebot="Best Electrical Contractor in Barnstable County, MA"; approxUniqueBodyWords: browser=28 | googlebot=37 |

### homescout (2)

#### https://www.thetradescout.com/homescout/listings/4923b779-64c8-4729-91c0-9e278307eae6

| Field | Browser | Googlebot |
|---|---|---|
| Status | 200 | 200 |
| Redirect | 200 | 200 |
| X-Robots-Tag | — | — |
| meta robots | index, follow, max-image-preview:large | index, follow, max-image-preview:large |
| googlebot meta | — | — |
| Canonical | https://www.thetradescout.com/homescout/listings/4923b779-64c8-4729-91c0-9e278307eae6 | https://www.thetradescout.com/homescout/listings/4923b779-64c8-4729-91c0-9e278307eae6 |
| Title | Smoke Home Authorized 1773022418828 \| HomeScout \| TradeScout | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 27 | 27 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | very_thin_unique_words |
| UA differs? | false | — |

#### https://www.thetradescout.com/homescout/listings/999d5c07-5779-4b74-86ed-bb2e47f7f5db

| Field | Browser | Googlebot |
|---|---|---|
| Status | 404 | 404 |
| Redirect | 404 | 404 |
| X-Robots-Tag | noindex, nofollow | noindex, nofollow |
| meta robots | — | — |
| googlebot meta | — | — |
| Canonical | — | — |
| Title |  | (prefer bot) |
| H1 |  | (prefer bot) |
| Unique body words | 4 | 4 |
| Substantive listings (bot) | — | false |
| In sitemap? | true | — |
| Soft-404 hints (bot) | — | — |
| UA differs? | false | — |

## Landing vs homepage near-duplicate (Googlebot SSR)

- **https://www.thetradescout.com/landing/homeowner-hvac**: jaccard5=0.9941, shared=5912, sameH1=true, suspect=true — Googlebot SSR: identical H1 to homepage — phrase/title substitution landing
  - titles: home="TradeScout \| Connection Without Compromise" vs landing="Homeowner Hvac \| TradeScout"
  - h1: home="Connection Without Compromise" vs landing="Connection Without Compromise"
  - unique words: home=1852 landing=1855
- **https://www.thetradescout.com/landing/supplier-addition-contractor**: jaccard5=0.9938, shared=5912, sameH1=true, suspect=true — Googlebot SSR: identical H1 to homepage — phrase/title substitution landing
  - titles: home="TradeScout \| Connection Without Compromise" vs landing="Supplier Addition Contractor \| TradeScout"
  - h1: home="Connection Without Compromise" vs landing="Connection Without Compromise"
  - unique words: home=1852 landing=1855
- **https://www.thetradescout.com/landing**: jaccard5=1, shared=5929, sameH1=true, suspect=true — Googlebot SSR: identical H1 to homepage — phrase/title substitution landing
  - titles: home="TradeScout \| Connection Without Compromise" vs landing="TradeScout \| Connection Without Compromise"
  - h1: home="Connection Without Compromise" vs landing="Connection Without Compromise"
  - unique words: home=1852 landing=1852

## Strongest live evidence

### noindex hypothesis

- https://www.thetradescout.com/u/does-not-exist-phase-b-lite-audit-404 status=404 meta=noindex,follow x-robots=null (googlebot)
- https://www.thetradescout.com/business/2h-v-construction-services-llc-2 status=200 meta=noindex,nofollow x-robots=null (googlebot)
- https://www.thetradescout.com/business/360-reflective-renovations-llc status=200 meta=noindex,nofollow x-robots=null (googlebot)
- https://www.thetradescout.com/business/3pa-coastal-renovation status=200 meta=noindex,nofollow x-robots=null (googlebot)
- https://www.thetradescout.com/homescout/listings/999d5c07-5779-4b74-86ed-bb2e47f7f5db status=404 meta=null x-robots=noindex, nofollow (googlebot)

### thin-page / soft-404 hypothesis (Googlebot-weighted)

- https://www.thetradescout.com/trade/electrical words=114 listings=false hints=trade_shell_no_listings h1="Electrical Contractor" title="Find Electrical Contractor Contractors by State \| TradeScout"
- https://www.thetradescout.com/trade/plumbing words=114 listings=false hints=trade_shell_no_listings h1="Plumbing Contractor" title="Find Plumbing Contractor Contractors by State \| TradeScout"
- https://www.thetradescout.com/trade/electrical/fl words=132 listings=false hints=trade_shell_no_listings h1="Electrical Contractor in Florida" title="Electrical Contractor Contractors in Florida \| TradeScout"
- https://www.thetradescout.com/trade/electrical/ma words=76 listings=false hints=very_thin_unique_words,trade_shell_no_listings h1="Electrical Contractor in Massachusetts" title="Electrical Contractor Contractors in Massachus… \| TradeScout"
- https://www.thetradescout.com/trade/plumbing/al words=129 listings=false hints=trade_shell_no_listings h1="Plumbing Contractor in Alabama" title="Plumbing Contractor Contractors in Alabama \| TradeScout"
- https://www.thetradescout.com/trade/plumbing/fl words=132 listings=false hints=trade_shell_no_listings h1="Plumbing Contractor in Florida" title="Plumbing Contractor Contractors in Florida \| TradeScout"
- https://www.thetradescout.com/tradepartners/escambia-fl words=21 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="" title="TradeScout"
- https://www.thetradescout.com/trade words=122 listings=false hints=directory_shell_no_listings h1="Trades Directory" title="Find Contractors by Trade \| TradeScout"
- https://www.thetradescout.com/county/al/baldwin words=47 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Baldwin County, AL" title="Find Contractors in Baldwin County, AL \| TradeScout"
- https://www.thetradescout.com/county/al/mobile words=40 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Mobile County, AL" title="Find Contractors in Mobile County, AL \| TradeScout"
- https://www.thetradescout.com/u/issa-build words=40 listings=false hints=very_thin_unique_words h1="ISSA Build" title="ISSA Build \| Luxury Translucent Onyx \| TradeScout"
- https://www.thetradescout.com/u/jrs-auto-glass words=36 listings=false hints=very_thin_unique_words h1="JR&#39;s Auto Glass" title="JR&#39;s Auto Glass \| Ponchatoula Mobile Auto Glass \| TradeScout"
- https://www.thetradescout.com/u/la-plumbing-solutions words=46 listings=false hints=very_thin_unique_words h1="LA Plumbing Solutions" title="LA Plumbing Solutions \| Hammond, Louisiana \| TradeScout"
- https://www.thetradescout.com/u/moulding-millwork-supply words=37 listings=false hints=very_thin_unique_words h1="Moulding & Millwork Supply" title="Moulding & Millwork Supply \| Harahan, Louisiana \| TradeScout"
- https://www.thetradescout.com/u/ernesto-garcia words=22 listings=false hints=very_thin_unique_words h1="Ernesto Garcia" title="Ernesto Garcia \| TradeScout"
- https://www.thetradescout.com/business/2h-v-construction-services-llc-2 words=22 listings=false hints=very_thin_unique_words h1="2H&V Construction Services, LLC." title="2H&V Construction Services, LLC. in Harvey Cou… \| TradeScout"
- https://www.thetradescout.com/business/360-reflective-renovations-llc words=22 listings=false hints=very_thin_unique_words h1="360 Reflective Renovations LLC" title="360 Reflective Renovations LLC in Okaloosa Cou… \| TradeScout"
- https://www.thetradescout.com/business/3pa-coastal-renovation words=22 listings=false hints=very_thin_unique_words h1="3pa coastal renovation" title="3pa coastal renovation in Okaloosa County, FL \| TradeScout"
- https://www.thetradescout.com/trade/electrical/fl/bay words=78 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Electrical Contractor in Bay County, FL" title="Electrical Contractor in Bay County, FL \| TradeScout"
- https://www.thetradescout.com/trade/electrical/fl/santa-rosa words=79 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Electrical Contractor in Santa Rosa County, FL" title="Electrical Contractor in Santa Rosa County, FL \| TradeScout"
- https://www.thetradescout.com/trade/electrical/ma/barnstable words=78 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Electrical Contractor in Barnstable County, MA" title="Electrical Contractor in Barnstable County, MA \| TradeScout"
- https://www.thetradescout.com/trade/plumbing/al/baldwin words=83 listings=false hints=directory_shell_no_listings h1="Plumbing Contractor in Baldwin County, AL" title="Plumbing Contractor in Baldwin County, AL \| TradeScout"
- https://www.thetradescout.com/city/al/-agnolia-prings words=29 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Agnolia Prings, AL" title="Agnolia Prings, AL Contractors Directory \| TradeScout"
- https://www.thetradescout.com/city/al/-airhope words=28 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Airhope, AL" title="Airhope, AL Contractors Directory \| TradeScout"
- https://www.thetradescout.com/city/al/-araland words=28 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Araland, AL" title="Araland, AL Contractors Directory \| TradeScout"
- https://www.thetradescout.com/best/electrical/fl/bay words=36 listings=false hints=very_thin_unique_words h1="Best Electrical Contractor in Bay County, FL" title="Best Electrical Contractor in Bay County, FL \| TradeScout"
- https://www.thetradescout.com/best/electrical/fl/santa-rosa words=38 listings=false hints=very_thin_unique_words h1="Best Electrical Contractor in Santa Rosa County, FL" title="Best Electrical Contractor in Santa Rosa Count… \| TradeScout"
- https://www.thetradescout.com/best/electrical/ma/barnstable words=37 listings=false hints=very_thin_unique_words h1="Best Electrical Contractor in Barnstable County, MA" title="Best Electrical Contractor in Barnstable Count… \| TradeScout"
- https://www.thetradescout.com/county/al/coffee words=38 listings=false hints=very_thin_unique_words,directory_shell_no_listings h1="Coffee County, AL" title="Find Contractors in Coffee County, AL \| TradeScout"

### UA differences (material)

_Pattern:_ On SSR public marketing/directory routes, browser UA often receives thin SPA shell; Googlebot smartphone receives fuller HTML (h1 + body). Not claimed as malicious cloaking — treat as bot SSR / dynamic rendering. Indexability judgments must use Googlebot column._

## Exact next URL samples needed from Search Console exports

1. **Excluded by 'noindex' tag — sample of affected URLs by template**
   - Why: Confirm whether noindex is concentrated on /trade/*, /landing/*, /u/*, or auth shells
   - Export: Coverage/Page indexing > Excluded > Excluded by ‘noindex’ tag > Export examples
1. **Crawled – currently not indexed — /trade/* long-tail samples**
   - Why: Strongest soft-404/thin hypothesis for geo shells; need GSC-selected URLs not inventable from sitemap alone
   - Export: Page indexing > Crawled - currently not indexed > filter path /trade/
1. **Duplicate without user-selected canonical — landing vs home**
   - Why: Validate phrase-substitution landings GSC treats as duplicates of /
   - Export: Page indexing > Duplicate without user-selected canonical (or Google chose different canonical)
1. **Soft 404 examples (if reason present)**
   - Why: Correlate empty trade/location shells with GSC soft-404 classification
   - Export: Page indexing > Soft 404
1. **Alternate page with proper canonical set — /business/* vs /u/***
   - Why: Legacy business URL fate vs published profiles
   - Export: Page indexing > Alternate page with proper canonical tag
1. **Blocked by robots.txt (if any) — account/auth paths**
   - Why: Separate intentional deindex of private app chrome from public directory loss
   - Export: Page indexing > Blocked by robots.txt
1. **Discovered – currently not indexed — sitemap-submitted /u/* not yet crawled**
   - Why: Distinguish crawl-budget/discovery lag from noindex/thin
   - Export: Page indexing > Discovered - currently not indexed; filter /u/

Also pull example URLs matching these live sitemap shapes if GSC reasons cite them:
- https://www.thetradescout.com/u/issa-build, https://www.thetradescout.com/u/jrs-auto-glass, https://www.thetradescout.com/u/la-plumbing-solutions
- https://www.thetradescout.com/business/2h-v-construction-services-llc-2, https://www.thetradescout.com/business/360-reflective-renovations-llc, https://www.thetradescout.com/business/3pa-coastal-renovation
- https://www.thetradescout.com/trade/electrical/fl/bay, https://www.thetradescout.com/trade/electrical/fl/santa-rosa, https://www.thetradescout.com/trade/electrical/ma/barnstable
- /county/{st}/{county}, /landing/*, /tradepartners/*

## Repro

```bash
node artifacts/evidence/phase-b-lite/live-crawl.mjs
node artifacts/evidence/phase-b-lite/live-crawl-supplement.mjs
```
