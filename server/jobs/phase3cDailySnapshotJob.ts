import { Pool } from '@neondatabase/serverless';
import { aggregateDailyKpis, storeSnapshot, printKpiSnapshot } from '../services/phase3cMonitoring';
import { logger } from '../services/logger';

/**
 * Phase 3c: Daily Snapshot Job
 * 
 * Runs daily (3 AM UTC, after 2 AM crawlers) to:
 * 1. Aggregate previous 24h claim_intake_* telemetry
 * 2. Calculate KPIs (write health, data quality, rate discipline, idempotency)
 * 3. Store snapshot in monitoring_snapshots table (idempotent)
 * 4. Report pass/fail status + breaches
 * 5. Check greenlight condition (7 consecutive pass days)
 * 
 * Zero governance changes. CLAIM_WRITES_ENABLED unchanged.
 */

export interface Phase3cDailyJobResult {
  jobId: string;
  runDate: string; // YYYY-MM-DD
  timestamp: Date;
  success: boolean;
  snapshotDate: string;
  allKpisPassed: boolean;
  breaches: string[];
  consecutiveDaysPass: number;
  greenlitForPhase3d: boolean;
  errorMessage?: string;
}

export async function runPhase3cDailySnapshotJob(
  pool: Pool,
  overrideDate?: string // for testing
): Promise<Phase3cDailyJobResult> {
  const jobId = `phase3c-daily-${Date.now()}`;
  const runDate = new Date().toISOString().split('T')[0];
  
  // If override date provided, aggregate that date instead (for backfill/testing)
  const targetDate = overrideDate || runDate;

  try {
    logger.info('phase3c:daily_job:started', {
      jobId,
      runDate,
      targetDate,
    });

    // Step 1: Aggregate KPIs from logs
    const snapshot = await aggregateDailyKpis(pool, targetDate);

    // Step 2: Store snapshot (idempotent)
    await storeSnapshot(pool, snapshot);

    // Step 3: Print report
    printKpiSnapshot(snapshot);

    // Step 4: Check greenlight (7 consecutive pass days)
    const greenlightResult = await checkSevenDayGreenlight(pool);

    // Step 5: Log result
    logger.info('phase3c:daily_job:completed', {
      jobId,
      targetDate,
      allKpisPassed: snapshot.allKpisPassed,
      breachCount: snapshot.breachDetails?.length || 0,
      consecutiveDaysPass: greenlightResult.passedDays,
      greenlitForPhase3d: greenlightResult.greenlit,
    });

    const result: Phase3cDailyJobResult = {
      jobId,
      runDate,
      timestamp: new Date(),
      success: true,
      snapshotDate: targetDate,
      allKpisPassed: snapshot.allKpisPassed,
      breaches: snapshot.breachDetails || [],
      consecutiveDaysPass: greenlightResult.passedDays,
      greenlitForPhase3d: greenlightResult.greenlit,
    };

    // Print greenlight status
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Phase 3d Readiness Check`);
    console.log(`${'='.repeat(80)}\n`);
    console.log(greenlightResult.details);
    console.log(`\n${'='.repeat(80)}\n`);

    return result;
  } catch (error) {
    logger.error('phase3c:daily_job:failed', {
      jobId,
      targetDate,
      error,
    });

    const result: Phase3cDailyJobResult = {
      jobId,
      runDate,
      timestamp: new Date(),
      success: false,
      snapshotDate: targetDate,
      allKpisPassed: false,
      breaches: [],
      consecutiveDaysPass: 0,
      greenlitForPhase3d: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };

    return result;
  }
}

/**
 * Check if 7 consecutive days have passed all KPIs (greenlight for Phase 3d).
 * Imported from phase3cMonitoring.ts
 */
async function checkSevenDayGreenlight(pool: Pool) {
  const { getSnapshotRange } = await import('../services/phase3cMonitoring');

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

  return {
    greenlit,
    passedDays: consecutivePassCount,
    lastBreachDate,
    details: greenlit
      ? `✅ 7+ consecutive days passed. Ready for Phase 3d (Phase 3+1 Exposure).`
      : `⏳ ${consecutivePassCount}/7 consecutive days passed. Last breach: ${lastBreachDate || 'none yet'}.`,
  };
}

/**
 * Scheduler integration: register daily snapshot job at 3 AM UTC.
 */
export function registerPhase3cDailySnapshotJob(pool: Pool, scheduler: any): void {
  scheduler.schedule('0 3 * * *', async () => {
    await runPhase3cDailySnapshotJob(pool);
  });
  logger.info('phase3c:daily_job:registered', { schedule: '0 3 * * * (3 AM UTC)' });
}
