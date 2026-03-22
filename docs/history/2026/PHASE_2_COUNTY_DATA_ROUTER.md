# Phase 2: County Data Router Implementation

**Status**: ✅ COMPLETE AND LOCKED  
**Scope**: Users first (no UX blast radius, high compounding value)  
**Date**: January 1, 2026

---

## Overview

Phase 2 implements a County Data Router—a write-only metric storage layer that allows job-based aggregation of facts about counties without influencing readiness decisions or user-facing behavior.

### Why It Works

1. **Zero UX Impact**: No UI, no routing, no user-visible changes
2. **Jobs-Only Access**: Router is callable by background jobs only
3. **Readiness Safe**: Counties remain the authority; readiness logic untouched
4. **High Compounding Value**: Facts accumulate over time for SEO, AI context, operations
5. **Auditable**: All writes logged with source for traceability

---

## Locked Constraints

### 1. Metric Registry (Canonical)

**File**: [server/services/metricRegistry.ts](server/services/metricRegistry.ts)

**Registered Keys** (frozen for Phase 2):
- `users_total` — Total count of users in county
- `users_verified` — Count of verified users
- `contractors_total` — Count of contractors
- `homeowners_total` — Count of homeowners

**Behavior**:
- All keys are enum values; unregistered keys are rejected at write time
- Each metric has validation rules (type, range, negative acceptance)
- Adding new keys requires explicit code change + approval

**API**:
```typescript
isMetricKeyRegistered(key: string): boolean
validateMetricValue(key: MetricKey, value: number): void
validateFipsCode(fips: string): void
```

---

### 2. Geographic Data Router (Write-Only)

**File**: [server/services/geographicDataRouter.ts](server/services/geographicDataRouter.ts)

**Purpose**: Single write path for county metrics.

**Entry Points**:
- `writeMetric(req)` — Write one metric snapshot
- `writeMetricsBatch(reqs)` — Write multiple metrics (all-or-nothing)
- `readMetric(fips, key)` — Read one metric (nullable)
- `readCountyMetrics(fips)` — Read all metrics for county

**Validation Flow**:
1. Validate metric key against registry (unregistered → error)
2. Validate value type and range (out-of-bounds → error)
3. Validate FIPS code (invalid format → error)
4. Verify county exists in counties table (not found → error)
5. Upsert into county_metrics using PostgreSQL ON CONFLICT
6. Log write with source for auditability

**Example**:
```typescript
const snapshot = await writeMetric({
  source: "users_aggregation_job",
  metricKey: MetricKey.USERS_TOTAL,
  countyFips: "06001",
  value: 5234,
  mode: "set",
  asOf: new Date(),
});
```

---

### 3. Nightly Users Aggregation Job

**File**: [server/services/usersAggregationJob.ts](server/services/usersAggregationJob.ts)

**Purpose**: Compute per-county user aggregates nightly.

**Behavior**:
- Runs on schedule: `0 2 * * *` (2 AM UTC daily, configurable)
- Groups users by county_fips
- Counts: total, verified, contractors, homeowners
- Writes four metrics per county in "set" mode (idempotent)
- Fire-and-forget: logs success/errors, continues on partial failure

**Entry Points**:
- `runUsersAggregationJob()` — Execute the job
- `validateUsersAggregationMetrics(sampleSize)` — Acceptance test

**Example Output**:
```
[UsersAggregationJob] Aggregated 58 counties
[UsersAggregationJob] Metric written {
  source: "users_aggregation_job",
  metricKey: "users_total",
  countyFips: "06001",
  value: 5234,
  timestamp: "2026-01-01T02:00:00Z"
}
[UsersAggregationJob] completed {
  counties: 58,
  metricsRequested: 232,
  metricsWritten: 232,
  errors: 0
}
```

---

### 4. Scheduler Integration

**File**: [server/services/crawlerScheduler.ts](server/services/crawlerScheduler.ts)

**Changes**:
- Added `startUsersAggregationScheduler()` (called during startup)
- Updated `stopCrawlerScheduler()` to stop both crawler + users aggregation
- Updated `getCrawlerSchedulerStatus()` to report both tasks

**Environment Variables**:
- `USERS_AGGREGATION_SCHEDULE` — Cron schedule (default: `0 2 * * *`)
- `DISABLE_USERS_AGGREGATION` — Set to `"true"` to disable job

---

### 5. Validation & Guardrails

**File**: [server/services/phase2Validation.ts](server/services/phase2Validation.ts)

