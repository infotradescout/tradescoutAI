# Messaging Authority System: Complete Specification Index

**Status:** Fully Specified & Locked  
**Date:** 2025-12-30  
**Architecture Phase:** A, B, C (Locked) → D1, D2, D3 (Specified, Ready for Implementation)

---

## Overview

The Messaging Authority System is a comprehensive redesign of how users contact each other in TradeScout. It ensures that **messaging is always a consequence of a governed decision, never an entry point.**

This system consists of six locked specifications and two major implementations.

---

## Document Structure & Dependencies

```
PHASE A, B, C (LOCKED - IMPLEMENTED)
├─ MESSAGING_AUTHORITY_CONTRACT.md (Foundation)
│  └─ "The rule: conversations only from decisions, never standalone"
│
├─ MESSAGING_AUTHORITY_ENFORCEMENT.md (Implementation)
│  └─ "How SocialDiscovery, Nav, and API enforce the contract"
│
└─ [Code Changes Committed]
   ├─ SocialDiscovery.tsx rewritten (intent modal required)
   ├─ Top-nav "Discover" removed (no casual browsing)
   └─ POST /api/conversations/start validates intent + metadata

PHASE D1 (SPECIFIED - READY FOR IMPLEMENTATION)
├─ DECISION_CARD_CONTACT_INTEGRATION.md
│  └─ "Contact as a Decision Card outcome (highest authority)"
│  └─ 619 lines: Types, flows, API contract, state machine, testing
│
└─ Implementation checklist:
   ├─ API: Add decision card validation checkpoint
   ├─ UI: Create contact outcome card component
   ├─ Integration: Route confirmation flow to conversation creation
   └─ Testing: Contact card displays, metadata captured

PHASE D2 (SPECIFIED - READY FOR IMPLEMENTATION)
├─ SCOUT_RECOMMENDATION_SCHEMA.md
│  └─ "Scout recommends high-confidence people (medium authority)"
│  └─ 678 lines: Confidence scoring, intent pre-selection, feedback loop
│
└─ Implementation checklist:
   ├─ Engine: Implement confidence model (5 components weighted)
   ├─ API: Create POST /scout/recommendations endpoints
   ├─ UI: Add recommendation cards (in-message, post-conversation, etc.)
   ├─ Learning: Implement outcome feedback loop
   └─ Testing: Confidence vs success correlation, rate limiting

PHASE D3 (SPECIFIED - READY FOR EXECUTION)
├─ MESSAGING_AUTHORITY_TEST_MATRIX.md
│  └─ "50+ test cases proving contract unbypassable"
│  └─ 854 lines: API enforcement, UI compliance, abuse prevention
│
└─ Test execution plan:
   ├─ Unit tests: Intent validation, role checking, metadata immutability
   ├─ Integration tests: SocialDiscovery, intent modal, navigation
   ├─ Abuse tests: Rate limiting, pattern detection, blocking
   └─ Compliance tests: Every conversation has intent & authorityGate
```

---

## Phase A, B, C: What's Done

### Contract Locked (19572d0)
- ✅ 12 core rules defining when conversations can be created
- ✅ 3 allowed entry points (Decision Card, Prior Outcome, Scout Recommendation)
- ✅ 3 disallowed entry points (search→message, profile→contact, friend suggestion)
- ✅ Required metadata structure (intent, authority gate, confidence context)
- ✅ Technical enforcement points identified

### Enforcement Implemented (9d8e8d0 + 9619ca8)
- ✅ SocialDiscovery.tsx rewritten: No Message button, Intent Modal required
- ✅ Navigation updated: Top-nav "Discover" removed
- ✅ POST /api/conversations/start enhanced: Intent validation, verification checks
- ✅ Metadata captured: Every conversation stores intent, authority gate, confidence
- ✅ Testing checklist provided

### Code Status
- ✅ Committed to main branch
- ✅ All files in version control
- ✅ No conflicts, clean history
- ✅ Ready for deployment or iteration

