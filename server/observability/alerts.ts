/**
 * Alert Evaluation Engine (Phase 5: CRITICAL Alerts with Paging)
 *
 * Principles:
 * - CRITICAL = paging (true server faults, persistent failures)
 * - WARN = non-paging (performance degradation, transient issues)
 * - Additive: zero impact on scheduler/DB/routing behavior
 * - Rolling windows: require sustained conditions
 * - Debounce + Dedup: one page per condition per hour
 */

import {
  getJobMetrics,
  getPoolMetrics,
  getHttpMetrics,
  calculateJobDurationPercentiles,
} from "./metrics";

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = "INFO" | "WARN" | "CRITICAL";
export type AlertStatus = "firing" | "resolved";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  name: string;
  description: string;
  labels: Record<string, string>;
  startedAt: Date;
  resolvedAt?: Date;
  lastEvaluatedAt: Date;
  consecutiveHits: number;
}

// ============================================================================
// BASELINE CONFIGURATION
// ============================================================================

export const BASELINES = {
  scheduler: {
    users_aggregation: {
      p95Duration: 5000,
      avgRows: 100,
    },
    affiliates_aggregation: {
      p95Duration: 3000,
      avgRows: 50,
    },
    trade_deals_aggregation: {
      p95Duration: 3000,
      avgRows: 50,
    },
  },
  dbPool: {
    p95AcquireLatency: 100,
  },
  http: {
    baseline5xxRate: 0.01,
    delta5xx: 0.05,
  },
};

// ============================================================================
// ALERT STATE MANAGEMENT
// ============================================================================

const activeAlerts: Map<string, Alert> = new Map();
const alertHistory: Alert[] = [];
const consecutiveHitsTracker: Map<string, number> = new Map();
const lastPagedAt: Map<string, Date> = new Map();

// Per-job error counters for consecutive failure tracking
const jobErrorCounters: Map<string, number> = new Map();

// Track last error event per job (from emitJobError calls)
const lastJobErrors: Map<string, Date> = new Map();

// Pool exhaustion time accumulator (milliseconds)
let poolExhaustionMs = 0;

const PAGING_CONFIG = {
  dedupWindowMs: 60 * 60 * 1000,
  criticalSustainedWindowMs: 30 * 1000,
  poolExhaustionWindowMs: 120 * 1000,
};

const TICK_INTERVAL_MS = 15 * 1000; // 15s evaluation cadence

// ============================================================================
// ALERT EVALUATION LOGIC
// ============================================================================

export function evaluateAlerts(): void {
  try {
    evaluateSchedulerAlerts();
    evaluateDbPoolAlerts();
    evaluateHttpAlerts();
  } catch (error) {
    console.error("Alert evaluation failed:", error);
  }
}

