import { recordJobError, recordJobSuccess } from "./alerts";
/**
 * Metrics Emission Layer (Phase 1: Observability Hardening)
 *
 * Purpose:
 * - Emit scheduler job metrics (duration, rows, errors, overlap)
 * - Emit DB pool health metrics (active, waiting, latency)
 * - Emit HTTP status class metrics (2xx, 4xx, 5xx)
 *
 * Design Principles:
 * - Fire-and-forget: metric emission never blocks or crashes job execution
 * - Non-blocking: all emissions are guarded with try-catch
 * - Monotonic counters: use totals for counters, histograms for durations
 * - Low cardinality: job name only, no high-cardinality fields
 *
 * Future: Wire to Prometheus/Grafana/CloudWatch/etc.
 * For now: console.log structured JSON for manual verification.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SchedulerJobMetrics {
  job: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  rowsWritten?: number;
  overlap?: boolean;
  error?: boolean;
}

export interface DbPoolMetrics {
  active: number;
  idle: number;
  waiting: number;
  acquireLatencyMs?: number;
  errors?: number;
}

export interface HttpStatusMetrics {
  statusClass: "2xx" | "4xx" | "5xx";
  count: number;
}

// ============================================================================
// IN-MEMORY METRIC STORAGE (for local verification)
// ============================================================================

const jobMetrics: Map<string, SchedulerJobMetrics[]> = new Map();
const poolMetricsHistory: DbPoolMetrics[] = [];
const httpMetricsHistory: Map<string, number> = new Map([
  ["2xx", 0],
  ["4xx", 0],
  ["5xx", 0],
]);

// ============================================================================
// SCHEDULER JOB METRICS
// ============================================================================

/**
 * Emit job start event
 * Call at the beginning of each scheduled job run.
 */
