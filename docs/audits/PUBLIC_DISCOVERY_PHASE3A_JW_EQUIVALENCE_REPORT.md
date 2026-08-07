# Phase 3A — JW Stone Public Discovery Equivalence

**Branch:** `feature/jw-public-discovery-equivalence-v1-20260807`  
**Source:** `codex/public-discovery-contract-v1-20260807` @ `d478f7f50869e2a0d14318515a311951475a2b34`  
**Date:** 2026-08-07  
**Posture:** PR opened — no merge / deploy until owner local preview GO

## Source posture (pre-edit)

| Field | Value |
| --- | --- |
| Source branch | `codex/public-discovery-contract-v1-20260807` |
| Complete source SHA | `d478f7f50869e2a0d14318515a311951475a2b34` |
| Worktree | clean tracked tree (untracked `tmp-catchup-scratch/` only) |
| origin/main SHA | `7d9ca967ba7f01881c19a21c931616feb7c09690` |
| Merge-base (source ↔ origin/main) | `7d9ca967ba7f01881c19a21c931616feb7c09690` |
| Contract v1 present | `docs/audits/PUBLIC_DISCOVERY_CONTRACT_V1.md` |
| Phase 1 audit present | `docs/audits/PUBLIC_DISCOVERY_PHASE1_AUDIT_TRADESCOUT.md` |

## Pre-edit inspection (required before edits)

1. **Canonical JW Stone public route(s)**
   - Platform marketplace: `https://www.thetradescout.com/jw-stone` (plus `/jw-stone/stones/:slug`, `/jw-stone/materials/:slug`)
   - Custom host collection: `https://jwstonelogistics.com/` (plus `/stones/:slug`, `/materials/:slug`)
   - `/u/jw-stone` redirects to custom host `/` (not the marketplace canonical)

2. **Generic browser request path**
   - HTML built by `buildPublicJwStoneMarketplaceHtml` → `res.send(html)`
   - Global `res.send` wrapper in `server/index.ts` calls `preparePublicSeoHtmlForUserAgent`
   - Human UA: SEO `<main data-seo-*>` inside `#root` stripped to empty `<div id="root"></div>`; client module scripts kept; SPA boots via `client/src/main.tsx` `createRoot`

3. **Crawler SSR / prerender path**
   - Same HTML builder; bot UA retains in-root SEO summary, strips boot placeholders + `type=module` scripts

4. **User-agent branches**
   - `detectActorFromUserAgent` (`server/utils/requestActor.ts`): `bot` vs `human` / `unknown`
   - Bot names include OAI-SearchBot, GPTBot, ChatGPT-User
   - `preparePublicSeoHtmlForUserAgent` branches solely on `actorType === "bot"`

5. **Public data loader / fact source**
   - `JW_STONE_CANONICAL_INVENTORY_CATEGORIES` from `server/jwStoneCanonicalInventory.ts`
   - Reconciles the same generated inventory as `client/src/data/jwStoneInventory.ts`
   - Presentation / discovery block: `JW_STONE_PUBLIC_DISCOVERY_BLOCK` in `client/src/data/jwStoneProfilePresentation.ts`
   - Collection copy constants inside `server/publicJwStoneMarketplaceHtml.ts`

6. **JSON-LD source**
   - Injected in `buildPublicJwStoneMarketplaceHtml` (`CollectionPage` / item `WebPage`)

7. **Canonical URL source**
   - Platform collection: `JW_STONE_MARKETPLACE_PLATFORM_URL` → `https://www.thetradescout.com/jw-stone`
   - Custom domain: `${origin}/` when `marketplaceDomainSurface`
   - Item/category share metadata builders for deep links

8. **React hydration / client boot**
   - `client/src/main.tsx`: `ReactDOM.createRoot(#root).render(<App />)` (not `hydrateRoot`)
   - JW route mounts `JWStoneMarketplace` luxury UI; replaces `#root` contents on boot

9. **Analytics helper + persistence**
   - Client: `trackShellEvent` → `POST /api/analytics/shell` (`client/src/lib/analytics.ts`)
   - Server: `registerAnalyticsRoutes` → best-effort `storage.logEvent` into existing `events` table
   - No new table required; discovery event must avoid raw IP/UA enrichment

10. **Candidate files (before edits)**
    - `server/publicSeoHtml.ts` — UA retention boundary for JW equivalence
    - `server/tests/public-seo-html.test.ts` — update/extend expectations
    - `server/publicJwStoneMarketplaceHtml.ts` — only if fact-source wiring needs a shared export (prefer no copy changes)
    - `shared/discoveryLanding.ts` — new sanitizer + normalize helpers
    - `server/routes/analytics-routes.ts` — discovery_landing sanitize branch
    - `client/src/lib/analytics.ts` / `client/src/lib/discoveryLanding.ts` — emit helper
    - `client/src/features/jw-stone/JWStoneMarketplace.tsx` — once-per-landing fire
    - `server/tests/jw-public-discovery-equivalence.contract.test.ts` — response matrix
    - `server/tests/discovery-landing.contract.test.ts` — event sanitize + delivery
    - `client/src/features/jw-stone/discoveryLanding.test.ts` — client dedupe / sanitize
    - `docs/audits/PUBLIC_DISCOVERY_PHASE3A_JW_EQUIVALENCE_REPORT.md` — this report
    - Playwright evidence via existing `tests/jw-stone-2-visual.spec.ts` patterns / focused addition

