# Phase E — Implementation Proof

**Verified at:** 2026-07-25T23:27:42Z
**Worktree:** `TradeScoutPro-search-index-recovery`
**Branch:** `fix/search-index-sitemap-contract`
**Base:** `eedf5d757c8c994ae8f55f47492411333e72e32f` (`origin/main`)
**Implementation head:** `bd748a0d3062fc59dad4966049ad59d1490c0d39`
**Authority:** the locked [Phase C indexability contract](./phase-c-indexability-contract.md), plus the portfolio stabilization direction received on 2026-07-25.

## Decision

The SEO recovery lane is ready to ship as a reviewable draft PR. It is not approved for merge or production deployment yet.

The implementation has focused local proof and a production build. GitHub-hosted proof cannot currently start because the repository owner account is locked for a billing issue; on 2026-07-25 the owner explicitly authorized this stabilization cycle to proceed without Actions. Production sitemap cardinality, live response headers, Search Console recovery, and a deployed build marker remain explicitly unproved.

## Git reconciliation

| Check | Result |
|---|---|
| Branch ancestry | Clean descendant of current `origin/main`; merge-base is `eedf5d75` |
| Recovery history | `f2b49524` contract → `ade87d02` crawl evidence → `47ddd13c` implementation → `bd748a0d` hardening |
| PR #211 contamination | None; PR #211 is isolated on `fix/issa-lux-body-only` |
| Root OneDrive worktree | Untouched; its unrelated untracked files and stashes were preserved |
| Merge | Not performed |
| Deploy | Not performed |
| GSC Validate Fix | Not performed |

## Defects closed in the final hardening pass

1. Removed a redundant SQL admin-role condition whose nullable-role behavior could omit legitimate public profiles.
2. Applied the canonical profile indexability policy to direct profile SSR, so admin/test profiles receive `noindex,nofollow` even when visited directly.
3. Aligned private-shell robots metadata and `X-Robots-Tag` behavior.
4. Replaced four renderer-local directory indexability implementations with one shared helper.
5. Fixed the city slug expression at its source by lowercasing before replacing non-alphanumeric characters. This prevents corrupt slugs such as `-agnolia-prings` instead of merely filtering them after generation.
6. Restricted trade navigation and sitemap count queries to precomputed rows with `business_count > 0`; removed the static trade fallback.
7. Made trade overview/state renderers query qualifying precomputed listing counts and fail closed to `noindex` when the count cannot be proved.
8. Kept stale business aliases, inactive HomeScout listings, empty geo shells, malformed city slugs, and non-indexable profiles out of sitemap output.

No contact flow, trust/CVS exposure rule, payment behavior, or county data-write path was changed.

## Verification

| Gate | Result |
|---|---|
| Focused SEO/SSR contracts | **75/75 passed** across 8 files |
| Sitemap integrity guard | **Passed**; 15 sitemap-index targets validated |
| Production build | **Passed**; client and server bundles built |
| Generated static sitemap | Build completed with 73 static URLs; generated timestamp-only drift was not treated as product proof |
| Targeted ESLint | **0 errors**; 476 existing warnings in touched legacy files |
| Typecheck | **Blocked by two pre-existing `origin/main` test-fixture errors** listed below |
| Live database sitemap proof | Not run |
| Production/browser proof | Not run |
| GitHub Actions | Could not start because of the confirmed account billing lock |

Focused command:

```text
npm run test:run -- server/tests/sitemap-contracts.test.ts server/tests/landing-seo-contracts.test.ts server/tests/trade-seo-resilience.contract.test.ts server/tests/public-page-response.test.ts server/tests/public-profile-seo-contracts.test.ts server/tests/public-trade-html.contract.test.ts server/tests/public-seo-html.test.ts server/tests/app-shell-seo-contracts.test.ts
```

### Baseline typecheck failures

`npm run check` reports only:

- `PremiumProductProfileSections.test.tsx:290` — fixture lacks `shareImageOrder`.
- `WholesalerProfileTheme.lux.test.tsx:118` — impossible `inventoryCatalog` comparison.

Both files are byte-for-byte unchanged by this branch relative to `origin/main`. The same failures were independently reproduced while reconciling PR #211.

## Residual risks and merge posture

- Real database row counts may expose data-shape issues not represented by source contracts.
- A successful production build does not prove the production deployment SHA or live crawler responses.
- Search Console recovery necessarily lags deployment and recrawl; no recovery claim is made here.
- GitHub Actions did not run. Local proof is the accepted substitute for this review cycle, not evidence that hosted CI passed.

The branch may be pushed and opened as a reviewable PR without waiting for Actions. Merge and production deployment remain separate decisions and must not be inferred from local SEO proof alone.

## Rollback

Close the PR and delete only `fix/search-index-sitemap-contract`. No production rollback is necessary because this lane has not been merged or deployed.
