# Scout Interaction Logging - Backend Integration Guide

## Overview

This guide explains how Scout (the chat controller) integrates with the three-pipeline architecture for logging interactions while protecting mission invariants.

**Key Rule**: Real users → all 3 pipelines | Bots → pipelines 1 & 2 only

---

## Architecture: Three Pipelines

```
Scout Session Starts
    ↓
    ├─ PIPELINE 1: Action Execution
    │  └─ Real backend calls (invoices, routing, profile updates)
    │     └─ Every execution logged in ScoutActionExecution
    │
    ├─ PIPELINE 2: Observation Recording
    │  └─ Session structure, turns, choices, friction signals
    │     └─ Always logged (real users + bots)
    │
    └─ PIPELINE 3: Learning (Real Users Only)
       └─ Guard: if (isTestRun) return null
          └─ Updates heuristics, prompts, confidence thresholds
             └─ Bots NEVER reach this pipeline
```

---

## What Each Pipeline Logs

### Pipeline 1: Action Execution (Always)

Every Scout action that touches the backend:

```typescript
// Example: Scout creates an invoice
const execution = await scoutLogger.addActionExecution({
  actionId: 'scout_create_invoice_' + invoiceId,
  actionType: 'create_invoice',
  offered: true,
  selected: true,
  executed: true,
  executionPath: 'scout_direct', // or 'user_routed'
  result: 'success', // or 'partial' / 'failed'
  metadata: {
    actionDurationMs: duration,
    targetResourceId: invoiceId,
    targetResourceType: 'invoice',
  },
});
```

**Used for**: Capability analysis, action success tracking, performance metrics

---

### Pipeline 2: Observation Recording (Always)

Session structure, conversation turns, friction signals:

```typescript
// Session setup
const logger = new ScoutInteractionLogger({
  sessionId: request.sessionId,
  userId: user?.id || null,
  isTestRun: request.headers['X-Test-Run'] === 'true' || user?.isTestAccount,
  mode: detectMode(user), // 'onboarding' | 'post_onboarding' | 'freeform'
});

// Each turn
logger.addTurn({
  role: 'scout',
  message: 'What would you like to do?',
  intentDetected: ['find_service', 'ask_question'],
  actionsOffered: [
    { id: 'contact_service', type: 'contact', label: 'Contact them' },
    { id: 'browse_more', type: 'browse', label: 'See more options' },
  ],
});

// When user hesitates
logger.addFrictionSignal({
  turnNumber: currentTurnNumber,
  signalType: 'user_asked_why',
  context: {
    scoutMessage: lastScoutMessage,
    userMessage: currentUserMessage,
    actionOffered: lastAction,
  },
  severity: 'medium',
});
```

**Used for**: Language refinement, friction detection, user hesitation analysis

---

### Pipeline 3: Learning (Real Users Only)

Hard-guarded: bots cannot reach this pipeline.

```typescript
// Gatekeeper check
const canLearn = !request.isTestRun && !user.isTestAccount;

if (canLearn) {
  // Update heuristics based on real user behavior
  await updateScoutHeuristics({
    sessionLog: logger.getSessionLog(),
    frictionSignals: logger.getFrictionSignals(),
    actionMetrics: logger.getActionExecutions(),
  });
}

// For bots, getObservationsForLearning() returns null
const learningData = logger.getObservationsForLearning();
// learningData === null because isTestRun === true
```

**What Updates**:
- ✅ Prompt variants based on which phrasing reduces hesitation
- ✅ Question ordering based on user skip patterns
- ✅ Action defaults based on selection frequency
- ✅ Confidence thresholds based on success rates
- ✅ Follow-up phrasing based on user comprehension

**What NEVER Updates**:
- ❌ Business rankings or recommendations
- ❌ User reputation or trust scores
- ❌ Cross-user data leakage
- ❌ Automatic prompt modifications (human review required)

---

## Scout Action Contract (Per Request)

Every Scout action follows this pattern:

### Step 1: Offer Control

