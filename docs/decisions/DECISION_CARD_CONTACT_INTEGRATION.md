# Decision Card → Contact Integration Specification

**Phase:** D1 (Messaging Authority Compound)  
**Status:** Specification (Pre-Implementation)  
**Date:** 2025-12-30  
**Dependency:** MESSAGING_AUTHORITY_CONTRACT.md  

---

## 1. Core Principle

**Contact is a decision outcome, not an independent affordance.**

A user does not "find someone and message them."

A user "decides what they need → Scout proposes a person → user confirms the decision → contact is a consequence."

---

## 2. Decision Card Contact Outcome (Type Definition)

### 2.1 Outcome Type

```typescript
export type DecisionOutcome = 
  | 'information'
  | 'guidance'
  | 'hiring'
  | 'collaboration'
  | 'direct_contact'  // ← NEW: Contact as an outcome
  | 'research'
  | 'escalation';

// Specialized outcome for messaging
export interface ContactOutcome extends BaseOutcome {
  type: 'direct_contact';
  targetUserId: string;
  targetUserName: string;
  targetUserRole: string;
  targetUserLocation?: string;
  
  // Authority context (pre-filled by Scout)
  suggestedIntent: 'hire' | 'advise' | 'collaborate' | 'reconnect';
  reasonForContact: string; // e.g., "Electrical expertise needed for permit process"
  confidenceScore: number; // 0.0 to 1.0
  riskFlags?: string[]; // e.g., ["first_time_contact", "high_budget"]
  
  // Messaging contract binding
  decisionCardId: string;
  decisionScope: string; // inherited from the decision
  authorityGate: 'allow' | 'caution' | 'block'; // populated by Scout
  
  // Optional: pre-approval from recipient
  recipientConsent?: {
    consentedAt: timestamp;
    consentedVia: 'auto_subscribed' | 'explicit_opt_in';
  };
}
```

### 2.2 Card Definition

```typescript
export interface DecisionCardWithContactOutcome {
  id: string;
  userId: string;
  intent: string; // e.g., "hire_electrician"
  scope: string;  // geographic or trade scope
  status: 'active' | 'completed' | 'archived';
  
  // Decision narrative
  title: string;
  description: string;
  context: {
    budget?: number;
    timeline?: string;
    scope?: string;
    constraints?: string[];
  };
  
  // Possible outcomes (one of which is ContactOutcome)
  proposedOutcomes: DecisionOutcome[];
  
  // If one outcome is direct_contact:
  contactOutcome?: ContactOutcome;
  
  // Scout's assessment
  scoutAssessment?: {
    confidence: number;
    riskScore: number;
    recommendedOutcome: DecisionOutcome;
    alternativeOutcomes?: DecisionOutcome[];
  };
  
  // Lifecycle
  createdAt: timestamp;
  updatedAt: timestamp;
  decidedAt?: timestamp;
  decidedOutcome?: DecisionOutcome;
}
```

---

## 3. User Flow: Decision Card → Contact

### 3.1 Happy Path

```
User Views Decision Card
  (e.g., "I need to hire an electrician for permit help")
    ↓
Scout Proposes Outcomes
  [Get information] [Hire a specialist] [Ask for advice]
  
  Highlighted (if confident):
  "Hire: Consider contacting Alex (verified electrician, 5 yrs local)"
    ↓
User Clicks "Hire Alex"
    ↓
Contact Outcome Card Opens
  Read-only summary:
  ┌─────────────────────────────────────────┐
  │ You're about to contact:                 │
  │ Alex Rodriguez, Electrician              │
  │ Reason: Electrical expertise needed      │
  │ Intent: Hiring                           │
  │ Risk: Low (verified, 50 prior jobs)      │
  │ Scout confidence: 87%                    │
  │                                         │
  │ [Cancel] [Confirm & Send Message] [Ask Scout] │
  └─────────────────────────────────────────┘
    ↓
User Clicks "Confirm & Send Message"
    ↓
POST /api/conversations/start
  {
    targetUserId: "alex_123",
    intent: "hire",
    initiatedFromDecisionId: "decision_456",
    decisionScope: "electrical_permit_help",
    authorityGate: "decision_card",
    confidenceScore: 0.87,
    riskFlags: [],
  }
    ↓
API Returns 201 Created
  {
    conversationId: "conv_789",
    message: "Contact initiated. Alex will see your message.",
    metadata: { intent, decisionId, authorityGate }
  }
    ↓
User Sees Success State
  "Message sent to Alex. Continue with other outcomes or close."
    ↓
Conversation Appears in /messages
  With decision context visible
```

