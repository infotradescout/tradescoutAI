# Public Discovery — Phase 1 Forensic Audit (TradeScout)

**Branch:** `codex/public-discovery-contract-v1-20260807`  
**Audit window:** 2026-08-07 (live probes + Render request logs 2026-07-31 → 2026-08-04)  
**Live build observed:** production `www.thetradescout.com` / `jwstonelogistics.com` (not this branch)  
**Scope:** TradeScoutPro only in this packet. Sibling repos noted; not fully audited here.  
**Merge/deploy:** none — docs-only correction on local feature branch

## Ecosystem repo presence (local)

| Product | Local path observed | This packet |
| --- | --- | --- |
| TradeScout | `TradeScout/TradeScoutPro` | Full Phase 1 + causation continuation |
| MealScout | `AAATraderCorner/MealScout` (+ many lane clones) | Not audited in this TradeScout packet |
| Sway | `AAATraderCorner/sway` | Not audited in this TradeScout packet |
| Skill Gaming World | `AAATraderCorner/skill-gaming-world` | Not audited in this TradeScout packet |
| NewsFilter | `AAATraderCorner/NewsFilter` | **Not authorized** — not audited |
| HomeID / HomeScout / TradeComp / ScoutFitters / AutoID / MarineID / RVID / EquipID / 30Aplus | Mostly **in-platform** TradeScout surfaces | Covered as TradeScout lanes below |
| AutoBott | Present under AAATraderCorner | Intentionally internal; not audited |

---

## Critical finding (revised wording)

**User-agent-specific initial HTML rendering asymmetry: the generic browser-UA HTTP response is shell-only before JavaScript execution, while the tested GPTBot-UA response contains server-rendered JW Stone content and structured data.**

The same server-retained SEO body is also returned for tested **OAI-SearchBot** and **ChatGPT-User** UAs (identical content fingerprint among the three bot UAs on each host).

This does **not** mean:

- normal browsers receive a broken or blank page (after JavaScript they render the SPA);
- GPTBot is the ChatGPT search crawler (that role is **OAI-SearchBot**);
- GPTBot SSR caused the JW Stone lead;
- `llms.txt` caused the lead;
- structured data alone caused the lead.

### Response-surface vocabulary used below

| # | Surface | Meaning |
| --- | --- | --- |
| 1 | Initial HTTP response | Server bytes before JS |
| 2 | Browser-rendered after JS | Hydrated SPA for humans |
| 3 | Search-crawler response | e.g. OAI-SearchBot shape / live visits |
| 4 | User-triggered fetch response | e.g. ChatGPT-User shape / live visits |
| 5 | Training-crawler response | e.g. GPTBot shape / live visits |

Code note (repo, not changed in this lane): `preparePublicSeoHtmlForUserAgent` retains in-root SEO summary when `detectActorFromUserAgent` classifies the UA as `bot`, and strips it to `<div id="root"></div>` for human UAs. Manual UA tests prove **response shape only**, not real crawler visits.

---

## TradeScout discovery matrix