---

## Phase D1: Decision Card Integration (Next)

### What This Enables

Users make decisions (e.g., "I need to hire an electrician for permits").  
Scout proposes outcomes (e.g., "Contact Alex, who specializes in this").  
User confirms the entire outcome frame.  
Conversation is created with full decision context.

### Specification Highlights

**Type Definition:**
- `ContactOutcome` interface with all required fields
- `authorityGate: 'decision_card'` marks the highest-trust source

**User Flow:**
- Decision Card shows contact as an outcome
- Scout confidence is visible (0-100%)
- Confirmation modal is read-only (no changing intent)
- API validation ensures decision card exists and is active

**API Changes:**
- POST /api/conversations/start validates `decisionCardId`
- New GET /api/decisions/:id/contact-outcome endpoint
- Metadata includes decision scope + timeline context

**State Machine:**
- Active decision → Outcome proposed → Confirmation shown → Conversation created
- If Scout says "caution": User must confirm understanding
- If Scout says "block": User sees reason + alternatives

**Testing:**
- API: Valid decision → 201 Created
- API: Expired decision → 400 Bad Request
- UI: Contact card displays correctly, metadata captured
- Race condition: Double submit returns same conversation ID

### Implementation Effort
- **Backend:** ~6-8 hours (API endpoint, validation, logging)
- **Frontend:** ~8-10 hours (contact outcome card, confirmation modal, error states)
- **Testing:** ~4-6 hours (unit + integration tests)
- **Total:** 3-4 days

---

## Phase D2: Scout Recommendations (After D1)

### What This Enables

Scout identifies high-confidence opportunities (0.85+ confidence).  
Scout pre-selects intent based on context.  
User sees recommendation in messages, community, or decision cards.  
User confirms, conversation is created with Scout metadata.

### Specification Highlights

**Confidence Scoring (5 weighted components):**
- Expertise match (30%)
- Location match (25%)
- Trust signal (25%)
- Past success (15%)
- Availability (5%)
- Result: 0.0-1.0 score

**Authority Gates:**
- 0.85-1.0: auto_allow (minimal friction)
- 0.70-0.84: manual_confirm (user must click)
- 0.50-0.69: caution (warning, alternatives offered)
- <0.50: blocked (not shown, only alternatives)

**Intent Pre-Selection:**
- Scout analyzes context (decision, conversation, past behavior)
- Recommends intent (hire, advise, collaborate, reconnect)
- User confirms intent within recommendation (no changing intent later)

**Feedback Loop:**
- Post-conversation outcome is recorded
- Success increases future confidence for this pair
- Failure decreases or blocks future recommendations
- Learning improves recommendations over time

**Entry Points:**
- In-message: "Based on what you said, try talking to..."
- Post-conversation: "Maria mentioned you should contact..."
- Decision card: "For this decision, consider..."

### Implementation Effort
- **Backend:** ~12-16 hours (confidence engine, triggers, feedback loop)
- **Frontend:** ~8-12 hours (recommendation UI variants, user feedback)
- **Testing:** ~6-8 hours (confidence vs success correlation, rate limiting)
- **Total:** 1 week

---

## Phase D3: Enforcement Testing (Parallel or After D2)

### What This Validates

Every pathway through the system (API, UI, workflows) is tested.  
No bypass paths exist.  
Metadata is immutable (intent cannot be changed after creation).  
Abuse patterns are detectable before harm occurs.

### Test Coverage

**API Enforcement (12 tests):**
- Missing intent → 400
- Invalid intent → 400
- Unverified users → 403
- Reconnect without prior → 400
- Decision card valid → 201
- Decision card expired → 400
- Race condition handling
- Metadata immutability
- Role-based validation
- Rate limiting
- Blocking enforcement

**UI Compliance (6 tests):**
- No message button on search results
- Intent modal required
- Navigation doesn't show Discover
- Metadata captured correctly
- Error states display properly