### 3.2 Scout Caution Path

```
Scout Confidence = 0.45 (below threshold)
↓
Outcome card shows:
  ⚠️ Scout is uncertain about this match
  "This person may not be the right fit. Consider:"
  [Ask Scout why] [Select someone else] [Proceed anyway]
↓
If "Proceed anyway":
  User must manually confirm intent
  (Cannot auto-pass with low confidence)
↓
Same confirmation card, but flagged with caution icon
```

### 3.3 Scout Block Path

```
Scout Confidence < 0.3 OR Risk Flags Present
↓
Outcome card shows:
  🚫 Scout recommends against this contact
  "Reason: [Specific explanation]"
  "Alternatives: [Other recommendations]"
  
  [Accept recommendation] [Override (requires reason)]
↓
If "Override":
  Forced text input: "Why are you overriding?"
  POST /api/scout/override-decision { reason }
  Logged for audit trail
↓
If confirmed despite warning:
  Same confirmation flow, but with explicit "I understand" checkbox
```

---

## 4. Contact Outcome Card: UI Specification

### 4.1 Confirmation State

```
┌─────────────────────────────────────────────────────────────┐
│  Contact Confirmation                                  [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📞 You're about to contact:                               │
│                                                             │
│  ┌──────────────┐                                          │
│  │   [Avatar]   │  Alex Rodriguez                          │
│  │              │  Electrician, Plano TX                   │
│  │              │  ✓ Verified • 5 yrs local               │
│  └──────────────┘  ⭐⭐⭐⭐⭐ (47 reviews)                  │
│                                                             │
│  Why this contact?                                          │
│  ────────────────────────────────────────────────────────  │
│  Intent:  Hiring for electrical work                       │
│  Reason:  Expertise in permit processes                    │
│  Scope:   Residential electrical work                      │
│                                                             │
│  Scout's Assessment                                         │
│  ────────────────────────────────────────────────────────  │
│  Confidence: ████████░ 87%                                 │
│  "High match. Alex specializes in this exact scenario."    │
│                                                             │
│  Risk Factors:                                             │
│  • None identified                                         │
│                                                             │
│  Before You Contact                                         │
│  ────────────────────────────────────────────────────────  │
│  ☐ I understand this is a real person with high standard  │
│  ☐ I'm ready to respect their response time               │
│                                                             │
│  [Cancel]  [Ask Scout More]  [Confirm & Send]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Error States

#### Low Confidence
```
⚠️  CAUTION: Scout is uncertain about this match

Reason: First-time contact with this user type
Confidence: ████░░░░░ 42%

Recommendations:
• Browse their profile first
• Check their reviews and past work
• Contact someone with higher match

[Proceed Anyway]  [Back to Recommendations]
```

#### Blocked
```
🚫  BLOCKED: Scout recommends against this contact

Reason: This person has reported similar requests as spam
Risk Level: HIGH

Alternatives available:
[Alex Rodriguez - Electrician] (87% match)
[Maria Chen - Licensed Contractor] (71% match)

[Accept Recommendation]  [Why was this blocked?]
```

---

## 5. Integration with Messaging Authority Contract

### 5.1 Intent Mapping

**Decision Card intent → Messaging intent (1:1)**

```
Decision Outcome          Messaging Intent
────────────────────────────────────────
hiring                    'hire'
collaboration             'collaborate'
guidance                  'advise'
previous_contact          'reconnect'
```

**Immutable Binding:**
- Intent is pre-selected by Scout based on decision
- User confirms the entire outcome, including intent
- No "pick a different intent" option on the messaging side
- Intent is locked when conversation is created

### 5.2 Authority Gate

```typescript
authorityGate values in Decision Card context:
- 'decision_card': Contact originated from a Decision Card (highest trust)
- 'scout_recommendation': Contact suggested by Scout (medium trust)
- 'user_search': Contact from free discovery (lowest trust, requires full intent)

