# 🚀 Phase 3e-B Build Kickoff Checklist (Post-Bake)

**Purpose:** Execute immediately after Day-7 go/no-go decision (if "Proceed to 3e-B").

**Owner:** Engineering Lead  
**Prerequisite:** ✅ Day-7 review passes gates (headline ≥35%, services ≥25%, publish ≥60%)  
**Duration:** 8–10 days  
**Outcome:** Multi-Profile Ownership ships, ready for customer rollout

---

## Pre-Kickoff (Day-8 Morning, 1 hour)

### Checklist: Ready to Build?

- [ ] **Day-7 decision approved by Thomas**
  - Email subject: "Phase 3e-B: GO decision + data summary"
  - Include: headline acceptance rate, services rate, publish delta, recommendation

- [ ] **All pre-work tasks signed off**
  - [ ] B-1: activeProfileId wiring complete (feature-flagged)
  - [ ] B-2: Migration script spec'd and staged
  - [ ] B-3: Switcher UX spec in Figma (ready for dev)
  - [ ] B-4: Data audit clean (no blocking anomalies)

- [ ] **Build environment ready**
  - [ ] New feature branch: `feature/phase-3e-b-multi-profile`
  - [ ] Feature flag created: `FEATURE_MULTI_PROFILE_OWNERSHIP` (default: false)
  - [ ] Pull staging migration onto staging database (dry-run complete)

- [ ] **Communication sent**
  - [ ] Slack: #engineering → "Phase 3e-B build starts today"
  - [ ] Jira: Create epic `[Phase 3e-B] Multi-Profile Ownership` with subtasks
  - [ ] Pilot user (traderscornerllc@gmail.com) notified: "You'll be first to test"

---

## Phase 3e-B Build Workstreams (Parallel)

### Workstream 1: Backend Migration & Access Guards (Owner: Backend Lead)

**Duration:** 3–4 days | **Effort:** 32 hours | **Status:** Blockers Phase 2

#### 1.1: Production Migration (Data)

**What:** Add `primary_profile_id` to users table, backfill existing users

**Steps:**

1. [ ] **Create migration script** (execute on staging first):
   ```sql
   -- File: migrations/2026-01-08-add-multi-profile-support.sql
   
   -- Step 1: Add column (nullable)
   ALTER TABLE users ADD COLUMN primary_profile_id UUID;
   
   -- Step 2: Index for performance
   CREATE INDEX idx_users_primary_profile ON users(primary_profile_id);
   
   -- Step 3: Backfill (oldest profile per user = primary)
   UPDATE users u
   SET primary_profile_id = (
     SELECT id FROM business_profiles bp
     WHERE bp.user_id = u.id
     ORDER BY bp.created_at ASC
     LIMIT 1
   )
   WHERE primary_profile_id IS NULL;
   
   -- Step 4: Verify (should be 100%)
   SELECT COUNT(*) as users_without_primary
   FROM users WHERE primary_profile_id IS NULL;
   ```

2. [ ] **Dry-run on staging**:
   - Run migration script
   - Verify all users have primary_profile_id
   - Test that existing editors still load (via primary profile)
   - Rollback and repeat until clean
   - Document execution time (expect <5 min for current scale)

3. [ ] **Create rollback script** (in case prod fails):
   ```sql
   -- Rollback (if migration fails in production)
   ALTER TABLE users DROP COLUMN primary_profile_id;
   DROP INDEX idx_users_primary_profile;
   ```

4. [ ] **Schedule production migration**:
   - Day: Low-traffic window (e.g., Sunday 2am)
   - Owner: DBA
   - Rollback: Same DBA on standby
   - Duration: ~10 min (including verification)
   - Notification: Post migration to #engineering-ops

5. [ ] **Post-migration verification**:
   ```sql
   SELECT COUNT(*) as total_users,
          COUNT(CASE WHEN primary_profile_id IS NOT NULL THEN 1 END) as with_primary,
          COUNT(CASE WHEN primary_profile_id IS NULL THEN 1 END) as without_primary
   FROM users;
   
   -- Expected: without_primary = 0
   ```

**Sign-off:** [ ] Migration executed successfully on production + all users have primary_profile_id

---

#### 1.2: Backend Routes (Access Guards)

**What:** Enforce "user owns profile" on all write endpoints

