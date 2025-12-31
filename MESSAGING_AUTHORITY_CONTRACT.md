# Messaging Authority Contract

**Status:** Locked Specification (Non-negotiable)  
**Date:** 2025-12-30  
**Principle:** Messaging is a consequence of a governed decision, never an entry point.

---

## 1. Core Rule

**A conversation may only be created if:**

1. It originates from an explicit decision context
2. That context has an intent scope (Hire / Advise / Collaborate / Reconnect)
3. Scout has assessed the authority and risk before contact is allowed
4. The conversation is bound to that decision scope for the entire lifecycle

**Corollary:** Messaging cannot be an independent feature. It is subordinate to decision-making.

---

## 2. Conversation Creation Rules (Immutable)

### Only Allowed Triggers

#### A. Decision Card → Intent Selection → Scout Assessment → Start Conversation

Flow:
1. User lands on a Decision Card (seeking hiring, advice, collaboration, etc.)
2. User explicitly states: "I want to contact [Person] about [Intent]"
3. Scout frames the decision with risk/confidence context
4. Scout determines authority: **Allow** / **Caution** / **Block**
5. If Allow/Caution: "Start Conversation" button appears
6. Conversation is created with decision metadata attached

Metadata captured:
- `initiatingDecisionId`: Reference to the Decision Card
- `intent`: One of `'hire'` | `'advise'` | `'collaborate'` | `'reconnect'`
- `riskScope`: Inherited from Scout's decision assessment
- `confidenceScope`: Current Scout confidence state for this user pair
- `authorityGate`: What Scout decided (allow/caution/block)

---

#### B. Existing Relationship → Continuation of Prior Conversation

Flow:
1. User and recipient have a prior conversation
2. That prior conversation has an associated outcome (hired, collaborated, etc.)
3. Scout has recorded that outcome and adjusted confidence
4. User can continue the conversation with reduced friction
5. New message inherits the prior context

Metadata:
- `priorOutcomeId`: Reference to the historical outcome
- `riskScope`: Updated based on prior success
- `confidenceScope`: Lifted by successful prior interaction
- `intent`: Unchanged or user-updated (if intent shifts, it re-routes to Decision Card flow)

---

#### C. Scout Recommendation with Intent Frame

Flow:
1. Scout has recommended a person (e.g., "Someone in your network can help with this")
2. Recommendation includes an explicit intent frame
3. User clicks "Ask Scout first" or "Explore collaboration"
4. Scout displays the recommendation context with intent
5. If user proceeds, they must confirm intent before conversation opens
6. Decision Card is generated retroactively

Metadata:
- `initiatedByScout`: true
- `scoutRecommendationId`: Reference to the recommendation
- `intent`: Suggested by Scout, confirmed by user
- `riskScope`: Scout-assessed before recommendation
- `confidenceScope`: Based on Scout's analysis

---

### Disallowed Triggers (Hard Block)

The following **cannot** initiate a conversation:

- ❌ Direct user search → browse profile → message button
- ❌ "Discover People" / friend suggestions → "Message" action
- ❌ "Add Friend" button that opens messaging
- ❌ Profile visit → "Contact" button without decision context
- ❌ Any messaging affordance that doesn't stem from a decision or prior outcome
- ❌ Spontaneous outreach based on proximity, role, or availability alone

If a user tries to access messaging without one of the three allowed triggers, they are redirected to:

- Scout (if in a decision context)
- Their existing conversations (if continuing a prior relationship)
- A message explaining why direct messaging isn't available here

---

## 3. Required Metadata on Every Conversation

Every conversation document in the database must contain:

```typescript
interface ConversationMetadata {
  // Identity
  conversationId: string;
  userId: string;
  recipientId: string;

  // Decision Context
  intent: 'hire' | 'advise' | 'collaborate' | 'reconnect' | 'unknown';
  initiatedFromDecisionId?: string;  // Optional, null if Scout-initiated
  initiatedFromScoutRecommendationId?: string;  // Optional

  // Authority & Confidence
  authorityGate: 'allow' | 'caution' | 'block';
  riskScope: string;  // e.g., "same_county_contractor", "trusted_network"
  confidenceScope: number;  // 0.0 to 1.0
  confidenceScopeReason?: string;

  // Role Context
  initiatorRole: string;  // e.g., "homeowner", "contractor"
  recipientRole: string;  // e.g., "contractor", "advisor"

  // Lifecycle
  createdAt: timestamp;
  intentConfirmedAt?: timestamp;  // When user confirmed intent (scout-initiated only)
  lastMessageAt?: timestamp;
  status: 'active' | 'archived' | 'blocked';

  // Outcomes (filled after conversation ends)
  outcomeId?: string;
  outcomeRecordedAt?: timestamp;
  outcomeType?: 'hire' | 'collaboration' | 'advice_received' | 'reconnect' | 'no_outcome';
  userReview?: 'positive' | 'neutral' | 'negative' | 'unspecified';
}
```

