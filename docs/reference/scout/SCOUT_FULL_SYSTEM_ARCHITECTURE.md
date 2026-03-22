# Scout Full System Architecture (Implementation Contract)

This document defines the approved Scout architecture for the live TradeScout repository and maps each layer to source files.

## Scout Execution Contract (Required Layer)
Scout is not a chatbot.
Scout is the intent routing engine of the TradeScout OS.

### Primary Responsibilities
- Understand intent
- Clarify missing information
- Create an objective
- Present actionable decisions
- Route to platform tools
- Track outcome

Scout never bypasses these steps.

### Scout Core Loop
Every request must pass through the same execution pipeline.

User Input -> Intent Detection -> Situation Analysis -> Clarification (if required) -> Objective Creation -> Decision Generation -> Platform Routing -> Outcome Tracking

This prevents random AI behavior.

### Allowed Scout Actions
The governor enforces four legal behaviors:
- COMPLY
- DEFER
- REDIRECT
- BLOCK

#### COMPLY
Action is safe and confident.
Example: user asks for nearby plumbers, Scout routes to contractor list.

#### DEFER
More information is required.
Example: user asks for concrete work, Scout asks scope questions.

#### REDIRECT
Correct surface exists elsewhere.
Example: user asks to sell a skid steer, Scout routes to Exchange.

#### BLOCK
Action violates platform policy.
Example: user attempts to bypass trust/contact gates.

### Scout Roles
Scout dynamically adopts a role depending on situation:
- INTERPRETER
- AUTHORITY
- SAFEGUARD
- EXECUTOR

Role semantics:
- INTERPRETER: user intent unclear
- AUTHORITY: user needs strong guidance
- SAFEGUARD: user action is risky
- EXECUTOR: user knows exactly what they want

Roles control tone and routing behavior.

### Objective System (Core OS Concept)
Scout converts conversations into objectives.

Example:
- User input: I need a concrete slab
- Objective created: Concrete foundation project

Objectives contain:
- Goal
- Constraints
- Unknowns
- Required steps
- Next action
- Confidence level

Objectives persist until resolved.

### Clarifier Rules
Clarifier must extract minimum viable project information before routing.

Typical fields:
- Trade type
- Location
- Urgency
- Scope
- Materials status
- Photos
- Timeline

If confidence is below threshold, Scout must DEFER and ask clarification questions.

### Decision Card Rules
Scout does not respond with paragraphs only.
Scout responds with actions.

Examples:
- Request bids
- Direct connect
- View nearby contractors
- Upload photos
- Check pricing

Cards represent platform actions, not suggestions.

### Platform Routing Rules
Scout routes actions to products:
- Exchange
- HomeScout
- Direct Connect
- Community
- Maps
- TradeDeals

Scout never performs the action itself.
It launches the correct platform surface.

### Confidence Engine Rules
Confidence determines Scout authority.

Inputs:
- Intent clarity
- Project scope completeness
- Historical outcomes
- Trust signals
- Tool reliability

Output:
- confidenceScore

Confidence affects:
- Role selection
- Decision strength
- Routing behavior

### Governance Rules
Governor enforces platform integrity.

Governor checks:
- Risk level
- Policy compliance
- Brand alignment
- User trust state

Governor may override Scout behavior.

### Memory Rules
Scout tracks:
- Conversation context
- User preferences
- Completed objectives
- Platform outcomes

Memory improves future routing.

### Analytics Rules
Scout tracks:
- Objective completion rate
- Decision card engagement
- Platform routing success
- Confidence accuracy

These metrics improve system tuning.

### System Boundaries
Scout must not become a marketplace.
Scout must not become a chat system.

Scout is strictly:
- Intent Engine
- Decision Engine
- Platform Router

The rest of TradeScout performs execution.

### Structural Risk (Current)
Biggest architectural risk remains two routing layers:
- `client/src/scout/ScoutActionRouter.ts`
- `server/services/scoutPlatformRouter.ts`

Two routers can diverge.
Long-term fix: single routing authority (for example, PlatformActionRouter where client sends request and server decides route).

### Scout Product Definition
Scout exists to answer one question:
What should I do next?

It then routes users into the correct TradeScout tool.

### Scout in TradeScout OS
- Scout: demand engine
- Exchange: supply engine
- Community: trust engine
- Maps: geographic engine
- Messages: transaction engine
- HomeScout: property lifecycle engine

Scout connects all of them.

### Required User-Facing Surfaces Layer
Scout must expose clear user-facing surfaces for discoverability:
- Quick Request
- Project Planner
- Ask Scout
- Find a Pro
- Sell Something
- Property Help

## 1) User Entry Layer
- Scout Landing:
  - `client/src/pages/ScoutLanding.tsx`
  - `client/src/scout/index.tsx`
- Scout Input:
  - `client/src/scout/ScoutInput.tsx`
  - `client/src/scout/ScoutInputRow.tsx`
- Scout Thread (conversation):
  - `client/src/scout/ScoutThread.tsx`
- Onboarding Prompt:
  - `client/src/scout/OnboardingPrompt.tsx`
  - `client/src/scout/useScoutOnboarding.ts`
- Continue Banner:
  - `client/src/components/scout/ScoutContinueBanner.tsx`

## 2) Intent Detection Engine
- Deterministic Intent Detection:
  - `server/services/scoutDeterministicIntent.ts`
- Local Intent Library:
  - `client/src/scout/localIntents.ts`
- Claim Inference:
  - `client/src/scout/claimInference.ts`
- Context Role Detection:
  - `client/src/scout/contextRoles.ts`
- Context Analyzer:
  - `server/services/scoutContextAnalyzer.ts`

