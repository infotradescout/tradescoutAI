# Implementation Defaults (If Approved Without Variant Selection)
**Date**: January 8, 2026  
**Purpose**: Define exact copy/placement if Thomas approves without specifying variants

---

## Default Selections

If approval card returns "✅ Approve" without specific variant choices, use these defaults:

### Primary CTA
- **Label**: "Start with Scout"
- **Subtext**: "Tell Scout what you need. Get a Decision Card."
- **Rationale**: Clearest authority framing; aligns with "Scout is the bridge" law

### Trust Line
- **Text**: "Local trust + routing — decisions before contact."
- **Rationale**: Encodes core promise; distinguishes from marketplace/directory framing

### Trust Bullets
1. "Contact is gated by Decision Cards."
2. "Claims can be verified (VAC) where available."
3. "Routing favors proof, not ads."

### Proof Module Behavior
- **Show only metrics queryable today** (per METRICS_READINESS_CHECKLIST.md)
- **Hide entirely if any metric fails validation** (no zeros, no placeholders)
- **Footnote**: "Counts are anonymized; contact requires a Decision Card."

---

## Touchpoint Placement (Specific Files)

### 1. Homepage Hero (`client/src/pages/Home.tsx` or equivalent)

**Current** (assumed structure):
```tsx
<section className="hero">
  <h1>Welcome to TradeScout</h1>
  <p>Find local contractors</p>
  <Button href="/signup">Join Now</Button>
</section>
```

**Proposed** (copy-only changes):
```tsx
<section className="hero">
  <h1>Local trust + routing — decisions before contact.</h1>
  
  <div className="trust-bullets">
    <ul>
      <li>Contact is gated by Decision Cards.</li>
      <li>Claims can be verified (VAC) where available.</li>
      <li>Routing favors proof, not ads.</li>
    </ul>
  </div>

  <Button href="/scout" variant="primary">
    Start with Scout
  </Button>
  <p className="cta-subtext">
    Tell Scout what you need. Get a Decision Card.
  </p>

  <ProofSnapshot />
</section>
```

**Changes**:
- Hero h1 → Trust line
- CTA href → `/scout` (assumes Scout route exists; verify before shipping)
- CTA label → "Start with Scout"
- Add subtext below CTA
- Add `<ProofSnapshot />` component (conditionally rendered)

**Guardrails**:
- If `/scout` route doesn't exist, use existing chat entry point
- If ProofSnapshot has no valid metrics → renders null (invisible)

---

### 2. Header CTA (`client/src/components/Header.tsx` or equivalent)

**Current** (assumed structure):
```tsx
<header>
  <nav>
    <Link to="/">Home</Link>
    <Link to="/about">About</Link>
    <Button href="/signup">Sign Up</Button>
  </nav>
</header>
```

**Proposed**:
```tsx
<header>
  <nav>
    <Link to="/">Home</Link>
    <Link to="/how-it-works">How it works</Link>
    <Link to="/for-contractors">For Contractors</Link>
    <Link to="/for-homeowners">For Homeowners</Link>
    <Button href="/scout" variant="primary">
      Start with Scout
    </Button>
  </nav>
</header>
```

**Changes**:
- Primary CTA → "Start with Scout" (links to `/scout`)
- Add secondary nav links (only if pages exist; otherwise omit)

**Guardrails**:
- Do not create new routes without approval
- If routes don't exist, link to existing equivalents or omit

---

### 3. Scout Welcome Screen (`client/src/components/Scout/Welcome.tsx` or equivalent)

**Current** (assumed structure):
```tsx
<div className="scout-welcome">
  <h2>Hi! I'm Scout.</h2>
  <p>How can I help you today?</p>
</div>
```

**Proposed**:
```tsx
<div className="scout-welcome">
  <h2>Hi! I'm Scout.</h2>
  <p>Decisions before contact.</p>
  <ProofSnapshotCondensed />
  <p>How can I help you today?</p>
</div>
```

**Changes**:
- Add one-liner: "Decisions before contact."
- Add condensed proof snapshot (2–3 metrics max)

**Guardrails**:
- `<ProofSnapshotCondensed />` renders null if no metrics available

---

### 4. Signup Page Reminder (`client/src/pages/Signup.tsx` or equivalent)

**Current** (assumed structure):
```tsx
<form onSubmit={handleSignup}>
  <h1>Create Your Account</h1>
  <input name="email" />
  <Button type="submit">Sign Up</Button>
</form>
```

**Proposed**:
```tsx
<form onSubmit={handleSignup}>
  <h1>Create Your Account</h1>
  <p className="signup-reminder">
    You're signing up to claim and verify — not to browse contacts.
  </p>
  <input name="email" />
  <Button type="submit">Sign Up</Button>
</form>
```

**Changes**:
- Add reminder text above form fields

**Guardrails**:
- Text is informational only; no behavior change
- Does not alter claims-first signup flow

---

## New Component: ProofSnapshot

