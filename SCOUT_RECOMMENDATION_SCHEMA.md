# Scout Recommendation Schema & Confidence Model

**Phase:** D2 (Authority Scaling)  
**Status:** Specification (Pre-Implementation)  
**Date:** 2025-12-30  
**Dependency:** DECISION_CARD_CONTACT_INTEGRATION.md, MESSAGING_AUTHORITY_CONTRACT.md

---

## 1. Core Principle

**Scout can recommend a person to contact when it has high confidence, and that recommendation pre-fills intent.**

A recommendation is not:
- "Here are people you might want to talk to" (social discovery)
- "Your friend added someone you should know" (network growth)

A recommendation **is**:
- "Based on your situation, you should contact [Person] for [Specific Reason]"

---

## 2. Recommendation Types & Entry Points

### 2.1 Recommendation Type Definition

```typescript
export enum RecommendationType {
  // Contextual: Based on user's current activity/decision
  DECISION_CONTEXT = 'decision_context',      // "For this problem, talk to X"
  CONVERSATION_FOLLOW_UP = 'conversation_followup', // "You may want to also contact Y"
  
  // Temporal: Based on time or circumstance
  SEASONAL_NEED = 'seasonal_need',            // "It's tax season, contact an accountant"
  COMMUNITY_EVENT = 'community_event',        // "Someone near you is hiring"
  
  // Behavioral: Based on past success
  SIMILAR_PAST_OUTCOME = 'similar_past_outcome', // "You hired this person for X; try them for Y"
}

export interface ScoutRecommendation {
  id: string;
  userId: string;
  
  // What is being recommended
  recommendationType: RecommendationType;
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  
  // Why it's being recommended
  reasoning: string; // Human-readable explanation
  context?: {
    decisionId?: string;        // If recommendation stems from a decision
    conversationId?: string;    // If stemming from ongoing conversation
    pastOutcomeId?: string;     // If based on similar past success
    communityEventId?: string;  // If event-driven
  };
  
  // Confidence metrics
  confidence: {
    score: number;              // 0.0 to 1.0
    components: {
      expertise_match: number;    // Target's skills vs need
      location_match: number;     // Geographic/scope alignment
      availability_match: number; // Based on recent activity
      past_success: number;       // Prior outcomes (if any)
      trust_signal: number;       // Verification, reviews, network
    };
    reasoning?: string;           // Why this score
  };
  
  // Intent pre-selection
  suggestedIntent: 'hire' | 'advise' | 'collaborate' | 'reconnect';
  intentReasoning: string;        // "You need to hire, not advise, because..."
  
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high';
  riskFlags?: string[];           // e.g., ["new_user", "first_contact", "high_budget"]
  riskMitigation?: string;        // "This person is new but verified and monitored"
  
  // Authority gate
  authorityGate: 'auto_allow' | 'manual_confirm' | 'caution' | 'blocked';
  
  // Lifecycle
  createdAt: timestamp;
  shownAt?: timestamp;
  actionAt?: timestamp;           // When user acted on recommendation
  action?: 'accepted' | 'dismissed' | 'overrode';
  
  // Outcome tracking
  conversationId?: string;        // If user created conversation
  outcomeId?: string;             // If conversation led to outcome
}
```

---

## 3. Confidence Scoring Model

### 3.1 Component Scoring (0.0 to 1.0 each)

```typescript
expertise_match: number
├─ Target's primary trade vs need (0.0-1.0)
├─ Years of experience in this specific area
├─ Certifications/credentials relevant to need
└─ Reviews mentioning this specific capability

location_match: number
├─ Same county: 1.0
├─ Same state, neighboring county: 0.7
├─ Same state, far: 0.4
└─ Other state (if relevant): 0.1-0.3

availability_match: number
├─ Active in past 3 days: 1.0
├─ Active in past week: 0.8
├─ Active in past month: 0.5
└─ Not active in past 30 days: 0.1

past_success: number
├─ 5+ successful outcomes with this user type: 1.0
├─ 3-4 outcomes: 0.8
├─ 1-2 outcomes: 0.5
├─ 0 outcomes (new contact): 0.3
└─ Prior failed outcome: 0.0

trust_signal: number
├─ Verified + 10+ reviews + 4.5+ stars: 1.0
├─ Verified + 5-10 reviews + 4.0+ stars: 0.8
├─ Verified + few reviews: 0.6
├─ Verified, unproven: 0.4
├─ Not verified: 0.0
```

### 3.2 Composite Score Calculation

```
confidence_score = (
  expertise_match * 0.30 +
  location_match * 0.25 +
  trust_signal * 0.25 +
  past_success * 0.15 +
  availability_match * 0.05
)
```

