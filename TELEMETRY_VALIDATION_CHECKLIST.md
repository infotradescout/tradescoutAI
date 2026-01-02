# 📊 Telemetry Validation Checklist (24–48 Hours)

**Objective:** Guarantee Day-7 review is clean and decisive.

**Owner:** DevOps / Analytics  
**Timeline:** Days 1–3 of bake window  
**Gate:** ✅ "Telemetry is trustworthy" sign-off before Day-7

---

## Phase 1: Event Firing Verification (24 hours)

### Checklist: All 5 Events Must Fire

#### ✅ `scout_copy_assist_opened`
- **When:** User clicks "Improve with Scout" button
- **Payload:**
  ```json
  {
    "event": "scout_copy_assist_opened",
    "field": "headline" | "services" | "description",
    "businessId": "...",
    "userId": "...",
    "timestamp": "ISO-8601"
  }
  ```
- **Verify:** In Prod Dashboard → Events → Filter `scout_copy_assist_opened`
  - [ ] Events appear in real-time (check last 1 hour)
  - [ ] `field` property always present
  - [ ] `businessId` and `userId` populated (not null)
- **Owner:** Frontend (BusinessProfileEditor.tsx calls `generateCopyVariants()`)

#### ✅ `scout_copy_variant_viewed`
- **When:** User sees modal with variants
- **Payload:**
  ```json
  {
    "event": "scout_copy_variant_viewed",
    "field": "headline" | "services" | "description",
    "variant": "safe" | "growth",
    "businessId": "...",
    "userId": "...",
    "dwell_seconds": 0,
    "timestamp": "ISO-8601"
  }
  ```
- **Verify:** In Prod Dashboard → Events → Filter `scout_copy_variant_viewed`
  - [ ] Events appear for both `safe` and `growth`
  - [ ] `dwell_seconds` tracked (not always 0)
  - [ ] Roughly 2 events per open (safe + growth)
- **Owner:** ScoutCopyAssistModal.tsx (fired on modal render for each variant)

#### ✅ `scout_copy_variant_accepted`
- **When:** User clicks "Use this" on a variant
- **Payload:**
  ```json
  {
    "event": "scout_copy_variant_accepted",
    "field": "headline" | "services" | "description",
    "variant": "safe" | "growth",
    "text": "accepted variant text",
    "charCount": 42,
    "businessId": "...",
    "userId": "...",
    "timestamp": "ISO-8601"
  }
  ```
- **Verify:** In Prod Dashboard → Events → Filter `scout_copy_variant_accepted`
  - [ ] Events fire for accepts (not just views)
  - [ ] `text` and `charCount` populated
  - [ ] Ratio of accepts to views makes sense (expect 10–40%)
- **Owner:** BusinessProfileEditor.tsx `handleCopyVariantAccept()`

#### ✅ `scout_copy_assist_closed`
- **When:** User closes modal (X button or clicks outside)
- **Payload:**
  ```json
  {
    "event": "scout_copy_assist_closed",
    "field": "headline" | "services" | "description",
    "action": "dismissed" | "accepted",
    "businessId": "...",
    "userId": "...",
    "timestamp": "ISO-8601"
  }
  ```
- **Verify:** In Prod Dashboard → Events → Filter `scout_copy_assist_closed`
  - [ ] Events fire on modal close
  - [ ] `action` field differentiates dismissed vs accepted
- **Owner:** ScoutCopyAssistModal.tsx (onClose callback)

#### ✅ `business_profile_updated`
- **When:** User saves profile (Save button pressed)
- **Payload:**
  ```json
  {
    "event": "business_profile_updated",
    "fields_changed": ["headline", "description", "services"],
    "headline_source": "user_input" | "copy_assist_safe" | "copy_assist_growth",
    "services_source": "user_input" | "copy_assist_safe" | "copy_assist_growth",
    "businessId": "...",
    "userId": "...",
    "timestamp": "ISO-8601"
  }
  ```
- **Verify:** In Prod Dashboard → Events → Filter `business_profile_updated`
  - [ ] Events fire on save (POST `/api/business-profile/...`)
  - [ ] `fields_changed` lists which fields were modified
  - [ ] `headline_source` and `services_source` populated (tracks if copy came from Scout)