**Any conversation missing this metadata is invalid and should not exist.**

---

## 4. How Decision Card Maps to Conversation Lifecycle

### The Spine: Decision → Assessment → Contact → Outcome

```
User's Situation
    ↓
Scout Decision Card
  (What am I trying to achieve?)
    ↓
Scout Assessment
  (Should I contact this person? What's the risk?)
    ↓
Authority Gate
  ALLOW    → "Start Conversation" button + metadata
  CAUTION  → "Start with Scout's context" + metadata
  BLOCK    → User blocked from messaging; explain why
    ↓
Conversation Created
  (Now open and decision-scoped)
    ↓
User Communicates with Purpose
  (Intent is already framed)
    ↓
Outcome Recorded
  (Scout learns from the result)
    ↓
Future Confidence Updated
  (Similar future decisions use this learning)
```

### Key Invariant

**A conversation's metadata must never be editable by the user.**

Once created, it is a permanent record of why the contact was made. This prevents:
- Reframing an intent after the fact
- Hiding the original risk context
- Gaming the authority system

---

## 5. What Scout Must Know Before Allowing Contact

Before Scout says "Allow" or "Caution," it must have assessed:

### User Context

- **Who is initiating?**
  - User ID, location (county/state), role (homeowner/contractor)
  - Verified status (address verification complete?)
  - Trust score with this recipient (if any prior history)

- **Historical behavior:**
  - Has this user followed through on prior contacts?
  - Any negative outcomes or reports?
  - Communication style and responsiveness?

### Intent Context

- **What are they trying to achieve?**
  - Hire / Advise / Collaborate / Reconnect
  - Specificity: "I need a plumber for a roof leak" vs. generic
  - Budget or scope (if applicable)

### Recipient Context

- **Who are they contacting?**
  - Recipient ID, location, role, verification status
  - Relevant expertise or trade?
  - Availability (active in last 30 days?)
  - Reputation in their network

- **Prior outcomes with this recipient:**
  - Has this recipient done work for this user before?
  - How many positive outcomes in the network?
  - Any complaints or issues?

### Risk Assessment

- **Geographic / role alignment:**
  - Is recipient in same county? State? Farther?
  - Does recipient's trade match the need?
  - Are they addressing a high-risk scenario (e.g., hiring for major work vs. advice)?

- **Trust signals:**
  - Is recipient verified?
  - Do they have reviews from the same user type?
  - Are they in a trusted subnetwork (mutual connections, etc.)?

- **Confidence calculation:**
  - Based on all of the above, what's Scout's confidence that this contact will be productive?
  - 0.0–0.3: Block (too risky)
  - 0.3–0.7: Caution (allow with context)
  - 0.7–1.0: Allow (high confidence)

---

## 6. Conversation Lifecycle & Scout's Role

### Phase 1: Creation (Decision-Scoped)

- Conversation is created with full metadata
- Intent, risk, and confidence are locked in
- User is reminded of Scout's context ("Scout assessed this as [Caution] due to [reason]")
- First message is sent in this context

### Phase 2: Active Messaging

- Users exchange messages naturally
- Scout monitors for:
  - Tone shifts (e.g., pressure, urgency)
  - Scope creep (conversation drifting from the original intent)
  - Red flags (requests for upfront payment, suspicious details)
- If a red flag appears, Scout can inject a caution into the thread
- Users can update the intent if the conversation evolves (re-triggers assessment)

### Phase 3: Outcome Recording

- When one party indicates the outcome ("I hired them" / "We collaborated" / "No match"), Scout prompts for recording
- Outcome is recorded with:
  - Type (hire, collaboration, advice, reconnect, no outcome)
  - User satisfaction (positive, neutral, negative)
  - Any notes or context
- Scout updates confidence scores for future similar decisions

### Phase 4: Archival or Continuation

- If outcome is recorded and conversation naturally ends, it's archived
- If users want to continue (e.g., ongoing project), conversation remains active with updated confidence
- If a new intent emerges, it's treated as a new decision (creating a separate conversation thread if necessary)

---

## 7. Entry Point Mapping (Implementation Checklist)

