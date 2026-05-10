# Scout Abilities Audit

Date: 2026-05-10
Owner: TradeScout product/engineering
Scope: Scout normal user surface, action execution, embedded work areas, Supply Run adjacency, and contact/payment guardrails.

## Executive Summary

Scout is already more than a chat box. It can answer, classify intent, show context-aware cards, open embedded work areas, prefill drafts, save approved profile updates, follow/unfollow users, send approved admin broadcasts, open notes, record ad feedback, and route users to payment or checkout pages.

Normal user Scout and homeowner Scout are the same public surface. "Homeowner" can describe a user need, but it is not a separate Scout mode.

The product law is mostly preserved, but the abilities contract needed tightening. Before this audit, some UI labels implied an action while the actual destination was wrong or blocked by validation. Those gaps are fixed in this pass:

- Supply Run cards now open `/utilities/supply-run` instead of the non-user route `/procurement`.
- Invoice and active-project tile variants now open the correct workspace instead of keeping the default Exchange action.
- Messages explicit navigation now opens `/messages`.
- The client action validator now recognizes the real Scout-owned abilities: `CALL_TOOL`, `/homes`, `/vehicles`, `/messages`, `/conversations`, and Supply Run routes.
- Unified Scout routing now knows Supply Run as a first-class destination.

## Law Reality

| Law statement | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Visibility does not equal access | enforced | Messaging/contact explainers and Direct Connect flow keep contact gated until a request/match state exists. | Continue regression testing against Direct Connect. |
| Intent -> Decision Card -> Contact | enforced | Scout can draft/prefill and open workspaces, but contact/send actions require explicit approval and server guard checks. | Agentic actions must keep approval copy visible. |
| No pay-to-play, no lead selling | enforced | Scout payment actions are intercepted and converted to navigation only. | Scout never completes payment. |
| Scout is the guided bridge from discovery to action | enforced | ScoutOS embeds work areas and keeps action cards on-page. | Default auto-route remains off. |
| Trust/CVS governs exposure | policy_target | Server router has trust-aware routing hooks; not every local card proves CVS exposure checks because many cards only open workspaces. | Contact/exposure surfaces must keep Trust/CVS as the source of truth. |
| Counties are operational containers | policy_target | Scout passes locality/county hints to the server and reads county-aware context, but local cards can open generic workspaces. | County write paths must remain owned by the destination workflow. |
| Never remove features; fix and harden | enforced | This pass corrected routing/action mismatches without removing Scout abilities. | Keep contract tests growing. |

## Ability Inventory

| Ability | User-facing behavior | Execution path | Current status |
| --- | --- | --- | --- |
| Answer/help | Scout answers regular user, contractor, community, and marketplace questions. | `POST /api/scout` plus client sanitizers. | enforced |
| Context cards | Shows query-related project, home, vehicle, saved-pro, Supply Run, and nearby activity cards. | `buildScoutContextCards`. | enforced |
| Embedded workspace | Opens safe app work areas inside Scout. | `maybeOpenWorkAreaForRoute`. | enforced |
| Explicit navigation | User can ask to open a workspace. | `resolveExplicitNavigationIntent`. | enforced |
| Draft local request | Scout can prefill Direct Connect request details. | `PREFILL_INPUT` to `/direct-connect?...source=scout`. | enforced |
| Draft Exchange listing | Scout can prefill an Exchange sell flow. | `PREFILL_INPUT` to `/exchange?tab=sell...`. | enforced |
| Draft community post | Scout can prefill a community compose flow. | `PREFILL_INPUT` to `/community?compose=1...`. | enforced |
| Save profile update | Scout can save approved profile/preference fields. | `SAVE_PROFILE` through `/api/scout/execute-action`. | enforced |
| Follow/unfollow | Scout can follow or unfollow a user after approval. | `FOLLOW_USER`, `UNFOLLOW_USER`. | enforced |
| Admin broadcast | Scout can send an approved admin broadcast for admin roles. | `SEND_ADMIN_BROADCAST` through server guard. | enforced |
| Open note | Scout can open floating notes. | `OPEN_FLOATING_NOTE`. | enforced |
| Ad feedback | Scout can mark an ad helpful/not relevant/spam. | `CALL_TOOL` name `ads.feedback`. | enforced |
| Payments | Scout can open payment-related pages. It cannot pay. | Payment actions intercepted by `isPaymentExecutionAction`. | enforced |
| Supply Run | Scout can open Supply Run from material/supplier queries. | `/utilities/supply-run`. | enforced |
| Supplier ordering | Scout can help start the Supply Run flow; live supplier quote/order work happens in Procurement pages and server routes. | `server/routes/procurement.ts`. | enforced for TradeScout-managed order requests; policy_target for direct supplier API checkout. |

## What Scout Must Not Claim

Scout must not claim it can:

- Pay, charge, refund, or complete checkout.
- Message, contact, publish, send quotes, send invoices, or broadcast without explicit approval.
- Bypass Direct Connect contact gating.
- Guarantee live supplier inventory unless a supplier integration has verified that specific result.
- Sell leads or rank providers because they paid.

## Rollout Risks

| Risk | Severity | Status | Fix path |
| --- | --- | --- | --- |
| Server can suggest `CALL_TOOL`, but client validation used to reject it. | high | fixed | `CALL_TOOL` is now allowed by `actionValidation`. |
| Supply Run Scout card opened `/procurement`, which is not the public user route. | high | fixed | Card now opens `/utilities/supply-run`; embedded allowlist includes it. |
| Invoice/project tile variants changed text without changing destination. | high | fixed | Tile variants now support action overrides. |
| Local explicit messages navigation used `/conversations` while Scout work area expected `/messages`. | medium | fixed | Explicit nav now uses `/messages`; validation allows both. |
| Unknown `CALL_TOOL` names silently no-op after approval. | medium | fixed | `SUPPORTED_SCOUT_TOOLS` now blocks unsupported tool names with plain user-facing copy. |
| Some server fallback copy still uses "route/routing" internally or in older flows. | medium | open | Continue copy sweep outside the primary normal user Scout path. |
| Direct supplier integrations are not yet true supplier APIs for all vendors. | high | policy_target | Keep URL/product resolver and tokenized supplier quote flow now; add vendor API connectors as signed supplier partnerships mature. |

## Supplier Integration Reality

ChatGPT connectors are useful for internal assistant workflows, but they are not the core production integration layer for TradeScout supplier ordering. Supplier integration should live in TradeScout:

- Product URL resolver for broad supplier link intake.
- Supplier quote links/tokens for human suppliers and stores.
- Stripe checkout for TradeScout-managed payment pages where applicable.
- Future supplier-specific adapters only when a supplier provides a stable API or approved commerce flow.

Scout should phrase this as: "Send me the supplier link or material list and I will help turn it into a Supply Run." It should not promise "I can order from Lowe's/Home Depot directly" until that adapter exists and is verified.

## Next Hardening Pass

1. Add end-to-end tests for Scout card click -> embedded workspace for `/utilities/supply-run`, `/homes`, `/vehicles`, `/messages`, `/direct-connect`, and `/finances`.
2. Continue language audit for older server fallback strings that still say route/routing.
3. Expand capability badges in code, not UI, so product can audit more abilities as answer-only, draft-only, open-work-area, approved-action, or blocked.
