# Phase A+B Alignment Packet — Search Index Recovery

**Locked:** 2026-07-25  
**Aligner role:** Selective Intelligence Aligner  
**Intent lock:** P0 sublane inside TradeScout core; concurrent with other lanes; smallest safe correction; no blanket noindex removal; no artificial thin-page text; no Validate Fix before authorized prod verify; isolated SEO branch (not `fix/tradescout-landing-logo` @ 38464b4f); July 9 GSC counts ≠ July 25 live state.

**Evidence inputs:**
| Source | ID | Scope |
|---|---|---|
| Objector | 396d8d7f | Hard-stop gate (blocked) |
| Phase A code audit | f977a59e | Dual SEO stack (SSR + SEOHelmet) |
| Phase B live crawl | a225fe34 | `artifacts/evidence/phase-b-lite/phase-b-lite-live.latest.md` |

---

## 1. Verdict

**Ready for Phase C contract only** — implementation (Phase E) remains blocked.

**Proof:**
- Phase A + Phase B supply enough live + code evidence to **draft** a route-family indexability matrix and sitemap eligibility contract (Phase C).
- Objector hard stops still bind: no GSC URL-export correlation, no locked eligibility contract, no authorized prod-verify gate, no blanket fixes.
- July 9 GSC counts are explicitly out of scope as current-state proof; live crawl (2026-07-25) is the operative HTTP baseline.
- Strongest confirmed defect — **146 `/business/*` URLs in sitemap while sampled pages return `noindex,nofollow`** — requires contract-defined remediation, not ad-hoc index flag changes.

---

## 2. Ranked root causes

| Rank | Root cause | Disposition | Code evidence | Live evidence |
|---|---|---|---|---|
| 1 | **Sitemap advertises URLs that declare `noindex`** — `/business/*` stale listings indexed in sitemap but SSR applies `noindex,nofollow` | **Confirmed** | `server/publicBusinessHtml.ts` (`isStale → applyNoIndex`); `server/routes/profiles.ts` (`canonicalBusinessPresenceSitemapLoc`, `listActiveDirectoryBusinessesForSitemap`) | Phase B: 146 `/business/{slug}` in sitemap; samples `2h-v-construction…`, `360-reflective…`, `3pa-coastal…` → 200 + `noindex,nofollow` + in sitemap=true |
| 2 | **SSR vs CSR robots split on trade/geo directory** — Googlebot SSR says index; CSR noindexes empty/error states | **Confirmed** | `server/publicTradeHtml.ts` (always `index,follow`); `client/src/pages/trade/TradeCountyPage.tsx` (`shouldNoIndex = !isLoading && (isError \|\| items.length === 0)`) | Phase B: `/trade/electrical`, `/trade/electrical/fl/bay`, `/county/al/baldwin` → Googlebot `index,follow`, ~28–132 words, `substantiveListings=false`, `trade_shell_no_listings` |
| 3 | **Thin directory shells submitted as indexable** — combinatorial sitemap emits trade×geo pages with no listing signal | **Confirmed** | Phase A: sitemap combinatorial trade×geo from snapshot; landing variants excluded from core sitemap | Phase B: 305 `/county`, 66 `/city`, 14 `/trade/*` deep, 14 `/best/*`; all sampled shells thin, no listings |
| 4 | **Near-duplicate marketing landings** — `/`, `/landing`, `/landing/*` share H1 and ~99% 5-gram Jaccard on Googlebot SSR | **Confirmed** | Phase A: landing SSR always index; CSR noindexes `/lp` and query variants; `server/publicLandingHtml.ts` shared “Connection Without Compromise” body | Phase B: Jaccard 0.99–1.0; `/` canonical → `/landing`; `/landing/*` not in sitemap but indexable |
| 5 | **Legacy `/business/*` vs canonical `/u/*` presence split** — sitemap logic prefers `/u/` when public profile linked; live sitemap still lists `/business/` noindex URLs | **Provisional** | `profiles.ts` `canonicalBusinessPresenceSitemapLoc` (public linked → `/u/`); stale/private → `/business/` | Phase B: published `/u/*` index,follow (9 in sitemap); sampled `/business/*` noindex but still sitemap-listed — GSC “alternate canonical” export needed to quantify |
| 6 | **Corrupted city slugs in sitemap** — malformed `-{city}` paths look like data/slug pipeline defects | **Provisional** | Phase A: sitemap-directory-cities from snapshot | Phase B: `/city/al/-agnolia-prings`, `-airhope`, `-araland` → 200 index, ~28 words, in sitemap |
| 7 | **Dead URL in sitemap (homescout listing 404)** | **Confirmed** | Sitemap generation for homescout listings | Phase B: `homescout/listings/999d5c07…` → 404 + `X-Robots-Tag: noindex,nofollow`, in sitemap=true |
| 8 | **July 9 GSC exclusion counts explain current live state** | **Rejected** | Intent lock + Objector | Phase B disclaimer; no GSC export ingested |