function evaluateSchedulerAlerts(): void {
  const jobNames = ["users_aggregation", "affiliates_aggregation", "trade_deals_aggregation"];

  for (const jobName of jobNames) {
    const metrics = getJobMetrics(jobName);
      console.log(`[DEBUG evaluateSchedulerAlerts] ${jobName}: ${metrics.length} metrics`);
    if (metrics.length === 0) continue;

      // Alert 4: Job Error (check this FIRST, before percentiles, so it works with incomplete metrics)
      const errorAlertId = `scheduler.error.${jobName}`;
      const errorCount = jobErrorCounters.get(jobName) ?? 0;
      console.log(`[DEBUG ERROR] Job ${jobName} error count: ${errorCount}`);
    
      if (errorCount >= 2) {
        // CRITICAL: 2+ consecutive failures
        fireAlert({
          id: errorAlertId,
          severity: "CRITICAL",
          name: "Scheduler Job Error (Persistent)",
          description: `Job ${jobName} failed ${errorCount} consecutive runs (aggregation degraded)`,
          labels: { 
            job: jobName, 
            metric: "error", 
            consecutiveRuns: String(errorCount)
          },
        });
      } else if (errorCount === 1) {
        // WARN: Single error (may be transient)
        fireAlert({
          id: errorAlertId,
          severity: "WARN",
          name: "Scheduler Job Error (Transient)",
          description: `Job ${jobName} has 1 error (may recover)`,
          labels: { job: jobName, metric: "error" },
        });
      } else {
        // No errors: resolve alert
        resolveAlert(errorAlertId);
      }

    const percentiles = calculateJobDurationPercentiles(jobName);
    const baseline = BASELINES.scheduler[jobName as keyof typeof BASELINES.scheduler];
    if (!baseline || !percentiles) continue;

    const recentMetrics = metrics.slice(-10);

    // Alert 1: Duration Spike
    const durationAlertId = `scheduler.duration_spike.${jobName}`;
    if (percentiles.p95 > baseline.p95Duration * 2) {
      incrementConsecutiveHits(durationAlertId);
      if (getConsecutiveHits(durationAlertId) >= 3) {
        fireAlert({
          id: durationAlertId,
          severity: "WARN",
          name: "Scheduler Duration Spike",
          description: `Job ${jobName} p95 duration (${percentiles.p95}ms) is >2× baseline (${baseline.p95Duration}ms) for 3+ windows`,
          labels: { job: jobName, metric: "duration_p95" },
        });
      }
    } else {
      resetConsecutiveHits(durationAlertId);
      resolveAlert(durationAlertId);
    }

    // Alert 2: Rows Spike
    const recentRows = recentMetrics
      .filter((m) => m.rowsWritten !== undefined)
      .map((m) => m.rowsWritten!);
    
    if (recentRows.length > 0) {
      const avgRows = recentRows.reduce((a, b) => a + b, 0) / recentRows.length;
      const rowsAlertId = `scheduler.rows_spike.${jobName}`;
      
      if (avgRows > baseline.avgRows * 2) {
        fireAlert({
          id: rowsAlertId,
          severity: "WARN",
          name: "Scheduler Rows Spike",
          description: `Job ${jobName} wrote ${Math.round(avgRows)} rows (avg), baseline ${Math.round(baseline.avgRows)}`,
          labels: { 
            job: jobName, 
            metric: "rows", 
            baseline: String(Math.round(baseline.avgRows)), 
            current: String(Math.round(avgRows)) 
          },
        });
      } else {
        resolveAlert(rowsAlertId);
      }
    }

    // Alert 3: Job Overlap
    const overlapCount = recentMetrics.filter((m) => m.overlap).length;
    const overlapAlertId = `scheduler.overlap.${jobName}`;
    
    if (overlapCount >= 2) {
      fireAlert({
        id: overlapAlertId,
        severity: "CRITICAL",
        name: "Scheduler Job Overlap (Persistent)",
        description: `Job ${jobName} has ${overlapCount} overlaps in last 10 runs (timer/idempotency failure)`,
        labels: { 
          job: jobName, 
          metric: "overlap", 
          baseline: "0", 
          current: String(overlapCount) 
        },
      });
    } else if (overlapCount === 1) {
      fireAlert({
        id: overlapAlertId,
        severity: "WARN",
        name: "Scheduler Job Overlap (Transient)",
        description: `Job ${jobName} has 1 overlap (may be transient)`,
        labels: { job: jobName, metric: "overlap" },
      });
    } else {
      resolveAlert(overlapAlertId);
    }

  }
}

/**
 * Record job error event (called from metrics.ts)
 * This is the authoritative source for error tracking
 */
export function recordJobError(jobName: string): void {
  const currentCount = (jobErrorCounters.get(jobName) ?? 0) + 1;
  jobErrorCounters.set(jobName, currentCount);
  lastJobErrors.set(jobName, new Date());
}

/**
 * Record job success event (called from metrics.ts)
 */
