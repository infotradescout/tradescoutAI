# D1: First-Time Scout Guided Inference — Design

**Status**: Design phase (read-only)  
**Date**: 2026-01-01  
**Trigger**: `/scout?onboarding=true`  
**Constraint**: 2–4 questions max, skippable, explanations included

---

## D1 Philosophy

**Goal**: Refine user snapshot in 60 seconds without blocking, assumptions, or checklists.

**Key Principles**:
- Every question earns its weight (2–4 only)
- Skip is always available (guidance never forced)
- Explanations show WHY the answer matters
- Confidence updates after each answer (visual feedback)
- Always ends with action (never "thanks for the info")
- Seamless exit (normal Scout resumes)

---

## D1 Question Set

### Session Structure

```
START
  ↓
Q1: Intent (REQUIRED) 
  ├─ Answer → Q2
  └─ Skip → SNAPSHOT MARKED (skip_q1)
  ↓
Q2: Urgency (CONDITIONAL on Q1 answer)
  ├─ Answer → Q3 or END (depends on answers)
  └─ Skip → Continue
  ↓
Q3: Scope (CONDITIONAL on Q1+Q2)
  ├─ Answer → Q4 or END
  └─ Skip → Continue
  ↓
Q4: Category (OPTIONAL refinement)
  ├─ Answer → END
  └─ Skip → END
  ↓
END
  → Snapshot confidence updated
  → Scout resumes normal behavior
  → Onboarding flag expires
```

---

## D1-1: Question Set Design

### Q1: Intent Discovery (High-Signal Opener)
**Purpose**: Separate seekers from helpers; foundation for all downstream decisions

**Question**: 
> "What brings you to TradeScout right now?"

**Answer Options**:
1. **"I need help with something"** (Seeker)
   - Signal: `intent='seek_help'`
   - Confidence boost: +20
   - Next: Q2 (urgency)
   - Why: "Helps Scout find contractors, pros, or peers who can help"

2. **"I'm here to help others"** (Helper)
   - Signal: `intent='offer_help'`
   - Confidence boost: +20
   - Next: Q2 (urgency)
   - Why: "Helps Scout route you to people looking for your skills"

3. **"I'm exploring / learning"** (Browser)
   - Signal: `intent='explore'`
   - Confidence boost: +10
   - Next: Skip Q2, go to Q3
   - Why: "Helps Scout show relevant projects and community first"

**Skip Button**: 
- Text: "Skip for now"
- Effect: Snapshot marks `skipped_questions=['Q1']`, continues to Q2 with lower confidence
- Action Path: `/scout` (return to homepage)

**Explanation Subtitle**:
> "This helps Scout suggest the right people and projects for you"

**Confidence Display After Q1**:
```
Snapshot Confidence: 35% → 55% (if answered) or 40% (if skipped)
```

---

### Q2: Urgency / Timeline (Time-Sensitive Signal)
**Purpose**: Determine if this is immediate need, future planning, or casual browsing

**Trigger**: Q1 answered as 'seek_help' or 'offer_help' (skipped if Q1='explore')

**Question**:
> "How soon do you need [help/to start]?"

**Answer Options**:
1. **"Right now / This week"** (Urgent)
   - Signal: `urgencySignal='high'`, `timelineSignal='immediate'`
   - Confidence boost: +15
   - Next: Q3
   - Why: "Scout will prioritize active contractors and same-day response options"

2. **"Next 1–2 weeks"** (Soon)
   - Signal: `urgencySignal='medium'`, `timelineSignal='soon'`
   - Confidence boost: +15
   - Next: Q3
   - Why: "Scout will balance availability and quality"

3. **"Next month or later"** (Planned)
   - Signal: `urgencySignal='low'`, `timelineSignal='planned'`
   - Confidence boost: +15
   - Next: Q3
   - Why: "Scout can show more options and help you plan"

4. **"No specific timeline"** (Browsing)
   - Signal: `urgencySignal='none'`, `timelineSignal='browsing'`
   - Confidence boost: +10
   - Next: Skip to END
   - Why: "Scout will show featured projects and trending in your area"

