# TradeScout UI Simplification IA + Shared Primitives Plan P1

Date: 2026-06-10
Checkpoint: `69050197` (`docs: inventory UI simplification surfaces`)
Input: `docs/audits/UI_SIMPLIFICATION_INVENTORY.md`
Scope: planning and contract only. This document authorizes no UI component changes, route moves, copy changes, feature deletion, or navigation refactor.

## Purpose

Phase 1 mapped the site-wide UI surface area and launch risk. Phase 2 defines the information architecture, shared UI primitives, migration priorities, and verification gates that must exist before screen-level simplification begins.

TradeScout simplification must reduce unranked complexity without reducing power. The product should feel like one coherent operating system:

- Scout = guided bridge
- Direct Connect = action path
- HomeID = memory/context layer
- Counties = operational container
- Staff/provider/admin tools = role-aware operational surfaces

## Non-Negotiable UI Invariants

These invariants must apply to every future primitive and refactor:

- Visibility never grants contact.
- Contact remains gated through Intent -> Decision Card -> Contact.
- Request creation stays auth-gated.
- Anonymous drafts may persist, but anonymous public posting stays disabled.
- HomeID remains optional and secondary.
- Counties remain the operational container.
- Trust/CVS governs exposure.
- No pay-to-play language.
- No lead-selling framing.
- Staff/provider/admin tools remain reachable for eligible roles.
- No feature deletion.
- No route deletion without a separate migration decision.
- No Stripe/payment work in this UI simplification stream.
- No MealScout, Sway, Merlin, Albion, or AutoBott changes.

## Proposed Top-Level IA

The simplified IA should organize the app by user intent and role, not by historical feature sprawl.

### Primary Destinations

| Destination | Canonical Meaning | Primary Audience | Route Direction |
| --- | --- | --- | --- |
| Start a Request | Begin or resume a Direct Connect request | public, requester/homeowner | `/direct-connect` request composer path |
| Scout | Ask for guided next steps and context | all roles | `/scout` |
| My Requests | Requester-side request history, replies, contact decisions | requester/homeowner | `/direct-connect/requests` or equivalent section inside Direct Connect |
| Providers | Provider discovery and provider-side work board | public, requester/homeowner, provider | provider directory plus `/business/requests` responder path |
| Community | Read local context and act only where allowed | public, requester/homeowner, provider | `/community` and county/community routes |
| HomeID | Optional memory/history context for homes/assets | requester/homeowner | `/homes` or current HomeID/HomeScout route family |
| Dashboard | Role-aware account home and tools | authenticated users | `/dashboard`, `/my-tradescout`, role dashboard aliases |
| Staff/Admin | Operational queues, review, diagnostics, controls | staff, admin | `/admin` and protected admin tools |

### IA Rules

- `Start a Request` is the clearest public action and must never imply direct provider contact.
- `Scout` is always allowed to guide, explain, and route, but not to bypass protected actions.
- `My Requests` is requester-owned operational history; it must expose contact decisions only in valid gate states.
- `Providers` includes discovery and responder work, but public provider visibility must not become contact access.
- `Community` can be read broadly; local/global action rules remain enforced behind the UI.
- `HomeID` is optional memory and should never be required to start, submit, or route a request.
- `Dashboard` is role-aware aggregation, not a replacement for law-sensitive workflows.
- `Staff/Admin` stays reachable for eligible roles from desktop and mobile; simplification may group tools but not hide access.

## Role-Aware Navigation Rules

### Public

- Show: `Start a Request`, `Scout`, `Providers`, `Community`, business/provider entry where relevant, sign in/create account.
- Hide: `My Requests`, private HomeID records, Dashboard, Staff/Admin, private messages/inbox.
- Preserve: anonymous Direct Connect draft entry and safe auth return path.
- Risk rule: public CTA language must route to intent/draft/review, not direct contact.

### Requester / Homeowner

- Show: `Start a Request`, `Scout`, `My Requests`, `Community`, optional `HomeID`, Dashboard, account/settings.
- Conditional: `Providers` as discovery only unless the action becomes a request/Decision Card path.
- Preserve: request creation, draft persistence, contact approval/deny/release states, HomeID skip.
- Risk rule: HomeID must read as helpful context, not required setup.

### Provider

