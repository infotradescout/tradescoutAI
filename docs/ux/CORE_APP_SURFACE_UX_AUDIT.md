# Core App Surface UX Audit

Baseline inspected: `f6eb7e60e150c6d88d59313f8bbc8910b0139d9c`
Branch: `feature/core-app-surface-ux-audit`
Status: audit only; no production UI or runtime behavior changes.

## Executive Summary

Community, Inbox, Direct Connect, and Scout all contain strong product primitives, but they also expose too much internal system thinking. The common failure is not only copy. It is visible architecture: routing logic, trust doctrine, AI/search state, confidence/scoring, HomeID rationale, and multi-card explanation patterns are doing layout work that a finished app surface should do with cleaner defaults and fewer choices.

The next implementation work should not be another isolated Scout wording pass. It should be staged app-surface cleanup that gives each core screen one job, one dominant action, and a mobile first viewport that reaches action quickly while preserving TradeScout law.

## Issue Taxonomy

- Hero/header bloat: large app-workflow headers or repeated guidance blocks where the user needs a task.
- Duplicate titles: page shell, local page title, card title, and guidance card repeating the same purpose.
- AI/chat/assistant framing drift: chat/thread/assistant/helper patterns shaping visible Scout or adjacent surfaces.
- Doctrine/system logic visible to user: trust gates, routing logic, actor/state labels, confidence, source layers, or status mechanics shown as default UI.
- Paragraph wall: explanatory copy substituting for a clear control.
- Unclear primary action: too many equal CTAs or filters before the task.
- Too many competing CTAs: navigation, prompts, chips, status buttons, and next actions all styled similarly.
- Dense cards/nested panels: cards inside cards, rails beside cards, and panels competing in mobile viewports.
- Poor mobile first viewport: initial viewport spends space on banners, explanations, filters, or navigation before action.
- Beta/status/banner misuse: beta/status notices occupying workflow space or looking like blocking warnings.
- Weak visual hierarchy: labels, helper text, status badges, and actions have similar weight.
- Fake certainty/trust risk: scores, "best match", confidence, or safety language can imply precision the product should not overclaim.
- Brand boundary risk: legacy marketplace/lead/support/helper language can weaken TradeScout doctrine.
- Direct Connect gating risk: any cleanup must preserve Intent -> Decision Card -> Contact.
- HomeID optionality risk: HomeID must remain optional support, not a request requirement.
- Route or behavior risk: UI changes must not alter routing semantics, auth, analytics payloads, schema, or submission behavior.

## Community

### 1. Surface Purpose

Community is the local hub/feed/discovery surface. It should help a user see nearby activity, ask or share with neighbors, discover useful posts/resources, and move request-shaped needs into Direct Connect.

### 2. Current User-Facing Job

The current surface mixes local feed, global read-only browsing, post composer, category browser, Scout-imported drafts, recommendation cards, snapshot rail, and Direct Connect CTAs.

### 3. Correct Product Job

Show what is happening locally and make the next community action obvious: browse local activity, search/filter it, create a post, or start a Direct Connect request when the need is request-shaped.

### 4. Current UX Failure Modes

- Dense cards/nested panels: `community-feed.tsx` combines feed, composer, filters, snapshot rail, and right-rail context.
- Unclear primary action: posting, filtering, browsing, asking, imported drafts, and Direct Connect actions compete.
- AI/chat/assistant framing drift: question placeholders and intent labels mention Scout as a help path inside the community composer.
- Doctrine/system logic visible to user: Community CTA decision copy explains Scout needing more context instead of showing a clean blocked/ready action.
- Fake certainty/trust risk: recommendation cards expose confidence components, risk flags, and proceed/review/contact actions.
- Poor mobile first viewport: the surface can start with controls and rails before the feed/action is clear.

### 5. AI Drift Examples

- `client/src/pages/community-feed.tsx` uses placeholder and intent language like Scout helping with a question.
- `client/src/components/community/CommunityCTA.tsx` contains internal `ask_scout` mode and visible context copy such as "Scout needs a little more context before moving forward."
- `client/src/components/community/ScoutRecommendationCard.tsx` exposes "Scout recommendation", confidence components, and risk flags as a card model.

### 6. Visible Copy Risks

