# Scout 2 Catch-Up Matrix

Date: 2026-05-12
Owner: TradeScout product/engineering
Scope: Scout 2 showcase claims compared against the live TradeScout Scout surface.

## Reality Check

The Scout 2 showcase is the visual and product direction. The live `/scout` surface must only claim what TradeScout can honestly support today. The catch-up work is to expose the abilities that already exist, harden the partial systems, and avoid public claims for features that still need live data, storage, or integrations.

## Feature Matrix

| Showcase capability | Live state | Production surface | Catch-up action |
| --- | --- | --- | --- |
| Manage projects | partial | Scout context cards, Direct Connect drafts, project tracker | Keep surfacing project planning from Scout; expand saved project continuity. |
| Find local pros | enforced with gates | Direct Connect, saved contractors, local help actions | Keep contact gated through Intent -> Decision Card -> Contact. |
| See local activity | enforced | Community feed, Scout home snapshot, local prompts | Show local posts/projects/events as a Scout path before chat starts. |
| Browse Exchange | enforced | `/exchange` and category pages | Surface materials and marketplace paths from Scout without implying purchase or contact. |
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

## What Changed In This Pass

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

## Fastest Next Work

1. Add API-backed saved-conversation label refresh once project, home, vehicle, and client summary endpoints expose stable display names for Scout.
2. Add freshness/last-updated UI treatment for county price signals so users can see when each snapshot was computed.
