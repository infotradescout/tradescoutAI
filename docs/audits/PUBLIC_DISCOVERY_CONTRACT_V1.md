# Public Discovery Contract v1

**Status:** draft on feature branch (not merged, not deployed)  
**Owner surface:** TradeScout governance; JW Stone is the reference fixture for business + public inventory, not a universal visual template.  
**Authority:** Connection Without Compromise; primary TradeScout public action remains **Start a Request**.  
**Date:** 2026-08-07  
**Revision:** corrected crawler model + public content equivalence (same branch)

## 1. Purpose

Standardize the working public-discovery pattern observed around JW Stone acquisition (ChatGPT-tagged human landing → inventory review → reported call) across eligible TradeScout public surfaces—and document the same contract language for sibling brands without mixing data models.

This contract does **not** claim that GPTBot SSR, `llms.txt`, or structured data alone caused that lead.

## 2. Public eligibility

A page may be indexed / offered to search and retrieval crawlers only when all are true:

1. The entity is **owner-approved or platform-verified** for public exposure (not thin import-only).
2. Facts are **sourced from verified profile / inventory / listing data**—never guessed cities, services, prices, or inventory.
3. The official public domain returns **HTTP 200** with the correct content type.
4. The **first server response** contains useful identity facts (see §4)—not an empty application shell as the only carrier of core identity.
5. Private Vault / HomeID / admin / auth / messaging / API surfaces are excluded.
6. No pay-to-play ranking or lead selling.

## 3. Private-data exclusions (non-negotiable)

Never publish by default:

- HomeID Vault records, private documents, private street addresses intended for owners only
- Direct Connect private phone numbers when gated contact is the approved path
- Serials, VINs, hull IDs, equipment identifiers, storage locations (AutoID / MarineID / RVID / EquipID)
- Admin, dashboard, settings, messages, Scout authenticated tools, `/api/*` as discovery targets
- Skill Gaming World private-preview app surfaces (keep existing noindex / block)

## 4. Required first-response facts

For an eligible public page, the first HTML response (before depending on client JS) MUST include:

| Requirement | Rule |
| --- | --- |
| Unique `<title>` | Entity-specific; not a shared shell title |
| Real heading | Visible semantic heading for the entity |
| Concise summary | Meta description and/or lead paragraph |
| Entity name + type | Business, product, listing, material, etc. |
| Location / service area | When public and verified |
| Categories / services / inventory links | As applicable |
| Permanent links | To related eligible public addresses |
| Primary action cue | TradeScout: Start a Request (or inventory Ask path that preserves gating) |
| Last-verified or last-updated | Visible when available |

**Hard failure:** a fetch that should receive public discovery facts receives only `<div id="root"></div>` (or equivalent empty shell) with no entity facts in the initial HTML.

Human SPA hydration may continue after a complete first response; it must not be the only place core public identity exists.

### 4a. Response-surface distinctions (required vocabulary)

Always distinguish these surfaces; do not conflate them:

1. **Initial HTTP response** — bytes returned by the server before client JavaScript execution.
2. **Browser-rendered result after JavaScript** — what a normal browser shows after hydration; may be complete even when (1) was shell-only.
3. **Search-crawler response** — response shape for search-discovery crawlers (notably **OAI-SearchBot** for ChatGPT search discovery, plus other approved search crawlers when evidenced).
4. **User-triggered fetch response** — response shape for **ChatGPT-User** (and similar user-initiated fetchers); not a search-index crawler.
5. **Training-crawler response** — response shape for possible training crawlers (notably **GPTBot**); not proof of ChatGPT search inclusion.

## 5. Permanent-address rules

One permanent public URL per real intent, for example:

- One business profile
- One verified service intent (only from verified capabilities)
- One inventory item / material SKU
- One material category (stable slug, not ephemeral UI state)
- One HomeScout listing (owner-approved)
- One Exchange listing (when eligible)
- One TradeComp benchmark (trade + location)

Client-only filters and pager state MUST NOT be the sole address for indexable entities.

## 6. Canonical-domain rules

- Official TradeScout host: `https://www.thetradescout.com`
- Custom domains and platform profiles MUST agree on one canonical URL
- `X-Forwarded-Host` must never rewrite canonical / OG / JSON-LD to a preview host
- Render hostname is operational, not the preferred public canonical

## 7. Structured-information rules

Eligible pages emit schema.org JSON-LD matching the visible entity type (LocalBusiness, Product, Offer, Event, etc.). Structured facts MUST agree with visible facts. Invented claims are forbidden.

Structured data alone is never treated as proof that a discovery lead occurred.

## 8. Sitemap rules

- Sitemaps list only eligible successful canonical pages
- Sitemap responses MUST be XML (`application/xml` or equivalent)—never an application shell
- No private, thin, placeholder, duplicate, soft-404, or login pages
- Profile / inventory / listing inclusion requires eligibility (§2)

## 9. Independent crawler surfaces

Document and test these as independent surfaces (manual UA spoofing proves **server response shape only**, not that a real crawler visited):

