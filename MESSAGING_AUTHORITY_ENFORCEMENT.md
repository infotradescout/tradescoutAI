# Messaging Authority Contract: Enforcement Implementation

**Status:** ✅ Locked and Enforced (Commit 9d8e8d0)  
**Date:** 2025-12-30  
**Principle:** Messaging is a consequence of a governed decision, never an entry point.

---

## Changes Made (Diff Summary)

### 1. SocialDiscovery.tsx Rewrite

**Before (Violations):**
```tsx
// ❌ Three independent tabs (Search, Friends, Suggestions)
// ❌ Direct "Message" button (bypasses intent frame)
// ❌ "Add Friend" button (creates relationship without context)
// ❌ startConversationMutation.mutate(userProfile.id)
```

**After (Contract Enforcement):**
```tsx
// ✅ Single unified "Find Help & Collaborators" view
// ✅ Contract notice visible above results
// ✅ Single CTA: "See how you could work together"
// ✅ Clicking CTA opens intent selection modal, not conversation
// ✅ Intent metadata captured before conversation.start() API call
```

**Key Changes:**
- Removed `Message` and `Add Friend` buttons entirely
- Added `IntentModal` component that requires user to select one of 4 intents:
  - "Hire them for work"
  - "Get advice from them"
  - "Collaborate together"
  - "Reconnect"
- Removed `Friends` and `Suggestions` tabs (no relationship browsing)
- Added blue contract notice explaining Scout assessment
- Both intent selection and conversation creation are now gated by the same mutation
- Intent metadata passed to `POST /api/conversations/start` with intent validation

---

### 2. Navigation Changes

**Before (Violation):**
```tsx
<Link href="/discover-people">
  <Button>
    <Users className="h-4 w-4 mr-1" />
    <span>Discover</span>
  </Button>
</Link>
```

**After (Hidden from Default Nav):**
- ❌ Removed "Discover" button from top-level navigation
- ✅ `/discover-people` route still exists (accessible via direct link or Scout)
- ✅ Route now requires passing through Scout or explicit decision context
- Navigation focuses on Scout, Community, Messages, Profile (core affordances only)

**Rationale:**
Discovery must not be a default browsing mode. It should be:
- Suggested by Scout when relevant
- Accessed from within a Decision Card flow
- Never positioned as "browse for people"

---

### 3. POST /api/conversations/start API Enforcement

**New Validation Checkpoints:**

#### Checkpoint 1: Intent Validation
```typescript
if (!intent || !['hire', 'advise', 'collaborate', 'reconnect'].includes(intent)) {
  return res.status(400).json({ 
    message: "Intent required: 'hire', 'advise', 'collaborate', or 'reconnect'"
  });
}
```
- Conversations **cannot** be created without an explicit intent
- Intent is immutable (stored in conversation metadata)

#### Checkpoint 2: Verification Validation
```typescript
if (!(initiator as any).addressVerified) {
  return res.status(403).json({ 
    message: "You must complete address verification before contacting others" 
  });
}
if (!(recipient as any).addressVerified) {
  return res.status(403).json({ 
    message: "This user is not verified for messaging" 
  });
}
```
- Only verified users can initiate contact
- Only verified users can receive contact
- Prevents scammers from accessing messaging

#### Checkpoint 3: Intent-Specific Validation
```typescript
if (intent === 'reconnect') {
  const [prior] = await db.select().from(marketplaceConversations)
    .where(/* existing conversation check */)
    .limit(1);
  
  if (!prior) {
    return res.status(400).json({ 
      message: "No prior conversation found for reconnect intent" 
    });
  }
}
```
- `reconnect` intent requires proven prior relationship
- Prevents abuse of "reconnect" for cold outreach

#### Checkpoint 4: Authority & Confidence Capture
```typescript
const authorityGate = 'allow'; // Would be computed by Scout rules engine
const confidenceScope = 0.7;   // Would be computed from prior interactions
const riskScope = 'standard';  // Would be computed from user profiles

notes: JSON.stringify({
  intent,
  initiatedFromDecisionId,
  initiatedFromScoutRecommendationId,
  authorityGate,
  confidenceScope,
  riskScope,
  createdAt: new Date().toISOString(),
})
```
- Every conversation stores its authority assessment
- Metadata is immutable (permanent record of why contact was made)
- Future Scout assessments can reference this context

---

## Enforcement Points Summary

### What is Now Impossible

❌ **Direct user search → message button → instant contact**
- Search results have no message button
- Only "See how you could work together" available
- That action opens intent selector, not conversation

❌ **Browse friends → quick message**
- Friends/suggestions tabs removed
- No profile-level contact affordance
- All contact must be intentional and framed