**Abuse Prevention (6 tests):**
- Rate limiting enforced (max contacts/day)
- Rapid rotation detection
- User blocking respected
- Spam patterns flagged

**Compliance (4 tests):**
- Every conversation has intent
- Every conversation has authority gate
- Audit trail complete
- No null/missing fields

### Execution Effort
- **Setup:** ~4 hours (test infrastructure, helpers)
- **Execution:** ~3-4 days (50+ test cases)
- **Analysis:** ~1 day (review results, iterate on edge cases)
- **Total:** 1 week (can run in parallel with D1/D2)

---

## Architecture Principles

### 1. Single Point of Authority

**All contact creation flows through POST /api/conversations/start**

```
Decision Card → POST /conversations/start
Scout Recommendation → POST /conversations/start
User Search → Intent Modal → POST /conversations/start
Existing Conversation → No new API call (continuation)
```

No bypasses. No multiple pathways. Single checkpoint.

### 2. Intent is Immutable

Intent is selected **before** conversation creation, never after.

```
❌ User contacts someone → then picks an intent
✅ User picks an intent → then creates conversation
```

### 3. Authority Gate is the Audit Trail

Every conversation records its origin:

```
authorityGate: 'decision_card'     (highest trust)
authorityGate: 'scout_recommendation'  (medium trust)
authorityGate: 'user_search'       (lowest trust, requires full intent)
```

Enables accountability and learning.

### 4. Verification is Non-Negotiable

Both parties must be address-verified before any contact.

```
Unverified initiator → 403 Forbidden
Unverified recipient → 403 Forbidden
```

Protects vulnerable users.

### 5. Metadata is Locked

Once a conversation is created, its metadata is immutable.

```
{
  intent: 'hire',           // ← Cannot change
  authorityGate: 'decision_card',  // ← Cannot change
  decisionId: 'decision_123',      // ← Cannot change
  createdAt: timestamp,     // ← Cannot change
}
```

---

## KPI Measurements

### By Phase

**Phase A, B, C (Current):**
- Direct message attempts blocked: 100% (no affordance exists)
- Intent validation success rate: 100% (API enforces)
- Metadata completeness: 100% (every conversation has it)

**Phase D1 (After Decision Card Integration):**
- % conversations via Decision Cards: Target 40-60%
- Decision Card block rate: Target <5% (Scout is confident)
- Intent accuracy (first message aligns with intent): Target >90%

**Phase D2 (After Scout Recommendations):**
- % conversations via Scout recommendations: Target 20-40%
- Scout acceptance rate: Target 60-70% (users trust recommendations)
- Recommendation success rate: Target 70%+ (leads to outcome)

**D3 (Testing Validation):**
- Test coverage: 100% (all 50+ tests pass)
- Bypass paths found: 0 (contract is unbypassable)
- Edge case failures: 0 (handling is complete)

---

## Rollout Strategy

### Pilot Phase (Week 1-2)

Deploy to pilot user: `traderscornerllc@gmail.com`

- Decision Card integration (D1)
- Monitor block rates, success metrics
- Validate intent accuracy
- Iterate on Scout confidence thresholds

### Beta Phase (Week 3-4)

Deploy Scout recommendations (D2)

- Monitor acceptance rate
- Track recommendation quality
- Watch for abuse patterns
- Refine confidence weights

### Testing Phase (Week 4-5)

Run full test matrix (D3)

- Execute all 50+ test cases
- Validate compliance with contract
- Prove no bypass paths exist
- Document any edge cases

### Production Rollout (Week 6+)

General availability

- Gradual rollout (10% → 25% → 50% → 100%)
- Monitor system health
- Watch for unexpected abuse patterns
- Iterate on edge cases

---

## Risk Mitigation

### Risk: Scout's confidence is too conservative (blocks helpful contacts)