**Endpoints to guard:**
- `PATCH /api/business-profile/:id` (edit)
- `POST /api/scout/copy-assist` (requires active profile)
- `POST /api/business-profile/:id/publish` (publish)
- `DELETE /api/business-profile/:id` (delete, future)

**Implementation pattern** (for each endpoint):

1. [ ] Add ownership guard function:
   ```typescript
   // server/middleware/profileOwnershipGuard.ts
   
   export async function profileOwnershipGuard(
     req: AuthedRequest,
     profileId: string
   ): Promise<{isOwner: boolean; profile?: BusinessProfile; error?: string}> {
     const profile = await db.businessProfile.findOne({ id: profileId });
     
     if (!profile) {
       return { isOwner: false, error: 'Profile not found' };
     }
     
     if (profile.userId !== req.user.id) {
       return { isOwner: false, error: 'Profile not owned by user' };
     }
     
     return { isOwner: true, profile };
   }
   ```

2. [ ] Apply to PATCH endpoint:
   ```typescript
   app.patch('/api/business-profile/:id', isAuthenticated, async (req, res) => {
     const guardResult = await profileOwnershipGuard(req, req.params.id);
     if (!guardResult.isOwner) {
       return res.status(403).json({ message: guardResult.error });
     }
     
     // Existing update logic
   });
   ```

3. [ ] Apply to POST /api/scout/copy-assist:
   ```typescript
   app.post('/api/scout/copy-assist', isAuthenticated, async (req, res) => {
     const profileId = req.body.profileId || req.user.primary_profile_id;
     const guardResult = await profileOwnershipGuard(req, profileId);
     if (!guardResult.isOwner) {
       return res.status(403).json({ message: guardResult.error });
     }
     
     // Existing Scout logic
   });
   ```

4. [ ] Test all guarded endpoints:
   - [ ] User A can edit own profile (should pass)
   - [ ] User A cannot edit User B's profile (should 403)
   - [ ] Public reads still work (no guard needed)

**Sign-off:** [ ] All write endpoints enforce ownership; tests pass

---

#### 1.3: New API Endpoint: `GET /api/user/profiles`

**What:** List all profiles owned by authenticated user

**Endpoint spec:**
```
GET /api/user/profiles
Authentication: Required (JWT)
Response:
{
  "profiles": [
    {
      "id": "uuid-1",
      "slug": "dallas-plumbing",
      "name": "Dallas Plumbing",
      "headline": "Licensed HVAC Services in Dallas County",
      "isPrimary": true,
      "createdAt": "2025-11-01T00:00:00Z"
    },
    {
      "id": "uuid-2",
      "slug": "austin-hvac",
      "name": "Austin HVAC",
      "headline": "Professional AC Repair & Installation",
      "isPrimary": false,
      "createdAt": "2025-12-15T00:00:00Z"
    }
  ]
}
```

**Implementation:**
```typescript
app.get('/api/user/profiles', isAuthenticated, async (req, res) => {
  const profiles = await db.businessProfile.find({ userId: req.user.id });
  const primaryId = req.user.primary_profile_id;
  
  res.json({
    profiles: profiles.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      headline: p.headline || null,
      isPrimary: p.id === primaryId,
      createdAt: p.createdAt,
    })),
  });
});
```

**Test:**
- [ ] User with 1 profile sees 1 result
- [ ] User with 2 profiles sees 2 results
- [ ] `isPrimary` correctly identifies primary
- [ ] Unauthenticated request returns 401

**Sign-off:** [ ] Endpoint returns correct profile list + `isPrimary` flag

---

### Workstream 2: Frontend Switcher UI & Routing (Owner: Frontend Lead)

**Duration:** 3–4 days | **Effort:** 32 hours | **Blockers:** Workstream 1.3 (GET /api/user/profiles)

#### 2.1: Profile Switcher Component

**What:** Dropdown showing all user's profiles, allows switching

**Location:** Sidebar or top-right menu (from Figma spec)

**Component design** (React + Shadcn):

