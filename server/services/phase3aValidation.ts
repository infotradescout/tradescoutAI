/**
 * Phase 3a Validation – Claim Intake Gate
 *
 * RESPONSIBILITIES:
 * - Pre-deployment constraint checks (gate initialization, wiring)
 * - Smoke tests for intake operations (single + batch)
 * - Constraint documentation for operations
 *
 * GOVERNANCE:
 * - All checks are read-only (no data modifications)
 * - Validates that intake gate is properly initialized
 * - Ensures field-only validation method exists
 * - Confirms rate limiter is wired
 */

import { logger } from '../logger.js';
import { getClaimIntakeGate } from './claimIntakeGate.js';
import { ClaimEventValidator } from './claimEventValidator.js';
import { ClaimIntakeRateLimiter } from './claimIntakeRateLimiter.js';
import { ClaimType, ClaimSource } from './claimEventSchema.js';

export interface Phase3aValidationResult {
  valid: boolean;
  checks: Array<{ name: string; ok: boolean; detail?: string }>;
}

export interface Phase3aSmokeTestResult {
  success: boolean;
  testsPassed: number;
  testsFailed: number;
  details: Array<{
    test: string;
    passed: boolean;
    message: string;
  }>;
}

/**
 * Pre-deployment constraint validation
 * Checks:
 * - ClaimIntakeGate is initialized
 * - Validator supports validateFieldsOnly()
 * - Rate limiter is accessible
 */
export async function validatePhase3a(): Promise<Phase3aValidationResult> {
  const checks: Phase3aValidationResult['checks'] = [];

  // Check gate is wired
  try {
    const gate = getClaimIntakeGate();
    checks.push({
      name: 'claimIntakeGate_initialized',
      ok: !!gate,
      detail: gate ? 'Gate is initialized' : 'Gate is null',
    });
  } catch (e: any) {
    checks.push({
      name: 'claimIntakeGate_initialized',
      ok: false,
      detail: `Gate initialization error: ${e?.message ?? String(e)}`,
    });
  }

  // Check validator has validateFieldsOnly method
  try {
    const validator = new ClaimEventValidator();
    const hasFieldsOnly = typeof (validator as any).validateFieldsOnly === 'function';
    checks.push({
      name: 'validator_validateFieldsOnly_exists',
      ok: hasFieldsOnly,
      detail: hasFieldsOnly ? 'Method exists' : 'Method missing',
    });
  } catch (e: any) {
    checks.push({
      name: 'validator_validateFieldsOnly_exists',
      ok: false,
      detail: `Validator error: ${e?.message ?? String(e)}`,
    });
  }

  // Check rate limiter can be instantiated
  try {
    const limiter = new ClaimIntakeRateLimiter();
    const state = limiter.getState();
    checks.push({
      name: 'claimIntakeRateLimiter_initialized',
      ok: !!state,
      detail: `Rate limiter state: ${state.bucketCount} buckets, ${state.totalTimestamps} timestamps`,
    });
  } catch (e: any) {
    checks.push({
      name: 'claimIntakeRateLimiter_initialized',
      ok: false,
      detail: `Rate limiter error: ${e?.message ?? String(e)}`,
    });
  }

  const ok = checks.every((c) => c.ok);
  return { valid: ok, checks };
}

/**
 * Smoke test: Single intake operation
 */