## Follow-up blocker (explicit, out of scope)

**JW child-sitemap gap on www:** Phase 1 found `sitemap-core.xml` / `sitemap-profiles.xml` did not list `jw-stone` at probe time. Not fixed in this lane (no sitemap/robots/llms.txt changes).

## Implementation notes

### Initial HTML change
- `preparePublicSeoHtmlForUserAgent` detects JW marketplace HTML (`data-seo-jw-stone-marketplace`).
- **All UAs** retain the same fact-bearing SEO summary from `buildPublicJwStoneMarketplaceHtml`.
- **Bot UAs:** retain summary, strip boot placeholders + module scripts (unchanged crawl shape).
- **Browser UAs:** retain summary + client modules; SEO chrome is paint-suppressed (`clip`) so `createRoot` mounts the luxury UI without a crawler-style flash.
- Non-JW public SEO pages keep prior human-strip behavior (out of scope).

### One canonical fact source
- Unchanged: `JW_STONE_CANONICAL_INVENTORY_CATEGORIES` (server) reconciles the same generated inventory as `client/src/data/jwStoneInventory.ts`.
- Collection copy / JSON-LD / canonical still produced only by `buildPublicJwStoneMarketplaceHtml`.
- No second inventory source; no invented facts.

### Hydration preservation
- Client still uses `createRoot` (not `hydrateRoot`).
- Browser keeps module scripts; SEO summary is clipped then replaced by luxury React tree.
- Playwright: luxury hero/header visible; no hydration console errors; color rail + contact path work; analytics abort does not block page.

### discovery_landing
- Shared sanitizer: `shared/discoveryLanding.ts`
- Client once-per-landing emit: `client/src/lib/discoveryLanding.ts` from `JWStoneMarketplace` mount
- Server branch in `/api/analytics/shell` persists allowlisted fields only (no raw IP/UA/full URL/query)
- `utm_source=chatgpt.com` → `sourceHint: "chatgpt"` (observed hint, not mechanism claim)
- Schema / migration: **no**

### Explicit non-changes
- JW design / copy / inventory / Direct Connect: **no** intentional changes
- Sitemap / robots / llms.txt: **no**
- Other profiles / sibling products: **no**

## Evidence

### Normalized response matrix (production-like `npm run start` :5057)

| UA | status | canonical | H1 | marker | JSON-LD | empty `#root` only |
| --- | --- | --- | --- | --- | --- | --- |
| Browser | 200 | `https://www.thetradescout.com/jw-stone` | Natural stone, selected at the source. | yes | CollectionPage / JW Stone \| Stone Discovery | no |
| OAI-SearchBot | 200 | same | same | yes | same | no |
| GPTBot | 200 | same | same | yes | same | no |
| ChatGPT-User | 200 | same | same | yes | same | no |

Command: `node scripts/jw-phase3a-response-matrix.mjs http://127.0.0.1:5057` → `PHASE3A_MATRIX_PASS`

### Hydration / browser
- `npx playwright test -c tests/jw-phase3a-hydration.config.ts` with `BASE_URL=http://127.0.0.1:5057` → **2 passed**
- Luxury UI present after mount; SEO summary not visibly duplicated; color selection + contact path exercised; analytics failure non-blocking

### discovery_landing tests
- Server contract + client dedupe/sanitize: **pass**
- Local POST `/api/analytics/shell` → **204**

### Focused JW regressions
- `jw-stone-public-discovery`, marketplace HTML, SEO HTML, JWStoneMarketplace, WishlistPanel, ColorPaletteRail: **68/68 passed**

### Manual walkthrough checklist (recorded)

| # | Step | Result |
| --- | --- | --- |
| 1–5 | Canonical `/jw-stone` signed-out; luxury design; no blank shell; no duplicate SSR; identity visible | Pass (Playwright + matrix) |
| 6–9 | Buyer workspaces Fabricator/Builder/Designer/Homeowner | **Out of scope / unresolved pre-existing product gap.** Current marketplace does not provide distinct workspaces; legacy buyer query params are ignored. PR #293 does not introduce or resolve this gap. |
| 10–12 | Color selection; filter URL restorable; back nav | Pass color selection (Playwright); filter/back covered by existing unit suite |
| 13–16 | Names/finishes/unnamed/no prices/no hold | Pass via existing JW unit + public HTML contracts |
| 17–20 | Wishlist + deliberate contact; no browse-opens-contact | Pass via JWStoneMarketplace unit + Playwright contact |
| 21–23 | `utm_source=chatgpt.com` UX unchanged; one sanitized event | Pass (sanitize/dedupe tests + Playwright landing capture) |
| 24–25 | Analytics fail; browse/contact still work | Pass (Playwright abort route) |
| 26 | No private fields in HTML/JSON-LD/event | Pass (matrix + sanitize tests) |