### Where Each Allowed Trigger Lives

#### ✅ Decision Card → Intent Selection

- Location: Inside a Decision Card flow (e.g., Scout is helping user think through hiring)
- Button label: "I want to contact someone about this" or "Ask [Person] for help"
- Action: Opens intent selector → Authority assessment → Conversation creation

#### ✅ Existing Conversation Continuation

- Location: Messages tab, existing conversation thread
- Button label: "Reply" or natural message input
- Action: Appends message to existing conversation
- No new assessment needed (trust already scoped)

#### ✅ Scout Recommendation

- Location: Inside a Scout suggestion or recommendation
- Button label: "Explore collaboration" or "Learn more"
- Action: Shows recommendation context → Intent confirmation → Conversation creation

### All Other Locations Are Forbidden

- No "Discover People" top-nav button
- No "Friends" list with message buttons
- No user profile page with contact CTA
- No search results with direct messaging
- No "Suggestions" with quick-message affordance

If any user interface offers a different entry point, it must be explicitly disabled and documented as a violation.

---

## 8. Technical Enforcement Points

These are the code checkpoints where this contract is enforced:

### API: `POST /api/conversations/start`

**Validation (must pass all checks before conversation is created):**

```
1. Authenticate user
2. Check initiatorRole + recipientRole are valid
3. Check intent is one of: 'hire' | 'advise' | 'collaborate' | 'reconnect'
4. If intent is not 'reconnect':
   a. Require either initiatedFromDecisionId OR initiatedFromScoutRecommendationId
   b. Fetch that Decision or Recommendation
   c. Verify it belongs to this user
   d. Verify the recipient ID matches
5. Run Scout authority check:
   a. Calculate confidence for this pair + intent
   b. Get authority gate result
6. If gate is 'block':
   a. Return 403 with reason
7. If gate is 'allow' or 'caution':
   a. Create conversation with full metadata
   b. Return 201 with conversation ID
```

If any of these checks fail, the conversation is NOT created. No exceptions.

### Frontend: SocialDiscovery / ProfileCard / SearchResults

**Enforcement:**

- No "Message" button without decision context
- No "Add Friend" that opens messaging
- No direct contact affordance on profiles
- All messaging actions must route through:
  - Scout Decision Card flow
  - Existing conversation continuation
  - Scout recommendation

---

## 9. Disallowed Behaviors (Enforcement Examples)

### Example 1: User Tries to Message from Search Results

**Scenario:**
User searches for "plumber" and finds someone.
Clicks "Message" button.

**What Should Happen:**
❌ No "Message" button exists
✅ Instead, a "See how you could work together" link
✅ Clicking it opens Scout decision context
✅ User states their plumbing need
✅ Scout assesses the plumber
✅ Then, conversation is allowed

### Example 2: User Tries to Discover and Browse Profiles

**Scenario:**
User visits a "Discover People" page.
Sees a profile card with "Add Friend" + "Message" buttons.

**What Should Happen:**
❌ This page/pattern does not exist in the final design
✅ Instead, discovery happens inside Scout:
   "Scout suggests: [Person] who specializes in [X]"
✅ User clicks "Explore" → Scout context → Intent confirmation → Conversation

### Example 3: User Tries to Message an Existing Contact

**Scenario:**
User and a contractor previously worked together.
User opens existing conversation and replies.

**What Should Happen:**
✅ Message is sent immediately
✅ Prior outcome context is visible
✅ No re-assessment needed (trust is established)

---

## 10. Future Extensions (Out of Scope for Now, But Reserved)

The following are **not** implemented yet, but this contract reserves space for them:

- **Blocked conversations:** Recipient can decline or block future contact (metadata: `recipientBlockedAt`)
- **Intent pivots:** If conversation intent changes mid-stream, Scout can re-assess (creates a conversation flag, not a new conversation)
- **Async approval:** If Scout says "Caution," recipient gets context before first message arrives (notification includes Scout's reasoning)
- **Reconnect shortcut:** If prior outcome is recorded, next contact skips assessment (trusts the history)

These will be added later. For now, the contract is focused on creation, active lifecycle, and outcome recording.

---

## 11. Summary: The Contract in One Sentence

**"You cannot send a message to someone until you and Scout have agreed on why you're contacting them."**

Everything else is commentary.

---

## Approval & Sign-Off

**Locked by:** Architecture Review (Dec 30, 2025)  
**Applies to:** All messaging features in TradeScout (immediate and future)  
**Changes require:** Explicit decision to revise this contract (not a casual refactor)

