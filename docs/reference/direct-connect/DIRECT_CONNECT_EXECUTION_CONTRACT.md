# Direct Connect Execution Contract (Required Layer)

Direct Connect is not a generic inbox.
Direct Connect is the contact and coordination authority layer of the TradeScout OS.

## Direct Connect Invariant

Direct Connect is the only system authorized to create contractor-user contact relationships on TradeScout.

No other service, route, or tool may establish direct contact between parties outside the Direct Connect lifecycle.

## Primary Responsibilities
- Control who can contact whom
- Enforce trust and anti-spam gates
- Manage request acceptance flow
- Create and maintain valid connection state
- Preserve outcome traceability for coordination episodes

Direct Connect never bypasses these responsibilities.

## Core Loop
Every contact/coordination request must pass this pipeline:

Intent enters via Scout or Direct Connect surface
-> Request normalization
-> Trust and policy evaluation
-> Routing and candidate selection
-> Acceptance/decline handling
-> Connection state update
-> Outcome tracking

This prevents spammy or policy-breaking contact behavior.

## Allowed Entry Sources

Direct Connect requests may originate from:
- Scout
- Exchange listing actions
- HomeScout property maintenance actions
- Admin provisioning tools

Direct Connect requests must NOT originate from:
- Open messaging
- User profile messaging
- Community posts that bypass request creation
- External links that bypass lifecycle enforcement

Any new entry source requires governance approval and an update to this contract in the same PR.

## Allowed Direct Connect Actions
The system may only perform these legal behaviors for a request episode:
- ACCEPT
- DECLINE
- ROUTE
- HOLD

### ACCEPT
Request is valid and a provider/contact accepts.
Result: conversation or connection path is unlocked per policy.

### DECLINE
Provider/contact declines request.
Result: requester sees status update; no direct messaging unlock.

### ROUTE
Request is valid for exposure/routing.
Result: request is pushed to eligible providers/audiences.

### HOLD
Request cannot progress yet.
Result: request remains gated pending required info or trust conditions.

## Trust and Contact Gate Rules
- No open direct messaging before acceptance gate conditions are met.
- Contact revelation must remain intent-gated and policy-compliant.
- Trust/CVS constraints always override convenience.
- Anti-spam controls are mandatory; no bypass path for speed.
- Admin-initiated requests still enter normal Direct Connect lifecycle.

## Request Lifecycle Rules
The canonical object is the Direct Connect request.

Lifecycle vocabulary (interpretation contract):
- Created
- Routing
- Awaiting responses
- In discussion
- Pending outcome
- Resolved
- Abandoned

All user-facing language, analytics interpretation, and Scout explanations must map to this vocabulary.

## Clarification and Minimum Data Rules
Before high-confidence routing, minimum viable request data must be present:
- Need description
- Local context (county/state where applicable)
- Work shape and urgency signals
- Any required constraints for safe routing

If minimum data is missing, the flow must HOLD and request clarification.

## Connection Creation Rules
- Connection state is created only through accepted, policy-compliant pathways.
- Connection creation must be auditable to a request and event trail.
- No hidden or ad-hoc connection records outside the canonical lifecycle.

## Governance Rules
Direct Connect enforcement must align with platform law:
- Visibility does not equal access.
- Contact remains gated by intent and trust.
- No pay-to-play bypass of trust constraints.
- County and authority semantics are preserved.

## Memory and Outcome Rules
Direct Connect must retain enough context to:
- Explain current coordination state
- Resume coordination without re-creating requests
- Record outcomes for tuning and accountability

Outcome tracking must remain tied to request episodes and state transitions.

## Analytics Rules
Track at minimum:
- Request-to-route conversion
- Route-to-response conversion
- Response-to-accept conversion
- Acceptance-to-outcome success
- Hold and decline rates by reason category

These metrics tune trust quality and routing precision.

## System Boundaries
Direct Connect must not become:
- A marketplace ranking engine
- A social messaging free-for-all
- A generic todo board

Direct Connect is strictly:
- Coordination state authority
- Contact gate authority
- Connection lifecycle authority

