# Phase A — Git correlation (search index recovery)

**Evidence artifact** · Agent run `5e13c800` · Generated 2026-07-25 (local audit)  
**Purpose:** Map **time-aligned git history** to GSC impression windows for hypothesis generation only.

---

## Scope and limits

| Field | Value |
|--------|--------|
| **Repository** | `TradeScoutPro` (monorepo app root) |
| **Remote** | `https://github.com/infotradescout/tradescoutAI.git` (`origin`) |
| **Audited worktree tip** | Branch `fix/tradescout-landing-logo` @ `38464b4f` (2026-07-25) — **logo / ISSA hero evidence lane; unrelated to index recovery** |
| **`main` tip (reference)** | `036efa6f` (2026-07-23) — merge PR #195 profile editor API JSON |
| **Interpretation** | **Correlation only, NOT causation.** Closest commit ≠ root cause. |
| **Production deploy SHA** | **NOT pinned in this artifact.** `render.yaml` sets `branch: main`, `autoDeployTrigger: commit` — prod tracks `main` commits unless manual rollback. |
| **Git tags** | **None** observed (`git tag -l` empty). Release identity is branch/SHA only. |

**Worktrees (context):** Primary checkout on `fix/tradescout-landing-logo`. Additional linked worktrees include `TradeScoutPro-release-control` (`p0/simple-autodeploy` @ `48ca280d`) and `TradeScoutPro-onyx-rail2` (`main` @ `036efa6f`). Dedicated recovery lane: `TradeScoutPro-search-index-recovery` @ `f2b49524` (`fix/search-index-sitemap-contract`).

---

## Window 1 — 2026-04-25 .. 2026-04-27 (sitemap / discovery bootstrap)

| SHA | Date (author TZ) | Subject | Notable paths |
|-----|------------------|---------|----------------|
| `897a4acf` | 2026-04-25 | harden seo discovery and authority flows | `client/public/robots.txt`, `client/public/sitemap-index.xml`, `client/public/sitemap.xml`, `scripts/generate-sitemap.mjs`, `scripts/guard-sitemap-integrity.mjs`, `server/routes.ts`, `server/tests/sitemap-contracts.test.ts`, `server/utils/authorityPolicy.ts` |
| `351abe16` | 2026-04-26 | `hg` *(short message; touch is sitemap index)* | `client/public/sitemap-index.xml` |

**Correlation note:** Early public sitemap surface and discovery hardening land here. Does not prove GSC moved — only that index XML and guards existed pre-cliff.

---

## Window 2 — 2026-05-11 .. 2026-05-18 (canonical business SEO)

| SHA | Date | Subject | Notable paths |
|-----|------|---------|----------------|
| `8f7b915b` | 2026-05-17 | Prefer canonical business routes | `client/src/AppRoutes.tsx`, `client/src/lib/routes.ts`, `server/tests/business-genericization.contract.test.ts` |
| `1ffde16c` | 2026-05-18 | Prefer canonical business profile links | `server/routes.ts`, `client/src/pages/find-contractors.tsx`, `server/tests/public-profile-compat.contract.test.ts` |
| `6e066833` | 2026-05-18 | Support canonical business URLs in SEO helpers | `client/src/components/SEOHelmet.tsx`, `client/src/components/SEOLocalBusiness.tsx` |

**Correlation note:** URL/canonical consistency for business profiles — relevant to duplicate URL and consolidation signals, not deploy timing proof.

---

## Window 3 — 2026-06-08 .. 2026-06-12 (public landing HTML + county SEO contracts)