- **Owner:** Backend (`POST /api/business-profile/:id` route)

---

## Phase 2: Payload Integrity Spot-Check (12 hours)

### SQL Query 1: Event Count by Type (Last 24 hours)

```sql
SELECT 
  event_name,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_users
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name IN (
    'scout_copy_assist_opened',
    'scout_copy_variant_viewed',
    'scout_copy_variant_accepted',
    'scout_copy_assist_closed',
    'business_profile_updated'
  )
GROUP BY event_name
ORDER BY count DESC;
```

**Expected Output:**
| event_name | count | unique_users |
|---|---|---|
| scout_copy_variant_viewed | 100–200 | 10–30 |
| scout_copy_assist_opened | 50–100 | 10–30 |
| scout_copy_variant_accepted | 10–30 | 5–15 |
| scout_copy_assist_closed | 40–80 | 8–20 |
| business_profile_updated | 5–20 | 3–10 |

**Acceptance rate sanity check:** `accepts / opens` should be 10–40% (higher is good)

### SQL Query 2: Null/Invalid Payload Check

```sql
SELECT 
  event_name,
  SUM(CASE WHEN user_id IS NULL THEN 1 ELSE 0 END) as null_user_id,
  SUM(CASE WHEN business_id IS NULL THEN 1 ELSE 0 END) as null_business_id,
  SUM(CASE WHEN properties->>'field' IS NULL THEN 1 ELSE 0 END) as null_field,
  COUNT(*) as total
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name IN (
    'scout_copy_assist_opened',
    'scout_copy_variant_viewed',
    'scout_copy_variant_accepted'
  )
GROUP BY event_name;
```

**Expected Output:** All null counts = 0 (no dropped fields)

### SQL Query 3: Field Distribution

```sql
SELECT 
  event_name,
  properties->>'field' as field,
  COUNT(*) as count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name IN ('scout_copy_assist_opened', 'scout_copy_variant_accepted')
GROUP BY event_name, properties->>'field'
ORDER BY event_name, count DESC;
```

**Expected Output:**
| event_name | field | count |
|---|---|---|
| scout_copy_assist_opened | headline | 25–35 |
| scout_copy_assist_opened | services | 20–30 |
| scout_copy_assist_opened | description | 5–15 |
| scout_copy_variant_accepted | headline | 8–15 |
| scout_copy_variant_accepted | services | 4–8 |

### SQL Query 4: Variant Split (Safe vs Growth)

```sql
SELECT 
  properties->>'field' as field,
  properties->>'variant' as variant,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY properties->>'field'), 1) as pct
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND event_name = 'scout_copy_variant_accepted'
GROUP BY properties->>'field', properties->>'variant'
ORDER BY properties->>'field', count DESC;
```

**Expected Output:**
| field | variant | count | pct |
|---|---|---|---|
| headline | safe | 10 | 65% |
| headline | growth | 5 | 35% |
| services | safe | 6 | 60% |
| services | growth | 4 | 40% |

**Note:** Safe > Growth early is expected (trust phase). Watch this shift toward 50/50 by Day-7.

---

## Phase 3: Instrumentation Issues (If Any)

### Scenario A: Event Not Firing

**Symptom:** `scout_copy_assist_opened` count = 0 in production

**Diagnosis:**
1. Check browser console (dev tools) → any errors when clicking "Improve with Scout"?
2. Verify telemetry library is initialized in app entry point
3. Check if button is actually clickable (disabled state in code?)

**Fix:**
- Frontend: Ensure `generateCopyVariants()` is called and fires telemetry
- Backend: Confirm analytics endpoint is receiving and storing events

**Blocker?** YES — cannot proceed to Day-7 without events

### Scenario B: Null Fields in Payload

**Symptom:** `properties->>'field'` shows NULL for some events

**Diagnosis:**
- Check BusinessProfileEditor.tsx → is `copyAssistField` being set?
- Check scoutCopyAssist.ts → is `field` param in request body?

**Fix:**
- Frontend: Add debug logging → `console.log('copyAssistField:', copyAssistField)` before `generateCopyVariants(field)`
- Backend: Log request.body.field before Claude call

**Blocker?** MAYBE — if >10% of events have null field, invalidates funnel analysis