- "Draft imported from Scout" can be acceptable as provenance, but should not dominate the composer.
- "Scout recommendation" and confidence/risk explanations make Community feel like an AI review surface rather than a local feed.
- "Proceed with contact" near recommendation UI must be checked against contact gating expectations.

### 7. Primary Action That Should Dominate

Create a local post or start a request, depending on the active intent. The default Community feed should privilege "Post" or "Start request" after enough context, not recommendation doctrine.

### 8. Secondary Actions

Browse local/global, search, category filter, save/share, open Direct Connect, view profile, and continue a Scout-imported draft.

### 9. Hide/Collapse/Move

- Move recommendation scoring details behind "Why this appears" or remove from default cards.
- Collapse global/local explanations into a compact toggle help state.
- Keep trust/contact doctrine in the underlying gate or expandable detail.
- Move broad community education into help/docs or an empty state shown only when the feed is empty.

### 10. Mobile-First Correction Needed

The first viewport should show a compact local header, the active local/global state, one composer/search action, and the first feed items. Snapshot rails, recommendation details, and category education should move below or behind controls.

### 11. Suggested V1 Layout Model

Compact top bar: location + local/global toggle. Then one search/post row. Then feed cards. A single sticky "Start request" or "Post" action can appear when relevant. Recommendations become quiet inline cards without visible scoring by default.

### 12. Files/Routes/Components Involved

- `client/src/pages/community.tsx`
- `client/src/pages/community-feed.tsx`
- `client/src/components/community/CommunityCTA.tsx`
- `client/src/components/community/CommunityEmptyState.tsx`
- `client/src/components/community/ScoutRecommendationCard.tsx`
- `client/src/components/community/CommunitySnapshotRail.tsx`
- `client/src/components/community/CommunityPostCard.tsx`
- `client/src/components/layout/CommunityShell.tsx`
- `client/src/shells/CommunityPageShell.tsx`
- Routes: `/community`, `/community-feed`, related community API routes under `server/routes/community-*` and `server/routes/groups.ts`

### 13. Risk Level

High UX risk, medium doctrine risk. The feed is central and visible; cleanup must avoid weakening global read-only behavior or contact gates.

### 14. Recommended Implementation Slice

Slice 1: Community feed hierarchy. Remove visible assistant/recommendation framing from default Community cards, simplify composer/filter hierarchy, and move scoring/detail copy behind disclosure without changing post or route behavior.

## Inbox

### 1. Surface Purpose

Inbox is the action center for approved conversations, first-contact requests, unread items, and request/reply follow-up.

### 2. Current User-Facing Job

The current experience splits between `/messages`, `/notifications`, the top notification dropdown, Direct Connect reply inbox, contact request review, thread messages, Home report sharing, notification settings, and activity feed.

### 3. Correct Product Job

Show what needs attention now, make the next safe action obvious, and keep messages/replies/contact requests clear without exposing routing doctrine.

### 4. Current UX Failure Modes

- Unclear primary action: messages, requests, Home report sharing, notification feed, filters, and settings all compete.
- Doctrine/system logic visible to user: request previews, approval state, contact opening, and "first-contact previews are required" appear as explanatory panels.
- Dense cards/nested panels: `MessagesPanel` uses a two-card desktop manager with nested Home report cards and controls.
- Poor mobile first viewport: desktop split-panel assumptions can compress badly on mobile.
- Duplicate centers: `/messages`, `/notifications`, notification dropdown, and Direct Connect inbox each represent "things to act on."
- Brand boundary risk: notification categories include Exchange, listings, transactions, promotional, system updates, and settings-like rows in one app action surface.

### 5. AI Drift Examples

Inbox is less AI-branded than Scout, but it still exposes system workflow language: request approval, contact opens, governed conversation trail, and Home report context as default panels rather than concise actions.

### 6. Visible Copy Risks

- "Contact is open and ready" is clear after acceptance, but should remain scoped to an approved request.
- "First-contact previews are required for new connections. Approved requests unlock chat." is doctrinally correct but reads like a system rule block.
- "Share your Home Vault context into this already-approved thread" is useful but can dominate a message thread and may imply HomeID/Home Vault is expected.

### 7. Primary Action That Should Dominate

Review the next action-required item: accept/decline a contact request, reply to an approved thread, or open the Direct Connect reply.

### 8. Secondary Actions

Search, filter unread/action-required/all, mark read, archive, share optional HomeID/Home report context, open notification settings.

