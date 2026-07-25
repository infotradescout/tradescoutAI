# Phase C — Indexability & Sitemap Eligibility Contract

**Locked:** 2026-07-25  
**Branch:** `fix/search-index-sitemap-contract`  
**Authority:** Contract + failing-closed tests only. Phase E production fixes blocked until human approval.  
**Inputs:** [phase-ab-alignment.md](./phase-ab-alignment.md), [Phase B crawl-1](../phase-b-lite/phase-b-lite-live.latest.md), [Phase B crawl-2 report](../phase-b-lite-live-crawl-report.md) (run `a5d47ad6`)

---

## Purpose

Define the **intended** indexability and sitemap eligibility rules for TradeScout public routes. Automated contract tests encode these rules and **fail on current production behavior** where live crawl (2026-07-25) diverges. Phase E implements the smallest safe patches to make failing tests pass — not blanket noindex removal or thin-page filler copy.

---

## Global sitemap URL invariants

Every URL emitted in any TradeScout platform sitemap child MUST satisfy **all** of:

| Invariant | Rule |
|---|---|
| HTTP status | `200` at canonical URL (no redirect chain terminus other than self) |
| Robots | `index,follow` via meta and/or X-Robots-Tag (no `noindex`) |
| Canonical | Self-referencing canonical matching the sitemap `<loc>` |
| Content | Not a soft-404 shell (substantive unique coverage **or** qualifying listings) |
| Exclusion | Not a redirect target, 4xx, 5xx, or deliberate noindex page |

**Violation examples (live 2026-07-25):** stale `/business/*` (noindex + in sitemap), homescout listing 404 (in sitemap), empty trade/county/city shells (index + in sitemap).

---

## Route-family matrix

| # | Route family | Index? | Sitemap? | Robots (intended) | Eligibility gate |
|---|---|---|---|---|---|
| 1 | `/u/{slug}` published | Yes | Yes (`sitemap-u-profiles`) | `index,follow` | `status=published`, public visibility, self-canonical |
| 1b | `/u/{slug}` admin/test/staff (e.g. `super-admin`) | **No** | **No** | `noindex,nofollow` | Exclude admin_flag / internal slugs from sitemap emitters — **crawl-2 breach: `/u/super-admin` 200 index,follow + in sitemap** |
| 2 | `/u/{slug}` missing | No | No | `noindex,follow` + **404** | Never sitemap-listed |
| 3 | `/auth/*`, `/dashboard/*`, `/scout/*`, `/account/*` | No | No | **Deliberate `noindex,follow`** (meta and/or X-Robots-Tag) + robots.txt Disallow | Never in sitemap; SSR boot HTML must not ship `index,follow` — see robots/meta conflict |
| 4 | `/business/{slug}` stale/inactive | No | **No** | `noindex,nofollow` | `!isPublicAndCrawlableBusiness()` — **current breach: sitemap-listed** |
| 4b | `/business/{slug}` active, public `/u/` linked | Redirect/canonical to `/u/` | `/u/` only | `index,follow` on canonical | No competing indexable pair |
| 4c | `/business/{slug}` active, no public `/u/` | Yes (legacy) | Yes only if crawlable | `index,follow` | Must pass `isPublicAndCrawlableBusiness()` |
| 5 | `/trade/*`, `/county/*`, `/city/*`, `/best/*` | Only with substance | Only eligible URLs | SSR **and** CSR must agree | Listing count > 0 **or** approved indexable shell policy; else `noindex` + omit from sitemap |
| 6 | `/`, `/landing` | Yes | Yes (`sitemap-core`) | `index,follow` | Single canonical cluster; resolve `/` → `/landing` duplicate |
| 6b | `/landing/{variant}` supported | Case-by-case | No (excluded from core sitemap) | `index,follow` only if unique substantive content | Unique H1/body threshold **or** canonical merge to `/landing` |
| 6c | `/landing/{variant}` unsupported / near-dupe | No | No | `noindex,follow` or canonical to parent | Phrase-substitution clones not independently indexable |
| 6d | `/lp/*`, `?query` landings | No | No | `noindex,follow` | Alias/query variant — CSR already enforces; SSR must match |
| 7 | Redirects, 4xx, 5xx | No | No | Terminal response robots | Excluded from all sitemaps |
| 8 | `/homescout/listings/{id}` deleted | No | No | 404 + `noindex` | Active listing verification at sitemap emit time |
| 9 | `/city/{st}/{city}` corrupted slug | No | No | 404 or `noindex` | Slugs failing validation (e.g. leading `-`) excluded |