export function recordJobSuccess(jobName: string): void {
  jobErrorCounters.set(jobName, 0);
}
function evaluateDbPoolAlerts(): void {
  const poolMetrics = getPoolMetrics();
  if (poolMetrics.length === 0) return;
  const latestPool = poolMetrics[poolMetrics.length - 1];

  // Alert 1: Pool Pressure (using time-based accumulation)
  const pressureAlertId = "dbpool.pressure";
  
  if (latestPool.waiting > 0) {
    // Accumulate exhaustion time
    poolExhaustionMs += TICK_INTERVAL_MS;
  } else {
    // Reset timer when no waiting connections
    poolExhaustionMs = 0;
  }
  
  if (poolExhaustionMs >= PAGING_CONFIG.poolExhaustionWindowMs) {
    // CRITICAL: Sustained >= 120s
    fireAlert({
      id: pressureAlertId,
      severity: "CRITICAL",
      name: "DB Pool Exhaustion",
      description: `Waiting connections (${latestPool.waiting}) sustained for >120s (imminent user impact)`,
      labels: { 
        metric: "pool_waiting", 
        waiting: String(latestPool.waiting), 
        duration: ">120s",
        exhaustionMs: String(poolExhaustionMs)
      },
    });
  } else if (poolExhaustionMs >= 60_000 && latestPool.waiting > 0) {
    // WARN: Sustained >=60s but <120s
    fireAlert({
      id: pressureAlertId,
      severity: "WARN",
      name: "DB Pool Pressure",
      description: `Waiting connections (${latestPool.waiting}) sustained for >60s`,
      labels: { 
        metric: "pool_waiting", 
        waiting: String(latestPool.waiting), 
        duration: ">60s",
        exhaustionMs: String(poolExhaustionMs)
      },
    });
  } else {
    resolveAlert(pressureAlertId);
  }

  // Alert 2: Pool Latency Spike
  if (latestPool.acquireLatencyMs && latestPool.acquireLatencyMs > BASELINES.dbPool.p95AcquireLatency * 2) {
    const latencyAlertId = "dbpool.latency_spike";
    fireAlert({
      id: latencyAlertId,
      severity: "WARN",
      name: "DB Pool Latency Spike",
      description: `Acquire latency (${latestPool.acquireLatencyMs}ms) is >2× baseline (${BASELINES.dbPool.p95AcquireLatency}ms)`,
      labels: { 
        metric: "pool_acquire_latency", 
        baseline: String(BASELINES.dbPool.p95AcquireLatency), 
        current: String(latestPool.acquireLatencyMs) 
      },
    });
  } else {
    resolveAlert("dbpool.latency_spike");
  }
}

function evaluateHttpAlerts(): void {
  const httpMetrics = getHttpMetrics();
  const total = Object.values(httpMetrics).reduce((a, b) => a + b, 0);
  if (total === 0) return;

  // Alert 1: True 5xx Server Faults
  const fivexxAlertId = "http.5xx_server_faults";
  const fivexxCount = httpMetrics["5xx"] || 0;

  if (fivexxCount > 0) {
    incrementConsecutiveHits(fivexxAlertId);
    const sustainedWindows = getConsecutiveHits(fivexxAlertId);
    
    if (sustainedWindows >= 2) {
      const fivexxRate = fivexxCount / total;
      fireAlert({
        id: fivexxAlertId,
        severity: "CRITICAL",
        name: "HTTP 5xx Server Faults",
        description: `${fivexxCount} server faults (${(fivexxRate * 100).toFixed(2)}%) sustained >30s — real server errors detected`,
        labels: { 
          metric: "http_5xx_count", 
          count: String(fivexxCount),
          rate: (fivexxRate * 100).toFixed(3) + "%",
          duration: ">30s"
        },
      });
    }
  } else {
    resetConsecutiveHits(fivexxAlertId);
    resolveAlert(fivexxAlertId);
  }

  // Alert 2: 4xx Surge
  const fourxxAlertId = "http.4xx_surge";
  const fourxxRate = (httpMetrics["4xx"] || 0) / total;

  if (fourxxRate > 0.3) {
    fireAlert({
      id: fourxxAlertId,
      severity: "INFO",
      name: "HTTP 4xx Surge",
      description: `4xx rate (${(fourxxRate * 100).toFixed(2)}%) is elevated (expected guards/validation)`,
      labels: { metric: "http_4xx_rate" },
    });
  } else {
    resolveAlert(fourxxAlertId);
  }
}

// ============================================================================
// ALERT STATE HELPERS
// ============================================================================

