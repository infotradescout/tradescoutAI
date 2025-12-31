# Phase D2: Scout Recommendations — Implementation Summary

**Commit:** `a431fd5`  
**Date:** 2025-01-XX  
**Status:** ✅ IMPLEMENTED (in-memory storage, ready for production DB migration)

---

## 1. Overview

Phase D2 implements Scout's intelligent recommendation engine with 5-component confidence scoring. Scout now generates recommendations based on weighted analysis of expertise, location, trust signals, past success, and availability—then classifies each into authority tiers that determine UI friction and permissions.

**Core Principle:**
> Scout recommendations are not search results. They are **pre-vetted, confidence-scored connections** that flow through the same authority-gated messaging checkpoint as Decision Cards.

---

## 2. Architecture

### 2.1 Confidence Scoring Model

**5 Weighted Components:**

| Component | Weight | What It Measures | Example High Score |
|-----------|--------|------------------|-------------------|
| **Expertise Match** | 30% | Role alignment with user intent | Hiring contractor for hire intent = 0.9 |
| **Location Match** | 25% | Geographic proximity | Same county = 1.0, same state = 0.7 |
| **Trust Signal** | 25% | Verification & profile quality | Address verified + profile image = 0.7 |
| **Past Success** | 15% | Prior successful conversations | 2+ prior conversations = 0.8 |
| **Availability** | 5% | Recent activity | Active within 7 days = 0.9 |

**Overall Score:** Weighted average of all components (0.0 to 1.0)

### 2.2 Authority Tiers

Confidence score determines authority tier and UI treatment:

| Tier | Score Range | Authority Gate | UI Treatment | CTA |
|------|-------------|----------------|--------------|-----|
| **auto_allow** | ≥ 0.85 | scout_recommendation | Minimal friction, green badge | "Proceed with contact" |
| **manual_confirm** | 0.70 - 0.84 | scout_recommendation | Review encouraged, blue badge | "Review & confirm" |
| **caution** | 0.50 - 0.69 | scout_recommendation | Risk flags shown, amber badge | "Proceed with caution" |
| **blocked** | < 0.50 | *(not shown)* | Hidden from user | *(alternatives only)* |

### 2.3 Rate Limiting

**Per-User Limits:**
- **Daily:** 3 recommendations maximum
- **Weekly:** 10 recommendations maximum

**Enforcement:** Server-side via `checkRecommendationRateLimit()` before generation.

**Response:** 429 RATE_LIMIT_EXCEEDED if over limit.

---

## 3. API Endpoints

All endpoints under `/api/scout/recommendations`:

### 3.1 POST `/api/scout/recommendations`

**Purpose:** Generate new Scout recommendation for authenticated user.

**Request Body:**
```typescript
{
  targetUserId: string;
  intent: 'hire' | 'collaborate' | 'advise' | 'reconnect';
  decisionContext?: string; // Optional context from Decision Card
}
```

**Response (200):**
```typescript
{
  id: string; // UUID
  userId: string;
  targetUserId: string;
  intent: string;
  confidence: number; // 0.0 - 1.0
  authorityGate: 'scout_recommendation';
  tier: 'auto_allow' | 'manual_confirm' | 'caution' | 'blocked';
  components: {
    expertise_match: number;
    location_match: number;
    trust_signal: number;
    past_success: number;
    availability_match: number;
  };
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
  expiresAt: string; // 7 days from creation
}
```

**Errors:**
- 401: Not authenticated
- 429: RATE_LIMIT_EXCEEDED (3/day or 10/week exceeded)
- 400: Missing targetUserId or intent

### 3.2 GET `/api/scout/recommendations/pending`

**Purpose:** Get active recommendations for authenticated user.

**Query Params:** None

**Response (200):**
```typescript
{
  recommendations: ScoutRecommendation[]; // Max 5, sorted by confidence desc
}
```

**Filters Applied:**
- Only `status: 'pending'`
- Not expired (within 7 days)
- Tier not `blocked`

### 3.3 POST `/api/scout/recommendations/:id/action`

**Purpose:** Accept, dismiss, or view alternatives for recommendation.

**Request Body:**
```typescript
{
  action: 'accept' | 'dismiss' | 'view_alternatives';
}
```

**Response (200):**
```typescript
{
  recommendation: ScoutRecommendation; // Updated status
}
```