### 9. Hide/Collapse/Move

- Move Home report sharing behind "Add property context" inside an approved thread.
- Move settings/archive affordances into a menu.
- Merge notification and message language into a single "Action Center" model where possible.
- Keep contact rule details in a short helper or disclosure.

### 10. Mobile-First Correction Needed

Mobile should start with an "Action required" list, then "Messages", then "Updates." A selected item can open a full-screen detail view rather than a compressed split pane.

### 11. Suggested V1 Layout Model

Action Center header with filter chips: Action required, Unread, All. Cards show actor, reason, preview, age, and one next button. Thread detail opens as a single-column view. Optional HomeID/Home report context is collapsed by default.

### 12. Files/Routes/Components Involved

- `client/src/pages/messages.tsx`
- `client/src/components/messages/MessagesPanel.tsx`
- `client/src/pages/notifications.tsx`
- `client/src/components/ui/notification-center.tsx`
- `client/src/components/NotificationsMenu.tsx`
- `client/src/components/NotificationBell.tsx`
- `client/src/hooks/useNotifications.ts`
- `server/routes/notification-routes.ts`
- `server/services/platformSupportInbox.ts`
- Routes: `/messages`, `/notifications`, `/chat` compatibility route in `client/src/AppRoutes.tsx`

### 13. Risk Level

Medium-high UX risk, high gating risk. This surface directly touches contact approval and message availability.

### 14. Recommended Implementation Slice

Slice 2: Inbox action center. Create a single action-required-first model across messages and contact requests, collapse optional HomeID sharing, and preserve all message/contact APIs and auth behavior.

## Direct Connect

### 1. Surface Purpose

Direct Connect is the primary request/review/send flow and the governed coordination system for local work.

### 2. Current User-Facing Job

The current shell supports new request creation, local request board, jobs, replies, directory, my requests, notifications, first-use prompts, HomeID prompts, route sheets, contact gate panels, request cards, attachment strips, and analytics events.

### 3. Correct Product Job

Help the requester prepare a clear request, review it, send it through the approved path, and manage replies while preserving contact gating.

### 4. Current UX Failure Modes

- Duplicate titles and guidance: desktop post surface includes first-use guidance plus "Add request details, review them, and submit when ready."
- Dense cards/nested panels: request management, route sheet, contact gate panel, status chips, and first-use cards can stack heavily.
- Doctrine/system logic visible to user: contact gate panel exposes viewer role, next actor, visible now, happens next, and gate state by default.
- Too many competing CTAs: section tabs, notification pill, request counters, guidance card CTA, route actions, contact actions, and first-use CTA.
- HomeID optionality risk: HomeID copy is optional but can feel like a memory/persistence requirement if too prominent.
- Poor mobile first viewport risk: the form has been improved, but non-post sections and management cards still risk status-heavy density.

### 5. AI Drift Examples

- `directConnectReadiness.ts` uses Scout routing language for next-step summaries.
- `DirectConnectShell.tsx` route sheet includes "Let Scout decide."
- First-use cards explain Direct Connect preparation instead of letting the form carry the workflow.

### 6. Visible Copy Risks

- "Let Scout route it through Direct Connect" and "Let Scout decide" are useful but can overstate automated routing control.
- Contact gate terms such as viewer role, next actor, platform release, and contact state are correct but feel admin/system-like.
- "Post a job or a resume and chat through Scout" under Employment risks reintroducing chat framing.

### 7. Primary Action That Should Dominate

For the post surface: complete request details and submit after review. For management: review replies or choose the next request step.

### 8. Secondary Actions

Attach photos, add optional HomeID context, choose recipients, browse directory, review local requests, view jobs, manage existing requests, review notifications.

### 9. Hide/Collapse/Move

- Collapse first-use guidance after initial exposure.
- Convert contact gate panel into a concise status with details disclosure on requester cards.
- Keep HomeID panel collapsed or secondary unless the user opts in.
- Move route mechanics and "why" explanations into sheet details or help.

### 10. Mobile-First Correction Needed

Post flow should keep the current compact request form direction: light progress, calm fields, clear upload affordance, optional HomeID, compact beta/status notice, and a visible next action. Management views should use compact next-step cards instead of stacked doctrine panels.

### 11. Suggested V1 Layout Model

