# Scout Snapshot Model — B1 Design

**Status:** Design Phase (B1)  
**Purpose:** Replace hard-coded roles with dynamic, inferred identity snapshots  
**Dependencies:** A2 (roleIntent from signup) → B1 (snapshot design) → B2 (Scout refactor)

---

## 1. Problem Statement

**Current State:**
- User identity stored as single `role` field (homeowner | contractor | admin)
- Role is static after signup
- Scout behavior gated on role alone
- No temporal decay or contextual confidence

**Desired State:**
- Identity is inferred from behavior + context
- Snapshots capture "what is this user right now?" not "what did they sign up as?"
- Scout uses snapshot confidence to shape response options
- First-session users get guided inference (D2 flow)

---

## 2. Snapshot Type Definition

```typescript
// server/types/Snapshot.ts

export interface Snapshot {
  // Identity
  userId: string;
  snapshotId: string; // UUID, unique per computation
  computedAt: Date;
  
  // Core inferred identity (replaces role field)
  primaryRole: 'homeowner' | 'contractor' | 'admin' | 'unknown';
  secondaryRoles: Array<'homeowner' | 'contractor' | 'vendor' | 'admin'>;
  
  // Confidence in inferred identity
  primaryRoleConfidence: 0.0 to 1.0;  // Low, medium, high
  secondaryRoleConfidences: Record<Role, 0.0-1.0>;
  
  // Decision confidence: "How sure is Scout about decisions for this user?"
  decisionConfidence: 'low' | 'medium' | 'high';
  
  // Signals that contributed to inference
  signals: {
    // From signup
    roleIntent?: 'homeowner' | 'contractor' | 'other';
    
    // From activity
    messagePatterns?: string[]; // e.g., "finds_contractors", "seeks_employees"
    recentActions?: string[]; // e.g., ["posted_job", "viewed_contractors"]
    pageSequence?: string[]; // e.g., ["/contractors", "/find-services"]
    
    // From profile
    verifiedBadges?: string[]; // e.g., ["verified_contractor"]
    businessProfile?: boolean;
    
    // Temporal
    activityFrequency?: 'inactive' | 'occasional' | 'active';
    accountAge?: number; // days
  };
  
  // Decay & update rules
  validUntil: Date;      // After this, recompute snapshot
  confidenceDecayRate: number; // 0.05 per day
  
  // For rollout control (B1/B2 transition)
  version: string; // "1.0"
  experimental?: boolean;
  
  // Metadata
  tags?: string[]; // "first_session", "verified", "active"
}
```

---

## 3. Inference Rules (B1 Logic)

### 3.1 Role Inference Scoring