- Show: `Scout`, provider work board, eligible requests, provider profile/business tools, Dashboard, Community.
- Conditional: `Start a Request` remains available for provider-as-requester use.
- Preserve: request-contact action, assignment eligibility, county/service-area context, Trust/CVS display.
- Risk rule: provider views must not reveal requester contact before approval.

### Staff

- Show: Staff review queues, Direct Connect review, moderation, verification, support/error workflows, Scout/admin diagnostics where allowed.
- Preserve: queue readability, routing controls, audit/status context, admin handoff paths.
- Risk rule: staff simplification must improve scanability without burying law-sensitive controls.

### Admin

- Show: full Admin destination, authority/config/diagnostics, user/business/provisioning tools, operational dashboards.
- Preserve: all admin routes and compatibility aliases unless separately migrated.
- Risk rule: admin IA may group tools, but must not remove fast access to authority, Direct Connect, moderation, verification, or audit logs.

## Shared UI Primitive Plan

Each primitive should standardize shape, density, states, and law-sensitive affordances before route-level refactors begin.

### Page Header

- Purpose: provide route identity, primary action, role/context status, and optional secondary actions.
- Where currently needed: landing, Scout, Direct Connect, provider board, staff/admin tools, dashboards, community, exchange, profile/business pages.
- Law-sensitive constraints: primary action must respect route authority; no header CTA may imply direct contact, paid ranking, or ungated posting.
- Must-not-hide controls: route title, primary legal action, role/admin access indicators where needed, county context where route depends on it.
- Migration priority: high.
- Future test coverage required: route-level smoke asserting primary CTA text and destination on public landing, Direct Connect, provider board, and admin review.

### Section Header

- Purpose: label sub-areas inside dense pages without repeating marketing copy.
- Where currently needed: Direct Connect composer/inbox/requests, dashboards, staff/admin tables, provider board, HomeID sections.
- Law-sensitive constraints: section headings must not downgrade warnings or gate state context.
- Must-not-hide controls: review state, contact state, filters, queue names, county/service-area labels.
- Migration priority: medium.
- Future test coverage required: component snapshot/DOM tests for critical section labels and action visibility.

### Empty State

- Purpose: give next action when lists, queues, or cards have no data.
- Where currently needed: My Requests, provider board, staff queues, HomeID records, community lists, exchange listings, dashboards.
- Law-sensitive constraints: empty state CTA must route into allowed action path; no anonymous public posting or direct contact.
- Must-not-hide controls: create request, sign-in prompt, provider setup, staff/admin refresh/filter controls where relevant.
- Migration priority: medium.
- Future test coverage required: empty-state tests for unauthenticated Direct Connect, provider board with no eligible requests, admin queue with no items.

### Law-Aware CTA Block

- Purpose: standardize primary/secondary actions when a user is about to create, route, contact, claim, verify, or publish.
- Where currently needed: landing, Direct Connect composer review, profile/business contact actions, provider request-contact, auth return, community post prompts.
- Law-sensitive constraints: must state or imply the correct gate: intent, review/Decision Card, auth, contact approval, or verification.
- Must-not-hide controls: sign in/create account, review request, approve/deny/release contact, skip HomeID, cancel/back.
- Migration priority: critical.
- Future test coverage required: product language guard for stale CTA labels; DOM tests for no `Start Direct Connect` public CTA; contact-gate CTA state tests.

### Request Card

- Purpose: show Direct Connect request state consistently for requesters, providers, and staff.
- Where currently needed: My Direct Connect Requests, Direct Connect Inbox, provider board, admin review, dashboards.
- Law-sensitive constraints: card variant must control who can see requester identity, contact status, HomeID context, and routing details.
- Must-not-hide controls: request title/details, county/location context, state/status, contact gate state, next action, review/routing actions for staff.
- Migration priority: critical.
- Future test coverage required: requester/provider/staff card tests proving contact info is absent before release and contact actions appear only in valid states.

### Provider Match Card

- Purpose: present provider candidates/matches with trust and location fit in a compact, comparable format.
- Where currently needed: Direct Connect provider search/candidate selection, provider discovery, contractor/business directories, staff routing.
- Law-sensitive constraints: ordering and emphasis must reflect location fit and Trust/CVS, not pay-to-play.
- Must-not-hide controls: provider identity, service area/county fit, Trust/CVS badge, selection/request path, explanation of why shown.
- Migration priority: high.
- Future test coverage required: no paid-ranking copy test; provider match render test for CVS/location fit; staff candidate routing test.

