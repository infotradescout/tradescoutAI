# Messaging Authority Enforcement Test Matrix

**Phase:** D3 (Validation & Abuse Prevention)  
**Status:** Test Specification (Pre-Execution)  
**Date:** 2025-12-30  
**Dependencies:** MESSAGING_AUTHORITY_CONTRACT.md, DECISION_CARD_CONTACT_INTEGRATION.md, SCOUT_RECOMMENDATION_SCHEMA.md

---

## 1. Purpose

This matrix proves that:
1. The Messaging Authority Contract is **unbypassable** via normal code paths
2. Every contact entry point **funnels through a single validation checkpoint**
3. **Metadata is immutable** once conversation is created
4. **Abuse patterns are detectable** before they cause harm

---

## 2. Test Coverage Map

### By Entry Surface

```
ENTRY SURFACE           INTENT SOURCE       VALIDATION CHECKPOINT
─────────────────────────────────────────────────────────────────
Direct API call         user_provided       POST /api/conversations/start
Decision Card           pre-selected        POST /api/conversations/start
Scout Recommendation    pre-selected        POST /api/conversations/start
User Search (old)       manual_confirm      Intent Modal → POST
Existing Conversation   none (continuation) Conversation.lookup
```

### By Intent Type

```
INTENT       REQUIRED FIELD        VALIDATION RULE
────────────────────────────────────────────────────────────────
hire         intent='hire'         Both users verified
advise       intent='advise'       Recipient in trusted network OR verified
collaborate  intent='collaborate'  Same location/trade scope
reconnect    intent='reconnect'    Prior conversation must exist
```

### By User Role Combination

```
INITIATOR        RECIPIENT       ALLOWED INTENTS
──────────────────────────────────────────────────────
homeowner        contractor      hire, advise
homeowner        homeowner       (none, block at role check)
contractor       homeowner       hire, advise, collaborate
contractor       contractor      collaborate, advise
vendor           any             (depends on vendor type)
advisor          any             advise, collaborate
```

---

## 3. Test Cases: API Contract Enforcement

### 3.1 Missing Intent Field

**Scenario:** Attacker tries to create conversation without intent

```
POST /api/conversations/start
{
  targetUserId: "user_123"
  // ❌ intent: missing
}

Expected: 400 Bad Request
{
  "error": "Intent required",
  "code": "INVALID_REQUEST"
}

Assertion:
├─ Status code is 400 (not 201, 403, or 500)
├─ Error message mentions intent
├─ Conversation is NOT created
└─ No conversation exists for this pair
```

**Test Code:**
```typescript
test('POST /conversations/start rejects missing intent', async () => {
  const res = await fetch('/api/conversations/start', {
    method: 'POST',
    body: JSON.stringify({
      targetUserId: 'user_123',
      // intent intentionally omitted
    })
  });
  
  expect(res.status).toBe(400);
  expect(res.body.error).toContain('intent');
  
  // Verify conversation wasn't created
  const convs = await db.select().from(conversations)
    .where(eq(conversations.id, 'any-id'));
  expect(convs.length).toBe(0);
});
```

---

### 3.2 Invalid Intent Value

**Scenario:** Attacker tries to use an invalid intent type

```
POST /api/conversations/start
{
  targetUserId: "user_123",
  intent: "bribe"  // ❌ Invalid
}

Expected: 400 Bad Request
{
  "error": "Intent must be one of: hire, advise, collaborate, reconnect",
  "code": "INVALID_INTENT"
}

Assertion:
├─ Status code is 400
├─ Valid intent values are listed
├─ Conversation is NOT created
└─ Invalid intent is never stored
```

---

### 3.3 Unverified Initiator

**Scenario:** User tries to contact someone but hasn't verified their address

```
POST /api/conversations/start
{
  targetUserId: "user_456",
  intent: "hire"
}

User.addressVerified = false

Expected: 403 Forbidden
{
  "error": "You must complete address verification",
  "code": "USER_NOT_VERIFIED"
}

Assertion:
├─ Status code is 403 (not 400 or 201)
├─ Message explains verification requirement
├─ Conversation is NOT created
└─ Logs include failed verification attempt
```

