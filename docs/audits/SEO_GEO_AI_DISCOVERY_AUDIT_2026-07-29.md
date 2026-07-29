# TradeScout SEO / GEO / AI Discovery Audit — 2026-07-29

Status: local implementation audit on `agent/seo-discovery-236`.
Base: `origin/main` at `7513e970a14551b1f91aa9839878694c4f68bf32`.

This document is not publication, indexing, ranking, or deployment proof.
Discovery never grants contact, routing, ranking, or authority.

## Evidence classifications

- `corrected_local`: changed and validated in this uncommitted worktree.
- `policy_target`: documented intended behavior that still requires runtime or
  production proof.
- `enforced`: exact current automated proof executed in this worktree.

## Findings

| Surface | Classification | Exact evidence and result |
|---|---|---|
| Shared organization/service/business schema | `corrected_local` | `SEOHelmet.tsx` and `SEOLocalBusiness.tsx` no longer synthesize a phone number, social accounts, provider, nationwide service area, prices, payment methods, radius, credentials, address, or free-quote offer. Executed Organization and absent/partial/source-backed service and business generator tests JSON-parse their output. |
| Public schema origin | `enforced` | `structured-data-truth.contract.test.ts` executes hostile and invalid origins and requires `https://www.thetradescout.com`; localhost remains available for local development. |
| Custom-domain schema origin | `enforced` | Shared platform helpers never trust a browser host as mapped-domain authority. Profile-specific schema accepts only the explicit canonical business-profile URL returned by the server; mapped-domain discovery remains owned by the existing host-local renderer, robots, and sitemap contracts. |
| Direct Connect provider | `corrected_local` | `DirectConnectShell.tsx` explicitly supplies `provider: "TradeScout"` to the shared service generator. |
| HomeScout alias | `enforced` | Server middleware tests require GET and HEAD on mixed-case/trailing-slash `/homescout-listings` variants to return `308` with relative `Location: /exchange/real-estate`, preserving query state and ignoring hostile Host and forwarded-host/proto headers. Non-navigation methods pass through. The static sitemap generator and sitemap contract exclude this redirect-only alias. |
| HomeScout React canonical | `corrected_local` | The existing client route redirects `/homescout-listings` to `/exchange/real-estate`; the marketplace page now declares that same canonical URL. |
| Other audited SPA routes | `enforced` | Middleware tests require exact canonical paths to pass to the SPA, mixed-case/trailing-slash variants to normalize with `308`, query state to survive, and unrelated routes to pass untouched. |
| Initial HTML metadata for SPA-only routes | `policy_target` | The earlier local static fallback was removed because it competed with React-owned metadata and created unsupported static entity-browsing claims. No server canonical/schema is claimed for these SPA-only routes in this patch. |
| Robots, sitemap hierarchy, publication freshness, and crawler rendering | `policy_target` | Repository implementations exist, but this audit does not upgrade local file presence into production enforcement. Local sitemap integrity and build commands are recorded below. |
| Production ingestion and rich-result eligibility | `policy_target` | Requires post-deployment crawler, Search Console/Bing, and live-response evidence outside this no-external-mutation lane. |

## Existing-state evidence table

