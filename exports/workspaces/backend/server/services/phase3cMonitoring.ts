import { sql } from 'drizzle-orm';
import { Pool } from '@neondatabase/serverless';
import { logger } from './logger';

/**
 * Phase 3c: Dark Period Monitoring
 * 
 * Observes claim intake health via locked KPIs, zero UI/logic changes.
 * Frozen for 7–14 days. Idempotent snapshots. Kill-switch discipline.
 * 
 * KPI Gates (daily):
 * - write_success_rate ≥ 95% (written + duplicates / attempted)
 * - write_failed_rate ≤ 1% (excluding feature-flag disabled)
 * - fieldPrecheckFailed / attempted ≤ 0.5%
 * - rateWarnings / attempted ≤ 5%
 * - duplicates / attempted ≥ 95% (on replays)
 * - variance within ±20% (absent product changes)
 */

export interface Phase3cKpiSnapshot {
  date: string; // YYYY-MM-DD
  timestamp: Date;
  
  // Counts
  totalAttempted: number;
  totalWritten: number;
  totalDuplicates: number;
  totalFailed: number;
  totalFieldPrecheckFailed: number;
  totalRateWarnings: number;
  
  // Rates (%)
  writeSuccessRate: number; // (written + duplicates) / attempted
  writeFailedRate: number; // failed / attempted (excluding feature-flag disabled)
  fieldPrecheckFailRate: number; // fieldPrecheckFailed / attempted
  rateWarningRate: number; // rateWarnings / attempted
  idempotencyRate: number; // duplicates / attempted (on any write attempt)
  
  // Stability
  varietyOfErrorTypes: number; // distinct errorReasons
  topErrorReasons: string[]; // top 3
  topFieldErrors: string[]; // top 3
  
  // Status
  passedWriteHealth: boolean; // successRate ≥ 95% AND failedRate ≤ 1%
  passedDataQuality: boolean; // fieldPrecheckFailRate ≤ 0.5%
  passedRateDiscipline: boolean; // rateWarningRate ≤ 5%
  passedIdempotency: boolean; // idempotencyRate ≥ 95% when available
  allKpisPassed: boolean; // all above true
  
  // Notes
  notes?: string[];
  breachDetails?: string[];
}

export interface Phase3cKpiThresholds {
  writeSuccessRateMin: number; // 95
  writeFailedRateMax: number; // 1
  fieldPrecheckFailRateMax: number; // 0.5
  rateWarningRateMax: number; // 5
  idempotencyRateMin: number; // 95
  varianceTolerancePercent: number; // ±20
}

const DEFAULT_THRESHOLDS: Phase3cKpiThresholds = {
  writeSuccessRateMin: 95,
  writeFailedRateMax: 1,
  fieldPrecheckFailRateMax: 0.5,
  rateWarningRateMax: 5,
  idempotencyRateMin: 95,
  varianceTolerancePercent: 20,
};

/**
 * Query logs for previous 24 hours of claim_intake_* telemetry.
 * Aggregates by event tag (written, duplicate, write_failed, field_validation_failed, rate_warning).
 * Returns KPI snapshot with pass/fail status.
 * 
 * Idempotent: same date returns same snapshot (no double-counting).
 */
