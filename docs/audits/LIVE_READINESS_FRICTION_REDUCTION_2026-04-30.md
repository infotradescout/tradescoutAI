# Live Readiness Friction Reduction Audit

Date: 2026-04-30  
Scope: Read-only live readiness guidance, Direct Connect next-step copy, and Scout shortcut.

## Law Classification

| Law statement | Classification | Change evidence | Gate preserved |
|---|---|---|---|
| Visibility does not equal access | enforced | Direct Connect copy states next valid steps without exposing contact | No contact route opens without accepted Direct Connect coordination |
| Scout is the guided bridge from discovery to action | enforced | Scout quick-start prompt asks for the next valid step | Prompt routes through existing Scout readiness response, not a bypass |
| Contact is gated through intent and Direct Connect authority | enforced | Readiness resolver exposes `contactUnlocked` only after accepted/active coordination | Request routing, replies, messaging, and completion actions remain unchanged |
| Trust/CVS governs exposure | policy_target | Direct Connect request copy does not alter ranking or routing | No ranking, dispatch, CVS, or eligibility defaults changed |
| Claims-first signup and adaptive verification | policy_target | Profile/banner readiness separates profile basics from verification gates | No signup, claims, or verification semantics changed |

No `temporary_exception` was introduced.

## Psychological Intent

- Target belief: users should believe TradeScout can tell them the next valid step without making them decode product state.
- Target behavior: users ask Scout or follow the Direct Connect card action instead of abandoning setup, routing, or response review.
- Principles used: progressive disclosure, implementation intention, uncertainty reduction, and trust-by-constraint.
- Risk prevented: users mistaking visibility for contact permission, treating routed providers as actual replies, or thinking profile completion alone unlocks contact.

## What Changed

- Added a shared read-only readiness resolver for profile/live/Direct Connect state.
- Corrected Direct Connect requester projection so routed suggested providers are not counted as replies.
- Added Direct Connect request-card copy that names the current next step: send, wait, coordinate, confirm, resolved, or paused.
- Added responder inbox copy that distinguishes responding to a request from opening an accepted coordination thread.
- Added `What's my next step?` as the first Scout quick-start prompt.
- Added observation-only analytics for exact next-step prompt submits, Direct Connect readiness card openings, and profile-readiness banner CTA/dismiss events.
- Added focused contract tests for resolver, Scout readiness answer, profile banner state, Direct Connect copy, and Scout shortcut ordering.

## What Did Not Change

- No Direct Connect lifecycle status changed.
- No dispatch/routing ranking changed.
- No contact, messaging, or phone/email access was added.
- No responder accept/archive/follow-up handler behavior changed.
- No verification, claims, county, or authority defaults changed.
- No monetization or exposure behavior changed.
- No analytics event decides access, routing, ranking, or contact unlock.

## Verification

Focused command:

```bash
npm run test:run -- server/tests/live-readiness.contract.test.ts server/tests/scout-live-readiness-response.test.ts client/src/components/onboarding/ProfileCompletionBanner.state.test.ts client/src/pages/direct-connect/directConnectReadiness.test.ts client/src/scout/scoutQuickStartPrompts.test.ts
```

Expected result: 5 files pass, 32 tests pass.

Scoped editor checks should report no errors for:

- `shared/liveReadiness.ts`
- `server/routes/scout.ts`
- `server/scout/scoutLiveReadinessResponse.ts`
- `client/src/components/onboarding/ProfileCompletionBanner.tsx`
- `client/src/pages/direct-connect/directConnectReadiness.ts`
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `client/src/scout/scoutQuickStartPrompts.ts`

## Psychology Validation

Validate with funnel and support signals:

- Monitor `scout_live_readiness_prompt_submitted` to see whether users choose the guided next-step path.
- Monitor `direct_connect_next_step_card_opened` by label/action hint to identify where users continue or stall.
- Monitor `profile_readiness_banner_clicked` and `profile_readiness_banner_dismissed` by mode to find setup/verification friction points.
- Compare responder inbox acceptance/archival after labels change from generic reply language to explicit response/coordination language.
- More users click or ask `What's my next step?` from Scout before abandoning setup.
- More open/routed Direct Connect requests move to routed/review/coordination states without any increase in contact-bypass attempts.
- Fewer support/session-review events show confusion between routed providers and actual replies.
- `contactUnlocked` remains false in tests until accepted/active coordination exists.