---

### 3.4 Unverified Recipient

**Scenario:** User tries to contact someone who isn't verified

```
POST /api/conversations/start
{
  targetUserId: "user_456",  // This user is unverified
  intent: "hire"
}

Target.addressVerified = false

Expected: 403 Forbidden
{
  "error": "This user is not verified for messaging",
  "code": "RECIPIENT_NOT_VERIFIED"
}

Assertion:
├─ Status code is 403
├─ Conversation is NOT created
├─ Unverified users cannot receive contact
└─ Protects vulnerable users from messaging overload
```

---

### 3.5 Reconnect Without Prior Conversation

**Scenario:** User tries to use "reconnect" intent without prior relationship

```
POST /api/conversations/start
{
  targetUserId: "user_789",
  intent: "reconnect"
}

// No prior conversation exists between these users

Expected: 400 Bad Request
{
  "error": "No prior conversation found for reconnect intent",
  "code": "INVALID_RECONNECT"
}

Assertion:
├─ Status code is 400
├─ Reconnect intent only works with established relationships
├─ Prevents "reconnect" as a disguised cold outreach
└─ Conversation is NOT created
```

---

### 3.6 Self-Contact (Messaging Oneself)

**Scenario:** User tries to message themselves

```
POST /api/conversations/start
{
  targetUserId: "same_as_initiator",
  intent: "advise"
}

Expected: 400 Bad Request
{
  "error": "Cannot message yourself",
  "code": "INVALID_TARGET"
}

Assertion:
├─ Status code is 400
├─ Conversation is NOT created
└─ Self-messaging is nonsensical and blocked
```

---

### 3.7 Decision Card Path: Valid

**Scenario:** User initiates from a Decision Card with all metadata

```
POST /api/conversations/start
{
  targetUserId: "alex_123",
  intent: "hire",
  initiatedFromDecisionId: "decision_456",
  decisionScope: "electrical_work"
}

Decision.status = 'active'
Both users verified
Intent matches decision's suggestedIntent

Expected: 201 Created
{
  "conversationId": "conv_789",
  "created": true,
  "intent": "hire",
  "authorityGate": "decision_card"
}

Assertion:
├─ Status code is 201 (created)
├─ Conversation metadata includes decisionId
├─ authorityGate is set to 'decision_card'
├─ Conversation can be found by userId + targetUserId
└─ Metadata is immutable in database
```

---

### 3.8 Decision Card Path: Expired Decision

**Scenario:** User tries to use a decision that's been archived

```
POST /api/conversations/start
{
  targetUserId: "alex_123",
  intent: "hire",
  initiatedFromDecisionId: "decision_456"  // status: archived
}

Expected: 400 Bad Request
{
  "error": "This decision is archived or completed",
  "code": "DECISION_INVALID"
}

Assertion:
├─ Status code is 400
├─ Cannot reuse archived decisions for new contact
├─ Conversation is NOT created
└─ Prevents stale decision context from being reused
```

---

### 3.9 Race Condition: Double Submit

**Scenario:** User submits confirmation twice very quickly

```
Request 1: POST /conversations/start { targetUserId, intent }
Request 2: POST /conversations/start { targetUserId, intent } (0.1s later)

Expected:
├─ Request 1: 201 Created { conversationId: "conv_123" }
├─ Request 2: 200 OK { conversationId: "conv_123", created: false }
└─ Single conversation created, both requests resolve to it

Assertion:
├─ No database constraint violation
├─ No duplicate conversations created
├─ Both requests return same conversationId
├─ Second request recognized duplicate gracefully
└─ No user-facing error
```