### Scenario C: Variant Text Not Stored

**Symptom:** `scout_copy_variant_accepted` fires but `properties->>'text'` is empty

**Diagnosis:**
- Check BusinessProfileEditor.tsx `handleCopyVariantAccept()` → is variant object structured correctly?
- Backend response includes `variant.text`?

**Fix:**
- Verify variant shape: `{ id: 'safe', text: '...', rationale: '...' }`
- Add telemetry logging in handler: `console.log('Accepting variant:', variant)`

**Blocker?** NO — acceptance still counted, just can't measure text length

---

## Phase 4: Build Day-7 Queries (Pre-Stage)

### Query Template: Acceptance Rate (for TELEMETRY_REVIEW_PHASE_3E_A1.md)

```sql
-- Headline Acceptance Rate (Day-7)
SELECT 
  'headline' as field,
  COALESCE(sum_accepts, 0) as accepts,
  COALESCE(sum_views, 0) as views,
  CASE 
    WHEN COALESCE(sum_views, 0) = 0 THEN 0
    ELSE ROUND(100.0 * COALESCE(sum_accepts, 0) / COALESCE(sum_views, 0), 1)
  END as acceptance_rate
FROM (
  SELECT 
    SUM(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 ELSE 0 END) as sum_accepts,
    SUM(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 ELSE 0 END) as sum_views
  FROM analytics_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND properties->>'field' = 'headline'
) subq;

-- Services Acceptance Rate (Day-7)
SELECT 
  'services' as field,
  COALESCE(sum_accepts, 0) as accepts,
  COALESCE(sum_views, 0) as views,
  CASE 
    WHEN COALESCE(sum_views, 0) = 0 THEN 0
    ELSE ROUND(100.0 * COALESCE(sum_accepts, 0) / COALESCE(sum_views, 0), 1)
  END as acceptance_rate
FROM (
  SELECT 
    SUM(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 ELSE 0 END) as sum_accepts,
    SUM(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 ELSE 0 END) as sum_views
  FROM analytics_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND properties->>'field' = 'services'
) subq;
```

### Query Template: Funnel Analysis (for TELEMETRY_REVIEW_PHASE_3E_A1.md)

```sql
-- Headline Funnel (Opened → Viewed → Accepted)
WITH headline_events AS (
  SELECT 
    event_name,
    COUNT(*) as count
  FROM analytics_events
  WHERE created_at >= NOW() - INTERVAL '7 days'
    AND properties->>'field' = 'headline'
    AND event_name IN ('scout_copy_assist_opened', 'scout_copy_variant_viewed', 'scout_copy_variant_accepted')
  GROUP BY event_name
)
SELECT 
  CASE 
    WHEN event_name = 'scout_copy_assist_opened' THEN 'Opened'
    WHEN event_name = 'scout_copy_variant_viewed' THEN 'Viewed'
    WHEN event_name = 'scout_copy_variant_accepted' THEN 'Accepted'
  END as step,
  count,
  ROUND(100.0 * count / (SELECT count FROM headline_events WHERE event_name = 'scout_copy_assist_opened'), 1) as drop_pct
FROM headline_events
ORDER BY FIELD(event_name, 'scout_copy_assist_opened', 'scout_copy_variant_viewed', 'scout_copy_variant_accepted');
```

---

## Sign-Off Template

**By EOD Day-3, this checklist must be complete:**

```
✅ All 5 events fire in production (spot-checked in dashboard)
✅ Payload integrity verified (no null fields, expected event counts)
✅ SQL queries tested locally (return expected data)
✅ No critical bugs found (or workarounds documented)
✅ Analytics team confirmed telemetry is trustworthy for Day-7 review

Signed: _______________
Date: _______________
```

**If any ✅ is blocked:**
- Document blocker in BLOCKING_TELEMETRY_ISSUES.md
- Flag to product (may delay Day-7 review by 2–3 days)
- Do not proceed to Day-7 without full sign-off

---

## Notes

- **Read-only queries only** — no updates to production data
- **Test queries locally first** against staging database before running on prod
- **Reuse these exact queries on Day-7** — consistency is critical
- **If event payload changes**, update queries immediately and re-validate
