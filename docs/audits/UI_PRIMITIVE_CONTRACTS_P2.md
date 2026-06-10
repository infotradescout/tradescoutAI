# TradeScout Critical UI Primitive Contracts P2

Date: 2026-06-10
Checkpoint: `cb4a050a` (`docs: plan UI IA and shared primitives`)
Inputs:

- `docs/audits/UI_SIMPLIFICATION_INVENTORY.md`
- `docs/audits/UI_SIMPLIFICATION_IA_AND_PRIMITIVES_PLAN.md`

Scope: contracts and tests only. This document authorizes no visual components, screen refactors, navigation moves, route deletion, production copy changes, Stripe/payment work, or unrelated project changes.

## Purpose

P2 defines the first critical shared UI primitive contracts before any visual cleanup or component migration begins. These primitives protect the law-sensitive path where simplification could otherwise hide contact gates, weaken auth boundaries, make HomeID feel required, or reduce staff/provider operational visibility.

Critical primitives:

1. `DecisionContactGatePanel`
2. `LawAwareCtaBlock`
3. `RequestCard`
4. `FormStepShell`

## Core Doctrine For Every Primitive

- Visibility never grants contact.
- Contact remains gated through Intent -> Decision Card -> Contact.
- Request creation stays auth-gated.
- Anonymous drafts may persist, but anonymous public posting stays disabled.
- HomeID remains optional and secondary.
- Counties remain operational containers.
- Trust/CVS governs exposure.
- No pay-to-play language.
- No lead-selling framing.
- Staff/provider/admin tools remain reachable.
- No feature deletion.
- No route deletion.

## Shared Conceptual Types

These names are conceptual contract anchors, not implementation requirements.

```ts
type AudienceContext = "public" | "requester" | "provider" | "staff" | "admin";

type ContactGateState =
  | "contact_hidden"
  | "provider_requested_contact"
  | "requester_approved"
  | "contact_released"
  | "denied"
  | "closed";

type LawSensitiveAction =
  | "start_request"
  | "review_request"
  | "submit_request"
  | "request_contact"
  | "approve_contact"
  | "deny_contact"
  | "release_contact"
  | "route_request"
  | "claim_profile"
  | "verify_identity"
  | "publish_post"
  | "publish_listing";
```

## `DecisionContactGatePanel`

### Purpose

Provide one canonical UI contract for contact visibility, provider contact requests, requester approval/denial, staff/admin review, and final contact release.

### Allowed Use Cases

- Direct Connect request detail.
- Direct Connect requester request cards.
- Provider board/request card.
- Staff/admin Direct Connect review.
- Contact-sensitive modals.
- Profile/business/provider contact paths.
- Exchange/contact flows that need the same no-leak rule.

### Forbidden Use Cases

- Showing raw requester phone, email, address, or direct messaging destination before approved release.
- Replacing review/Decision Card requirements with a simple contact button.
- Hiding gate state in tooltip-only UI.
- Using the panel as a generic marketing CTA.
- Allowing public users to bypass auth or review by clicking through the panel.

### Required Props / State Shape Conceptually

- `audienceContext`: public, requester, provider, staff, or admin.
- `contactGateState`: one of the required contact states.
- `requestId` or equivalent stable request reference.
- `nextActor`: requester, provider, staff, platform, or none.
- `availableActions`: state-filtered actions such as request, approve, deny, release, close.
- `safeContactSummary`: redacted contact summary only; never raw contact before release.
- `countyContext`: when routing or staff review depends on county.
- `trustContext`: when provider exposure or routing depends on Trust/CVS.

### Law-Sensitive Constraints

- Must never reveal raw requester contact before approval and release.
- Must display current contact state.
- Must show who must act next.
- Must separate `requester_approved` from `contact_released`.
- Must not treat provider visibility, matching, or assignment as contact access.
- Must allow staff/admin review without implying staff has bypassed requester approval.

### Must-Not-Hide Controls