```typescript
// server/services/snapshotService.ts

export async function inferSnapshot(userId: string, context?: {
  message?: string;
  recentActivity?: Activity[];
  pageSequence?: string[];
  profile?: UserProfile;
}): Promise<Snapshot> {
  // Score each role based on signals
  const scores = {
    homeowner: 0,
    contractor: 0,
    admin: 0,
    vendor: 0,
  };
  
  // Signal: signup roleIntent (highest weight: 0.4)
  if (context?.profile?.roleIntent === 'homeowner') scores.homeowner += 0.4;
  if (context?.profile?.roleIntent === 'contractor') scores.contractor += 0.4;
  
  // Signal: message patterns (weight: 0.2)
  if (context?.message?.match(/\b(find|hire|need)\s+(contractor|plumber|roofer)/i)) {
    scores.homeowner += 0.15;
  }
  if (context?.message?.match(/\b(offer|provide|do)\s+(work|services|job)/i)) {
    scores.contractor += 0.15;
  }
  
  // Signal: recent actions (weight: 0.2)
  const actionsStr = (context?.recentActivity ?? [])
    .map(a => a.type)
    .join(',')
    .toLowerCase();
  if (actionsStr.includes('viewed_contractors')) scores.homeowner += 0.1;
  if (actionsStr.includes('posted_job')) scores.contractor += 0.1;
  
  // Signal: page sequence (weight: 0.1)
  if (context?.pageSequence?.some(p => p.includes('find-contractors'))) {
    scores.homeowner += 0.05;
  }
  if (context?.pageSequence?.some(p => p.includes('offer-services'))) {
    scores.contractor += 0.05;
  }
  
  // Signal: verified badges (weight: 0.1)
  if (context?.profile?.verifiedBadges?.some(b => b.includes('contractor'))) {
    scores.contractor += 0.1;
  }
  
  // Normalize to 1.0
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const normalized = totalScore > 0
    ? Object.entries(scores).reduce((acc, [role, score]) => ({
        ...acc,
        [role]: score / totalScore,
      }), {})
    : { homeowner: 0.5, contractor: 0.25, admin: 0.25 };
  
  // Determine primary role (highest score)
  const primaryRole = Object.entries(normalized)
    .sort(([, a], [, b]) => b - a)[0][0];
  
  // Confidence mapping
  const maxScore = Object.values(normalized).reduce((a, b) => Math.max(a, b), 0);
  const decisionConfidence = maxScore > 0.6 ? 'high' : maxScore > 0.4 ? 'medium' : 'low';
  
  return {
    userId,
    snapshotId: `snap_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    computedAt: new Date(),
    primaryRole: primaryRole as any,
    secondaryRoles: Object.entries(normalized)
      .filter(([, score]) => score > 0.15)
      .map(([role]) => role as any),
    primaryRoleConfidence: normalized[primaryRole],
    secondaryRoleConfidences: normalized,
    decisionConfidence,
    signals: {
      roleIntent: context?.profile?.roleIntent,
      messagePatterns: extractPatterns(context?.message),
      recentActions: context?.recentActivity?.map(a => a.type),
      pageSequence: context?.pageSequence,
      verifiedBadges: context?.profile?.verifiedBadges,
      accountAge: daysActive(userId),
    },
    validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    confidenceDecayRate: 0.05,
    version: '1.0',
    tags: tagSnapshot(primaryRole, context?.profile),
  };
}
```

### 3.2 Decay & Refresh Rules

```typescript
// After 7 days: recompute snapshot
// Each day: apply confidence decay (0.05 per day)
// On high-signal activity: immediate refresh (verified contractor badge, job posted, etc.)

export function shouldRefreshSnapshot(snapshot: Snapshot): boolean {
  const now = new Date();
  
  // Always refresh if expired
  if (now > snapshot.validUntil) return true;
  
  // Refresh if confidence decayed below threshold
  const ageInDays = (now.getTime() - snapshot.computedAt.getTime()) / (1000 * 60 * 60 * 24);
  const decayedConfidence = snapshot.primaryRoleConfidence - (ageInDays * snapshot.confidenceDecayRate);
  if (decayedConfidence < 0.3) return true;
  
  return false;
}
```

---

## 4. Snapshot Storage

### 4.1 Database Schema

```sql
-- Add to drizzle schema
CREATE TABLE snapshots (
  id: string PK,
  userId: string FK,
  snapshotId: string UNIQUE,
  computedAt: timestamp,
  primaryRole: enum('homeowner', 'contractor', 'admin', 'unknown'),
  secondaryRoles: json, -- ["contractor", "vendor"]
  primaryRoleConfidence: real, -- 0.0-1.0
  secondaryRoleConfidences: json, -- { homeowner: 0.5, contractor: 0.8 }
  decisionConfidence: enum('low', 'medium', 'high'),
  signals: json, -- { roleIntent, messagePatterns, ... }
  validUntil: timestamp,
  version: string,
  tags: json, -- ["first_session", "verified"]
  createdAt: timestamp,
  
  UNIQUE(userId, snapshotId),
  FOREIGN KEY(userId) REFERENCES users(id)
);

CREATE INDEX idx_snapshots_user_validity ON snapshots(userId, validUntil);
```

### 4.2 Cache Layer

```typescript
// In-memory cache (Redis alternative for production)
const snapshotCache = new Map<string, Snapshot>();