### Status Badge

- Purpose: normalize workflow state labels across requests, profiles, verification, moderation, and queues.
- Where currently needed: Direct Connect, provider board, staff review, dashboards, onboarding/verification, exchange listings.
- Law-sensitive constraints: status labels must not blur `requested`, `approved`, `released`, `denied`, `verified`, or `pending`.
- Must-not-hide controls: state label, state description on hover/detail, action availability if state permits.
- Migration priority: high.
- Future test coverage required: enum/allowlist tests for contact gate and request workflow labels.

### Trust/CVS Badge

- Purpose: display trust/exposure signals consistently without implying paid placement.
- Where currently needed: provider match cards, directories, contractor/profile pages, staff routing, county/trade results.
- Law-sensitive constraints: must route through Trust/CVS logic and avoid language suggesting boosts or bought rank.
- Must-not-hide controls: CVS value/range where shown, trust source/explanation where available, fallback/unknown state.
- Migration priority: high.
- Future test coverage required: render tests for known/unknown CVS states; brand/language guard for paid-rank phrasing.

### County Context Badge

- Purpose: make county/service-area context visible where routing, discovery, or local action depends on it.
- Where currently needed: Direct Connect composer, provider board, community/county pages, directories, staff routing, dashboards.
- Law-sensitive constraints: county is an operational container; badge must not become decorative if it affects writes/routing.
- Must-not-hide controls: county/state label, change/select location where allowed, defaulted county indicator where relevant.
- Migration priority: high.
- Future test coverage required: county context tests for Direct Connect prefill, provider search, community local action, and staff routing.

### Decision / Contact Gate Panel

- Purpose: provide one canonical UI for contact visibility, request-contact, approval, denial, and release.
- Where currently needed: Direct Connect requester cards, provider board, staff review, profile/business contact paths, exchange contact paths.
- Law-sensitive constraints: this is the core law primitive. It must prevent visual shortcuts from visibility to contact.
- Must-not-hide controls: contact locked state, request contact, approve contact, deny contact, release contact, explanation of current state, private contact hidden notice.
- Migration priority: critical.
- Future test coverage required: no-contact-leak test; state matrix tests for locked/requested/user-approved/released/denied; provider payload redaction tests.

### Form Step Shell

- Purpose: standardize multi-step forms with clear progress, back/continue controls, draft/save behavior, and review.
- Where currently needed: Direct Connect composer, onboarding, claim business, profile/business edit, HomeID record creation, marketplace listing.
- Law-sensitive constraints: steps must not make optional HomeID or verification feel required unless the action truly requires it; final submit must respect auth and review.
- Must-not-hide controls: back, save/draft, skip optional HomeID, review, sign in to send, required-field errors.
- Migration priority: critical for Direct Connect, medium for other forms.
- Future test coverage required: anonymous draft persistence, auth-return restoration, missing HomeID submit, final-review-before-submit.

### Review Table Shell

- Purpose: standardize dense operational lists with filters, status columns, row actions, and empty/loading/error states.
- Where currently needed: staff/admin review queues, provider board, moderation, verification, admin user/business tools.
- Law-sensitive constraints: row actions must be role-guarded and state-aware; filtering must not hide critical queues by default.
- Must-not-hide controls: status, county, trust/contact state, row action menu, search/filter, refresh, audit/detail link.
- Migration priority: high for staff/provider surfaces.
- Future test coverage required: staff queue readability smoke, provider board readability smoke, admin role access test, filter default test.

### Mobile Bottom Action Bar

- Purpose: provide stable thumb-zone access to the most important role-safe actions.
- Where currently needed: global AppShell mobile nav, Direct Connect mobile sections, request cards, provider board, account/tools.
- Law-sensitive constraints: mobile shortcuts must not create direct contact shortcuts or hide Staff/Admin access from eligible users.
- Must-not-hide controls: Start/Direct Connect, Inbox/My Requests, Scout, Community, Account/Tools, Admin when role allows.
- Migration priority: high.
- Future test coverage required: mobile nav route smoke by public/requester/provider/admin role; contact request count visibility; no hidden admin access for admin user.

## Component Migration Order

No screen-level cleanup should begin until the critical primitives have contracts/tests or narrowly scoped component tests.

