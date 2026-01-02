# 📈 Telemetry SQL Query Pack (Day-7 Ready)

**Purpose:** Populate TELEMETRY_REVIEW_PHASE_3E_A1.md with production data.

**Owner:** Analytics / BI  
**Execution:** EOD Day-6 (collect data), morning Day-7 (run queries)  
**Output:** Raw numbers → plug into review tables → decision by EOD Day-7

---

## Query 1: Acceptance Rate by Field & Variant

**Purpose:** Fill Section 1️⃣ of review template

**Headline Acceptance Rate:**
```sql
SELECT 
  'headline' as field,
  properties->>'variant' as variant,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) as accepts,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) as views,
  CASE 
    WHEN COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) / 
      COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END), 
      1
    )
  END as acceptance_rate_pct
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND properties->>'field' = 'headline'
  AND event_name IN ('scout_copy_variant_viewed', 'scout_copy_variant_accepted')
GROUP BY properties->>'variant'
ORDER BY variant;
```

**Services Acceptance Rate:**
```sql
SELECT 
  'services' as field,
  properties->>'variant' as variant,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) as accepts,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) as views,
  CASE 
    WHEN COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) / 
      COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END), 
      1
    )
  END as acceptance_rate_pct
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND properties->>'field' = 'services'
  AND event_name IN ('scout_copy_variant_viewed', 'scout_copy_variant_accepted')
GROUP BY properties->>'variant'
ORDER BY variant;
```

**Description Acceptance Rate (v1.0 baseline):**
```sql
SELECT 
  'description' as field,
  properties->>'variant' as variant,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) as accepts,
  COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) as views,
  CASE 
    WHEN COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(CASE WHEN event_name = 'scout_copy_variant_accepted' THEN 1 END) / 
      COUNT(CASE WHEN event_name = 'scout_copy_variant_viewed' THEN 1 END), 
      1
    )
  END as acceptance_rate_pct
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND properties->>'field' = 'description'
  AND event_name IN ('scout_copy_variant_viewed', 'scout_copy_variant_accepted')
GROUP BY properties->>'variant'
ORDER BY variant;
```

**Expected Output:**
```
field     | variant | accepts | views | acceptance_rate_pct
----------|---------|---------|-------|--------------------
headline  | safe    | 12      | 28    | 42.9
headline  | growth  | 8       | 32    | 25.0
services  | safe    | 6       | 18    | 33.3
services  | growth  | 4       | 16    | 25.0
```

---

## Query 2: Engagement Funnel (Headline)

**Purpose:** Fill Section 2️⃣ Headline Funnel table

```sql
WITH headline_funnel AS (
  SELECT 
    event_name,
    COUNT(*) as count,
    ROW_NUMBER() OVER (ORDER BY 
      CASE 
        WHEN event_name = 'scout_copy_assist_opened' THEN 1
        WHEN event_name = 'scout_copy_variant_viewed' THEN 2
        WHEN event_name = 'scout_copy_variant_accepted' THEN 3
      END
    ) as step_order
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND created_at < CURRENT_DATE
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
  ROUND(
    100.0 * (
      FIRST_VALUE(count) OVER (ORDER BY step_order DESC) - count
    ) / FIRST_VALUE(count) OVER (ORDER BY step_order DESC),
    1
  ) as drop_pct
FROM headline_funnel
ORDER BY step_order;
```

**Expected Output:**
```
step      | count | drop_pct
----------|-------|----------
Opened    | 60    | 0.0
Viewed    | 50    | 16.7
Accepted  | 20    | 66.7
```

**Interpretation:** 60 users opened → 50 viewed (83% proceed) → 20 accepted (40% of viewers)

---

## Query 3: Engagement Funnel (Services)

**Purpose:** Fill Section 2️⃣ Services Funnel table

```sql
WITH services_funnel AS (
  SELECT 
    event_name,
    COUNT(*) as count,
    ROW_NUMBER() OVER (ORDER BY 
      CASE 
        WHEN event_name = 'scout_copy_assist_opened' THEN 1
        WHEN event_name = 'scout_copy_variant_viewed' THEN 2
        WHEN event_name = 'scout_copy_variant_accepted' THEN 3
      END
    ) as step_order
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND created_at < CURRENT_DATE
    AND properties->>'field' = 'services'
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
  ROUND(
    100.0 * (
      FIRST_VALUE(count) OVER (ORDER BY step_order DESC) - count
    ) / FIRST_VALUE(count) OVER (ORDER BY step_order DESC),
    1
  ) as drop_pct
FROM services_funnel
ORDER BY step_order;
```

