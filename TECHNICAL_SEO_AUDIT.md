# Technical SEO Audit — TradeScout
**Date**: January 1, 2026  
**Auditor**: GitHub Copilot (Claude Sonnet 4.5)  
**Scope**: Step 7 Pre-Foundation Verification

---

## Executive Summary

TradeScout's technical SEO foundation has **2 critical blockers** and **1 manual verification pending** before publishing foundation pages.

### ✅ Pass Conditions
- **Canonicals**: Correctly implemented (dynamic, no hardcoded domains)
- **Mobile Render**: Properly configured (viewport, overscroll, fixed layout)

### ❌ Critical Blockers
1. **Sitemap**: Manual, incomplete, wrong domain
2. **robots.txt**: Wrong sitemap URL, wrong domain

### ⏸️ Manual Verification Required
- **Index Status**: Requires Google Search Console access

---

## Step 7.1 — Sitemap Check

**File**: [client/public/sitemap.xml](client/public/sitemap.xml)

### Status: ❌ FAIL

**Issues**:

1. **Manual Sitemap** (Non-Updatable)
   - `lastmod` hardcoded to `2025-01-10`
   - New pages require manual XML editing
   - **Impact**: Foundation pages won't auto-appear in sitemap

2. **Incomplete Coverage**
   - Missing: `/help`, `/terms`, `/privacy`, `/about`, `/contact`
   - Missing: All comparison pages (`/compare/*`)
   - Missing: All foundation pages (`/how-it-works`, `/trust-model`, `/direct-connect`)

3. **Wrong Domain**
   - Points to: `https://trade-scout-pro-traderscornerll.replit.app/`
   - Should be: `https://www.thetradescout.com/`

**Required Fix**:
- Generate sitemap dynamically (server-side or build-time)
- Auto-include all public routes
- Use correct production domain
- Update on every deploy

---

## Step 7.2 — robots.txt Sanity Check

**File**: [client/public/robots.txt](client/public/robots.txt)

### Status: ✅ PARTIAL PASS

**Correct Behavior**:
- ✅ Allows `/contractors/`, `/profile/`, `/community/`
- ✅ Blocks `/admin/`, `/dashboard/`, `/settings/`, `/messages/`, `/scout/`, `/auth/`, `/api/`

**Issues**:

1. **Wrong Sitemap Reference**
   - Current: `Sitemap: https://www.thetradescout.com/sitemap-index.xml`
   - Actual file: `sitemap.xml` (not `sitemap-index.xml`)
   - **Impact**: Crawlers won't find sitemap

2. **Wrong Domain** (for sitemap URL)
   - Should match production domain
   - Must update if domain changes

**Required Fix**:
```txt
Sitemap: https://www.thetradescout.com/sitemap.xml
```

---

## Step 7.3 — Canonicals Audit

**File**: [client/src/components/SEOHelmet.tsx](client/src/components/SEOHelmet.tsx#L88-L96)

### Status: ✅ PASS

**Implementation**:
```tsx
function updateCanonicalLink(href: string) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}
```

**Behavior**:
- ✅ Canonicals auto-set based on current route
- ✅ Uses `window.location.origin` (no hardcoded domains)
- ✅ Manual override supported via `canonical` prop
- ✅ Dynamic updates on navigation

**No issues found**.

---

## Step 7.4 — Index Status Review

### Status: ⏸️ MANUAL VERIFICATION REQUIRED

**Cannot Perform** (requires Google Search Console access).

**Manual Steps**:
1. Open [Google Search Console](https://search.google.com/search-console)
2. Select TradeScout property
3. Navigate to **Pages → Indexed**
4. Check for:
   - "Crawled – currently not indexed" (bad)
   - "Duplicate without user-selected canonical" (bad)
   - "Valid" pages (good)

**Pass Condition**:
- No systemic blockers (e.g., entire site blocked or all pages marked duplicate)

---

## Step 7.5 — Mobile + Performance Spot-Check

**File**: [index.html](index.html#L5-L7)

### Status: ✅ PASS

**Configuration**:
```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

**CSS**:
```css
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b1220;
  overscroll-behavior: none;
}
```

**Behavior**:
- ✅ Prevents user scaling (app-like experience)
- ✅ Prevents scroll bounce (`overscroll-behavior: none`)
- ✅ Fixed height layout (no content overflow)
- ✅ Proper font loading (Google Fonts with preconnect)

**No blocking issues**.

---

## Critical Blockers Summary

| Step | Status | Blocker | Impact |
|------|--------|---------|--------|
| 7.1 | ❌ | Manual sitemap, wrong domain | Foundation pages won't auto-index |
| 7.2 | ⚠️ | Wrong sitemap URL | Crawlers won't find sitemap |
| 7.3 | ✅ | None | — |
| 7.4 | ⏸️ | Manual verification needed | — |
| 7.5 | ✅ | None | — |

---

## Required Fixes Before Step 1

### 1. Fix robots.txt (5 minutes)

**File**: [client/public/robots.txt](client/public/robots.txt)

**Change**:
```diff
- Sitemap: https://www.thetradescout.com/sitemap-index.xml
+ Sitemap: https://www.thetradescout.com/sitemap.xml
```

---

### 2. Generate Dynamic Sitemap (30–60 minutes)

**Options**:

**Option A: Build-Time Generation** (Recommended)
- Create `scripts/generate-sitemap.mjs`
- Run during build (add to `package.json` build script)
- Auto-include all routes from `App.tsx`
- Output to `client/public/sitemap.xml`

**Option B: Server-Side Generation**
- Add `/sitemap.xml` endpoint to `server.mjs`
- Query DB for dynamic routes (contractors, posts, etc.)
- Generate XML on-demand
- Cache for 1 hour

**Recommendation**: Build-time (simpler, static hosting compatible)

---

### 3. Verify Index Status (Manual)

**After fixes deployed**:
1. Submit sitemap in Google Search Console
2. Request indexing for 5 foundation pages
3. Wait 48–72 hours
4. Check "Indexed" vs "Not Indexed" counts

---

## Next Steps

### Immediate (Before Publishing Foundation Pages)
1. ✅ Fix `robots.txt` sitemap URL
2. ✅ Generate dynamic sitemap
3. ⏸️ Verify index status in GSC (manual)

### Step 1 Ready Condition
- ✅ Sitemap auto-updates
- ✅ robots.txt points to correct file
- ✅ No systemic indexing blockers

---

**Audit Complete**  
**Recommendation**: Fix sitemap + robots.txt → Proceed to Step 1
