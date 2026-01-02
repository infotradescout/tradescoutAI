# 🧱 Phase 3e-B Pre-Work Checklist (Parallel Prep)

**Objective:** Remove future blockers without shipping features.

**Scope:** Structural prep only—no UI rollout, no feature exposure, fully reversible.

**Timeline:** Days 2–8 of bake window (parallel with telemetry validation)  
**Owner:** Backend / Data / Frontend Architects  
**Gate:** ✅ "Phase 3e-B can start immediately after Day-7 bake review" sign-off

---

## Overview: What 3e-B Actually Does

**Phase 3e-B: Multi-Profile Ownership**

Users can own multiple business profiles and switch between them.

Current state (locked):
- Model: `activeProfileId` in session/store, routing logic in backend, access guards
- Data: Single profile per user (hard requirement now, will change in 3e-B)
- UX: All editors assume profile from URL slug

What we're prepping (not shipping):
- Migration: Script to map current users → primary profile
- Wiring: Add `activeProfileId` resolution in existing flows
- Guards: Enforce "active profile owns this resource" in API routes
- Spec: Switcher UI (mocked only, no exposure)

---

## Track B-1: Profile Context Wiring (Backend/Frontend)

### Task B-1a: Add `activeProfileId` to Session/Auth Context

**Current State:**
```typescript
// server/middleware/auth.ts
interface AuthedRequest {
  user: User;
  // No activeProfileId
}
```

**Work:**
- [ ] Extend `AuthedRequest` interface:
  ```typescript
  interface AuthedRequest {
    user: User;
    activeProfileId?: string; // Profile owner is editing
  }
  ```
- [ ] In auth middleware, resolve `activeProfileId`:
  - From query param: `?profile=<slug>`
  - From session storage: `req.session.activeProfileId`
  - Default to user's primary profile (via DB query)
  
- [ ] Add guard: If `activeProfileId` is set, verify user owns that profile:
  ```typescript
  const profile = await db.businessProfile.findOne({ 
    id: activeProfileId, 
    userId: req.user.id 
  });
  if (!profile) return res.status(403).json({ message: 'Profile not owned by user' });
  ```

**Owner:** Backend  
**Time:** 4–6 hours  
**Reversible?** YES — adds optional field, doesn't change current logic

**Sign-off:** [ ] `activeProfileId` resolves in auth middleware without errors

---

### Task B-1b: Update Business Profile Routes (Read-Only Access Guard)

**Current State:**
```typescript
// server/routes/business-profile.ts
app.get('/api/business-profile/:slug', async (req, res) => {
  const profile = await db.businessProfile.findOne({ slug: req.params.slug });
  // No ownership check
});
```

**Work:**
- [ ] Add ownership check in all routes that modify profile:
  ```typescript
  app.patch('/api/business-profile/:id', isAuthenticated, async (req, res) => {
    const profile = await db.businessProfile.findOne({ id: req.params.id });
    
    // Guard: User must own profile
    if (profile.userId !== req.user.id) {
      return res.status(403).json({ message: 'You do not own this profile' });
    }
    
    // Existing update logic
  });
  ```

- [ ] Mark all owner-write routes:
  - `PATCH /api/business-profile/:id` (edit)
  - `POST /api/scout/copy-assist` (requires active profile)
  - Any future endpoints

- [ ] Keep read-only routes (public view) unguarded:
  - `GET /api/business-profile/:slug` (public view)

**Owner:** Backend  
**Time:** 2–3 hours  
**Reversible?** YES — just adding guards, doesn't change what data is accessed

**Sign-off:** [ ] All write routes check ownership; public reads still work

---

### Task B-1c: Update BusinessProfileEditor Frontend (Profile ID Awareness)

**Current State:**
```tsx
// client/src/pages/BusinessProfileEditor.tsx
const router = useRouter();
const { slug } = router.query;

useEffect(() => {
  const response = await fetch(`/api/business-profile/${slug}`);
  setProfile(response.data);
}, [slug]);
```

**Work:**
- [ ] Extract profile `id` from response, pass to telemetry:
  ```tsx
  useEffect(() => {
    const response = await fetch(`/api/business-profile/${slug}`);
    const profile = response.data;
    setProfile(profile);
    
    // Store for multi-profile later
    sessionStorage.setItem('activeProfileId', profile.id);
  }, [slug]);
  ```

- [ ] Update scoutCopyAssist tool to include profileId:
  ```typescript
  // client/src/agent/tools/scoutCopyAssist.ts
  const res = await fetch("/api/scout/copy-assist", {
    body: JSON.stringify({
      field,
      businessName,
      profileId: profile.id, // Add this
      // ...
    })
  });
  ```

- [ ] Backend verifies profileId matches activeProfileId:
  ```typescript
  // server/routes/business-profile.ts POST /api/scout/copy-assist
  if (req.body.profileId !== req.user.activeProfileId) {
    return res.status(403).json({ message: 'Profile mismatch' });
  }
  ```

**Owner:** Frontend + Backend  
**Time:** 3–4 hours  
**Reversible?** YES — adds optional param, doesn't break existing flow

