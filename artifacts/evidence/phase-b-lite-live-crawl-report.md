# Phase B-lite LIVE Production Crawl Report
**Site:** https://www.thetradescout.com  
**Crawl date:** 2026-07-25 (live production)  
**Build header:** `x-tradescout-build: eedf5d757c8c994ae8f55f47492411333e72e32f`  
**Method:** Dual-UA fetch (browser Chrome 120 vs Googlebot smartphone) via curl + PowerShell probes  
**Constraint:** July 9 GSC snapshot ≠ live today; no Validate Fix; no indexing requests submitted.

---

## Executive Summary

Live production shows **no `X-Robots-Tag` headers** and **almost no live `noindex`** on indexable directory/landing routes. The strongest live signals for deindexing/thin-content are:

1. **Sitemap vs meta conflict on `/business/*`** — 146 URLs in sitemap; **7/8 sampled return `noindex,nofollow`** while still listed in sitemap.
2. **Empty directory pages indexed** — trade/county/best pages with `"itemListElement":[]` still carry `index, follow` (e.g. `/trade/plumbing/fl/bay`, `/best/electrical/fl/bay`, `/county/al/coffee`).
3. **Near-duplicate landing template** — `/landing/*` subpages share identical H1 and templated meta descriptions; only `/landing` is in sitemap; **`/` canonical points to `/landing`**.
4. **SPA shell on app routes** — `/scout`, `/auth`, `/dashboard`, `/direct-connect`, `/community`, `/search`, etc. serve ~225-char boot shell with generic title to **both UAs** despite robots.txt `Disallow` on some.
5. **SSR split** — Landing/trade/county/u-profile routes serve ~46k chars to Googlebot vs ~250 chars to browser (client-rendered shell in initial HTML).

**No live evidence supports a site-wide noindex hypothesis** for directory or landing families. Thin/boilerplate + sitemap-noindex mismatch is the stronger live explanation for index recovery issues.

---

## Sitemap Inventory (live 2026-07-25)

Both `/sitemap.xml` and `/sitemap-index.xml` resolve to the same 15-child index. `robots.txt` declares both.

| Child sitemap | URL count | Primary patterns |
|---|---:|---|
| sitemap-core.xml | 62 | `/`, `/about`, `/community`, `/direct-connect`, `/exchange/*`, `/landing` (hub only), `/trade`, `/county-directory`, compare/help pages |
| sitemap-profiles.xml → sitemap-u-profiles.xml | 9 | `/u/{slug}` |
| sitemap-profiles.xml → sitemap-business-profiles.xml | 0 | (empty) |
| sitemap-profiles.xml → sitemap-directory-businesses-0.xml | 146 | `/business/{slug}` |
| sitemap-directory-counties.xml | 305 | `/county/{st}/{county}` — MS(82), AL(67), FL(67), LA(64), NC(5) |
| sitemap-directory-trades-0.xml | 7 | `/trade/{trade}/{st}/{county}` — plumbing(4), electrical(3) |
| sitemap-directory-cities-0.xml | 66 | `/city/{st}/{city}` |
| sitemap-directory-trade-cities-0.xml | 7 | `/trade/{trade}/{st}/{city}` |
| sitemap-directory-trade-navigation.xml | 7 | trade hub nav |
| sitemap-homescout-counties.xml | 2 | `/homescout/{AL\|LA}` |
| sitemap-homescout-listings.xml | 10 | `/homescout/listings/{id}` |
| sitemap-tradepartners.xml | 1 | `/tradepartners/escambia-fl` |
| sitemap-best-trade-counties-0.xml | 7 | `/best/{trade}/{st}/{county}` |
| sitemap-best-trade-cities-0.xml | 7 | `/best/{trade}/{st}/{city}` |
| sitemap-exchange-listings.xml | 1 | `/exchange/smokecategory-*` |
| sitemap-recent-activity.xml | 0 | empty |
| sitemap-handmade-products.xml | 0 | empty |
| sitemap-profile-service-offers.xml | 0 | empty |

**Leaf URL total:** ~625 URLs across leaf sitemaps.

**Not in sitemap (live):** `/landing/homeowner-hvac`, `/landing/supplier-addition-contractor`, other `/landing/*` subpages (only `/landing` hub listed).

---

## robots.txt vs Live Meta (conflicts)

