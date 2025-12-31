# Quick Reference: Messaging Authority System

## The Core Rule

**"You cannot send a message to someone until you and Scout have agreed on why you're contacting them."**

---

## Documents (Committed to Main)

### Phase A, B, C: LOCKED ✅

1. **[MESSAGING_AUTHORITY_CONTRACT.md](MESSAGING_AUTHORITY_CONTRACT.md)** (423 lines)
   - The foundational rule
   - 3 allowed entry points
   - 7 disallowed entry points
   - Required metadata structure

2. **[MESSAGING_AUTHORITY_ENFORCEMENT.md](MESSAGING_AUTHORITY_ENFORCEMENT.md)** (306 lines)
   - How SocialDiscovery enforces the rule
   - How API enforces the rule
   - How navigation enforces the rule
   - Testing checklist

3. **Code Commits:**
   - SocialDiscovery rewritten (intent modal required)
   - Navigation updated (Discover button removed)
   - API enhanced (intent validation, metadata capture)

### Phase D1: SPECIFIED 📋

4. **[DECISION_CARD_CONTACT_INTEGRATION.md](DECISION_CARD_CONTACT_INTEGRATION.md)** (619 lines)
   - Contact as a Decision Card outcome
   - User flow with Scout assessment
   - API contract and validation
   - State machine and error handling
   - Implementation checklist

### Phase D2: SPECIFIED 📋

5. **[SCOUT_RECOMMENDATION_SCHEMA.md](SCOUT_RECOMMENDATION_SCHEMA.md)** (678 lines)
   - Confidence scoring model (5 components)
   - Authority gates (auto-allow → blocked)
   - Intent pre-selection logic
   - Feedback loop for learning
   - Implementation checklist

### Phase D3: SPECIFIED 📋

6. **[MESSAGING_AUTHORITY_TEST_MATRIX.md](MESSAGING_AUTHORITY_TEST_MATRIX.md)** (854 lines)
   - 50+ test cases
   - API enforcement tests
   - UI compliance tests
   - Abuse prevention tests
   - Compliance validation tests

### Master Overview 📋

7. **[MESSAGING_AUTHORITY_SYSTEM_INDEX.md](MESSAGING_AUTHORITY_SYSTEM_INDEX.md)** (485 lines)
   - Complete architecture
   - Phase dependencies
   - KPI measurements
   - Rollout strategy
   - Risk mitigation

8. **[SESSION_SUMMARY.md](SESSION_SUMMARY.md)** (387 lines)
   - What was built
   - By the numbers
   - Success metrics
   - Next steps timeline

---

## The Three Allowed Entry Points

### 1. Decision Card → Intent Selection → Scout Assessment → Conversation

```
User makes decision (e.g., "I need to hire an electrician")
    ↓
Scout proposes outcomes (including contact options)
    ↓
User selects outcome: "Contact Alex for this"
    ↓
Confirmation modal (read-only summary)
    ↓
Scout assesses and allows/cautions/blocks
    ↓
Conversation created with decision metadata
    ↓
authorityGate: 'decision_card' (highest trust)
```

### 2. Existing Relationship → Continuation

```
Prior conversation exists with recorded outcome
    ↓
User opens existing conversation
    ↓
Message directly (no new assessment needed)
    ↓
Trust is already established
    ↓
authorityGate: prior_relationship (existing)
```

### 3. Scout Recommendation → Intent Confirmation → Conversation

```
Scout identifies high-confidence opportunity (0.85+ confidence)
    ↓
Scout suggests person with pre-selected intent
    ↓
Recommendation appears in message stream
    ↓
User clicks "Explore collaboration" or "Dismiss"
    ↓
Intent confirmation modal
    ↓
Conversation created with Scout metadata
    ↓
authorityGate: 'scout_recommendation' (medium trust)
```

---

## The Seven Disallowed Entry Points

❌ **User Search → Message Button**  
❌ **Profile Page → Contact CTA**  
❌ **Friend Suggestion → Message Shortcut**  
❌ **Browse People → Random Contact**  
❌ **Social Network → "Add Friend" + Message**  
❌ **Search Result → Direct Messaging**  
❌ **Any affordance that bypasses intent selection**

---

## API Contract

### POST /api/conversations/start (The Single Checkpoint)

**Required Fields:**
```typescript
{
  targetUserId: string,           // Recipient
  intent: 'hire' | 'advise' | 'collaborate' | 'reconnect',
  initiatedFromDecisionId?: string,           // Decision Card path
  initiatedFromScoutRecommendationId?: string // Scout path
}
```

**Validation Checkpoints:**
1. Intent must be provided and valid
2. Both users must be address-verified
3. If reconnect: prior conversation must exist
4. If decision card: decision must be active

**Response:**
```typescript
{
  conversationId: string,
  created: true | false,           // true = new, false = existing
  intent: string,
  authorityGate: string,           // decision_card | scout_recommendation | user_search
  metadata: {
    intent,
    authorityGate,
    decisionId?,
    confidenceScore?,
    createdAt,
  }
}
```

---

## Intent Mapping

| Decision Type | Messaging Intent | Reason |
|---------------|-----------------|--------|
| Hiring decision | 'hire' | Explicit commercial relationship |
| Seeking advice | 'advise' | Informational relationship |
| Collaboration need | 'collaborate' | Peer-to-peer work |
| Prior relationship | 'reconnect' | Established history |

**Once selected, intent is immutable** (cannot be changed after conversation creation).

---

## Confidence Scoring (Scout Recommendations)