**Sign-off:** [ ] ProfileEditor passes profile.id; backend verifies ownership

---

## Track B-2: Data Migration Planning (No Execute)

### Task B-2a: Profile Ownership Migration Script (Spec Only)

**Current State:**
```
users table: 1-to-1 with business_profiles
No profile_id in users (implied)
```

**Problem:** Once we add multi-profile, we need to know which profile is "primary"

**Work (Spec Only, DO NOT RUN):**

1. [ ] Audit current data:
   ```sql
   SELECT 
     COUNT(*) as user_count,
     COUNT(DISTINCT user_id) as with_profiles,
     COUNT(CASE WHEN user_id IS NULL THEN 1 END) as orphaned
   FROM business_profiles;
   ```

2. [ ] Create rollback script (before any writes):
   ```sql
   -- ROLLBACK: Save original state
   CREATE TABLE business_profiles_backup_DATE AS
   SELECT * FROM business_profiles;
   ```

3. [ ] Spec the migration (don't execute):
   ```sql
   -- MIGRATION (pseudo-code, test on staging first)
   
   -- Step 1: Add primary_profile_id to users (nullable)
   ALTER TABLE users ADD COLUMN primary_profile_id UUID;
   
   -- Step 2: Set primary = oldest profile per user
   UPDATE users u
   SET primary_profile_id = (
     SELECT id FROM business_profiles bp
     WHERE bp.user_id = u.id
     ORDER BY bp.created_at ASC
     LIMIT 1
   );
   
   -- Step 3: Verify all users have primary (should be 100%)
   SELECT COUNT(*) as users_without_primary
   FROM users WHERE primary_profile_id IS NULL;
   
   -- Step 4: Mark as NOT NULL
   ALTER TABLE users 
   MODIFY COLUMN primary_profile_id UUID NOT NULL;
   ```

4. [ ] Test on staging database:
   - Run migration script
   - Verify all users have exactly 1 primary profile
   - Test that BusinessProfileEditor still loads (queries primary profile)
   - Rollback and repeat until clean

**Owner:** Data / DBAs  
**Time:** 4–8 hours (testing on staging)  
**Reversible?** YES — only spec, no production changes yet

**Sign-off:** [ ] Migration script spec'd, tested on staging, approved by DBA

---

### Task B-2b: Access Rules Spec (Enforcement Plan)

**Current State:**
```
No explicit access control
Assumes URL slug uniqueness = access boundary
```

**Problem:** Multi-profile needs explicit "user X owns profile Y"

**Work (Spec Only):**

[ ] Document access rules:

```
Rule 1: Profile Read (Public View)
- Anyone can GET /api/business-profile/:slug
- Return all public fields (name, headline, description, services, etc.)

Rule 2: Profile Edit (Owner Only)
- User A can PATCH /api/business-profile/:id only if:
  - User A is authenticated (req.user.id)
  - User A owns profile (profile.user_id === req.user.id)
  - activeProfileId is set to profile.id (or primary)
- Reject with 403 if ownership fails

Rule 3: Copy Assist (Active Profile Only)
- User A can POST /api/scout/copy-assist only if:
  - User A owns the profile (by ID in request body)
  - activeProfileId matches profile.id
  - Profile business name is set
- Reject with 403 if mismatch

Rule 4: Admin Override (Future)
- Admins can view/edit any profile
- Added in Phase 3f (not yet)
```

[ ] Identify existing routes that need guards:
  - `PATCH /api/business-profile/:id` ← needs guard
  - `POST /api/scout/copy-assist` ← needs guard
  - `POST /api/business-profile/:id/publish` ← needs guard
  - Any future routes

[ ] Implementation checklist (for Phase 3e-B build):
  ```typescript
  // Template for all owner-write routes
  const ownerGuard = (req: AuthedRequest, res: Response) => {
    const profileId = req.params.id || req.body.profileId;
    if (!profileId) return res.status(400).json({ message: 'Profile ID required' });
    
    // Verify ownership
    const profile = await db.businessProfile.findOne({ id: profileId });
    if (!profile || profile.userId !== req.user.id) {
      return res.status(403).json({ message: 'Profile not owned by user' });
    }
    
    // Guard passed, continue
    return null;
  };
  
  // Usage in routes
  app.patch('/api/business-profile/:id', isAuthenticated, async (req, res) => {
    const guardError = ownerGuard(req, res);
    if (guardError) return;
    // ... rest of logic
  });
  ```

**Owner:** Backend / Security  
**Time:** 2–3 hours  
**Reversible?** YES — spec only, no code changes yet

**Sign-off:** [ ] Access rules documented and approved by backend lead

---

## Track B-3: Switcher UX Spec (Non-Functional Mock)

### Task B-3a: Switcher UI Design (Figma Spec Only)

**Current State:**
```
No profile switcher exists
All users have 1 profile (implicit)
```

**What We're Speccing (Not Building):**

A profile switcher would allow users to choose their active profile. Example:

```
[My Profile ▼]
  ├─ Dallas Plumbing (active)
  ├─ Austin HVAC
  └─ + New Profile
```

**Work (Design Only):**

[ ] Create Figma spec for profile switcher:
  - Location: Sidebar or top-right menu?
  - Trigger: Dropdown on profile name?
  - Behavior: Clicking profile → reload page with ?profile=<id>
  - Edge case: What if user has 1 profile? Hide switcher.

[ ] Document state machine:
  - Active state: Current profile (bold/highlighted)
  - Inactive state: Other profiles (muted)
  - Loading: Show spinner while switching
  - Error: Show toast if switch fails

[ ] NO CODE — Figma/spec document only

**Owner:** Design / Frontend Architect  
**Time:** 2–3 hours  
**Reversible?** YES — spec only, zero code

**Sign-off:** [ ] Switcher spec in Figma, reviewed and approved

---

### Task B-3b: Switcher Implementation Plan (Do NOT Build Yet)

**When Phase 3e-B Ships (After Day-7):**

[ ] Checklist for actual build:
  1. [ ] Add profile switcher component
  2. [ ] Add `/api/user/profiles` endpoint (list all user's profiles)
  3. [ ] Update router: detect `?profile=<id>` param, set activeProfileId
  4. [ ] Update session: store activeProfileId in localStorage/session
  5. [ ] Test: switch between profiles, verify all editors work

**Owner:** Frontend  
**Time (not now):** 4–6 hours  
**When:** After bake ends, after Day-7 go/no-go decision

**Sign-off:** [ ] Implementation checklist prepared, linked to Phase 3e-B PRD

---

## Track B-4: Data Consistency Checks

### Task B-4a: Audit Current Profile Data

**Work:**

```sql
-- Check for data anomalies that could block multi-profile

-- Q1: Any users with >1 profile? (Should be 0)
SELECT user_id, COUNT(*) as profile_count
FROM business_profiles
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Q2: Any orphaned profiles (user_id doesn't exist)?
SELECT bp.id, bp.user_id
FROM business_profiles bp
LEFT JOIN users u ON bp.user_id = u.id
WHERE u.id IS NULL;

-- Q3: Profiles with null user_id?
SELECT COUNT(*) as null_user_profiles
FROM business_profiles
WHERE user_id IS NULL;

-- Q4: Most profiles per user (identify power users)?
SELECT user_id, COUNT(*) as profile_count
FROM business_profiles
GROUP BY user_id
ORDER BY profile_count DESC
LIMIT 10;
```

[ ] Run queries, document results in DATA_AUDIT_PHASE_3E_B.md

[ ] If anomalies found:
  - [ ] Create cleanup script (test on staging first)
  - [ ] Document rollback plan
  - [ ] Schedule production cleanup before Phase 3e-B ships

**Owner:** Data  
**Time:** 2–3 hours  
**Reversible?** YES — read-only audit

**Sign-off:** [ ] Data audit complete, anomalies (if any) documented

---

## Pre-Work Completion Checklist

**By EOD Day-8 (before Day-7 bake review), ALL must be ✅:**

```
WIRING
✅ B-1a: activeProfileId in auth middleware
✅ B-1b: Ownership guards on write routes
✅ B-1c: BusinessProfileEditor passes profile.id

MIGRATION
✅ B-2a: Migration script spec'd + tested on staging
✅ B-2b: Access rules documented

UX/DESIGN
✅ B-3a: Switcher UI spec in Figma
✅ B-3b: Implementation checklist prepared

DATA
✅ B-4a: Current profile data audited

All tasks are reversible and have zero customer impact.
Phase 3e-B can launch immediately after Day-7 bake decision.
```

**Final Sign-Off:**
```
✅ All pre-work tasks complete and reviewed
✅ No blocker found for Phase 3e-B ship
✅ Ready to build multi-profile on Day 8+

Approved By: _______________
Date: _______________
```

---

## Key Rules (DO NOT VIOLATE)

### ❌ NOT Allowed During Pre-Work

- No UI changes visible to users
- No data migrations against production
- No feature rollout or flags
- No changes to current profile flow
- No multi-profile creation enabled

### ✅ Allowed During Pre-Work

- Backend wiring (middleware, guards)
- Data specs and migration scripts (staged, not executed)
- Frontend code prep (but behind feature flag or in separate branch)
- Design/UX specs (non-binding)
- Audit queries (read-only)

### 🔄 Will Execute in Phase 3e-B Build

- Migration script (production, with rollback)
- Profile switcher UI (staged rollout)
- activeProfileId enforcement (with pilot testing)
- New `/api/user/profiles` endpoint
- Session management updates

---

## Communication

**To Product/Thomas:**
> "Phase 3e-B pre-work is structural prep only. No user-facing changes. All work is reversible. We're removing blockers so Phase 3e-B can ship fast once bake ends."

**To Engineering:**
> "These tasks are independent. Can parallelize B-1 (wiring), B-2 (migration spec), B-3 (UX), B-4 (audit). No merge conflicts expected. All tasks are read-only or behind feature flags."

**To QA:**
> "Nothing to test yet. Pre-work is code prep. Testing begins when Phase 3e-B PRD ships (Day 8+)."