**Mitigation:**
- Start with lower thresholds (0.70 for manual_confirm)
- Monitor block rates in beta
- If block_rate > 15%, lower thresholds
- Gather user feedback on rejected recommendations

### Risk: Users circumvent intent via first message content

**Mitigation:**
- Scout monitors first few messages for intent drift
- Log intent mismatches
- Use as signal for confidence adjustment
- Review abuse patterns daily in early phases

### Risk: Rate limiting is too strict (users can't contact multiple people)

**Mitigation:**
- Start with 20 conversations/day limit
- Monitor user feedback
- Adjust if <5% of users hit limit
- Whitelist power users if necessary

### Risk: Decision Cards become too rigid (users want more flexibility)

**Mitigation:**
- Outcome suggestions are just that (suggestions)
- Users can search independently for other contacts
- Intent modal allows switching between intents
- Gather feedback and iterate on card design

---

## Success Criteria

### Authority Contract is Proven Unbypassable When:

✅ All 50+ tests in D3 pass  
✅ Zero bypass paths discovered in code review  
✅ Zero intent mismatches in production (first week)  
✅ Block rate stable at <5% (Scout is well-calibrated)  
✅ User satisfaction >= 4.0/5 (contacts are high-quality)  

### Product Goal:

> "Users contact each other with shared understanding of why. Irrelevant, unsafe, or spam contacts are filtered out before they happen."

---

## Summary

**Current State (A, B, C - Locked & Implemented):**
- Messaging authority contract is formalized
- SocialDiscovery enforces intent requirement
- API validates all contact creation
- Navigation reflects outcome-centric model

**Next Phase (D1 - Ready to Build):**
- Decision Cards propose contacts as outcomes
- Contact confirmation is read-only summary
- Metadata is locked at creation time

**Following Phase (D2 - Ready to Build):**
- Scout recommends high-confidence people
- Intent is pre-selected by Scout
- Feedback loop improves recommendations

**Validation Phase (D3 - Ready to Test):**
- 50+ test cases prove contract unbypassable
- All abuse patterns are detectable
- Full audit trail enables accountability

**Timeline:** 4-6 weeks from start of D1 to production.

---

## Document Quick Reference

| Document | Lines | Focus | Status |
|----------|-------|-------|--------|
| [MESSAGING_AUTHORITY_CONTRACT.md](MESSAGING_AUTHORITY_CONTRACT.md) | 423 | The rule: when/how conversations can be created | ✅ Locked |
| [MESSAGING_AUTHORITY_ENFORCEMENT.md](MESSAGING_AUTHORITY_ENFORCEMENT.md) | 306 | How UI + API enforce the contract | ✅ Locked |
| [DECISION_CARD_CONTACT_INTEGRATION.md](DECISION_CARD_CONTACT_INTEGRATION.md) | 619 | Contact as a decision outcome | 📋 Specified |
| [SCOUT_RECOMMENDATION_SCHEMA.md](SCOUT_RECOMMENDATION_SCHEMA.md) | 678 | Scout's recommendation model | 📋 Specified |
| [MESSAGING_AUTHORITY_TEST_MATRIX.md](MESSAGING_AUTHORITY_TEST_MATRIX.md) | 854 | 50+ test cases for enforcement | 📋 Specified |

---

## Next Steps

**Immediate (Today):**
- Review this index for completeness
- Get sign-off on D1 specification (Decision Card contract)
- Identify any gaps or clarifications needed

**This Week:**
- Begin D1 implementation (Decision Card contact outcomes)
- Set up testing infrastructure for D3
- Schedule pilot user onboarding

**Next Week:**
- Complete D1 and deploy to pilot
- Begin D2 implementation (Scout recommendations)
- Run D3 test matrix in parallel

**By End of Month:**
- D1 proven in pilot
- D2 ready for beta
- D3 complete validation
- Ready for production rollout

---

**Specification Complete**  
**Contract Locked**  
**Ready for Implementation**