**Skip Button**: 
- Text: "I'm not sure yet"
- Effect: Snapshot marks `skipped_questions+=['Q2']`, continues with default medium urgency
- Action Path: Continue to Q3

**Explanation Subtitle**:
> "Helps Scout filter contractors and projects by availability"

**Confidence Display After Q2**:
```
Snapshot Confidence: 55% → 70% (if answered) or 65% (if skipped)
```

---

### Q3: Scope / Domain (Context Signal)
**Purpose**: Understand if this is personal, business, or community-driven

**Trigger**: Q1 answered OR Q2 answered (always shown if Q1 or Q2 answered)

**Question**:
> "Is this for your home, a business, or the community?"

**Answer Options**:
1. **"My home / Personal"** (Residential)
   - Signal: `context.scope='residential'`, `context.businessType='homeowner'`
   - Confidence boost: +15
   - Next: Q4 optional
   - Why: "Scout prioritizes contractors, maintenance experts, and community helpers"

2. **"My business"** (Commercial)
   - Signal: `context.scope='business'`, `context.businessType='business_owner'`
   - Confidence boost: +15
   - Next: Q4 optional
   - Why: "Scout shows B2B services, bulk rates, and business networks"

3. **"Community / Volunteering"** (Community)
   - Signal: `context.scope='community'`, `context.intent='community_driven'`
   - Confidence boost: +20 (strong community signal)
   - Next: END (community drives to specific routes)
   - Why: "Scout connects you with local groups and initiatives"

4. **"Multiple / All of the above"** (Multi-faceted)
   - Signal: `context.scope='multi'`, `context.isMultiFaceted=true`
   - Confidence boost: +15
   - Next: Q4 optional
   - Why: "Scout will show both personal and business tools"

**Skip Button**: 
- Text: "Show me everything"
- Effect: Snapshot marks `context.scope='unspecified'`, continues with lower confidence
- Action Path: Continue to Q4

**Explanation Subtitle**:
> "Helps Scout show the right type of projects and people for you"

**Confidence Display After Q3**:
```
Snapshot Confidence: 70% → 85% (if answered) or 75% (if skipped)
```

---

### Q4: Category / Trade Refinement (Optional Depth Signal)
**Purpose**: Surface high-signal categories for faster discovery (optional refinement)

**Trigger**: Q3 answered (optional)

**Question**:
> "Is there a specific type of work or category you're most interested in?"

**Answer Options** (Conditional based on Q3):
- **If scope='residential'**: "Contractors", "Plumbing", "Electrical", "General Repair", "Cleaning", "Landscaping", "Other"
- **If scope='business'**: "Professional Services", "Software/Tech", "Marketing", "Consulting", "B2B Suppliers", "Other"
- **If scope='community'**: "Local Groups", "Volunteering", "Events", "Nonprofits", "Skill Sharing", "Other"
- **If scope='multi'**: "See All Categories" (shows union)

**Answer Selection**:
- Signal: `tradeSignal={selectedCategory}`, `categoryConfidence=0.9`
- Confidence boost: +10
- Next: END
- Why: "Scout will highlight relevant projects in your first feed"

**Skip Button**: 
- Text: "Not sure / Skip this"
- Effect: Snapshot marks `tradeSignal='unspecified'`, category discovery deferred
- Action Path: END

**Explanation Subtitle**:
> "Optional — Scout can show your category first if you'd like"

**Confidence Display After Q4**:
```
Snapshot Confidence: 85% → 95% (if answered) or 85% (if skipped)
```

---

## D1 Snapshot Signal Mapping