### Remaining gaps
- www child-sitemap inclusion of `jw-stone` (follow-up blocker; untouched)
- Offline phone/outcome linkage (out of scope)
- Training-vs-search robots policy (deferred)

## Validation

| Check | Result |
| --- | --- |
| `git diff --check` | clean |
| `npm run check` | pass |
| Focused Phase 3A + JW tests | pass (68) |
| Playwright hydration | pass (2) |
| `npm run build` | pass |
| Production-like matrix | `PHASE3A_MATRIX_PASS` |
| Schema/migration | none |

## Governance

- Branch pushed; PR to `main` opened — **no merge / deploy / Render changes**
- Release-gate branch (`codex/release-gate-minimum-contract-20260807`) untouched — zero files changed on that lane
- Product verdict: JW public initial HTML now fact-equivalent across browser + crawler UAs; luxury experience preserved after mount; sanitized discovery_landing added without mechanism claims
- Technical verdict: **PASS WITH CONDITIONS** (see Conditions disposition below)
- Recommended next posture: owner local preview on `/jw-stone`; explicit GO before merge

## Conditions disposition

| Condition | Disposition |
| --- | --- |
| **(a) Legacy buyer-role workspace steps 6–9** (Fabricator / Builder / Designer / Homeowner) | **Out of scope / unresolved pre-existing product gap.** The current marketplace does not provide distinct Fabricator, Builder, Designer, Homeowner workspaces, and legacy buyer-role query parameters are ignored. PR #293 does not introduce this gap and does not resolve it. This is not owner acceptance of the current behavior. It remains a separate JW Stone product lane. |
| **(b) www child-sitemap JW gap** | **Explicit follow-up — not fixed here.** Phase 1 found `sitemap-core.xml` / `sitemap-profiles.xml` did not list `/jw-stone`. This lane intentionally made **no** sitemap, robots, or llms.txt changes. Track as a separate platform SEO lane. |

## FINAL AUDIT

**Audited SHA:** `fee1dd067913bfa6f41227f302cfab34164a7f2c`  
**Auditor posture:** owner "finish" for Phase 3A — pre-push gate  
**Date:** 2026-08-07

| Requirement | Verdict | Evidence |
| --- | --- | --- |
| **4-UA fact equivalence** (Browser, OAI-SearchBot, GPTBot, ChatGPT-User) | **PASS** | Same canonical, H1, marker, JSON-LD across all four UAs; no empty `#root`-only strip for browser. Contract suite `jw-public-discovery-equivalence.contract.test.ts` (7/7). Live matrix `node scripts/jw-phase3a-response-matrix.mjs` → `PHASE3A_MATRIX_PASS`. |
| **Hydration / luxury SPA preserved** | **PASS** | Browser retains module scripts; SEO summary paint-suppressed via clip; `createRoot` unchanged. Playwright hydration config (2/2) on prior run; contract tests confirm browser keeps facts + scripts. |
| **discovery_landing sanitized** | **PASS** | `shared/discoveryLanding.ts` allowlist; server `/api/analytics/shell` branch; client once-per-landing emit. Contract + client tests (9/9). No raw IP/UA/full URL/query persisted. |
| **No robots / sitemap / llms / schema changes** | **PASS** | Branch diff vs `origin/main`: 15 files — none touch sitemap, robots, llms.txt, or DB schema/migrations. |
| **Release-gate untouched** | **PASS** | No commits or file changes on `codex/release-gate-minimum-contract-20260807` or release-gate scripts from this lane. |
| **JW design / copy / inventory unchanged** | **PASS** | Only UA-retention boundary, analytics emit, and tests/docs in diff. |

### Final validation (pre-push)

| Check | Result |
| --- | --- |
| `git rev-parse HEAD` | `fee1dd067913bfa6f41227f302cfab34164a7f2c` ✓ |
| `npm run check` | pass |
| `npm run build` | pass |
| Phase 3A focused tests | 32/32 pass |
| Production-like 4-UA matrix | `PHASE3A_MATRIX_PASS` |

**Final audit verdict: PASS WITH CONDITIONS** — ship-ready for PR review; merge blocked until owner local preview GO. Condition (b) sitemap gap is an explicit follow-up. Condition (a) buyer-role workspaces remain an unresolved pre-existing product gap — not owner acceptance.