| Surface | Official domain | Canonical | robots / crawlers | Sitemap | First-response facts | Permanent addresses | Structured facts | Thin/unclaimed block | Protected block | Attribution | Live=repo | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform root / landing | `www.thetradescout.com` | Prefers www | `robots.txt` Allow public dirs; Disallow admin/dashboard/settings/messages/scout/auth/api; OAI-SearchBot / GPTBot / ChatGPT-User allowed (separate groups; not yet separate training vs search policy) | `sitemap-index.xml` + children; live XML 200 | Per-route; human UA often shell-only body with head meta | N/A | Partial | Partial | Yes for private | Affiliate/utm cookies exist; not full discovery funnel | Partial | **partial** |
| Public profiles `/u/*`, `/p/*` | www | Canonical builders + SEOHelmet / SSR HTML modules | Allowed in robots | `sitemap-profiles.xml` (+ service offers) | SSR HTML + LocalBusiness JSON-LD in code/tests | Profile slug permanent; **intent/service child pages not enforced for all claimed businesses** | LocalBusiness present in builders | Unverified/claimed-unverified noindex paths exist | Private APIs 403 patterns | Referral cookie first-touch; incomplete ChatGPT→Request→outcome chain | Partial | **partial** |
| JW Stone marketplace `/jw-stone`, `/u/jw-stone`, custom host | www + `jwstonelogistics.com` | Split: marketplace path canonicalizes to www `/jw-stone`; profile/custom host canonicalizes to `https://jwstonelogistics.com` | Allowed; JW host sitemap lists stones/materials | JW host `sitemap.xml` strong; www core/profiles sitemaps did **not** list `jw-stone` at probe time | UA asymmetry (see matrix below) | Categories/inventory improving; filter state still a risk | CollectionPage JSON-LD in head for all tested UAs | N/A (named fixture) | N/A | **Strongly supported** ChatGPT-tagged human landing (see §Attribution) | Live asymmetry matches repo helper | **partial** (reference fixture; conversion ledger incomplete) |
| HomeScout listings / counties | www | Sitemap entries exist | Allowed `/homescout/` | `sitemap-homescout-*.xml` live in index | SSR path exists in platform; eligibility of each listing TBD | Listing permanence intended | TBD per listing | Owner-approved only (policy target) | Private home APIs | Weak for discovery funnel | Unknown depth | **unknown** → treat as opportunity |
| HomeID | www (app) | Must not be public vault | Should stay private | Must not list vault records | Owner share views only | Share tokens only | N/A public vault | Vault private by default | Strong privacy intent in product law | N/A | Intentional | **intentionally private** (education/share only) |
| Exchange / handmade | www | Canonical listing URLs | Allowed `/exchange/` | `sitemap-exchange-listings.xml`, handmade | SSR listing HTML referenced in server | Listing IDs | JSON-LD for listings in server | Eligibility TBD | Private dashboards blocked | Partial | Partial | **partial** |
| Directory trade/city/county | www | Directory sitemaps | Allowed | Multiple directory sitemaps | SEO contracts for thin→noindex | County/trade/city paths | Mixed | Thin noindex contracts exist | Yes | Weak | Partial | **partial** |
| Direct Connect / Scout | www | N/A public discovery | Disallow `/scout/` | Must not sitemap private tools | N/A | N/A | N/A | N/A | Disallow + auth | Conversion sink | Intentional | **intentionally private** (conversion, not index) |
| `llms.txt` | www | States canonical host | Linked from robots | N/A | 200 text/plain live | N/A | N/A | N/A | N/A | **Supplemental only** — not proven causal for JW lead | Live | **pass** (file exists; not a discovery requirement) |
| Training vs search crawler split | www + JW host | — | GPTBot allowed similarly to search bots; **no distinct training deny policy found** | — | — | — | — | — | — | — | — | **blocked** (policy decision missing) |

---

## D. Targeted JW Stone causation audit (URL × UA)

**Probe time:** 2026-08-07. Manual UA = server response shape only.  
**UAs tested:** (1) generic Chrome browser (2) OAI-SearchBot (3) GPTBot (4) ChatGPT-User

### Support surfaces

| Surface | Result |
| --- | --- |
| `https://www.thetradescout.com/robots.txt` | 200 `text/plain`; includes User-agent groups for OAI-SearchBot, GPTBot, ChatGPT-User; Sitemap pointers; Allow `/llms.txt` |
| `https://jwstonelogistics.com/robots.txt` | 200; Allow `/`, `/stones/`, `/materials/`; Disallow private routes; Sitemap `https://jwstonelogistics.com/sitemap.xml` |
| `https://www.thetradescout.com/sitemap-index.xml` | 200 `application/xml` (not app shell) |
| Child sitemaps (www) | `sitemap-core.xml` / `sitemap-profiles.xml` probes did **not** show `jw-stone` locs at audit time |
| `https://jwstonelogistics.com/sitemap.xml` | 200 XML; home + materials + many `/stones/*` permanent URLs |
| `https://www.thetradescout.com/llms.txt` | 200; canonical host stated; **no JW-specific causation claim**; supplemental only |
| Apex `https://thetradescout.com/jw-stone` | TLS handshake failed from this probe environment after HTTP→HTTPS 301; treat as infrastructure/probe gap, not content proof |
| `tradescoutai.onrender.com/jw-stone` | Redirects to `www.thetradescout.com/jw-stone` |
| `tradescoutai.onrender.com/u/jw-stone` | Ends at `https://jwstonelogistics.com/` (same as www `/u/jw-stone`) |
| `www.jwstonelogistics.com/` | 301 → `https://jwstonelogistics.com/` |
| `jwstonelogistics.com/jw-stone` | **404** plain text (path not mirrored on custom host) |
| Cloudflare / middleware UA branching | App-level UA branching confirmed in `server/publicSeoHtml.ts` + `server/utils/requestActor.ts`; no separate Cloudflare bot-HTML proof collected |

