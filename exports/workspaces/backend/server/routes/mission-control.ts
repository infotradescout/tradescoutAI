import { Router, type Request, type Response } from "express";
import { isAuthenticated, requireRole } from "../auth";
import {
  createOneFixFromSource,
  getBotArmySprintQueue,
  getMissionControlCompromises,
  getMissionControlFailures,
  getMissionControlSummary,
  getOrCreateOneFix,
  getScoutHealthSummary,
  getTodayDecisions,
  recordBotUiFinding,
  recordDecision,
  runBotArmyAutoPromotion,
  updateOneFixStatus,
} from "../services/missionControl";
import { recordScoutInteraction } from "../services/missionControl";
import { getPreferredSourceMetrics } from "../services/preferredSource";
import { getCrawlerSchedulerStatus } from "../services/crawlerScheduler";
import type { InsertBotUiFinding } from "../../shared/schema";

const router = Router();

function isMissionControlIngestAuthorized(req: Request): boolean {
  const token = process.env.MISSION_CONTROL_BOT_TOKEN;
  const headerToken = (req.headers["x-mc-bot-token"] || "") as string;
  const authHeader = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const provided = headerToken || authHeader;
  if (token && provided && provided === token) {
    return true;
  }

  const rawRole = (req as any)?.user?.role || (req as any)?.user?.claims?.role;
  const normalizedRole =
    typeof rawRole === "string"
      ? rawRole.trim().toLowerCase() === "owner" || rawRole.trim().toLowerCase() === "head_admin"
        ? "super_admin"
        : rawRole.trim().toLowerCase()
      : "";
  return normalizedRole === "super_admin";
}

// Summary is read-heavy and useful to ops. Keep it accessible to ops_admin.
router.get(
  "/bot-army/sprint-queue",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const lookbackHours = Number.parseInt(String(req.query.lookbackHours || "6"), 10);
    const limit = Number.parseInt(String(req.query.limit || "25"), 10);
    const queue = await getBotArmySprintQueue({ lookbackHours, limit });
    res.json({
      generatedAt: new Date().toISOString(),
      lookbackHours: Number.isFinite(lookbackHours) ? lookbackHours : 6,
      limit: Number.isFinite(limit) ? limit : 25,
      queue,
    });
  }
);

router.get(
  "/summary",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const summary = await getMissionControlSummary();
    res.json(summary);
  }
);

router.get(
  "/failures",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const failures = await getMissionControlFailures();
    res.json(failures);
  }
);

router.get(
  "/compromises",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const compromises = await getMissionControlCompromises();
    res.json(compromises);
  }
);

router.get(
  "/scout-health",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const summary = await getScoutHealthSummary();
    res.json({ summary });
  }
);

router.get(
  "/one-fix",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const result = await getOrCreateOneFix();
    if (!result) {
      return res.status(204).end();
    }
    res.json(result);
  }
);

router.post(
  "/bot-army/auto-promote/trigger",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      lookbackHours?: number;
      limit?: number;
      minScore?: number;
    };

    try {
      const result = await runBotArmyAutoPromotion({
        lookbackHours: body.lookbackHours,
        limit: body.limit,
        minScore: body.minScore,
      });
      res.status(200).json(result);
    } catch (err) {
      console.error("[MissionControl] Failed to run bot-army auto-promotion", err);
      res.status(500).json({ message: "Failed to run bot-army auto-promotion" });
    }
  }
);

router.get(
  "/bot-army/auto-promote/status",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const schedulerStatus = getCrawlerSchedulerStatus();
    const enabled = process.env.BOT_ARMY_AUTO_PROMOTE_ENABLED === "true";
    const lookbackHours = Math.min(
      24,
      Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_LOOKBACK_HOURS || "6", 10))
    );
    const limit = Math.min(
      25,
      Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_LIMIT || "5", 10))
    );
    const minScore = Math.min(
      200,
      Math.max(1, Number.parseInt(process.env.BOT_ARMY_AUTO_PROMOTE_MIN_SCORE || "70", 10))
    );

    res.json({
      enabled,
      schedulerActive: Boolean(schedulerStatus?.botArmyAutoPromote?.active),
      schedule:
        schedulerStatus?.botArmyAutoPromote?.schedule ||
        process.env.BOT_ARMY_AUTO_PROMOTE_SCHEDULE ||
        "*/10 * * * *",
      settings: {
        lookbackHours,
        limit,
        minScore,
      },
    });
  }
);