**Result Interpretation:**
```
0.85-1.0: auto_allow        (Recommend with confidence, minimal friction)
0.70-0.84: manual_confirm   (Recommend, user must confirm)
0.50-0.69: caution          (Show recommendation, warn uncertainty)
0.30-0.49: caution + alt    (Show + offer better alternatives)
< 0.30:   blocked           (Don't recommend, suggest different path)
```

### 3.3 Example Calculation

```
Scenario: Homeowner needs electrician for permit help

Target: Alex (electrician, 5 yrs local, 47 reviews, verified)

expertise_match:    0.95  (Specializes in permitting)
location_match:     1.0   (Same county)
trust_signal:       0.95  (Verified, 4.8 stars)
past_success:       0.8   (3 prior successful outcomes)
availability_match: 1.0   (Active today)

Composite = (0.95×0.30) + (1.0×0.25) + (0.95×0.25) + (0.8×0.15) + (1.0×0.05)
          = 0.285 + 0.25 + 0.2375 + 0.12 + 0.05
          = 0.9225

→ authorityGate: 'auto_allow'
→ Show recommendation with minimal friction
```

---

## 4. Recommendation UI & Entry Points

### 4.1 In-Message Recommendation

**When:** User is discussing a need in messages or community

**Context:** "I need to figure out permitting before I can hire"

**What Scout does:**
- Identifies that permitting expertise is needed
- Searches for local contacts with that expertise
- Calculates confidence (0.92+)
- Injects recommendation

**UI:**

```
┌──────────────────────────────────────────────────────┐
│ 💡 Scout Suggestion                                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ "Based on your question about permits, consider    │
│  contacting Alex Rodriguez. He specializes in       │
│  electrical permits and has done this for 47 clients │
│  in your area."                                      │
│                                                      │
│ [Explore] [Dismiss] [Not interested in this]        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Post-Conversation Recommendation

**When:** User's prior conversation ends with a referral

**Context:** Contractor says "You should also talk to an electrician"

**What Scout does:**
- Monitors conversation sentiment/content
- Detects "you should also talk to [role]"
- Finds matching contacts
- Presents recommendation

**UI:**

```
┌──────────────────────────────────────────────────────┐
│ 📞 Follow-Up Opportunity                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│ "Maria mentioned you'd benefit from electrical     │
│  expertise for the panel upgrade. Scout found:      │
│                                                      │
│  Alex Rodriguez                                      │
│  Licensed Electrician                               │
│  ⭐⭐⭐⭐⭐ (47 reviews)                           │
│  ✓ Verified • 5 yrs in Plano                       │
│                                                      │
│  Maria has worked with Alex before (2 times).      │
│  Scout confidence: 94%                              │
│                                                      │
│ [Contact About Panel Upgrade] [Skip] [See Others]  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.3 Decision-Context Recommendation

**When:** User is viewing a Decision Card

**Context:** Decision card about hiring for electrical work

**What Scout does:**
- Analyzes the decision scope
- Finds contacts matching the need
- Presents as potential outcomes (see Decision Card spec)

**UI:** (Integrated into Decision Card as contact outcome)

---

## 5. Intent Pre-Selection Model

### 5.1 Intent Mapping Rules

```typescript
recommendationType × targetUserRole → suggestedIntent

DECISION_CONTEXT × contractor  → 'hire'
DECISION_CONTEXT × advisor     → 'advise'
DECISION_CONTEXT × peer        → 'collaborate'

CONVERSATION_FOLLOWUP × contractor  → 'hire'
CONVERSATION_FOLLOWUP × peer        → 'collaborate'

SIMILAR_PAST_OUTCOME
├─ Past outcome was 'hire'           → 'hire'
├─ Past outcome was 'advise'         → 'advise'
└─ Past outcome was 'collaborate'    → 'collaborate'
```

### 5.2 Intent Overrides

```
Normal flow:
├─ Recommendation pre-selects intent
├─ User sees confirmation card
├─ Intent is locked (cannot change)

Low-confidence flow (score < 0.65):
├─ Recommendation shows intent with "?" indicator
├─ User can select from multiple intents
├─ Confidence score recalculated for each option
└─ Highest-confidence intent is default

Blocked flow (score < 0.3):
├─ No recommendation shown
├─ Instead: "Here's why Scout didn't recommend this"
├─ [View alternatives] or [Ask Scout why]
```

---

## 6. Authority Gate Rules

### 6.1 Gate Logic

```
if confidence >= 0.85 and riskLevel === 'low':
  authorityGate = 'auto_allow'
  friction = minimal
  intent = pre-selected
  
else if confidence >= 0.70 and riskLevel === 'low':
  authorityGate = 'manual_confirm'
  friction = moderate
  intent = pre-selected
  user = must click [Confirm]
  
else if confidence >= 0.50 and riskLevel <= 'medium':
  authorityGate = 'caution'
  friction = high
  intent = pre-selected but marked questionable
  ui = shows risk flags
  user = must click [Understand Risks]
  
else if confidence < 0.50:
  authorityGate = 'blocked'
  friction = complete
  recommendation = not shown
  ui = shows alternatives only
```