| Path prefix | robots.txt | Live meta (Googlebot) | Notes |
|---|---|---|---|
| `/scout/` | **Disallow** | `index, follow` | Thin SPA shell, generic title |
| `/auth/` | **Disallow** | `index, follow` | Thin SPA shell |
| `/dashboard/` | **Disallow** | `index, follow` | Thin SPA shell |
| `/u/` | Allow | `index, follow` (published) | 9 profiles in sitemap |
| `/business/` | Allow | **Mixed: mostly `noindex,nofollow`** | 146 in sitemap |
| `/trade/`, `/county/`, `/best/` | Allow | `index, follow` | Even when ItemList empty |
| `/landing` | (no disallow) | `index, follow` | Subpages not in sitemap |

---

## Route-Family Findings

### 1. Homepage & Landing (`/`, `/landing`, `/landing/*`)

| URL | Status | Redirects | X-Robots | Meta robots | Canonical | Title | H1 (Googlebot) | Body len B/G | In sitemap? | UA diff |
|---|---|---|---|---|---|---|---|---:|---|---|
| `/` | 200 | none | none | index,follow | **`/landing`** | TradeScout \| Connection Without Compromise | Connection Without Compromise | 257 / 46,329 | yes | **YES** — massive SSR gap |
| `/landing` | 200 | none | none | index,follow | `/landing` | same as `/` | Connection Without Compromise | 257 / 46,329 | yes | YES |
| `/landing/homeowner-hvac` | 200 | none | none | index,follow | self | Homeowner Hvac \| TradeScout | **Connection Without Compromise** | 242 / 46,298 | **no** | YES |
| `/landing/supplier-addition-contractor` | 200 | none | none | index,follow | self | Supplier Addition Contractor \| TradeScout | **Connection Without Compromise** | 256 / 46,326 | **no** | YES |

**Near-duplicate phrase substitution (landings vs homepage):**

| Page | Meta description pattern |
|---|---|
| `/landing` | "Find what you need. Show what you offer. TradeScout connects people and local businesses without sold leads, paid ranking, or contact before acceptance." |
| `/landing/homeowner-hvac` | "TradeScout for **Homeowner Hvac**. Find what you need or show what you offer without sold leads, paid ranking, or contact before acceptance." |
| `/landing/supplier-addition-contractor` | "TradeScout for **Supplier Addition Contractor**. Find what you need or show what you offer without sold leads, paid ranking, or contact before acceptance." |

Same H1 on all three Googlebot renders. Body content ~46k chars appears structurally identical (full marketing page SSR).

**Strongest signal:** `/` canonical → `/landing` creates explicit duplicate cluster; sub-landings are template clones not in sitemap.

---

### 2. Direct Connect & Scout (app shells)

| URL | Status | Meta robots | Title | Body len B/G | Substantive listings? | In sitemap? | UA diff |
|---|---|---|---|---:|---|---|---|
| `/direct-connect` | 200 | index,follow | TradeScout (generic) | 225 / 225 | No (boot shell) | yes (core) | No |
| `/direct-connect-info` | 200 | index,follow | TradeScout | 225 / 225 | No | yes | No |
| `/scout` | 200 | index,follow | TradeScout | 225 / 225 | No | **robots Disallow** | No |

Googlebot receives boot/error fallback HTML ("TradeScout encountered a startup issue" / "JavaScript is required"), not SSR content. **Not a noindex issue — a thin/JS-dependent page issue.**

---

### 3. User Profiles (`/u/*`)

| URL | Status | Meta robots | Canonical | Title | H1 | Body B/G | Listings? | Sitemap? |
|---|---|---|---|---|---|---:|---|---|
| `/u/issa-build` | 200 | index,follow | self | ISSA Build \| Luxury Translucent Onyx \| TradeScout | ISSA Build | 264/319 | profile content | yes |
| `/u/jrs-auto-glass` | 200 | index,follow | self | JR's Auto Glass… | JR's Auto Glass | 279/349 | yes | yes |
| `/u/la-plumbing-solutions` | 200 | index,follow | self | LA Plumbing Solutions… | LA Plumbing Solutions | 270/468 | yes | yes |
| `/u/super-admin` | 200 | **index,follow** | — | Super Admin \| TradeScout | — | 239/186 | admin profile | **yes** |
| `/u/nonexistent-slug-test-404` | **404** | **noindex,follow** | self (404 URL) | Public profile unavailable | This public profile is not available | — | n/a | no |

404 handling is correct (HTTP 404 + noindex). **`/u/super-admin` indexed and in sitemap is a live quality leak.**

