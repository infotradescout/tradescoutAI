# TradeScout for Admins: Technical & Strategic Overview

## Mission Statement

TradeScout is a **decision checkpoint system**, not a marketplace platform.

Before any consequential action (hiring, connecting, commitment), the system must validate the decision authority.

**That validation is the entire product.**

---

## Core Architecture: The Control Seam

### What Is It?

A single enforcement point where Scout intercepts user actions and decides:

- **COMPLY** → Action shows; user can proceed
- **DEFER** → Action shows with warning; user must confirm
- **BLOCK** → Action is hidden; requires admin override

### Why This Matters

Most platforms optimize for engagement (show everything).

TradeScout optimizes for regret-minimization (validate before commitment).

This is a fundamentally different bet on user value.

### Where The Seam Lives

**File:** `server/routes/scout-cta-check.ts`

**Endpoint:** `POST /api/scout/cta-check`

**Payload:**
```json
{
  "action": "direct_connect|message|apply",
  "context": "contractor|homeowner|admin",
  "contextId": "userId",
  "scope": "community|direct"
}
```

**Response:**
```json
{
  "allowed": true|false,
  "action": "COMPLY|DEFER|BLOCK",
  "ctaMode": "show|ask_scout|hide",
  "explanation": "risk summary",
  "label": "optional authority label"
}
```

**Cache:** 30 seconds per scope (prevents thrashing)

**Fail-open:** If Scout service unavailable, action proceeds (system resilience)

---

## Scout Decision Engine: How It Works

### Step 1: Situation Inference

**Function:** `inferSituation(action, context, userId)`

Determines what the user is about to do and their role:

- Homeowner seeking contractor?
- Contractor seeking customer?
- Admin moderating community?
- User joining group?

### Step 2: Risk Classification

**Function:** `classifyRisk(action, situation)`

Evaluates three threat vectors:

1. **Actor Risk** (Who is this person?)
   - Verified identity?
   - Background check passed?
   - License/credentials valid?
   - History in community?

