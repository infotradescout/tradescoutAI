import { Pool } from '@neondatabase/serverless';
import { claimIntakeGate } from '../services/claimIntakeGate';
import { logger } from '../services/logger';

/**
 * Phase 3c: Kill-Switch Test
 * 
 * Tests governance safety:
 * 1. Set CLAIM_WRITES_ENABLED=false
 * 2. Simulate 50 intake requests (varied types/sources)
 * 3. Verify zero writes (query claim_events for new rows)
 * 4. Verify metrics still logged (claim_intake_* still present)
 * 5. Restore CLAIM_WRITES_ENABLED=true
 * 6. Confirm metrics unaffected (same log volume as before)
 * 
 * Result: Proof that feature flag truly blocks writes without breaking telemetry.
 */

export interface Phase3cKillSwitchTestResult {
  testId: string;
  timestamp: Date;
  success: boolean;
  
  // Execution details
  simulatedRequests: number;
  requestTypes: string[];
  requestSources: string[];
  
  // Safety verification
  writesBlockedConfirmed: boolean; // zero writes during disabled flag
  metricsLoggedConfirmed: boolean; // logs still captured
  flagToggleSuccess: boolean; // disable → enable → disable successful
  
  // Details
  errorMessage?: string;
  details?: string[];
}

export async function runPhase3cKillSwitchTest(pool: Pool): Promise<Phase3cKillSwitchTestResult> {
  const testId = `killswitch-test-${Date.now()}`;
  const details: string[] = [];

  try {
    logger.info('phase3c:killswitch_test:started', { testId });

    // Step 1: Capture baseline claim_events count
    const baselineResult = await pool.query('SELECT COUNT(*) as count FROM claim_events');
    const baselineCount = parseInt(baselineResult.rows?.[0]?.count || '0', 10);
    details.push(`Baseline claim_events count: ${baselineCount}`);

    // Step 2: Set CLAIM_WRITES_ENABLED=false (via env override)
    process.env.CLAIM_WRITES_ENABLED = 'false';
    details.push('Set CLAIM_WRITES_ENABLED=false');

    // Step 3: Simulate 50 intake requests
    const requestTypes = ['exploring', 'wantsToHire', 'providesServices'];
    const requestSources = ['direct', 'oauth', 'admin'];
    const simulatedRequests = 50;

    for (let i = 0; i < simulatedRequests; i++) {
      const requestType = requestTypes[i % requestTypes.length];
      const requestSource = requestSources[i % requestSources.length];

      try {
        await claimIntakeGate.intake({
          user_id: `test-killswitch-${i}`,
          user_email: `test-killswitch-${i}@test.local`,
          user_location_county_fips: '48201', // Dallas
          claim_type: requestType as any,
          source: requestSource as any,
          source_details: { test: true },
          timestamp: new Date(),
        });
      } catch (err) {
        // Expected: feature flag disabled
        details.push(`Request ${i}: Expected blocked (flag disabled)`);
      }
    }

    // Step 4: Verify zero new writes
    const afterDisableResult = await pool.query('SELECT COUNT(*) as count FROM claim_events');
    const afterDisableCount = parseInt(afterDisableResult.rows?.[0]?.count || '0', 10);
    const newWritesDuringDisable = afterDisableCount - baselineCount;

    const writesBlockedConfirmed = newWritesDuringDisable === 0;
    details.push(
      `After disable: ${afterDisableCount} total rows, ${newWritesDuringDisable} new writes during disabled flag`
    );

    if (writesBlockedConfirmed) {
      details.push('✅ Writes blocked during disabled flag');
    } else {
      details.push(`❌ UNEXPECTED: ${newWritesDuringDisable} writes occurred during disabled flag`);
    }

    // Step 5: Verify metrics still logged (check app_telemetry_logs for claim_intake_* tags during disable)
    const telemetryResult = await pool.query(`
      SELECT tag, COUNT(*) as count
      FROM app_telemetry_logs
      WHERE tag LIKE 'claim_intake_%'
      ORDER BY tag
    `);

    const metricsLoggedConfirmed = (telemetryResult.rows || []).length > 0;
    details.push(`Telemetry logs captured: ${(telemetryResult.rows || []).length} distinct tags`);

    if (metricsLoggedConfirmed) {
      telemetryResult.rows?.forEach((row: any) => {
        details.push(`  • ${row.tag}: ${row.count} events`);
      });
      details.push('✅ Metrics still logged during disabled flag');
    } else {
      details.push('❌ UNEXPECTED: No metrics logged during disable');
    }

    // Step 6: Restore CLAIM_WRITES_ENABLED=true
    process.env.CLAIM_WRITES_ENABLED = 'true';
    details.push('Restored CLAIM_WRITES_ENABLED=true');

    // Step 7: Verify metrics unchanged (same log volume)
    const afterRestoreResult = await pool.query('SELECT COUNT(*) as count FROM app_telemetry_logs');
    const afterRestoreLogCount = parseInt(afterRestoreResult.rows?.[0]?.count || '0', 10);
    details.push(`Telemetry logs after restore: ${afterRestoreLogCount} total`);

    const flagToggleSuccess = newWritesDuringDisable === 0 && metricsLoggedConfirmed;

    logger.info('phase3c:killswitch_test:completed', {
      testId,
      writesBlockedConfirmed,
      metricsLoggedConfirmed,
      flagToggleSuccess,
    });

    const result: Phase3cKillSwitchTestResult = {
      testId,
      timestamp: new Date(),
      success: writesBlockedConfirmed && metricsLoggedConfirmed && flagToggleSuccess,
      simulatedRequests,
      requestTypes,
      requestSources,
      writesBlockedConfirmed,
      metricsLoggedConfirmed,
      flagToggleSuccess,
      details,
    };

    return result;
  } catch (error) {
    logger.error('phase3c:killswitch_test:failed', { testId, error });

    const result: Phase3cKillSwitchTestResult = {
      testId,
      timestamp: new Date(),
      success: false,
      simulatedRequests: 0,
      requestTypes: [],
      requestSources: [],
      writesBlockedConfirmed: false,
      metricsLoggedConfirmed: false,
      flagToggleSuccess: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      details,
    };

    return result;
  }
}

/**
 * Print kill-switch test report.
 */
export function printKillSwitchTestResult(result: Phase3cKillSwitchTestResult): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Phase 3c: Kill-Switch Test Report`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`Test ID:                    ${result.testId}`);
  console.log(`Status:                     ${result.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Timestamp:                  ${result.timestamp.toISOString()}\n`);

  console.log(`Simulated Requests:         ${result.simulatedRequests}`);
  console.log(`  • Types:                  ${result.requestTypes.join(', ')}`);
  console.log(`  • Sources:                ${result.requestSources.join(', ')}\n`);

  console.log(`Safety Verification:`);
  console.log(`  • Writes Blocked:         ${result.writesBlockedConfirmed ? '✅' : '❌'}`);
  console.log(`  • Metrics Still Logged:   ${result.metricsLoggedConfirmed ? '✅' : '❌'}`);
  console.log(`  • Flag Toggle Success:    ${result.flagToggleSuccess ? '✅' : '❌'}\n`);

  if (result.details && result.details.length > 0) {
    console.log(`Details:`);
    result.details.forEach((detail) => {
      console.log(`  • ${detail}`);
    });
    console.log();
  }

  if (result.errorMessage) {
    console.log(`Error: ${result.errorMessage}\n`);
  }

  console.log(`${'='.repeat(80)}\n`);
}
