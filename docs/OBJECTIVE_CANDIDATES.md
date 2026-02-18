# OBJECTIVE_CANDIDATES.md — Persistent User Goal Structures

This document identifies which existing database table should become the canonical representation of a **persistent user objective** — something Scout can automatically create to preserve a user's stated intent across sessions and routing decisions.

---

## Executive Summary

**Recommendation:** Use the existing `workRequests` table as the foundation for persistent objectives.

- **Today**, `workRequests` powers Direct Connect features with `source: "direct_connect"`
- **Candidate strengths**: Draft status, flexible scope, event audit trails, multi-source origin (`source` = "scout" | "tasks" | "community")
- **Why Scout doesn't auto-create today**: Scout is a conversational interface positioned as one step removed from commitment
- **Minimum required fields** for auto-creation: `createdByUserId`, `title`, `description`, `countyFips`, `stateCode`, `status: 'draft'`, `source: 'scout'`
- **Risk**: Adding auto-creation changes Scout's psychological position from "explorer tool" to "action tool"

---

## 1. Objective Structure Candidates

### A. LEADS Table (Contractor Inbound Routing)

**Schema (relevant fields):**
```
id                 VARCHAR (UUID)
userId             VARCHAR (homeowner who created it)
contractorId       VARCHAR (assigned contractor)
projectType        VARCHAR
description        TEXT
countyId           VARCHAR
tradeId            VARCHAR
estimatedValue     DECIMAL
urgency            VARCHAR (immediate, week, month, planning)
contactPreference  VARCHAR (phone, email, text)
status             VARCHAR (new, contacted, qualified, matched, closed)
routingType        VARCHAR (direct, top3, call_now)
calculatorData     JSONB
utmData            JSONB
createdAt          TIMESTAMP
updatedAt          TIMESTAMP
```

**Current Lifecycle:**
1. User fills a web form or lands on a landing page with lead calculator
2. System creates a `lead` row (auto-filled from form/UTM data, not from Scout)
3. `leadAssignments` rows route the lead to 1-3 contractors
4. Status transitions: new → contacted → qualified → matched → closed

**When Scout Uses It:**
- Scout does NOT currently auto-create leads
- Scout can *reference existing leads* if user mentions one in conversation
- Scout suggests "Post a lead" or "Start a project" as next action

