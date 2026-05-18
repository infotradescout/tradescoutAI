# Scout 2 Catch-Up Matrix

Date: 2026-05-12
Owner: TradeScout product/engineering
Scope: Scout 2 showcase claims compared against the live TradeScout Scout surface.

## Reality Check

The Scout 2 showcase is the visual and product direction. The live `/scout` surface must only claim what TradeScout can honestly support today. The catch-up work is to expose the abilities that already exist, harden the partial systems, and avoid public claims for features that still need live data, storage, or integrations.

## Feature Matrix

| Showcase capability | Live state | Production surface | Catch-up action |
| --- | --- | --- | --- |
| Opportunity Radar | policy target | Scout home, local map/feed surfaces, county intelligence cards | Reframe local discovery around governed "moves" instead of directory browsing; every move must be sourced from precomputed county intelligence or a documented temporary exception. |
| Move Feed | policy target | Scout result cards, map pins, local action trays | Show opportunity cards with why it matters, guarded contact path, suggested next action, and source/confidence context. |
| Manage projects | partial | Scout context cards, Direct Connect drafts, project tracker | Keep surfacing project planning from Scout; expand saved project continuity. |
| Find local pros | enforced with gates | Direct Connect, saved contractors, local help actions | Keep contact gated through Intent -> Decision Card -> Contact. |
| See local activity | enforced | Community feed, Scout home snapshot, local prompts | Show local posts/projects/events as a Scout path before chat starts. |
| Browse Exchange | enforced | `/exchange` and category pages | Surface materials and marketplace paths from Scout without implying purchase or contact. |
| HomeScout | partial | `/homescout-listings`, Home Vault, inspection/listing routes | Tie listing, inspection, sell-flow, and saved home context into Scout without exposing contact from discovery. |
| Community Vault | partial | `/foundation`, Community Builder routes, vault APIs | Show reinvestment and transparency paths without implying payouts, paid ranking, or lead selling. |
| Finance/bookkeeping tools | partial | `/finances`, invoices, expenses, records, reports, materials, job flows | Route to today's finance tools honestly while documenting that full bookkeeping still needs a rebuild. |
| Direct Connect | enforced | `/direct-connect` | Scout can draft and prefill; user reviews before sharing. |
| Trend Engine | partial | county metrics, community signals, pricing/material pages | Use plain "Prices and trends" copy until source-backed trend cards are complete. |
| Synthesis 2.0 | partial | Scout answer discipline, next-step cards, source/confidence hooks | Present as "Compare options"; avoid claiming full conflict reconciliation until source UI is complete. |
| LISA/routing tags | internal only | intent sorting, action cards, server metadata | Keep tags out of public UI; use them to improve card selection. |
| Scout Vault | partial | saved Scout conversations, local and remote persistence | Public copy should say "Saved conversations" until full Vault history/search exists. |
| Trust / confidence | enforced for contact boundaries, partial for every answer | Trust/CVS, Direct Connect gating, decision cards | Show "Trust checks" and keep all contact/payment actions approval-gated. |
| Decision cards | enforced in contact/action paths | Scout next steps, community CTA, Direct Connect guardrails | Keep decision paths visible; do not let chat imply hidden writes. |
| Supply/material runs | enforced for start flow, policy target for direct supplier APIs | `/utilities/supply-run`, procurement routes | Use exact honest copy: send a material list or supplier link and Scout can help turn it into a Supply Run. |

## Competitive Adoption Map

Scout should copy proven interaction patterns, not competitor business models. The product target is the best practical local action layer: answer enough to orient the user, then show clear paths that preserve Trust/CVS, county context, and contact gates.