### URL matrix (condensed; full fields)

Shared head facts for successful JW HTML pages (all four UAs unless noted):

- Content-Type: `text/html; charset=utf-8`
- Robots meta: `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1`
- Title: `JW Stone | Stone Discovery | TradeScout`
- Meta description: browse / gallery / ask-about-material summary
- JSON-LD type: `CollectionPage`
- JSON-LD name: `JW Stone | Stone Discovery`
- JSON-LD present in head for browser **and** bot UAs
- noindex: not observed on these public JW pages

#### A) `https://www.thetradescout.com/jw-stone`

| Field | Browser UA | OAI-SearchBot | GPTBot | ChatGPT-User |
| --- | --- | --- | --- | --- |
| HTTP status | 200 | 200 | 200 | 200 |
| Redirect chain | none | none | none | none |
| Final URL | same | same | same | same |
| Canonical | `https://www.thetradescout.com/jw-stone` | same | same | same |
| H1 in initial HTML | **absent** | `Natural stone, selected at the source.` | same | same |
| Meaningful body text (pre-JS) | **no** (empty `#root`) | **yes** (`data-seo` main retained) | yes | yes |
| Business name in initial HTML | yes (title/meta/JSON-LD) | yes (+ body) | yes | yes |
| Public location in initial HTML | weak/partial (marketing copy; not a strong address block in probe) | same class | same | same |
| Inventory / service facts | in meta/JSON-LD; body shell empty | body + links | same | same |
| Start a Request / Ask path | meta/CTA cues; body shell empty | present in SSR body | same | same |
| JSON-LD URL | `https://www.thetradescout.com/jw-stone` | same | same | same |
| JSON-LD vs visible | agrees with head; body heading missing pre-JS | agrees with SSR body | same | same |
| Body length / hash | ~9592 / `FF3FD667501D033E` | ~9278 / `03495C29552A7096` | same as OAI | same as OAI |
| Requires JS for core identity | **yes for body identity** (head still has title/meta/JSON-LD) | no | no | no |

#### B) `https://www.thetradescout.com/u/jw-stone`

| Field | All four UAs (same redirect outcome) |
| --- | --- |
| Status / redirects | Followed redirects → **200** `https://jwstonelogistics.com/` |
| Final URL | `https://jwstonelogistics.com/` |
| Canonical on final page | `https://jwstonelogistics.com` |
| Note | Platform profile path is not the final canonical; custom host is |

Final-page UA split matches section C.

#### C) `https://jwstonelogistics.com/` (canonical custom host)

| Field | Browser UA | OAI-SearchBot / GPTBot / ChatGPT-User |
| --- | --- | --- |
| HTTP status | 200 | 200 |
| Redirects | none | none |
| Canonical | `https://jwstonelogistics.com` | same |
| H1 initial | **absent** | `Natural stone, selected at the source.` |
| Meaningful body pre-JS | **no** (empty `#root`) | **yes** |
| Business name | yes in head | yes in head + body |
| Inventory facts | head/JSON-LD; body shell empty | body + stone/material links |
| Action path | head/meta cues | SSR body cues |
| JSON-LD | CollectionPage; URL/name JW Stone | same types; bot trio share hash `4B06A2043D090316` |
| Body length / hash | ~9680 / `E28C207149E24D5D` | ~9366 / `4B06A2043D090316` |
| Requires JS for core body identity | yes | no |

### Crawler-response comparison (summary)

| Dimension | Browser initial HTML | OAI-SearchBot | GPTBot | ChatGPT-User |
| --- | --- | --- | --- | --- |
| Role | Ordinary browser initial HTTP | Search discovery crawler | Possible training crawler | User-triggered fetch |
| Empty `#root` | yes | no | no | no |
| SSR H1 / SEO main | no | yes | yes | yes |
| Head title/meta/JSON-LD | yes | yes | yes | yes |
| Content fingerprint vs other bot UAs | different (shell strip) | identical among three bots per host | identical | identical |
| Proves real crawler visit? | n/a | **no** (manual UA) | **no** | **no** |

