import { Router } from "express";
import { db } from "../db";
import { scoutOutcomeEvents, scoutUserConfidenceState } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";
import { resolveRequestEffectiveUser } from "../utils/requestEffectiveUser";

const router = Router();

/**
 * SUPER ADMIN ONLY: System control levers.
 * These are not features—they are emergency brakes and governors.
 */

// In-memory state for global overrides (persisted to DB later if needed)
let globalAuthorityMode: "normal" | "conservative" | "advisory" = "normal";
let confidenceDampener: number = 1.0; // multiplier
let outcomeLearningEnabled: boolean = true;

function isSuperAdmin(req: any): boolean {
  const identityContext = resolveRequestEffectiveUser(req);
  if (!identityContext.ok || identityContext.isImpersonating) return false;
  const rawRole = typeof req.user?.role === "string" ? req.user.role.trim().toLowerCase() : "";
  const role = rawRole === "owner" || rawRole === "head_admin" ? "super_admin" : rawRole;
  return req.isAuthenticated() && role === "super_admin";
}

// Get current control state
router.get("/state", (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  res.json({
    authorityMode: globalAuthorityMode,
    confidenceDampener,
    outcomeLearningEnabled,
  });
});

// Set authority mode
router.post("/authority-mode", (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  const { mode } = req.body;
  if (!["normal", "conservative", "advisory"].includes(mode)) {
    return res.status(400).json({ message: "Invalid mode" });
  }

  globalAuthorityMode = mode;
  console.log(`[ADMIN CONTROL] Authority mode set to: ${mode}`);

  res.json({ authorityMode: globalAuthorityMode });
});

// Set confidence dampener
router.post("/confidence-dampener", (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  const { multiplier } = req.body;
  if (typeof multiplier !== "number" || multiplier < 0 || multiplier > 2) {
    return res.status(400).json({ message: "Multiplier must be 0-2" });
  }

  confidenceDampener = multiplier;
  console.log(`[ADMIN CONTROL] Confidence dampener set to: ${multiplier}`);

  res.json({ confidenceDampener });
});

// Toggle outcome learning
router.post("/outcome-learning", (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  const { enabled } = req.body;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be boolean" });
  }

  outcomeLearningEnabled = enabled;
  console.log(`[ADMIN CONTROL] Outcome learning: ${enabled ? "ON" : "OFF"}`);

  res.json({ outcomeLearningEnabled });
});

// Reset confidence for a scope
router.post("/reset-scope", async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  const { scope } = req.body;
  if (!scope || typeof scope !== "string") {
    return res.status(400).json({ message: "scope required" });
  }

  try {
    await db.delete(scoutUserConfidenceState).where(eq(scoutUserConfidenceState.scope, scope));

    console.log(`[ADMIN CONTROL] Reset confidence for scope: ${scope}`);

    res.json({ message: "Scope confidence reset", scope });
  } catch (error) {
    console.error("Scope reset error:", error);
    res.status(500).json({ message: "Failed to reset scope" });
  }
});

// Get system health metrics
router.get("/health", async (req, res) => {
  if (!isSuperAdmin(req)) {
    return res.status(403).json({ message: "Super admin only" });
  }

  try {
    const [interventionTotals] = await db
      .select({
        totalInterventions: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} in ('ignored_advice','followed_advice','completed_flow'))`,
        blockLikeInterventions: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} in ('ignored_advice','canceled','regret_reported','reported_spam','dispute','refund'))`,
      })
      .from(scoutOutcomeEvents);

    const totalInterventions = Number(interventionTotals?.totalInterventions || 0);
    const blockCount = Number(interventionTotals?.blockLikeInterventions || 0);
    const blockRate =
      totalInterventions > 0 ? ((blockCount / totalInterventions) * 100).toFixed(1) : "0.0";

    // Override rate
    const totalOutcomes = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents);

    const overrides = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "ignored_advice"));

    const overrideRate =
      totalOutcomes[0]?.count > 0
        ? ((overrides[0]?.count / totalOutcomes[0]?.count) * 100).toFixed(1)
        : "0.0";

    // Regret after override (check for failure following ignored_advice)
    const recentOverrides = await db
      .select({
        scope: scoutOutcomeEvents.scope,
        createdAt: scoutOutcomeEvents.createdAt,
      })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "ignored_advice"))
      .orderBy(scoutOutcomeEvents.createdAt)
      .limit(50);

    let regretCount = 0;
    for (const override of recentOverrides) {
      const nextEvents = await db
        .select({ action: scoutOutcomeEvents.action })
        .from(scoutOutcomeEvents)
        .where(
          sql`${scoutOutcomeEvents.scope} = ${override.scope} AND ${scoutOutcomeEvents.createdAt} > ${override.createdAt}`
        )
        .limit(1);

      if (nextEvents[0]?.action === "canceled") {
        regretCount++;
      }
    }

    const regretRate =
      recentOverrides.length > 0
        ? ((regretCount / recentOverrides.length) * 100).toFixed(1)
        : "0.0";

    res.json({
      blockRate: `${blockRate}%`,
      overrideRate: `${overrideRate}%`,
      regretAfterOverride: `${regretRate}%`,
      totalOutcomes: totalOutcomes[0]?.count || 0,
      totalOverrides: overrides[0]?.count || 0,
    });
  } catch (error) {
    console.error("Health metrics error:", error);
    res.status(500).json({ message: "Failed to fetch health metrics" });
  }
});

// Export control state getters for use in governor
export function getAuthorityMode(): string {
  return globalAuthorityMode;
}

export function getConfidenceDampener(): number {
  return confidenceDampener;
}

export function isOutcomeLearningEnabled(): boolean {
  return outcomeLearningEnabled;
}

export default router;