export async function aggregateDailyKpis(
  pool: Pool,
  targetDate: string, // YYYY-MM-DD
  thresholds: Phase3cKpiThresholds = DEFAULT_THRESHOLDS
): Promise<Phase3cKpiSnapshot> {
  try {
    // Parse date to get 24-hour window (midnight to midnight UTC)
    const startOfDay = new Date(`${targetDate}T00:00:00Z`);
    const endOfDay = new Date(`${targetDate}T23:59:59Z`);

    // Query logs table (assuming app logs stored in a logs/telemetry table)
    // For now, we'll assume a simple log structure with timestamp, tag, metadata
    // In production, this could integrate with CloudWatch, Datadog, ELK, etc.
    
    const logsQuery = `
      SELECT
        tag,
        COUNT(*) as count,
        COALESCE(metadata->>'errorReason', 'N/A') as error_reason,
        COALESCE(metadata->>'fieldErrors', '[]') as field_errors
      FROM app_telemetry_logs
      WHERE
        tag LIKE 'claim_intake_%'
        AND timestamp >= $1
        AND timestamp < $2
      GROUP BY tag, metadata->>'errorReason', metadata->>'fieldErrors'
      ORDER BY tag, count DESC
    `;

    const result = await pool.query(logsQuery, [startOfDay, endOfDay]);
    const rows = result.rows || [];

    // Aggregate by event type
    let totalWritten = 0;
    let totalDuplicates = 0;
    let totalFailed = 0;
    let totalFieldPrecheckFailed = 0;
    let totalRateWarnings = 0;

    const errorReasonCounts: Record<string, number> = {};
    const fieldErrorCounts: Record<string, number> = {};

    for (const row of rows) {
      const tag = row.tag || '';
      const count = parseInt(row.count, 10) || 0;
      const errorReason = row.error_reason || 'N/A';
      const fieldErrors = row.field_errors ? JSON.parse(row.field_errors) : [];

      if (tag === 'claim_intake_written') {
        totalWritten += count;
      } else if (tag === 'claim_intake_duplicate') {
        totalDuplicates += count;
      } else if (tag === 'claim_intake_write_failed') {
        totalFailed += count;
        if (errorReason !== 'N/A') {
          errorReasonCounts[errorReason] = (errorReasonCounts[errorReason] || 0) + count;
        }
      } else if (tag === 'claim_intake_field_validation_failed') {
        totalFieldPrecheckFailed += count;
        if (Array.isArray(fieldErrors)) {
          fieldErrors.forEach((err: string) => {
            fieldErrorCounts[err] = (fieldErrorCounts[err] || 0) + 1;
          });
        }
      } else if (tag === 'claim_intake_rate_warning') {
        totalRateWarnings += count;
      }
    }

    // Total attempted = written + duplicates + failed + field_precheck_failed + rate_warnings (all attempts)
    // More accurate: read from a claim_intake_attempted counter if available
    // For safety, use: written + duplicates + failed as baseline of "got through gate"
    const baselineAttempted = totalWritten + totalDuplicates + totalFailed;
    const totalAttempted = Math.max(
      baselineAttempted + totalFieldPrecheckFailed + totalRateWarnings,
      baselineAttempted || 1 // avoid divide-by-zero
    );

    // Calculate rates
    const writeSuccessRate = totalAttempted > 0
      ? ((totalWritten + totalDuplicates) / totalAttempted) * 100
      : 0;

    const writeFailedRate = totalAttempted > 0
      ? (totalFailed / totalAttempted) * 100
      : 0;

    const fieldPrecheckFailRate = totalAttempted > 0
      ? (totalFieldPrecheckFailed / totalAttempted) * 100
      : 0;

    const rateWarningRate = totalAttempted > 0
      ? (totalRateWarnings / totalAttempted) * 100
      : 0;

    const idempotencyRate = totalAttempted > 0
      ? (totalDuplicates / totalAttempted) * 100
      : 0;

    // Top 3 errors
    const sortedErrors = Object.entries(errorReasonCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);

    const sortedFieldErrors = Object.entries(fieldErrorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([err]) => err);

    // Pass/fail status
    const passedWriteHealth = writeSuccessRate >= thresholds.writeSuccessRateMin &&
      writeFailedRate <= thresholds.writeFailedRateMax;

    const passedDataQuality = fieldPrecheckFailRate <= thresholds.fieldPrecheckFailRateMax;

    const passedRateDiscipline = rateWarningRate <= thresholds.rateWarningRateMax;

    const passedIdempotency = idempotencyRate >= thresholds.idempotencyRateMin || totalDuplicates === 0;

    const allKpisPassed = passedWriteHealth && passedDataQuality && passedRateDiscipline && passedIdempotency;

    // Breach details
    const breachDetails: string[] = [];
    if (!passedWriteHealth) {
      breachDetails.push(
        `Write Health: successRate ${writeSuccessRate.toFixed(2)}% < ${thresholds.writeSuccessRateMin}%` +
        ` OR failedRate ${writeFailedRate.toFixed(2)}% > ${thresholds.writeFailedRateMax}%`
      );
    }
    if (!passedDataQuality) {
      breachDetails.push(
        `Data Quality: fieldPrecheckFailRate ${fieldPrecheckFailRate.toFixed(2)}% > ${thresholds.fieldPrecheckFailRateMax}%`
      );
    }
    if (!passedRateDiscipline) {
      breachDetails.push(
        `Rate Discipline: rateWarningRate ${rateWarningRate.toFixed(2)}% > ${thresholds.rateWarningRateMax}%`
      );
    }
    if (!passedIdempotency && totalDuplicates > 0) {
      breachDetails.push(
        `Idempotency: duplicateRate ${idempotencyRate.toFixed(2)}% < ${thresholds.idempotencyRateMin}%`
      );
    }

    const snapshot: Phase3cKpiSnapshot = {
      date: targetDate,
      timestamp: new Date(),
      totalAttempted,
      totalWritten,
      totalDuplicates,
      totalFailed,
      totalFieldPrecheckFailed,
      totalRateWarnings,
      writeSuccessRate,
      writeFailedRate,
      fieldPrecheckFailRate,
      rateWarningRate,
      idempotencyRate,
      varietyOfErrorTypes: Object.keys(errorReasonCounts).length,
      topErrorReasons: sortedErrors,
      topFieldErrors: sortedFieldErrors,
      passedWriteHealth,
      passedDataQuality,
      passedRateDiscipline,
      passedIdempotency,
      allKpisPassed,
      breachDetails: breachDetails.length > 0 ? breachDetails : undefined,
    };

    logger.info('phase3c:kpi:aggregated', {
      date: targetDate,
      allKpisPassed,
      writeSuccessRate: snapshot.writeSuccessRate.toFixed(2),
      fieldPrecheckFailRate: snapshot.fieldPrecheckFailRate.toFixed(2),
      rateWarningRate: snapshot.rateWarningRate.toFixed(2),
      breachCount: breachDetails.length,
    });

    return snapshot;
  } catch (error) {
    logger.error('phase3c:kpi:aggregation_failed', { error, targetDate });
    throw error;
  }
}

