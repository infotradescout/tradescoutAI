# Public Discovery — Phase 1 Forensic Audit (TradeScout)

**Branch:** `codex/public-discovery-contract-v1-20260807`  
**Audit window:** 2026-08-07  
**Live build observed:** `/api/health` commit around release `7d9ca967` (fill-gaps docs); discovery HTML behavior verified live  
**Scope:** TradeScoutPro only in this packet. Sibling repos noted; not fully audited here.  
**Merge/deploy:** none

## Ecosystem repo presence (local)

| Product | Local path observed | This packet |
| --- | --- | --- |
| TradeScout | `TradeScout/TradeScoutPro` | Full Phase 1 |
| MealScout | `AAATraderCorner/MealScout` (+ many lane clones) | Not audited yet |
| Sway | `AAATraderCorner/sway` | Not audited yet |
| Skill Gaming World | `AAATraderCorner/skill-gaming-world` | Not audited yet |
| NewsFilter | `AAATraderCorner/NewsFilter` | Not audited yet |
| HomeID / HomeScout / TradeComp / ScoutFitters / AutoID / MarineID / RVID / EquipID / 30Aplus | Mostly **in-platform** TradeScout surfaces (not separate repos found) | Covered as TradeScout lanes below |
| AutoBott | Present under AAATraderCorner | Intentionally internal; not audited |

---

## TradeScout discovery matrix

| Surface | Official domain | Canonical | robots / crawlers | Sitemap | First-response facts | Permanent addresses | Structured facts | Thin/unclaimed block | Protected block | Attribution | Live=repo | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform root / landing | `www.thetradescout.com` | Prefers www | `robots.txt` Allow public dirs; Disallow admin/dashboard/settings/messages/scout/auth/api; GPTBot/OAI-SearchBot/ChatGPT-User allowed like search bots | `sitemap-index.xml` + many children; live XML 200 | Landing depends on route; needs per-URL proof | N/A | Partial | Partial | Yes for private | Affiliate/utm cookies exist; not full discovery funnel | Partial | **partial** |
| Public profiles `/u/*`, `/p/*` | www | Canonical builders + SEOHelmet / SSR HTML modules | Allowed in robots | `sitemap-profiles.xml` (+ service offers) | SSR HTML + LocalBusiness JSON-LD in code/tests | Profile slug permanent; **intent/service child pages not enforced for all claimed businesses** | LocalBusiness present in builders | Unverified/claimed-unverified noindex paths exist | Private APIs 403 patterns | Referral cookie first-touch; incomplete ChatGPT→Request→outcome chain | Partial | **partial** |
| JW Stone marketplace `/jw-stone`, `/u/jw-stone` | www | `https://www.thetradescout.com/jw-stone` live | Allowed | Need confirm stone URLs in sitemap children | **GPTBot:** SSR with `<h1>` + CollectionPage JSON-LD. **Default browser UA:** empty `#root` shell + noscript “JS required” | Categories/inventory improving; filter state still a risk vs permanent stone URLs | CollectionPage for bot SSR; inventory Product depth TBD | N/A (named fixture) | N/A | Confirmed real-world ChatGPT utm referral → return → call (ops evidence); **code does not yet prove full funnel events** | Live SSR bot path exists in prod | **partial** (reference fixture; attribution/outcome incomplete) |
| HomeScout listings / counties | www | Sitemap entries exist | Allowed `/homescout/` | `sitemap-homescout-*.xml` live in index | SSR path exists in platform; eligibility of each listing TBD | Listing permanence intended | TBD per listing | Owner-approved only (policy target) | Private home APIs | Weak for discovery funnel | Unknown depth | **unknown** → treat as opportunity |
| HomeID | www (app) | Must not be public vault | Should stay private | Must not list vault records | Owner share views only | Share tokens only | N/A public vault | Vault private by default | Strong privacy intent in product law | N/A | Intentional | **intentionally private** (education/share only) |
| Exchange / handmade | www | Canonical listing URLs | Allowed `/exchange/` | `sitemap-exchange-listings.xml`, handmade | SSR listing HTML referenced in server | Listing IDs | JSON-LD for listings in server | Eligibility TBD | Private dashboards blocked | Partial | Partial | **partial** |
| Directory trade/city/county | www | Directory sitemaps | Allowed | Multiple directory sitemaps | SEO contracts for thin→noindex | County/trade/city paths | Mixed | Thin noindex contracts exist | Yes | Weak | Partial | **partial** |
| Direct Connect / Scout | www | N/A public discovery | Disallow `/scout/` | Must not sitemap private tools | N/A | N/A | N/A | N/A | Disallow + auth | Conversion sink | Intentional | **intentionally private** (conversion, not index) |
| `llms.txt` | www | States canonical host | Linked from robots | N/A | 200 text/plain live | N/A | N/A | N/A | N/A | Guidance only | Live | **pass** (file exists) |
| Training vs search crawler split | www | — | GPTBot allowed same as search; **no distinct Google-Extended / training deny policy found** | — | — | — | — | — | — | — | — | **blocked** (policy decision missing) |