**Secondary (not top-5, contract-relevant):**
- Auth/dashboard shells return 200 + `index,follow` but robots.txt Disallow (Phase B) — crawl policy vs meta mismatch; lower priority than sitemap/noindex conflicts.
- Trade empty-state SSR/CSR split (Phase A: trade empty SSR index vs CSR noindex) — aligned with #2.

---

## 3. Route-family indexability matrix (Phase C draft)

| Route family | Intended index? | Intended sitemap? | Robots (intended) | Eligibility gate (draft) | Notes |
|---|---|---|---|---|---|
| `/` | Yes (or redirect canonical) | Yes (`sitemap-core`) | `index,follow` | Single homepage canonical target | Live: `/` canonical → `/landing`; resolve duplicate cluster in Phase C |
| `/landing` | Yes | Yes | `index,follow` | Primary marketing canonical | |
| `/landing/{variant}` | Case-by-case | No (excluded from core sitemap per Phase A) | `index,follow` only if unique substantive content; else `noindex` or canonical to parent | Unique H1/body threshold OR canonical merge | Live: near-duplicate of `/landing` |
| `/lp/*`, `?query` landings | No | No | `noindex,follow` | Alias/query variant | Phase A CSR contract |
| `/u/{slug}` published | Yes | Yes (`sitemap-u-profiles`) | `index,follow` | `status=published` + public visibility | Live: correct |
| `/u/{slug}` missing | No | No | `noindex,follow` + 404 | Not in any sitemap | Live: correct |
| `/business/{slug}` active directory | Prefer redirect/canonical to `/u/` if public profile | Only if no public `/u/` AND crawlable | `index,follow` | `isPublicAndCrawlableBusiness` + not stale | |
| `/business/{slug}` stale/inactive | No | **No** | `noindex,nofollow` | `!pub.ok` / stale | **Live breach: in sitemap + noindex** |
| `/business/{slug}` missing | No | No | 404 | Not in sitemap | Live: 404, no robots meta |
| `/trade`, `/trade/{trade}`, `/trade/{trade}/{st}`, `/trade/.../{county}` | Yes **only if** substantive listings OR explicit indexable shell policy | Yes only for eligible URLs | SSR and CSR **must agree**; empty → `noindex` OR omit from sitemap | Listing count > 0 OR approved empty-state policy | Live: SSR index + empty shells |
| `/county/{st}/{county}`, `/city/{st}/{city}` | Same as trade | Same | Same | Valid slug + listing/substance gate | Corrupted slugs → exclude |
| `/best/{...}` | Same as trade | Same | Same | Same | Live: thin, no listings |
| `/exchange/*`, `/homescout/listings/*` | Per product rules | Only live 200 indexable | Match HTTP status | 404/deleted → exclude from sitemap | Live: 404 in sitemap |
| `/auth/*`, `/dashboard/*`, `/scout/*` | No | No | `noindex,follow` (meta) + robots Disallow | Never in sitemap | Live: meta still index on some |
| `/community`, `/community-feed` | Product decision | If indexable, must not be thin SPA shell | TBD in Phase C | Substance gate | Live: thin SPA shell |

**Phase C deliverable:** Lock the eligibility gate column into a testable sitemap contract (unit tests already partially exist: `sitemap-contracts.test.ts`, `landing-seo-contracts.test.ts`, `trade-county-page-seo.contract.test.ts`).

---

## 4. Objector blocking objections — disposition