Request composer: compact header, light progress, details fields, photo upload, optional HomeID disclosure, review/send CTA. Request management: segmented filters, next-step card, request list, expandable contact gate detail.

### 12. Files/Routes/Components Involved

- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `client/src/pages/direct-connect/directConnectReadiness.ts`
- `client/src/pages/direct-connect/requestCardPresentation.ts`
- `client/src/pages/direct-connect/DirectConnectPros.tsx`
- `client/src/pages/direct-connect/EmploymentBoard.tsx`
- `client/src/pages/direct-connect/WhyThisJobModal.tsx`
- `client/src/components/ui/DecisionContactGatePanel.tsx`
- `client/src/components/guidance/FirstUseGuidanceCard.tsx`
- `server/routes/direct-connect.ts`
- Contract tests under `client/src/pages/direct-connect/*` and `server/tests/direct-connect-*`

### 13. Risk Level

High. Direct Connect is primary and contact gating is law-critical. UI cleanup must be narrow and contract-backed.

### 14. Recommended Implementation Slice

Slice 3: Direct Connect management and gate presentation. Keep submission behavior unchanged, but compress first-use/gate/status panels and make optional HomeID and route details quieter.

## Scout

### 1. Surface Purpose

Scout is the Search + Control workspace. It should help users search local context, compare options, summarize what matters, and open the right TradeScout action surface.

### 2. Current User-Facing Job

The current surface combines a natural-language input, chat/thread model, result/action cards, quick-start prompts, HomeID/dashboard context, watchdog interventions, confidence/trust cards, evidence strips, tool drawers, saved conversations, objective flows, and routing decisions.

### 3. Correct Product Job

Let the user state an objective, then return concise structured results and controls: summary, relevant local cards, recommended next action, and view/action controls.

### 4. Current UX Failure Modes

- AI/chat/assistant framing drift: file and component model uses assistant/thread/chat metaphors and visible message bubbles.
- Doctrine/system logic visible to user: evidence, confidence, trust, watchdog, controller, and routing concepts can appear as UI structures.
- Paragraph wall: messages can become long answers, even with tests attempting summarization.
- Too many competing CTAs: quick-start prompts, action chips, clusters, evidence, controller extras, work area sheet, tool drawer, and post-onboarding cards.
- Fake certainty/trust risk: confidence percentages, "Best match", safety labels, and trust score details can imply excessive precision.
- Poor mobile first viewport: Scout Home cards plus thread plus input can make the actual search/control job less immediate.

### 5. AI Drift Examples

- `client/src/scout/ScoutOS.tsx` comment states the surface focuses on chat.
- `client/src/scout/ScoutInputRow.tsx` is named and commented as a command bar, but the aria/send labels still use message metaphors.
- `client/src/scout/ScoutThread.tsx` renders user/assistant bubbles, evidence strips, progress messages, and controller extras.
- `client/src/scout/TrustAwareDecisionCard.tsx` exposes match percentage, safety level, and trust details.
- `client/src/scout/WatchdogInterventionBanner.tsx` exposes "Success watchdog", engagement score, inactivity, and urgency.
- `server/routes/scout.ts` and `server/services/unifiedScoutRouter.ts` contain model/prompt/confidence/routing machinery that must stay backend-side or be sanitized into concise app language.

### 6. Visible Copy Risks

- "What do you need help with today?" is friendly but broad; it can make Scout feel like a helper instead of Search + Control.
- "Community-Powered", "Match 90%", "Safety LOW/HIGH", "Success watchdog", and "Checking system status..." are exposed system labels.
- Any "ask/search with Scout" wording remains banned by current doctrine tests.

### 7. Primary Action That Should Dominate

Search or give Scout an objective, then open the best next app action.

### 8. Secondary Actions

Filter result views, open Direct Connect, open Community, compare options, save/resume context, inspect evidence/details, adjust route or objective.

### 9. Hide/Collapse/Move

- Collapse evidence, confidence, trust model details, and watchdog metrics behind detail controls.
- Move tool/status/router language to internal logs/admin.
- Replace thread-first layout with result blocks and action controls.
- Keep model/routing details out of user-facing default copy.

### 10. Mobile-First Correction Needed

Mobile should open with input and a small set of high-signal controls. Results should be card blocks: summary, local results, next action. The chat transcript should not dominate the default viewport.