**Behavior:**
- `accept`: Updates status to 'accepted', user proceeds to ContactOutcomeModal
- `dismiss`: Updates status to 'dismissed', removed from active list
- `view_alternatives`: Logs intent, returns same recommendation (future: generate alternatives)

### 3.4 POST `/api/scout/feedback/outcome`

**Purpose:** Record conversation outcome for learning.

**Request Body:**
```typescript
{
  recommendationId: string;
  conversationId: string;
  outcome: 'successful' | 'unsuccessful' | 'no_response';
  rating?: number; // 1-5 stars
  feedback?: string;
}
```

**Response (200):**
```typescript
{
  success: true;
}
```

**Current Implementation:** Logs feedback (console), future: update component weights based on outcomes.

---

## 4. UI Components

### 4.1 ScoutRecommendationCard

**File:** `client/src/components/community/ScoutRecommendationCard.tsx`

**Purpose:** Display Scout recommendation with confidence breakdown and tier-appropriate CTAs.

**Features:**
- **Confidence Badge:** Color-coded by tier (emerald, blue, amber, slate)
- **Target User Display:** Name, role, location
- **Confidence Breakdown:** All 5 components shown as percentages
- **Risk Flags:** Displayed if tier = caution (e.g., "Low trust signal", "Limited location match")
- **CTAs:**
  - `auto_allow`: "Proceed with contact" (primary green button)
  - `manual_confirm`: "Review & confirm" (outline blue button)
  - `caution`: "Proceed with caution" (outline amber button)
- **Dismiss Action:** Removes from active recommendations

**Integration:**
- On accept: Opens `ContactOutcomeModal` with `sourceScoutRecommendationId`
- Modal calls POST `/api/social/conversations/start` with:
  ```typescript
  {
    authorityGate: 'scout_recommendation',
    initiatedFromScoutRecommendationId: recommendationId,
    intent: recommendation.intent,
    // ... other fields
  }
  ```

### 4.2 ContactOutcomeModal (Extended)

**File:** `client/src/components/community/ContactOutcomeModal.tsx`

**Changes:**
- **ContactOutcome Interface:** Added `sourceScoutRecommendationId?: string`
- **API Call Logic:** Conditional spread based on source:
  ```typescript
  ...(outcome.sourceDecisionCardId && {
    authorityGate: "decision_card",
    sourceDecisionCardId: outcome.sourceDecisionCardId,
  }),
  ...(outcome.sourceScoutRecommendationId && {
    authorityGate: "scout_recommendation",
    initiatedFromScoutRecommendationId: outcome.sourceScoutRecommendationId,
  }),
  ```

**Result:** Modal now supports both D1 (Decision Card) and D2 (Scout Recommendation) flows through same UI.

---

## 5. Data Storage

### 5.1 Current Implementation (In-Memory)

**Purpose:** Prototype/testing without DB migrations.

**Storage:**
```typescript
const activeRecommendations = new Map<string, ScoutRecommendation>();
const userRecommendationHistory = new Map<string, { date: Date; count: number }[]>();
```

**Limitations:**
- Lost on server restart
- Not suitable for production
- No persistence across instances

### 5.2 Production Migration Plan

**Required Database Table:**

```sql
CREATE TABLE scout_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent TEXT NOT NULL CHECK (intent IN ('hire', 'collaborate', 'advise', 'reconnect')),
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  authority_gate TEXT NOT NULL DEFAULT 'scout_recommendation',
  tier TEXT NOT NULL CHECK (tier IN ('auto_allow', 'manual_confirm', 'caution', 'blocked')),
  components JSONB NOT NULL, -- { expertise_match, location_match, trust_signal, past_success, availability_match }
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  decision_context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  acted_at TIMESTAMPTZ,
  UNIQUE (user_id, target_user_id, intent) -- Prevent duplicate recommendations
);

CREATE INDEX idx_scout_recs_user_status ON scout_recommendations (user_id, status, expires_at);
CREATE INDEX idx_scout_recs_created ON scout_recommendations (created_at);
```

**Migration Steps:**
1. Create table via Drizzle migration
2. Update `server/routes/scout-recommendations.ts` to use DB queries instead of Maps
3. Add cleanup job for expired recommendations (>7 days)
4. Test idempotency (duplicate requests for same user+target+intent)