export async function smokeTestIntakeSingle(): Promise<Phase3aSmokeTestResult> {
  const details: Array<{ test: string; passed: boolean; message: string }> = [];

  try {
    const gate = getClaimIntakeGate();

    // Test 1: Intake valid raw claim
    const result = await gate.intake({
      userId: `smoke-test-${Date.now()}`,
      countyFips: '48113',
      claimType: ClaimType.EXPLORING,
      source: ClaimSource.DIRECT_CLAIM,
      claimTimestamp: new Date(),
      channel: 'direct_claim',
      requestId: `smoke-test-${Date.now()}`,
    });

    const test1Passed = result.ok !== undefined;
    details.push({
      test: 'Intake returns valid result object',
      passed: test1Passed,
      message: test1Passed ? 'Result object is valid' : 'Result object is invalid or undefined',
    });

    // Test 2: Verify normalization occurred
    const test2Passed = result.normalized !== undefined && result.normalized.claimType === ClaimType.EXPLORING;
    details.push({
      test: 'Normalization produces ClaimType enum',
      passed: test2Passed,
      message: test2Passed ? `Normalized to ${result.normalized?.claimType}` : 'Normalization failed',
    });

    // Test 3: Verify rate signals are captured
    const test3Passed = Array.isArray(result.rateSignals) && result.rateSignals.length > 0;
    details.push({
      test: 'Rate signals captured',
      passed: test3Passed,
      message: test3Passed ? `${result.rateSignals.length} signals` : 'No rate signals',
    });

    // Test 4: Invalid claimType is rejected
    const invalidResult = await gate.intake({
      userId: `smoke-test-${Date.now()}`,
      countyFips: '48113',
      claimType: 'invalid_type',
      source: ClaimSource.DIRECT_CLAIM,
      claimTimestamp: new Date(),
    });

    const test4Passed = !invalidResult.ok && (invalidResult.validationErrors?.length ?? 0) > 0;
    details.push({
      test: 'Invalid claimType is rejected',
      passed: test4Passed,
      message: test4Passed
        ? `Rejected with errors: ${invalidResult.validationErrors?.join(', ')}`
        : 'Invalid claimType was not rejected',
    });
  } catch (error) {
    details.push({
      test: 'Catch-all error handling',
      passed: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const testsPassed = details.filter((d) => d.passed).length;
  const testsFailed = details.filter((d) => !d.passed).length;

  return {
    success: testsFailed === 0,
    testsPassed,
    testsFailed,
    details,
  };
}

/**
 * Smoke test: Batch intake operation
 */
export async function smokeTestIntakeBatch(): Promise<Phase3aSmokeTestResult> {
  const details: Array<{ test: string; passed: boolean; message: string }> = [];

  try {
    const gate = getClaimIntakeGate();

    // Test 1: Batch of 5 items
    const items = Array.from({ length: 5 }, (_, i) => ({
      userId: `batch-test-${Date.now()}-${i}`,
      countyFips: '48113',
      claimType: ClaimType.EXPLORING,
      source: ClaimSource.IMPORT,
      claimTimestamp: new Date(),
      channel: 'import' as const,
      requestId: `batch-test-${Date.now()}-${i}`,
    }));

    const batchResult = await gate.intakeBatch(items);

    const test1Passed = batchResult.okCount >= 0 && batchResult.failCount >= 0;
    details.push({
      test: 'Batch returns counts (ok/fail/duplicate)',
      passed: test1Passed,
      message: `ok=${batchResult.okCount} fail=${batchResult.failCount} dup=${batchResult.duplicateCount}`,
    });

    // Test 2: Results array matches input size
    const test2Passed = batchResult.results.length === items.length;
    details.push({
      test: 'Batch results array matches input size',
      passed: test2Passed,
      message: `Results: ${batchResult.results.length}, Input: ${items.length}`,
    });

    // Test 3: Each result has expected structure
    const allHaveStructure = batchResult.results.every((r) => typeof r.ok === 'boolean' && Array.isArray(r.rateSignals));
    details.push({
      test: 'Each result has ok flag and rateSignals',
      passed: allHaveStructure,
      message: allHaveStructure ? 'All results have expected structure' : 'Some results missing fields',
    });

    // Test 4: Mixed valid/invalid batch
    const mixedItems = [
      {
        userId: `mixed-${Date.now()}-1`,
        countyFips: '48113',
        claimType: ClaimType.EXPLORING,
        source: ClaimSource.DIRECT_CLAIM,
      },
      {
        userId: `mixed-${Date.now()}-2`,
        countyFips: '48113',
        claimType: 'invalid',
        source: ClaimSource.DIRECT_CLAIM,
      },
    ];

    const mixedResult = await gate.intakeBatch(mixedItems);
    const test4Passed = mixedResult.okCount >= 0 && mixedResult.failCount > 0;
    details.push({
      test: 'Mixed batch (1 valid, 1 invalid) processes correctly',
      passed: test4Passed,
      message: `ok=${mixedResult.okCount} fail=${mixedResult.failCount}`,
    });
  } catch (error) {
    details.push({
      test: 'Catch-all error handling',
      passed: false,
      message: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const testsPassed = details.filter((d) => d.passed).length;
  const testsFailed = details.filter((d) => !d.passed).length;

  return {
    success: testsFailed === 0,
    testsPassed,
    testsFailed,
    details,
  };
}

/**
 * Full Phase 3a smoke test suite
 */
export async function smokeTestAllPhase3a(): Promise<{
  allPassed: boolean;
  results: Array<{
    suite: string;
    passed: boolean;
    result: Phase3aSmokeTestResult;
  }>;
}> {
  const results: Array<{ suite: string; passed: boolean; result: Phase3aSmokeTestResult }> = [];

  logger.info('Starting Phase 3a smoke tests...');

  // Test 1: Single intake
  logger.info('Running single intake smoke tests...');
  const singleResult = await smokeTestIntakeSingle();
  results.push({
    suite: 'Single Intake',
    passed: singleResult.success,
    result: singleResult,
  });

  // Test 2: Batch intake
  logger.info('Running batch intake smoke tests...');
  const batchResult = await smokeTestIntakeBatch();
  results.push({
    suite: 'Batch Intake',
    passed: batchResult.success,
    result: batchResult,
  });

  const allPassed = results.every((r) => r.passed);
  logger.info(`Phase 3a smoke tests completed. Result: ${allPassed ? 'PASSED' : 'FAILED'}`);

  return {
    allPassed,
    results,
  };
}

/**
 * Print Phase 3a locks and constraints to console
 */
export function printPhase3aLocks(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('        PHASE 3a LOCKS – CLAIM INTAKE GATE INFRASTRUCTURE        ');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('ARCHITECTURE:');
  console.log('  ✓ Single entrypoint: ClaimIntakeGate (intake + intakeBatch)');
  console.log('  ✓ Normalization: claimType/source validated to enums');
  console.log('  ✓ Field-only precheck: validators before write');
  console.log('  ✓ Rate discipline: warning-only, no hard blocking\n');

  console.log('FLOW (intake):');
  console.log('  1. Normalize claimType/source (string → enum)');
  console.log('  2. Rate check (warn-only signals, advisory)');
  console.log('  3. Field-only validation (format/enum checks)');
  console.log('  4. Write via service (full validation + persistence)');
  console.log('  5. Dark telemetry (logs, no UI/metrics endpoints)\n');

  console.log('RATE LIMITS (Phase 3a defaults, advisory):');
  console.log('  - per_user_5min: max 10 claims (warnOnly)');
  console.log('  - per_county_5min: max 200 claims (warnOnly)');
  console.log('  - global_1min: max 2,000 claims (warnOnly)\n');

  console.log('VALIDATION:');
  console.log('  ✓ Field-only (no DB reads in precheck)');
  console.log('  ✓ Format checks: FIPS, timestamp future/past');
  console.log('  ✓ Enum validation: claim types, sources');
  console.log('  ✓ Metadata shape check: plain object, no reserved keys\n');

  console.log('CHANNELS (diagnostic context):');
  console.log('  - signup: From onboarding completion');
  console.log('  - direct_claim: User claims directly in app');
  console.log('  - import: From backfill/replay job');
  console.log('  - admin: From admin OS\n');

  console.log('BATCH PROCESSING:');
  console.log('  ✓ Sequential by default (predictable, safe)');
  console.log('  ✓ Parallelization after dark telemetry is stable');
  console.log('  ✓ Large batch warning (>=100 items)\n');

  console.log('DARK TELEMETRY (logs only, no UI):');
  console.log('  - claim_intake_written: New claim persisted');
  console.log('  - claim_intake_duplicate: Idempotent duplicate detected');
  console.log('  - claim_intake_write_failed: Write failed (validation/DB)');
  console.log('  - claim_intake_field_validation_failed: Precheck failed');
  console.log('  - claim_intake_rate_warning: Rate limit signal exceeded');
  console.log('  - claim_intake_batch_complete: Batch processing finished\n');

  console.log('GOVERNANCE:');
  console.log('  ✓ Claim writes disabled by default (CLAIM_WRITES_ENABLED=false)');
  console.log('  ✓ Stays dark 7–14 days minimum before exposure');
  console.log('  ✓ Gate is jobs-only (no HTTP routes added)');
  console.log('  ✓ No UI reads of intake gate');
  console.log('  ✓ Metrics remain independent (Phase 2b unaffected)\n');

  console.log('NEXT STEPS:');
  console.log('  → Phase 3b: Backfill Simulation (replay historical signups)');
  console.log('  → Phase 3c: Dark Period Monitoring (7–14 days clean deltas)');
  console.log('  → Phase 3d: Phase 3+1 Exposure (Scout integration, incentives)\n');

  console.log('════════════════════════════════════════════════════════════════\n');
}