### 11. Suggested V1 Layout Model

Search/control shell: compact input, mode/view control, result stack, next action card, details drawer. Keep conversation history as optional continuity, not the main layout.

### 12. Files/Routes/Components Involved

- `client/src/scout/ScoutOS.tsx`
- `client/src/scout/ScoutHeader.tsx`
- `client/src/scout/ScoutInputRow.tsx`
- `client/src/scout/ScoutThread.tsx`
- `client/src/scout/ScoutHome.tsx`
- `client/src/scout/ScoutResultActionCard.tsx`
- `client/src/scout/ScoutDirectConnectPanel.tsx`
- `client/src/scout/TrustAwareDecisionCard.tsx`
- `client/src/scout/WatchdogInterventionBanner.tsx`
- `client/src/scout/ScoutToolsDrawer.tsx`
- `client/src/scout/unifiedRouterClient.ts`
- `server/routes/scout.ts`
- `server/routes/scout-v2.ts`
- `server/services/unifiedScoutRouter.ts`
- Scout doctrine tests including `server/tests/scout-surface-doctrine-scan.contract.test.ts`, `client/src/routing/scout-doctrine.contract.test.ts`, and `client/src/scout/*`

### 13. Risk Level

High UX risk, medium-high doctrine risk. Scout is central, but changes must avoid route behavior, AI/model routing, sanitizer, and analytics drift.

### 14. Recommended Implementation Slice

Slice 4: Scout Search + Control shell. Restructure visible output around search results and action controls while keeping existing Scout backend behavior and doctrine tests intact.

## Cross-Surface Route And Contract Notes

- `client/src/AppRoutes.tsx` keeps `/direct-connect`, `/direct-connect/:rest*`, `/scout`, `/messages`, `/notifications`, `/community`, and `/community-feed` active. Do not change routing semantics in UX cleanup slices.
- `client/src/components/layout/AppShell.tsx` and navigation components prioritize Direct Connect, Community, and Scout. Bottom/mobile navigation can remain, but it should not compete with in-flow CTAs.
- `server/tests/scout-surface-doctrine-scan.contract.test.ts` already guards banned Scout helper/chat/contact phrases in runtime/prompt sources.
- `server/tests/tradescout-direct-connect-product-surface.contract.test.ts` guards Direct Connect as the primary request product and blocks internal architecture descriptions on public surfaces.
- Direct Connect/HomeID tests under `server/tests/assetid-*` guard HomeID request context and persistence contracts.

## Top UX Failures Found

1. Visible system architecture is doing too much UI work across surfaces.
2. Too many surfaces expose multiple primary jobs at once.
3. Mobile first viewports are vulnerable to explanation, filters, banners, or panels before action.
4. Scout/AI confidence and recommendation models can look more certain than the product should claim.
5. Inbox and Direct Connect expose correct gate mechanics in a way that can feel administrative instead of premium.

## Recommended Implementation Slices

1. Community feed hierarchy and recommendation de-systemization.
   - Goal: make Community a clean local hub/feed with one post/search/request action model.
   - Constraints: preserve global read-only behavior and contact gating.

2. Inbox action center.
   - Goal: merge contact requests, unread messages, and updates into action-required-first cards.
   - Constraints: preserve auth, message routes, request approval behavior, and HomeID optional sharing.

3. Direct Connect management/gate presentation.
   - Goal: preserve the premium request form direction while simplifying management cards, first-use guidance, HomeID prompts, and contact gate presentation.
   - Constraints: no submission, payload, analytics, auth, HomeID persistence, or contact gate behavior changes.

4. Scout Search + Control shell.
   - Goal: reduce chat/thread dominance and make structured result/action controls the default.
   - Constraints: no live AI/model routing changes, no banned Scout wording, no routing semantics drift.

## Risks And Follow-Up

- Screenshots should be captured before each implementation slice on mobile and desktop so reviewers can verify visual hierarchy, not only copy.
- Contact gate and HomeID panels need contract-backed refactors because wording-only cleanup can accidentally change perceived access.
- The existing docs and tests guard many Scout phrases, but comparable app-surface visual density guards do not exist yet.
- Public SEO pages may still use hero patterns; do not apply transactional workflow law to public marketing routes without a separate SEO review.
- A prior superseded Scout-only WIP was stashed and is not included in this audit lane.