| Objection | Disposition | Evidence |
|---|---|---|
| July 9 ≠ July 25 live state | **Sustain** | Intent lock; Phase B timestamp 2026-07-25; no fresh GSC export |
| No root cause from GSC counts alone | **Sustain** (partially **mitigated**) | Counts alone insufficient; Phase B live crawl now supports hypotheses #1–#4 |
| No blanket noindex removal | **Sustain** | Stale `/business/*` noindex is intentional (`applyNoIndex`); fix is sitemap/eligibility alignment |
| Logo tip branch not SEO vehicle | **Sustain** | Out of scope; isolated branch required |
| Sitemap eligibility contract required before fix | **Sustain** | #1 and #7 are contract violations, not “remove noindex” |
| Thin landings / empty trade shells | **Sustain** | Phase B: thin shells + near-duplicate landings |
| Meta vs X-Robots conflict | **Mitigate** | Live: mostly meta-driven; homescout 404 uses X-Robots — unify in Phase C spec |
| `/u` vs `/business` duplicates | **Sustain** (provisional quantification) | Code prefers `/u/` in sitemap; live shows `/business/` noindex still listed — needs GSC export |
| No Validate Fix before authorized prod verify | **Sustain** | No Validate Fix in Phase B; gate Phase E on explicit authorize |
| No artificial thin-page text | **Sustain** | Remediation = eligibility + substance, not filler copy |
| No tenth portfolio lane | **Sustain** | P0 sublane only; concurrent, non-blocking to other lanes |

---

## 5. Exact next actions (ordered)

### Can proceed now (no GSC exports)

1. **Phase C — Lock sitemap eligibility contract** using §3 matrix; add/extend contract tests (`sitemap-contracts`, trade/county SEO contracts).
2. **Phase C — Define SSR/CSR robots parity rule** for trade/county/city/best (single source of truth: empty → noindex **and** sitemap omit).
3. **Phase C — Define stale `/business/*` rule:** `noindex,nofollow` ⇒ never in `sitemap-directory-businesses-*`; public linked profile ⇒ sitemap loc is `/u/{slug}` only.
4. **Phase C — Landing duplicate policy:** canonical cluster for `/` + `/landing` + phrase-substitution variants (no new indexable clones).
5. **Phase C — Sitemap hygiene rules:** exclude 404 homescout listings; exclude corrupted city slugs pending data fix ticket.
6. **Recommend isolated branch** (§6) — do not create until Phase C draft reviewed.

### Blocked until Thomas uploads GSC exports

7. **Ingest GSC exports:** Excluded by noindex (by template), Crawled – currently not indexed (`/trade/*`), Duplicate without user-selected canonical (landing vs home), Soft 404, Alternate canonical (`/business/*` vs `/u/*`), Blocked by robots.txt, Discovered not indexed (`/u/*`), 5xx if present, sitemap coverage report.
8. **Prioritize fix scope** — rank route families by GSC URL counts cross-walked to Phase B samples (not July 9 totals).
9. **Phase D — Staging/preprod verify** against locked contract (still no Validate Fix).
10. **Phase E — Smallest safe prod patch** on isolated branch after authorize + post-deploy live re-crawl.

---

## 6. Isolated branch plan (recommend only)

| Field | Recommendation |
|---|---|
| **Branch name** | `fix/search-index-sitemap-contract` |
| **Base** | Current `main` / production default branch (verify at branch creation — **not** `fix/tradescout-landing-logo` @ `38464b4f`) |
| **Scope** | Sitemap eligibility + SSR/CSR robots parity + stale business omission + homescout/city slug hygiene |
| **Explicitly out** | Logo/landing creative, blanket noindex removal, artificial copy, GSC Validate Fix |
| **Create when** | Phase C contract signed off — not before |

---

## 7. What NOT to do

- Do **not** treat July 9 GSC counts as July 25 live truth.
- Do **not** remove `noindex` globally or on stale `/business/*` to “fix indexing.”
- Do **not** add boilerplate/placeholder text to thin trade/county/city shells.
- Do **not** click **Validate Fix** in Search Console before authorized prod verify.
- Do **not** ship via `fix/tradescout-landing-logo` or conflate with logo/landing tip work.
- Do **not** spin a tenth portfolio lane or pause other lanes for this sublane.
- Do **not** implement Phase E code changes until Phase C contract is locked **and** GSC exports inform priority.
- Do **not** merge/deploy from this alignment packet — documentation only.

---

## Alignment status

| Field | Value |
|---|---|
| `alignment_status` | `provisionally_aligned` |
| `approved_to_resume` | `true` → Phase C contract drafting |
| `approved_to_implement` | `false` → Phase E blocked |
| `next_skill` | Phase C planner → `si-worker` after contract lock |
| `open_findings` | GSC exports missing; `/u` vs `/business` volume unquantified; corrupted city slug root cause unassigned |

---

*Generated by Selective Intelligence Aligner. No code changes. No deploy.*
