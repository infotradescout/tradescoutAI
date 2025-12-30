# Scout System Hierarchy — LOCKED

**Date**: December 30, 2024  
**Status**: 🔒 LOCKED — Do not modify without explicit approval

---

## Critical Architecture Decision

The Scout system has a **strict hierarchy** that must be maintained to prevent "clever chaos."

```
User
↓
Governor   ← SOLE AUTHORITY (runs BEFORE LLM generation)
↓
Flow Composer (primitives: CAPTURE/INTERPRET/CONSTRAIN/CONNECT/COMMIT)
↓
Execution (LLM + primitives)
↓
Outcome + Memory
↓
Tool Discovery (OFFLINE / ASYNC / OBSERVATIONAL ONLY)
```

---

## The Single Most Important Line

> **"Governor runs BEFORE LLM generation."**

This single ordering decision is what makes TradeScout different from every other AI system.

---

## LOCKED Components (Do Not Touch)

### ✅ Governor (`server/scout/governor.ts`)

**Status**: 🟢 LOCKED

**Why it exists**:
- Establishes decision authority
- Breaks query → response coupling
- Enables COMPLY / DEFER / REDIRECT / BLOCK
- Protects outcomes

**What it does**:
1. Infers situation (not just intent)
2. Assesses risks
3. Selects action (COMPLY / DEFER / REDIRECT / BLOCK)
4. Composes flow from primitives
5. Generates intervention
6. Determines if LLM is needed

**What it does NOT do**:
- ❌ Run tool discovery inline
- ❌ Call LLM directly
- ❌ Emit blueprints to users

---

### ✅ Flow Composition via Primitives

**Status**: 🟢 LOCKED

**The 5 primitives**:
- `CAPTURE` — text, media, notes, links, location, time
- `INTERPRET` — infer intent, stakes, ambiguity, risk
- `CONSTRAIN` — block, defer, gate, sequence
- `CONNECT` — people, information, assets, opportunities
- `COMMIT` — messages, posts, transactions, records

**Why these are locked**:
- Domain-agnostic
- UI-agnostic
- Future-proof
- Abstraction strong enough to scale forever

---

## SUBORDINATED Component (Still Good, Just Demoted)

### ⚠️ Tool Discovery (`server/scout/toolDiscoveryObserver.ts`)

**Status**: 🟡 GOOD BUT DEMOTED

**What changed**: Moved from **operational** to **observational** intelligence

**Old (WRONG)**:
```
User → Governor → Tool Discovery (inline) → Flow Composer → Execution
                     ↑
                  BLOCKS USER FLOW
```

**New (CORRECT)**:
```
User → Governor → Flow Composer → Execution → Outcome
                                                 ↓
                                    Tool Discovery (async, offline)
                                                 ↓
                                         Admin Blueprints
```

**Why this matters**:
- Tool discovery is Scout's **subconscious**, not its **voice**
- It NEVER affects live user interactions
- It only observes, clusters, and proposes
- Blueprints go to admin ONLY, never to users

**How it works now**:
1. User completes interaction with Scout
2. Flow completes, outcome recorded
3. `observeFlowCompletion()` called asynchronously
4. Pattern detection runs offline
5. If convergence threshold met → Blueprint emitted to admin
6. Admin reviews, approves/rejects
7. Engineering builds approved tools
8. Scout can now use tool directly (no more workarounds)

---

## Critical Rules

### Rule 1: Nothing Bypasses Governor
- Every user message MUST go through governor first
- No direct LLM calls from user input
- No shortcuts, no exceptions

### Rule 2: Governor Runs BEFORE LLM Generation
- Situation inference happens first
- Risk assessment happens first
- Action selection happens first
- THEN (and only then) LLM generates response text

### Rule 3: Tool Discovery is Observational, Not Operational
- Runs AFTER flow completes
- Uses `setImmediate()` to avoid blocking
- NEVER affects live user experience
- NEVER influences flow composition
- NEVER shows blueprints to users

### Rule 4: Primitives are Universal
- Only 5 primitives exist
- They never change
- All flows compose from these 5 only
- No new primitives without architecture review

### Rule 5: Blueprints are Admin-Only
- Users never see proposed tools
- Only admins review blueprints
- Approval required before implementation
- Prevents feature sprawl

---

## What This Prevents

### ❌ Without Hierarchy:
- Scout becomes governor + executor + product manager + analyst + strategist all at once
- Noisy tool proposals during user conversations
- Premature generalization
- Admin overload
- False positives
- User confusion ("Why is Scout proposing features to me?")
- Trust erosion
- Feature sprawl

### ✅ With Hierarchy:
- Scout stays focused on helping the user NOW
- Tool discovery observes quietly in the background
- Admin gets clean, convergence-validated proposals
- Users never see experimental features
- Trust maintained
- Organic tool growth without chaos