| Finding | Exact file or route | Current behavior | User/search impact | Recommended repair | Risk | Safe now |
|---|---|---|---|---|---|---|
| The repository already has a server-rendered discovery layer. | `server/index.ts`; `server/publicBusinessHtml.ts`; `server/publicProfileHtml.ts`; `server/publicTradeHtml.ts`; `server/publicCityHtml.ts`; `server/publicCountyHtml.ts` | Published profile, business, trade, city, county, best, recent, dataset, listing, service, product, group, and post routes have dedicated initial-HTML builders. | Real public records can be understood without treating TradeScout as a contractor-only SPA. | Keep these builders as the metadata/content owners for their routes; extend them rather than adding a second fallback system. | Competing owners can create duplicate canonicals/schema. | Yes; this patch removed the competing fallback attempted during review. |
| Several high-level product routes still use the generic SPA shell. | `/community-feed`; `/find-local-businesses`; `/direct-connect`; `/about` | React owns their route-specific metadata after boot; initial HTML retains the generic shell. | Non-JavaScript crawlers and link unfurlers may receive weaker descriptions than users see. | Add one shared, tested server/client metadata source before SSR is introduced. | High if server and React drift or duplicate JSON-LD. | No; deferred until ownership is unified. |
| The HomeScout marketplace had two canonical candidates. | `client/src/AppRoutes.tsx`; `client/src/pages/real-estate-marketplace.tsx`; `server/publicDiscoveryRouteNormalization.ts`; `scripts/generate-sitemap.mjs` | `/exchange/real-estate` is canonical; `/homescout-listings` is a GET/HEAD `308` alias; the redirect alias is excluded from the static sitemap. | Consolidates crawler signals and stops submitting a permanent redirect as a sitemap URL. | Retain compatibility routing; migrate prominent internal links separately after route-usage review. | Existing saved links and attribution code still refer to the alias. | Yes; redirect, canonical, generator, and contracts are in this patch. |
| Shared schema included facts not backed by a supplied record. | `client/src/components/SEOHelmet.tsx`; `client/src/components/SEOLocalBusiness.tsx` | Default phone/social accounts/provider/service area/prices/payment/radius/credentials/free-quote and address facts are removed; optional facts are omitted when absent. | Prevents search/AI systems from repeating invented business or platform claims. | Continue moving schema generation behind typed, source-backed records. | Some older unused generators may still contain promotional defaults and require call-site review. | Yes for the audited generators. |
| Public origin inference could trust arbitrary browser hosts. | `client/src/lib/canonicalPublicOrigin.ts`; custom-domain handling in `server/index.ts` and `server/publicProfileHtml.ts` | Shared platform schema is pinned to the TradeScout origin. Verified custom-domain pages keep explicit server-owned canonical, robots, sitemap, and `llms.txt` handling. | Prevents proxy/Host contamination without erasing authorized profile-domain canonicals. | Never infer custom-domain authority from `window.location`; pass a verified canonical URL. | A future caller could omit the explicit canonical field. | Yes; hostile-origin and custom-domain contracts cover the boundary. |
| Publication eligibility already exists for directory/geographic surfaces. | `shared/publication.ts`; migrations `0072` and `0073`; `server/services/seoPublicationPruneJob.ts`; `server/services/seoDirectoryScopeSnapshotJob.ts` | Crawlability requires public-discovery state, identity/location/trade inputs, freshness rules, and populated scope snapshots. | Avoids arbitrary location/keyword combinations and prunes stale records. | Treat these rules as the canonical eligibility model; do not generate thin combinations outside it. | Production scheduling and data state require separate runtime proof. | Existing system; no rule change in this patch. |
| Sitemap segmentation is extensive and data-gated. | `scripts/generate-sitemap.mjs`; `server/routes/profiles.ts`; `server/repositories/sitemapRepository.ts`; `/sitemap-index.xml` | Static core URLs and runtime profile, directory, HomeScout, Exchange, handmade-product, service-offer, best, recent, and trade-partner feeds are separated. | Lets crawlers discover multiple TradeScout product surfaces without one unbounded file. | Keep redirect aliases, private records, drafts, and unsupported last-modified values out. | The current guard checks target existence, not every production response. | Yes for the HomeScout alias exclusion; production response audit deferred. |
| Private and request surfaces have explicit index boundaries. | `client/public/robots.txt`; `server/index.ts` route `/r/:shareToken` | Robots disallows API/admin/dashboard/settings/messages/Scout/auth; shared Direct Connect request HTML adds `X-Robots-Tag: noindex, nofollow, noarchive`. | Discovery cannot become contact authority or expose a private request as a public result. | Add response-level production sampling for all private route families. | Robots is guidance, not authorization or data protection. | Existing behavior; no expansion in this patch. |
| AI-readable guidance exists at runtime, not as a static file. | platform `/llms.txt` registration in `server/routes/profiles.ts`; custom-domain `/llms.txt` in `server/index.ts`; `docs/TRADESCOUT_SEO_ARCHITECTURE.md` | Platform and mapped-profile guidance is generated from current server systems. | AI discovery can receive factual product and contact-gating context. | Validate the live response after deployment and keep claims derived from canonical configuration. | A repository file check alone cannot prove live content. | No external proof in this lane. |
| Community has public post/group renderers but the feed hub remains SPA-only. | `/community/posts/:postId`; `/group/:id`; `/community-feed` | Public, eligible details get route-specific initial HTML; feed metadata is client-owned. | Individual public community records are shareable, but hub discovery is weaker without JS. | Define feed publication eligibility and a single metadata owner before adding SSR. | Community visibility must never imply moderation consensus or contact access. | Detail system exists; hub repair deferred. |
| Products, services, inventory, and galleries use different proven public routes. | `/handmade/products/:id`; `/services/:offerId`; `/exchange/:category/:listingId`; `/u/:slug/:collection/:itemSlug`; mapped profile domains | Dedicated renderers use stored public records and exposure-authority gates; profile inventory/gallery items stay profile-owned. | Search systems can understand more than contractor listings while preserving owner context. | Extend existing renderers and sitemaps only for records with public authority. | Prices/availability can become stale and must not be inferred. | Existing system; schema cleanup is safe now. |
| No proven public event-detail indexing system was found. | `client/src/AppRoutes.tsx` exposes `/event-management`; no dedicated public event renderer or event sitemap was found in the audited route stack. | Event tooling exists as an operating surface, but this audit cannot identify an authoritative public event canonical. | Mass-indexing events now could expose drafts or create thin/expired pages. | Define public status, canonical route, expiry/noindex behavior, and sitemap gate before indexing events. | Privacy and stale-event risk. | No. |
| Internal HomeScout links still use the compatibility alias in multiple product files. | Examples: `client/src/pages/exchange.tsx`; navigation components; Scout actions; alerts/onboarding services | Users reach the right React page, and direct requests normalize to the canonical route. | Crawlers can encounter an extra redirect even though the sitemap is clean. | Migrate links in a separately tested route-consolidation slice, preserving analytics and saved-link behavior. | Broad route edits can break onboarding, attribution, and in-app active states. | Not in this bounded patch. |