/**
 * Store daily KPI snapshot in monitoring_snapshots table (idempotent).
 * Returns stored snapshot or existing record if already captured for the date.
 */
export async function storeSnapshot(
  pool: Pool,
  snapshot: Phase3cKpiSnapshot
): Promise<Phase3cKpiSnapshot> {
  try {
    const upsertQuery = `
      INSERT INTO monitoring_snapshots (
        snapshot_date,
        total_attempted,
        total_written,
        total_duplicates,
        total_failed,
        total_field_precheck_failed,
        total_rate_warnings,
        write_success_rate,
        write_failed_rate,
        field_precheck_fail_rate,
        rate_warning_rate,
        idempotency_rate,
        variety_of_error_types,
        top_error_reasons,
        top_field_errors,
        passed_write_health,
        passed_data_quality,
        passed_rate_discipline,
        passed_idempotency,
        all_kpis_passed,
        breach_details,
        snapshot_json
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      )
      ON CONFLICT (snapshot_date) DO NOTHING
      RETURNING *
    `;

    const result = await pool.query(upsertQuery, [
      snapshot.date,
      snapshot.totalAttempted,
      snapshot.totalWritten,
      snapshot.totalDuplicates,
      snapshot.totalFailed,
      snapshot.totalFieldPrecheckFailed,
      snapshot.totalRateWarnings,
      snapshot.writeSuccessRate,
      snapshot.writeFailedRate,
      snapshot.fieldPrecheckFailRate,
      snapshot.rateWarningRate,
      snapshot.idempotencyRate,
      snapshot.varietyOfErrorTypes,
      JSON.stringify(snapshot.topErrorReasons),
      JSON.stringify(snapshot.topFieldErrors),
      snapshot.passedWriteHealth,
      snapshot.passedDataQuality,
      snapshot.passedRateDiscipline,
      snapshot.passedIdempotency,
      snapshot.allKpisPassed,
      JSON.stringify(snapshot.breachDetails || []),
      JSON.stringify(snapshot)
    ]);

    if (result.rows && result.rows.length > 0) {
      logger.info('phase3c:snapshot:stored', {
        date: snapshot.date,
        allKpisPassed: snapshot.allKpisPassed,
      });
    } else {
      logger.info('phase3c:snapshot:already_exists', { date: snapshot.date });
    }

    return snapshot;
  } catch (error) {
    logger.error('phase3c:snapshot:store_failed', { error, date: snapshot.date });
    throw error;
  }
}

/**
 * Get latest snapshot (most recent date).
 */
export async function getLatestSnapshot(pool: Pool): Promise<Phase3cKpiSnapshot | null> {
  try {
    const query = `
      SELECT snapshot_json
      FROM monitoring_snapshots
      ORDER BY snapshot_date DESC
      LIMIT 1
    `;

    const result = await pool.query(query);

    if (result.rows && result.rows.length > 0) {
      return JSON.parse(result.rows[0].snapshot_json) as Phase3cKpiSnapshot;
    }

    return null;
  } catch (error) {
    logger.error('phase3c:snapshot:fetch_latest_failed', { error });
    return null;
  }
}

/**
 * Get all snapshots within a date range (for dashboard / historical analysis).
 */
export async function getSnapshotRange(
  pool: Pool,
  startDate: string, // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
): Promise<Phase3cKpiSnapshot[]> {
  try {
    const query = `
      SELECT snapshot_json
      FROM monitoring_snapshots
      WHERE snapshot_date >= $1 AND snapshot_date <= $2
      ORDER BY snapshot_date ASC
    `;

    const result = await pool.query(query, [startDate, endDate]);

    return (result.rows || []).map((row) => JSON.parse(row.snapshot_json) as Phase3cKpiSnapshot);
  } catch (error) {
    logger.error('phase3c:snapshot:fetch_range_failed', { error, startDate, endDate });
    return [];
  }
}