All 9 sitemap profiles: issa-build, jrs-auto-glass, la-plumbing-solutions, moulding-millwork-supply, ernesto-garcia, super-admin, justin-mullins, pensacola-crypto, jessica-gomez.

---

### 4. Business Directory (`/business/*`)

| URL | Status | Meta robots | Title | Body B/G | Sitemap? |
|---|---|---|---|---:|---|
| `/business/2h-v-construction-services-llc-2` | 200 | **noindex,nofollow** | 2H&V Construction… | 279/175 | yes |
| `/business/360-reflective-renovations-llc` | 200 | **noindex,nofollow** | — | — | yes |
| `/business/a-b-septic-tank-services` | 200 | index,follow | — | — | yes |

**Sample rate: 7/8 noindex,nofollow (87.5%)** while all 146 remain in `sitemap-directory-businesses-0.xml`.

Desc on noindex sample: "You're here early. This listing is being refreshed and will be back soon."

**Strongest live noindex evidence in entire crawl** — but it's **per-page meta noindex**, not header-level, and **contradicts sitemap inclusion**.

---

### 5. Trade Directory (`/trade/*`)

| URL | Status | Meta robots | ItemList | Items | Body G | Sitemap? |
|---|---|---|---|---:|---:|---|
| `/trade` (hub) | 200 | index,follow | n/a | n/a | 1,552 | yes |
| `/trade/electrical/fl/bay` | 200 | index,follow | populated | 1 | 1,036 | yes |
| `/trade/plumbing/fl/bay` | 200 | index,follow | **empty []** | 0 | 978 | yes |
| `/trade/plumbing/fl/holmes` | 200 | index,follow | **empty []** | 0 | — | yes |
| `/trade/plumbing/al/baldwin` | 200 | index,follow | populated | 2 | 1,084 | yes |

All 7 sitemap trade URLs checked: **1 empty** (plumbing/fl/holmes), **6 with 1–3 listings**.

Empty pages still `index,follow` with boilerplate ~978–1,084 chars Googlebot body. **Thin-page hypothesis strong; noindex hypothesis weak.**

---

### 6. County Directory (`/county/*`)

| URL | Status | Meta robots | ItemList | Items | Body G | Sitemap? |
|---|---|---|---|---:|---:|---|
| `/county/al/baldwin` | 200 | index,follow | populated | 2 | 526 | yes |
| `/county/al/coffee` | 200 | index,follow | **empty []** | 0 | ~1,391 | yes |
| `/county/al/dekalb` | 200 | index,follow | **empty []** | 0 | ~1,391 | yes |
| `/county/ms/harrison` | 200 | index,follow | **empty []** | 0 | 395 | yes |

305 counties in sitemap. Empty counties render ~1,391 chars template (similar length populated or not). **Soft-404-style empty directories indexed.**

---

### 7. Best Pages (`/best/*`)

| URL | Status | Meta robots | ItemList | Body G | Sitemap? |
|---|---|---|---|---:|---|
| `/best/electrical/fl/bay` | 200 | index,follow | **empty []** | 419 | yes (7 counties + 7 cities) |

14 best URLs in sitemap; sampled page has zero verified listings despite "Best" framing.

---

### 8. City, Homescout, Exchange, Community

| URL | Status | Meta robots | Body B/G | Notes | Sitemap? |
|---|---|---|---|---:|---|
| `/city/fl/pensacola` | 200 | index,follow | 263/306 | SSR title present | yes (66 cities) |
| `/homescout/listings/` (index) | 200 | index,follow | shell | SPA boot shell | partial (10 listings) |
| `/exchange` | 200 | index,follow | 276/276 | Has unique title/desc | yes |
| `/exchange/smokecategory-*` | 200 | index,follow | 276 | test/smoke listing | yes |
| `/community` | 200 | index,follow | 225/225 | SPA shell | yes |
| `/tradepartners/escambia-fl` | 200 | index,follow | 225/225 | SPA shell | yes |

---

### 9. Auth / Dashboard / Search (blocked routes)

| URL | robots.txt | Status | Meta robots | Body | Notes |
|---|---|---|---|---:|---|
| `/auth` | Disallow | 200 | index,follow | 225 | SPA shell, no noindex |
| `/dashboard` | Disallow | 200 | index,follow | 225 | SPA shell |
| `/search` | (allowed) | 200 | index,follow | 225 | SPA shell |
| `/contractors` | (allowed) | 200 | index,follow | 225 | SPA shell |
| `/county-directory` | (allowed) | 200 | index,follow | 225 | SPA shell (hub not SSR?) |