**File**: `client/src/components/ProofSnapshot.tsx`

**Behavior**:
1. Fetch metrics from `/api/analytics/proof-metrics` (new endpoint)
2. Render only metrics with valid counts (>0)
3. If no metrics available → render null (invisible)
4. Cache response (5min TTL)

**Props** (optional):
- `variant?: 'full' | 'condensed'`
- `className?: string`

**Example Structure**:
```tsx
export function ProofSnapshot({ variant = 'full', className }: Props) {
  const { data, isLoading, error } = useProofMetrics();

  // Hide on error or no data
  if (error || !data || data.metrics.length === 0) {
    return null;
  }

  const metrics = data.metrics.filter(m => m.value > 0);
  if (metrics.length === 0) return null;

  return (
    <div className={`proof-snapshot ${variant} ${className}`}>
      <h3>Live Proof Snapshot</h3>
      <ul>
        {metrics.map(m => (
          <li key={m.key}>
            <strong>{m.value.toLocaleString()}</strong> {m.label}
          </li>
        ))}
      </ul>
      <p className="proof-footnote">
        Counts are anonymized; contact requires a Decision Card.
      </p>
    </div>
  );
}
```

---

## New API Endpoint: Proof Metrics

**File**: `server/analytics/proof-metrics.ts` (new)

**Route**: `GET /api/analytics/proof-metrics`

**Response**:
```json
{
  "metrics": [
    { "key": "decision_cards_7d", "label": "Decision Cards processed (last 7 days)", "value": 142 },
    { "key": "verified_claims_30d", "label": "Verified claims (last 30 days)", "value": 89 },
    { "key": "active_counties", "label": "Active counties", "value": 12 }
  ],
  "cached_at": "2026-01-08T12:34:56Z"
}
```

**Cache Strategy**:
- Redis cache with 5-minute TTL
- Key: `proof_metrics:v1`
- If cache miss → query DB → store in cache → return

**Error Handling**:
- On query error → log error + return empty array (no 500)
- Frontend interprets empty array as "hide module"

**Rate Limiting**:
- Public endpoint → apply global rate limit (100 req/min per IP)

---

## File Changes Summary

### Copy Changes Only (No Behavior)
1. `client/src/pages/Home.tsx` — Update hero h1, CTA, bullets, add ProofSnapshot
2. `client/src/components/Header.tsx` — Update CTA label + href
3. `client/src/components/Scout/Welcome.tsx` — Add one-liner + condensed proof
4. `client/src/pages/Signup.tsx` — Add reminder text

### New Files (If Metrics Approved)
5. `client/src/components/ProofSnapshot.tsx` — New component
6. `client/src/hooks/useProofMetrics.ts` — API hook
7. `server/analytics/proof-metrics.ts` — Metrics queries + endpoint
8. `server/analytics/proof-metrics.test.ts` — Unit tests

### No Changes To
- Routing logic (`server/routing/`)
- Claims semantics (`server/auth/`, `shared/schema.ts`)
- Verification logic (`server/verification/`)
- Contact gating (`server/social-features.ts`)
- Scout chat behavior (`server/scout/`)

---

## Pre-Ship Checklist

Before merging any copy changes:

1. [ ] Verify `/scout` route exists (or use existing chat entry point)
2. [ ] Verify secondary nav links exist (or omit)
3. [ ] Run forbidden-patterns check on all changed files
4. [ ] Verify no new contact/bypass paths created
5. [ ] Test ProofSnapshot with no metrics (should be invisible)
6. [ ] Test ProofSnapshot with partial metrics (should show only valid)
7. [ ] Add A/B tracking events (if approved for testing)
8. [ ] Get final approval on exact copy from Thomas

---

## A/B Testing Setup (If Approved)

If Thomas approves A/B testing:

**Test ID**: `cta_trust_proof_v1`

**Variants**:
- A: "Start with Scout" (default)
- B: "Get a Decision Card"

**Split**: 50/50

**Tracking Events**:
- `cta_click` — User clicks primary CTA
- `scout_session_start` — User opens Scout
- `signup_complete` — User completes signup
- `proof_snapshot_view` — Proof module rendered (non-null)

**Success Metrics**:
- Primary: CTA → Scout click rate
- Secondary: Scout session → signup conversion
- Tertiary: Landing bounce rate (inversely)

**Duration**: 7 days or 1000 conversions, whichever comes first

**Decision Criteria**:
- If variant B improves primary metric by ≥10% → ship B
- Otherwise → keep A (default)

---

## Rollback Plan

If any issues arise post-launch:

1. **Immediate**: Feature flag `SHOW_PROOF_SNAPSHOT=false` to hide proof module
2. **Copy revert**: Git revert CTA/trust line changes (no behavior impact)
3. **Metrics endpoint**: Disable `/api/analytics/proof-metrics` endpoint
4. **Monitoring**: Alert if proof snapshot error rate >1%

All changes are copy-only and reversible without data loss.