| Question | Answer | Snapshot Signal | Confidence Impact | Notes |
|----------|--------|-----------------|-------------------|-------|
| Q1: Intent | "I need help" | `intent='seek_help'` | +20 | Direct signal; drives routing |
| Q1: Intent | "I'm here to help" | `intent='offer_help'` | +20 | Direct signal; contractor-ready |
| Q1: Intent | "I'm exploring" | `intent='explore'` | +10 | Lower confidence; community-first |
| Q1: Intent | **Skip** | `intent='unspecified'` | +0 | Default: medium confidence |
| Q2: Urgency | "Right now" | `urgencySignal='high'` | +15 | Time-sensitive routing |
| Q2: Urgency | "Soon" | `urgencySignal='medium'` | +15 | Balanced routing |
| Q2: Urgency | "Later" | `urgencySignal='low'` | +15 | Exploratory routing |
| Q2: Urgency | **Skip** | `urgencySignal='medium'` | +0 | Default: medium |
| Q3: Scope | "My home" | `context.scope='residential'` | +15 | Residential routing |
| Q3: Scope | "My business" | `context.scope='business'` | +15 | Commercial routing |
| Q3: Scope | "Community" | `context.scope='community'` | +20 | Community-first, strong signal |
| Q3: Scope | **Skip** | `context.scope='multi'` | +0 | Default: show both |
| Q4: Category | Any selection | `tradeSignal={category}` | +10 | Personalization bonus |
| Q4: Category | **Skip** | `tradeSignal='unspecified'` | +0 | Category discovery deferred |

---

## D1 Flow Examples

### Example 1: Homeowner Seeking Contractor (Urgent)
```
Q1: "I need help with something" → intent='seek_help', confidence 35→55%
  ↓
Q2: "Right now / This week" → urgencySignal='high', confidence 55→70%
  ↓
Q3: "My home / Personal" → context.scope='residential', confidence 70→85%
  ↓
Q4: "Plumbing" → tradeSignal='plumbing', confidence 85→95%
  ↓
END → Scout shows: Plumbers in area, ready now, reviews+ratings, Direct Connect option
```

**Snapshot After D1**:
```json
{
  "intent": "seek_help",
  "urgencySignal": "high",
  "timelineSignal": "immediate",
  "context": {
    "scope": "residential",
    "businessType": "homeowner"
  },
  "tradeSignal": "plumbing",
  "confidence": 0.95,
  "onboardingComplete": true,
  "skippedQuestions": []
}
```

**Scout Response**:
> "Found 12 plumbers ready this week in your area. Starting with highest-rated."
> 
> **Actions**:
> - View Available Plumbers
> - Request Quote (Direct Connect)
> - Browse All Services

---

### Example 2: Contractor Offering Services (Community-Minded)
```
Q1: "I'm here to help others" → intent='offer_help', confidence 35→55%
  ↓
Q2: "No specific timeline" / SKIP → urgencySignal='none', confidence 55→65%
  ↓
Q3: "Multiple / All of the above" → context.scope='multi', confidence 65→80%
  ↓
Q4: SKIP → tradeSignal='unspecified', confidence 80→85%
  ↓
END → Scout shows: Where to apply, community groups, volunteer projects
```

**Snapshot After D1**:
```json
{
  "intent": "offer_help",
  "urgencySignal": "none",
  "context": {
    "scope": "multi",
    "isMultiFaceted": true
  },
  "tradeSignal": "unspecified",
  "confidence": 0.85,
  "onboardingComplete": true,
  "skippedQuestions": ["Q2", "Q4"]
}
```

**Scout Response**:
> "Great! Here's where you can help:"
> 
> **Actions**:
> - Apply as Contractor
> - Browse Community Groups
> - Volunteer Opportunities

---

### Example 3: Browser (Exploring)
```
Q1: "I'm exploring / learning" → intent='explore', confidence 35→45%
  ↓
Q2: SKIP (automatically skipped) → confidence 45→48%
  ↓
Q3: SKIP → confidence 48→50%
  ↓
Q4: SKIP → confidence 50→50%
  ↓
END → Scout shows: Trending projects, popular services, featured community
```

**Snapshot After D1**:
```json
{
  "intent": "explore",
  "urgencySignal": null,
  "context": {
    "scope": "multi"
  },
  "tradeSignal": "unspecified",
  "confidence": 0.50,
  "onboardingComplete": true,
  "skippedQuestions": ["Q2", "Q3", "Q4"]
}
```

**Scout Response**:
> "Welcome to TradeScout! Here's what's happening in your area:"
> 
> **Actions**:
> - Browse Trending Projects
> - Explore Services
> - View Community

