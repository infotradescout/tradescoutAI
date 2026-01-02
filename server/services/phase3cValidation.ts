import { Pool } from '@neondatabase/serverless';
import { runPhase3cKillSwitchTest, printKillSwitchTestResult } from '../jobs/phase3cKillSwitchTest';
import { runPhase3cDailySnapshotJob } from '../jobs/phase3cDailySnapshotJob';
import { logger } from './logger';

/**
 * Phase 3c: Pre-Dark-Period Validation
 * 
 * Runs before dark period begins (7–14 days of observation).
 * 
 * Checks:
 * 1. monitoring_snapshots table exists + schema valid
 * 2. app_telemetry_logs table has claim_intake_* events
 * 3. Kill-switch test (disable writes, confirm zero mutations, restore flag)
 * 4. Dry-run daily snapshot job (no breaches expected on fresh data)
 * 5. Baseline telemetry volume captured
 * 6. Print dark period strategy + KPI gates + timeline
 * 
 * Must PASS before dark period clock starts.
 */

export interface Phase3cPreDarkPeriodResult {
  validationId: string;
  timestamp: Date;
  success: boolean;
  
  // Checks
  monitoringTablesExist: boolean;
  telemetryDataExists: boolean;
  killSwitchPassed: boolean;
  dryRunSnapshotPassed: boolean;
  
  // Baseline
  baselineTelemetryCount: number;
  baselineClaimsCount: number;
  
  // Details
  failures: string[];
  warnings: string[];
  details: string[];
}