```typescript
// Scout ALWAYS offers a choice
scout.message = "I can create an invoice for you, or I can take you to invoicing. Which do you prefer?"

scout.actionsOffered = [
  { id: 'scout_direct', label: 'You do it', type: 'create_invoice' },
  { id: 'user_routed', label: 'Take me there', type: 'route_to_invoicing' },
]
```

### Step 2: Log Explicit Choice

```typescript
logger.addTurn({
  role: 'user',
  actionChosen: userSelectedAction, // User picks one
})
```

### Step 3: Execute Truthfully

```typescript
try {
  if (action.executionPath === 'scout_direct') {
    // Call real endpoint
    const result = await api.createInvoice(invoiceData);
    
    logger.addActionExecution({
      actionType: 'create_invoice',
      executed: true,
      executionPath: 'scout_direct',
      result: 'success',
    });
  } else if (action.executionPath === 'user_routed') {
    // Navigate user
    response.redirect('/invoicing');
    
    logger.addActionExecution({
      actionType: 'route_to_invoicing',
      executed: true,
      executionPath: 'user_routed',
      result: 'success',
    });
  }
} catch (error) {
  logger.addActionExecution({
    executed: true,
    executionPath: action.executionPath,
    result: 'failed',
    errorCode: error.code,
    errorMessage: error.message,
  });
}
```

### Step 4: Report Result

```typescript
// No silent failures
scout.message = result.success
  ? "Done! Invoice created and ready to send."
  : "That didn't work. Here's what went wrong: [error details]"

scout.actionExecuted = true
scout.executionResult = result.success ? 'success' : 'failed'
```

---

## Bot Detection (Hard Guard)

```typescript
// Bots identified by:
function isTestRun(request) {
  return (
    request.headers['X-Test-Run'] === 'true' ||
    request.headers['User-Agent']?.includes('ScoutBot') ||
    request.user?.isTestAccount
  );
}

// In logger initialization
const logger = new ScoutInteractionLogger({
  isTestRun: isTestRun(request),
  // ... other config
});

// Hard guard in learning pipeline
if (logger.getObservationsForLearning() === null) {
  // Bots excluded - no learning occurs
  console.log('🤖 Test run excluded from learning');
}
```

---

## Weekly Insight Generation

Every Monday, auto-generate summaries (no manual transcript reading):

```typescript
// Backend job (nightly)
async function generateWeeklyInsights() {
  const week = await db.scoutSessions.findWeeklyRealUsers();
  const summary = InsightGenerator.generateWeeklySummary(week);
  
  // Output:
  // {
  //   period: "2026-01-01 to 2026-01-07",
  //   totalSessions: 342,
  //   realUserSessions: 320,
  //   testRunSessions: 22,
  //   stats: {
  //     avgActionSuccessRate: 94,
  //     avgTurnsPerSession: 7.2,
  //     totalFrictionSignals: 45,
  //     topFrictionType: 'user_asked_why',
  //   },
  //   insights: [
  //     "37% of users asked 'why' after Scout suggested invoicing",
  //     "Invoices selected for Scout-direct 68% of the time",
  //     "Profile publishing has 12% abandonment rate"
  //   ]
  // }
  
  // Email to founder
  sendInsightEmail(summary);
  
  // Store for dashboard
  await db.scoutInsights.save(summary);
}
```

---

## Dashboard Displays

### Real User View
```
This Week
─────────────────────
Sessions: 320 (vs 22 test runs)
Avg Turns: 7.2
Action Success: 94%

Top Friction: "user_asked_why" (45 instances)
- Most common: Publish profile action
- Insight: Users want clearer explanation of benefits

Top Action: create_invoice (68% Scout-direct, 32% route)
- Insight: Users trust Scout with invoicing
```

### Friction Heatmap
```
Action Type       | Asked Why | Skipped | Abandoned | Success
────────────────────────────────────────────────────────────
create_invoice    |    3      |    2    |     0     |   95
publish_profile   |    18     |    12   |     2     |   68
contact_service   |    8      |    4    |     3     |   85
claim_business    |    12     |    1    |     0     |   88
```

---

## Key Implementation Rules

