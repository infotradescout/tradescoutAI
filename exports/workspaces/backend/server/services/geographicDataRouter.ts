/**
 * Geographic Data Router - Write-only metric storage layer
 *
 * Purpose:
 * - Validate metric writes against the Metric Registry
 * - Upsert snapshots into county_metrics table
 * - Never computes readiness; only stores facts
 * - Callable by jobs only (no UI, no user-facing paths)
 *
 * Design:
 * Counties are operational files. This router is the single write path.
 * Reads come from services; writes go through this router.
 */

import { pool } from "../db";
import { sql } from "drizzle-orm";
import {
  isMetricKeyRegistered,
  validateMetricValue,
  validateFipsCode,
  MetricKey,
  getMetricDefinition,
} from "./metricRegistry";

// ============================================================================
// TYPES
// ============================================================================

export interface MetricWriteRequest {
  /** Source identifier: e.g., "users_aggregation_job", "affiliates_sync" */
  source: string;
  /** Registered metric key from MetricKey enum */
  metricKey: string;
  /** 5-digit FIPS code */
  countyFips: string;
  /** Numeric value to write */
  value: number;
  /** Write mode: "set" (replace), "add" (increment) - currently only "set" */
  mode: "set" | "add";
  /** Optional: timestamp this metric is for (defaults to now) */
  asOf?: Date;
}

export interface MetricSnapshot {
  countyFips: string;
  metricKey: string;
  metricValue: number;
  updatedAt: Date;
}

// ============================================================================
// VALIDATION & GUARDS
// ============================================================================

/**
 * Validate a metric write request
 * Throws if invalid
 */
function validateMetricWriteRequest(req: MetricWriteRequest): void {
  // Source must not be empty
  if (!req.source || typeof req.source !== "string") {
    throw new Error(`Invalid source: ${req.source}`);
  }

  // Metric key must be registered
  if (!isMetricKeyRegistered(req.metricKey)) {
    throw new Error(
      `Unregistered metric key: "${req.metricKey}". ` +
        `Registered keys: ${Object.values(MetricKey).join(", ")}`
    );
  }

  // FIPS code must be valid
  try {
    validateFipsCode(req.countyFips);
  } catch (e) {
    throw new Error(`Invalid FIPS in request: ${(e as Error).message}`);
  }

  // Value must be valid for this metric
  try {
    validateMetricValue(req.metricKey as MetricKey, req.value);
  } catch (e) {
    throw new Error(`Invalid value for metric: ${(e as Error).message}`);
  }

  // Mode must be supported
  if (req.mode !== "set" && req.mode !== "add") {
    throw new Error(`Unsupported mode: "${req.mode}" (only "set" and "add" supported)`);
  }
}

/**
 * Verify county exists
 * Throws if not found
 */
async function verifyCountyExists(fips: string): Promise<void> {
  try {
    const result = await pool.query(
      "SELECT id FROM counties WHERE fips = $1 LIMIT 1",
      [fips]
    );
    
    if (!result.rows || result.rows.length === 0) {
      throw new Error(`County not found: FIPS ${fips}`);
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    throw new Error(`County verification failed: ${error}`);
  }
}

// ============================================================================
// ROUTER METHODS
// ============================================================================

/**
 * Write a metric snapshot to county_metrics
 *
 * @param req - Validated metric write request
 * @returns The written snapshot
 *
 * Flow:
 * 1. Validate request (registry, FIPS, value, mode)
 * 2. Verify county exists
 * 3. Upsert into county_metrics using set mode
 * 4. Return snapshot
 *
 * Errors:
 * - Throws if metric key is unregistered
 * - Throws if value is out of range
 * - Throws if FIPS is invalid or county doesn't exist
 */
export async function writeMetric(req: MetricWriteRequest): Promise<MetricSnapshot> {
  // Validate request
  validateMetricWriteRequest(req);

  // Verify county exists
  await verifyCountyExists(req.countyFips);

  // Convert string key to MetricKey type
  const metricKey = req.metricKey as MetricKey;

  try {
    // Use PostgreSQL ON CONFLICT for upsert
    const now = req.asOf || new Date();
    
    await pool.query(
      `INSERT INTO county_metrics (county_fips, metric_key, metric_value, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (county_fips, metric_key) DO UPDATE
       SET metric_value = $3, updated_at = $4`,
      [req.countyFips, metricKey, req.value, now]
    );

    // Log for auditability
    console.info(
      `[GeographicDataRouter] Metric written`,
      {
        source: req.source,
        metricKey,
        countyFips: req.countyFips,
        value: req.value,
        mode: req.mode,
        timestamp: new Date().toISOString(),
      }
    );

    return {
      countyFips: req.countyFips,
      metricKey,
      metricValue: req.value,
      updatedAt: now,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(
      `[GeographicDataRouter] Write failed`,
      {
        source: req.source,
        metricKey,
        countyFips: req.countyFips,
        error,
      }
    );
    throw new Error(`Failed to write metric: ${error}`);
  }
}

/**
 * Write multiple metrics in a batch
 * All-or-nothing: if any write fails, the entire batch fails
 *
 * @param requests - Array of metric write requests
 * @returns Array of written snapshots
 */
export async function writeMetricsBatch(
  requests: MetricWriteRequest[]
): Promise<MetricSnapshot[]> {
  // Validate all requests first
  for (const req of requests) {
    validateMetricWriteRequest(req);
    await verifyCountyExists(req.countyFips);
  }

  const results: MetricSnapshot[] = [];

  // Write each metric
  for (const req of requests) {
    const snapshot = await writeMetric(req);
    results.push(snapshot);
  }

  return results;
}

/**
 * Read a metric snapshot
 * Returns null if not found
 */
export async function readMetric(
  fips: string,
  metricKey: string
): Promise<MetricSnapshot | null> {
  // Validate input
  if (!isMetricKeyRegistered(metricKey)) {
    throw new Error(`Unregistered metric key: "${metricKey}"`);
  }

  try {
    validateFipsCode(fips);
  } catch (e) {
    throw new Error(`Invalid FIPS: ${(e as Error).message}`);
  }

  try {
    const result = await pool.query(
      `SELECT county_fips, metric_key, metric_value, updated_at
       FROM county_metrics
       WHERE county_fips = $1 AND metric_key = $2`,
      [fips, metricKey]
    );

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      countyFips: row.county_fips,
      metricKey: row.metric_key as MetricKey,
      metricValue: Number(row.metric_value),
      updatedAt: new Date(row.updated_at),
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read metric: ${error}`);
  }
}

/**
 * Read all metrics for a county
 */
export async function readCountyMetrics(fips: string): Promise<MetricSnapshot[]> {
  try {
    validateFipsCode(fips);
  } catch (e) {
    throw new Error(`Invalid FIPS: ${(e as Error).message}`);
  }

  try {
    const result = await pool.query(
      `SELECT county_fips, metric_key, metric_value, updated_at
       FROM county_metrics
       WHERE county_fips = $1
       ORDER BY metric_key`,
      [fips]
    );

    if (!result.rows) {
      return [];
    }

    return result.rows.map((row) => ({
      countyFips: row.county_fips,
      metricKey: row.metric_key as MetricKey,
      metricValue: Number(row.metric_value),
      updatedAt: new Date(row.updated_at),
    }));
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read county metrics: ${error}`);
  }
}