---

## Query 4: Edit Delta (Accepted → Published)

**Purpose:** Fill Section 3️⃣ of review template

**Logic:**
1. Find all `scout_copy_variant_accepted` events (users accepted a variant)
2. Cross-reference with `business_profile_updated` events (user saved)
3. Check if field was in `fields_changed` array
4. Count saved and published

```sql
WITH accepted_variants AS (
  SELECT 
    user_id,
    properties->>'field' as field,
    properties->>'variant' as variant,
    created_at as accepted_at
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND created_at < CURRENT_DATE
    AND event_name = 'scout_copy_variant_accepted'
    AND properties->>'field' IN ('headline', 'services')
),
saved_after_accept AS (
  SELECT 
    ae.user_id,
    aa.field,
    COUNT(*) as saved_count,
    SUM(CASE WHEN ae.properties->>'published' = 'true' THEN 1 ELSE 0 END) as published_count
  FROM accepted_variants aa
  JOIN analytics_events ae ON ae.user_id = aa.user_id
  WHERE ae.event_name = 'business_profile_updated'
    AND ae.created_at >= aa.accepted_at
    AND ae.created_at <= aa.accepted_at + INTERVAL '1 hour'  -- Save within 1 hour of accept
    AND ae.properties->>'fields_changed' LIKE CONCAT('%', aa.field, '%')
  GROUP BY ae.user_id, aa.field
)
SELECT 
  field,
  COUNT(DISTINCT user_id) as accepted_users,
  SUM(saved_count) as saved,
  SUM(published_count) as published,
  ROUND(
    100.0 * SUM(published_count) / COUNT(DISTINCT user_id),
    1
  ) as publish_rate_pct
FROM saved_after_accept
GROUP BY field
ORDER BY field;
```

**Expected Output:**
```
field     | accepted_users | saved | published | publish_rate_pct
-----------|----------------|-------|-----------|------------------
headline  | 20             | 18    | 16        | 80.0
services  | 10             | 8     | 5         | 50.0
```

---

## Query 5: Variant Preference Split (Safe vs Growth)

**Purpose:** Fill Section 4️⃣ of review template

**Headline Preference:**
```sql
SELECT 
  'headline' as field,
  properties->>'variant' as variant,
  COUNT(*) as accepts,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct_of_total
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND event_name = 'scout_copy_variant_accepted'
  AND properties->>'field' = 'headline'
GROUP BY properties->>'variant'
ORDER BY variant;
```

**Services Preference:**
```sql
SELECT 
  'services' as field,
  properties->>'variant' as variant,
  COUNT(*) as accepts,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct_of_total
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND event_name = 'scout_copy_variant_accepted'
  AND properties->>'field' = 'services'
GROUP BY properties->>'variant'
ORDER BY variant;
```

**Expected Output:**
```
field     | variant | accepts | pct_of_total
-----------|---------|---------|-------------
headline  | growth  | 8       | 40.0
headline  | safe    | 12      | 60.0
services  | growth  | 4       | 40.0
services  | safe    | 6       | 60.0
```

---

## Query 6: Dwell Time (Variant Engagement Depth)

**Purpose:** Supplementary signal—how long users spend viewing variants

```sql
SELECT 
  properties->>'field' as field,
  properties->>'variant' as variant,
  COUNT(*) as viewed_count,
  ROUND(AVG(CAST(properties->>'dwell_seconds' AS NUMERIC)), 1) as avg_dwell_secs,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(properties->>'dwell_seconds' AS NUMERIC)), 1) as median_dwell_secs,
  ROUND(MAX(CAST(properties->>'dwell_seconds' AS NUMERIC)), 1) as max_dwell_secs
FROM analytics_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND created_at < CURRENT_DATE
  AND event_name = 'scout_copy_variant_viewed'
GROUP BY properties->>'field', properties->>'variant'
ORDER BY properties->>'field', properties->>'variant';
```