**Contract gap:** public body identity currently depends on crawler-specific UA retention. That violates Contract v1 §10 (meaningful initial HTML without crawler-specific UA; no bot-only body facts). Head metadata is shared; body SSR is bot-retained.

---

## E. Attribution / log evidence (JW lead window)

**Sources inspected:** Render request logs for service `srv-d4rivgm3jp1c7391th0g` (tradescoutAI), workspace `tea-d191jph5pdvs73drglkg`, 2026-07-31 → 2026-08-04; live robots/sitemaps/`llms.txt`; repo SEO UA helper.  
**Not available here:** TradeScout production Postgres via Render MCP (workspace listed only `sway-production-db`); no private customer PII recorded below.

### Human ChatGPT-tagged landing (UA observed)

| Timestamp (UTC) | Host | Path | Status | UA class | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-08-02T04:59:11Z | `jwstonelogistics.com` | `/?utm_source=chatgpt.com` | 200 | iPhone Safari (human) | Followed by asset/hydration requests + inventory media from same client IP (IP omitted from artifact) |
| 2026-08-02T13:45:23Z | `jwstonelogistics.com` | `/?utm_source=chatgpt.com` | 200 | iPhone Safari (human) | Return visit, same client IP family as morning landing |

Referrer header not present in Render request-log fields inspected. Authenticity for this landing: **human UA observed** (not a bot UA); not an OpenAI crawler IP verification case.

### Bot / fetch activity (UA observed; IP not verified against OpenAI published ranges in this audit)

| Actor | Window highlights | Role classification |
| --- | --- | --- |
| ChatGPT-User | 2026-07-31 dense fetches of `/`, `/stones/*`, inventory images on `jwstonelogistics.com` | User-triggered fetch — **not** search-index crawler |
| OAI-SearchBot | robots.txt + intermittent page hits including JW `/`, `/materials/marble`, `/stones/blue-dunes` (Aug 2+) | Search discovery crawler |
| GPTBot | sitemap/index hits; heavy Aug 2 crawl of JW stones/materials/images | Possible training crawler — **not** proof of ChatGPT search inclusion |

### Conversion / phone

- No Start a Request / Direct Connect conversion event was located in the Render request-log sample tied to the utm landing without entering private records.
- Offline/ops phone attribution is **out of band** for this packet; not upgraded to machine-confirmed conversion.

### Causation classification (one finding)

**2 — Strongly supported ChatGPT referral**

Rationale (conservative):

- Machine evidence shows a human browser landing on the JW canonical host with `utm_source=chatgpt.com` on 2026-08-02, with return visit the same day and SPA hydration/inventory asset fetches.
- Concurrent ChatGPT-related bot/fetch traffic (ChatGPT-User, OAI-SearchBot, GPTBot) is consistent with ChatGPT ecosystem attention but is **not** treated as the human referral by itself.
- Gaps prevent classification **1 Confirmed direct**: no logged referrer=`chatgpt.com`, no logged conversion/Start a Request/phone event in this packet, and no IP verification step for OpenAI crawlers.
- Evidence does **not** support claiming GPTBot SSR, `llms.txt`, or JSON-LD alone caused the lead.

---

## Proven causes / likely contributors / unknowns

### Proven (response / infrastructure)

1. UA-specific initial HTML asymmetry on JW public pages (exact classification above).
2. Sitemaps and robots are real XML/text on official hosts.
3. Profile/marketplace SSR machinery exists; completeness/equivalence enforcement is incomplete.
4. Affiliate/utm first-touch mechanisms exist; discovery event ledger through Start a Request → outcome is not productized.
5. Training vs search crawler policy is not separated—GPTBot is broadly Allowed like search bots.
6. Canonical split: www `/jw-stone` vs custom host `jwstonelogistics.com` (profile `/u/jw-stone` redirects to custom host).

### Likely contributors to acquisition (not sole causes)

1. Public inventory permanence on `jwstonelogistics.com` (sitemap + stone URLs).
2. ChatGPT-tagged human landing (`utm_source=chatgpt.com`) with return visit.
3. Prior ChatGPT-User fetches of stone pages (user-triggered), separate from search crawl.

### Unknowns / gaps

1. Whether OAI-SearchBot inclusion (vs ChatGPT browse / share) produced the utm link.
2. Exact offline phone/outcome linkage without private records.
3. How many www sitemap profile URLs are thin / unclaimed / noindex in practice.
4. HomeScout listing eligibility vs sitemap membership drift.
5. Apex `thetradescout.com` TLS behavior from other networks.