export async function validatePhase3c(pool: Pool): Promise<Phase3cPreDarkPeriodResult> {
  const validationId = `phase3c-validate-${Date.now()}`;
  const failures: string[] = [];
  const warnings: string[] = [];
  const details: string[] = [];

  try {
    logger.info('phase3c:validate:started', { validationId });

    // Check 1: monitoring_snapshots table exists
    let monitoringTablesExist = false;
    try {
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'monitoring_snapshots' AND table_schema = 'public'
      `);
      monitoringTablesExist = (result.rows || []).length > 0;
      details.push(`monitoring_snapshots table: ${monitoringTablesExist ? '✅ exists' : '❌ missing'}`);
      if (!monitoringTablesExist) {
        failures.push('monitoring_snapshots table not found');
      }
    } catch (err) {
      failures.push(`Failed to check monitoring_snapshots table: ${err}`);
    }

    // Check 2: app_telemetry_logs table exists and has claim_intake_* events
    let telemetryDataExists = false;
    try {
      const result = await pool.query(`
        SELECT COUNT(*) as count
        FROM app_telemetry_logs
        WHERE tag LIKE 'claim_intake_%'
      `);
      const count = parseInt(result.rows?.[0]?.count || '0', 10);
      telemetryDataExists = count > 0;
      details.push(`claim_intake_* telemetry events: ${count}`);
      if (!telemetryDataExists) {
        warnings.push('No claim_intake_* telemetry events found (expected after Phase 3a test)');
      }
    } catch (err) {
      warnings.push(`Failed to query telemetry: ${err}`);
    }

    // Check 3: Run kill-switch test
    let killSwitchPassed = false;
    try {
      const killSwitchResult = await runPhase3cKillSwitchTest(pool);
      killSwitchPassed = killSwitchResult.success;
      details.push(`Kill-switch test: ${killSwitchPassed ? '✅ PASS' : '❌ FAIL'}`);
      printKillSwitchTestResult(killSwitchResult);
      if (!killSwitchPassed) {
        failures.push(
          `Kill-switch test failed: writes=${killSwitchResult.writesBlockedConfirmed}, metrics=${killSwitchResult.metricsLoggedConfirmed}`
        );
      }
    } catch (err) {
      failures.push(`Kill-switch test error: ${err}`);
    }

    // Check 4: Run dry-run snapshot job (no breaches expected)
    let dryRunSnapshotPassed = false;
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshotResult = await runPhase3cDailySnapshotJob(pool, today);
      dryRunSnapshotPassed = snapshotResult.success && snapshotResult.allKpisPassed;
      details.push(
        `Dry-run snapshot job (${today}): ${dryRunSnapshotPassed ? '✅ PASS' : '⚠️ warned'}`
      );
      if (!snapshotResult.allKpisPassed) {
        warnings.push(
          `Snapshot has breaches: ${snapshotResult.breaches.join(' | ')}`
        );
      }
    } catch (err) {
      warnings.push(`Dry-run snapshot job error: ${err}`);
    }

    // Check 5: Capture baseline telemetry volume
    let baselineTelemetryCount = 0;
    let baselineClaimsCount = 0;
    try {
      const telemetryResult = await pool.query('SELECT COUNT(*) as count FROM app_telemetry_logs');
      baselineTelemetryCount = parseInt(telemetryResult.rows?.[0]?.count || '0', 10);

      const claimsResult = await pool.query('SELECT COUNT(*) as count FROM claim_events');
      baselineClaimsCount = parseInt(claimsResult.rows?.[0]?.count || '0', 10);

      details.push(`Baseline telemetry logs: ${baselineTelemetryCount}`);
      details.push(`Baseline claim_events: ${baselineClaimsCount}`);
    } catch (err) {
      warnings.push(`Failed to capture baseline: ${err}`);
    }

    // Overall result
    const success = !failures.length && killSwitchPassed && dryRunSnapshotPassed;

    logger.info('phase3c:validate:completed', {
      validationId,
      success,
      failureCount: failures.length,
      warningCount: warnings.length,
    });

    return {
      validationId,
      timestamp: new Date(),
      success,
      monitoringTablesExist,
      telemetryDataExists,
      killSwitchPassed,
      dryRunSnapshotPassed,
      baselineTelemetryCount,
      baselineClaimsCount,
      failures,
      warnings,
      details,
    };
  } catch (error) {
    logger.error('phase3c:validate:failed', { validationId, error });
    return {
      validationId,
      timestamp: new Date(),
      success: false,
      monitoringTablesExist: false,
      telemetryDataExists: false,
      killSwitchPassed: false,
      dryRunSnapshotPassed: false,
      baselineTelemetryCount: 0,
      baselineClaimsCount: 0,
      failures: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      details,
    };
  }
}

/**
 * Print phase 3c validation report + dark period strategy.
 */
export function printPhase3cValidation(result: Phase3cPreDarkPeriodResult): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Phase 3c: Pre-Dark-Period Validation`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`Validation ID:              ${result.validationId}`);
  console.log(`Status:                     ${result.success ? '✅ READY' : '❌ BLOCKED'}`);
  console.log(`Timestamp:                  ${result.timestamp.toISOString()}\n`);

  console.log(`Checks:`);
  console.log(`  • monitoring_snapshots table:  ${result.monitoringTablesExist ? '✅' : '❌'}`);
  console.log(`  • Telemetry data exists:       ${result.telemetryDataExists ? '✅' : '❌'}`);
  console.log(`  • Kill-switch test:            ${result.killSwitchPassed ? '✅' : '❌'}`);
  console.log(`  • Dry-run snapshot job:        ${result.dryRunSnapshotPassed ? '✅' : '❌'}\n`);

  console.log(`Baseline (Dark Period Reference):`);
  console.log(`  • Telemetry logs:              ${result.baselineTelemetryCount}`);
  console.log(`  • Claim events:                ${result.baselineClaimsCount}\n`);

  if (result.details && result.details.length > 0) {
    console.log(`Details:`);
    result.details.forEach((d) => console.log(`  • ${d}`));
    console.log();
  }

  if (result.warnings && result.warnings.length > 0) {
    console.log(`⚠️  Warnings:`);
    result.warnings.forEach((w) => console.log(`  • ${w}`));
    console.log();
  }

  if (result.failures && result.failures.length > 0) {
    console.log(`❌ Failures (MUST FIX):`);
    result.failures.forEach((f) => console.log(`  • ${f}`));
    console.log();
  }

  console.log(`${'='.repeat(80)}`);
  console.log(`\nPhase 3c: Dark Period Monitoring Strategy`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`Duration:                   7–14 days (starts NOW)\n`);

  console.log(`Frozen Rules:`);
  console.log(`  ✋ No code changes`);
  console.log(`  ✋ No UI additions`);
  console.log(`  ✋ No incentive exposure`);
  console.log(`  ✋ CLAIM_WRITES_ENABLED is the ONLY gate\n`);

  console.log(`Daily KPI Targets (must pass ALL for 7+ consecutive days):`);
  console.log(`  📊 Write Health:`);
  console.log(`     • write_success_rate ≥ 95% (written + duplicates / attempted)`);
  console.log(`     • write_failed_rate ≤ 1% (excluding feature-flag disabled)\n`);
  console.log(`  📊 Data Quality:`);
  console.log(`     • fieldPrecheckFailed / attempted ≤ 0.5%`);
  console.log(`     • Top 3 fieldErrors stable day-over-day (no new error classes)\n`);
  console.log(`  📊 Idempotency Integrity:`);
  console.log(`     • Replays show duplicates / attempted ≥ 95%`);
  console.log(`     • No growth in unique claims from replays\n`);
  console.log(`  📊 Rate Discipline:`);
  console.log(`     • rateWarnings / attempted ≤ 5%`);
  console.log(`     • No sustained county hotspots (>2 consecutive days)\n`);
  console.log(`  📊 Volume Stability:`);
  console.log(`     • Claims/day variance within ±20% absent product changes\n`);

  console.log(`Scheduled Jobs:`);
  console.log(`  • Daily snapshot (3 AM UTC): Aggregates previous 24h, stores snapshot`);
  console.log(`  • Status: Tracked in monitoring_snapshots table\n`);

  console.log(`Kill-Switch (Tested Now):`);
  console.log(`  • Disable: CLAIM_WRITES_ENABLED=false (zero writes expected)`);
  console.log(`  • Confirm: Query claim_events to verify no new rows`);
  console.log(`  • Metrics: claim_intake_* logs unaffected (no UI read required)\n`);

  console.log(`Greenlight Condition:`);
  console.log(`  ✅ All 7+ consecutive days pass ALL KPIs`);
  console.log(`  ✅ Zero breaches or unexplained growth`);
  console.log(`  ✅ Kill-switch tested and proven\n`);

  console.log(`Escalation (MUST HANDLE):`);
  console.log(`  🚨 ANY KPI breach → disable CLAIM_WRITES_ENABLED immediately`);
  console.log(`  🚨 Investigate root cause (code, data, load, or external factor)`);
  console.log(`  🚨 Resume without data loss (writes idempotent, checkpoint table)\n`);

  console.log(`Next Phase (After Greenlight):`);
  console.log(`  → Phase 3d (Phase 3+1 Exposure): Scout integration + incentive seeds\n`);

  console.log(`${'='.repeat(80)}\n`);

  if (result.success) {
    console.log(`✅ Pre-dark-period validation PASSED.`);
    console.log(`   Dark period clock STARTS NOW (7–14 days).\n`);
  } else {
    console.log(`❌ Pre-dark-period validation FAILED.`);
    console.log(`   Fix failures above before starting dark period.\n`);
  }

  console.log(`${'='.repeat(80)}\n`);
}