- Current contact state.
- Who must act next.
- Request contact.
- Approve contact.
- Deny contact.
- Release contact.
- Closed/denied state explanation.
- Private contact hidden notice before release.

### Required States

- `contact_hidden`: contact is locked; no raw contact shown.
- `provider_requested_contact`: provider has asked; requester or staff-visible next action is clear.
- `requester_approved`: requester approved contact, but release may still require platform/staff action.
- `contact_released`: contact can be shown only to authorized parties.
- `denied`: contact request denied; no raw contact shown.
- `closed`: workflow ended; no new contact action unless reopened through a valid route.

### Accessibility / Readability Expectations

- The current state must be visible text, not color-only.
- Primary action labels must be explicit.
- Disabled actions must explain why when possible.
- Screen readers must receive state and next-action text.
- Raw contact redaction must be understandable without relying on icons alone.

### Mobile Behavior Expectations

- Primary allowed action remains visible without horizontal scrolling.
- Secondary actions may move to a sheet/menu, but state and next actor stay visible.
- Contact state must not be hidden below collapsed content.
- Touch targets must remain usable for approve/deny/release decisions.

### Future Migration Targets

- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `client/src/pages/contractor-dashboard.tsx`
- `client/src/pages/contractor-leads.tsx`
- `client/src/pages/admin-direct-connect-requests.tsx`
- `client/src/components/admin/AdminDirectConnectRequestCard.tsx`
- Exchange/profile contact dialogs where contact gate rules apply.

### Required Tests Before Adoption

- State matrix test for all six required states.
- Provider-facing no-contact-leak test before release.
- Requester approve/deny/release action visibility test.
- Staff/admin variant preserves review and release controls.
- Mobile render test confirms state and next actor remain visible.

## `LawAwareCtaBlock`

### Purpose

Provide a standard CTA block for actions that create, route, contact, claim, verify, publish, or otherwise change law-sensitive state.

### Allowed Use Cases

- Public landing primary action.
- Direct Connect composer review/submit.
- Auth-gated sign-in/create-account return prompts.
- Provider request-contact.
- Requester contact approval/denial.
- Staff review actions.
- Claim business/profile.
- Community or Exchange publish prompts where auth/gating applies.

### Forbidden Use Cases

- Multiple competing primary CTAs in one viewport/context.
- CTA copy implying that seeing a provider/requester grants contact.
- Pay-to-play, boost, bought-rank, lead-selling, or lead-purchase framing.
- CTA that skips review for request creation.
- CTA that makes HomeID or verification appear required when it is optional for the action.

### Required Props / State Shape Conceptually

- `audienceContext`: public, requester, provider, staff, or admin.
- `primaryAction`: one law-sensitive action or a safe non-sensitive action.
- `secondaryActions`: optional, lower emphasis actions.
- `safetyCopy`: required for law-sensitive actions.
- `authRequirement`: none, sign-in, create-account, or role-required.
- `reviewRequirement`: none, review-first, Decision Card, or staff review.
- `disabledReason`: required when primary action cannot run.

### Law-Sensitive Constraints

- Must support one primary CTA per viewport/context.
- Must include safety copy where action is law-sensitive.
- Must not imply visibility grants contact.
- Must not use pay-to-play or lead-selling framing.
- Must distinguish public, requester, provider, staff, and admin contexts.
- Must preserve auth-gated request creation.

### Must-Not-Hide Controls

- Primary CTA.
- Required safety copy.
- Sign in/create account when auth is required.
- Review request/Decision Card action.
- Skip optional HomeID where present.
- Cancel/back or safe alternative when user is not ready.

### Required States

- `ready`: action can run.
- `needs_auth`: action requires sign-in/create-account first.
- `needs_review`: action requires review or Decision Card first.
- `needs_role`: action requires provider/staff/admin authority.
- `disabled`: action unavailable with visible reason.
- `complete`: action already completed.

### Accessibility / Readability Expectations

