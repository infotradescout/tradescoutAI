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
import { getPartnerIntelligenceBriefSnapshot } from "../services/partnerIntelligenceBriefSnapshotService";

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
    const sourceFilter = String((req.query as any)?.source || "")
      .trim()
      .toLowerCase();
    const stateCode = String((req.query as any)?.stateCode || "")
      .trim()
      .toUpperCase();
    const countyFilter = String((req.query as any)?.county || "")
      .trim()
      .toLowerCase();
    const limitRaw = Number.parseInt(String((req.query as any)?.limit || "20"), 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(100, limitRaw)) : 20;

    const [lisaFeed, crawlerTelemetry, cumulusBrief, activeAlerts] = await Promise.all([
      getLisaFeed(),
      getCrawlerTelemetrySummary(),
      getPartnerIntelligenceBriefSnapshot({
        partnerSlug: "cumulus-media",
        window: "24h",
        stateCode: stateCode || undefined,
        limit: 100,
      }),
      Promise.resolve(getActiveAlerts()),
    ]);

    const stream = [
      {
        id: `lisa-truth-${lisaFeed.generatedAt}`,
        timestamp: lisaFeed.generatedAt,
        kind: "truth_now",
        priority: "high",
        title: "Truth Now",
        narrative: lisaFeed.summary.truthNow,
        source: "lisa",
        stateCode: null,
        countyName: null,
      },
      {
        id: `lisa-data-${lisaFeed.generatedAt}`,
        timestamp: lisaFeed.generatedAt,
        kind: "data_production",
        priority: "medium",
        title: "Data Production",
        narrative: lisaFeed.summary.dataProductionSummary,
        source: "lisa",
        stateCode: null,
        countyName: null,
      },
      {
        id: `lisa-llm-${lisaFeed.generatedAt}`,
        timestamp: lisaFeed.generatedAt,
        kind: "llm_optimization",
        priority: "medium",
        title: "LLM Optimization",
        narrative: lisaFeed.summary.llmOptimizationSummary,
        source: "lisa",
        stateCode: null,
        countyName: null,
      },
      {
        id: `cumulus-brief-${cumulusBrief.generatedAt}`,
        timestamp: cumulusBrief.generatedAt,
        kind: "partner_brief",
        priority: "high",
        title: "Partner Brief",
        narrative: cumulusBrief.executiveSummary,
        source: "cumulus",
        stateCode: cumulusBrief.summary.currentLeadState || null,
        countyName: cumulusBrief.summary.currentLeadCounty || null,
      },
      {
        id: `cumulus-delta-${cumulusBrief.generatedAt}`,
        timestamp: cumulusBrief.generatedAt,
        kind: "partner_delta",
        priority: "medium",
        title: "Partner Delta",
        narrative: cumulusBrief.summary.deltaSummary,
        source: "cumulus",
        stateCode: cumulusBrief.summary.currentLeadState || null,
        countyName: cumulusBrief.summary.currentLeadCounty || null,
      },
      ...(cumulusBrief.topCounties?.[0]
        ? [
            {
              id: `cumulus-county-${cumulusBrief.generatedAt}-${cumulusBrief.topCounties[0].countyFips}`,
              timestamp: cumulusBrief.generatedAt,
              kind: "county_lead",
              priority: "medium",
              title: "Leading County",
              narrative: `${cumulusBrief.topCounties[0].countyName}, ${cumulusBrief.topCounties[0].stateCode} leads with ${cumulusBrief.topCounties[0].requestCount} requests. ${cumulusBrief.topCounties[0].dominantSurface.replace(/_/g, " ")} is the dominant surface.`,
              source: "cumulus",
              stateCode: cumulusBrief.topCounties[0].stateCode,
              countyName: cumulusBrief.topCounties[0].countyName,
            },
          ]
        : []),
      ...(cumulusBrief.topStates?.[0]
        ? [
            {
              id: `cumulus-state-${cumulusBrief.generatedAt}-${cumulusBrief.topStates[0].stateCode}`,
              timestamp: cumulusBrief.generatedAt,
              kind: "state_lead",
              priority: "medium",
              title: "Leading State Cluster",
              narrative: `${cumulusBrief.topStates[0].stateCode} leads with ${cumulusBrief.topStates[0].requestCount} requests across ${cumulusBrief.topStates[0].countyCount} counties.`,
              source: "cumulus",
              stateCode: cumulusBrief.topStates[0].stateCode,
              countyName: null,
            },
          ]
        : []),
      {
        id: `crawler-total-${crawlerTelemetry.generatedAt}`,
        timestamp: crawlerTelemetry.generatedAt,
        kind: "crawler_volume",
        priority: "medium",
        title: "Crawler Volume",
        narrative: `${crawlerTelemetry.totals24h.total} crawler requests were observed in the last 24 hours with ${crawlerTelemetry.totals24h.ok} returning 2xx and ${crawlerTelemetry.totals24h.serverError} returning 5xx.`,
        source: "crawler",
        stateCode: null,
        countyName: null,
      },
      ...(crawlerTelemetry.topBots?.[0]
        ? [
            {
              id: `crawler-bot-${crawlerTelemetry.generatedAt}-${crawlerTelemetry.topBots[0].botName}`,
              timestamp: crawlerTelemetry.generatedAt,
              kind: "crawler_top_bot",
              priority: "low",
              title: "Top Bot",
              narrative: `${crawlerTelemetry.topBots[0].botName} is the most active crawler right now with ${crawlerTelemetry.topBots[0].requestCount} requests.`,
              source: "crawler",
              stateCode: null,
              countyName: null,
            },
          ]
        : []),
      ...(activeAlerts || []).slice(0, 3).map((alert) => {
        const labelStateCode =
          String(alert.labels?.stateCode || "")
            .trim()
            .toUpperCase() || null;
        const labelCountyName = String(alert.labels?.countyName || "").trim() || null;
        return {
          id: `alert-${alert.id}`,
          timestamp: alert.lastEvaluatedAt || alert.startedAt,
          kind: "alert",
          priority:
            alert.severity === "CRITICAL"
              ? "critical"
              : alert.severity === "WARN"
                ? "high"
                : "medium",
          title: alert.name,
          narrative: alert.description,
          source: "alerts",
          stateCode: labelStateCode,
          countyName: labelCountyName,
        };
      }),
      ...lisaFeed.feed.slice(0, 8).map((item) => {
        const normalizedScopeRef = String(item.scopeRef || "").trim();
        const countyScopeName =
          item.scopeType === "county" && normalizedScopeRef
            ? normalizedScopeRef.replace(/[-_]/g, " ")
            : null;
        return {
          id: item.id,
          timestamp:
            item.freshnessMinutes !== null
              ? new Date(Date.now() - item.freshnessMinutes * 60_000).toISOString()
              : lisaFeed.generatedAt,
          kind: "finding",
          priority: item.priority,
          title: item.headline,
          narrative: item.narrative,
          source: item.sourceKind,
          stateCode: null,
          countyName: countyScopeName,
        };
      }),
    ]
      .filter((entry) => {
        if (sourceFilter && entry.source !== sourceFilter) return false;
        if (stateCode && entry.stateCode && entry.stateCode !== stateCode) {
          return false;
        }
        if (countyFilter && entry.countyName) {
          const normalizedCounty = String(entry.countyName).trim().toLowerCase();
          if (!normalizedCounty.includes(countyFilter)) return false;
        } else if (countyFilter && !entry.countyName) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    res.json({
      generatedAt: new Date().toISOString(),
      filters: {
        source: sourceFilter || null,
        stateCode: stateCode || null,
        county: countyFilter || null,
        limit,
      },
      summary: {
        truthNow: lisaFeed.summary.truthNow,
        currentLeadCounty: cumulusBrief.summary.currentLeadCounty,
        currentLeadState: cumulusBrief.summary.currentLeadState,
        crawlerRequests24h: crawlerTelemetry.totals24h.total,
        activeAlerts: activeAlerts.length,
      },
      stream,
    });
  } catch (error) {
    console.error("Live stream query failed:", error);
    sendInternalServerError(res, "Failed to fetch live stream", { error: String(error) });
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