## Public surface inventory

| Surface family | Representative canonical routes | Initial delivery | Index rule or current boundary |
|---|---|---|---|
| Platform | `/`, `/landing`, `/how-it-works`, `/for-businesses`, `/about` | Landing has a server builder; other static/product routes vary between static shell and React metadata. | Static core sitemap is curated, not generated from every `AppRoutes` entry. |
| Scout and Direct Connect | `/scout`, `/direct-connect`, `/r/:shareToken` | Scout is private/personalized; Direct Connect is SPA metadata; shared request has server HTML. | `/scout` is robots-disallowed. Shared requests are response-level `noindex`. |
| Profiles and business hubs | `/u/:slug`, `/p/:slug`, `/business/:slug`, verified mapped domain `/` | Dedicated server renderers and canonical redirect resolution. | Published/public authority and canonical-business routing decide exposure. |
| Profile collections, inventory, and galleries | `/u/:slug/:collection/:itemSlug`; corresponding mapped-domain suffix | Dedicated profile item/category render path. | Profile-owned public-discovery configuration; mapped host has its own sitemap/robots. |
| Businesses, trades, and geographic discovery | `/trade/*`, `/city/*`, `/county/*`, `/best/*`, `/datasets/*` | Server-rendered summaries and links. | Publication freshness plus populated snapshot scopes; no arbitrary keyword/location Cartesian product. |
| Community and groups | `/community-feed`, `/community/posts/:postId`, `/groups`, `/group/:id` | Detail routes have server metadata; feed/hubs are partly SPA-owned. | Public/active record checks on dedicated detail builders; broader hub eligibility remains a policy target. |
| Exchange and HomeScout | `/exchange`, `/exchange/:category`, `/exchange/:category/:listingId`, `/exchange/real-estate`, `/homescout/listings/:id`, `/homescout/:stateCode/:countyFips` | Dedicated Exchange, listing, HomeScout listing, and county builders; marketplace route is React-owned. | Exposure-authority gates protect submitted detail URLs. `/homescout-listings` is compatibility-only. |
| Products and services | `/handmade/products/:id`, `/services/:offerId`, profile collection items | Dedicated server renderers. | Active/public record plus owner exposure authority; schema emits only supplied facts. |
| Events and schedules | `/event-management` and other account tools | No authoritative public detail renderer identified. | Keep out of public sitemap until public status, expiry, and canonical ownership are defined. |
| Private operations | `/api/*`, `/admin/*`, `/dashboard/*`, `/messages/*`, `/settings/*`, `/auth/*` | Application/API surfaces. | Robots-disallowed; actual privacy depends on server authorization, not robots. |

## Canonical hierarchy observed locally

1. `/direct-connect` is the request workflow; contact remains gated by the
   product workflow.
2. Public entity pages own source-backed profile or listing facts.
3. Public discovery hubs organize publication-eligible records.
4. `/exchange/real-estate` owns the HomeScout marketplace; the legacy
   `/homescout-listings` route is a redirect-only alias.
5. Account, admin, messages, settings, API, and personalized Scout state must
   not become public metadata sources.

## Initial editorial briefs

These are review briefs, not publish-ready articles.