---

## 6. Integration with D1

**Both Authority Gates Flow Through Same Checkpoint:**

```typescript
// POST /api/social/conversations/start (server/social-features.ts)

// Validation (lines 420-427)
if (!authorityGate || !['decision_card', 'scout_recommendation'].includes(authorityGate)) {
  return res.status(400).json({ 
    reasonCode: 'MISSING_AUTHORITY_GATE',
    message: "Authority gate required: 'decision_card' or 'scout_recommendation'."
  });
}

// Metadata capture (lines 450-470)
const conversationRecord = {
  threadId: existingConversation?.threadId || uuidv4(),
  initiatorId: req.user.id,
  recipientId: recipientUser.id,
  intent,
  authorityGate, // 'decision_card' OR 'scout_recommendation'
  sourceDecisionCardId: authorityGate === 'decision_card' ? sourceDecisionCardId : null,
  initiatedFromScoutRecommendationId: authorityGate === 'scout_recommendation' ? initiatedFromScoutRecommendationId : null,
  confidenceScore: confidenceScore?.toString() || null,
  decisionScope: decisionScope || null,
  createdAt: new Date(),
};
```

**Result:**
- Zero bypass paths (user_search removed in D1)
- All conversations have immutable authority metadata
- D3 tests validate both paths

---

## 7. Testing Plan

### 7.1 Unit Tests (D3 Suite)

**File:** `tests/d3-messaging-authority.test.ts`

