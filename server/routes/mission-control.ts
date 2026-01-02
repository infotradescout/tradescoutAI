import { Router, type Request, type Response } from "express";
import { isAuthenticated, isSuperAdmin } from "../auth";
import {
  getMissionControlCompromises,
  getMissionControlFailures,
  getMissionControlSummary,
  getOrCreateOneFix,
  getScoutHealthSummary,
  recordBotUiFinding,
  updateOneFixStatus,
} from "../services/missionControl";
import { recordScoutInteraction } from "../services/missionControl";
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

  const role = (req as any)?.user?.role || (req as any)?.user?.claims?.role;
  return role === "super_admin" || role === "head_admin";
}

router.get("/summary", isAuthenticated, isSuperAdmin, async (_req: Request, res: Response) => {
  const summary = await getMissionControlSummary();
  res.json(summary);
});

router.get("/failures", isAuthenticated, isSuperAdmin, async (_req: Request, res: Response) => {
  const failures = await getMissionControlFailures();
  res.json(failures);
});

router.get("/compromises", isAuthenticated, isSuperAdmin, async (_req: Request, res: Response) => {
  const compromises = await getMissionControlCompromises();
  res.json(compromises);
});

router.get("/scout-health", isAuthenticated, isSuperAdmin, async (_req: Request, res: Response) => {
  const summary = await getScoutHealthSummary();
  res.json({ summary });
});

router.get("/one-fix", isAuthenticated, isSuperAdmin, async (_req: Request, res: Response) => {
  const result = await getOrCreateOneFix();
  if (!result) {
    return res.status(204).end();
  }
  res.json(result);
});

router.post("/one-fix/:id/done", isAuthenticated, isSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const updated = await updateOneFixStatus(id, "done", undefined, (req as any)?.user?.id);
  if (!updated) {
    return res.status(404).json({ message: "Action not found" });
  }
  res.json(updated);
});

router.post("/one-fix/:id/defer", isAuthenticated, isSuperAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = (req.body || {}) as { reason?: string };
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ message: "Defer reason is required" });
  }
  const updated = await updateOneFixStatus(id, "deferred", reason.trim(), (req as any)?.user?.id);
  if (!updated) {
    return res.status(404).json({ message: "Action not found" });
  }
  res.json(updated);
});

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