router.post(
  "/one-fix/create",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const body = (req.body || {}) as {
      sourceType?: "bot_ui" | "scout" | "error_report";
      sourceId?: string;
      summary?: string;
      suggestedFix?: string;
      impactScore?: number;
    };

    if (!body.sourceType || !body.sourceId) {
      return res.status(400).json({ message: "sourceType and sourceId are required" });
    }

    try {
      const action = await createOneFixFromSource({
        sourceType: body.sourceType,
        sourceId: body.sourceId,
        summary: body.summary,
        suggestedFix: body.suggestedFix,
        impactScore: body.impactScore,
      });
      res.status(201).json(action);
    } catch (err) {
      console.error("[MissionControl] Failed to create one-fix action", err);
      res.status(500).json({ message: "Failed to create one-fix action" });
    }
  }
);

router.post(
  "/one-fix/:id/done",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const action = await updateOneFixStatus(id, "done", undefined, (req as any)?.user?.id);
    if (!action) {
      return res.status(404).json({ message: "Action not found" });
    }

    // Record decision
    await recordDecision({
      recommendedFixSourceType: action.sourceType,
      recommendedFixSourceId: action.sourceId,
      action: "done",
      actorUserId: (req as any)?.user?.id,
    });

    res.json(action);
  }
);

router.post(
  "/one-fix/:id/defer",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = (req.body || {}) as { reason?: string };
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ message: "Defer reason is required" });
    }
    const action = await updateOneFixStatus(id, "deferred", reason.trim(), (req as any)?.user?.id);
    if (!action) {
      return res.status(404).json({ message: "Action not found" });
    }

    // Record decision
    await recordDecision({
      recommendedFixSourceType: action.sourceType,
      recommendedFixSourceId: action.sourceId,
      action: "defer",
      deferReason: reason.trim(),
      actorUserId: (req as any)?.user?.id,
    });

    res.json(action);
  }
);

router.get(
  "/today-decisions",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (_req: Request, res: Response) => {
    const decisions = await getTodayDecisions();
    res.json(decisions);
  }
);

router.get(
  "/preferred-source-metrics",
  isAuthenticated,
  requireRole(["ops_admin", "super_admin"]),
  async (req: Request, res: Response) => {
    const sinceParam = req.query.since as string | undefined;
    const since = sinceParam
      ? new Date(sinceParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: last 7 days

    const metrics = await getPreferredSourceMetrics(since);
    res.json(metrics);
  }
);

router.post("/bot-ui-findings", async (req: Request, res: Response) => {
  if (!isMissionControlIngestAuthorized(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const payload = (req.body || {}) as Partial<InsertBotUiFinding>;
  if (!payload.botName || !payload.failureType || !payload.route) {
    return res.status(400).json({ message: "botName, failureType, and route are required" });
  }

  try {
    await recordBotUiFinding({
      botName: payload.botName,
      route: payload.route,
      actionAttempted: payload.actionAttempted,
      expectedOutcome: payload.expectedOutcome,
      actualOutcome: payload.actualOutcome,
      failureType: payload.failureType,
      severity: payload.severity ?? 1,
      screenshotUrl: payload.screenshotUrl,
    } as InsertBotUiFinding);

    res.status(201).json({ message: "Recorded" });
  } catch (err) {
    console.error("[MissionControl] Failed to record bot UI finding", err);
    res.status(500).json({ message: "Failed to record" });
  }
});

// Optional: allow secure ingestion of Scout interactions when bots attempt (guarded elsewhere)
router.post("/scout-interactions", async (req: Request, res: Response) => {
  if (!isMissionControlIngestAuthorized(req)) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    await recordScoutInteraction(req.body as any);
    res.status(201).json({ message: "Recorded" });
  } catch (err) {
    console.error("[MissionControl] Failed to ingest scout interaction", err);
    res.status(500).json({ message: "Failed to record" });
  }
});

export default router;