### Always Offer Control
```
❌ "I've created an invoice for you"
✅ "I can create an invoice or show you how. Which?"
```

### Never Silent Failures
```
❌ [silently fails to send email, user never knows]
✅ "Email failed to send. Here's why. Want to try again?"
```

### Mark Test Runs
```typescript
if (request.headers['X-Test-Run'] === 'true') {
  // Bots marked explicitly
  logger = new ScoutInteractionLogger({ isTestRun: true });
}
```

### Guard Learning Pipeline
```typescript
const learningData = logger.getObservationsForLearning();
if (learningData === null) {
  // Test run - skip learning entirely
  return;
}
// Real user - safe to learn from
```

### Human-Approve Changes
```
Scout learns → Human reviews suggestions → Approve/reject changes
Never: Scout autonomously modifies prompts/rankings/flows
```

---

## Types Reference

See [tests/utils/scoutLogger.ts](../utils/scoutLogger.ts) for:
- `ScoutSessionLog` - Full session with turns + friction
- `ScoutTurn` - Single conversation turn
- `ScoutAction` - Offered action
- `ScoutActionExecution` - Logged execution
- `ScoutFrictionSignal` - Where users hesitated
- `InsightSummary` - Weekly auto-generated insights

---

## Testing with Bot Army

Bot Army tests use the same logger:

```typescript
// tests/journeys/scout_interaction_logging.spec.ts
scoutLogger = new ScoutInteractionLogger({
  isTestRun: true, // ← Explicitly marked
  mode: 'freeform',
});

// Tests verify:
// ✓ Actions offered correctly
// ✓ Friction signals detected
// ✓ Learning pipeline returns null (hard guard works)
// ✓ No silent failures
// ✓ Results truthfully reported
```

---

## Deployment Checklist

- [ ] Scout logs `ScoutSessionLog` for every session
- [ ] Every action includes `ScoutAction` offer + choice
- [ ] `ScoutActionExecution` logged for every backend call
- [ ] `ScoutFrictionSignal` added when user hesitates
- [ ] `isTestRun` header sent for all bot requests
- [ ] `getObservationsForLearning()` returns null for bots
- [ ] Weekly insights auto-generated and emailed
- [ ] Dashboard shows friction heatmap and action metrics
- [ ] Learning changes human-reviewed before deployment

---

## Example: Complete Flow

```typescript
// 1. User starts session with Scout
POST /api/scout/chat
{
  sessionId: 'sess_xyz',
  message: 'How do I invoice someone?',
  userId: 'user_123'
}

// 2. Scout logs session
const logger = new ScoutInteractionLogger({
  sessionId: 'sess_xyz',
  userId: 'user_123',
  isTestRun: false, // Real user
  mode: 'freeform',
});

// 3. Scout detects intent & offers action
logger.addTurn({
  role: 'scout',
  message: 'I can create an invoice for you, or show you how. Which?',
  intentDetected: ['request_invoice'],
  actionsOffered: [createAction, showAction],
});

// 4. User chooses
logger.addTurn({
  role: 'user',
  message: 'You do it',
  actionChosen: createAction,
});

// 5. Scout executes
const invoice = await api.createInvoice({...});
logger.addActionExecution({
  executed: true,
  executionPath: 'scout_direct',
  result: 'success',
});

// 6. Scout confirms (truthfully)
logger.addTurn({
  role: 'scout',
  message: 'Done! Invoice #INV-001 created and ready to send.',
  executionResult: 'success',
});

// 7. Session ends, learning happens (because isTestRun=false)
const learningData = logger.getObservationsForLearning(); // ← Returns data
// Updates: prompt variants, confidence thresholds, ordering

// Weekly: Insights auto-generated
// "68% of users chose Scout-direct for invoicing"
// "User hesitation on publish_profile - clarify language"
```

---

**This architecture achieves**:
✅ Real user learning without contamination from bots  
✅ Observable, explainable heuristic updates  
✅ Protection of mission (control never taken from user)  
✅ Founder intelligence without transcript reading  
✅ Measurable friction for language refinement