**Expected Output:**
```
field     | variant | viewed_count | avg_dwell_secs | median_dwell_secs | max_dwell_secs
-----------|---------|--------------|-----------------|-------------------|---------------
headline  | growth  | 32           | 4.2             | 3.5               | 15.8
headline  | safe    | 28           | 3.1             | 2.8               | 12.3
services  | growth  | 16           | 6.8             | 5.2               | 22.1
services  | safe    | 18           | 5.1             | 4.0               | 18.5
```

**Interpretation:** Higher dwell = more consideration. Growth often dwells longer (good sign of engagement).

---

## Query 7: Abandonment Analysis (Opened But Never Accepted)

**Purpose:** Spot high-friction fields

```sql
WITH opened_sessions AS (
  SELECT 
    user_id,
    properties->>'field' as field,
    MIN(created_at) as first_opened
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND event_name = 'scout_copy_assist_opened'
  GROUP BY user_id, properties->>'field'
),
accepted_sessions AS (
  SELECT 
    user_id,
    properties->>'field' as field
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND event_name = 'scout_copy_variant_accepted'
  GROUP BY user_id, properties->>'field'
)
SELECT 
  o.field,
  COUNT(DISTINCT o.user_id) as opened,
  COUNT(DISTINCT a.user_id) as accepted,
  COUNT(DISTINCT o.user_id) - COUNT(DISTINCT a.user_id) as abandoned,
  ROUND(
    100.0 * (COUNT(DISTINCT o.user_id) - COUNT(DISTINCT a.user_id)) / COUNT(DISTINCT o.user_id),
    1
  ) as abandonment_pct
FROM opened_sessions o
LEFT JOIN accepted_sessions a ON o.user_id = a.user_id AND o.field = a.field
GROUP BY o.field
ORDER BY o.field;
```

**Expected Output:**
```
field     | opened | accepted | abandoned | abandonment_pct
-----------|--------|----------|-----------|----------------
headline  | 60     | 20       | 40        | 66.7
services  | 34     | 10       | 24        | 70.6
```

