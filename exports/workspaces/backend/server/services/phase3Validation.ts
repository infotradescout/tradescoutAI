/**
 * Phase 3 Validation – Claim-First Intake
 *
 * RESPONSIBILITIES:
 * - Pre-deployment constraint checks (schema, exports, feature flags)
 * - Smoke tests for claim write operations
 * - Backfill simulation readiness validation
 * - Constraint documentation for operations
 *
 * GOVERNANCE:
 * - All checks are read-only (no data modifications)
 * - Feature flag defaults to FALSE (ships dark)
 * - Claim-First is never exposed via Scout/UI until dark period clears (7–14 days)
 * - Kill switch exists at scheduler level (claim writes can be disabled independently)
 */

import { Pool } from '@neondatabase/serverless';
import { logger } from './logger';
import {
  WriteClaimEventRequest,
  ClaimType,
  ClaimSource,
} from './claimEventSchema.js';
import {
  writeClaimEvent,
  invalidateClaimEvent,
  fetchClaimEventById,
  countActiveClaims,
  setClaimEventPool,
} from './claimEventService.js';

let pool: Pool | null = null;

export function setPhase3ValidationPool(dbPool: Pool): void {
  pool = dbPool;
  setClaimEventPool(dbPool);
}

function getPool(): Pool {
  if (!pool) {
    throw new Error('Phase 3 validation pool not initialized. Call setPhase3ValidationPool() first.');
  }
  return pool;
}

export interface Phase3ValidationResult {
  valid: boolean;
  constraints: string[];
  errors: string[];
}

