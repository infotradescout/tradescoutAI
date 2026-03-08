# Scout Full System Architecture (Implementation Map)

This document maps the approved Scout architecture to source files in this bundle.

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
