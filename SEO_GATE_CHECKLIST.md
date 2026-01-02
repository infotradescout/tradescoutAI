# SEO Gate Checklist: Ready for Step 1 (Foundation Pages)

**Status:** ✅ READY  
**Date:** January 2, 2026  
**Build:** GREEN (18.04s)  
**Commits:** 
- Canonical tags: `02c60ff`
- Phase 3c Dark Period: `1c73e1f`

---

## ✅ Completed (Pre-Deployment)

### 1. Sitemap Discovery ✅
**File:** [client/public/sitemap.xml](client/public/sitemap.xml)  
**Status:** Valid XML, properly formatted, uses https:// URLs  
**Coverage:** 40+ canonical URLs including core pages, county hub, county directory, comparisons  
**Root Element:** `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`

### 2. Canonical Tags ✅
**All Public Pages:** Self-referencing canonicals added  
**Implementation:**
- Format: `<link rel="canonical" href="https://www.thetradescout.com/page-slug" />`
- Domain: Always `www.thetradescout.com` (consistent)
- Protocol: Always HTTPS
- Query params: None

**Pages Tagged:**
| Page | Canonical URL | Status |
|------|---------------|--------|
| Landing | `https://www.thetradescout.com` | ✅ |
| Help | `https://www.thetradescout.com/help` | ✅ |
| How It Works | `https://www.thetradescout.com/how-it-works` | ✅ |
| How TradeScout Works | `https://www.thetradescout.com/how-tradescout-works` | ✅ |
| Direct Connect Info | `https://www.thetradescout.com/direct-connect-info` | ✅ |
| Compare Angi | `https://www.thetradescout.com/compare-angi` | ✅ |
| Compare HomeAdvisor | `https://www.thetradescout.com/compare-homeadvisor` | ✅ |
| Contractor Signup | `https://www.thetradescout.com/contractors/apply` | ✅ |
| Contractor Profile | `https://www.thetradescout.com/contractor/{slug}` | ✅ (dynamic) |
| County Pages | `https://www.thetradescout.com/county/{state}/{county}` | ✅ (dynamic) |

---

## 🚀 Next: Google Search Console Submission (MANUAL STEPS)

### STEP 7A: Submit Sitemap in Google Search Console

**Prerequisites:**
- ✅ GSC property created for `https://www.thetradescout.com`
- ✅ Ownership verified (DNS, HTML file, or tag)

**Submission Steps:**