At messaging creation:
{
  authorityGate: 'decision_card',
  decisionId: 'decision_456',
  decisionScope: 'electrical_permit_help',
  confidenceScore: 0.87,
}
```

---

## 6. API Contract Changes

### 6.1 POST /api/conversations/start (Extended)

**Existing validation:**
- ✅ Intent required
- ✅ User verified
- ✅ Recipient verified

**New validation (Decision Card path):**

```typescript
if (authorityGate === 'decision_card') {
  // Decision Card origin must pass additional checks
  
  1. Validate decisionCardId exists and belongs to user
  2. Validate decision is 'active' or 'pending_completion'
  3. Validate contact outcome exists in decision
  4. Validate intent matches decision's suggested intent
  5. Validate decision's decisionScope matches messaging scope
}

if (authorityGate === 'user_search') {
  // User discovery requires full intent selection (existing flow)
  // No additional checks beyond current validation
}

if (authorityGate === 'scout_recommendation') {
  // Scout recommendations (Phase D2)
  // Validate scoutRecommendationId and confidence threshold
  // Future implementation
}
```

### 6.2 New Metadata Fields

```typescript
interface ConversationMetadata {
  // ... existing fields ...
  
  // Decision Card origin
  initiatedFromDecisionId?: string;
  decisionScope?: string;
  decisionTitle?: string;
  
  // Authority source
  authorityGate: 'decision_card' | 'scout_recommendation' | 'user_search';
  
  // Decision context
  decisionContext?: {
    budget?: number;
    timeline?: string;
    constraints?: string[];
  };
  
  // Confidence at creation time (immutable snapshot)
  scoutConfidenceAtCreation?: number;
  riskFlagsAtCreation?: string[];
}
```

### 6.3 GET /api/decisions/:id/contact-outcome (New)

**Purpose:** Fetch the contact outcome for a specific decision

```typescript
GET /api/decisions/decision_456/contact-outcome

Response:
{
  decisionId: "decision_456",
  contactOutcome: {
    type: "direct_contact",
    targetUserId: "alex_123",
    targetUserName: "Alex Rodriguez",
    suggestedIntent: "hire",
    reasonForContact: "Electrical expertise needed for permit process",
    confidenceScore: 0.87,
    authorityGate: "allow",
    riskFlags: [],
  },
  scoutAssessment: {
    confidence: 0.87,
    reasoning: "High match. Alex specializes in this exact scenario.",
    alternativeContacts: [
      { userId: "maria_456", name: "Maria Chen", confidence: 0.71 }
    ]
  }
}
```

---

## 7. State Machine: Decision Card Contact Outcome

```
┌──────────────────────┐
│  Decision Created    │
│  (Contact outcome    │
│   not yet proposed)  │
└──────────┬───────────┘
           │
           │ Scout assesses
           ↓
┌──────────────────────────┐
│  Outcome Proposed        │
│  (User sees card with    │
│   contact as option)     │
└──────────┬───────────────┘
           │
           │ User clicks "Contact [Person]"
           ↓
┌──────────────────────────┐
│  Confirmation Shown      │
│  (Read-only summary)     │
│  User can:               │
│  - Cancel                │
│  - Confirm               │
│  - Ask Scout             │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │          │
   Cancel    Confirm
      │          │
      ↓          ↓
  ┌─────────┐  ┌──────────────────────┐
  │ Back to │  │ POST /conversations/ │
  │ Card    │  │ start (with intent)  │
  └─────────┘  └──────────┬───────────┘
                           │
                    ┌──────┴──────┐
                    │             │
                 201         403/400
                (Created)    (Blocked/Invalid)
                    │             │
                    ↓             ↓
            ┌──────────────┐  ┌──────────────┐
            │ Conversation │  │ Error Message│
            │ Created      │  │ (Read reason)│
            │ → Messages   │  │ → Recommend  │
            │              │  │    alternatives
            └──────────────┘  └──────────────┘
```

---

## 8. Failure Cases & Handling

### 8.1 Decision Card Expired

```
User returns to a decision after 30 days

Decision status: 'archived'

Outcome: Contact option is disabled
Message: "This decision is archived. Start a new decision to contact [Person]."
```

### 8.2 Recipient No Longer Verified

```
Scout assesses during confirmation