## 3) Objective System
- Objective Creation / Tracking / Resolution:
  - `server/scout/objectivesService.ts`
- Objective Chip:
  - `client/src/scout/ObjectiveChip.tsx`

## 4) Clarification Layer
- Project Clarifier:
  - `server/scout/projectClarifier.ts`
- Follow-up / Context Expansion / Scope Validation (supporting flow):
  - `server/services/scoutContextAnalyzer.ts`
  - `server/scout/confidenceScope.ts`
  - `client/src/scout/ScoutThread.tsx`

## 5) Decision Card System
- Action Cards / Post-Onboarding Cards:
  - `client/src/scout/PostOnboardingActionCard.tsx`
  - `client/src/scout/ClaimConfirmationCard.tsx`
- CTA Helpers:
  - `client/src/scout/ctaHelpers.ts`
- Scout Tiles:
  - `client/src/scout/scoutActionTiles.ts`
  - `client/src/scout/resolveScoutTiles.ts`

## 6) Action Router
- Scout Action Router:
  - `client/src/scout/ScoutActionRouter.ts`
- Action Connectors:
  - `server/services/scoutActionConnectors.ts`
- Tool Discovery:
  - `server/scout/toolDiscovery.ts`
  - `server/scout/toolDiscoveryDB.ts`
  - `server/scout/toolDiscoveryObserver.ts`
- Platform Router:
  - `server/services/scoutPlatformRouter.ts`

## 7) Platform Integrations
- Exchange:
  - `server/services/scoutPlatformRouter.ts`
  - `client/src/agent/tools/scoutTools.ts`
- Direct Connect:
  - `client/src/scout/ScoutDirectConnectPanel.tsx`
  - `server/services/scoutPlatformRouter.ts`
- Community:
  - `server/services/scoutPlatformRouter.ts`
- Maps:
  - `server/services/scoutPlatformRouter.ts`
- HomeScout:
  - `client/src/pages/homescout-county.tsx`
  - `client/src/pages/homescout-listing.tsx`
  - `server/services/scoutPlatformRouter.ts`
- TradeDeals:
  - `server/services/scoutPlatformRouter.ts`

## 8) Response Builder
- Message Builders:
  - `client/src/scout/messageBuilders.ts`
- Response Shape Generator:
  - `server/scout/responseShape.ts`
- Response Quality Check:
  - `client/src/scout/responseQuality.ts`
- Human Feel Layer:
  - `client/src/scout/scoutHumanFeel.test.ts` (guardrail tests)

## 9) Confidence Engine
- Confidence Scorer:
  - `server/scout/confidenceScorer.ts`
  - `server/utils/scoutConfidenceScoring.ts`
- Confidence Scope:
  - `server/scout/confidenceScope.ts`
- Risk Classifier:
  - `server/scout/riskClassifier.ts`
- Action Validation:
  - `client/src/scout/actionValidation.ts`
  - `server/services/scoutToolValidation.ts`

## 10) Governance Layer
- Scout Governor:
  - `server/scout/governor.ts`
- Brand Guard:
  - `server/scout/brandGuard.ts`
- Scout Policy:
  - `server/services/scoutPolicy.ts`
- Action Guard:
  - `server/utils/scoutActionGuard.ts`

## 11) Memory System
- Scout Memory Service:
  - `server/services/scoutMemoryService.ts`
- Context History (conversation/state support):
  - `client/src/scout/state.ts`
  - `client/src/scout/provenance.ts`
- Provenance Tracking:
  - `client/src/scout/provenance.ts`
- Outcome Tracking:
  - `server/scout/outcomeTracker.ts`

## 12) Agent Layer
- Specialized Agents:
  - `server/services/scoutSpecializedAgents.ts`
- Agent Supervisor:
  - `server/services/scoutAgentSupervisor.ts`
- Tool Integration:
  - `client/src/agent/tools/scoutTools.ts`
  - `client/src/agent/tools/scoutMutations.ts`
  - `client/src/agent/tools/scoutCopyAssist.ts`
- Tool Validation:
  - `server/services/scoutToolValidation.ts`

## 13) Proactive Intelligence
- Platform Discovery:
  - `server/routes/scout-platform-discovery.ts`
  - `server/scout/toolDiscovery.ts`
- Recommendations:
  - `server/routes/scout-recommendations.ts`
- Proactive Alerts:
  - `server/services/scoutProactiveAlerts.ts`
- Watchdog Monitoring:
  - `server/services/scoutWatchdog.ts`
  - `server/routes/scout-watchdog.ts`

## 14) Analytics
- Scout Analytics:
  - `server/routes/scout-analytics.ts`
- CTA Tracking:
  - `server/routes/scout-cta-check.ts`
- Outcome Metrics:
  - `server/scout/outcomeTracker.ts`
- Usage Monitoring:
  - `server/services/scoutWatchdog.ts`

## Operational Flow
User request -> Intent detection -> Clarification -> Objective creation -> Decision cards -> Platform routing -> Outcome tracking

## Core Engine Files
- `server/services/scoutDeterministicIntent.ts`
- `server/scout/projectClarifier.ts`
- `server/scout/confidenceScorer.ts`
- `server/scout/governor.ts`
- `client/src/scout/ScoutActionRouter.ts`
- `server/scout/objectivesService.ts`
- `server/services/scoutPlatformRouter.ts`

## Structural Risk Note
Current architecture has two routing layers:
- `client/src/scout/ScoutActionRouter.ts`
- `server/services/scoutPlatformRouter.ts`

If they diverge, Scout routing can drift. Consolidation should happen through an approved authority decision before behavior changes.