- The primary CTA label must be direct and short.
- Safety copy must be readable at mobile density.
- Disabled state must not rely on color only.
- Button order must be consistent across contexts.

### Mobile Behavior Expectations

- One primary CTA remains pinned or visibly reachable in the active context.
- Secondary actions may stack or move to a sheet.
- Safety copy must stay near the primary action for contact/request/auth flows.

### Future Migration Targets

- `client/src/pages/TradeScoutLandingPage.tsx`
- Direct Connect composer review and auth prompts.
- Provider request-contact areas.
- Profile/business contact CTAs.
- Community/Exchange publish prompts.

### Required Tests Before Adoption

- Public CTA contract contains `Start a Request` and excludes stale `Start Direct Connect`.
- Law-sensitive CTA requires safety copy.
- Context variants for public, requester, provider, staff, and admin.
- No pay-to-play or lead-selling phrases in CTA block literals.
- Auth-required state preserves safe return path.

## `RequestCard`

### Purpose

Show request identity, workflow state, county context, trade/category, trust/routing status, contact-gate state, and next action consistently across requester, provider, and staff surfaces.

### Allowed Use Cases

- Requester `My Requests`.
- Direct Connect inbox.
- Provider board.
- Staff/admin Direct Connect review.
- Dashboard summaries.
- Scout result/action cards that preview a request without releasing contact.

### Forbidden Use Cases

- Exposing private requester contact before `contact_released`.
- Collapsing critical contact or routing state into hover-only UI.
- Removing provider/staff operational controls needed to act.
- Hiding county/routing context when it affects assignment or staff review.
- Showing raw HomeID/private property history by default.

### Required Props / State Shape Conceptually

- `variant`: requester, provider, staff, admin, or public preview.
- `requestId`, `title`, `descriptionSummary`.
- `requestStatus`.
- `contactGateState`.
- `countyContext`.
- `tradeOrCategory`.
- `trustRoutingState`.
- `nextAction`.
- `availableActions`.
- `redactedRequesterIdentity`.
- `safeHomeContext`: optional, requester-approved summary only.

### Law-Sensitive Constraints

- Must show request status, county context, trade/category, trust/routing state, and next action.
- Must never expose private requester contact before gate release.
- Must support provider/staff/requester variants.
- Must preserve role-specific operational controls.
- Must not collapse critical law-sensitive status into hidden-only UI.
- Must not display Trust/CVS as paid priority.

### Must-Not-Hide Controls

- Request status.
- Contact gate state.
- County/service-area context.
- Trade/category.
- Trust/routing state when present.
- Next action.
- Provider request-contact action.
- Requester approve/deny/release actions where valid.
- Staff review/routing actions where valid.

### Required States

- `draft`.
- `review_required`.
- `submitted`.
- `routing`.
- `provider_responded`.
- `provider_requested_contact`.
- `requester_approved`.
- `contact_released`.
- `denied`.
- `closed`.

### Accessibility / Readability Expectations

- State and next action must be textual.
- Cards must have a clear accessible label or heading.
- Important controls must be keyboard reachable.
- Badge-only information must have visible text or accessible labels.

### Mobile Behavior Expectations

- Request state, contact state, and next action stay above collapsed detail.
- Actions may stack, but approve/deny/request-contact must remain reachable.
- County/trade context must remain visible on compact cards.

### Future Migration Targets

- `DirectConnectInbox`
- `MyDirectConnectRequests`
- provider board/request lists
- admin Direct Connect request review cards
- dashboard request summaries
- Scout request preview/action cards

### Required Tests Before Adoption

- Variant tests for requester, provider, staff, admin, and public preview.
- Contact redaction test for all non-released states.
- Required field render test for status, county, trade/category, trust/routing state, and next action.
- Role-specific action visibility tests.
- Mobile compact render test for state and next action visibility.

## `FormStepShell`

### Purpose

Standardize progressive multi-step forms so simplification groups fields without deleting fields, weakening auth, or making optional HomeID look mandatory.

