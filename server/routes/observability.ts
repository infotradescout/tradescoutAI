/**
 * Observability Metrics API
 * Phase 2: Dashboard endpoint for visualizing Phase 1 metrics
 *
 * Purpose:
 * - Expose structured metrics for dashboard consumption
 * - Enable baseline capture (24-72h observation)
 * - Admin-only access (no user-facing exposure)
 *
 * Design:
 * - Read-only (no metric manipulation)
 * - Returns aggregated views for dashboards
 * - Low overhead (in-memory queries only)
 */

import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { events } from "../../shared/schema";
import { storage } from "../storage";
import {
  getJobMetrics,
  getPoolMetrics,
  getHttpMetrics,
  calculateJobDurationPercentiles,
} from "../observability/metrics";
import {
  getActiveAlerts,
  getAlertHistory,
  BASELINES,
  updateBaselines,
} from "../observability/alerts";
import { sendInternalServerError } from "../utils/httpErrors";

export const observabilityRouter = Router();

/**
 * GET /api/admin/observability/summary
 * Returns high-level metrics summary for dashboard overview
 */
observabilityRouter.get("/summary", (req, res) => {
  try {
    const jobNames = ["users_aggregation", "affiliates_aggregation", "trade_deals_aggregation"];
    const jobSummaries = jobNames.map((jobName) => {
      const metrics = getJobMetrics(jobName);
      const percentiles = calculateJobDurationPercentiles(jobName);
      const totalRuns = metrics.length;
      const errorCount = metrics.filter((m) => m.error).length;
      const overlapCount = metrics.filter((m) => m.overlap).length;
      
      const rowsWritten = metrics
        .filter((m) => m.rowsWritten !== undefined)
        .map((m) => m.rowsWritten!);
      
      const avgRows = rowsWritten.length > 0
        ? rowsWritten.reduce((a, b) => a + b, 0) / rowsWritten.length
        : 0;
      
      const minRows = rowsWritten.length > 0 ? Math.min(...rowsWritten) : 0;
      const maxRows = rowsWritten.length > 0 ? Math.max(...rowsWritten) : 0;

      return {
        jobName,
        totalRuns,
        errorCount,
        overlapCount,
        duration: percentiles,
        rowsWritten: {
          min: minRows,
          avg: Math.round(avgRows),
          max: maxRows,
        },
      };
    });

    const poolMetrics = getPoolMetrics();
    const latestPool = poolMetrics[poolMetrics.length - 1] || {
      active: 0,
      idle: 0,
      waiting: 0,
    };

    const httpMetrics = getHttpMetrics();

    res.json({
      timestamp: new Date().toISOString(),
      scheduler: jobSummaries,
      dbPool: {
        current: latestPool,
        history: poolMetrics.slice(-20), // Last 20 snapshots
      },
      http: {
        statusClasses: httpMetrics,
        total: Object.values(httpMetrics).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    console.error("Observability summary failed:", error);
    sendInternalServerError(res, "Failed to fetch metrics summary", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/jobs/:jobName
 * Returns detailed metrics for a specific job
 */
observabilityRouter.get("/jobs/:jobName", (req, res) => {
  try {
    const { jobName } = req.params;
    const metrics = getJobMetrics(jobName);
    const percentiles = calculateJobDurationPercentiles(jobName);

    res.json({
      jobName,
      totalRuns: metrics.length,
      percentiles,
      history: metrics.slice(-50), // Last 50 runs
    });
  } catch (error) {
    console.error("Job metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch job metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/pool
 * Returns DB pool health metrics
 */
observabilityRouter.get("/pool", (req, res) => {
  try {
    const poolMetrics = getPoolMetrics();
    
    res.json({
      current: poolMetrics[poolMetrics.length - 1] || null,
      history: poolMetrics.slice(-100), // Last 100 snapshots
    });
  } catch (error) {
    console.error("Pool metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch pool metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/http
 * Returns HTTP status distribution
 */
observabilityRouter.get("/http", (req, res) => {
  try {
    const httpMetrics = getHttpMetrics();
    const total = Object.values(httpMetrics).reduce((a, b) => a + b, 0);

    res.json({
      statusClasses: httpMetrics,
      total,
      percentages: {
        "2xx": total > 0 ? ((httpMetrics["2xx"] || 0) / total) * 100 : 0,
        "4xx": total > 0 ? ((httpMetrics["4xx"] || 0) / total) * 100 : 0,
        "5xx": total > 0 ? ((httpMetrics["5xx"] || 0) / total) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("HTTP metrics query failed:", error);
    sendInternalServerError(res, "Failed to fetch HTTP metrics", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/health
 * Quick health check endpoint
 */
observabilityRouter.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    phase: "Phase 3: Warn-Level Alerts",
  });
});

/**
 * GET /api/admin/observability/alerts
 * Returns active alerts and recent history
 */
observabilityRouter.get("/alerts", (req, res) => {
  try {
    const activeAlerts = getActiveAlerts();
    const history = getAlertHistory(20); // Last 20 resolved alerts

    res.json({
      active: activeAlerts,
      history,
      total: activeAlerts.length,
    });
  } catch (error) {
    console.error("Alert query failed:", error);
    sendInternalServerError(res, "Failed to fetch alerts", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/baselines
 * Returns current baseline configuration
 */
observabilityRouter.get("/baselines", (req, res) => {
  try {
    res.json(BASELINES);
  } catch (error) {
    console.error("Baseline query failed:", error);
    sendInternalServerError(res, "Failed to fetch baselines", { error: String(error) });
  }
});

/**
 * POST /api/admin/observability/baselines
 * Update baselines after Phase 2 capture
 */
observabilityRouter.post("/baselines", (req, res) => {
  try {
    const newBaselines = req.body;
    updateBaselines(newBaselines);
    res.json({ message: "Baselines updated", baselines: BASELINES });
  } catch (error) {
    console.error("Baseline update failed:", error);
    sendInternalServerError(res, "Failed to update baselines", { error: String(error) });
  }
});

/**
 * GET /api/admin/observability/scout-policy
 * Returns recent Scout policy violation telemetry for admin review.
 */
observabilityRouter.get("/scout-policy", async (req, res) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalCount, last7dCount] = await Promise.all([
      storage.getEventStats("scout_policy_violation_detected"),
      storage.getEventStats("scout_policy_violation_detected", { from: sevenDaysAgo, to: now }),
    ]);

    const recent = await db
      .select({
        id: events.id,
        createdAt: events.createdAt,
        data: events.data,
      })
      .from(events)
      .where(eq(events.eventType, "scout_policy_violation_detected"))
      .orderBy(desc(events.createdAt))
      .limit(25);

    res.json({
      total: totalCount,
      last7d: last7dCount,
      recent: (recent || []).map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        violationCount: (row.data as any)?.violationCount ?? 0,
        violations: (row.data as any)?.violations ?? [],
        countyCode: (row.data as any)?.countyCode ?? null,
        stateCode: (row.data as any)?.stateCode ?? null,
      })),
    });
  } catch (error) {
    console.error("Scout policy telemetry query failed:", error);
    sendInternalServerError(res, "Failed to fetch scout policy telemetry", { error: String(error) });
  }
});