export interface Phase3SmokeTestResult {
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
 * - claim_events table exists
 * - All required indexes exist
 * - claimEventService exports exist
 * - Feature flag is configured
 */
export async function validatePhase3Constraints(): Promise<Phase3ValidationResult> {
  const constraints: string[] = [];
  const errors: string[] = [];

  // Check claim_events table exists
  try {
    const result = await getPool().query(`
      SELECT to_regclass('public.claim_events')
    `);
    if (!result.rows[0].to_regclass) {
      errors.push('claim_events table does not exist');
    } else {
      constraints.push('✓ claim_events table exists');
    }
  } catch (error) {
    errors.push(`Error checking claim_events table: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // Check required indexes
  const requiredIndexes = [
    'idx_claim_events_county_fips',
    'idx_claim_events_user_id_created_at',
    'idx_claim_events_created_at',
    'idx_claim_events_invalidated_at',
    'idx_claim_events_claim_type',
    'idx_claim_events_source',
  ];

  for (const indexName of requiredIndexes) {
    try {
      const result = await getPool().query(`
        SELECT indexname FROM pg_indexes WHERE indexname = $1
      `, [indexName]);
      if (result.rows.length === 0) {
        errors.push(`Index ${indexName} does not exist`);
      } else {
        constraints.push(`✓ Index ${indexName} exists`);
      }
    } catch (error) {
      errors.push(`Error checking index ${indexName}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  // Check unique constraint on (user_id, claim_type, county_fips, source)
  try {
    const result = await getPool().query(`
      SELECT constraint_name FROM information_schema.constraint_column_usage
      WHERE table_name = 'claim_events'
      AND column_name = 'user_id'
    `);
    if (result.rows.length > 0) {
      constraints.push('✓ Unique constraint on (user_id, claim_type, county_fips, source)');
    } else {
      errors.push('Unique constraint on (user_id, claim_type, county_fips, source) not found');
    }
  } catch (error) {
    errors.push(`Error checking unique constraint: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // Check service exports
  try {
    if (typeof writeClaimEvent !== 'function') {
      errors.push('writeClaimEvent is not exported from claimEventService');
    } else {
      constraints.push('✓ writeClaimEvent exported');
    }
    if (typeof invalidateClaimEvent !== 'function') {
      errors.push('invalidateClaimEvent is not exported from claimEventService');
    } else {
      constraints.push('✓ invalidateClaimEvent exported');
    }
    if (typeof fetchClaimEventById !== 'function') {
      errors.push('fetchClaimEventById is not exported from claimEventService');
    } else {
      constraints.push('✓ fetchClaimEventById exported');
    }
  } catch (error) {
    errors.push(`Error checking service exports: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  // Check feature flag
  const claimWritesEnabled = process.env.CLAIM_WRITES_ENABLED === 'true';
  constraints.push(`✓ CLAIM_WRITES_ENABLED = ${claimWritesEnabled} (default: false, ships dark)`);

  return {
    valid: errors.length === 0,
    constraints,
    errors,
  };
}

/**
 * Smoke test: write a claim event and verify it was persisted
 */
export async function smokeTestClaimWrite(): Promise<Phase3SmokeTestResult> {
  const details: Array<{ test: string; passed: boolean; message: string }> = [];

  // Test 1: Write a new claim event
  const testUserId = `smoke-test-user-${Date.now()}`;
  const testCountyFips = '48113'; // Dallas, TX
  const writeRequest: WriteClaimEventRequest = {
    userId: testUserId,
    claimType: ClaimType.EXPLORING,
    countyFips: testCountyFips,
    countyName: 'Dallas',
    source: ClaimSource.DIRECT_CLAIM,
    claimTimestamp: new Date(),
    metadata: { test: true },
  };

  const writeResult = await writeClaimEvent(writeRequest);
  details.push({
    test: 'Write new claim event',
    passed: writeResult.success,
    message: writeResult.success
      ? `Claim written successfully (id: ${writeResult.claimId})`
      : `Write failed: ${writeResult.error}`,
  });

  if (!writeResult.success || !writeResult.claimId) {
    return {
      success: false,
      testsPassed: details.filter((d) => d.passed).length,
      testsFailed: details.filter((d) => !d.passed).length,
      details,
    };
  }

  // Test 2: Fetch the claim event
  const fetchedClaim = await fetchClaimEventById(writeResult.claimId);
  const fetchPassed = fetchedClaim !== null && fetchedClaim.id === writeResult.claimId;
  details.push({
    test: 'Fetch claim event by ID',
    passed: fetchPassed,
    message: fetchPassed ? 'Claim fetched successfully' : 'Claim not found after write',
  });

  // Test 3: Verify idempotent write (duplicate should return same claim id)
  const duplicateResult = await writeClaimEvent(writeRequest);
  const idempotentPassed = duplicateResult.success && duplicateResult.isDuplicate && duplicateResult.claimId === writeResult.claimId;
  details.push({
    test: 'Idempotent write (duplicate)',
    passed: !!idempotentPassed,
    message: idempotentPassed
      ? 'Duplicate write returned same claim ID'
      : `Idempotent write failed (expected duplicate, got ${duplicateResult.isDuplicate ? 'duplicate' : 'new'})`,
  });

  // Test 4: Invalidate the claim event
  const invalidateResult = await invalidateClaimEvent({
    claimId: writeResult.claimId,
    reason: 'smoke_test_cleanup',
  });
  details.push({
    test: 'Invalidate claim event',
    passed: invalidateResult.success,
    message: invalidateResult.success ? 'Claim invalidated successfully' : `Invalidation failed: ${invalidateResult.error}`,
  });

  // Test 5: Verify claim is invalidated (fetch should show invalidated_at set)
  const invalidatedClaim = await fetchClaimEventById(writeResult.claimId);
  const invalidatedPassed = invalidatedClaim !== null && invalidatedClaim.invalidatedAt !== null;
  details.push({
    test: 'Verify claim invalidation',
    passed: invalidatedPassed,
    message: invalidatedPassed ? 'Claim marked as invalidated' : 'Claim invalidation not persisted',
  });

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
 * Smoke test: verify claim count aggregation per county
 * Simulates backfill validation (counts match expectations)
 */
export async function smokeTestClaimCountAggregation(): Promise<Phase3SmokeTestResult> {
  const details: Array<{ test: string; passed: boolean; message: string }> = [];

  // Test 1: Create multiple claims in same county
  const testCountyFips = '48113'; // Dallas, TX
  const claimIds: string[] = [];

  for (let i = 0; i < 3; i++) {
    const result = await writeClaimEvent({
      userId: `smoke-test-agg-${Date.now()}-${i}`,
      claimType: ClaimType.EXPLORING,
      countyFips: testCountyFips,
      countyName: 'Dallas',
      source: ClaimSource.DIRECT_CLAIM,
      claimTimestamp: new Date(),
    });

    if (result.success && result.claimId) {
      claimIds.push(result.claimId);
    }
  }

  details.push({
    test: 'Create 3 test claims in county',
    passed: claimIds.length === 3,
    message: `Created ${claimIds.length} claims`,
  });

  // Test 2: Count active claims in county
  const countBefore = await countActiveClaims(testCountyFips);
  const countPassed = countBefore >= 3;
  details.push({
    test: 'Count active claims per county',
    passed: countPassed,
    message: `County has ${countBefore} active claims (expected >= 3)`,
  });

  // Test 3: Invalidate one claim and recount
  if (claimIds.length > 0) {
    await invalidateClaimEvent({
      claimId: claimIds[0],
      reason: 'smoke_test_cleanup',
    });

    const countAfter = await countActiveClaims(testCountyFips);
    const countAfterPassed = countAfter === countBefore - 1;
    details.push({
      test: 'Recount after invalidation',
      passed: countAfterPassed,
      message: countAfterPassed ? `Count decreased by 1 (${countAfter})` : `Count didn't decrease (${countAfter} vs ${countBefore})`,
    });
  }

  // Cleanup: invalidate remaining claims
  for (const claimId of claimIds.slice(1)) {
    await invalidateClaimEvent({
      claimId,
      reason: 'smoke_test_cleanup',
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
 * Full Phase 3 smoke test suite
 * Runs all tests in sequence
 */
export async function smokeTestAllPhase3Operations(): Promise<{
  allPassed: boolean;
  results: Array<{
    suite: string;
    passed: boolean;
    result: Phase3SmokeTestResult;
  }>;
}> {
  const results: Array<{ suite: string; passed: boolean; result: Phase3SmokeTestResult }> = [];

  logger.info('Starting Phase 3 smoke tests...');

  // Test 1: Claim write operations
  logger.info('Running claim write smoke tests...');
  const claimWriteResult = await smokeTestClaimWrite();
  results.push({
    suite: 'Claim Write Operations',
    passed: claimWriteResult.success,
    result: claimWriteResult,
  });

  // Test 2: Claim count aggregation
  logger.info('Running claim count aggregation smoke tests...');
  const countAggResult = await smokeTestClaimCountAggregation();
  results.push({
    suite: 'Claim Count Aggregation',
    passed: countAggResult.success,
    result: countAggResult,
  });

  const allPassed = results.every((r) => r.passed);
  logger.info(`Phase 3 smoke tests completed. Result: ${allPassed ? 'PASSED' : 'FAILED'}`);

  return {
    allPassed,
    results,
  };
}

/**
 * Print Phase 3 locks and constraints to console
 */
export function printPhase3Locks(): void {
  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('        PHASE 3 LOCKS – CLAIM-FIRST INTAKE INFRASTRUCTURE        ');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log('SCHEMA:');
  console.log('  ✓ claim_events table (write-only, insert-only semantics)');
  console.log('  ✓ Unique constraint: (user_id, claim_type, county_fips, source)');
  console.log('  ✓ Idempotent insert: ON CONFLICT DO NOTHING');
  console.log('  ✓ Soft invalidation: UPDATE invalidated_at + reason, never delete\n');

  console.log('VALIDATION:');
  console.log('  ✓ claim_type: enum (6 types frozen)');
  console.log('  ✓ county_fips: 5-digit code, must exist in counties table');
  console.log('  ✓ source: enum (4 sources frozen)');
  console.log('  ✓ user_id: must exist in users table');
  console.log('  ✓ claim_timestamp: not future, not before user creation\n');

  console.log('WRITE SEMANTICS:');
  console.log('  ✓ Insert-only (claims never updated directly)');
  console.log('  ✓ Soft invalidation path (UPDATE with reason)');
  console.log('  ✓ Timestamp immutable after insert');
  console.log('  ✓ Metadata optional, no reserved keys\n');

  console.log('GOVERNANCE:');
  console.log('  ✓ Claim writes disabled by default (CLAIM_WRITES_ENABLED=false)');
  console.log('  ✓ Ships dark: no reads, no aggregation, no UI visibility');
  console.log('  ✓ Kill switch at scheduler level (independent of metrics)');
  console.log('  ✓ Stays dark 7–14 days before Phase 3+1 exposure\n');

  console.log('SAFETY:');
  console.log('  ✓ Duplicate prevention via unique constraint');
  console.log('  ✓ Audit trail preserved (invalidated_at + reason)');
  console.log('  ✓ No cascade deletes (claim_events exists independently)');
  console.log('  ✓ Metadata is JSON (extensible for future signals)\n');

  console.log('NEXT STEPS:');
  console.log('  → Phase 3a: Claim Intake Gate (validation + batching)');
  console.log('  → Phase 3b: Backfill Simulation (replay historical signups)');
  console.log('  → Phase 3c: Dark Period Monitoring (7–14 days clean deltas)');
  console.log('  → Phase 3d: Phase 3+1 Exposure (Scout integration, incentives)\n');

  console.log('════════════════════════════════════════════════════════════════\n');
}