export async function getOrComputeSnapshot(userId: string): Promise<Snapshot> {
  // Check cache first (1-hour TTL in memory)
  const cached = snapshotCache.get(userId);
  if (cached && !shouldRefreshSnapshot(cached)) {
    return cached;
  }
  
  // Check DB (7-day TTL)
  const dbSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.userId, userId),
    orderBy: desc(snapshots.computedAt),
  });
  
  if (dbSnapshot && !shouldRefreshSnapshot(dbSnapshot)) {
    snapshotCache.set(userId, dbSnapshot);
    return dbSnapshot;
  }
  
  // Compute new snapshot
  const profile = await storage.getUser(userId);
  const activity = await storage.getUserActivity(userId, { limit: 50, days: 30 });
  const pageSequence = await storage.getUserPageSequence(userId, { limit: 20 });
  
  const newSnapshot = await inferSnapshot(userId, {
    profile,
    recentActivity: activity,
    pageSequence,
  });
  
  // Persist and cache
  await db.insert(snapshots).values(newSnapshot);
  snapshotCache.set(userId, newSnapshot);
  
  return newSnapshot;
}
```

---

## 5. First-Session Snapshot (A2→B1 Bridge)

When user completes A2 signup with `roleIntent`, bootstrap initial snapshot:

```typescript
// In /api/auth/register success handler
async function bootstrapSnapshotFromSignup(userId: string, roleIntent: string) {
  const snapshot = await inferSnapshot(userId, {
    profile: {
      roleIntent: roleIntent as any,
      verifiedBadges: [], // No badges yet
    },
  });
  
  // Tag as first-session
  snapshot.tags = ['first_session', 'signup_intent'];
  snapshot.decisionConfidence = 'medium'; // Low→medium, enough to route but allow refinement
  
  // Very short validity: 1 day (D2 will refine during onboarding=true)
  snapshot.validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await db.insert(snapshots).values(snapshot);
  return snapshot;
}
```

---

## 6. Scout Integration Points (B2 Preview)

These will be replaced in B2, but document here for design validation:

### Before (Current)
```typescript
const userRole = user?.role; // "contractor" | "homeowner"
if (userRole === 'contractor') {
  // show contractor-specific actions
}
```

### After (B2)
```typescript
const snapshot = await getOrComputeSnapshot(userId);
if (snapshot.primaryRoleConfidence > 0.6 && snapshot.primaryRole === 'contractor') {
  // show contractor-specific actions
} else if (snapshot.decisionConfidence === 'low') {
  // show multi-role options instead of assuming
}
```

---

## 7. Rollout Plan (B1→B2)

**B1 (Current Phase):**
- ✅ Define Snapshot type
- ✅ Implement inference rules (message, activity, profile signals)
- ✅ Add DB schema + cache layer
- ✅ Bootstrap on signup (A2→B1 bridge)
- ✅ Document Scout integration points

**B2 (Next Phase):**
- Replace all `user.role` with `snapshot.primaryRole` in Scout
- Update governor decision logic to use `snapshot.decisionConfidence`
- Add "refine identity" flow for low-confidence snapshots
- Update action shaping to use snapshot.secondaryRoles for alt options

**Validation (B1 Complete Criteria):**
- ✅ Snapshot computed for all new signups
- ✅ Snapshot refreshes when user verifies badge
- ✅ Snapshot persists across sessions
- ✅ Decay confidence correctly over time
- ✅ B2 can access snapshot without schema changes

---

## 8. Edge Cases & Guardrails

**Admin users:**
- Admin flag should survive snapshot (never infer away)
- If user.isAdmin = true, always include 'admin' in secondaryRoles

**Unverified contractors:**
- Lower confidence (0.3-0.5) until badge verified
- Scout shows "Help us verify" CTA

**Multi-role users:**
- primaryRole = highest confidence
- secondaryRoles = others > 0.15 confidence
- Scout action selection respects both

**Low-confidence users (< 0.3):**
- Scout asks clarifying question on first onboarding=true load
- Snapshot recomputed immediately after answer

---

## 9. Success Metrics (For B2 Validation)

- Snapshot accuracy: % of inferred roles match actual user behavior (tracked via D1 first-session refinement)
- Confidence calibration: high-confidence snapshots yield better outcomes
- Adoption: % of Scout decisions using snapshot vs. hard-coded role
- Decay effectiveness: confidence properly degrades without manual intervention
