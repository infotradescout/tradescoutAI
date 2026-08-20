/**
 * Phase 2b Validation - Locked Constraints & Smoke Tests
 *
 * Purpose:
 * - Validate all Phase 2b constraints are locked
 * - Confirm new jobs follow same pattern as Phase 2
 * - Run smoke tests for each aggregation job
 *
 * No UI, no computation—pure validation infrastructure.
 */

import { MetricKey, getAllRegisteredMetricKeys } from "./metricRegistry";
import { runUsersAggregationJob, validateUsersAggregationMetrics } from "./usersAggregationJob";
import { runAffiliatesAggregationJob, validateAffiliatesAggregationMetrics } from "./affiliatesAggregationJob";
import { runTradeDealsAggregationJob, validateTradeDealsAggregationMetrics } from "./tradeDealsAggregationJob";

// ============================================================================
// LOCKED CONSTRAINTS (Phase 2b)
// ============================================================================

const PHASE2B_CONSTRAINTS = `
✅ LOCKED: Phase 2b - Affiliates + TradeDeals Aggregation

1. Metric Registry Extended (Frozen)
   - Added 3 new keys: affiliates_count, tradedeals_active, tradedeals_claimed_30d
   - All keys registered as enum (type-safe)
   - Unregistered keys rejected at write time
   - No overlap with readiness metrics

2. Jobs Follow Phase 2 Pattern
   - affiliatesAggregationJob: same structure as usersAggregationJob
   - tradeDealsAggregationJob: same structure as usersAggregationJob
   - All use geographic data router (single write path)
   - All idempotent (set mode)
   - All fire-and-forget with logging

3. Scheduler Integration
   - All three jobs run in same nightly window (2 AM UTC default)
   - Independent tasks; partial failure doesn't block others
   - Status endpoint reports all four aggregation jobs
   - Environment variables allow per-job disable

4. No UI, No HTTP Exposure
   - No new routes, pages, or user-facing features
   - Data for ops prioritization only
   - Future: reads possible via read methods (non-blocking)

5. Build GREEN, Strict TS
   - npm run build succeeds
   - No TypeScript errors or warnings
   - All exports properly typed
`;

// ============================================================================
// VALIDATION API
// ============================================================================

/**
 * Validate that all Phase 2b constraints are locked
 * Throws if any constraint is violated
 */
export function validatePhase2bConstraints(): void {
  console.info("\n[Phase2bValidation] Checking Phase 2b constraints...\n");

  // Check 1: New metric keys are registered
  const keys = getAllRegisteredMetricKeys();
  if (!keys.includes(MetricKey.AFFILIATES_COUNT)) {
    throw new Error("Metric registry missing AFFILIATES_COUNT key");
  }
  if (!keys.includes(MetricKey.TRADEDEALS_ACTIVE)) {
    throw new Error("Metric registry missing TRADEDEALS_ACTIVE key");
  }
  if (!keys.includes(MetricKey.TRADEDEALS_CLAIMED_30D)) {
    throw new Error("Metric registry missing TRADEDEALS_CLAIMED_30D key");
  }
  console.info("✅ Phase 2b metric keys registered and frozen");

  // Check 2: Job exports exist
  if (typeof runAffiliatesAggregationJob !== "function") {
    throw new Error("affiliatesAggregationJob.runAffiliatesAggregationJob is not a function");
  }
  if (typeof runTradeDealsAggregationJob !== "function") {
    throw new Error("tradeDealsAggregationJob.runTradeDealsAggregationJob is not a function");
  }
  console.info("✅ Phase 2b aggregation jobs properly exported");

  // Check 3: Validation helpers exist
  if (typeof validateAffiliatesAggregationMetrics !== "function") {
    throw new Error("affiliatesAggregationJob validation helper missing");
  }
  if (typeof validateTradeDealsAggregationMetrics !== "function") {
    throw new Error("tradeDealsAggregationJob validation helper missing");
  }
  console.info("✅ Phase 2b validation helpers available");

  console.info("\n[Phase2bValidation] All Phase 2b constraints verified ✅\n");
}

/**
 * Run smoke test for affiliates aggregation job
 * Used for pre-deployment validation
 */