export function emitJobStart(jobName: string): void {
  try {
    const metric: SchedulerJobMetrics = {
      job: jobName,
      startTime: Date.now(),
    };

    if (!jobMetrics.has(jobName)) {
      jobMetrics.set(jobName, []);
    }
    jobMetrics.get(jobName)!.push(metric);

    // Structured log (future: export to monitoring system)
    console.log(
      JSON.stringify({
        metric: "scheduler_job_start_total",
        job: jobName,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    // Silent failure: never crash job execution
    console.error("Metrics emission failed (job start):", error);
  }
}

/**
 * Emit job completion event
 * Call at the end of each scheduled job run.
 */
export function emitJobEnd(
  jobName: string,
  rowsWritten: number,
  overlap: boolean = false
): void {
  try {
    const history = jobMetrics.get(jobName);
    if (!history || history.length === 0) {
      console.warn(`No start event found for job: ${jobName}`);
      return;
    }

    const lastRun = history[history.length - 1];
    const endTime = Date.now();
    const durationMs = endTime - lastRun.startTime;

    lastRun.endTime = endTime;
    lastRun.durationMs = durationMs;
    lastRun.rowsWritten = rowsWritten;
    lastRun.overlap = overlap;
    lastRun.error = false;

      // Record success in alerts system
      recordJobSuccess(jobName);

    // Structured logs (future: export to monitoring system)
    console.log(
      JSON.stringify({
        metric: "scheduler_job_duration_ms",
        job: jobName,
        value: durationMs,
        timestamp: new Date().toISOString(),
      })
    );

    console.log(
      JSON.stringify({
        metric: "scheduler_job_rows_written",
        job: jobName,
        value: rowsWritten,
        timestamp: new Date().toISOString(),
      })
    );

    if (overlap) {
      console.log(
        JSON.stringify({
          metric: "scheduler_job_overlap_total",
          job: jobName,
          value: 1,
          timestamp: new Date().toISOString(),
        })
      );
    }
  } catch (error) {
    // Silent failure: never crash job execution
    console.error("Metrics emission failed (job end):", error);
  }
}

/**
 * Emit job error event
 * Call in the catch block of each scheduled job.
 */
export function emitJobError(jobName: string, error: any): void {
  try {
    const history = jobMetrics.get(jobName);
    if (history && history.length > 0) {
      const lastRun = history[history.length - 1];
      lastRun.error = true;
    }

      // Record error in alerts system
      recordJobError(jobName);

    console.log(
      JSON.stringify({
        metric: "scheduler_job_error_total",
        job: jobName,
        value: 1,
        error: error?.message || String(error),
        timestamp: new Date().toISOString(),
      })
    );
  } catch (emitError) {
    // Silent failure: never crash job execution
    console.error("Metrics emission failed (job error):", emitError);
  }
}

// ============================================================================
// DB POOL METRICS
// ============================================================================

/**
 * Emit DB pool health snapshot
 * Call periodically (e.g., every 60 seconds) or on-demand.
 */
export function emitPoolMetrics(metrics: DbPoolMetrics): void {
  try {
    poolMetricsHistory.push({ ...metrics });

    // Keep only last 100 snapshots
    if (poolMetricsHistory.length > 100) {
      poolMetricsHistory.shift();
    }

    console.log(
      JSON.stringify({
        metric: "db_pool_snapshot",
        active: metrics.active,
        idle: metrics.idle,
        waiting: metrics.waiting,
        acquireLatencyMs: metrics.acquireLatencyMs,
        errors: metrics.errors,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    // Silent failure: never crash application
    console.error("Metrics emission failed (pool):", error);
  }
}

// ============================================================================
// HTTP STATUS METRICS
// ============================================================================

/**
 * Emit HTTP status class count
 * Call after each HTTP response (via middleware).
 */
export function emitHttpStatus(statusCode: number): void {
  try {
    let statusClass: "2xx" | "4xx" | "5xx";

    if (statusCode >= 200 && statusCode < 300) {
      statusClass = "2xx";
    } else if (statusCode >= 400 && statusCode < 500) {
      statusClass = "4xx";
    } else if (statusCode >= 500) {
      statusClass = "5xx";
    } else {
      return; // Ignore 1xx, 3xx for now
    }

    const currentCount = httpMetricsHistory.get(statusClass) || 0;
    httpMetricsHistory.set(statusClass, currentCount + 1);

    console.log(
      JSON.stringify({
        metric: "http_requests_total",
        status_class: statusClass,
        value: currentCount + 1,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    // Silent failure: never crash request handling
    console.error("Metrics emission failed (http):", error);
  }
}

// ============================================================================
// QUERY INTERFACE (for dashboards/debugging)
// ============================================================================

/**
 * Get all job metrics (for local verification)
 */
export function getJobMetrics(jobName?: string): SchedulerJobMetrics[] {
  if (jobName) {
    return jobMetrics.get(jobName) || [];
  }

  // Return all jobs
  const allMetrics: SchedulerJobMetrics[] = [];
  for (const metrics of jobMetrics.values()) {
    allMetrics.push(...metrics);
  }
  return allMetrics;
}

/**
 * Get pool metrics history
 */
export function getPoolMetrics(): DbPoolMetrics[] {
  return [...poolMetricsHistory];
}

/**
 * Get HTTP status distribution
 */
export function getHttpMetrics(): Record<string, number> {
  return Object.fromEntries(httpMetricsHistory);
}

/**
 * Calculate percentiles for job durations
 * Useful for dashboard queries (p50, p95, p99)
 */
export function calculateJobDurationPercentiles(
  jobName: string
): { p50: number; p95: number; p99: number } | null {
  const metrics = jobMetrics.get(jobName);
  if (!metrics || metrics.length === 0) {
    return null;
  }

  const durations = metrics
    .filter((m) => m.durationMs !== undefined)
    .map((m) => m.durationMs!)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return null;
  }

  const p50Index = Math.floor(durations.length * 0.5);
  const p95Index = Math.floor(durations.length * 0.95);
  const p99Index = Math.floor(durations.length * 0.99);

  return {
    p50: durations[p50Index],
    p95: durations[p95Index],
    p99: durations[p99Index],
  };
}

/**
 * Reset all metrics (for testing only)
 */
export function resetMetrics(): void {
  jobMetrics.clear();
  poolMetricsHistory.length = 0;
  httpMetricsHistory.set("2xx", 0);
  httpMetricsHistory.set("4xx", 0);
  httpMetricsHistory.set("5xx", 0);
}
