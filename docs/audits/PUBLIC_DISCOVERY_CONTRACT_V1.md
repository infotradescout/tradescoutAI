# Public Discovery Contract v1

**Status:** draft on feature branch (not merged, not deployed)  
**Owner surface:** TradeScout governance; JW Stone is the reference fixture for business + public inventory, not a universal visual template.  
**Authority:** Connection Without Compromise; primary TradeScout public action remains **Start a Request**.  
**Date:** 2026-08-07

## 1. Purpose

Standardize the working public-discovery pattern proven by real acquisition (JW Stone via ChatGPT referral → return visit → inventory review → call) across eligible TradeScout public surfaces—and document the same contract language for sibling brands without mixing data models.

## 2. Public eligibility

A page may be indexed / offered to search and retrieval crawlers only when all are true:

1. The entity is **owner-approved or platform-verified** for public exposure (not thin import-only).
2. Facts are **sourced from verified profile / inventory / listing data**—never guessed cities, services, prices, or inventory.
3. The official public domain returns **HTTP 200** with the correct content type.
4. The **first server response** contains useful identity facts (see §4)—not an empty application shell for crawler user-agents.
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

**Hard failure:** crawler or `llms.txt`-eligible fetch receives only `<div id="root"></div>` (or equivalent empty shell) with no entity facts.

Human SPA hydration may continue after a complete first response; it must not be the only place identity exists for crawlers.

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

## 8. Sitemap rules

- Sitemaps list only eligible successful canonical pages
- Sitemap responses MUST be XML (`application/xml` or equivalent)—never an application shell
- No private, thin, placeholder, duplicate, soft-404, or login pages
- Profile / inventory / listing inclusion requires eligibility (§2)

## 9. Crawler rules

Publish:

1. Public allow routes (profiles, inventory, directory, eligible listings)
2. Disallow for private routes
3. Valid sitemap pointer(s)
4. Canonical host policy (`llms.txt` and robots)
5. **Separate** search-discovery vs training-crawler decisions when product policy requires it (document explicitly per bot)

Verified crawler traffic (signed / known UA + behavior) must be distinguished in telemetry from spoofed UA claims.

## 10. Freshness

Eligible pages SHOULD expose last-verified or last-updated. Stale thin pages lose eligibility until refreshed or noindexed.

## 11. Attribution requirements

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

## 12. Conversion-action requirements

Exactly one primary human action per page. TradeScout default: **Start a Request**. Do not present five competing primary buttons. Preserve Direct Connect privacy gates.

## 13. Live production proof

Before treating a surface as discovery-complete:

1. Official domain returns correct content
2. Crawler UA receives successful fact-bearing response
3. Visible facts + structured facts agree
4. Canonical URL correct
5. Present in sitemap; not blocked unintentionally
6. Protected routes remain blocked / noindex
7. Source tag survives visit → action
8. No private information leaked

Source tests alone are insufficient.

## 14. Rollback

Any discovery change that leaks private data, empties first-response facts for crawlers, or injects sitemap app-shells is rolled back immediately: revert the feature branch commit(s), restore prior robots/sitemap/HTML builders, and re-run §13 proof on the prior SHA.

## 15. Measurement standard

Success is not “indexed page count.” Funnel:

Eligible public page → verified crawler visit → ChatGPT-tagged human visit → entity/inventory view → primary action → accepted connection → completed outcome → measurable value

Report separately by brand, domain, entity type, and public address.

## 16. JW Stone reference fixture

Use current JW marketplace behavior as the expanded reference for:

- Public crawler access with SSR for known bots
- Stable category / stone addresses where implemented
- Consistent business identity
- Clear human action path

Do **not** claim every current marketplace feature caused the Aug 1–2 ChatGPT referral (marketplace reset was Aug 4). Do **not** clone JW visual design onto other profiles.