### 6.2 Risk Mitigations

```
if riskFlag = 'new_user':
  show = "This person is new but verified and monitored"
  add = 1-week message review period (Scout monitors first exchange)
  
if riskFlag = 'high_budget':
  show = "Scout recommends starting with a smaller scope"
  suggest = "Request a phase-based pricing structure"
  
if riskFlag = 'first_contact':
  show = "No prior contact history. Start with a clear scope."
  suggest = "Write a detailed first message"
  
if riskFlag = 'rare_expertise':
  show = "This is a niche skill. Confirm they have current experience."
  suggest = "Ask about their most recent similar project"
```

---

## 7. Recommendation Response Tracking

### 7.1 Lifecycle Events

```
RECOMMENDATION_CREATED
  └─ createdAt: timestamp
  └─ reason: why this recommendation
  └─ confidence: 0.92

RECOMMENDATION_SHOWN
  └─ shownAt: timestamp
  └─ surfaceLocation: 'in_messages' | 'community' | 'decision_card'
  └─ impressionId: (for metrics)

USER_DISMISSED
  └─ actionAt: timestamp
  └─ action: 'dismissed'
  └─ reason?: (optional user feedback)

USER_ACCEPTED
  └─ actionAt: timestamp
  └─ action: 'accepted'
  └─ conversationId: created from recommendation

CONVERSATION_CREATED
  └─ conversationId: generated
  └─ intent: 'hire' (from recommendation)
  └─ authorityGate: 'scout_recommendation'

OUTCOME_RECORDED
  └─ outcomeId: recorded outcome
  └─ outcome_type: 'hire' | 'failed' | 'inconclusive'
  └─ success: boolean
  └─ feedback: user satisfaction

CONFIDENCE_UPDATED
  └─ If outcome was successful → increase future confidence for this pair
  └─ If outcome was failed → decrease or block future recommendations
  └─ Learning feeds into past_success component
```

### 7.2 Feedback Loop

```
Post-Conversation Feedback:

User rates outcome: ⭐⭐⭐⭐☆ (4 stars)

Scout updates:
├─ past_success component increases
├─ Confidence score increases for future recommendations
├─ If 5 successful outcomes → Mark as "Trusted pair"
├─ Future recommendations from this pair score higher

User rating: ⭐☆☆☆☆ (1 star)

Scout updates:
├─ past_success component decreases
├─ Confidence score decreases
├─ If 2+ failed outcomes → Block future recommendations
├─ Log for abuse/scam detection
```

---

## 8. Fail-Safe Mechanisms

### 8.1 Rate Limiting

```
Max recommendations per user per day: 3
Max recommendations per user per week: 10

Rationale:
├─ Prevents recommendation spam
├─ Keeps Scout's signal credible
├─ Forces high-confidence filtering
```

### 8.2 Diversity Requirement

```
If user hasn't accepted recommendations in 7 days:
├─ Stop showing recommendations from same domain
├─ Or lower confidence threshold
├─ Or show alternatives explicitly

Rationale:
├─ Don't become a single gatekeeper
├─ Preserve user agency in discovery
├─ Prevent over-reliance on Scout
```

### 8.3 Override Logging

```
If user overrides Scout's caution/block:
├─ Log the override
├─ Record user's reasoning (if provided)
├─ Monitor for patterns (abuse signal)
├─ Adjust confidence for this pair going forward

Overrides > 20% → Audit Scout's confidence model
```

---

## 9. API Contracts

### 9.1 POST /api/scout/recommendations (Internal)

**Called by:** Scout engine when recommendation is generated

```typescript
POST /api/scout/recommendations
{
  userId: "user_123",
  recommendationType: "decision_context",
  targetUserId: "alex_456",
  suggestedIntent: "hire",
  confidence: {
    score: 0.92,
    components: {
      expertise_match: 0.95,
      location_match: 1.0,
      trust_signal: 0.95,
      past_success: 0.8,
      availability_match: 1.0
    },
    reasoning: "High expertise match, same county, verified"
  },
  riskLevel: "low",
  riskFlags: [],
  reasoning: "You mentioned permitting. Alex specializes in electrical permits.",
  context: { decisionId: "decision_789" }
}

Response:
{
  recommendationId: "rec_xxx",
  createdAt: timestamp,
  authorityGate: 'auto_allow',
  status: 'created'
}
```

### 9.2 GET /api/scout/recommendations/pending (User-facing)

**Called by:** Frontend to fetch recommendations to show