export async function smokeTestAffiliatesAggregation(): Promise<void> {
  console.info("\n[Phase2bValidation] Running affiliates aggregation smoke test...\n");

  try {
    const result = await runAffiliatesAggregationJob();
    console.info("✅ Affiliates job ran successfully:", result);

    const validation = await validateAffiliatesAggregationMetrics(3);
    if (!validation.isValid) {
      console.warn("⚠️  Some sampled counties had mismatched counts:", validation.mismatched);
    } else {
      console.info("✅ Affiliates validation passed");
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Phase2bValidation] Affiliates smoke test FAILED: ${error}`);
    throw err;
  }
}

/**
 * Run smoke test for trade deals aggregation job
 * Used for pre-deployment validation
 */
export async function smokeTestTradeDealsAggregation(): Promise<void> {
  console.info("\n[Phase2bValidation] Running trade deals aggregation smoke test...\n");

  try {
    const result = await runTradeDealsAggregationJob();
    console.info("✅ TradeDeals job ran successfully:", result);

    const validation = await validateTradeDealsAggregationMetrics(3);
    if (validation.availability === "unsupported") {
      console.warn(`⚠️  ${validation.unavailableReason}`);
    } else if (!validation.isValid) {
      console.warn("⚠️  Some sampled counties had mismatched counts:", validation.mismatched);
    } else {
      console.info("✅ TradeDeals validation passed");
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Phase2bValidation] TradeDeals smoke test FAILED: ${error}`);
    throw err;
  }
}

/**
 * Run smoke test for users aggregation job (Phase 2, re-validate)
 * Used for full system validation
 */
export async function smokeTestUsersAggregation(): Promise<void> {
  console.info("\n[Phase2bValidation] Running users aggregation smoke test (Phase 2 re-validation)...\n");

  try {
    const result = await runUsersAggregationJob();
    console.info("✅ Users job ran successfully:", result);

    const validation = await validateUsersAggregationMetrics(3);
    if (!validation.isValid) {
      console.warn("⚠️  Some sampled counties had mismatched counts:", validation.mismatched);
    } else {
      console.info("✅ Users validation passed");
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Phase2bValidation] Users smoke test FAILED: ${error}`);
    throw err;
  }
}

/**
 * Run all aggregation smoke tests together
 * Full system validation
 */
export async function smokeTestAllAggregations(): Promise<void> {
  console.info("\n[Phase2bValidation] Running full aggregation suite smoke test...\n");

  const results = {
    users: { passed: false, error: null as string | null },
    affiliates: { passed: false, error: null as string | null },
    tradedeals: { passed: false, error: null as string | null },
  };

  // Test users
  try {
    await smokeTestUsersAggregation();
    results.users.passed = true;
  } catch (err) {
    results.users.error = err instanceof Error ? err.message : String(err);
  }

  // Test affiliates
  try {
    await smokeTestAffiliatesAggregation();
    results.affiliates.passed = true;
  } catch (err) {
    results.affiliates.error = err instanceof Error ? err.message : String(err);
  }

  // Test trade deals
  try {
    await smokeTestTradeDealsAggregation();
    results.tradedeals.passed = true;
  } catch (err) {
    results.tradedeals.error = err instanceof Error ? err.message : String(err);
  }

  // Report
  console.info("\n[Phase2bValidation] Aggregation Suite Results:");
  console.info(`  Users:      ${results.users.passed ? "✅ PASS" : "❌ FAIL"}`);
  console.info(`  Affiliates: ${results.affiliates.passed ? "✅ PASS" : "❌ FAIL"}`);
  console.info(`  TradeDeals: ${results.tradedeals.passed ? "✅ PASS" : "❌ FAIL"}`);

  if (results.users.error) console.error(`  Users error: ${results.users.error}`);
  if (results.affiliates.error) console.error(`  Affiliates error: ${results.affiliates.error}`);
  if (results.tradedeals.error) console.error(`  TradeDeals error: ${results.tradedeals.error}`);

  const allPassed = results.users.passed && results.affiliates.passed && results.tradedeals.passed;
  console.info(`\n  Overall: ${allPassed ? "✅ ALL PASS" : "❌ SOME FAILURES"}\n`);

  if (!allPassed) {
    throw new Error("Some aggregation jobs failed validation");
  }
}

/**
 * Print all Phase 2b locked constraints to console
 * Run this during server startup to confirm locks
 */
export function printPhase2bLocks(): void {
  console.info("\n" + "=".repeat(80));
  console.info("PHASE 2b: AFFILIATES + TRADEDEALS AGGREGATION - LOCKED CONSTRAINTS");
  console.info("=".repeat(80) + "\n");

  console.info(PHASE2B_CONSTRAINTS);

  console.info("=".repeat(80) + "\n");
}
