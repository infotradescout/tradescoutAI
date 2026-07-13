# Phase 1 Product Architecture Implementation

Date: 2026-07-13
Owner: Product Engineering
Scope: Phase 1 convergence work following the route, object, Direct Connect, and visual audits.

## Outcome

Phase 1 now has executable contracts for canonical Direct Connect entry context, request and provider presentation, task routes, employment handoff, inbox ownership, community ownership, notification ownership, and the no-star trust doctrine. This change set deliberately does not perform destructive database convergence without production counts, writer telemetry, integrity checks, and rollback proof.

## Law reality

| Law statement | Classification | Implementation reality |
| --- | --- | --- |
| Visibility does not equal access | `enforced` | Canonical request presentation excludes released contact fields; contact remains owned by the existing decision gate. |
| Intent -> Decision Card -> Contact | `enforced` | Provider/profile/community entry context is preserved into Direct Connect; no new direct-message bypass was added. |
| Counties are operational containers | `enforced` | Entry context preserves county/countyFips aliases and request cards retain county presentation. No ad-hoc county persistence was introduced. |
| Trust/CVS governs exposure | `enforced` | Star/rating-first presentation was replaced with verification, recommendations, relevant work, completed work, or neutral profile language. |
| One canonical Community post card on every Community surface | `temporary_exception` | `CommunityPostCard` owns community/profile surfaces, while the routed `community-feed.tsx` still contains an inline card with feed-specific actions. Owner: Product Engineering. Rationale: replacing it without reaction/comment/save parity tests risks feature loss. Removal date: 2026-09-30. |
| Admin/UI reads precomputed intelligence | `policy_target` | This phase did not alter intelligence reads or county containers. A separate query-path audit is still required before enforcement can be claimed. |
| No pay-to-play or lead selling | `enforced` | Customer-facing “lead” and rating-first navigation introduced by touched surfaces was removed or reframed as requests/opportunities/trust evidence. |

## Implemented convergence

| Area | Implemented decision | Proof |
| --- | --- | --- |
| Direct Connect entry | Typed parser accepts hire, advice, introduction, support, coordination, collaboration, follow-up, and employment contexts; preserves target identity, post/deal/profile/business/home/employment context, trade, and county. | `directConnectEntryContext.test.ts` |
| Request object | One safe presentation builder and reusable `DirectConnectRequestCard`; contact data is absent from the base view. | `requestCardPresentation.test.ts` |
| Provider object | `ProviderCard` is the named canonical export; profile/card CTAs pass target provider identity and slug. | `provider-card.contract.test.ts` |
| Direct Connect navigation | Canonical task vocabulary and paths: Post, Board, Opportunities, Inbox, Businesses, My Requests, Active; legacy paths remain accepted. | `directConnectRoutes.test.ts`, `direct-connect-task-routes.contract.test.ts` |
| Employment | Employment posts enter Direct Connect as typed `employment` intent with source post, title, description, county, and trade. | `employment-direct-connect-bridge.contract.test.ts` |
| Inbox | `/messages` owns the inbox. `/conversations` and `/dashboard/messages` are compatibility aliases to it. | `canonical-surface-ownership.contract.test.ts` |
| Notifications | AppShell's global Notification Center owns user notification UI; Direct Connect shell has no duplicate client notification center. | `DirectConnectNotificationsCenter.contract.test.ts` |
| Community | `community-feed.tsx` is the only routed feed; the sample `CommunityFeed.tsx` and unused `SocialFeed` are explicitly quarantined. | `canonical-surface-ownership.contract.test.ts` |
| Trust presentation | Rendered stars, “Highest Rated,” and average-rating labels are removed from the primary provider/helper/exchange/community-adjacent surfaces touched by this phase. | `no-star-rating-doctrine.contract.test.ts` |

## Data-system disposition

| Data family | Phase 1 decision | Preconditions for a later schema migration | Rollback requirement |
| --- | --- | --- | --- |
| `communityPosts` and its comments/reactions/saves | Keep as canonical product system. | Confirm every active API writer, moderation path, attachment relation, and counter repair job. | No migration needed for canonical tables. |
| `socialPosts` stack | Quarantine; do not delete. | 30-day production reader/writer counts; row and relation counts; moderation/export/retention review; adapter mapping for any live rows. | Dual-read until parity and zero unresolved rows; retain source tables through one release window. |
| `conversations` / `messages` | Keep as canonical general and Direct Connect conversation system. | Validate all thread deep links, unread counts, contact authority metadata, job linkage, exports, and socket delivery. | Read-path feature flag and reversible adapter. |
| `marketplaceConversations` / `marketplaceMessages` | Keep behind the unified inbox presentation. | Money/order/listing relationship audit plus participant and attachment mapping. | Dual-read; never drop until order and dispute history checks are exact. |
| Procurement messages | Keep context-specific. | Procurement authority, order history, retention, and audit-chain proof. | Context adapter remains available throughout migration. |
| Generic `notifications` | Keep as canonical user-facing notification source. | Confirm all unread/read/archive actions and delivery channels. | Preserve notification IDs and read timestamps. |
| Direct Connect notification endpoints/events | Quarantine as compatibility/audit paths; no client owner. | Server call-site inventory, production request telemetry, event-to-generic-notification mapping, and audit retention decision. | Keep endpoints returning compatible responses during deprecation window. |
| Employment posts/applications | Keep; bridge presentation into Direct Connect Opportunities. | Prove employer and worker directions, status history, eligibility gates, message/contact links, and county routing. | Compatibility Employment Board route and original status writers. |
| Estimate/invoice/payment/lifecycle records | Keep; no Phase 1 merge. | Separate money-integrity audit, ledger reconciliation, idempotency proof, and legal retention review. | Mandatory dual-write/read window and reconciliation report. |

## Deep-schema gate

No table rename, merge, backfill, or drop is authorized by static repository evidence alone. Before any data-system row above moves from quarantine to migration-ready, the migration owner must attach:

1. Production row counts and 30-day read/write telemetry by endpoint and background job.
2. Foreign-key and soft-reference inventory, including JSON metadata references.
3. A deterministic transform with before/after checksums and orphan counts.
4. Dual-write and dual-read duration, reconciliation query, and alert threshold.
5. Rollback procedure that restores both data and application routing.
6. Privacy/export/deletion, moderation, audit, payment, and retention impact sign-off where applicable.

Until all six exist, destructive convergence is classified `policy_target`, not `enforced`.

## Remaining ordered work

1. Replace the routed Community inline post card with `CommunityPostCard` after action-parity contracts cover comments, reactions, saves, share, moderation, topic navigation, media, and global-read/local-action behavior.
2. Add a generic conversation context adapter for marketplace and procurement labels after unread/deep-link parity fixtures are captured.
3. Move remaining rating remnants outside the guarded primary surfaces to trust evidence, distinguishing historical admin-only data from customer-visible ranking.
4. Consolidate the compatibility redirect registry without changing any legacy URL behavior.
5. Begin each deep schema proposal as a separate reversible migration only after the deep-schema gate is complete.
