# Scout Verification Audit — C1

**Status:** Audit Phase (C1)  
**Purpose:** Identify all verification gates that block user actions before they execute  
**Outcome:** Map which gates should trigger on-demand vs. upfront  
**Next Phase:** C2 implements explainAndOfferVerification pattern  

---

## 1. Current Verification Landscape

### 1.1 Upfront Verification Gates (Currently Blocking)

#### Email Verification
- **Location:** `/api/auth/register` post-signup
- **Current:** Automatic after signup, blocks email use until verified
- **Status:** `user.emailVerified` (boolean)
- **Problem:** Prevents Scout from using email as trusted contact vector

#### Address Verification
- **Location:** `/onboarding/profile` or `/address-verification` page
- **Current:** Requested post-signup, blocks profile publication until verified
- **Status:** `user.addressVerified` (boolean, deadline)
- **Problem:** Prevents Scout recommendations until address verified (C1 finding: too early)

#### Professional Verification (Contractors)
- **Location:** `/contractor-apply` or `/contractor-verification`
- **Current:** Requested during contractor signup flow
- **Statuses:** pending → under_review → approved|rejected|expired|suspended
- **Problem:** Blocks contractor actions (messaging, recommendations) until approved

---

### 1.2 Current Action-Level Verification Checks

#### Messaging (server/social-features.ts:411-418)
```typescript
// Current: UPFRONT CHECK
if (!(initiator as any).addressVerified) {
  // Block messaging
  return { allowed: false, reason: 'Address not verified' };
}

if (!(recipient as any).addressVerified) {
  // Block receiving messages
  return { allowed: false, reason: 'Recipient not verified' };
}
```
**Finding:** Both sender AND receiver must be address-verified. This is too strict (C2 opportunity).

#### Community Features (server/social-features.ts:71, 130, 138)
- Filters to only show `addressVerified: true` users in community lists
- Sorts by verification status
**Finding:** Verified users get elevated visibility. Could be dynamic (C2 opportunity).

#### Scout Confidence (server/utils/scoutConfidenceScoring.ts:127)
```typescript
if (target.addressVerified) {
  // Confidence boost
}
```
**Finding:** Verification affects recommendation confidence. Good signal to keep.

#### Direct Connect / Messaging
- **Current:** Checks `addressVerified` before allowing message initiation
- **Problem:** Can't start conversation until address verified upfront

---

### 1.3 Scout-Level Verification Gates

#### Action Validation (client/src/scout/actionValidation.ts)
- Allowlist of safe actions: NAVIGATE, PREFILL_INPUT, OPEN_TOOLS_DRAWER
- No current per-action verification gates
- **Finding:** Could add action-triggered verification here (C2).

#### Governor Decision (server/scout/governor.ts)
- Situation assessment (goal, risks, unknowns, confidence)
- No explicit verification requirement documented
- **Finding:** Governor could request verification when risk is high (C2 opportunity).

---

## 2. Verification Matrix (C1 Finding)

| Action | Current Gate | Trigger | Recommended Change |
|--------|--------------|---------|-------------------|
| View user profile | none | immediate | keep (no sensitive data) |
| Send message | addressVerified | upfront | **C2: Action-triggered** |
| Join group | none | immediate | keep |
| Post community post | none | immediate | keep |
| Scout recommendation | none | immediate | keep (confidence-based instead) |
| Apply as contractor | verificationStatus:pending | upfront | **C2: Offer verification path** |
| View contractor details | none | immediate | keep |
| Request contractor quote | addressVerified | upfront | **C2: Just-in-time verification** |
| Become marketplace vendor | none | immediate | **C2: Consider verification CTA** |
| Post marketplace listing | none | immediate | keep |

---

## 3. C1 Audit Findings

### Finding 1: Address Verification is Too Aggressive
**Current:** `users.addressVerified` gates messaging, recommendations visibility
**Problem:** New users cannot participate in core Scout flows until verified
**Impact:** 3-5 day friction before trust features activate
**C2 Solution:** Ask for verification when user wants to MESSAGE, not upfront

### Finding 2: Professional Verification Blocks Self-Identification
**Current:** Contractors cannot message/advertise until `verificationStatus: approved`
**Problem:** Users want to identify as contractor, but verification takes weeks
**C2 Solution:** Show verification as optional/recommended, not blocking. Use snapshots for self-identification.

### Finding 3: No Asymmetric Verification
**Current:** Both sender AND receiver must be verified for messaging
**Problem:** One unverified user can block entire conversation
**C2 Solution:** Verify on FIRST ACTION (sender verifies to initiate), recipient gets expanded options when verified