---

## Live probes (2026-08-07)

| URL | Result |
| --- | --- |
| `/robots.txt` | 200 `text/plain` |
| `/sitemap-index.xml` | 200 `application/xml` (not app shell) |
| `/sitemap-core.xml` | 200 `application/xml` |
| `/llms.txt` | 200 `text/plain`; canonical host stated |
| `/jw-stone` (browser UA) | 200 HTML; **empty `#root`**; title/meta in head; noscript requires JS |
| `/jw-stone` (GPTBot UA) | 200 HTML; **`<h1>` present**; CollectionPage JSON-LD; not empty root |
| `/u/jw-stone` (GPTBot UA) | Same SSR pattern as `/jw-stone` |
| `/api/health` | 200 JSON; migrations compatible at audit time |

---

## Proven causes / likely contributors / unknowns

### Proven

1. **Bot-conditional SSR works for JW** under GPTBot UA; default UA gets SPA shell. Discovery contract for crawlers is partially met; human no-JS is not.
2. **Sitemaps and robots are real XML/text**, not application shells, on the official domain.
3. **Profile SSR + LocalBusiness JSON-LD machinery exists** in `publicProfileHtml` / `publicContractorProfileHtml` / related modules—problem is completeness enforcement, not missing renderer.
4. **Affiliate/utm first-touch cookies exist**; they are not the same as the required discovery event ledger through Start a Request → outcome.
5. **Training vs search crawler policy is not separated**—GPTBot is broadly Allowed.

### Likely contributors

1. Claimed businesses lack JW-level **intent/service permanent URLs** grounded only in verified capabilities.
2. Inventory/category permanence may still lean on client state for some browse paths.
3. ChatGPT referral survival across return visits is ops-proven for JW once; not productized as `discovery_*` events.

### Unknowns (need Phase 1 follow-ups)

1. How many sitemap profile URLs are thin / unclaimed / noindex in practice
2. HomeScout listing eligibility vs sitemap membership drift
3. Whether OpenAI crawl of trade/comparison pages maps to claimed businesses and Start a Request
4. MealScout / Sway / Skill Gaming World live matrices (repos present; not run in this packet)

---

## Privacy review (TradeScout)

- HomeID Vault: keep **intentionally private**; only education + owner-approved shares
- Direct Connect: do not expose personal phones on public discovery pages
- `/api/`, `/admin/`, `/dashboard/`, `/messages/`, `/scout/`, `/auth/`: robots Disallow present
- Do not weaken these to “improve discovery”

## Canonical-domain review

- Preferred: `https://www.thetradescout.com`
- `llms.txt` states canonical host
- Operational: `tradescoutai.onrender.com` must not become canonical in JSON-LD/OG

## Attribution review

| Required event | TradeScout today |
| --- | --- |
| discovery_landing | Partial (utm/ref cookies) |
| discovery_entity_view | Partial / unknown for inventory |
| discovery_primary_action | Partial (CTAs exist; not unified ledger) |
| discovery_phone_click | Unknown / gated |
| discovery_request_started/sent | Work request / Direct Connect paths exist; not labeled discovery funnel |
| discovery_connection_accepted | Direct Connect states exist |
| discovery_outcome_recorded | Weak |
| Offline “How did you find us?” | Not standardized |

---

## Exact live addresses to verify after any future deploy (do not deploy from this branch)

- `https://www.thetradescout.com/robots.txt`
- `https://www.thetradescout.com/llms.txt`
- `https://www.thetradescout.com/sitemap-index.xml`
- `https://www.thetradescout.com/jw-stone` (browser UA + GPTBot UA)
- `https://www.thetradescout.com/u/jw-stone`
- Representative claimed `/u/{slug}` with and without bot UA
- One HomeScout listing URL from sitemap (owner-approved only)
- One Exchange listing URL from sitemap
- Confirm `/admin`, `/dashboard`, `/api/auth/user` remain non-indexable

---

## Rollback procedure (for later implementation PRs)

1. Revert feature commits on the discovery branch
2. Restore prior HTML builders / robots / sitemap generators
3. Re-run live probes above on previous SHA
4. Confirm no private routes entered sitemaps

---

## Final status (this packet)

| System | Status |
| --- | --- |
| TradeScout main platform | **partial** |
| TradeScout profiles | **partial** |
| JW Stone | **partial** (reference fixture; crawler SSR pass; attribution/outcome gap) |
| HomeID | **intentionally private** |
| HomeScout | **unknown** (opportunity) |
| Exchange | **partial** |
| MealScout / Sway / Skill Gaming / others | **unknown** (repos exist; audit not run) |

**Next authorized steps (still no merge/deploy):** Phase 1 sibling audits; Phase 3 smallest TradeScout foundation (eligibility helper + discovery event names + contract tests) on this branch or child branches.
