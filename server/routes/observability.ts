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
import { isAuthenticated, isAdmin } from "../auth";
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
  getBaselinesSnapshot,
  recomputeBaselinesFromObservedData,
} from "../observability/alerts";
import { sendInternalServerError } from "../utils/httpErrors";
import { getLisaFeed } from "../services/lisaRuntime";
import { getCrawlerTelemetrySummary } from "../services/crawlerTelemetryService";
import {
  getLiveStreamSnapshot,
  getLiveStreamSnapshotHistory,
  refreshLiveStreamSnapshot,
} from "../services/liveStreamSnapshotService";

export const observabilityRouter = Router();
observabilityRouter.use(isAuthenticated, isAdmin);

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

      const avgRows =
        rowsWritten.length > 0 ? rowsWritten.reduce((a, b) => a + b, 0) / rowsWritten.length : 0;

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
 * GET /api/admin/observability/lisa-feed
 * Live natural-language feed of what Scout/TradeScout is producing right now.
 */
observabilityRouter.get("/lisa-feed", async (_req, res) => {
  try {
    res.json(await getLisaFeed());
  } catch (error) {
    console.error("LISA feed query failed:", error);
    sendInternalServerError(res, "Failed to fetch LISA feed", { error: String(error) });
  }
});

observabilityRouter.get("/crawler-telemetry", async (_req, res) => {
  try {
    res.json(await getCrawlerTelemetrySummary());
  } catch (error) {
    console.error("Crawler telemetry query failed:", error);
    sendInternalServerError(res, "Failed to fetch crawler telemetry", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream", async (req, res) => {
  try {
    res.json(
      await getLiveStreamSnapshot({
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "20"), 10),
      })
    );
  } catch (error) {
    console.error("Live stream query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream/history", async (req, res) => {
  try {
    res.json({
      history: await getLiveStreamSnapshotHistory({
        source: String((req.query as any)?.source || ""),
        stateCode: String((req.query as any)?.stateCode || ""),
        county: String((req.query as any)?.county || ""),
        limit: Number.parseInt(String((req.query as any)?.limit || "10"), 10),
      }),
    });
  } catch (error) {
    console.error("Live stream history query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream history", { error: String(error) });
  }
});

observabilityRouter.post("/live-stream/refresh", async (req, res) => {
  try {
    res.json(
      await refreshLiveStreamSnapshot({
        source: String((req.body as any)?.source || (req.query as any)?.source || ""),
        stateCode: String((req.body as any)?.stateCode || (req.query as any)?.stateCode || ""),
        county: String((req.body as any)?.county || (req.query as any)?.county || ""),
        limit: Number.parseInt(
          String((req.body as any)?.limit || (req.query as any)?.limit || "20"),
          10
        ),
      })
    );
  } catch (error) {
    console.error("Live stream refresh failed:", error);
    sendInternalServerError(res, "Failed to refresh live stream", { error: String(error) });
  }
});

observabilityRouter.get("/live-stream/export.csv", async (req, res) => {
  try {
    const source = String((req.query as any)?.source || "");
    const stateCode = String((req.query as any)?.stateCode || "");
    const county = String((req.query as any)?.county || "");
    const limit = Number.parseInt(String((req.query as any)?.limit || "20"), 10);

    const snapshot = await getLiveStreamSnapshot({
      source,
      stateCode,
      county,
      limit,
    });

    const header = [
      "generated_at",
      "source_filter",
      "state_filter",
      "county_filter",
      "entry_id",
      "entry_timestamp",
      "kind",
      "priority",
      "title",
      "source",
      "state_code",
      "county_name",
      "narrative",
    ];

    const escapeCsv = (value: unknown) => {
      const normalized = String(value ?? "");
      if (/[",\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
      }
      return normalized;
    };

    const lines = [header.join(",")];
    for (const item of snapshot.stream || []) {
      lines.push(
        [
          snapshot.generatedAt,
          snapshot.filters.source || "",
          snapshot.filters.stateCode || "",
          snapshot.filters.county || "",
          item.id,
          item.timestamp,
          item.kind,
          item.priority,
          item.title,
          item.source,
          item.stateCode || "",
          item.countyName || "",
          item.narrative,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    const suffix = [
      "live-stream",
      source || "all-sources",
      stateCode || "all-states",
      county || "all-counties",
      new Date().toISOString().slice(0, 10),
    ].join("-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${suffix}.csv"`);
    res.status(200).send(`\uFEFF${lines.join("\n")}`);
  } catch (error) {
    console.error("Live stream export failed:", error);
    sendInternalServerError(res, "Failed to export live stream", { error: String(error) });
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
    res.json(getBaselinesSnapshot());
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
 * POST /api/admin/observability/baselines/recompute
 * Recompute baselines from observed in-memory metrics.
 */
observabilityRouter.post("/baselines/recompute", (req, res) => {
  try {
    const snapshot = recomputeBaselinesFromObservedData();
    res.json({
      message: "Baselines recomputed from observed data",
      ...snapshot,
    });
  } catch (error) {
    console.error("Baseline recompute failed:", error);
    sendInternalServerError(res, "Failed to recompute baselines", { error: String(error) });
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
    sendInternalServerError(res, "Failed to fetch scout policy telemetry", {
      error: String(error),
    });
  }
});