### Allowed Use Cases

- Direct Connect request composer.
- Onboarding/profile setup.
- Claim business/profile.
- HomeID record creation.
- Marketplace/Exchange listing creation.
- Provider/business profile edit.

### Forbidden Use Cases

- Removing fields during simplification.
- Placing optional HomeID before required request intent/location/detail fields in a way that blocks progress.
- Allowing anonymous public posting.
- Submitting a request without review when review is required.
- Hiding required errors or disabled submit reasons.

### Required Props / State Shape Conceptually

- `steps`: ordered list with stable ids.
- `currentStepId`.
- `requiredFieldsByStep`.
- `optionalSections`.
- `draftState`: none, unsaved, saved, restored, or failed.
- `authGateState`: anonymous, authenticated, needs-auth, role-required.
- `reviewState`: not-ready, ready-for-review, reviewed, submitted.
- `submitAction`.
- `skipOptionalAction`: for HomeID or other optional context.

### Law-Sensitive Constraints

- Must support progressive sections without deleting fields.
- Must keep required request fields before optional HomeID.
- Must make HomeID optional/secondary.
- Must preserve anonymous draft behavior.
- Must support auth-gated submit state.
- Must separate save/draft from submit/post.

### Must-Not-Hide Controls

- Current step and progress.
- Back/continue.
- Save draft or equivalent draft status where supported.
- Skip optional HomeID.
- Review request.
- Sign in/create account to send when auth is required.
- Required-field errors.
- Submit disabled reason.

### Required States

- `anonymous_draft`.
- `draft_restored`.
- `editing`.
- `missing_required_fields`.
- `ready_for_review`.
- `review_required`.
- `needs_auth_to_submit`.
- `submitting`.
- `submitted`.
- `submit_failed`.

### Accessibility / Readability Expectations

- Step labels and progress must be textual.
- Required fields must be announced and visually clear.
- Error summaries must be reachable.
- Back/continue/submit controls must be keyboard usable.
- Review step must expose what will and will not be shared.

### Mobile Behavior Expectations

- Current step, primary action, and required errors remain visible without horizontal scrolling.
- Long forms may collapse optional sections, but not required fields or review/auth gates.
- HomeID optional controls must remain explicit on mobile.

### Future Migration Targets

- `DirectConnectRequestComposer`
- `PreScoutSetup`
- onboarding intent/profile flows
- claim business/profile forms
- HomeID record creation
- marketplace listing creation

### Required Tests Before Adoption

- Required-before-optional ordering test.
- Missing HomeID does not block Direct Connect request creation.
- Anonymous draft persists through auth return.
- Submit requires auth where applicable.
- Review step appears before submit.
- Required errors remain visible on mobile/compact layout.

## Cross-Primitive Adoption Rules

- Create tests before migrating a high-risk screen.
- Migrate one surface at a time.
- Prefer wrapper/adaptor use before deleting local UI logic.
- Do not merge visual cleanup with behavior changes.
- Do not remove legacy routes as part of primitive adoption.
- Keep provider/staff/admin operational controls visible or explicitly relocated with tests.

## Minimum Required Contract Tests

Before these primitives are adopted in production screens, test coverage must pin:

- All `DecisionContactGatePanel` states.
- No raw requester contact before `contact_released`.
- One primary `LawAwareCtaBlock` CTA per viewport/context.
- Public CTA avoids stale `Start Direct Connect`.
- No pay-to-play or lead-selling CTA phrasing.
- `RequestCard` role variants preserve required fields and controls.
- `FormStepShell` keeps required request fields before optional HomeID.
- Anonymous draft and auth-gated submit behavior.
- County context visibility where routing depends on it.
- Staff/provider/admin reachability where primitives appear.

## Acceptance Status

- P2 contract doc exists: complete.
- Critical law-sensitive primitive invariants are explicit: complete.
- No functional UI code changed: required for acceptance.
- Future UI simplification has enforceable guardrails: complete when paired with the doc contract test.

