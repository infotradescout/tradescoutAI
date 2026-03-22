# Full Rollout Manifest: Phase 2A Community Authority Gating
**Date:** December 30, 2025  
**Status:** PRODUCTION READY  
**Scope:** All Users (100%)

---

## What's Being Deployed

### Phase 2A: Action Gating (LIVE)
Community CTAs (Direct Connect, Message, Apply) now require Scout authority check before rendering.

**Endpoint:** `POST /api/scout/cta-check`

**Files Modified:**
- `client/src/components/community/CommunityCTA.tsx` - Integrated authority checking
- `server/routes/scout-cta-check.ts` - Authority check endpoint (155 lines)
- `server/routes.ts` - Route mounted

**Behavior:**
- User clicks Direct Connect / Message / Apply
- System calls Scout authority endpoint
- Scout returns: COMPLY (show) | DEFER (ask user) | BLOCK (hide)
- Action renders based on authority decision

**User Experience:**
- Safe actions show normally
- Risky actions ask for confirmation
- High-risk actions are blocked (users can appeal)

---

### Phase 2B & 2C: Disabled (Code Preserved)
Feature flags prevent execution:
- `ENABLE_AUTHORITY_LABELS = false` (Authority labels on cards)
- `ENABLE_OUTCOME_WEIGHTING = false` (Feed weighting by outcomes)

Code preserved. No activation until empirical data justifies.

---

## Rollout Plan

### Immediate (Dec 30, 2025)
Deploy to production. Phase 2A active for all users.

### Monitoring (Days 1-7)
Track three signals:
1. **Block rate** - % of actions gated (should be 5-15%)
2. **Override rate** - % of users bypassing warnings (should be 20-40%)
3. **User feedback** - Complaints, appeals, support tickets

### Data Collection (Days 1-30)
Accumulate:
- ≥ 100 gated CTA events
- ≥ 20 user overrides
- Override → regret correlations
- Block rate by user type (homeowner vs. contractor)

### Checkpoint (Day 30)
Review data. Decide:
- Is Scout protecting people? (measured by override/regret)
- Is Scout calibrated? (block rate in healthy range)
- Ready for Phase 2B? (depends on data quality)

---

## Build Verification

**Build Status:** ✅ PASSING
- Vite: 3193 modules, 17.42s
- esbuild: 1.8mb index.js
- No compilation errors
- All routes mounted

**Files Changed:**
- 34 total files modified
- 6546 insertions, 105 deletions
- New files: Scout infrastructure, Admin control plane, Diagnostics

---

## Deployment Checklist

- [x] Phase 2A implemented
- [x] Phase 2B code complete, feature flag disabled
- [x] Phase 2C code complete, feature flag disabled
- [x] Authority endpoint mounted
- [x] Client integration wired
- [x] Build passing
- [x] No pilot gating (all users get Phase 2A)
- [x] Documentation updated
- [x] Monitoring infrastructure ready

---

## Risk Mitigation

**If Scout is too aggressive:**
- Change `authority_mode` to `advisory` (warnings only, no blocks)
- Monitor block rate
- Adjust risk classification thresholds

**If Scout is too timid:**
- Change `confidence_dampener` to 1.5 (increase blocking)
- Monitor override/regret correlation
- Tighten risk models

**If users complain loudly:**
- Appeal process available (no permanent blocks)
- Admin override available
- Transparent logging of all decisions

---

## Success Metrics

**Phase 2A is successful when:**

1. Block rate stabilizes at 5-15% of actions
2. Users who override Scout experience measurable regret > 50% of the time
3. Users accept Scout guidance without friction (silent compliance > 70%)
4. No systemic complaints about fairness
5. Contractor profile quality improved (better reviews, fewer disputes)

---

## What Happens Next

### Week 1
Monitor block rate, override rate, error rate.

### Week 2-3
Analyze override → regret patterns.
Measure user sentiment in support tickets.

### Week 4+
Make Phase 2B decision:
- If data supports labels → enable `ENABLE_AUTHORITY_LABELS = true`
- If data insufficient → wait 2 more weeks

### 30+ Days
Make Phase 2C decision:
- If outcomes reliable → enable `ENABLE_OUTCOME_WEIGHTING = true`
- If outcomes noisy → keep disabled

---

## Communication (Users & Team)

**Users:** "Scout now reviews community connections for safety."

**Internal:** "Phase 2A active. Phases 2B/2C awaiting empirical validation."

**Investors:** "Authority gating deployed. Learning mode active. Next phases contingent on data quality."

---

## Rollback Plan

If critical issue found:

1. Immediately set Phase 2A to fail-open (allow all actions)
2. Investigate root cause
3. Fix and redeploy

**Time to rollback:** < 5 minutes

**Data impact:** None (Scout decisions logged, not persisted)

---

## Documentation

For users: [TRADESCOUT_FOR_DUMMIES_2.0.md](TRADESCOUT_FOR_DUMMIES_2.0.md)

For admins: [TRADESCOUT_FOR_ADMINS.md](TRADESCOUT_FOR_ADMINS.md)

For investors: [Strategic Overview - Control Seam Philosophy]

---

**Status:** Ready for production deployment.

All systems go.