### Finding 4: Scout Doesn't Explain Why
**Current:** Verification gates are silent (user sees error, not explanation)
**Problem:** No UX to help user understand why verification matters
**C2 Solution:** Each gate should have "why we ask this" explanation (Scout recommendation quality, trust signals, etc.)

### Finding 5: Email Verification is Separate from Address
**Current:** Email verified ≠ Address verified (two separate flows)
**Problem:** Confusing for users (which one do I need?)
**C2 Solution:** Unify: email = contact method, address = trust signal

---

## 4. Verification-Gated Actions (C1 Inventory)

### Must Verify Before:
1. **Send direct message** (addressVerified)
2. **Apply as contractor** (verificationStatus:pending)
3. **Access contractor details** (implied: addressVerified for recommendations)

### Should Verify Before (C2 Candidate):
1. **Request contractor quote** (currently: addressVerified)
2. **Post job** (currently: none, but high-value)
3. **Join paid community** (currently: none)
4. **Become marketplace vendor** (currently: none)

### Don't Need Verification:
1. **View public profiles** (profile visibility controlled separately)
2. **Read community posts** (public content)
3. **Browse contractors** (public directory)
4. **Scout interaction** (AI-mediated, no direct contact)

---

## 5. Verification Status Enum Distribution

From `shared/schema.ts`:
```typescript
export const verificationStatusEnum = pgEnum('verification_status', [
  'pending',       // Initial state after signup
  'under_review',  // Application submitted
  'approved',      // Verification passed
  'rejected',      // Failed verification
  'expired',       // Verification lapsed (6 months?)
  'suspended'      // Manually suspended (moderation)
]);
```

**C1 Finding:** No clear time-to-approval SLA. C2 should add:
- `approvedAt` timestamp
- `expiresAt` timestamp
- `nextReviewAt` timestamp (for manual expiry)

---

## 6. C1 Boundaries (Not Yet Addressed)

**What C1 Does NOT Do:**
- ❌ Does not remove any verification requirements
- ❌ Does not implement verification-on-action flow
- ❌ Does not change email/address verification mechanics
- ❌ Does not modify professional verification process

**What C1 DOES Do:**
- ✅ Maps all verification gates
- ✅ Identifies asymmetries and over-restriction
- ✅ Documents timing (upfront vs. action-triggered)
- ✅ Provides C2 roadmap

---

## 7. C2 Implementation Preview (Not Part of C1)

### Pattern: explainAndOfferVerification()
```typescript
// When user tries high-trust action:
scout.message({
  type: 'action_requires_trust',
  action: 'send_message',
  explanation: 'We verify homeowners so contractors know they're talking to real people',
  offered: [
    { type: 'verify_address', label: 'Verify my address', estimate: '2-3 days' },
    { type: 'skip_for_now', label: 'Use Scout-mediated contact instead' },
  ],
});

// If user chooses verify_address:
// → navigates to /address-verification with context
// → re-attempts action after verification

// If user chooses skip_for_now:
// → opens contact modal pre-filled with Scout's message template
// → Scout mediates conversation until address verified
```

### Trigger Points (C2):
1. First message attempt (sender)
2. First contractor apply (contractor)
3. First marketplace listing post (vendor)
4. First high-value recommendation acceptance (homeowner)

---

## 8. Metrics for C1 Validation

**Baseline (Before C2):**
- % of new users who verify address within 7 days
- % of contractor applications → approval (conversion rate)
- % of verified users who message first contractor
- Time-to-first-verification (days)

**C2 Success Criteria (Not in C1):**
- % who verify address when prompted at action time (vs. upfront)
- Conversion improvement: action-triggered vs. upfront gate
- Time-to-first-verification (should decrease)
- User satisfaction with "why we ask" explanations

---

## 9. Audit Completeness Checklist

- ✅ Identified all `addressVerified` gates (messaging, recommendations)
- ✅ Identified all `verificationStatus` gates (professional verification)
- ✅ Identified all email verification gates (signup → messaging)
- ✅ Documented asymmetries (sender + receiver both required)
- ✅ Found Scout-specific integration (confidence scoring)
- ✅ Mapped action-to-verification matrix
- ✅ Identified which gates are too aggressive
- ✅ Documented C2 approach for each gate
- ✅ No code changes required (C1 is audit only)

---

## 10. Handoff to C2

**C2 will:**
1. Implement explainAndOfferVerification() utility
2. Rewire first-message flow to ask on demand
3. Add "why we ask" explanations to each gate
4. Create Scout actions for verification CTAs
5. Update governor to consider verification state in risk assessment
6. Test conversion improvement with Pilot user (traderscornerllc@gmail.com)