```typescript
GET /api/scout/recommendations/pending?surface=in_messages

Response:
{
  recommendations: [
    {
      id: "rec_xxx",
      targetUserName: "Alex Rodriguez",
      targetUserRole: "Electrician",
      reasoning: "You mentioned permitting. Alex specializes in electrical permits.",
      suggestedIntent: "hire",
      confidence: 0.92,
      authorityGate: "auto_allow",
      riskLevel: "low"
    }
  ],
  count: 1
}
```

### 9.3 POST /api/scout/recommendations/:id/action (User Response)

**Called by:** Frontend when user acts on recommendation

```typescript
POST /api/scout/recommendations/rec_xxx/action
{
  action: 'accepted' | 'dismissed' | 'overrode',
  userFeedback?: string,
  selectedIntent?: 'hire' | 'advise' | 'collaborate' // If overriding
}

Response:
{
  recommendationId: "rec_xxx",
  action: "accepted",
  actionAt: timestamp,
  nextStep: {
    conversationId: "conv_yyy" // If creating conversation
    OR
    surfaceRoute: "/discover-people" // If exploring more
  }
}
```

### 9.4 POST /api/scout/feedback/outcome (Outcome Loop)

**Called by:** Conversation/outcome system after outcome is recorded

```typescript
POST /api/scout/feedback/outcome
{
  outcomeId: "outcome_xxx",
  recommendationId: "rec_xxx",  // If this conversation was from a recommendation
  success: true | false,
  rating: 1-5,
  userNotes?: string
}

Response:
{
  outcomeId: "outcome_xxx",
  feedbackRecorded: true,
  confidenceAdjustment: { before: 0.92, after: 0.94 }
}
```

---

## 10. Implementation Checklist

### Phase D2.1: Data Model
- [ ] Add ScoutRecommendation table to schema
- [ ] Add recommendation status tracking columns
- [ ] Create indexes on (userId, createdAt) and (userId, shownAt)

### Phase D2.2: Recommendation Engine
- [ ] Implement confidence scoring function
- [ ] Build recommendation generation triggers (decision context, conversation monitoring)
- [ ] Create authority gate classification logic
- [ ] Add rate limiting and diversity checks

### Phase D2.3: API Endpoints
- [ ] POST /api/scout/recommendations (internal)
- [ ] GET /api/scout/recommendations/pending (user-facing)
- [ ] POST /api/scout/recommendations/:id/action (user response)
- [ ] POST /api/scout/feedback/outcome (outcome loop)

### Phase D2.4: Frontend
- [ ] Create recommendation card component (multiple variants for different surfaces)
- [ ] Wire recommendations into message stream
- [ ] Add feedback loop for outcome tracking
- [ ] Handle low-confidence intent overrides

### Phase D2.5: Testing
- [ ] Confidence scoring (unit tests for each component)
- [ ] Rate limiting and diversity checks
- [ ] Intent override handling
- [ ] Outcome feedback integration

### Phase D2.6: Metrics & Monitoring
- [ ] Dashboard: Recommendation acceptance rate
- [ ] Dashboard: Confidence vs success correlation
- [ ] Alert: If block rate > 25% (confidence model issue)
- [ ] Alert: If acceptance rate drops (credibility issue)

---

## 11. Future Extensions (Phase D3+)

```
Network-Based Recommendations:
├─ "Your friend Maria worked with Alex. Try them."
├─ Mutual connection increases confidence
└─ Community endorsement signals

Behavioral Learning:
├─ "You always hire specialists early. Try this person now?"
├─ User's past patterns inform recommendations
└─ Personalized confidence scoring

Contextual Urgency:
├─ "It's heating season. Consider a technician now"
├─ Seasonal/temporal recommendations
└─ Preventive vs reactive framing
```

---

## 12. Relationship to Authority Model

This specification **scales authority safely**:

✅ **Intent is pre-selected, not user-chosen**
- Recommendation pre-fills intent based on Scout's analysis
- User confirms intent within recommendation, not later
- No picking "a different intent" on the messaging side

✅ **Confidence is quantified and transparent**
- User sees confidence score and risk flags
- Low confidence = extra friction (not hidden)
- Recommendations can be blocked if unsafe

✅ **Authority gate is captured**
- `authorityGate: 'scout_recommendation'` in conversation metadata
- Different from decision_card or user_search
- Enables audit trail and learning

✅ **Feedback loop improves over time**
- Successful outcomes increase future confidence
- Failed outcomes decrease or block future recommendations
- Scout learns what recommendations work

---

## Summary

**Scout recommendations are high-confidence, pre-intentioned suggestions to contact someone.**

They are **not**:
- Casual discovery
- Social network growth
- Relationship building

They **are**:
- Contextual solutions
- Authority-backed guidance
- Outcome-driven

Next phase: Implementation of Phase D1 (Decision Card contact integration) will prove that contact-as-outcome works. Then D2 scales it with Scout's predictive recommendations.

