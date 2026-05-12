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

## What Changed In This Pass

- The normal Scout home now exposes a real capability map before chat starts.
- Active Scout answers now add a "Full Scout view" result layer so users see planning, materials, prices, local help, trust checks, and alternatives after a query.
- Material/supplier-style queries now get a dedicated "Materials and local options" result card with Supply Run, local supplier, Exchange material, and product comparison paths.
- Supplier links now carry into `/utilities/supply-run/new` as a prefilled URL so the Supply Run product resolver can read the link instead of making the user paste it again.
- Supplier links in Scout now get a fast product snapshot attempt inside the active result card; if the page cannot be read quickly, Scout says so and still preserves the link for Supply Run review.
- Price/trend-style queries now get a "Price and trend checks" result card that opens the materials view, nearby activity, or a Scout price-factor check.
- Client/customer work now gets a "Client job prep" card that keeps scope, quote prep, invoices, and approval boundaries separated.
- Saved conversations now carry quiet intent, county/state, and related-view metadata so users can search old Scout work and jump back into the relevant TradeScout surface.
- The cards are action prompts, not fake dashboards.
- User-facing copy avoids internal tags such as LISA, routing, validators, and tool names.
- Saved conversations are described honestly instead of calling the feature a full Vault.

## Fastest Next Work

1. Add production checks that every showcase capability has either a real user surface or a documented blocked state.
2. Add richer source-backed price/trend cards from county metrics, community activity, and material snapshots.
3. Expand saved conversation recall into project, home, vehicle, and client records when those destination surfaces expose stable IDs.