---

## Implementation Files

### Governor Layer
- `server/scout/governor.ts` (730 lines)
  - `inferSituation()`
  - `selectAction()`
  - `composeFlow()`
  - `generateIntervention()`
  - `govern()` ← main entry point

### Tool Discovery Layer (Offline)
- `server/scout/toolDiscoveryObserver.ts` (280 lines)
  - `observeFlowCompletion()` ← called AFTER user interaction
  - `observeRegret()` ← called when user expresses regret
  - `detectMissingCapability()` (pattern detection)
  - `generateFingerprint()` (pattern clustering)
  - Admin-only exports: `getProposedBlueprints()`, `approveBlueprint()`, `rejectBlueprint()`

- `server/scout/toolDiscovery.ts` (580 lines)
  - `ToolDiscoveryEngine` class
  - Pattern clustering
  - Convergence detection
  - Blueprint emission
  - Regret tracking
  - Tacit knowledge extraction

### Admin Layer
- `server/routes/admin-tool-discovery.ts` (100 lines)
  - `GET /api/admin/tool-blueprints` ← admin only
  - `POST /api/admin/tool-blueprints/:id/approve` ← admin only
  - `POST /api/admin/tool-blueprints/:id/reject` ← admin only
  - `GET /api/admin/tacit-knowledge` ← admin only

- `client/src/pages/admin-tool-discovery.tsx` (450 lines)
  - Stats dashboard
  - Blueprint cards
  - Review modal
  - Approve/reject workflow

---

## How to Use This System

### For New Features:

**Step 1**: Does this affect user interaction flow?
- **YES** → Belongs in Governor layer
- **NO** → Continue to Step 2

**Step 2**: Does this require new primitives?
- **YES** → STOP. Request architecture review first.
- **NO** → Continue to Step 3

**Step 3**: Can this be composed from existing primitives?
- **YES** → Add to `composeFlow()` in governor
- **NO** → Continue to Step 4

**Step 4**: Is this observational intelligence (learning from patterns)?
- **YES** → Add to `toolDiscoveryObserver.ts`
- **NO** → Might not belong in Scout at all

### For Bug Fixes:

**If bug is in live user flow**:
- Fix in Governor layer
- Ensure hierarchy maintained
- Never add async delays in user-facing path

**If bug is in pattern detection**:
- Fix in Tool Discovery Observer
- Ensure it runs async
- Ensure it never affects users

### For Performance:

**User-facing code** (Governor, Flow Composer):
- MUST be fast (<100ms)
- No database queries in critical path
- No async waits

**Background code** (Tool Discovery):
- Can be slow (runs async)
- Can query database
- Can aggregate data

---

## Testing the Hierarchy

### Valid Tests:
✅ Governor decides to DEFER → User sees "I need more info"  
✅ Governor decides to BLOCK → User sees "I can't help you do that yet"  
✅ Governor decides to REDIRECT → User sees corrective guidance  
✅ Governor decides to COMPLY → LLM generates helpful response  
✅ Flow completes → Pattern observed → Blueprint emitted to admin  
✅ Admin approves blueprint → Engineering builds tool  

### Invalid Tests:
❌ Tool discovery emits blueprint → User sees it (NEVER HAPPENS)  
❌ Tool discovery delays user response (runs async only)  
❌ Governor calls LLM before risk assessment (wrong order)  
❌ User message bypasses governor (forbidden)  
❌ New primitive added without architecture review  

---

## Copilot Instructions

When working on Scout code:

1. **Always check hierarchy** before adding code
2. **Never put tool discovery in user-facing path**
3. **Never bypass governor**
4. **Never create new primitives** without approval
5. **Always run tool discovery async** with `setImmediate()`
6. **Always emit blueprints to admin only**
7. **Always maintain the order**: Situation → Risk → Action → Flow → Execution → Observation

---

## Status Summary

| Component | Status | Role | User-Facing? |
|-----------|--------|------|--------------|
| Governor | 🟢 LOCKED | Decision authority | Yes (immediate) |
| Primitives | 🟢 LOCKED | Universal building blocks | No (framework) |
| Flow Composer | 🟢 LOCKED | Flow synthesis | Yes (via governor) |
| Tool Discovery | 🟡 DEMOTED | Observational learning | No (admin-only) |
| Admin UI | ✅ Active | Blueprint review | Admin-only |

---

## Conclusion

This hierarchy exists to prevent Scout from collapsing into "clever chaos."

**The Governor is the spine.**  
Everything else supports it.

Tool Discovery is brilliant architecture — but it must stay in its lane as **Scout's subconscious**, not its voice.

When in doubt: **Governor first, everything else after.**

---

_Hierarchy locked: December 30, 2024_  
_Do not modify without architectural review_
