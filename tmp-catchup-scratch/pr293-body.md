## Summary

Phase 3A delivers **JW Stone public discovery equivalence** on `/jw-stone`:

- **4-UA fact equivalence:** Browser, OAI-SearchBot, GPTBot, and ChatGPT-User receive the same canonical, H1, `data-seo-jw-stone-marketplace` marker, and JSON-LD facts in initial HTML. Browser UAs no longer get empty `#root`-only strip.
- **Hydration preserved:** Luxury SPA still boots via `createRoot`; SEO summary is paint-suppressed (clip) for humans; module scripts retained.
- **Sanitized `discovery_landing`:** Shared allowlist sanitizer, client once-per-landing emit from `JWStoneMarketplace`, server branch on `/api/analytics/shell`. No raw IP/UA/full URL/query; `utm_source=chatgpt.com` → `sourceHint: chatgpt` (observed hint only).
- **Explicit non-changes:** No sitemap/robots/llms.txt/schema/migration changes; JW design/copy/inventory untouched; release-gate lane untouched.

**Final audit verdict:** PASS WITH CONDITIONS (see below).

**Branch HEAD:** `52c8e7297787dd4c6efbbd171573527b8719b519`  
**Implementation SHA audited:** `fee1dd067913bfa6f41227f302cfab34164a7f2c`  
**Report:** `docs/audits/PUBLIC_DISCOVERY_PHASE3A_JW_EQUIVALENCE_REPORT.md`

## Conditions disposition

| Condition | Disposition |
| --- | --- |
| **(a) Legacy buyer-role workspace steps 6–9** (Fabricator / Builder / Designer / Homeowner) | **Out of scope / unresolved pre-existing product gap.** The current marketplace does not provide distinct Fabricator, Builder, Designer, Homeowner workspaces, and legacy buyer-role query parameters are ignored. PR #293 does not introduce this gap and does not resolve it. This is not owner acceptance of the current behavior. It remains a separate JW Stone product lane. |
| **(b) www child-sitemap JW gap** | **Explicit follow-up — not fixed in this lane.** Phase 1 gap (`sitemap-core.xml` / `sitemap-profiles.xml` missing `/jw-stone`) deferred to a separate platform SEO lane. |

## Evidence

| Check | Result |
| --- | --- |
| `npm run check` | pass |
| `npm run build` | pass |
| Phase 3A focused tests | 32/32 pass |
| 4-UA response matrix | `PHASE3A_MATRIX_PASS` |
| Playwright hydration (prior run) | 2/2 pass |
| JW focused regressions (prior run) | 68/68 pass |

## Test plan

- [ ] Owner local preview: `npm run dev` → `/jw-stone` (desktop + mobile)
- [ ] Confirm luxury UI mounts; no SEO flash; color rail + contact path work
- [ ] Signed-out crawl check: view source shows facts + JSON-LD for browser UA
- [ ] Optional: `node scripts/jw-phase3a-response-matrix.mjs http://127.0.0.1:5057` after `npm run start`
- [ ] Optional: `npx playwright test -c tests/jw-phase3a-hydration.config.ts` with `BASE_URL` set
- [ ] **Do not merge** until owner explicit GO after local preview

## Release posture

- **No merge / deploy / Render changes** in this step — PR for review only.