```typescript
// client/src/components/ProfileSwitcher.tsx

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface Profile {
  id: string;
  slug: string;
  name: string;
  isPrimary: boolean;
}

export function ProfileSwitcher() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch user's profiles
    fetch('/api/user/profiles')
      .then(res => res.json())
      .then(data => {
        setProfiles(data.profiles);
        // Set active from URL or primary
        const fromUrl = router.query.profile as string;
        setActiveProfile(
          data.profiles.find((p: Profile) => p.slug === fromUrl || p.isPrimary)
        );
      })
      .finally(() => setIsLoading(false));
  }, [router.query]);

  const handleSwitchProfile = (slug: string) => {
    // Navigate to same page with new profile
    router.push({
      pathname: router.pathname,
      query: { ...router.query, profile: slug },
    });
  };

  if (isLoading || !activeProfile) return <div>Loading...</div>;
  
  // If only 1 profile, hide switcher
  if (profiles.length === 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          {activeProfile.name}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {profiles.map(profile => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => handleSwitchProfile(profile.slug)}
            className={activeProfile.id === profile.id ? 'bg-accent' : ''}
          >
            {profile.name}
            {profile.isPrimary && <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Placement:**
- Add to sidebar: `client/src/components/Sidebar.tsx`
- Or top-right: `client/src/components/Navbar.tsx`

**Tests:**
- [ ] Single profile: switcher hidden
- [ ] Multiple profiles: all profiles visible
- [ ] Click profile: navigate to ?profile=<slug>
- [ ] Primary marked with badge
- [ ] Loading state shows spinner

**Sign-off:** [ ] Switcher renders correctly, switching works

---

#### 2.2: Router Enhancement: Detect `?profile=` Param

**What:** When user visits with `?profile=<slug>`, load that profile instead of default

**Current behavior:**
```typescript
// client/src/pages/BusinessProfileEditor.tsx
const { slug } = router.query;
// Always loads profile by slug
```

**New behavior:**
```typescript
// client/src/pages/BusinessProfileEditor.tsx
const { slug, profile } = router.query;

// If ?profile=<slug> is present, use that; else use URL slug
const profileSlugToLoad = profile || slug;

useEffect(() => {
  const response = await fetch(`/api/business-profile/${profileSlugToLoad}`);
  const profileData = response.data;
  setProfile(profileData);
  
  // Store active profile for multi-profile context
  sessionStorage.setItem('activeProfileId', profileData.id);
  sessionStorage.setItem('activeProfileSlug', profileData.slug);
}, [profileSlugToLoad]);
```

**Impact:**
- All editors (BusinessProfileEditor, PublicProfileView, etc.) now respect ?profile param
- If ?profile is missing, default to primary profile (backend returns)
- Backward compatible: old URLs still work (load by slug)

**Tests:**
- [ ] `/business/dallas-plumbing` loads Dallas Plumbing (default)
- [ ] `/business/dallas-plumbing?profile=austin-hvac` loads Austin HVAC (override)
- [ ] Switching profiles via switcher updates ?profile param

**Sign-off:** [ ] Router correctly resolves ?profile param for all editors

---

#### 2.3: Update BusinessProfileEditor (Multi-Profile Context)

**What:** BusinessProfileEditor now supports editing any user-owned profile

**Current state:**
```typescript
// Assumes single profile per user
```

**Changes:**
- [ ] Pass profileId to all API calls (already done in pre-work):
  ```typescript
  const res = await fetch(`/api/scout/copy-assist`, {
    body: JSON.stringify({
      field,
      profileId: profile.id,  // Include this
      // ...
    })
  });
  ```

- [ ] Backend verifies ownership (already guarded in Workstream 1.2)

- [ ] No UI changes needed (profile selection via switcher)

**Tests:**
- [ ] User with Profile A can edit Profile A
- [ ] User with Profile A + B switches to B, edits B
- [ ] Copy Assist applies to correct profile

**Sign-off:** [ ] Multi-profile editing works end-to-end

---

### Workstream 3: Session & Storage (Owner: Frontend/DevOps)

**Duration:** 2 days | **Effort:** 16 hours

#### 3.1: Session Persistence of activeProfileId

**What:** Remember which profile user is currently editing

**Implementation:**

Backend session (server-side):
```typescript
// server/middleware/auth.ts
interface AuthedRequest {
  user: User;
  activeProfileId: string; // Resolved per request
}

// In auth middleware:
// 1. Get from URL query param: ?profile=<id>
// 2. Fall back to session storage: req.session.activeProfileId
// 3. Fall back to user's primary profile
const profileParam = req.query.profile as string;
const storedProfileId = req.session.activeProfileId;
const primaryProfileId = req.user.primary_profile_id;