### 5 Components (Weighted)

```
expertise_match      30%  (Does target have the right skills?)
location_match       25%  (Are they nearby/in scope?)
trust_signal         25%  (Verified? Reviews? Credibility?)
past_success         15%  (Have they done similar work?)
availability         5%   (Are they active recently?)
────────────────────────
Total               100%  → 0.0 to 1.0 confidence score
```

### Authority Gate Thresholds

| Score | Gate | Friction | User Must |
|-------|------|----------|-----------|
| 0.85-1.0 | auto_allow | minimal | Confirm (ready button) |
| 0.70-0.84 | manual_confirm | moderate | Confirm understanding |
| 0.50-0.69 | caution | high | Acknowledge risks + alternatives |
| <0.50 | blocked | complete | See alternatives only |

---

## Metadata Fields (Immutable After Creation)

Every conversation stores:

```typescript
{
  // Identity
  conversationId: string,
  userId: string,
  recipientId: string,
  
  // Decision Context
  intent: string,                              // ← IMMUTABLE
  initiatedFromDecisionId?: string,            // ← IMMUTABLE
  decisionScope?: string,                      // ← IMMUTABLE
  
  // Authority & Confidence
  authorityGate: string,                       // ← IMMUTABLE
  confidenceScore?: number,                    // ← IMMUTABLE (snapshot)
  riskLevel?: 'low' | 'medium' | 'high',      // ← IMMUTABLE
  
  // Lifecycle
  createdAt: timestamp,                        // ← IMMUTABLE
  lastMessageAt?: timestamp,
  status: 'active' | 'archived' | 'blocked',
  
  // Outcomes
  outcomeId?: string,
  outcomeRecordedAt?: timestamp,
}
```

**Why Immutable?** Prevents post-hoc reframing. Metadata is a permanent record of "why this conversation was created."

---

## Testing Checklist

### API Tests (12)
- [ ] POST /conversations/start requires intent
- [ ] API rejects invalid intent values
- [ ] API rejects unverified users
- [ ] API allows verified users with valid intent
- [ ] Decision card path validates decision exists
- [ ] Reconnect intent requires prior conversation
- [ ] Race condition: double submit returns same conversation
- [ ] Metadata is immutable after creation
- [ ] authorityGate cannot be escalated
- [ ] Role validation (homeowner→homeowner blocked, etc.)
- [ ] Rate limiting enforced
- [ ] Self-contact blocked

### UI Tests (6)
- [ ] SocialDiscovery has no message button
- [ ] Clicking "See how you could work together" opens intent modal
- [ ] Intent modal shows 4 clear options
- [ ] Selecting intent calls API with intent
- [ ] Top-nav has no Discover button
- [ ] Navigation matches outcome-centric model

### Abuse Prevention Tests (6)
- [ ] Rate limiting: max contacts/day enforced
- [ ] Rapid rotation: pattern detection working
- [ ] Blocking: cannot re-contact blocker
- [ ] Spam pattern: identical content detected
- [ ] Account monitoring: suspicious behavior flagged
- [ ] Override logging: all overrides recorded

### Compliance Tests (4)
- [ ] Every conversation has intent field
- [ ] Every conversation has authorityGate field
- [ ] Audit trail captures all state changes
- [ ] No null/missing required fields

---

## Key Principles

### 1. Intent is Pre-Selected
- Never user-chosen at contact time
- Selected before conversation is created
- Immutable after conversation exists

### 2. Authority is Cumulative
- Decision Card > Scout Recommendation > User Search
- Higher authority = less friction
- Lower authority = more validation

### 3. Verification is Non-Negotiable
- Both parties must be address-verified
- Protects vulnerable users
- Enables trust signals

### 4. Metadata is Locked
- Permanent record of contact reason
- Enables audit trail and learning
- Cannot be changed after creation

### 5. Single Validation Point
- All contact flows through POST /api/conversations/start
- No bypasses, no multiple pathways
- Every contact is validated

---

## Rollout Timeline

### Week 1-2: Pilot
- Deploy Decision Card integration (D1)
- Monitor with pilot user
- Validate intent accuracy

### Week 3-4: Beta
- Deploy Scout recommendations (D2)
- Monitor acceptance rate
- Refine confidence weights

### Week 4-5: Testing
- Run full test matrix (D3)
- Validate compliance
- Prove no bypasses exist

### Week 6+: Production
- Gradual rollout (10% → 100%)
- Monitor system health
- Iterate on edge cases

---

## Success Criteria

✅ All 50+ tests pass  
✅ Zero bypass paths discovered  
✅ Block rate stable at <5%  
✅ User satisfaction >= 4.0/5  
✅ Intent accuracy > 90%  

---

## Questions & Clarifications

**Q: What if users just message each other anyway?**  
A: They can't. Both parties must be verified, and unverified users get 403 Forbidden when trying to start a conversation.

**Q: What if someone uses the wrong intent?**  
A: Intent is captured at creation time. If mismatch is discovered later, it's logged for audit and Scout learns from it.

**Q: Can users override Scout's block?**  
A: Yes, but it's logged and flagged. High override rates trigger audit of Scout's confidence model.

**Q: What about existing conversations?**  
A: They continue to work. Only new conversations require intent and metadata. Existing ones inherit prior context.

**Q: How does Scout learn?**  
A: Post-conversation outcome is recorded. Success increases future confidence for that pair. Failure decreases confidence or blocks future recommendations.

---

## One-Sentence Summary

**Scout ensures every real-world contact starts with shared understanding of why.**