2. **Pattern Risk** (What's their pattern?)
   - Is this normal for them?
   - Unusual spike in activity?
   - Multiple similar failures?
   - Behavioral anomalies?

3. **Contextual Risk** (Situation-specific)
   - High-value transaction?
   - Vulnerable population (elderly, new community)?
   - Known scam vector?
   - Regulatory red flags?

### Step 3: Authority Confidence Scoring

**Function:** `selectAction(situation, riskScore, authorityMode)`

Applies Admin Control Plane settings:

- **authority_mode**: normal | conservative | advisory
- **confidence_dampener**: multiplier on Scout confidence (0.5-1.5)
- **learning_enabled**: bool for outcome tracking

Final decision = risk_score + admin_parameters + historical confidence

### Step 4: Explanation & Metadata

Scout returns:

- **Action**: What the user can do (show/ask/hide)
- **Explanation**: Human-readable reason (shown only on DEFER)
- **Label**: Authority signal (disabled in Phase 2B)
- **Metadata**: Tracking data for learning

---

## Three Phases of Authority Implementation

### Phase 2A: Action Gating (LIVE NOW)

**Status:** Active in production

**What it does:**
- Intercepts Direct Connect, Message, Apply CTAs
- Validates authority before rendering
- Enforces decision at the moment that matters

**Where it runs:**
- `client/src/components/community/CommunityCTA.tsx`
- `CommunityCTA` component calls `checkCTAAuthority()` on mount
- Renders based on response: COMPLY (show) | DEFER (ask) | BLOCK (hide)

**Data collected:**
- Block rate (% of actions gated)
- Override rate (% of users bypassing warnings)
- Regret-after-override (correlate overrides to negative outcomes)

**Re-enable criteria:** N/A (always on)

**Why this phase:**
Authority must be enforced before commitment. You cannot learn whether Scout is right if the user can bypass it without friction.

---

### Phase 2B: Authority Labels (DISABLED)

**Status:** Code complete, feature flag disabled

**Feature flag:** `ENABLE_AUTHORITY_LABELS = false`

**What it would do:**
- Display authority confidence score on Snapshot cards
- Show authority labels on Community Post cards
- Example: "Verified Contractor | Scout Confidence: 87%"

**Files:**
- `client/src/components/community/CommunitySnapshotRail.tsx` (lines 45-57)
- `client/src/components/community/CommunityPostCard.tsx` (lines 78-90)

**Why disabled:**
Labels without empirical validation destroy credibility faster than no labels.

Premature authority signals pollute learning data.

Users interpret labels as algorithmic judgment. That judgment must be earned first.

**Re-enable criteria:**
✓ ≥ 100 gated actions collected
✓ ≥ 20 user overrides recorded
✓ Override → regret correlation visible
✓ Scout block rate statistically justified

**How to re-enable:**
```ts
// In CommunitySnapshotRail.tsx and CommunityPostCard.tsx
const ENABLE_AUTHORITY_LABELS = true;
```

Then rebuild and deploy.

---

### Phase 2C: Outcome Weighting (DISABLED)

**Status:** Code complete, feature flag disabled

**Feature flag:** `ENABLE_OUTCOME_WEIGHTING = false`

**What it would do:**
- Weight Community feed by outcome signals
- Promote posts from contractors/people with high success rates
- Suppress feed visibility from problem actors
- Sort feed by "likelihood of good outcome"

**Implementation:**
- Service: `server/community/outcomeScoring.ts` (212 lines)
- Scoring logic: `getOutcomeScores(contextId)`
- Integration: `server/routes.ts` (community posts endpoint)

**Scoring formula:**
```
outcome_score = (success_count - regret_count) / total_count
adjusted_score = outcome_score * dampening_factor(sample_size)
```

Why disabled:
Weighting without outcome data is superstition.

Feed manipulation without legitimacy is algorithmic control.

You cannot fairly weight outcomes until Scout has protected people and learned from those protections.

**Re-enable criteria:**
✓ ≥ 50 completed outcomes recorded
✓ Outcome variance measurable (not all 1.0 or 0.0)
✓ Calibration stable (scoring predictions match actual outcomes)
✓ Block rate and override patterns understood
✓ Admin decision: outcome weighting justified

**How to re-enable:**
```ts
// In server/routes.ts
const ENABLE_OUTCOME_WEIGHTING = true;
```

Then rebuild and deploy.

---

## Data Signals: What Scout Learns From

### Signal 1: Block Rate Analysis

**Question:** Is Scout protecting or overreaching?

**Metrics:**
- % of CTAs that trigger DEFER
- % of CTAs that trigger BLOCK
- Block rate by action type (direct_connect vs. message vs. apply)
- Block rate by context (homeowner vs. contractor)

**Healthy range:**
- DEFER: 8-15% of actions
- BLOCK: 1-5% of actions
- Too high → Scout is fear-based
- Too low → Scout is ineffectual

### Signal 2: Override → Regret Sequence

**Question:** When users ignore Scout, do they regret it?

**Data flow:**
1. Scout says DEFER or BLOCK
2. User overrides/appeals
3. User proceeds with action
4. Outcome tracked (success or regret)

**Critical outcome signals:**
- Payment dispute
- Safety complaint
- Negative review
- "I was scammed" report
- Account flagged for fraud

**Success measure:**
When override rate > 70% AND regret rate > 50%, Scout's warning was justified.

When override rate < 20%, Scout might be too timid.

### Signal 3: Silent Compliance

**Question:** Do users accept guidance without friction?

**Metrics:**
- DEFER → proceed anyway: % of users
- DEFER → abandon action: % of users
- User complaints about gating
- Appeal rate for BLOCK decisions

**What this signals:**
High silent compliance = protective system
Low silent compliance = controlling system

The goal: Users feel Scout is watching out for them, not controlling them.

---

## Admin Control Plane Integration

**Location:** `server/routes/admin-control.ts`

**Admin Dashboard:** `client/src/pages/admin-control.tsx`

### Authority Mode

Controls how aggressively Scout protects:

- **normal:** Standard risk tolerance. Block obvious threats, warn on moderate risk.
- **conservative:** High protection. Lower threshold for BLOCK. Suitable for vulnerable populations.
- **advisory:** Low protection. Scout only warns; rarely blocks. Trust user judgment.

### Confidence Dampener

Multiplier on Scout's confidence scoring (0.5 - 1.5):

- 1.0 = normal confidence
- 1.5 = aggressive (more blocks)
- 0.5 = timid (more complies)

Useful for A/B testing safety postures.

### Learning Toggle

Enable/disable outcome tracking:

```ts
if (learning_enabled) {
  // Track override → regret correlations
  // Build confidence calibration data
  // Update risk models
}
```

### Health Metrics

Real-time dashboard showing:

- Current block rate
- Current override rate
- Estimated regret correlation
- Scout decision accuracy
- System uptime

---

## Deployment Strategy

### Pilot First

Phase 2A deployed to pilot account first:

- Pilot user: `traderscornerllc@gmail.com`
- Server-side flag: `user.isPilot` (derived from allowlist)
- Monitor: Override rates, regret signals, user feedback

### Gradual Rollout

1. **Week 1:** Pilot account only (internal testing)
2. **Week 2:** 10% of user base (early adopters)
3. **Week 3:** 50% of user base (monitoring data)
4. **Week 4+:** Full rollout (after data validation)

### Monitoring

During rollout, track:

- Block rate trend
- Override rate trend
- Error rate (Scout service failures)
- User complaints
- Regret signal correlation

### Rollback Criteria

If any metric fails:

- Block rate > 25% → Scout too aggressive
- Override rate < 10% AND block rate < 2% → Scout ineffectual
- Error rate > 5% → System reliability issue
- Regret correlation inverted (users regret NOT ignoring Scout) → policy failure

Rollback: Change feature flags to false, deploy, monitor.

---

## Future Phases (Blocked Until Data Justifies)

### Phase 3: Pattern Recognition UI

When Phase 2B is active:

- Show why Scout made a decision (if user asks)
- Display decision confidence levels
- Explain risk factors in plain language
- Optional: Show Scout's reasoning

**Blocks:** Phase 2B must be active and stable first

### Phase 4: Community Authority Layers

When Phase 2C is active:

- Community admins can override Scout decisions
- Reputation system rewards good outcomes
- Contractors can build authority through verified work
- Feed can be filtered by authority level

**Blocks:** Phase 2C must be active and well-calibrated first

---

## Frequently Asked Admin Questions

**Q: Why not launch all phases at once?**

A: Premature authority signals pollute learning data. You learn who Scout should protect by watching real consequences, not by guessing.

**Q: What if Scout blocks legitimate people?**

A: Appeals process exists. And Scout improves as it learns override/outcome patterns.

**Q: How do I know Scout's decisions are fair?**

A: Monitor block rate by user type (contractor vs. homeowner), by region, by trade. Audit for bias. The data will tell you.

**Q: Can bad actors game the system?**

A: Yes, initially. But Scout learns from regret signals. Bad actors will be BLOCK'd as soon as outcome data shows their pattern.

**Q: What if I disagree with a Scout decision?**

A: Log into Admin Control Plane. Override the decision. Scout learns that you overrode it. If you're consistently right, your override patterns inform Scout's next update.

**Q: How often does Scout update its risk models?**

A: Continuously. Outcome signals are ingested in real-time. Risk scoring adapts within hours.

**Q: What happens to users' data?**

A: Scout works on user data locally in their account context. No personal data is sold. No friction is monetized.

**Q: Can Scout be disabled?**

A: Phase 2A gating cannot be fully disabled (it's the control seam). But authority_mode can be set to "advisory" (warning-only, no blocks).

---

## Key Strategic Insight

**You are not building a marketplace.**

You are building a decision system.

The entire value prop hinges on one thing: **When Scout says something is safe, it actually is.**

That credibility is earned through:

1. Real protection (Phase 2A blocking actual threats)
2. Empirical validation (override → regret data)
3. Epistemic humility (not claiming authority you haven't earned)

Do not skip steps.

Do not chase engagement at the cost of this credibility.

Do not activate Phase 2B or 2C until the data demands it.

The investors and users will recognize this restraint as institutional maturity.

**That is your defensible position.**

---

## Technical Checklist

- [x] Phase 2A: Action gating endpoint live
- [x] Phase 2A: Client-side integration (CommunityCTA.tsx)
- [x] Phase 2B: Code complete, feature flag off
- [x] Phase 2C: Code complete, feature flag off
- [x] Monitoring: Block rate, override rate, regret signals
- [x] Admin Control Plane: Authority mode, dampener, learning toggle
- [x] Build: Passing, no errors
- [x] Deployment: Ready for pilot account

---

**TradeScout Admin Philosophy:**

Build the seam first. Earn the authority second. Activate the interpretation third.

Not before.