**Why Scout Does NOT Auto-Create Leads:**
- Leads are designed as **inbound marketplace items** (like a Craigslist post), not internal objectives
- Leads are immediately **routed to contractors** (no draft stage) — exposes the user request publicly
- Status machine assumes a **linear path**: created → contacted → matched → closed (no "postpone" or "explore" states)
- No multi-source support (doesn't track whether lead came from Scout, a landing page, or an email)
- `calculatorData` and `utmData` suggest marketing/conversion tracking, not conversation context

**Verdict:** ❌ Not suitable. Leads are for public marketplace inbound, not private objectives. Too coupled to contractor assignment.

---

### B. TASKS Table (Service Provider Work Postings)

**Schema (relevant fields):**
```
id                   VARCHAR (UUID)
posterId             VARCHAR
posterType           VARCHAR (contractor, homeowner)
title                VARCHAR
description          TEXT
categoryId           VARCHAR
address              VARCHAR
city, state, county  VARCHAR

taskType             VARCHAR (one_time, recurring, project_based)
estimatedHours       DECIMAL
payType              VARCHAR (hourly, fixed, per_task)
payAmount            DECIMAL
requiredSkills       JSONB (array)
requiresTransport    BOOLEAN

schedulingType       VARCHAR (asap, scheduled, flexible)
startDate, endDate   TIMESTAMP
status               VARCHAR (open, assigned, in_progress, completed, cancelled)
assignedWorkerId     VARCHAR
createdAt            TIMESTAMP
```

**Current Lifecycle:**
1. Contractor or homeowner posts a task (service to hire for)
2. Task goes live immediately (no draft state)
3. Workers apply via `taskApplications` table
4. Task transitions: open → assigned → in_progress → completed

**When Scout Uses It:**
- Scout does NOT currently reference tasks in conversation
- Tasks are a separate feature (labor marketplace)

**Why Scout Does NOT Auto-Create Tasks:**
- Tasks are **public labor postings** immediately exposed to workers
- No draft state: creation = publication
- Designed for **worker applications** (bidding system), not homeowner objectives
- Tight coupling to `taskApplications` (assumes worker applies, then hires)
- No mechanism to transition back to private exploration if user changes mind

**Verdict:** ❌ Not suitable. Tasks are for labor marketplace (contractor hiring workers), not homeowner project management.

---

### C. WORK_REQUESTS Table (Flexible Multi-Origin Objectives) ✅ **RECOMMENDED**

**Schema (relevant fields):**
```
id                 VARCHAR (UUID)
createdByUserId    VARCHAR (the user whose objective this is)

title              VARCHAR
description        TEXT
category           VARCHAR

tradeId            VARCHAR (optional: linked service category)
countyFips         VARCHAR(5) (location context)
stateCode          VARCHAR(2)
addressId          VARCHAR (optional: specific location)

scope              VARCHAR (personal, community, group, hoa, global)
source             VARCHAR (tasks, community, scout) ⭐ KEY FIELD
sourceRefId        VARCHAR (e.g., community post id, scout thread id)

status             VARCHAR (draft, open, routed, in_progress, completed, cancelled)
visibility         VARCHAR (public, community, private)
exposureMode       VARCHAR (guided, open)
competitionMode    VARCHAR (none, compare_responses)

budgetMin, budgetMax  DECIMAL (optional)
shareToken         VARCHAR (optional: anonymous share link)

createdAt          TIMESTAMP
updatedAt          TIMESTAMP
```

**Current Lifecycle:**
1. User creates work request via `/tasks` page or (theoretically) via Scout
2. Request starts in `draft` status (NOT public)
3. User can edit, review, decide to proceed
4. User transitions: draft → open (now routed to providers)
5. Status progresses: routed → in_progress → completed
6. Event log (`workRequestEvents`) tracks all state changes

**Companion Tables:**
- `workRequestEvents` (append-only history of all state changes)
- `workRequestAssignments` (which providers are assigned/invited)

**When Scout *Could* Use It:**
- Scout parses user intent (e.g., "I need a kitchen remodeled")
- Scout auto-creates `workRequest` with `source: 'scout'` and `status: 'draft'`
- Scout chains the request: "I've saved your objective. Want to refine it, or go straight to getting quotes?"
- User keeps objective in Scout and continues refining
- When ready, user transitions to `open` (stays in context, no separate form)

**Why Scout CURRENTLY Does NOT Auto-Create:**
1. **Scout's philosophical position**: "Decision-support, not action-forcing"
   - The Governor logic explicitly delays/blocks risky moves
   - Auto-creating even a draft objective feels like committing beyond conversation
   - Scout user psychology: asking ≠ intending

2. **No UI between Scout and work request form**
   - Scout suggests "Start a project" as action tile
   - Clicking tile navigates to separate Direct Connect form
   - No seamless Scout → draft objective flow

3. **Existing source support not leveraged**
   - `source` field already supports "scout" value
   - But no code path currently sets it
   - Direct Connect routes use `source: 'direct_connect'` as a subtype

**Verdict:** ✅ **BEST CANDIDATE.** Already supports:
- Draft state (safe for auto-creation)
- Multi-source origin (source field exists)
- Flexible scope and visibility (personal → global)
- Event audit trail (who changed what, when)
- Optional location/trade context
- Budget ranges (optional)
- Flexible provider model (can route to contractors, find others, invite specific folks)

---

## 2. Lifecycle Comparison

| Feature | Leads | Tasks | Work Requests |
|---------|-------|-------|---------------|
| **Auto-Publish?** | Yes (immediate) | Yes (immediate) | No (stays draft) |
| **Draft Stage?** | ❌ No | ❌ No | ✅ Yes |
| **Multi-Source**? | ❌ No (UTM only) | ❌ No | ✅ Yes (scout/tasks/community) |
| **Private Explore?** | ❌ No | ❌ No | ✅ Yes (personal/private scope) |
| **Event Audit Trail** | ❌ No | ❌ No | ✅ Yes (workRequestEvents) |
| **Purpose** | Contractor inbound | Labor marketplace | General objectives |
| **Ready for Scout?** | ❌ No | ❌ No | ✅ Yes |

---

## 3. Minimum Fields Required for Scout Auto-Creation

If Scout auto-creates a work request upon user intent, these fields are **required**:

| Field | Type | Scout Provides | Rationale |
|-------|------|----------------|-----------|
| `createdByUserId` | VARCHAR | Yes (session) | Whose objective is this? |
| `title` | VARCHAR | Yes (inferred from input) | Summary of intent |
| `description` | TEXT | Yes (user message text) | Detailed intent |
| `countyFips` | VARCHAR | Yes (location context) | Geographic scope |
| `stateCode` | VARCHAR | Yes (location context) | For routing/jurisdiction |
| `status` | VARCHAR | 'draft' | Safe state, user not committed |
| `source` | VARCHAR | 'scout' | Track origin (audit) |
| `createdAt` | TIMESTAMP | NOW() | Implicit |

**Optional fields Scout may populate:**

| Field | Value | Why Optional |
|-------|-------|--------------|
| `tradeId` | Scout infers | Helps routing, but can be added later |
| `budgetMin/Max` | Scout infers | Nice-to-have, not required to persist |
| `scope` | 'personal' | Conservative default (don't expose yet) |
| `visibility` | 'private' | Conservative default (don't expose yet) |
| `addressId` | Extracted | More specific than county, but county suffices |

**DO NOT auto-populate:**
- `sourceRefId` (would require linking to Scout conversation, adds complexity)
- `shareToken` (only for intentional sharing)
- `assignedWorkerId` / provider assignments (user hasn't hired yet)
- `status: 'open'` or beyond (that's a user decision)

---

## 4. Schema Gaps for Scout Integration

Work requests are almost ready; small gaps:

1. **Scout Conversation Link** (optional enhancement)
   - Add `scoutThreadId` VARCHAR to `workRequests` (optional, foreign key to scout_interactions)
   - Allows "where did this objective come from?" and "continue context in Scout"
   - Status: **NOT URGENT** (can use sourceRefId as a workaround)

2. **Source Refinement**
   - Current: `source = 'scout'` possible but not used
   - Add documentation: "source='scout' means created from Scout conversation, may be in draft indefinitely"
   - Status: **READY TODAY**

3. **Lifecycle Documentation**
   - Current schema supports it; implementation docs missing
   - Status: **DOCUMENTATION ONLY**

---

## 5. Why Scout Doesn't Auto-Create Today

This is a **product/psychology choice**, not a technical limitation:

### Explicit Design Constraints (from codebase)

**Scout Governor blocks on risky moves:**
```
server/routes/scout.ts::govern()
- Can defer, redirect, or block actions if confidence < threshold
- Explicit: "Protects users but delays decision to act"
```

**Scout message length capped:** 
```
ScoutOS.tsx::MAX_FIRST_MESSAGE_CHARS = 280
- Signals: stay in Scout, don't push to external forms
- Keeps user in low-friction conversation loop
```

**No Prefilled Direct Connect Drafts:**
```
BEHAVIORAL_CENTER.md::Finding:
"Unauthenticated users get 'Create account now' but never prefilled draft"
- Prevent: auto-populated forms that feel pushy
```

### Psychological Model

**Current Signal:** "Ask → Explore → Decide (maybe-later or never)"

If Scout auto-creates objectives:
- Signal becomes: "Ask → Persist → Act"
- Shifts overhead: users feel ownership pressure
- Increases drop-off if they don't want to commit yet

**Safe Path (recommended by this analysis):**
- Auto-create, but clearly labeled as "draft"
- Show: "I've saved this for you"
- Empower: user can refine in Scout, transition when ready
- No pressure: draft never auto-publishes

---

## 6. Implementation Recommendation

### Phase 1: Auto-Persist (Immediate, Low-Risk)

**What:** Scout auto-creates a `workRequest` in `draft` status when user expresses project intent.

**Trigger Examples:**
- User: "I need a kitchen remodeled"
- User: "Where can I find a plumber?"
- User: "How much does asbestos removal cost?"

**Scout Response (after auto-create):**
- "I've saved this. Want to add more details, or should Scout start finding options?"
- Link to objective dashboard (read-only draft view)
- Continue in Scout conversation

**Benefits:**
- User context persists across sessions
- Scout can reference: "You mentioned kitchen remodel..."
- Objective preserved even if user never formalizes

**Risks:**
- Users see "draft" objectives they don't recall creating
- Clutter in dashboard if Scout too aggressive about creating
- Mitigation: only create on high-confidence intent signals; offer link; ask for confirm

### Phase 2: Semantics (Later, Moderate Effort)

**Add:** `scoutThreadId` to `workRequests` (optional FK to scout_interactions)

- Link objective back to Scout conversation
- "Continue refining in Scout" button
- Outcome tracking: "User created objective, did they hire?"

### Phase 3: Seamless Transition (Later, High Effort)

**Design:** Scout → Draft Objective → Open Request (no form jumps)

- User stays in Scout throughout
- Scout panels for editing title/description, adding budget, etc.
- "Ready to get quotes?" → status changes to `open` within Scout
- Direct Connect assignments happen in background

---

## 7. Risk Analysis

### Risk 1: Users Don't Want Auto-Created Drafts
**Likelihood:** Medium (users may feel tracked or judged)  
**Mitigation:** Clearly label as "draft", non-committal language, easy delete  
**Detection:** Survey users; track draft-deletion rate

### Risk 2: Scout Misclassifies Intent
**Likelihood:** Low-Medium (LLM confidence varies)  
**Mitigation:** Only auto-create on high-confidence (>0.85); ask user to confirm  
**Detection:** Log rejected auto-creates; monitor intent classification accuracy

### Risk 3: Changes Scout's Psychology
**Likelihood:** High (shifts from "explorer" to "action driver")  
**Mitigation:** Explicit opt-in settings; "Draft suggested, approve?" messaging  
**Detection:** DAU/MAU changes; user feedback on Scout's "pushiness"

### Risk 4: Graph Bloat (Too Many Draft Objectives)
**Likelihood:** Medium (users might create many drafts, abandon them)  
**Mitigation:** Soft-delete after 90 days of inactivity; archive UI; "ignore" button  
**Detection:** Dashboard performance; "abandoned draft" reports

---

## 8. Comparison Summary

| Aspect | Leads | Tasks | Work Requests |
|--------|-------|-------|---------------|
| **Suitable for Scout?** | ❌ No | ❌ No | ✅ **YES** |
| **Draft State** | ❌ | ❌ | ✅ |
| **Multi-Source** | ❌ | ❌ | ✅ |
| **Audit Trail** | ❌ | ❌ | ✅ |
| **Privacy Levels** | Limited | Limited | ✅ |
| **Ready to Use** | — | — | **TODAY** |
| **Implementation Effort** | — | — | **LOW** (seed + Scout logic) |

---

## 9. Recommended Action

**Propose to Product Owner:**

> Use the existing `workRequests` table as the persistent objective container for Scout. Auto-create an objective in `draft` status when Scout detects high-confidence project intent. User can refine the draft in Scout, then transition to `open` when ready to receive quotes/help. This:
> 
> - Preserves user context across sessions
> - Keeps users in Scout (no form jumps)
> - Respects privacy (draft = private by default)
> - Enables outcome tracking (objective → hiring → payment)
> - Requires minimal schema changes (just populate `source='scout'`)
>
> Risks are manageable with opt-in settings and clear "draft" framing.

---

## Files Referenced

- [shared/schema.ts](shared/schema.ts) — `leads`, `tasks`, `workRequests`, `workRequestEvents`, `workRequestAssignments`
- [server/routes/direct-connect.ts](server/routes/direct-connect.ts) — Current Direct Connect implementation (uses `workRequests`)
- [client/src/scout/ScoutOS.tsx](client/src/scout/ScoutOS.tsx) — Scout UI state, action tiles
- [server/routes/scout.ts](server/routes/scout.ts#L2538-2580) — Governor logic that delays/blocks actions
- [BEHAVIORAL_CENTER.md](BEHAVIORAL_CENTER.md) — Why Scout users stay in conversation (not action)
- [DIRECT_CONNECT_VISION.md](DIRECT_CONNECT_VISION.md) — Direct Connect as coordination hub
- [DIRECT_CONNECT_REQUEST_MODEL.md](DIRECT_CONNECT_REQUEST_MODEL.md) — Request lifecycle (if exists)

---

**Status:** ✅ Analysis complete. Recommendation: Adopt `workRequests` as persistent objective. No schema changes needed. Minimal code changes to wire Scout intent detection to auto-create logic.
