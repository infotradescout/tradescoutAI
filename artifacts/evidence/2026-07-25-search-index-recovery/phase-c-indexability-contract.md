# Phase C — Indexability & Sitemap Eligibility Contract

**Locked:** 2026-07-25  
**Branch:** `fix/search-index-sitemap-contract`  
**Authority:** Contract + failing-closed tests only. Phase E production fixes blocked until human approval.  
**Inputs:** [phase-ab-alignment.md](./phase-ab-alignment.md), [phase-b-lite live crawl](../phase-b-lite/phase-b-lite-live.latest.md)

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
| 2 | `/u/{slug}` missing | No | No | `noindex,follow` + **404** | Never sitemap-listed |
| 3 | `/auth/*`, `/dashboard/*`, `/scout/*`, `/account/*` | No | No | `noindex,follow` + robots.txt Disallow | No private data in crawlable HTML |
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

**Live evidence:** 146 `/business/{slug}` in expanded sitemap; samples `2h-v-construction-services-llc-2`, `360-reflective-renovations-llc`, `3pa-coastal-renovation` return 200 + `noindex,nofollow`.

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

**Explicitly out of Phase E unless contract amended:** blanket noindex removal, artificial thin-page text, GSC Validate Fix, merge to `fix/tradescout-landing-logo`.

---

## Human approval gate

Before Phase E implementation:

- [ ] Thomas reviews this contract doc and failing test inventory.
- [ ] GSC URL-export samples uploaded (optional for contract lock; required for Phase E priority ranking).
- [ ] Explicit **APPROVE Phase E** on branch `fix/search-index-sitemap-contract`.

---

*Phase C deliverable. No production deploy. No Search Console changes.*
