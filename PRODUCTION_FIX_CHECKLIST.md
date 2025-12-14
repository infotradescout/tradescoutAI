# Production Fix Checklist - 3 Critical Issues

**Status:** 🚨 BLOCKING - Must fix TODAY before production works

---

## Issue 1: Database Missing Profiles Table (Auth 500s)

**Symptom:** `/api/auth/user` returns 500 "relation 'profiles' does not exist"

**Fix:** Run migrations on Neon production database

### Steps:

1. Go to **Neon Console** → Your Project → SQL Editor
2. Run these migrations **IN ORDER**:

```sql
-- 1. First migration (0000_wild_saracen.sql)
-- Run this first - establishes base schema

-- 2. Second migration (0001_community_builder.sql)
-- Run this second

-- 3. Third migration (0002_add_user_badges.sql)
-- Run this third

-- 4. Fourth migration (0003_business_profiles.sql)
-- Run this fourth

-- 5. CRITICAL: Profiles table (0004_profiles.sql)
-- Run this LAST
DO $$ BEGIN
  CREATE TYPE profile_status AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id varchar REFERENCES businesses(id) ON DELETE SET NULL,
  role_context user_role NOT NULL,
  slug varchar NOT NULL UNIQUE,
  display_name varchar NOT NULL,
  headline varchar,
  content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  status profile_status NOT NULL DEFAULT 'draft',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_owner_idx ON profiles(owner_user_id);
CREATE INDEX IF NOT EXISTS profile_business_idx ON profiles(business_id);
CREATE INDEX IF NOT EXISTS profile_role_ctx_idx ON profiles(role_context);
CREATE INDEX IF NOT EXISTS profile_status_idx ON profiles(status);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active_profile_id varchar;
```

3. **Verify:** Execute this test query:
```sql
SELECT COUNT(*) FROM profiles;
-- Should return 0 (empty table), not an error
```

✅ **When done:** `/api/auth/user` should return 401 (not logged in) or 200 (user data), never 500

---

## Issue 2: CORS Rejecting Vercel (API Calls Fail)

**Symptom:** Render logs show "Origin not allowed: https://tradescout-*.vercel.app"

**Fix:** Add your Vercel domains to CORS allowlist on Render

### Your Current Setup:

The server reads `CORS_ALLOWED_ORIGINS` env var (at `server/index.ts` line 93):

```typescript
const rawAllowlist = process.env.CORS_ALLOWED_ORIGINS || "";
const ALLOWED_ORIGINS = rawAllowlist
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter((o) => o.length > 0);
```

### Steps:

1. Go to **Render Dashboard** → Your Service (TradeScout Backend)
2. Go to **Settings** → **Environment**
3. Find or create `CORS_ALLOWED_ORIGINS` env var
4. Set value to:

```
https://www.thetradescout.com,https://your-vercel-production-domain.vercel.app,https://your-vercel-preview-domain.vercel.app
```

**Example:**
```
https://www.thetradescout.com,https://tradescout-prod.vercel.app,https://tradescout-staging.vercel.app
```

5. Click **Save** (Render will redeploy automatically)
6. **Verify:** Open Render logs and check no more "Origin not allowed" errors

✅ **When done:** Vercel UI can call `/api/auth/providers` and `/api/auth/user` without CORS errors

---

## Issue 3: Vercel Needs Cache Clear + Redeploy

**Symptom:** Vercel serving old build (still see layout issues despite code fixes)

**Fix:** Manual redeploy with cache clear

### Steps:

1. Go to **Vercel Dashboard** → Your Project
2. Go to **Deployments** tab
3. Find the **latest deployment** (or main branch)
4. Click the **⋮ menu** (three dots)
5. Select **"Redeploy"**
6. ☑️ **CRITICAL: Check "Clear build cache"** ← This is essential
7. Click **"Redeploy"** button
8. Wait 2-3 minutes for build to complete

**Verify:** Open your Vercel site → F12 Console → Should see:
```
✅ REAL TRADE SCOUT APP LOADED - client/src/App.tsx
🔥 AppShell mounted
```

✅ **When done:** Vercel serving fresh build with all layout fixes

---

## Execution Order (CRITICAL)

**DO THESE IN THIS ORDER:**

```
1. Run Database Migrations (Issue 1)
   ↓
2. Add CORS env var on Render (Issue 2)
   ↓
3. Redeploy Vercel with cache clear (Issue 3)
   ↓
✅ Production should be working
```

---

## Quick Diagnosis

**After each step, check:**

```bash
# Issue 1: Auth working?
curl https://tradescout-render-backend/api/auth/user
# Should return 401 or 200, NOT 500

# Issue 2: CORS working?
# Open DevTools Network tab on Vercel site
# Call to /api/auth/user should have CORS headers, no errors

# Issue 3: Fresh build?
# Open F12 Console on Vercel site
# Should see both verification logs
```

---

## Contact Points

- **Neon:** https://console.neon.tech
- **Render:** https://dashboard.render.com
- **Vercel:** https://vercel.com/dashboard

---

## Rollback Plan (if something breaks)

If production breaks after these changes:

1. **Issue 1 broke?** → Delete the profiles table from Neon (you can re-run migration)
2. **Issue 2 broke?** → Remove the env var from Render (CORS will reject Vercel, but that's safer than open)
3. **Issue 3 broke?** → Vercel → Deployments → Rollback to previous deployment

---

**You've got this. Execute in order. Report back when each is done.** 🚀