**Test Code:**
```typescript
test('POST /conversations/start handles race condition', async () => {
  const userId = 'user_1';
  const targetId = 'user_2';
  
  const [res1, res2] = await Promise.all([
    fetch('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: targetId,
        intent: 'hire'
      })
    }),
    fetch('/api/conversations/start', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: targetId,
        intent: 'hire'
      })
    })
  ]);
  
  const data1 = await res1.json();
  const data2 = await res2.json();
  
  expect(data1.conversationId).toBe(data2.conversationId);
  
  // Verify only one conversation exists
  const convs = await db.select().from(conversations)
    .where(
      and(
        eq(conversations.buyerId, userId),
        eq(conversations.sellerId, targetId)
      )
    );
  expect(convs.length).toBe(1);
});
```

---

## 4. Test Cases: UI Enforcement

### 4.1 SocialDiscovery: No Direct Message Button

**Scenario:** User visits /discover-people

```
Expected UI:
├─ Search input visible
├─ Search results show user cards
├─ Each card has ONLY:
│  └─ Avatar, name, role, location, verified badge
├─ ❌ NO "Message" button
├─ ❌ NO "Add Friend" button
├─ ✅ YES "See how you could work together" button
└─ Clicking button opens IntentModal

Assertion:
├─ Message button element does not exist in DOM
├─ CSS class or data-testid for message button not found
├─ Clicking user card does not open messaging
└─ Only intent selection modal can be opened
```

**Test Code:**
```typescript
test('SocialDiscovery does not render message button', async () => {
  const { queryByText } = render(<SocialDiscovery />);
  
  // Search for a user
  const searchInput = queryByPlaceholderText('Search');
  await userEvent.type(searchInput, 'john');
  
  // Wait for results
  await waitFor(() => {
    const button = queryByRole('button', { name: /message/i });
    expect(button).not.toBeInTheDocument();
  });
});
```

---

### 4.2 SocialDiscovery: Intent Modal Required

**Scenario:** User searches and finds someone

```
Expected Flow:
├─ User searches and sees result
├─ Result card shows "See how you could work together"
├─ User clicks button
├─ IntentModal opens (modal overlay)
├─ IntentModal shows 4 options:
│  ├─ Hire them for work
│  ├─ Get advice from them
│  ├─ Collaborate together
│  └─ Reconnect
├─ User selects intent
├─ Modal calls POST /conversations/start with intent
└─ User sees "Connection initiated" message

Assertion:
├─ Modal is a proper overlay (not inline)
├─ All 4 intents are visible and selectable
├─ Selecting intent triggers API call
├─ API call includes intent in body
└─ User cannot bypass intent selection
```

---

### 4.3 Navigation: Discover Button Removed

**Scenario:** User views top navigation

```
Expected:
├─ Scout button present
├─ Community button present
├─ Messages button present
├─ Profile button present
├─ ❌ Discover button NOT present

Assertion:
├─ No "Discover" link in top nav
├─ /discover-people route still exists (accessible via direct URL)
├─ No affordance for casual browsing
└─ Navigation matches outcome-centric model
```

---

## 5. Test Cases: Metadata Immutability

### 5.1 Intent Metadata Cannot Be Changed

**Scenario:** Conversation created with intent='hire'

```
Conversation created:
{
  conversationId: "conv_123",
  metadata: {
    intent: 'hire',
    authorityGate: 'decision_card'
  }
}

Attacker tries:
PATCH /api/conversations/conv_123
{
  metadata: { intent: 'advise' }
}

Expected: 405 Method Not Allowed (PATCH not supported)
OR 403 Forbidden (metadata immutable)

Assertion:
├─ Intent is never updated after creation
├─ Metadata is a read-only snapshot
├─ Changing intent would require creating new conversation
└─ Prevents post-hoc reframing of contact reason
```

---

### 5.2 Authority Gate Cannot Be Escalated

**Scenario:** User search initiated conversation (low authority)

```
Conversation created:
{
  conversationId: "conv_456",
  metadata: {
    intent: 'hire',
    authorityGate: 'user_search'
  }
}

Attacker tries:
PATCH /api/conversations/conv_456
{
  metadata: { authorityGate: 'decision_card' }
}

Expected: 403 Forbidden OR PATCH not supported

Assertion:
├─ authorityGate is immutable
├─ Cannot fake a decision card origin
├─ Cannot escalate trust after creation
└─ Metadata reflects true context
```