| Existing pattern | What to adopt | What TradeScout improves | Scout rule |
| --- | --- | --- | --- |
| Angi / HomeAdvisor | Fast service-request intake from plain language. | No lead selling, no paid exposure ranking, clearer approval before sharing. | Scout may draft a request, but contact stays gated until user approval. |
| Thumbtack | Ask only the details needed to match the job. | Do not trap users in a form; show likely paths and let them continue in chat or app views. | Low confidence expands options; high confidence narrows options. |
| Yelp | Summarize local signals so users do not read every review/post. | Tie summaries to TradeScout actions, saved context, and county surfaces. | Chat is a short summary; cards carry the real next steps. |
| Google Local Services Ads | Trust badges and verification make users feel safer. | Trust/CVS governs exposure without pay-to-play placement. | Trust language must explain checks without implying paid rank. |
| Houzz / Houzz Pro | Project planning, materials, estimates, and visual/job context belong together. | Bring materials, Supply Run, Exchange, Direct Connect, and saved Scout conversations into one flow. | Every project-like answer should consider expectation, required checks, feasible paths, materials, price, and local help. |
| Taskrabbit / AI app connectors | AI can hand off to a booking/action surface when the task is narrow. | Scout should keep work on-page by default and route only when useful or requested. | Default action is embedded/drafted; never imply booking, ordering, messaging, invoicing, or payment without approval. |

## Opportunity Radar Concept

Opportunity Radar is the preferred interface layer for Scout-led local discovery. TradeScout should not feel like a static business directory. It should feel like a live operating view that shows where useful local moves may exist, why they matter, and what governed action path comes next.

Opportunity Radar is a Scout and Maps presentation layer, not a new authority engine. It may visualize local opportunity signals, but it must preserve these law classifications:

| Law statement | Classification | Product rule |
| --- | --- | --- |
| Visibility does not equal access. | enforced | A visible pin or card must not expose direct contact details or grant power to message, book, quote, pay, publish, or broadcast. |
| All contact is gated through Intent -> Decision Card -> Contact. | enforced | "Who to contact" means a guarded candidate or action path; contact still requires user intent and a Decision Card. |
| Counties are operational containers. | enforced | Opportunity signals must resolve to county context and should read from `county_metrics`, `county_entities`, and `county_notes` where available. |
| Trust/CVS governs exposure. | enforced | Businesses, listings, posts, and other exposed entities must pass CVS eligibility before appearing in radar cards or map pins. |
| Admin/UI reads precomputed intelligence. | policy_target | Radar signals should be precomputed into county intelligence; read-time derivation is allowed only as a documented temporary exception with owner and removal date. |
| No pay-to-play; no lead selling. | enforced | Radar ranking must not be sold placement, lead resale, or contact access. Paid surfaces must remain visually and semantically separate. |

### Move Types

The Radar should surface "moves," not raw businesses:

| Move type | User-facing example | Intelligence basis | Guardrail |
| --- | --- | --- | --- |
| Underserved area | "High demand, weak provider coverage." | Demand signals compared with eligible provider/service coverage by county or service area. | Do not imply exact demand volume unless sourced and fresh. |
| Weak competitor | "This business ranks high but has poor review signals." | Search/reputation/coverage signals, governed by source and confidence labels. | Avoid defamatory copy; present as an audit opportunity with evidence. |
| Fast-win prospect | "This company has no website but strong offline presence." | Business profile, public web presence, platform/community activity, and source-backed offline indicators. | Do not expose private contact or imply outreach happened. |
| Partnership target | "This business serves your same customer but does not compete." | Category adjacency, customer overlap, county/service context, and CVS-eligible entity data. | Partnership drafts must route through approval-gated messaging. |
| Acquisition target | "Owner-operated, stale branding, high local demand." | Business age/profile signals, branding/web freshness, local demand, and source confidence. | Avoid sensitive personal inference unless explicitly sourced and allowed. |
| Service gap | "People nearby are searching for this, but few businesses offer it." | County search/demand signals and eligible supply coverage. | Keep as market context until supply/demand facts are precomputed. |

### Move Feed Shape

The main screen should prioritize a Move Feed with a map companion, not a search-first directory. Each row or card should answer: what move, why it matters, and what governed action Scout can prepare.

| Move | Why it matters | Action |
| --- | --- | --- |
| "Call these 5 roofers" | No online booking and poor follow-up signals. | Generate pitch through a Decision Card before any contact. |
| "Launch lawn cleanup offer here" | Seasonal demand rising and low eligible competition. | Build offer and preview where it can appear. |
| "Partner with this realtor" | Serves homeowners before service-provider decisions. | Draft message for review. |
| "Audit this business" | Weak GBP/profile signals and high local search demand. | Create report with source/confidence context. |