---

## SSR / CSR robots parity rule

For trade, county, city, best, and landing route families:

- **Single source of truth:** If CSR would set `noIndex={true}`, SSR MUST emit equivalent `noindex` (meta or X-Robots-Tag).
- **Empty directory:** CSR `shouldNoIndex = !isLoading && (isError || items.length === 0)` on trade pages → SSR must noindex matching empty/error states.
- **Landing aliases:** CSR `shouldIndexLandingPage = !isAliasLandingPath && !hasQueryParams` → SSR must noindex `/lp/*` and query variants.

**Current breach:** `publicTradeHtml.ts` and `publicLandingHtml.ts` always emit `index,follow` on Googlebot SSR while CSR noindexes empty/alias states.

---

## Stale `/business/*` rule (highest-priority sitemap breach)

```
IF page renders noindex,nofollow (isStale / !pub.ok)
THEN URL MUST NOT appear in sitemap-directory-businesses-*
```

Sitemap generation MUST filter through `isPublicAndCrawlableBusiness()` (or equivalent) **before** emitting `/business/{slug}`. Public linked profiles MUST emit `/u/{slug}` only via `canonicalBusinessPresenceSitemapLoc`.

**Live evidence (crawl-1 + crawl-2 `a5d47ad6`):** 146 `/business/{slug}` in expanded sitemap; **~87.5% of sampled pages** return 200 + `noindex,nofollow` (stale majority). Minority remain indexable — e.g. `a-b-septic-tank-services` (`index,follow`). Stale samples: `2h-v-construction-services-llc-2`, `360-reflective-renovations-llc`, `3pa-coastal-renovation`.

---

## robots.txt vs meta conflict (crawl-2 `a5d47ad6`)

`robots.txt` Disallow blocks crawl but does **not** change HTTP status or meta robots. Live production returns **200 + thin SPA shell + `index,follow` meta** on paths that robots.txt Disallows:

| Path | robots.txt | Live meta (crawl-2) | Intended |
|---|---|---|---|
| `/scout` | Disallow `/scout/` | `index,follow` | `noindex,follow` + never in sitemap |
| `/auth` | Disallow `/auth/` | `index,follow` | `noindex,follow` + never in sitemap |
| `/dashboard` | Disallow `/dashboard/` | `index,follow` | `noindex,follow` + never in sitemap |

**Root cause:** `client/index.html` defaults `<meta name="robots" content="index, follow" />`; CSR `SEOHelmet` only overrides after hydration. App shells need **SSR-deliberate noindex** (meta or `X-Robots-Tag`) before JS runs.

**Phase E:** Add SSR noindex for private app-shell paths; keep robots.txt Disallow as defense-in-depth.

---

## Admin / test profile sitemap leak (crawl-2 `a5d47ad6`)

`/u/super-admin` returned **200 + `index,follow`** and appeared in `sitemap-u-profiles.xml` (9 profiles listed). Admin/staff/test profiles MUST be excluded from:

1. `listPublishedProfileSitemapTargets()` / `sitemap-u-profiles.xml` emitters
2. Indexability (SSR meta or header `noindex,nofollow`)

**Fixture:** `super-admin` in `phase-c-indexability-contract.fixtures.ts`.

---

## X-Robots-Tag live observation (crawl-2 `a5d47ad6`)

Crawl-2 sampled public URLs (homepage, landing, trade, county, app shells, profiles) showed **no `X-Robots-Tag` header**. Indexing signals are **meta-driven** on live production today.