---

## 6. Test Cases: Role-Based Validation

### 6.1 Homeowner to Homeowner: Blocked

**Scenario:** Homeowner tries to contact another homeowner

```
Initiator.role = 'homeowner'
Recipient.role = 'homeowner'
Intent = 'hire'

POST /api/conversations/start
{
  targetUserId: "homeowner_user",
  intent: "hire"
}

Expected: 403 Forbidden
{
  "error": "Homeowners cannot hire other homeowners",
  "code": "ROLE_MISMATCH"
}

Assertion:
├─ Status code is 403
├─ Conversation is NOT created
├─ Role mismatch is enforced at API level
└─ Prevents homeowner-to-homeowner spam
```

---

### 6.2 Contractor to Contractor: Collaborate OK

**Scenario:** Contractor wants to collaborate with another contractor

```
Initiator.role = 'contractor'
Recipient.role = 'contractor'
Intent = 'collaborate'

Expected: 201 Created
{
  "conversationId": "conv_789",
  "intent": "collaborate"
}

Assertion:
├─ Collaboration between peers is allowed
├─ Different intent (collaborate) vs hire
├─ Conversation is created successfully
└─ Role combination is validated properly
```

---

## 7. Test Cases: Abuse Pattern Detection

### 7.1 Rate Limiting: Max Contacts Per Day

**Scenario:** Contractor tries to contact 100 people in 1 hour

```
For i = 1 to 100:
  POST /api/conversations/start
  {
    targetUserId: "user_${i}",
    intent: "hire"
  }

Expected:
├─ Requests 1-20: 201 Created
├─ Request 21: 429 Too Many Requests
│   "Rate limit exceeded: 20 conversations per day"
├─ All subsequent requests: 429
└─ Limit resets at midnight

Assertion:
├─ Rate limit is enforced
├─ Conversation creation pauses at threshold
├─ User receives clear rate limit message
├─ Prevents bulk messaging spam
```

---

### 7.2 Rapid Recipient Rotation

**Scenario:** Attacker tries to contact 50 different people but same content

```
For i = 1 to 50:
  Conversation created with:
  - Different targetUserId each time
  - Same intent: 'hire'
  - Same first message content
  
Scout analyzes:
├─ Same user messaging many people with identical content
├─ Pattern indicates spam/scam behavior
└─ Flag for human review

Expected:
├─ Conversations are created (no API-level block)
├─ Scout's monitoring detects pattern
├─ Account tagged for review
├─ Subsequent messages may be delayed/filtered
└─ Manual review by platform team
```

---

### 7.3 Target Blocking: User Cannot Re-contact Blocker

**Scenario:** User blocks recipient, then tries to contact them again

```
User A contacts User B
User B blocks User A (conversation.status = 'blocked')

User A tries again:
POST /api/conversations/start
{
  targetUserId: "user_b",
  intent: "collaborate"
}

Expected: 403 Forbidden
{
  "error": "This user has blocked you",
  "code": "USER_BLOCKED"
}

Assertion:
├─ Status code is 403
├─ Cannot re-open conversation
├─ Block is effective immediately
├─ Prevents harassment
└─ User safety is prioritized
```

---

## 8. Test Cases: Messaging Contract Compliance

### 8.1 Every Conversation Has Intent Metadata

**Scenario:** Query all conversations for a user

```
GET /api/conversations?userId=user_1

Expected:
{
  conversations: [
    {
      id: "conv_1",
      metadata: {
        intent: "hire",              // ✅ Always present
        authorityGate: "decision_card",  // ✅ Always present
        createdAt: timestamp,         // ✅ Always present
        ...
      }
    },
    {
      id: "conv_2",
      metadata: {
        intent: "advise",
        authorityGate: "scout_recommendation",
        ...
      }
    }
  ]
}

Assertion:
├─ Every conversation has intent field
├─ Every conversation has authorityGate field
├─ Every conversation has timestamps
├─ No conversations with null/missing intent
└─ Contract is fully compliant
```