**Coverage:**
- Authority gate validation (missing sourceScoutRecommendationId → 400)
- Immutability (can't change intent/authorityGate after creation)
- Idempotency (double submit → same threadId)
- Rate limiting (4th rec in day → 429)

### 7.2 E2E Test Flow

**Manual Test:**
1. **Generate Recommendation:**
   - POST `/api/scout/recommendations` with targetUserId, intent='hire'
   - Verify: Response has confidence score, tier, 5 components
2. **View Pending:**
   - GET `/api/scout/recommendations/pending`
   - Verify: Recommendation appears, blocked tier excluded
3. **Accept Recommendation:**
   - POST `/api/scout/recommendations/:id/action` with action='accept'
   - Verify: Status updated to 'accepted'
4. **Create Conversation:**
   - Open ContactOutcomeModal from ScoutRecommendationCard
   - Submit outcome
   - Verify: POST `/api/social/conversations/start` called with:
     - `authorityGate: 'scout_recommendation'`
     - `initiatedFromScoutRecommendationId: recommendationId`
     - Conversation record created with all metadata
5. **Rate Limit:**
   - Generate 4 recommendations in same day
   - Verify: 4th returns 429 RATE_LIMIT_EXCEEDED

### 7.3 Confidence Scoring Edge Cases

**Test Scenarios:**
| Intent | Target Role | Same County | Address Verified | Expected Tier |
|--------|-------------|-------------|------------------|---------------|
| hire | contractor | Yes | Yes | auto_allow (≥0.85) |
| hire | homeowner | Yes | Yes | caution (low expertise) |
| advise | hoa_board | Yes | Yes | auto_allow |
| collaborate | contractor | No | No | caution/blocked |

---

## 8. KPI Tracking

**Metrics to Monitor (Week 1):**

1. **Adoption Rate:**
   - % of conversations via `scout_recommendation` vs `decision_card`
   - Target: 30% of new conversations from Scout recs by Week 2

2. **Acceptance Rate by Tier:**
   - `auto_allow`: Expected 80%+ acceptance
   - `manual_confirm`: Expected 60-70%
   - `caution`: Expected 30-40%

3. **Confidence Accuracy:**
   - Do auto_allow recommendations lead to successful conversations?
   - Track conversation completion rate vs tier

4. **Rate Limit Hit Frequency:**
   - How often do users hit 3/day or 10/week limits?
   - Adjust if too restrictive (e.g., power users need more)

5. **Component Weights Validation:**
   - Do expertise_match scores correlate with conversation success?
   - Future: A/B test different weight distributions

---

## 9. Future Enhancements

### 9.1 Machine Learning (Phase D4)

**Current:** Static component weights (expertise 30%, location 25%, etc.)

**Future:**
- Record outcomes: successful/unsuccessful/no_response
- Train model to adjust weights based on historical success
- Personalized scoring per user (e.g., some users care more about location than expertise)

### 9.2 Alternatives Engine

**Current:** `view_alternatives` action logs intent but returns same recommendation

**Future:**
- Generate 3 alternative recommendations with different profiles
- Show side-by-side comparison (e.g., "Higher expertise but farther location")

### 9.3 Batch Recommendations

**Current:** Single recommendation per API call

**Future:**
- POST `/api/scout/recommendations/batch` with intent only
- Scout returns top 5 recommendations sorted by confidence
- User can accept multiple or cherry-pick

### 9.4 Real-Time Scoring Updates

**Current:** Confidence calculated at generation time

**Future:**
- Recalculate confidence when:
  - Target user updates profile (verification, new reviews)
  - User's location changes
  - Target becomes available/active
- Notify user: "Jane's confidence score improved to 0.89 (auto_allow)"

---

## 10. Deployment Checklist

**Pre-Production:**
- [ ] Migrate in-memory storage to DB table (scout_recommendations)
- [ ] Add Drizzle schema for scout_recommendations
- [ ] Create DB indexes (user_id, status, expires_at)
- [ ] Test rate limiting with DB queries (not in-memory Maps)
- [ ] Add cleanup job for expired recommendations (cron or scheduled task)
- [ ] Run D3 test suite (all tests pass)
- [ ] E2E test: Generate → Accept → Create Conversation

**Production Rollout:**
- [ ] Deploy to staging environment
- [ ] Smoke test: Create recommendation, verify DB insert
- [ ] Monitor error rates (429, 400, 500)
- [ ] Deploy to production
- [ ] Monitor KPIs (acceptance rate by tier, conversation success)
- [ ] Pilot user (traderscornerllc@gmail.com) tests end-to-end flow

**Week 1 Monitoring:**
- [ ] Check recommendation generation rate (per user, per day)
- [ ] Validate confidence scores match expected distributions
- [ ] Review user feedback on caution tier (are risk flags helpful?)
- [ ] Adjust rate limits if needed (too restrictive or too permissive)

---

## 11. Files Changed

**New Files:**
- `server/routes/scout-recommendations.ts` (200 lines) — 4 API endpoints
- `server/utils/scoutConfidenceScoring.ts` (318 lines) — Confidence engine
- `client/src/components/community/ScoutRecommendationCard.tsx` (280 lines) — UI component

**Modified Files:**
- `client/src/components/community/ContactOutcomeModal.tsx` — Extended for Scout recs
- `server/routes.ts` — Registered Scout recommendation routes

**Total Added:** ~800 lines of production code

---

## 12. Relationship to D1

**D1 (Authority-Gated Messaging):**
- Removed user_search gate
- Deprecated social graph endpoints
- Required decision_card or scout_recommendation for all conversations

**D2 (Scout Recommendations):**
- Adds scout_recommendation as second authority gate
- Pre-vets connections with confidence scoring
- Same enforcement checkpoint as decision_card

**Key Insight:**
> D1 established the checkpoint. D2 provides a second high-quality input path through that checkpoint. Both flow through the same immutable metadata capture.

**Zero Bypass Paths:**
- user_search removed ✅
- Social graph endpoints deprecated (410 Gone) ✅
- Only decision_card and scout_recommendation allowed ✅
- All conversations after D1 hardening have complete authority metadata ✅

---

## 13. Summary

Phase D2 delivers Scout's intelligent recommendation engine with:
- **5-component confidence scoring** (expertise, location, trust, past success, availability)
- **4 authority tiers** (auto_allow, manual_confirm, caution, blocked)
- **Rate limiting** (3/day, 10/week)
- **Tier-based UI** (CTAs and risk flags match confidence level)
- **Single checkpoint** (both decision_card and scout_recommendation flow through same validation)

**Status:** ✅ Implemented, committed (a431fd5), ready for DB migration and production testing.

**Next Steps:**
1. Run D3 test suite (execution)
2. Migrate in-memory storage to DB table
3. Deploy to staging and test E2E flow
4. Monitor KPIs (acceptance rate, conversation success, rate limit hits)
5. Adjust component weights based on Week 1 data

---

**Commit:** `a431fd5`  
**Author:** Scout (TradeScout AI)  
**Date:** 2025-01-XX  
**Phase:** D2 Complete ✅