| SHA | Date | Subject | Notable paths |
|-----|------|---------|----------------|
| `fa7806a1` | 2026-06-09 | Restore TradeScout logo on landing pages | Landing page client surface (logo restore) |
| `0c5d0358` | 2026-06-11 | Fix public entry server CTA HTML | `server/publicLandingHtml.ts`, `server/tests/landing-seo-contracts.test.ts`, `server/index.ts`, `server/index.prod.ts` |
| `cc164a42` | 2026-06-11 | test: lock direct connect primary product surface | `server/publicLandingHtml.ts`, `server/tests/landing-seo-contracts.test.ts`, entry smoke/contract tests |
| `6e575237` | 2026-06-11 | test: lock trade county hub seo contracts | `server/tests/trade-county-hubs-seo.contract.test.ts` |
| `f5e41afa` | 2026-06-11 | test: lock trade county page seo contract | `server/tests/trade-county-page-seo.contract.test.ts` |

**Correlation note:** Server-rendered landing SEO contracts and trade-county hub/page SEO tests tightened in a single day cluster (06-11). Still requires matching **live deploy SHA** to tie to GSC.

---

## Window 4 — 2026-06-24 .. 2026-06-30 (no in-window SEO commits)

| SHA | Date | Subject | Domain |
|-----|------|---------|--------|
| `b6997e09` | 2026-06-30 | fix: add trust ledger events migration | Trust ledger / DB |
| `244a11dd` | 2026-06-30 | Fix trust ledger CI bootstrap baseline | Trust ledger / CI |
| `80856363` | 2026-07-01 *(merge)* | Merge PR #42 trust ledger schema/bootstrap | Trust ledger |

**SEO grep/path filter** (`seo`, sitemap, `publicLanding*`, `publicPage*`) in **2026-06-24 .. 2026-06-30:** **no matches.**

**GSC alignment:** Reported **impression cliff ~2026-06-25** has **no SEO-tagged commit** in this git window. Trust-ledger work dominates late June; treat as **non-index** unless URL-level GSC shows unrelated paths moving.

---

## Post-window — index-critical restore (after GSC chart end ~2026-07-09)

| SHA | Date | Subject | Index-critical paths (non-exhaustive) |
|-----|------|---------|----------------------------------------|
| `d3637238` | 2026-07-22 | Restore public discovery and source truth | **New** `server/utils/publicPageResponse.ts` (`X-Robots-Tag: noindex, nofollow` on 404/500 public renders); `server/publicProfileHtml.ts`, `server/repositories/sitemapRepository.ts`, `server/sitemapUrlSet.ts`, `scripts/generate-sitemap.mjs`, `scripts/guard-sitemap-integrity.mjs`, `client/public/sitemap-index.xml`, `server/tests/sitemap-contracts.test.ts`, profile/discovery client routes |

**Timing:** Material for **recovery** and **forward** index behavior; **outside** the primary GSC decline window captured in phase charts ending ~07-09. Do **not** back-date causality from this commit alone.

---

## Agent 5e13c800 synthesis (git-only)

1. **Index surface evolved in layers:** static sitemaps (Apr) → canonical business SEO (May) → landing/county contract locks (Jun 11) → large public-discovery restore (Jul 22).
2. **Mid-June cliff lacks a same-window SEO commit** in git; ledger/migration work is the only correlated activity before month-end.
3. **Deploy linkage is weak** without Render deploy history or runtime SHA: auto-deploy on `main` means chart dates lag merge dates by unknown minutes–hours.
4. **Audited tip (`38464b4f`) is the wrong lane** for index forensics — use `main` / recovery branch SHAs and prod verification instead.

---

## Required follow-ups (not satisfied by git log alone)

- Export **GSC URL / page** performance for cliff dates; segment sitemap vs profile vs landing URLs.
- Record **Render deploy commit SHA** per day around 2026-06-20 .. 2026-07-10 and compare to table above.
- Live checks: `robots.txt`, sitemap fetch, sample profile `X-Robots-Tag`, canonical tags at cliff URLs.

---

## Footer — do not overfit git

**Do not treat the closest commit as cause.** Temporal proximity in `git log` is necessary for hypotheses but insufficient for attribution. Confirm with **GSC URL exports**, **Search Console coverage/indexing reports**, and **live deploy SHA verification** before changing index policy or rolling back SEO-related commits.