## Source Anchors (Current Implementation)
- Charter and doctrine:
  - `DIRECT_CONNECT_CHARTER.md`
  - `DIRECT_CONNECT_REQUEST_MODEL.md`
  - `DIRECT_CONNECT_STATE_VOCABULARY.md`
- Core client surface:
  - `client/src/pages/direct-connect/DirectConnectShell.tsx`
  - `client/src/pages/tasks.tsx`
- Core server routes:
  - `server/routes/direct-connect.ts`
- Scout integration touchpoints:
  - `client/src/scout/ScoutOS.tsx`
  - `server/routes/scout.ts`

## Product Definition
Direct Connect exists to answer:
Who can I safely coordinate with right now, and what is my next valid step?

It then advances the user through trusted request and connection states.

## TradeScout OS Placement
- Scout: demand engine
- Direct Connect: contact and coordination engine
- Exchange: supply engine
- Community: trust engine
- Maps: geographic engine
- Messages: transaction/conversation engine
- HomeScout: property lifecycle engine

Direct Connect protects signal quality across all downstream contact pathways.

## Contract Compliance Checklist

All changes affecting Direct Connect must pass the following checks.

### 1. Trust Gate Enforcement

PASS if:
- All contact attempts pass through trust/contact gating logic.
- `direct-connect.ts` enforces trust eligibility prior to conversation creation.

FAIL if:
- Messages or requests can be created without trust gate evaluation.

Implementation anchors:
- `server/routes/direct-connect.ts`
- `server/services/contactGateService.ts` (if present)

### 2. Legal Action Set Enforcement

Direct Connect actions must be limited to:

ACCEPT
DECLINE
ROUTE
HOLD

PASS if:
- State transitions use only the allowed actions.

FAIL if:
- New action types are introduced without updating the execution contract.

Implementation anchors:
- `server/routes/direct-connect.ts`
- `server/services/directConnectLifecycle.ts`

### 3. Lifecycle State Integrity

Direct Connect must enforce a deterministic lifecycle.

Allowed lifecycle:

Request Created
-> Contractor Review
-> Accept / Decline / Hold
-> Connection Created

PASS if:
- All state transitions follow this lifecycle.

FAIL if:
- Messages or contact occur before Accept.

Implementation anchors:
- `server/services/directConnectLifecycle.ts`
- `client/src/pages/direct-connect/DirectConnectShell.tsx`

### 4. Contact Creation Rules

Connections must only be created when:

- Contractor ACCEPTS
- Trust gate passes
- Request context exists

PASS if:
- Connection records are created only after ACCEPT.

FAIL if:
- Connections appear before acceptance or without a request context.

Implementation anchors:
- `server/services/connectionService.ts`

### 5. Spam Protection

Direct Connect must prevent uncontrolled messaging.

PASS if:
- Unsolicited messaging is blocked.
- Contact only occurs through approved lifecycle events.

FAIL if:
- Users can message contractors directly without request flow.

Implementation anchors:
- `server/routes/direct-connect.ts`
- `client/src/pages/direct-connect/DirectConnectShell.tsx`

### 6. Scout Routing Compliance

Scout must remain the primary demand engine.

PASS if:
- Scout routes requests into Direct Connect.

FAIL if:
- Direct Connect bypasses Scout routing without governance approval.

Implementation anchors:
- `server/services/scoutPlatformRouter.ts`

### 7. Contract Boundary Enforcement

Direct Connect must remain:

Contact coordination infrastructure.

Direct Connect must NOT become:

- A chat platform
- A social messaging system
- A lead marketplace

PASS if:
- All communication relates to a request or connection.

FAIL if:
- Open messaging appears between users.

### Review Requirement

Any PR affecting the following files requires contract review:

- `server/routes/direct-connect.ts`
- `client/src/pages/direct-connect/DirectConnectShell.tsx`
- `server/services/directConnectLifecycle.ts`
- `server/services/connectionService.ts`

### Implementation Path Note

Some documentation references the historical path:

- `client/src/components/directconnect/DirectConnectShell.tsx`

Current implementation resides at:

- `client/src/pages/direct-connect/DirectConnectShell.tsx`

For compliance checks, reviewers must validate the active implementation file.

If the file is relocated, the compliance checklist must be updated in the same PR.