1. Define primitive APIs and tests for `DecisionContactGatePanel`, `LawAwareCtaBlock`, `RequestCard`, and `FormStepShell`.
2. Define badge primitives: `StatusBadge`, `TrustCvsBadge`, `CountyContextBadge`.
3. Define layout primitives: `PageHeader`, `SectionHeader`, `EmptyState`.
4. Define operational primitives: `ReviewTableShell`, `ProviderMatchCard`.
5. Define `MobileBottomActionBar` contract against role-aware navigation rules.
6. Apply primitives first to isolated/non-destructive wrappers where possible.
7. Begin landing cleanup only after public CTA smoke/guard tests exist.
8. Begin Direct Connect composer simplification only after draft/auth/HomeID/contact tests exist.
9. Begin contact gate consistency pass across requester/provider/staff surfaces.
10. Then address HomeID placement/copy, provider board, staff review, dashboard/nav consolidation.

## Implementation Order For Future Slices

1. Shared primitives first.
2. Landing cleanup.
3. Direct Connect composer.
4. Contact gate consistency.
5. HomeID placement/copy.
6. Provider board.
7. Staff review.
8. Dashboard/nav consolidation.

This order is intentionally conservative: it creates reusable law-aware parts before moving high-risk screens.

## Verification Gates Before Any Visual Refactor

These gates should exist or be run manually before each relevant refactor PR/commit is accepted.

### Public Landing Smoke

- Confirm desktop and mobile landing load.
- Confirm logo is visible.
- Confirm primary CTA says `Start a Request`.
- Confirm no stale public CTA says `Start Direct Connect`.
- Confirm public copy does not imply direct contact, paid ranking, or lead selling.

### Direct Connect Anonymous Draft

- Start request while anonymous.
- Fill enough fields to create a meaningful draft.
- Trigger sign-in/create-account path.
- Confirm draft survives return.
- Confirm anonymous public posting remains disabled.

### Auth-Gated Request Creation

- Confirm authenticated user can submit request after review.
- Confirm unauthenticated submit routes to auth and persists draft.
- Confirm final action happens only after review state.

### HomeID Absent Request Creation

- Confirm no saved HomeID/home record is required.
- Confirm HomeID skip/continue remains visible.
- Confirm request creation succeeds without HomeID.
- Confirm HomeID copy frames memory/history, not mandatory setup.

### Contact No-Leak Test

- Confirm provider/requester/staff variants hide requester contact before approval/release.
- Confirm provider-facing payload/card does not expose requester phone/email/raw contact prematurely.
- Confirm requester approval/deny/release controls only show in valid states.

### County Context Test

- Confirm county/default location appears where routing depends on it.
- Confirm provider search uses county/service-area context.
- Confirm staff routing preserves county containers.
- Confirm community local action remains county-aware and global action remains blocked where required.

### Provider Board Readability

- Confirm eligible requests are readable.
- Confirm request-contact action remains visible and gated.
- Confirm Trust/CVS and location/service-area fit remain visible.
- Confirm no requester contact appears before approval.

### Staff Review Readability

- Confirm Direct Connect review queue is readable.
- Confirm status, county, trust/contact state, and row/card actions are visible.
- Confirm admin/staff role guard still permits eligible access.
- Confirm critical queues are not hidden by default filters.

## Test / Contract Backlog

Recommended contracts before broad visual work:

- Public CTA contract: landing contains `Start a Request` and excludes stale `Start Direct Connect`.
- Contact gate state matrix: locked, provider requested, user approved, released, denied.
- Provider redaction contract: requester contact absent before release.
- Direct Connect draft contract: anonymous draft persists through auth return.
- HomeID optionality contract: request can be created with no HomeID.
- County context contract: request/provider/staff surfaces retain county/service-area context.
- Role nav contract: public/requester/provider/staff/admin see the correct top-level destinations.
- Admin reachability contract: eligible staff/admin can reach `/admin` and Direct Connect review.
- Trust/CVS display contract: provider match surfaces show trust/location fit without paid-rank language.
- Review table contract: staff/provider lists preserve filters, status, empty state, and row actions.

## Acceptance Status

- P1 plan exists: complete.
- No functional UI code changed: required for acceptance.
- Role-aware IA is defined: complete.
- Shared primitives and migration priorities are documented: complete.
- Law-sensitive guardrails are explicit before refactor work begins: complete.