**Locked Constraints** (printed on startup):
1. Router is job-only (no HTTP routes expose writes)
2. No overlap with readiness engine
3. Metric registry is frozen (registration-only)
4. Build must stay GREEN

**Entry Points**:
- `validatePhase2Constraints()` — Check all locks
- `smokeTestMetricRoundTrip()` — End-to-end test
- `printPhase2Locks()` — Display constraints on console

---

## Table Structure

**county_metrics** (existing, no schema changes):
```sql
CREATE TABLE county_metrics (
  county_fips VARCHAR(5) NOT NULL,
  metric_key VARCHAR(64) NOT NULL,
  metric_value NUMERIC(20, 4) NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (county_fips, metric_key)
);
```

**No changes to**:
- counties table (untouched)
- county_notes table (untouched)
- county_entities table (untouched)
- Any readiness-related fields

---

## Acceptance Criteria

### ✅ Metric Registry

- [x] Four keys registered (users_total, users_verified, contractors_total, homeowners_total)
- [x] Unregistered keys rejected at write time
- [x] Each key has validation rules
- [x] Registry is enum-based (type-safe)

### ✅ Geographic Data Router

- [x] Callable by jobs only (no public HTTP routes)
- [x] Validates key against registry
- [x] Validates value type and range
- [x] Validates FIPS code and county existence
- [x] Upserts using PostgreSQL ON CONFLICT
- [x] All writes logged with source
- [x] All reads nullable or empty-array

### ✅ Users Aggregation Job

- [x] Runs on nightly schedule (2 AM)
- [x] Groups users by county_fips
- [x] Counts: total, verified, contractors, homeowners
- [x] Writes four metrics per county
- [x] Idempotent (set mode)
- [x] Fire-and-forget (continues on partial failure)
- [x] Validation: counts match DB for 3 sampled counties

### ✅ Build Status

- [x] npm run build succeeds
- [x] No TypeScript errors
- [x] No new warnings
- [x] All exports properly typed

---

## How to Verify

### 1. Check Metric Registry is Locked

```bash
grep -A 20 "enum MetricKey" server/services/metricRegistry.ts
# Should show: users_total, users_verified, contractors_total, homeowners_total
```

### 2. Verify No HTTP Routes Expose Writes

```bash
grep -r "writeMetric" server/routes/
# Should return: no results
```

### 3. Test the Router

```typescript
import { writeMetric, readMetric } from "server/services/geographicDataRouter";
import { MetricKey } from "server/services/metricRegistry";

// This will work (registered key, valid value, valid FIPS)
const result = await writeMetric({
  source: "test",
  metricKey: MetricKey.USERS_TOTAL,
  countyFips: "06001",
  value: 100,
  mode: "set",
});

// This will fail (unregistered key)
await writeMetric({
  source: "test",
  metricKey: "fake_metric" as any,
  countyFips: "06001",
  value: 100,
  mode: "set",
}); // Error: Unregistered metric key
```

### 4. Validate Users Aggregation Job

```typescript
import { runUsersAggregationJob, validateUsersAggregationMetrics } from "server/services/usersAggregationJob";

// Run job
const result = await runUsersAggregationJob();
console.log(result); // { timestamp, sampledCounties, totalRecordsProcessed, metricsWritten, errors }

// Validate counts match
const validation = await validateUsersAggregationMetrics(3);
console.log(validation); // { isValid, sampledCounties, matched, mismatched }
```

---

## Next Steps (Optional)

After Phase 2 validates successfully:

1. **Phase 2b**: Add Affiliates/TradeDeals aggregation jobs (same pattern)
2. **Phase 3**: Claim-First Signup (independent from Phase 2)
3. **Monitoring**: Add observability dashboards for metric writes
4. **Caching**: Add Redis layer for frequently-read metrics (if needed)

---

## Locked Files

- [server/services/metricRegistry.ts](server/services/metricRegistry.ts)
- [server/services/geographicDataRouter.ts](server/services/geographicDataRouter.ts)
- [server/services/usersAggregationJob.ts](server/services/usersAggregationJob.ts)
- [server/services/crawlerScheduler.ts](server/services/crawlerScheduler.ts) (updated)
- [server/services/phase2Validation.ts](server/services/phase2Validation.ts)

**Note**: These files are locked per the Phase 2 scope. Changes require explicit approval.

---

## Contact

For questions or clarifications, refer to the copilot-instructions.md (Phase 2 section).