/**
 * Check if 7 consecutive days have passed all KPIs (greenlight for Phase 3d).
 */
export async function checkSevenDayGreenlight(pool: Pool): Promise<{
  greenlit: boolean;
  passedDays: number;
  lastBreachDate: string | null;
  details: string;
}> {
  try {
    // Get last 14 days of snapshots
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const snapshots = await getSnapshotRange(pool, startDate, endDate);

    if (snapshots.length === 0) {
      return {
        greenlit: false,
        passedDays: 0,
        lastBreachDate: null,
        details: 'No snapshots captured yet.',
      };
    }

    // Find longest consecutive streak of all-pass days (most recent)
    let consecutivePassCount = 0;
    let lastBreachDate: string | null = null;

    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].allKpisPassed) {
        consecutivePassCount++;
      } else {
        lastBreachDate = snapshots[i].date;
        break;
      }
    }

    const greenlit = consecutivePassCount >= 7;

    logger.info('phase3c:greenlight:check', {
      greenlit,
      passedDays: consecutivePassCount,
      lastBreachDate,
    });

    return {
      greenlit,
      passedDays: consecutivePassCount,
      lastBreachDate,
      details: greenlit
        ? `✅ 7+ consecutive days passed. Ready for Phase 3d (Phase 3+1 Exposure).`
        : `⏳ ${consecutivePassCount}/7 consecutive days passed. Last breach: ${lastBreachDate || 'none yet'}.`,
    };
  } catch (error) {
    logger.error('phase3c:greenlight:check_failed', { error });
    return {
      greenlit: false,
      passedDays: 0,
      lastBreachDate: null,
      details: `Error checking greenlight: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Print formatted KPI snapshot report.
 */
export function printKpiSnapshot(snapshot: Phase3cKpiSnapshot): void {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Phase 3c: Daily KPI Snapshot — ${snapshot.date}`);
  console.log(`${'='.repeat(80)}\n`);

  console.log(`📊 Volume (24-hour window):`);
  console.log(`   Attempted:              ${snapshot.totalAttempted}`);
  console.log(`   Written:                ${snapshot.totalWritten}`);
  console.log(`   Duplicates:             ${snapshot.totalDuplicates}`);
  console.log(`   Failed:                 ${snapshot.totalFailed}`);
  console.log(`   Field Precheck Failed:  ${snapshot.totalFieldPrecheckFailed}`);
  console.log(`   Rate Warnings:          ${snapshot.totalRateWarnings}\n`);

  console.log(`📈 KPI Rates:`);
  console.log(
    `   Write Success:          ${snapshot.writeSuccessRate.toFixed(2)}% (target ≥ 95%) ${
      snapshot.passedWriteHealth ? '✅' : '❌'
    }`
  );
  console.log(
    `   Write Failed:           ${snapshot.writeFailedRate.toFixed(2)}% (target ≤ 1%) ${
      snapshot.passedWriteHealth ? '✅' : '❌'
    }`
  );
  console.log(
    `   Field Precheck Fail:    ${snapshot.fieldPrecheckFailRate.toFixed(2)}% (target ≤ 0.5%) ${
      snapshot.passedDataQuality ? '✅' : '❌'
    }`
  );
  console.log(
    `   Rate Warning:           ${snapshot.rateWarningRate.toFixed(2)}% (target ≤ 5%) ${
      snapshot.passedRateDiscipline ? '✅' : '❌'
    }`
  );
  console.log(
    `   Idempotency (Duplicates): ${snapshot.idempotencyRate.toFixed(2)}% (target ≥ 95%) ${
      snapshot.passedIdempotency ? '✅' : '❌'
    }\n`
  );

  console.log(`🔍 Data Quality:`);
  console.log(`   Error Type Variety:     ${snapshot.varietyOfErrorTypes}`);
  if (snapshot.topErrorReasons.length > 0) {
    console.log(`   Top Error Reasons:      ${snapshot.topErrorReasons.join(', ')}`);
  }
  if (snapshot.topFieldErrors.length > 0) {
    console.log(`   Top Field Errors:       ${snapshot.topFieldErrors.join(', ')}`);
  }
  console.log();

  console.log(`🎯 Overall Status:`);
  console.log(
    `   All KPIs Passed:        ${snapshot.allKpisPassed ? '✅ PASS' : '❌ FAIL'}\n`
  );

  if (snapshot.breachDetails && snapshot.breachDetails.length > 0) {
    console.log(`⚠️  Breach Details:`);
    snapshot.breachDetails.forEach((detail) => {
      console.log(`   • ${detail}`);
    });
    console.log();
  }

  console.log(`${'='.repeat(80)}\n`);
}