**Interpretation:** ~70% abandonment is expected (users browse, don't always use). Watch for >80% (signals frustration).

---

## Query 8: Multi-Accept Pattern (Users Accepting Multiple Variants)

**Purpose:** Detect power users or copy exploration behavior

```sql
WITH user_accepts AS (
  SELECT 
    user_id,
    properties->>'field' as field,
    COUNT(*) as accept_count
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND event_name = 'scout_copy_variant_accepted'
  GROUP BY user_id, properties->>'field'
)
SELECT 
  field,
  accept_count,
  COUNT(DISTINCT user_id) as user_count,
  ROUND(
    100.0 * COUNT(DISTINCT user_id) / (SELECT COUNT(DISTINCT user_id) FROM user_accepts),
    1
  ) as pct_of_all_accepters
FROM user_accepts
GROUP BY field, accept_count
ORDER BY field, accept_count;
```

**Expected Output:**
```
field     | accept_count | user_count | pct_of_all_accepters
-----------|--------------|------------|--------------------
headline  | 1            | 18         | 90.0
headline  | 2            | 2          | 10.0
services  | 1            | 9          | 90.0
services  | 2            | 1          | 10.0
```

**Interpretation:** ~90% single-accept is healthy. >20% multi-accept suggests indecision or feature discovery (both OK).

---

## Query 9: Go/No-Go Thresholds (Automated Check)

**Purpose:** Auto-populate decision criteria from data

```sql
WITH metrics AS (
  SELECT 
    'headline_acceptance' as metric,
    ROUND(100.0 * SUM(CASE WHEN event_name = 'scout_copy_variant_accepted' AND properties->>'field' = 'headline' THEN 1 ELSE 0 END) / 
          NULLIF(SUM(CASE WHEN event_name = 'scout_copy_variant_viewed' AND properties->>'field' = 'headline' THEN 1 ELSE 0 END), 0), 1) as value
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND created_at < CURRENT_DATE
  
  UNION ALL
  
  SELECT 
    'services_acceptance' as metric,
    ROUND(100.0 * SUM(CASE WHEN event_name = 'scout_copy_variant_accepted' AND properties->>'field' = 'services' THEN 1 ELSE 0 END) / 
          NULLIF(SUM(CASE WHEN event_name = 'scout_copy_variant_viewed' AND properties->>'field' = 'services' THEN 1 ELSE 0 END), 0), 1) as value
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND created_at < CURRENT_DATE
  
  UNION ALL
  
  SELECT 
    'publish_rate_headline' as metric,
    ROUND(100.0 * SUM(CASE WHEN event_name = 'business_profile_updated' AND properties->>'fields_changed' LIKE '%headline%' THEN 1 ELSE 0 END) /
          NULLIF(SUM(CASE WHEN event_name = 'scout_copy_variant_accepted' AND properties->>'field' = 'headline' THEN 1 ELSE 0 END), 0), 1) as value
  FROM analytics_events
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days' AND created_at < CURRENT_DATE
)
SELECT 
  metric,
  value,
  CASE 
    WHEN metric = 'headline_acceptance' AND value >= 35 THEN '✅ PASS'
    WHEN metric = 'headline_acceptance' THEN '⚠️ FAIL'
    WHEN metric = 'services_acceptance' AND value >= 25 THEN '✅ PASS'
    WHEN metric = 'services_acceptance' THEN '⚠️ FAIL'
    WHEN metric = 'publish_rate_headline' AND value >= 60 THEN '✅ PASS'
    WHEN metric = 'publish_rate_headline' THEN '⚠️ FAIL'
  END as status
FROM metrics
ORDER BY metric;
```

**Expected Output:**
```
metric                      | value | status
----------------------------|-------|--------
headline_acceptance         | 42.9  | ✅ PASS
publish_rate_headline       | 80.0  | ✅ PASS
services_acceptance         | 29.4  | ⚠️ FAIL
```

---

## Execution Checklist (Day-7 Morning)

**Step 1: Staging Validation (10 min)**
- [ ] Run all queries against staging database first
- [ ] Verify output shape matches expected output above
- [ ] Test date range: `CURRENT_DATE - INTERVAL '7 days'` captures full week

**Step 2: Production Execution (15 min)**
- [ ] Run all 9 queries against production (read-only)
- [ ] Document exact run time and data range captured
- [ ] Export results to CSV or Markdown table

**Step 3: Data Entry (10 min)**
- [ ] Fill TELEMETRY_REVIEW_PHASE_3E_A1.md:
  - Section 1️⃣ Acceptance Rate → use Query 1
  - Section 2️⃣ Engagement Funnel → use Queries 2–3
  - Section 3️⃣ Edit Delta → use Query 4
  - Section 4️⃣ Variant Preference → use Query 5
  - Supplementary: Queries 6–8 in notes section

**Step 4: Decision Gates (5 min)**
- [ ] Run Query 9 (automated threshold check)
- [ ] Compare to Go/No-Go criteria in template
- [ ] Flag any anomalies for manual review

**Step 5: Sign-Off (5 min)**
- [ ] Analytics lead: "All queries executed, data validated, no nulls"
- [ ] Product: "Ready for Day-7 decision meeting"

**Total Time:** ~45 minutes (includes double-checks)

---

## Troubleshooting

### Query returns 0 rows
- **Cause:** Events not firing in production
- **Fix:** Check TELEMETRY_VALIDATION_CHECKLIST.md → events are still pending validation
- **Action:** Escalate to DevOps; cannot proceed to decision without data

### NULL values in key fields (field, variant)
- **Cause:** Payload incomplete
- **Fix:** Add `WHERE properties->>'field' IS NOT NULL` to filter
- **Action:** Document which events are malformed; iterate frontend logging

### Dwell times all 0
- **Cause:** Dwell tracking not implemented
- **Fix:** Query is optional; skip if not available
- **Action:** Implement in next phase if needed

### Date range shows no data
- **Cause:** Wrong timezone or date format
- **Fix:** Verify `CURRENT_DATE` returns correct date
- **Action:** Adjust query to explicit date: `WHERE created_at >= '2026-01-01' AND created_at < '2026-01-08'`

---

## Notes

- All queries are **read-only** (no data mutations)
- Test on staging first to avoid prod locks
- Keep query results in version control (CSV export)
- Reuse exact queries on Day-14 for trend tracking
- If event schema changes, update queries immediately