req.activeProfileId = profileParam || storedProfileId || primaryProfileId;
```

Frontend session (localStorage):
```typescript
// client/src/utils/sessionStorage.ts

export function setActiveProfile(profileId: string, profileSlug: string) {
  sessionStorage.setItem('activeProfileId', profileId);
  sessionStorage.setItem('activeProfileSlug', profileSlug);
}

export function getActiveProfile() {
  return {
    id: sessionStorage.getItem('activeProfileId') || '',
    slug: sessionStorage.getItem('activeProfileSlug') || '',
  };
}

export function clearActiveProfile() {
  sessionStorage.removeItem('activeProfileId');
  sessionStorage.removeItem('activeProfileSlug');
}
```

**Usage in BusinessProfileEditor:**
```typescript
useEffect(() => {
  const { slug, profile: profileParam } = router.query;
  const profileSlug = profileParam || slug;
  
  if (profileSlug) {
    const response = await fetch(`/api/business-profile/${profileSlug}`);
    const profileData = response.data;
    setProfile(profileData);
    
    // Store active profile
    setActiveProfile(profileData.id, profileData.slug);
  }
}, [router.query]);
```

**Test:**
- [ ] User switches profiles, page refreshes, active profile persists
- [ ] User closes tab, reopens, active profile restored

**Sign-off:** [ ] Session storage works across page reloads

---

### Workstream 4: Feature Flag & Pilot Rollout (Owner: DevOps/Product)

**Duration:** 1 day | **Effort:** 8 hours | **Depends on:** All other workstreams

#### 4.1: Feature Flag Setup

**What:** Deploy with feature disabled, gradually enable for pilot

**Implementation:**

Create flag in feature management service:
```typescript
// Flag name: FEATURE_MULTI_PROFILE_OWNERSHIP
// Default: false (disabled for all)
// Rollout stages:
//   - Stage 1: Enable for pilot user (traderscornerllc@gmail.com)
//   - Stage 2: Enable for 10% of users (Day 12)
//   - Stage 3: Enable for 100% (Day 15)
```

Code usage:
```typescript
// client/src/pages/BusinessProfileEditor.tsx