---

## Privacy review (TradeScout)

- HomeID Vault: keep **intentionally private**; only education + owner-approved shares
- Direct Connect: do not expose personal phones on public discovery pages
- `/api/`, `/admin/`, `/dashboard/`, `/messages/`, `/scout/`, `/auth/`: robots Disallow present
- Do not weaken these to “improve discovery”
- This artifact intentionally omits customer IPs, names, and phone numbers

## Canonical-domain review

- Preferred TradeScout host: `https://www.thetradescout.com`
- JW custom host canonical observed: `https://jwstonelogistics.com`
- `llms.txt` states TradeScout canonical host (supplemental)
- Operational: `tradescoutai.onrender.com` redirects toward public hosts and must not become canonical in JSON-LD/OG

## Attribution review

| Required event | TradeScout today |
| --- | --- |
| discovery_landing | Partial — utm path observed in Render logs for JW; not unified ledger |
| discovery_entity_view | Partial / unknown for inventory views |
| discovery_primary_action | Partial (CTAs exist; not unified ledger) |
| discovery_phone_click | Unknown / gated; not proven in this packet |
| discovery_request_started/sent | Work request / Direct Connect paths exist; not labeled discovery funnel |
| discovery_connection_accepted | Direct Connect states exist |
| discovery_outcome_recorded | Weak |
| Offline “How did you find us?” | Not standardized |

---

## Exact live addresses to verify after any future deploy (do not deploy from this branch)

- `https://www.thetradescout.com/robots.txt`
- `https://www.thetradescout.com/llms.txt` (supplemental)
- `https://www.thetradescout.com/sitemap-index.xml`
- `https://www.thetradescout.com/jw-stone` (browser UA + OAI-SearchBot + GPTBot + ChatGPT-User)
- `https://www.thetradescout.com/u/jw-stone` (expect redirect to custom host)
- `https://jwstonelogistics.com/` + sample `/stones/{slug}` + `/sitemap.xml`
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

## Phase 3 readiness contribution (TradeScout side only)

TradeScout contributes these Phase 3 entry inputs (implementation **not** started in this lane):

- Correct crawler model in Contract v1 (OAI-SearchBot ≠ GPTBot ≠ ChatGPT-User)
- Accurate UA-asymmetry wording (no “blank browser page” claim)
- Causation classified as **2 Strongly supported ChatGPT referral**
- Smallest useful implementation lane identified (below)
- Manual user-flow proof definition: land with `utm_source=chatgpt.com` on JW host → view stone → Start a Request / Ask path → confirm attribution cookie/event survives (execute later; not run as a deploy)

Still waiting on parent cross-system reconciliation + sibling audits before Phase 3 coding.

### Recommended smallest implementation lane (describe only — do not build)

1. **Public HTML equivalence for eligible pages:** stop stripping SEO body for human UA on eligible public entity routes (or serve the same fact-bearing initial HTML to all UAs), starting with JW reference + one ordinary claimed profile.
2. **Contract tests (local, no GitHub Actions):** assert meaningful generic initial HTML; OAI-SearchBot access; material equivalence across the four UAs; JSON-LD matches visible facts; canonical consistency; sitemap inclusion; robots; private-route exclusion; no bot-only claims.
3. **Discovery event names only:** emit/record `discovery_landing` (incl. `utm_source=chatgpt.com`) and `discovery_entity_view` without changing contact gating.
4. **Defer:** training-vs-search robots policy decision (owner), full funnel ledger, sibling-brand implementation.

---

## Final status (this packet)

| System | Status |
| --- | --- |
| TradeScout main platform | **partial** |
| TradeScout profiles | **partial** |
| JW Stone | **partial** (reference fixture; ChatGPT-tagged landing strongly supported; initial-HTML equivalence gap; attribution/outcome ledger incomplete) |
| HomeID | **intentionally private** |
| HomeScout | **unknown** (opportunity) |
| Exchange | **partial** |
| MealScout / Sway / Skill Gaming / others | **unknown** in this TradeScout packet |

**Next authorized steps (still no merge/deploy):** sibling Phase 1 audits elsewhere; parent synthesis; Phase 3 only after entry conditions are met — **do not implement Phase 3 in this lane**.
