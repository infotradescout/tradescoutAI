# Direct Connect Execution Contract (Required Layer)

Direct Connect is not a generic inbox.
Direct Connect is the contact and coordination authority layer of the TradeScout OS.

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