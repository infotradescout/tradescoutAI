/**
 * Scout Watchdog Router
 *
 * Endpoints for monitoring system health and accessing self-healing suggestions.
 *
 * Base Path: /api/scout-watchdog
 */

import { Router, type Request, Response } from "express";
import ScoutWatchdog from "../services/scoutWatchdog";
import ScoutSelfHealing from "../services/scoutSelfHealing";
import ScoutOutboundDispatcher from "../services/scoutOutboundDispatcher";

const router = Router();
const watchdogService = new ScoutWatchdog();
const selfHealingService = new ScoutSelfHealing();

// Note: In a real implementation, you would pass the SOD service instance
// For now, we'll create a local instance
const sodService = new ScoutOutboundDispatcher();

/**
 * GET /health - Get the latest system health report
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const report = await watchdogService.generateHealthReport();

    // If critical anomalies detected, dispatch alert via SOD
    if (report.anomalies_detected.some((a) => a.severity === "critical")) {
      sodService.queueEvent({
        event_type: "risk_detected",
        priority: "critical",
        source: "analysis",
        payload: {
          alert_type: "system_health_critical",
          report_id: report.report_id,
          anomalies: report.anomalies_detected.filter((a) => a.severity === "critical"),
        },
        metadata: {
          tags: ["watchdog", "critical"],
        },
      });
    }

    return res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error("[Watchdog] Health report error:", error);
    return res.status(500).json({
      error: "Failed to generate health report",
    });
  }
});

/**
 * GET /history - Get health history
 */
router.get("/history", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = watchdogService.getHealthHistory(limit);

    return res.json({
      success: true,
      reports_count: history.length,
      reports: history,
    });
  } catch (error) {
    console.error("[Watchdog] History error:", error);
    return res.status(500).json({
      error: "Failed to retrieve health history",
    });
  }
});

/**
 * GET /alerts - Get critical alerts
 */
router.get("/alerts", (req: Request, res: Response) => {
  try {
    const alerts = watchdogService.getCriticalAlerts();

    return res.json({
      success: true,
      alerts_count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("[Watchdog] Alerts error:", error);
    return res.status(500).json({
      error: "Failed to retrieve critical alerts",
    });
  }
});

/**
 * GET /statistics - Get watchdog statistics
 */
router.get("/statistics", (req: Request, res: Response) => {
  try {
    const stats = watchdogService.getStatistics();

    return res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("[Watchdog] Statistics error:", error);
    return res.status(500).json({
      error: "Failed to retrieve statistics",
    });
  }
});

/**
 * POST /analyze-error - Analyze an error and get suggestions
 */
router.post("/analyze-error", async (req: Request, res: Response) => {
  try {
    const { error_type, error_message, affected_endpoints } = req.body;

    if (!error_type || !error_message) {
      return res.status(400).json({
        error: "Missing required fields: error_type, error_message",
      });
    }

    // Analyze the error
    const errorPattern = await selfHealingService.analyzeError(
      error_type,
      error_message,
      affected_endpoints || []
    );

    // Perform root cause analysis
    const rootCauseAnalysis = await selfHealingService.performRootCauseAnalysis(errorPattern);

    // Generate suggested fixes
    const suggestedFix = await selfHealingService.generateSuggestedFixes(
      errorPattern,
      rootCauseAnalysis
    );

    // If critical and admin action required, dispatch alert via SOD
    if (errorPattern.severity === "critical" && suggestedFix.admin_action_required) {
      sodService.queueEvent({
        event_type: "risk_detected",
        priority: "critical",
        source: "analysis",
        payload: {
          alert_type: "critical_error_with_fix",
          error_pattern: errorPattern,
          suggested_fix: suggestedFix,
        },
        metadata: {
          tags: ["self-healing", "critical"],
        },
      });
    }

    return res.json({
      success: true,
      data: {
        error_pattern: errorPattern,
        root_cause_analysis: rootCauseAnalysis,
        suggested_fix: suggestedFix,
      },
    });
  } catch (error) {
    console.error("[Watchdog] Error analysis error:", error);
    return res.status(500).json({
      error: "Failed to analyze error",
    });
  }
});

/**
 * GET /error-patterns - Get all detected error patterns
 */
router.get("/error-patterns", (req: Request, res: Response) => {
  try {
    const patterns = selfHealingService.getErrorPatterns();

    return res.json({
      success: true,
      patterns_count: patterns.length,
      patterns,
    });
  } catch (error) {
    console.error("[Watchdog] Error patterns error:", error);
    return res.status(500).json({
      error: "Failed to retrieve error patterns",
    });
  }
});

/**
 * GET /suggested-fixes - Get all suggested fixes
 */
router.get("/suggested-fixes", (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const fixes = selfHealingService.getSuggestedFixes(limit);

    return res.json({
      success: true,
      fixes_count: fixes.length,
      fixes,
    });
  } catch (error) {
    console.error("[Watchdog] Suggested fixes error:", error);
    return res.status(500).json({
      error: "Failed to retrieve suggested fixes",
    });
  }
});

/**
 * GET /critical-fixes - Get critical fixes requiring admin action
 */
router.get("/critical-fixes", (req: Request, res: Response) => {
  try {
    const fixes = selfHealingService.getCriticalFixes();

    return res.json({
      success: true,
      fixes_count: fixes.length,
      fixes,
    });
  } catch (error) {
    console.error("[Watchdog] Critical fixes error:", error);
    return res.status(500).json({
      error: "Failed to retrieve critical fixes",
    });
  }
});

/**
 * GET /self-healing-stats - Get self-healing statistics
 */
router.get("/self-healing-stats", (req: Request, res: Response) => {
  try {
    const stats = selfHealingService.getStatistics();

    return res.json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    console.error("[Watchdog] Self-healing stats error:", error);
    return res.status(500).json({
      error: "Failed to retrieve self-healing statistics",
    });
  }
});

export default router;
