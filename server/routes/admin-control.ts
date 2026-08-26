import { Router } from "express";
import { db } from "../db";
import { scoutOutcomeEvents, scoutUserConfidenceState } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  getScoutControlState,
  updateScoutControlState,
} from "../services/scoutControlState";

const router = Router();

function isSuperAdmin(req: any): boolean {
  const rawRole = typeof req.user?.role === "string" ? req.user.role.trim().toLowerCase() : "";
  const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
  return req.isAuthenticated() && role === "super_admin";
}

function actorId(req: any): string {
  return String(req.user?.claims?.sub || req.user?.id || "").trim();
}

router.get("/state", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  return res.json(await getScoutControlState());
});

router.post("/authority-mode", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  const mode = req.body?.mode;
  if (!["normal", "conservative", "advisory"].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode" });
  }
  try {
    const state = await updateScoutControlState({ authorityMode: mode }, actorId(req));
    return res.json(state);
  } catch (error) {
    console.error("[ADMIN CONTROL] Authority mode write failed", error);
    return res.status(503).json({ message: "Scout control storage unavailable" });
  }
});

router.post("/confidence-dampener", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  const multiplier = req.body?.multiplier;
  if (typeof multiplier !== "number" || multiplier < 0 || multiplier > 2) {
    return res.status(400).json({ message: "Multiplier must be 0-2" });
  }
  try {
    const state = await updateScoutControlState(
      { confidenceDampener: multiplier },
      actorId(req)
    );
    return res.json(state);
  } catch (error) {
    console.error("[ADMIN CONTROL] Confidence dampener write failed", error);
    return res.status(503).json({ message: "Scout control storage unavailable" });
  }
});

router.post("/outcome-learning", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be boolean" });
  }
  try {
    const state = await updateScoutControlState(
      { outcomeLearningEnabled: enabled },
      actorId(req)
    );
    return res.json(state);
  } catch (error) {
    console.error("[ADMIN CONTROL] Outcome-learning write failed", error);
    return res.status(503).json({ message: "Scout control storage unavailable" });
  }
});

router.post("/reset-scope", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  const scope = req.body?.scope;
  if (!scope || typeof scope !== "string") {
    return res.status(400).json({ message: "scope required" });
  }
  try {
    await db.delete(scoutUserConfidenceState).where(eq(scoutUserConfidenceState.scope, scope));
    return res.json({ message: "Scope confidence reset", scope });
  } catch (error) {
    console.error("Scope reset error:", error);
    return res.status(500).json({ message: "Failed to reset scope" });
  }
});

router.get("/health", async (req, res) => {
  if (!isSuperAdmin(req)) return res.status(403).json({ message: "Super admin only" });
  try {
    const [totals] = await db
      .select({
        totalInterventions: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} in ('ignored_advice','followed_advice','completed_flow'))`,
        blockLikeInterventions: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} in ('ignored_advice','canceled','regret_reported','reported_spam','dispute','refund'))`,
        totalOutcomes: sql<number>`count(*)`,
        totalOverrides: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} = 'ignored_advice')`,
      })
      .from(scoutOutcomeEvents);
    const totalInterventions = Number(totals?.totalInterventions || 0);
    const totalOutcomes = Number(totals?.totalOutcomes || 0);
    const totalOverrides = Number(totals?.totalOverrides || 0);
    return res.json({
      blockRate: `${totalInterventions > 0 ? ((Number(totals?.blockLikeInterventions || 0) / totalInterventions) * 100).toFixed(1) : "0.0"}%`,
      overrideRate: `${totalOutcomes > 0 ? ((totalOverrides / totalOutcomes) * 100).toFixed(1) : "0.0"}%`,
      regretAfterOverride: null,
      regretAfterOverrideEvidenceAvailable: false,
      totalOutcomes,
      totalOverrides,
    });
  } catch (error) {
    console.error("Health metrics error:", error);
    return res.status(500).json({ message: "Failed to fetch health metrics" });
  }
});

export default router;