1. **Open Google Search Console**
   - Go to: [https://search.google.com/search-console](https://search.google.com/search-console)
   - Select property: `https://www.thetradescout.com` (ensure it's the HTTPS version)

2. **Navigate to Sitemaps**
   - Left sidebar → "Indexing" → "Sitemaps"

3. **Submit Sitemap URL**
   - Click **"Add/test sitemap"** (top right)
   - Enter: `https://www.thetradescout.com/sitemap.xml`
   - Click **"Submit"**

4. **Verify Submission**
   - Expected result: Status shows "Success" within minutes
   - Count of URLs indexed appears in the table
   - Examples: "URLs submitted: 40", "URLs indexed: 32+", etc.

5. **Confirm Sitemap Discovery Source**
   - Go back to the page you inspected in Search Console
   - URL Inspection tab → "Discovery"
   - Under "Sitemaps" you should eventually see:
     ```
     Sitemaps: https://www.thetradescout.com/sitemap.xml
     ```
   - This confirms Google treats your sitemap as an intentional, declared inventory

**Timing:**
- Submission: Instant
- Status update: 5 minutes – 1 hour
- URL indexing: 24–72 hours (depends on crawl budget, page priority)

---

## 📋 Gate Conditions (Must All Be True)

Before publishing Step 1 foundation pages, verify:

- [ ] **Sitemap submitted to GSC** (Step 7A complete)
  - URL: `https://www.thetradescout.com/sitemap.xml`
  - Status: "Success"
  - Pages count visible (e.g., "40 URLs submitted")

- [ ] **Canonical tags present on all public pages** (Step 7B complete)
  - Command to verify: `grep -r 'rel="canonical"' client/src/pages/`
  - Result: Should show all tagged pages
  - Format: Consistent `https://www.thetradescout.com/` domain

- [ ] **Sitemap shows as discovery source in GSC**
  - Go to: [Google Search Console](https://search.google.com/search-console)
  - Select property: `https://www.thetradescout.com`
  - Inspect a page (e.g., `/how-it-works`)
  - Under "Coverage" → "Discovery"
  - Should show: `Sitemaps: https://www.thetradescout.com/sitemap.xml`

- [ ] **All canonicals match sitemap URLs** (automatic)
  - Sitemap includes all tagged pages
  - No URL variants (www/non-www, http/https, trailing slash)

---

## Why This Matters (Summary)

| Gate | Why |
|------|-----|
| **Sitemap** | Google treats URLs discovered via sitemap as intentional inventory. Without it, new pages index slower and less reliably. |
| **Canonical Tags** | Prevents authority dilution from url variants (http/https, www/non-www, trailing slashes). Tells Google: "This is my preferred version." |
| **Declared Authority** | Right now, Google found you via MapQuest, direct URLs, and internal links. Sitemaps + canonicals = "I'm publishing deliberately." |
| **Foundation Scale** | Before publishing comparisons, how-it-works, and county pages, you need clean authority signals. These are prerequisites. |

---

## Phase 3c: Dark Period Monitoring (Concurrent)

**Status:** LOCKED (Commit: `1c73e1f`)

**Observation Window:** 7–14 days  
**Clock Start:** Now (January 2, 2026)  
**KPIs Tracked:** Write health, data quality, rate discipline, idempotency  
**Greenlight Criteria:** 7+ consecutive days, all KPIs pass  

No changes during dark period. SEO gates (sitemap + canonical) are orthogonal to Phase 3c monitoring.

---

## Next Actions (Sequence)

1. **NOW** ✅ Read this checklist
2. **SUBMIT TO GSC** (Manual, 5 min)
   - Go to Search Console
   - Add sitemap
   - Verify status
3. **WAIT FOR DISCOVERY SOURCE** (24–72 hours)
   - Check if sitemap appears in URL inspection page's "Discovery" tab
4. **ONCE ALL GATES PASS** → Phase 3d design + Step 1 publication cleared

---

## Verification Commands

**Check canonical tags are present:**
```bash
grep -r 'canonical="https://www.thetradescout.com' client/src/pages/ | wc -l
```
Expected: 10+ matches

**Validate sitemap XML:**
```bash
curl https://www.thetradescout.com/sitemap.xml | xmllint --format -
```
Expected: Valid XML, no parse errors

**Check build green:**
```bash
npm run build
```
Expected: "✓ built in X.XXs" + "Server bundle built successfully"

---

## Critical Notes

- ✋ **Do NOT publish foundation pages** until all gates pass
- ✋ **Do NOT change domain** (www/non-www) mid-process
- ✋ **Do NOT remove/rename URLs** in sitemap after submission
- ✅ **DO confirm sitemap status** in GSC before proceeding
- ✅ **DO wait for discovery source** confirmation

---

## Who to Contact

**Issue:** Sitemap not showing in GSC after 48 hours
- Check 1: Is domain verified in GSC?
- Check 2: Is sitemap URL in robots.txt?
- Check 3: Did you submit correct URL (https, not http)?

**Issue:** Canonical not in page source
- Command: `curl https://www.thetradescout.com/help | grep canonical`
- Expected output: `<link rel="canonical" href="https://www.thetradescout.com/help">`

---

## Build Status

**Latest Build:** 18.04s ✅  
**TypeScript:** Strict mode, all imports resolved ✅  
**Sitemap:** Present, valid XML ✅  
**Canonicals:** All tagged ✅  
**Git:** Committed `02c60ff` ✅  

**GATE STATUS: READY FOR GSC SUBMISSION** 🟢