| Surface | Role |
| --- | --- |
| Generic modern browser UA | Initial HTML delivered to an ordinary browser before JavaScript execution |
| **OAI-SearchBot** | Relevant to ChatGPT **search discovery** |
| **GPTBot** | Relevant to possible **training** use; **not** proof of ChatGPT search inclusion |
| **ChatGPT-User** | Relevant to some **user-triggered** page visits; **not** the search-index crawler |
| Other search crawlers | Only those already in the project’s approved audit matrix, and only with evidence; do not broaden crawler scope without evidence |

Verified crawler traffic (signed / known UA + behavior / IP verification against published ranges when available) must be distinguished in telemetry from spoofed UA claims:

- **UA observed** — string present in logs
- **IP verified** — source IP confirmed against an official published crawler range
- **Unverified / spoofable** — UA present without IP verification

### 9a. robots / training vs search policy

Publish:

1. Public allow routes (profiles, inventory, directory, eligible listings)
2. Disallow for private routes
3. Valid sitemap pointer(s)
4. Canonical host policy (`llms.txt` and robots) — **`llms.txt` is supplemental evidence only**, not a proven discovery requirement unless direct evidence establishes that
5. **Separate** search-discovery vs training-crawler decisions when product policy requires it (document explicitly per bot)

## 10. Public content equivalence rules

Contract requirements:

1. Public business facts must be **materially equivalent** across: generic browser **initial HTML**, OAI-SearchBot, GPTBot when allowed, and ChatGPT-User.
2. No business claim, inventory fact, contact fact, service fact, location fact, or trust claim may exist **only** in bot-facing HTML.
3. The canonical URL must be consistent across those surfaces (and agree with custom-domain policy).
4. Structured data must match the public page facts.
5. Public pages must have **meaningful initial HTML without requiring a crawler-specific user agent**.
6. JavaScript enhancement may add interaction, but it must **not** be the only source of the core public business identity.
7. Private or authenticated information must never be placed in crawler output.
8. Individual private HomeID records remain excluded.
9. Training access and search-discovery access must be treated as **separate policy decisions**.
10. `llms.txt` may be recorded as supplemental evidence, but not as a proven discovery requirement unless direct evidence establishes that.

## 11. Freshness

Eligible pages SHOULD expose last-verified or last-updated. Stale thin pages lose eligibility until refreshed or noindexed.

## 12. Attribution requirements

Preserve first discovery source through the journey:

| Event (logical name) | Meaning |
| --- | --- |
| `discovery_landing` | First attributed landing |
| `discovery_entity_view` | First public entity viewed |
| `discovery_primary_action` | Primary CTA selected |
| `discovery_phone_click` | Public phone click when permitted |
| `discovery_request_started` | Start a Request initiated |
| `discovery_request_sent` | Request submitted |
| `discovery_connection_accepted` | Provider/connection accepted |
| `discovery_outcome_recorded` | Completed outcome / revenue when appropriate |

Survive navigation, return visits, signup, Direct Connect, and authenticated continuation. Optional offline field: **How did you find us?** (ChatGPT, Google, Facebook, referral, existing customer, other)—must not overwrite stronger recorded attribution.

## 13. Conversion-action requirements

Exactly one primary human action per page. TradeScout default: **Start a Request**. Do not present five competing primary buttons. Preserve Direct Connect privacy gates.

## 14. Live production proof

Before treating a surface as discovery-complete:

1. Official domain returns correct content
2. Meaningful initial HTML without crawler-specific UA (§10)
3. Search-crawler and user-triggered surfaces receive fact-bearing responses consistent with §10
4. Visible facts + structured facts agree
5. Canonical URL correct
6. Present in sitemap; not blocked unintentionally
7. Protected routes remain blocked / noindex
8. Source tag survives visit → action
9. No private information leaked

Source tests alone are insufficient. Manual UA tests prove response shape only.

## 15. Rollback

Any discovery change that leaks private data, empties first-response facts for non-bot eligible fetches, or injects sitemap app-shells is rolled back immediately: revert the feature branch commit(s), restore prior robots/sitemap/HTML builders, and re-run §14 proof on the prior SHA.

## 16. Measurement standard

Success is not “indexed page count.” Funnel:

Eligible public page → verified crawler visit (classified by crawler role) → ChatGPT-tagged or other attributed human visit → entity/inventory view → primary action → accepted connection → completed outcome → measurable value

Report separately by brand, domain, entity type, and public address.

## 17. JW Stone reference fixture

Use current JW marketplace behavior as the expanded reference for:

- Public crawler access with server-retained SEO HTML for known bot UAs
- Stable category / stone addresses where implemented
- Consistent business identity
- Clear human action path

Do **not** claim every current marketplace feature caused the Aug 1–2 ChatGPT-tagged referral (marketplace reset was Aug 4). Do **not** claim GPTBot SSR, `llms.txt`, or JSON-LD alone caused the lead. Do **not** clone JW visual design onto other profiles.

See `docs/audits/PUBLIC_DISCOVERY_PHASE1_AUDIT_TRADESCOUT.md` for the causation classification and URL×UA evidence matrix.