Recipient now has addressVerified = false

Outcome: Block (403)
Message: "[Name] is no longer verified. We can't establish a safe connection."
```

### 8.3 User Role Mismatch

```
Homeowner decision card trying to contact another homeowner

Outcome: Block (403)
Message: "You can only hire contractors, not other homeowners."
```

### 8.4 Race Condition (Double Submit)

```
User submits confirmation twice quickly

Second request finds conversation already exists

Outcome: 200 OK with existing conversationId
(No error, just returns what was already created)
```

---

## 9. KPI Measurements

### 9.1 Usage Metrics

```
conversations_started_via_decision_card
  / conversations_started_total

Block Rate:
  conversations_blocked_by_scout
  / conversations_attempted_via_decision_card

Intent Accuracy:
  message_first_response_aligns_with_intent
  vs message_first_response_indicates_misframing
```

### 9.2 Guardrails

```
If block_rate > 15%:
  → Decision Cards are mis-framing intents
  → Review Scout's decision card assessment logic

If rejection_rate > 25%:
  → Contact outcomes are being generated for incompatible pairs
  → Audit confidence scoring

If success_rate < 60%:
  → Users are overriding Scout cautions (not ideal)
  → Review confidence thresholds
```

---

## 10. Implementation Checklist

### Phase D1.1: API Changes
- [ ] Add `authorityGate`, `decisionId`, `decisionScope` to conversation metadata schema
- [ ] Update POST /api/conversations/start to validate `authorityGate: 'decision_card'`
- [ ] Add decision card validation checkpoint
- [ ] Create GET /api/decisions/:id/contact-outcome endpoint
- [ ] Add logging for all decision card contact attempts

### Phase D1.2: Decision Card Component Updates
- [ ] Add ContactOutcome type to decision outcome types
- [ ] Create contact outcome card UI component
- [ ] Wire up Scout's contact recommendation to outcomes
- [ ] Add confirmation modal with read-only summary
- [ ] Handle caution/block states with alternatives

### Phase D1.3: Integration & Routing
- [ ] Update Decision Card rendering to show contact outcomes
- [ ] Wire contact outcome CTA to confirmation flow
- [ ] Route confirmation submit to POST /api/conversations/start
- [ ] Show success/error states with clear messaging
- [ ] Update /messages to show decision context in conversation list

### Phase D1.4: Testing
- [ ] API: Valid decision card contact → 201 Created
- [ ] API: Invalid/expired decision card → 400/403
- [ ] API: Low confidence decision card → 403 Caution
- [ ] UI: Contact card displays all metadata correctly
- [ ] UI: Confirmation modal has checksums before submit
- [ ] Race condition: Double submit returns existing conversation

### Phase D1.5: Rollout (Pilot User)
- [ ] Deploy to pilot user (traderscornerllc@gmail.com)
- [ ] Monitor block rates and success metrics
- [ ] Review first N conversations for intent accuracy
- [ ] Iterate on Scout confidence scoring if needed

---

## 11. Relationship to Messaging Authority Contract

This specification **reinforces** the contract:

✅ **"Messaging is a consequence of a decision"**
- Contact is now an outcome card, not a standalone affordance
- Decision Card defines the frame before any contact happens

✅ **"Intent is pre-selected, not user-chosen at contact time"**
- Scout sets intent based on decision type
- User confirms the entire outcome (including intent)
- No picking a "different intent" on the messaging side

✅ **"Authority gate captures the source of truth"**
- authorityGate = 'decision_card' is the highest-confidence path
- Scout's assessment is captured immutably
- All metadata is locked at conversation creation

✅ **"Contact cannot be blocked arbitrarily"**
- If Scout says 'block', user sees the reason
- User can override, but it's logged and audited
- No silent denials, no hidden decision logic

---

## 12. Summary

**The Rule:** Contact is not an action. It is an outcome of a decision.

**Implementation:**
- Decision Cards propose contacts as outcomes
- Scout assesses each contact proposal
- User confirms the entire outcome frame
- Conversation is created with full context
- Authority is preserved throughout

**Next Phase:** Scout recommendations (Phase D2) will follow this same pattern but with probabilistic suggestions instead of decision-driven outcomes.

