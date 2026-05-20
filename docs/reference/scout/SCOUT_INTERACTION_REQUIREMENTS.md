# Scout Interaction Logging - What Must Be Recorded

**Purpose**: Systematically capture Scout conversations to enable learning while protecting mission and excluding bots from influencing behavior.

---

## Three Things You MUST Record

### 1️⃣ Scout Conversation Trace (Structured)

Every Scout session captures:

```typescript
ScoutSessionLog {
  sessionId           // Unique identifier
  userId              // User (null for anon)
  isTestRun: boolean  // ← CRITICAL: marks bots vs real users
  mode                // 'onboarding' | 'post_onboarding' | 'freeform'
  
  turns: [            // Each turn in conversation
    {
      role: 'user' | 'scout'
      intentDetected: ['search', 'contact', 'invoice']
      message: string
      actionsOffered: ScoutAction[]
      actionChosen: ScoutAction | null
      actionExecuted: boolean
      executionResult: 'success' | 'partial' | 'failed'
    }
  ]
  
  frictionSignals: [  // Where user hesitated
    {
      signalType: 'user_asked_why' | 'user_skipped' | ...
      context: { scoutMessage, userMessage, actionOffered }
      severity: 'low' | 'medium' | 'high'
    }
  ]
  
  startedAt / endedAt
}
```

**Why**: Shows where users hesitate, where language confuses, where flows break

---

### 2️⃣ Action Capability Logs (Critical)

Every Scout action gets logged:

```typescript
ScoutActionExecution {
  actionId          // What Scout offered
  actionType        // 'create_invoice', 'publish_profile', 'contact_business'
  offered: boolean  // Was it shown?
  selected: boolean // Did user pick it?
  executed: boolean // Did Scout execute?
  executionPath     // 'scout_direct' or 'user_routed'
  result            // 'success' | 'partial' | 'failed'
  errorCode?        // If failed
  
  metadata: {
    actionDurationMs
    targetResourceId      // What was created/modified
    targetResourceType    // invoice, profile, message, etc.
  }
}
```

**Why**: Shows which actions users want Scout to do, which they do manually, where capability gaps exist. This directly informs execution under `docs/TRADESCOUT_MASTER_PLAN.md`.

---

### 3️⃣ Choice Friction Signals (Mission Protection)

Where users hesitate or abandon:

```typescript
ScoutFrictionSignal {
  signalType:
    | 'user_skipped'       // User dismissed action
    | 'user_asked_why'     // User didn't understand
    | 'user_backtracked'   // User undid choice
    | 'user_rephrased'     // User rephrased to clarify
    | 'user_abandoned'     // User left mid-flow
  
  context: {
    scoutMessage      // What Scout said
    userMessage       // How user responded
    actionOffered     // What Scout offered
  }
}
```

**Why**: These are language failures, not feature failures. Detecting where users feel uncomfortable tells you where the promise breaks.

---

## What Must NEVER Happen Automatically

❌ Scout conversations do NOT:
- Modify prompts automatically
- Train embeddings automatically  
- Influence recommendations automatically
- Change ranking, language, or flows automatically

Even for bots.

**All improvement is human-approved.**

---

## The Scout Action Contract (Locked)

Every actionable intent follows this:

```
Step 1: Scout offers control
  "I can do this for you, or I can take you there — what do you prefer?"

Step 2: User makes explicit choice
  User picks: "You do it" OR "Take me there"

Step 3: Scout executes truthfully
  If "You do it" → calls real backend action
  If "Take me there" → navigates to correct surface
  No fake confirmations, no partial hidden actions

Step 4: Scout reports result
  "That's done." OR "Here's what went wrong."
  No silent failures.
```

---

## How Bots Are Safely Excluded

**Bot Detection** (Hard Guard):
```typescript
isTestRun = request.headers['X-Test-Run'] === 'true'
          || request.headers['User-Agent'].includes('ScoutBot')
          || user.isTestAccount
```

**Learning Pipeline Gate**:
```typescript
if (canLearn = !isTestRun && !user.isTestAccount) {
  // Update Scout heuristics from real user behavior
  await updateScoutPrompts(sessionLog)
} else {
  // Bots excluded - skip learning entirely
  return
}
```

**Key Point**: Bots still execute actions and get observed. They just never change Scout's behavior.

---

## What Scout Learns (Real Users Only)

From real users, Scout updates:
- ✅ Which phrasing reduces hesitation
- ✅ Which actions users prefer Scout to execute
- ✅ Which options users skip
- ✅ Which flows cause backtracking
- ✅ How to improve confirmation language

Never:
- ❌ Business rankings or recommendations  
- ❌ User reputation or trust
- ❌ Cross-user data leakage
- ❌ Automatic modifications (human review required)

---

## The Outcome (2–3 Weeks)

You'll know:
- "37% of users asked 'why' after Scout suggested invoicing"
- "Invoices selected for Scout-direct execution 68% of the time"
- "Profile publishing has 12% abandonment when Scout routes instead of executes"
- Which Scout phrases cause hesitation
- Where routing feels like abandonment
- Where the mission quietly breaks

**This is founder-grade intelligence.**

---

## Implementation (Simple)

**3 new files in codebase**:

1. **scoutLogger.ts** (utility)
   - `ScoutInteractionLogger` class
   - `InsightGenerator` for weekly summaries
   - Type definitions

2. **scout_interaction_logging.spec.ts** (Bot Army test)
   - Demonstrates logging pattern
   - Verifies hard guard works
   - Catches regressions

3. **SCOUT_LOGGING_BACKEND_GUIDE.md** (integration docs)
   - How backend Scout calls this logger
   - Example complete flows
   - Deployment checklist

---

## Architecture (3-Pipeline)

```
Scout Session
    ↓
    ├─ Pipeline 1: Action Execution (always)
    │  └─ Real backend calls logged
    │
    ├─ Pipeline 2: Observation (always)
    │  └─ Turns, choices, friction signals logged
    │
    └─ Pipeline 3: Learning (real users only)
       └─ Hard-disabled for bots (isTestRun=true)
          └─ Updates heuristics safely
```

---

## Why This Works

✅ **No contamination** - Bots marked, excluded from learning  
✅ **Observable** - Every turn logged, searchable  
✅ **Mission-safe** - Control always with user  
✅ **Founder-friendly** - Auto-summaries, no transcript reading  
✅ **Measurable** - Friction metrics guide language refinement  

---

## Code Files

| File | Purpose |
|------|---------|
| `tests/utils/scoutLogger.ts` | Logger classes & types |
| `tests/journeys/scout_interaction_logging.spec.ts` | Bot Army tests |
| `SCOUT_LOGGING_BACKEND_GUIDE.md` | Backend integration |
| `SCOUT_INTERACTION_REQUIREMENTS.md` | This file |

---

## Next Steps

1. **Backend Integration**: Call logger in Scout endpoint
2. **Bot Detection**: Add isTestRun header in test requests
3. **Learning Pipeline**: Implement weekly insight generation
4. **Dashboard**: Display friction heatmap + action metrics
5. **Review Loop**: Human approves changes before deploy

---

**Status**: Ready for implementation  
**Impact**: Real user learning without bot contamination  
**Timeline**: 2–3 weeks to first insights