---

## D1 Auto-Expiration Rules

**Onboarding flag expires when ANY of these occur**:

1. **Snapshot confidence ≥ 80%** (threshold reached)
   - User answered 2+ high-signal questions
   - Flag auto-expires, normal Scout resumes

2. **First successful action completes**
   - User views contractor profile
   - User sends message
   - User applies to project
   - Any significant engagement
   - Flag auto-expires, onboarding guidance hidden

3. **5 minutes elapsed** (timeout)
   - User spent 5+ minutes in onboarding flow
   - Assume sufficient context gathered
   - Flag auto-expires, normal Scout resumes

4. **User explicitly closes onboarding**
   - "Exit Onboarding" button always visible
   - Flag expires immediately
   - Normal Scout resumes

**Behavior After Expiration**:
- ✅ All softer language removed
- ✅ Extra explanations removed
- ✅ Contextual Q1-Q4 questions no longer injected
- ✅ Normal Scout rules resume
- ✅ Snapshot confidence persists (used for routing)
- ✅ User can re-trigger onboarding with `/scout?reset=true` (admin/testing only)

---

## D1 UI/UX Specs

### Question Card Layout
```
┌─────────────────────────────────────────┐
│  TradeScout Onboarding (Step X of Y)   │
│                                         │
│  [⊗] Exit Onboarding                   │
├─────────────────────────────────────────┤
│                                         │
│  🎯 What brings you to TradeScout?     │
│                                         │
│  "Helps Scout find the right people"   │
│                                         │
│  [ ] I need help with something       │
│  [ ] I'm here to help others          │
│  [ ] I'm exploring / learning         │
│                                         │
│  [Skip for now]                        │
│                                         │
├─────────────────────────────────────────┤
│  Confidence: ████░░░░░░ 40%           │
│  Questions answered: 0/4               │
└─────────────────────────────────────────┘
```

### Post-Answer State
```
┌─────────────────────────────────────────┐
│  ✓ Got it!                             │
│                                         │
│  You're looking for help (seek_help)   │
│                                         │
│  [→ Next Question]                     │
│                                         │
├─────────────────────────────────────────┤
│  Confidence: ███████░░░ 55%           │
│  Questions answered: 1/4               │
└─────────────────────────────────────────┘
```

### Onboarding Complete
```
┌─────────────────────────────────────────┐
│  ✓ You're all set!                     │
│                                         │
│  Confidence: ███████████ 95%           │
│                                         │
│  Scout is ready to help you find      │
│  plumbers in your area.               │
│                                         │
│  [→ Let's Go!]                         │
│                                         │
└─────────────────────────────────────────┘
```

---

## D1 Implementation Checklist (For D1-1 → D1-2 Transition)

- [ ] Question set designed ✓ (this doc)
- [ ] Snapshot signal mapping defined ✓ (above)
- [ ] Flow examples validated ✓ (above)
- [ ] Auto-expiration rules locked ✓ (above)
- [ ] UI/UX specs created ✓ (above)

---

## Next: D2 Wire the Flag

**D2-1 Tasks**:
1. Create `onboardingService.ts` with question flow logic
2. Wire `onboarding=true` parameter to Scout shell
3. Inject softer language + extra explanations
4. Inject contextual D1 questions
5. Implement auto-expiration checks
6. Resume normal Scout seamlessly
7. Validate build stays green

---

## Contract Compliance

✅ **Scout v1 Contract**:
- Answer + action always (every question ends with action path)
- No dead ends (skip always available, or natural progression)
- Community included when relevant (Q3 option)

✅ **Copilot Authority**:
- Design locked (Thomas approved proceeding to D1)
- No role-gating (questions are role-agnostic)
- No upfront blocking (questions are contextual, not forced)
- Guardrails reinforced (skip, exit, timeout)

✅ **TradeScout Principles**:
- Trust-first (confidence-based, not assumption-based)
- Relevance-only (questions refine snapshot, not replace it)
- Participation open (no paywalls, no forced verification)