| Signal | Live (crawl-2) | Contract intent |
|---|---|---|
| Public indexable pages | Meta `index,follow` only | Meta and/or X-Robots-Tag acceptable |
| Terminal 404/500 / deliberate noindex | Meta and/or header | Prefer both for defense-in-depth |
| Homescout 404 (crawl-1) | Had `X-Robots-Tag: noindex,nofollow` | Keep terminal/header tests; unify in Phase E |

Contract tests for `sendPublicPageNotFound` / `sendPublicPageRenderFailure` **X-Robots-Tag** remain valid Phase E targets even though crawl-2 did not observe headers on most public URLs.

---

## Landing duplicate policy

- `/` canonical → `/landing` is acceptable; do not create additional indexable clones with identical H1/body.
- Near-duplicate phrase-substitution variants (`/landing/homeowner-hvac`, etc.) MUST either canonicalize to `/landing` or `noindex` until unique content exists.
- Arbitrary `/landing/{slug}` not in supported variant registry MUST NOT be indexable 200.

---

## Test coverage map

| Contract rule | Test file | Expected on current code |
|---|---|---|
| Stale business sitemap exclusion | `sitemap-contracts.test.ts` | **FAIL** |
| Homescout dead listing exclusion | `sitemap-contracts.test.ts` | **FAIL** |
| Corrupted city slug exclusion | `sitemap-contracts.test.ts` | **FAIL** |
| Empty directory sitemap gate | `sitemap-contracts.test.ts` | **FAIL** |
| Sitemap URL invariant helper | `sitemap-contracts.test.ts` | **FAIL** |
| Landing SSR/CSR parity | `landing-seo-contracts.test.ts` | **FAIL** |
| Unsupported landing slug | `landing-seo-contracts.test.ts` | **FAIL** |
| Trade SSR/CSR parity | `trade-seo-resilience.contract.test.ts` | **FAIL** |
| Empty shell sitemap gate | `trade-seo-resilience.contract.test.ts` | **FAIL** |
| Terminal 404/500 sitemap hygiene | `public-page-response.test.ts` | **FAIL** (homescout linkage) |
| Admin/test profile sitemap exclusion | `sitemap-contracts.test.ts` | **FAIL** |
| Private app shell SSR noindex (robots/meta conflict) | `sitemap-contracts.test.ts` | **FAIL** |
| Crawl-2 fixtures documented | `sitemap-contracts.test.ts`, `public-page-response.test.ts` | **PASS** (doc/fixture lock) |
| Published `/u/` baseline | `sitemap-contracts.test.ts` | **PASS** |
| CSR landing alias noindex | `landing-seo-contracts.test.ts` | **PASS** |
| CSR trade empty noindex | `trade-seo-resilience.contract.test.ts` | **PASS** |
| Terminal 404/500 headers | `public-page-response.test.ts` | **PASS** |

Fixtures: `server/tests/fixtures/phase-c-indexability-contract.fixtures.ts`

---

## Phase E scope (blocked until approval)

1. Align sitemap emitters with `isPublicAndCrawlableBusiness()` for `/business/*`.
2. Add SSR robots parity for trade/county/city/best empty states.
3. Add SSR robots parity for landing `/lp/*`, query, and unsupported variants.
4. Exclude corrupted city slugs and dead homescout listings from sitemap generation.
5. Gate trade/county/city/best sitemap rows on qualifying listings or approved shell policy.
6. Exclude admin/test/staff profiles (e.g. `super-admin`) from sitemap + indexability.
7. SSR-deliberate `noindex` on `/scout`, `/auth`, `/dashboard` app shells (robots/meta conflict).

**Explicitly out of Phase E unless contract amended:** blanket noindex removal, artificial thin-page text, GSC Validate Fix, merge to `fix/tradescout-landing-logo`.

---

## Human approval gate

Before Phase E implementation:

- [ ] Thomas reviews this contract doc and failing test inventory.
- [ ] GSC URL-export samples uploaded (optional for contract lock; required for Phase E priority ranking).
- [ ] Explicit **APPROVE Phase E** on branch `fix/search-index-sitemap-contract`.

---

*Phase C deliverable. No production deploy. No Search Console changes.*