| Brief | Search intent and reader | Required TradeScout evidence | Internal links | Claims requiring review | Cannibalization risk | Recommended canonical |
|---|---|---|---|---|---|---|
| How Direct Connect works | A person or business deciding how a request and reply move through TradeScout. | Current Intent → Decision Card → Contact screens, privacy behavior, and the exact information exposed at each step. | `/direct-connect`, `/direct-connect-info`, `/privacy`, relevant public profile examples. | No sold leads; no forced multi-provider funnel; what contact data is or is not shown. | Existing Direct Connect product/info pages. Prefer improving the canonical page over duplicating it. | `/direct-connect-info` |
| How TradeScout differs from sold-lead marketplaces | Consumers and providers comparing business models. | Current ranking, routing, payment, and contact laws plus reviewed factual competitor sources. | `/compare`, `/compare/lead-generation`, `/trust-model`, `/direct-connect`. | Every competitor statement, price, ranking, distribution, or superlative. | Existing comparison routes. Consolidate into their established hierarchy. | `/compare/lead-generation` |
| Find local businesses without distributing one inquiry to multiple sellers | A consumer seeking local help without a quote-auction flow. | Current Scout discovery and Direct Connect request behavior; representative eligible business/profile routes. | `/find-local-businesses`, `/direct-connect`, `/trade`, eligible location pages. | Do not say “lead-free”; do not imply that every business is verified or available. | May overlap Direct Connect and local-business comparison pages. | `/find-local-businesses` |
| How businesses control profiles and connections | Business owners evaluating their public presence and request workflow. | Profile editing/publication controls, services/products/inventory modules, custom-domain behavior, and Direct Connect controls. | `/for-businesses`, `/businesses/apply`, public profile examples, `/direct-connect-info`. | Ownership, availability, verification, custom-domain, price, and notification claims. | Existing for-business and application pages. | `/for-businesses` |
| How TradeScout communities organize local businesses, resources, and events | Community members and administrators learning the community model. | Current public feed/group/post capabilities, geographic rules, moderation and event publication state. | `/community-feed`, `/groups`, eligible public groups/posts, `/trust-model`. | Do not imply consensus, endorsement, complete event coverage, or moderator authority. | Existing community comparison and feed copy. | `/compare/community` until a canonical public community explainer exists. |

## Search Console and webmaster steps requiring Thomas

1. After an authorized deployment, inspect the exact live build header and
   representative initial HTML before submitting anything.
2. In Google Search Console, inspect the canonical platform domain, submit the
   canonical sitemap index, and sample the homepage, a business profile, a
   geographic page, a service/product detail, an Exchange listing, and a
   HomeScout detail page.
3. Confirm that `/homescout-listings` is reported as a redirect and
   `/exchange/real-estate` as canonical; do not request indexing for the alias.
4. Review excluded/noindex results for private, stale, draft, and shared-request
   routes. Do not “fix” intended exclusions.
5. In Bing Webmaster Tools, confirm domain ownership, sitemap ingestion, and
   IndexNow key configuration. IndexNow submission success is discovery
   notification, not indexing proof.
6. Record results over time by exact deployed commit. Do not claim traffic,
   ranking, rich-result, or ingestion improvement from local tests.

## Inherited live evidence

The parent packet reported live GET `200` responses on build `7513e970` for
`/`, `/robots.txt`, `/sitemap-index.xml`, `/sitemap.xml`, `/llms.txt`,
`/community-feed`, `/find-local-businesses`, `/exchange`, and
`/homescout-listings`. It also reported the homepage canonical as `/landing`.
Those observations were not re-run in this local-only lane and are not claimed
as current production proof.

## Local command evidence

Commands and final results, with their boundaries:

- `npx vitest run` on the eight corrected metadata, sitemap, redirect, profile,
  landing, and app-shell files: **PASS**, 8 files / 65 tests.
- `npm run check`: **PASS**.
- `npm run build`: **PASS**, 72 static sitemap URLs, 3,951 Vite modules,
  539 JavaScript bundles plus 5 HTML asset references, and successful server
  bundle. Existing Browserslist-age and Tailwind duration warnings remain.
- `npm run guard:sitemap-integrity`: **PASS**, 15 sitemap-index targets.
- `npm run test:direct-connect:gates`: **PASS**, 28 / 28.
- `npm run test:run`: **PASS**, exit 0. Console output was truncated, so this
  audit does not invent an aggregate file/test count.
- `npm run verify:local`: **STOPPED** after forbidden-pattern and law-drift
  passed. The unchanged baseline architecture guard reports
  `server/routes.ts` at 1,035,131 bytes, 256 bytes over its 1,034,875-byte
  ceiling. This branch does not modify `server/routes.ts`; later aggregate
  stages therefore did not run inside this command, but their relevant
  standalone commands are recorded above.
- `git diff --check`: **PASS**.
- Prettier on all new implementation, test, and audit files: **PASS**.
  Repository-wide formatting was not rewritten; two touched legacy files
  (`scripts/generate-sitemap.mjs` and `server/index.ts`) retain their existing
  non-Prettier style to avoid unrelated churn.

Build-generated sitemap-index date changes were restored. The only intentional
generated sitemap change is removal of the redirect-only HomeScout alias.

## Remaining risks

- SPA-only initial metadata still depends on client execution. Adding SSR
  requires one shared route metadata owner or exact boot-time replacement tests;
  a competing fallback is not acceptable.
- The homepage `/` versus `/landing` policy is unchanged and needs a separate
  canonical/redirect decision.
- Dependency audit findings, production bot HTML, scheduler execution, indexing,
  and rich-result eligibility remain outside this bounded lane.
- `robots.txt` is crawler guidance, not access control.