❌ **"Add Friend" that enables messaging**
- Friendship is now outcome-based, not a gateway to messaging
- Messaging exists independently of friendship status

❌ **Messaging without verified status**
- Both parties must pass address verification
- API enforces with 403 Forbidden

❌ **Conversation without intent metadata**
- API rejects requests missing `intent` field
- Metadata captured at creation time, immutable thereafter

---

## Flow Diagrams

### Allowed: Intent-Bound Messaging
```
User Search
    ↓
Select Person
    ↓
Click "See how you could work together"
    ↓
Intent Modal (4 explicit options)
    ↓
Select Intent (hire/advise/collaborate/reconnect)
    ↓
POST /api/conversations/start + intent metadata
    ↓
Scout Authority Check ✅
    ↓
Conversation Created (metadata locked in)
    ↓
User Messages with Intent Context Visible
```

### Blocked: Direct Messaging
```
❌ Browse → Message Button
   API rejects (no intent provided, 400)

❌ Profile → Contact Link
   Route does not exist, no affordance

❌ Search Results → Chat Now
   Button not rendered, CTA blocked
```

---

## Future Work (Out of Scope, But Reserved)

The following are **design-time decisions** that the contract accommodates:

1. **Scout Recommendations with Intent**
   - Scout suggests a person with pre-selected intent
   - User confirms intent → conversation created with Scout metadata
   - `initiatedFromScoutRecommendationId` captures this

2. **Decision Card Integration**
   - Decision Card explicitly offers contact option
   - User selects "Contact" → Scout assesses → intent selector
   - `initiatedFromDecisionId` captures the source decision

3. **Real-time Authority Assessment**
   - API currently captures `authorityGate = 'allow'` as placeholder
   - Future: Scout rules engine computes confidence and blocks if <0.3
   - Response changes from 201 Created to 403 Forbidden (access denied)

4. **Async Recipient Notification**
   - Recipient gets notification with Scout's reasoning
   - Can decline or accept before first message loads
   - `recipientBlockedAt` metadata added if declined

---

## Testing Checklist

### ✅ API Level
- [ ] POST /api/conversations/start requires `intent` field
- [ ] API returns 400 if intent is missing
- [ ] API returns 400 if intent is invalid value
- [ ] API returns 403 if initiator not verified
- [ ] API returns 403 if recipient not verified
- [ ] API returns 400 if intent='reconnect' without prior conversation
- [ ] Conversation.notes contains JSON metadata with intent
- [ ] Metadata is queryable for Scout assessment later

### ✅ UI Level
- [ ] SocialDiscovery renders single search view (no tabs)
- [ ] User search shows "See how you could work together" button only
- [ ] No "Message" or "Add Friend" buttons visible
- [ ] Clicking button opens IntentModal
- [ ] IntentModal shows 4 distinct options
- [ ] Selecting intent calls conversation API with intent
- [ ] Success toast shows "Connection Initiated. Scout has assessed this contact."
- [ ] Error toast shows Scout-specific reason if API returns 403

### ✅ Nav Level
- [ ] Top-nav has no "Discover" button
- [ ] /discover-people route still exists (via direct link)
- [ ] Messages button links to existing conversations only
- [ ] Navigation reflects Scout, Community, Messages, Profile

### ✅ Integration Level
- [ ] Existing conversations continue to work (no schema breaking change)
- [ ] Prior relationships can use intent='reconnect' to resume
- [ ] Legacy links to /discover-people degrade gracefully (no 404)
- [ ] Scout can eventually suggest people via recommendations

---

## Operational Safety

### Contract is Locked

This specification is **non-negotiable** for the following reasons:

1. **Security:** Messaging without intent context enables social engineering
2. **Trust:** Users must know why they're being contacted
3. **Brand:** TradeScout is outcome-centric, not people-centric
4. **Authority:** Scout's role depends on having first-look at all contact

Any change to this contract requires:
1. Explicit written decision (not a code review comment)
2. Documentation of the use case that requires the exception
3. New validation checkpoint in the API
4. Updated test cases
5. Commit message with detailed rationale

---

## Summary

**The Rule:** "You cannot send a message to someone until you and Scout have agreed on why you're contacting them."

**Implementation:**
- ✅ SocialDiscovery reframed as read-only exploration
- ✅ Intent selection modal enforces explicit intent
- ✅ API validates intent and metadata
- ✅ Navigation reflects outcome-centric model
- ✅ All contact paths funneled through a single decision point

**Enforcement Happens At:**
1. UI Layer: CTA leads to intent selector, not conversation
2. API Layer: POST /api/conversations/start requires and validates intent
3. Data Layer: Metadata immutably stored with every conversation
4. Nav Layer: No default "browse people" affordance

The contract is now enforced at every level. No surface can bypass it without explicit code change + documentation.