### Killer Interaction

When a user taps a pin or card, Scout should open a focused move detail:

- Why this matters.
- Who or what is eligible to review next.
- What Scout suggests saying or building.
- Expected upside, labeled as an estimate when not proven.
- Source, confidence, county, and freshness context.
- The next guarded action: generate pitch, build offer, draft message, create report, save project, or contact when ready.

The intended feeling is: "Show me where money is hiding locally," while the operational contract remains: Scout prepares the path, Trust/CVS governs exposure, and contact/action gates still decide what can happen.

## What Changed In This Pass

- Added Opportunity Radar as the preferred Scout discovery interface concept: a map/feed of governed local moves rather than a directory of businesses.
- Added Move Feed requirements so opportunity cards show the move, why it matters, guarded action, source/confidence context, and county freshness.
- Recorded Radar law classifications for contact gating, county containers, precomputed intelligence, Trust/CVS exposure, and no lead-selling/pay-to-play drift.
- Scout home snapshot now exposes an `opportunityMoves` field built only from `county_metrics` rows, keeping Radar signals precomputed and source-labeled.
- Scout home now renders an Opportunity Radar feed when real county move signals exist, with each card routing back into Scout prompts instead of direct contact.
- Active Scout answers now receive `opportunityMoves` from the home snapshot and can render an Opportunity Radar result card that explains source-backed moves without exposing contact.
- `docs/reference/scout/OPPORTUNITY_RADAR_CONTRACT.md` now records the Radar authority boundary, move shape, current `county_metrics` projection, and future expansion rules.
- The normal Scout home now exposes a real capability map before chat starts.
- Active Scout answers now add a "Full Scout view" result layer so users see planning, materials, prices, local help, trust checks, and alternatives after a query.
- The Full Scout view now reflects the competitive adoption map: intake, local summaries, trust, materials, project continuity, and approval-gated action.
- Active result cards now use real Scout home snapshot signals when available: active Exchange listings, verified pros, community count, events, local trend prompts, and recent Scout activity.
- Material/supplier-style queries now get a dedicated "Materials and local options" result card with Supply Run, local supplier, Exchange material, and product comparison paths.
- Supplier links now carry into `/utilities/supply-run/new` as a prefilled URL so the Supply Run product resolver can read the link instead of making the user paste it again.
- Supplier links in Scout now get a fast product snapshot attempt inside the active result card; if the page cannot be read quickly, Scout says so and still preserves the link for Supply Run review.
- Price/trend-style queries now get a "Price and trend checks" result card that opens the materials view, nearby activity, or a Scout price-factor check.
- Client/customer work now gets a "Client job prep" card that keeps scope, quote prep, invoices, and approval boundaries separated.
- Saved conversations now carry quiet intent, county/state, and related-view metadata so users can search old Scout work and jump back into the relevant TradeScout surface.
- Saved conversation recall now scans primary and secondary card actions, recognizes project/client/home/vehicle IDs from routes and payloads, and can reopen stable home and vehicle records through query-linked vault pages.
- Saved conversation related labels now prefer available payload display names, home address fields, and vehicle year/make/model details before falling back to raw IDs.
- The cards are action prompts, not fake dashboards.
- User-facing copy avoids internal tags such as LISA, routing, validators, and tool names.
- Saved conversations are described honestly instead of calling the feature a full Vault.
- Unsupported action language claims are now rewritten before reaching users, and response tests now enforce approval-boundary language when a message implies Scout completed messaging, booking, payment, or posting actions.
- Competitor-pattern regressions now cover form traps, lead-selling copy, paid-ranking copy, and unsupported action claims.
- Price and trend cards now receive precomputed county price signals from `county_metrics` when available, including HomeScout median price, price drops, days-on-market, active TradeDeals, recent deal claims, completed-job count, and median completed-job receipt amount.
- Completed-job price intelligence now has a scheduled snapshot job that writes 30-day issued receipt facts into `county_metrics` by the creator's canonical county; Scout home price-signal tests guard against UI read-time pricing/job-document derivation.
- Completed-job price snapshots now have a manual backfill command (`npm run snapshot:completed-job-prices`) and ops runbook (`docs/runbooks/completed-job-price-snapshots.md`).
- Scout now shows county price-signal freshness from `county_metrics.updated_at` on the home surface and active price/trend cards, including an explicit unavailable state when a snapshot lacks a usable timestamp.
- Saved Scout conversations now refresh related labels from owned homes, vehicles, commercial projects, and accounting clients when the conversation API loads or saves a thread, while keeping the existing metadata storage shape.
- Admin observability now groups county price snapshot freshness by HomeScout, TradeDeals, and completed-job metric families from `county_metrics`, including tracked county counts and stale county counts.
- Admin observability now gives the completed-job county price family a protected manual refresh action that runs the same snapshot job as `npm run snapshot:completed-job-prices`.
- Admin observability now gives every county price signal family a protected manual refresh action with job-level advisory locks, and `docs/runbooks/county-price-signal-snapshots.md` records the operator path.
- Saved Scout conversations now recognize Home Vault project deep links as `/homes?homeId=...&projectId=...`, refresh labels from owned `home_projects`, and visibly highlight the linked project on the Home Vault page.
- Scout price-signal cards now show source and confidence context so users can distinguish HomeScout inventory, TradeDeals activity, and first-party completed-job receipt facts without opening an internal dashboard.
- Saved Scout conversations now support related-surface filters for projects, homes, vehicles, clients, materials, and prices on both the Scout UI and the server list endpoint.
- Active Scout price/trend answers now promote price-signal source/confidence context into the evidence strip by adding HomeScout, TradeDeals, and completed-job source titles to response provenance.
- Active Scout answers now include explicit bridges into Community, Exchange, HomeScout/Home Vault, Community Vault/Foundation, and finance/bookkeeping tools, with approval-boundary copy for listings, contact, invoices, payments, and the unfinished bookkeeping rebuild.
- Fixed-price profile offers now have a first backend/UI bridge: service purchases from a profile create guided Scout work requests and seller accounting-review events; item purchases create receipt, shipping/fulfillment, and seller accounting-review records without releasing contact or moving money automatically.
- Provider onboarding now routes into a launch hub that checks public profile, business profile, fixed-price offers, verification, and finance records instead of treating profile setup as a standalone form.
- Post-onboarding Scout action cards now send service/seller users to `/offer-services`, fixed-price offer setup, and finance records so setup continues into the operational tools.
- The provider launch hub now supports creating, editing, pausing, and resuming fixed-price service/item offers with service duration/category, item stock/SKU, fulfillment mode, shipping cost, and seller purchase-review status.
- Public profile item purchases now capture buyer quantity and shipping details when required, show stock and total-for-review context, and keep the no payment/contact/posting/shipping boundary visible.
- Fixed-price item offers are now findable through Exchange discovery, category/detail routes, server-rendered Exchange SEO metadata, and the Exchange listing sitemap as `profile-offer-*` URLs while purchase/review still routes back through the gated profile-offer flow.
- Seller review now has first fulfillment actions for profile item purchases: confirm order, mark paid, ready for pickup, shipped, delivered, cancelled, and refunded. Each action updates the purchase/receipt review state and creates an accounting automation event without releasing contact, moving money, or bypassing posting review.
- Fixed-price item offers now carry product-quality metadata through the existing JSON field: item/Exchange category, tax category, image URLs, fulfillment policy, and return policy. Public profiles show the richer product cards, Exchange SEO emits these details as Product JSON-LD properties, and item receipts/accounting proposals keep the tax/fulfillment context.
- Buyers and sellers now have a protected profile purchase status page at `/profile-purchases/:id` with order, payment, fulfillment, tracking, receipt, policy, and review-boundary context. Item buyers are routed there after purchase, and sellers can open the same order from the launch hub.
- Profile purchase status now supports purchase-scoped order updates between buyer and seller. The endpoint only allows purchase participants, stores structured order messages, and blocks phone numbers, email addresses, URLs, off-platform contact, payment instructions, and other contact-leak attempts before messages are saved.
- TradeScout monetization is now codified as a flat `$1.00` TradeScout transaction fee on every on-platform purchase, now and in the future. Buyer totals, receipts, order status, seller queues, procurement/inspection checkout metadata, accounting metadata, and the profile-offer purchase table keep seller subtotal separate from platform fee revenue, reinforcing that TradeScout makes money from transactions instead of selling access, leads, or paid ranking.
- Business profile/tool language is now being genericized for any business, not just contractors. The first pass updates `/for-businesses`, provider profile setup, the business owner dashboard, fixed-price offer launch hub, generic `/businesses/apply` and `/business-dashboard` aliases, primary/provider nav, nav preferences, admin tool labels, guest gates, role selection, older help/onboarding/tour copy, SEO defaults, footer/legal copy, and a legacy naming migration plan while documenting legacy contractor route/table names as compatibility exceptions in `docs/audits/BUSINESS_PROFILE_GENERICIZATION_AUDIT.md`.
- Business-provider API aliases are now the preferred path for search and Direct Connect targeting. Clients use `/api/business-providers/search` and `targetProviderIds`, while legacy `/api/providers/search`, `/api/contractors/top`, and `targetContractorIds` remain compatibility handles so old links and stored workflows do not break.
- Business-provider capability helpers now sit above legacy role names. Shared helpers identify business/provider tool access across `business_owner`, `contractor_user`, accelerator, helper, realtor, vehicle, insurance, and mortgage roles; server provider gates and primary navigation can ask for business-provider capability without hard-coding only `contractor_user`.
- Generic business routes are now preferred at the route layer: `/businesses/apply`, `/business-dashboard`, and `/business/requests` render the live surfaces, while legacy contractor URLs redirect to those canonical paths.
- Admin business-provider settings now prefer `/admin/business-provider-settings` and `/api/admin/business-provider-settings`, while legacy `/admin/contractors`, `/admin/contractor-settings`, and `/api/admin/contractor-settings` remain compatibility aliases.
- Business/provider navigation, onboarding fallbacks, regional application links, and dashboard/request links now prefer `/business-dashboard`, `/businesses/apply`, and `/business/requests` while preserving legacy compatibility aliases.
- Legacy business-tool dashboard labels, request verification prompts, profile creation prompts, and broad local-help CTAs now use generic business/provider language; explicit contractor SEO and compatibility surfaces remain documented migration exceptions.
- Remaining contractor-language surfaces are now classified: county SEO and public contractor-profile URLs stay temporary exceptions, comparison CTAs and legacy tool access copy use generic local-help/business-provider language, and the recommendation generator now checks business-provider capability instead of only `contractor_user`.
- County SEO pages now split explicit contractor keyword targeting from visible local-help action copy: FAQ/metadata can still serve "contractors near me" intent, while coverage CTAs, Direct Connect headings, and community copy use local provider/business language.
- Public contractor profile compatibility now has a first canonical bridge: `/api/contractors/:slug` returns `/business/:slug` when a public business profile exists, and the legacy client redirects there while using generic provider fallback copy.
- Provider discovery links now prefer canonical `/business/:slug` URLs where available: top-provider results expose `canonicalBusinessProfileUrl`, trust-match cards and shared provider cards use it, and Scout provider-search tool results preserve canonical profile links.
- Public profile recommendation directories now carry `canonicalBusinessProfileUrl` for recommended providers when available, so recommendation badges link to `/business/:slug` before falling back to legacy `/contractors/:slug`.
- Older SEO helpers now accept canonical `/business/:slug` profile URLs before falling back to `/contractors/:id`, and their structured-data copy uses local provider language where the surface is not explicitly contractor SEO.

## Fastest Next Work

1. Expand Opportunity Radar beyond `county_metrics` only after `county_entities` and `county_notes` use has CVS/source/freshness handling.
2. Define the `county_entities` and `county_notes` source/freshness/CVS contract needed before Opportunity Radar can expand beyond `county_metrics`.