---

## Cross-Cutting Signals

| Signal | Live evidence |
|---|---|
| **X-Robots-Tag** | **Absent** on all sampled URLs (including 404) |
| **noindex (meta)** | Present on: `/business/*` (majority), `/u/*` 404 fallback. **Absent** on trade/county/best/landing empty pages |
| **googlebot meta** | Not used (no separate googlebot meta tag on any sample) |
| **Canonical issues** | `/` → `/landing`; 404 profiles canonical to self |
| **UA rendering split** | Landing/trade/county/u: Googlebot ~46k/1k chars, browser ~250 chars. App routes: both UAs ~225 chars |
| **HTTP→HTTPS** | `http://www` → 301 → `https://www` |
| **apex** | `https://thetradescout.com/` — check inconclusive in probe; use GSC property variant |

---

## Hypothesis Verdict (live evidence only)

### Noindex hypothesis — **WEAK for directory/landing; STRONG for /business/***
- No site-wide noindex header or meta on trade/county/best/landing routes.
- `/business/*` live noindex,nofollow on ~87.5% of sample while sitemap still lists 146 URLs → **Google may ignore/remove these despite sitemap**.
- robots.txt Disallow on `/scout/`, `/auth/` does **not** produce noindex meta; pages still return 200 + index,follow shell.

### Thin-page / duplicate hypothesis — **STRONG**
- Empty ItemList on indexed trade/county/best pages.
- Landing subpages: identical H1, templated meta, ~46k duplicate SSR body.
- `/` canonicalized to `/landing`.
- SPA shells on core app routes (~225 chars).
- County empty pages ~1,391 chars boilerplate regardless of listings.

---

## Exact Next URL Samples Needed from GSC Exports

Pull these from **Pages** (indexed + not indexed + crawled-not-indexed) and **Sitemaps** reports, dated **2026-07-09 baseline AND most recent**, to compare against live:

### Priority 1 — Validate live findings against GSC cohorts
1. **5–10 `/business/*` URLs** flagged "Excluded by noindex" or "Crawled - not indexed" — confirm overlap with sitemap 146.
2. **5–10 `/business/*` URLs** still indexed — likely the ~12.5% with `index,follow` live (e.g. `a-b-septic-tank-services` pattern).
3. **5–10 empty `/county/{st}/{county}`** from "Soft 404" or "Crawled - not indexed" — match against 305-county sitemap.
4. **5–10 empty `/trade/*` or `/best/*`** — especially states with zero ItemList (e.g. plumbing/fl/holmes pattern).
5. **`/` and `/landing` and 2–3 `/landing/*` subpages** from "Duplicate without user-selected canonical" or "Alternate page with proper canonical tag".

### Priority 2 — App-route leakage
6. **`/scout/*`, `/auth`, `/dashboard`, `/search`** if appearing in GSC as indexed or crawled.
7. **`/direct-connect`** indexed status vs thin shell.

### Priority 3 — Profile quality
8. **`/u/super-admin`** and any admin/test profiles in indexed set.
9. **3–5 `/u/*` profiles** that dropped from index since July 9 vs the 9 live sitemap profiles.

### Priority 4 — Sitemap drift
10. Full **Sitemap report URL list** for `sitemap-directory-businesses-0.xml` — compare submitted vs indexed counts.
11. Any **`/landing/*` subpages** in GSC not in sitemap-core (discovered via links?).

### Priority 5 — Rendering
12. **5 URLs with largest "Crawled as Googlebot" vs "User-declared canonical" mismatch** from URL Inspection export (if available) — prioritize landing and county empty pages.

---

## Artifacts Generated
- `phase-b-lite-crawl.ps1` — dual-UA crawl script
- `phase-b-lite-crawl-results.json` — raw crawl JSON (22 URLs)
- `phase-b-lite-supplement.ps1` — supplemental probes
- `phase-b-lite-business-trade.ps1` — business/trade ItemList analysis
- This report: `phase-b-lite-live-crawl-report.md`

---

## Objector Checkpoint
Evidence package complete for Phase B-lite gate. Key blockers for implementation remain:
1. Resolve `/business/*` sitemap ↔ noindex conflict before expecting index recovery.
2. Decide canonical strategy for `/` vs `/landing` vs `/landing/*` duplicates.
3. GSC URL samples above required to map July 9 cohort → live behavior delta.