function fireAlert(params: {
  id: string;
  severity: AlertSeverity;
  name: string;
  description: string;
  labels: Record<string, string>;
}): void {
  const existing = activeAlerts.get(params.id);

  if (existing && existing.status === "firing") {
      // Update severity if escalating (WARN → CRITICAL)
      if (params.severity === "CRITICAL" && existing.severity !== "CRITICAL") {
        existing.severity = "CRITICAL";
        existing.name = params.name;
        existing.description = params.description;
        existing.labels = params.labels;
        // Log escalation and send page
        const logEntry = {
          alert: "ESCALATED",
          severity: "CRITICAL",
          id: params.id,
          name: params.name,
          description: params.description,
          labels: params.labels,
          timestamp: new Date().toISOString(),
        };
        console.error(JSON.stringify(logEntry));
        sendPage(existing);
      }
    existing.lastEvaluatedAt = new Date();
    existing.consecutiveHits = getConsecutiveHits(params.id);
    return;
  }

  const alert: Alert = {
    id: params.id,
    severity: params.severity,
    status: "firing",
    name: params.name,
    description: params.description,
    labels: params.labels,
    startedAt: new Date(),
    lastEvaluatedAt: new Date(),
    consecutiveHits: getConsecutiveHits(params.id),
  };

  activeAlerts.set(params.id, alert);

  const logEntry = {
    alert: "FIRING",
    severity: params.severity,
    id: params.id,
    name: params.name,
    description: params.description,
    labels: params.labels,
    timestamp: new Date().toISOString(),
  };

  if (params.severity === "CRITICAL") {
    console.error(JSON.stringify(logEntry));
    sendPage(alert);
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

function resolveAlert(id: string): void {
  const existing = activeAlerts.get(id);
  if (!existing || existing.status === "resolved") return;

  existing.status = "resolved";
  existing.resolvedAt = new Date();
  existing.lastEvaluatedAt = new Date();

  alertHistory.push({ ...existing });
  activeAlerts.delete(id);

  console.log(
    JSON.stringify({
      alert: "RESOLVED",
      severity: existing.severity,
      id: existing.id,
      name: existing.name,
      timestamp: new Date().toISOString(),
    })
  );
}

function sendPage(alert: Alert): void {
  const lastPaged = lastPagedAt.get(alert.id);
  const now = new Date();

  if (lastPaged && now.getTime() - lastPaged.getTime() < PAGING_CONFIG.dedupWindowMs) {
    console.log(
      JSON.stringify({
        alert: "PAGE_DEDUPLICATED",
        id: alert.id,
        lastPagedAt: lastPaged.toISOString(),
        nextPageAllowedAt: new Date(lastPaged.getTime() + PAGING_CONFIG.dedupWindowMs).toISOString(),
      })
    );
    return;
  }

  lastPagedAt.set(alert.id, now);

  const pagePayload = {
    type: "CRITICAL_ALERT",
    id: alert.id,
    severity: alert.severity,
    name: alert.name,
    description: alert.description,
    labels: alert.labels,
    startedAt: alert.startedAt.toISOString(),
    consecutiveHits: alert.consecutiveHits,
    killSwitch: "Set SCHEDULER_ENABLED=false to pause aggregations",
    correlationId: alert.id,
    timestamp: now.toISOString(),
  };

  console.error(
    JSON.stringify({
      PAGE: true,
      ...pagePayload,
    })
  );
}

function incrementConsecutiveHits(alertId: string): void {
  const current = consecutiveHitsTracker.get(alertId) || 0;
  consecutiveHitsTracker.set(alertId, current + 1);
}

function resetConsecutiveHits(alertId: string): void {
  consecutiveHitsTracker.delete(alertId);
}

function getConsecutiveHits(alertId: string): number {
  return consecutiveHitsTracker.get(alertId) || 0;
}

// ============================================================================
// QUERY INTERFACE
// ============================================================================

export function getActiveAlerts(): Alert[] {
  return Array.from(activeAlerts.values());
}

export function getAlertHistory(limit: number = 50): Alert[] {
  return alertHistory.slice(-limit);
}

export function getAlertById(id: string): Alert | undefined {
  return activeAlerts.get(id);
}

export function updateBaselines(newBaselines: Partial<typeof BASELINES>): void {
  Object.assign(BASELINES, newBaselines);
  console.log("Baselines updated:", newBaselines);
}

export function resetAlerts(): void {
  activeAlerts.clear();
  alertHistory.length = 0;
  consecutiveHitsTracker.clear();
  lastPagedAt.clear();
}

export function getPagingState(): Map<string, Date> {
  return new Map(lastPagedAt);
}
