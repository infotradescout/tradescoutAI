# Decision Card: CTA + Trust + Proof (Copy/Layout Only, No Behavior Change)

**Date**: January 8, 2026  
**Status**: Awaiting Approval  
**Scope**: Homepage hero + header CTA + Scout welcome copy + signup reminder  

---

## Guardrails (Non-Negotiable)

- Scout is the bridge (discovery → Scout → intent → Decision Card → contact)
- Claims-first signup unchanged
- Counts-only proof; no PII; no contact bypass
- VAC phrased "where available"
- No SLA promises
- No routing/authority/verification semantics changes

---

## Primary CTA

**Label**: "Start with Scout"  
**Subtext**: "Tell Scout what you need. Get a Decision Card."

**Behavior** (unchanged):
- Opens Scout (chat-first)
- First prompt forces intent selection
- Scout emits Decision Card preview (read-only until signup if needed)

**Does NOT**:
- Contact anyone
- Let users browse phone numbers/emails
- Bypass claims-first signup

---

## Trust Line

**Above-the-fold**: "Local trust + routing — decisions before contact."

**Three Trust Bullets** (under CTA):
1. "Contact is gated by Decision Cards."
2. "Claims can be verified (VAC) where available."
3. "Routing favors proof, not ads."

---

## Proof Module (Counts-Only)

**Title**: "Live Proof Snapshot"

**Contents** (anonymized counts only):
- Decision Cards processed (last 7 days)
- Verified claims (last 30 days)
- Active counties
- Median time-to-decision (only if already tracked; otherwise omit)

**Never shows**:
- Names, phone numbers, addresses, exact job details
- Contractor rankings tied to identity pre-signup
- Any direct "contact now" shortcut

**Click behavior**:
- "View how verification works" → explanation modal (content only)

**Fail-safe footnote**: "Counts are anonymized; contact requires a Decision Card."

---

## Touchpoints

1. **Homepage hero**
   - Primary CTA: "Start with Scout"
   - Trust line + 3 bullets
   - Live Proof Snapshot card

2. **Header** (persistent)
   - CTA button: "Start with Scout"
   - Secondary links: "How it works", "For Contractors", "For Homeowners"

3. **Scout welcome screen**
   - One-liner: "Decisions before contact."
   - Proof Snapshot condensed

4. **Signup page**
   - Reminder: "You're signing up to claim and verify — not to browse contacts."

---

## A/B Candidates (Copy-Only)

**CTA label**:
- A: "Start with Scout"
- B: "Get a Decision Card"

**Trust line**:
- A: "Local trust + routing — decisions before contact."
- B: "Proof first. Contact second."

---

## Psychological Intent (Per TradeScout Law)

**Target Belief**: "This is an authority-led, proof-first system — not a directory."

**Target Behavior**: Click CTA to start with Scout (not to browse contacts).

**Psychological Principles**:
- Authority framing (Scout as orchestrator)
- Transparency (Decision Cards, VAC disclosure)
- Social proof with privacy guardrails (counts-only)

**Risk Prevented**:
- False expectation of open directory/contact
- PII exposure before trust established
- Vanity metrics or inflated promises
- Marketplace/lead-gen framing

---

## Validation Plan (Copy-Only A/B)

**KPI Targets** (choose at approval time):
- +20–40% CTA → Scout click
- +10–25% signup completion from Scout sessions
- Reduced landing bounce rate

**Metrics sources**:
- Only metrics already captured in DB today
- Time-bounded (7d/30d)
- Counts-only, non-identifying

---

## Approval Required

Choose one:

- [ ] ✅ **Approve copy + layout only** (no behavior changes)
- [ ] ❌ **Request edits** (specify below)
- [ ] ⏸️ **Hold** (until lanes/KPIs locked)

**If approved, choose metrics source**:

- [ ] A) Use only metrics already captured in DB today
- [ ] B) Hide proof module until metrics are verified

**If approved, choose CTA variant**:

- [ ] A) "Start with Scout"
- [ ] B) "Get a Decision Card"

**If approved, choose trust line variant**:

- [ ] A) "Local trust + routing — decisions before contact."
- [ ] B) "Proof first. Contact second."

---

## Default Implementation (If Approved Without Variant Selection)

If approved without specific variant choices:

- **CTA**: "Start with Scout"
- **Trust line**: "Local trust + routing — decisions before contact."
- **Proof module**: Show only metrics queryable today; hide entirely if any metric fails validation (no zeros, no placeholders)

---

## Fail-Safes

1. ✅ Add footnote under proof module: "Counts are anonymized; contact requires a Decision Card."
2. ✅ VAC line stays conditional ("where available") until county coverage is audited
3. ✅ Any metric that can't be queried → omitted (not replaced with zero)
4. ✅ No changes to routing, claims, verification, or contact gating logic
5. ✅ Copy-only changes are reversible via git revert

---

## Notes for Implementation

- Changes are copy/placement only
- No new API endpoints
- No database schema changes
- No routing logic changes
- All changes must pass forbidden-patterns check
- Metrics queries must be read-only and performant