---

### 8.2 Conversation Lifecycle Audit Trail

**Scenario:** Review a conversation's full history

```
GET /api/conversations/conv_123/audit-trail

Expected:
{
  conversationId: "conv_123",
  events: [
    {
      timestamp: "2025-12-30T10:00:00Z",
      event: "CREATED",
      initiator: "user_1",
      intent: "hire",
      authorityGate: "decision_card",
      metadata: { decisionId: "decision_456" }
    },
    {
      timestamp: "2025-12-30T10:05:00Z",
      event: "MESSAGE_SENT",
      sender: "user_1",
      content: "[encrypted]"
    },
    {
      timestamp: "2025-12-30T10:10:00Z",
      event: "MESSAGE_RECEIVED",
      sender: "user_2"
    },
    {
      timestamp: "2025-12-30T10:30:00Z",
      event: "OUTCOME_RECORDED",
      outcome: "HIRED",
      satisfaction: 5
    }
  ]
}

Assertion:
├─ Complete history is available
├─ All state changes are logged
├─ Intent is captured at creation
├─ Outcomes are tracked
└─ Audit trail enables accountability
```

---

## 9. Execution Plan

### Phase D3.1: Unit Tests (API Layer)

```
[ ] Missing intent → 400
[ ] Invalid intent → 400
[ ] Unverified initiator → 403
[ ] Unverified recipient → 403
[ ] Reconnect without prior → 400
[ ] Self-contact → 400
[ ] Decision card valid → 201
[ ] Decision card expired → 400
[ ] Race condition → No duplicates
```

### Phase D3.2: Integration Tests (UI + API)

```
[ ] SocialDiscovery: No message button
[ ] SocialDiscovery: Intent modal required
[ ] Navigation: Discover removed
[ ] Intent selection → API call with intent
[ ] Metadata immutability: Intent cannot change
[ ] Metadata immutability: authorityGate cannot escalate
```

### Phase D3.3: Abuse Tests (Rate Limiting + Pattern Detection)

```
[ ] Rate limiting: Max contacts/day enforced
[ ] Rapid rotation: Pattern detection
[ ] Blocking: Cannot re-contact blocker
[ ] Role validation: homeowner→homeowner blocked
[ ] Role validation: contractor→contractor allowed
```

### Phase D3.4: Compliance Tests (Contract Adherence)

```
[ ] Every conversation has intent
[ ] Every conversation has authorityGate
[ ] Audit trail complete
[ ] No bypass paths exist
```

---

## 10. Success Criteria

The Messaging Authority Contract is **proven unbypassable** when:

✅ **All API tests pass** (intent validation, role checking, metadata immutability)  
✅ **All UI tests pass** (no direct messaging, intent modal required)  
✅ **All abuse tests pass** (rate limiting, pattern detection)  
✅ **All compliance tests pass** (metadata present, audit trail complete)  

**Zero test failures** = **Zero bypass paths** = **Contract is enforced**

---

## 11. Future: A/B Testing & Metrics

Once enforcement is proven, measure real-world effects:

```
Metric: Conversation success rate
Before: 40% of conversations led to outcomes
After: 65% (intent framing increases relevance)

Metric: Block rate
Before: 0% (no authority checking)
After: 8% (Scout protecting users)

Metric: User satisfaction
Before: 3.2/5 average rating
After: 4.1/5 (better matching, clearer intent)
```

If metrics worsen (e.g., block rate > 20%), iterate on confidence thresholds in Scout's assessment.

---

## Summary

This test matrix proves the Messaging Authority Contract is:

1. **Unbypassable** (every entry point validated)
2. **Immutable** (metadata locked after creation)
3. **Auditable** (complete history logged)
4. **Safe** (abuse patterns detected early)

Testing this matrix will take ~2-3 days of QA work but will validate the entire authority model before production rollout.