import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export function BusinessProfileEditor() {
  const isMultiProfileEnabled = useFeatureFlag('FEATURE_MULTI_PROFILE_OWNERSHIP');
  
  // If disabled, hide switcher + disable routing logic
  // User experience unchanged (single profile flow)
}
```

**Test:**
- [ ] Flag disabled: Switcher hidden, old routing works
- [ ] Flag enabled for pilot: Switcher visible, multi-profile works
- [ ] Flag enabled for all: Full rollout

**Sign-off:** [ ] Flag correctly gates feature

---

#### 4.2: Pilot Testing (Manual + QA)

**What:** Verify Phase 3e-B works before full rollout

**Pilot user:** `traderscornerllc@gmail.com` (given in copilot-instructions.md)

**Test plan** (QA + manual):

1. [ ] **Profile Switching:**
   - [ ] Pilot user has 2+ profiles (backfill test data if needed)
   - [ ] Switcher visible with all profiles listed
   - [ ] Click each profile: page loads correct profile data
   - [ ] Primary profile marked

2. [ ] **Editing Different Profiles:**
   - [ ] Edit Profile A (headline, services, description)
   - [ ] Switch to Profile B
   - [ ] Edit Profile B (different data)
   - [ ] Switch back to Profile A: data intact

3. [ ] **Copy Assist Multi-Profile:**
   - [ ] On Profile A, use Copy Assist → accepts variant
   - [ ] Switch to Profile B, use Copy Assist → accepts variant
   - [ ] Verify each profile's copy is independent

4. [ ] **Publishing:**
   - [ ] Edit Profile A, publish
   - [ ] Switch to Profile B, publish
   - [ ] Both profiles live on `/business/<slug>`

5. [ ] **Public View (No Feature Flag):**
   - [ ] Visitor can still view `/business/<profile-slug>`
   - [ ] Switcher not visible to non-owners
   - [ ] All public data correct

6. [ ] **Edge Cases:**
   - [ ] Delete Profile A while editing Profile B (should not crash)
   - [ ] Rapidly switch profiles (should handle gracefully)
   - [ ] Navigate away from editor with unsaved changes → warning

**Sign-off:** [ ] Pilot user approves all tests pass

---

### Workstream 5: QA & Regression Testing (Owner: QA Lead)

**Duration:** 2 days | **Effort:** 16 hours | **Depends on:** All workstreams complete

#### 5.1: Regression Test Suite

**Scope:** Ensure Phase 3e-A.1 (Copy Assist v1.1) still works with multi-profile

**Test cases:**

1. [ ] Single-profile users (legacy):
   - [ ] Can still use Copy Assist (description, headline, services)
   - [ ] Switcher hidden (expected)
   - [ ] All existing flows work unchanged

2. [ ] Multi-profile users:
   - [ ] Copy Assist works per profile
   - [ ] Acceptance telemetry tagged with correct profile
   - [ ] Publish flow correct

3. [ ] Public profiles (no changes expected):
   - [ ] All public reads work
   - [ ] No auth changes visible
   - [ ] SEO data correct

4. [ ] Telemetry (Workstream 1.1 signals + new profile context):
   - [ ] `scout_copy_variant_accepted` includes profileId
   - [ ] `business_profile_updated` tracks which profile was edited
   - [ ] No missing fields in events

**Test environment:**
- [ ] Staging: Test 100% of scenarios
- [ ] Production: Pilot only (feature flag limits exposure)

**Sign-off:** [ ] All regression tests pass on staging + pilot passes on production

---

## Final Integration & Ship (Day-8 Evening)

### Pre-Ship Checklist (1 hour)

**Code Quality:**
- [ ] Backend: Build passes, no TypeScript errors
- [ ] Frontend: Build passes, no console errors
- [ ] All feature flag guards in place
- [ ] No hardcoded profile IDs or slugs

**Data Integrity:**
- [ ] Migration ran successfully
- [ ] All users have `primary_profile_id`
- [ ] No orphaned profiles

**Monitoring:**
- [ ] Alerting configured for migration
- [ ] Error tracking configured for new endpoints
- [ ] Telemetry events verified (5 events firing)

**Documentation:**
- [ ] README updated: "Multi-Profile Ownership (Phase 3e-B)"
- [ ] API docs updated: new `GET /api/user/profiles` endpoint
- [ ] Known issues documented (if any)

**Communication:**
- [ ] Slack: #engineering → "Phase 3e-B ships today, feature behind flag"
- [ ] Pilot user: "Your switchable profiles are live (beta)"
- [ ] QA: "Regression tests pass, ready for rollout"

**Sign-off:** [ ] Ready to merge to main branch

---

## Post-Ship Monitoring (Days 9–15)

### Daily Checks (5 min each morning)

- [ ] No critical errors in sentry/error tracking
- [ ] Migration rollback not needed
- [ ] Pilot user feedback: "working as expected"
- [ ] Telemetry events firing correctly

### Day-10: Expand to 10% (Gradual Rollout)

- [ ] Update feature flag: enable for 10% of users
- [ ] Monitor for 24h
- [ ] If no issues, prepare full rollout

### Day-12: Expand to 100%

- [ ] Update feature flag: enable for all users
- [ ] Announce in #general: "Multi-Profile Ownership now available"
- [ ] Monitor for 48h

### Day-15: Full Lockdown

- [ ] Remove feature flag (feature now permanent)
- [ ] Archive phase documentation
- [ ] Schedule post-mortem (if issues occurred)

---

## Rollback Plan (If Issues)

**Trigger:** >5% error rate OR critical data loss OR pilot user requests

**Steps:**
1. [ ] Disable feature flag immediately (0 min)
2. [ ] Alert engineering team (5 min)
3. [ ] Run migration rollback (if data corruption) (10 min)
4. [ ] Verify system stable (5 min)
5. [ ] Post-mortem scheduled (within 24h)

**Estimated downtime:** <15 min

---

## Definition of Done

All checkboxes complete = Phase 3e-B ships.

```
✅ Backend: Migration + guards + /api/user/profiles
✅ Frontend: Switcher + router + multi-profile context
✅ Session: activeProfileId persistence
✅ Features: Multi-profile editing, Copy Assist per profile
✅ Testing: Regression suite + pilot approval
✅ Monitoring: Alerts configured, telemetry flowing
✅ Docs: README + API docs updated
✅ QA Sign-Off: Ready for rollout

Phase 3e-B: SHIPPED
```

