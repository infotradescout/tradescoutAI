import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../db";
import { and, eq, gte, sql } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../auth";
import { scoutOutcomeEvents, siteSettings } from "../../shared/schema";
import { getAuthorityConfigAuditSnapshot, reloadAuthorityConfig } from "../utils/authorityConfig";
import { logAdminAction } from "../services/adminAuditLogService";

const router = Router();

function getActorUserId(req: Request): string | null {
  const user = (req as any)?.user || {};
  const id = user?.id || user?.claims?.sub;
  return typeof id === "string" && id.trim().length > 0 ? id : null;
}

router.get(
  "/observation-lock",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (_req: Request, res: Response) => {
    try {
      const [setting] = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.key, "observation_mode_enabled"))
        .limit(1);

      res.json({
        enabled: setting?.value !== false,
        lastChangedAt: setting?.updatedAt,
      });
    } catch (error) {
      console.error("Error fetching observation lock:", error);
      res.status(500).json({ error: "Failed to fetch observation lock" });
    }
  }
);

router.post(
  "/observation-lock",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      await db
        .insert(siteSettings)
        .values({
          category: "authority",
          key: "observation_mode_enabled",
          value: enabled,
          description: "Locks authority to action-gating only. No interpretive signals allowed.",
          isActive: true,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: enabled,
            updatedAt: new Date(),
          },
        });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating observation lock:", error);
      res.status(500).json({ error: "Failed to update observation lock" });
    }
  }
);

router.get(
  "/decision-card-metrics",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (_req: Request, res: Response) => {
    try {
      return res.status(503).json({ error: "Decision card analytics are not yet available" });
    } catch (error) {
      console.error("Error fetching decision card metrics:", error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  }
);

router.get(
  "/override-legitimacy",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (_req: Request, res: Response) => {
    try {
      const overrides = await db
        .select({
          scope: scoutOutcomeEvents.scope,
          createdAt: scoutOutcomeEvents.createdAt,
        })
        .from(scoutOutcomeEvents)
        .where(eq(scoutOutcomeEvents.action, "ignored_advice"))
        .orderBy(scoutOutcomeEvents.createdAt)
        .limit(500);

      let regretsAfterOverride = 0;
      for (const override of overrides) {
        const nextEvents = await db
          .select({ action: scoutOutcomeEvents.action })
          .from(scoutOutcomeEvents)
          .where(
            and(
              eq(scoutOutcomeEvents.scope, override.scope),
              gte(scoutOutcomeEvents.createdAt, override.createdAt)
            )
          )
          .orderBy(scoutOutcomeEvents.createdAt)
          .limit(3);
        if (nextEvents.some((e) => e.action === "regret_reported" || e.action === "canceled")) {
          regretsAfterOverride += 1;
        }
      }

      const interpretation =
        overrides.length === 0
          ? "insufficient data"
          : regretsAfterOverride / overrides.length >= 0.6
            ? "authority justified"
            : "authority too strict";

      res.json([
        {
          scoutAction: "COMPLY",
          overrides: 0,
          regretAfterOverride: 0,
          interpretation: "baseline",
        },
        {
          scoutAction: "DEFER",
          overrides: overrides.length,
          regretAfterOverride: regretsAfterOverride,
          interpretation,
        },
        {
          scoutAction: "BLOCK",
          overrides: overrides.length,
          regretAfterOverride: regretsAfterOverride,
          interpretation,
        },
      ]);
    } catch (error) {
      console.error("Error fetching override legitimacy:", error);
      res.status(500).json({ error: "Failed to fetch legitimacy matrix" });
    }
  }
);

router.get(
  "/cancel-signals",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (_req: Request, res: Response) => {
    try {
      const [totals] = await db
        .select({
          total: sql<number>`count(*)`,
          canceled: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} = 'canceled')`,
          followed: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} = 'followed_advice')`,
          ignored: sql<number>`count(*) filter (where ${scoutOutcomeEvents.action} = 'ignored_advice')`,
        })
        .from(scoutOutcomeEvents)
        .where(
          sql`${scoutOutcomeEvents.action} in ('followed_advice','ignored_advice','completed_flow','canceled')`
        );

      const total = Number(totals?.total || 0);
      const canceled = Number(totals?.canceled || 0);
      const followed = Number(totals?.followed || 0);
      const ignored = Number(totals?.ignored || 0);
      const cancelRate = total > 0 ? canceled / total : 0;

      res.json({
        cancelRate,
        byGuidance: {
          COMPLY: followed > 0 ? canceled / followed : 0,
          DEFER: ignored > 0 ? canceled / ignored : 0,
          BLOCK: ignored > 0 ? canceled / ignored : 0,
        },
      });
    } catch (error) {
      console.error("Error fetching cancel signals:", error);
      res.status(500).json({ error: "Failed to fetch cancel signals" });
    }
  }
);

router.get(
  "/unlock-ledger",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (_req: Request, res: Response) => {
    try {
      const conditions = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.category, "authority_unlock"));

      res.json([
        {
          phase: "Phase 2B: Authority Labels",
          status: "LOCKED" as const,
          condition:
            (conditions.find((c: any) => c.key === "phase_2b_unlock")?.value as string) ||
            "Unlock only after override to regret pattern stabilizes (>=100 overrides, regret rate >60%)",
        },
        {
          phase: "Phase 2C: Outcome Weighting",
          status: "LOCKED" as const,
          condition:
            (conditions.find((c: any) => c.key === "phase_2c_unlock")?.value as string) ||
            "Unlock only after labels prove predictive (AUC >0.75 for 30 days)",
        },
      ]);
    } catch (error) {
      console.error("Error fetching unlock ledger:", error);
      res.status(500).json({ error: "Failed to fetch unlock ledger" });
    }
  }
);

router.post(
  "/unlock-condition",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (req: Request, res: Response) => {
    try {
      const { phase, condition } = req.body;
      const keyMap: Record<string, string> = {
        "Phase 2B: Authority Labels": "phase_2b_unlock",
        "Phase 2C: Outcome Weighting": "phase_2c_unlock",
      };

      const key = keyMap[phase];
      if (!key) {
        return res.status(400).json({ error: "Invalid phase" });
      }

      await db
        .insert(siteSettings)
        .values({
          id: randomUUID(),
          category: "authority_unlock",
          key,
          value: condition,
          description: `Unlock condition for ${phase}`,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: siteSettings.key,
          set: {
            value: condition,
            updatedAt: new Date(),
          },
        });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating unlock condition:", error);
      res.status(500).json({ error: "Failed to update unlock condition" });
    }
  }
);

router.get(
  "/config",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (req: Request, res: Response) => {
    try {
      const actorUserId = getActorUserId(req);
      await logAdminAction({
        action: "authority_config_viewed",
        actorUserId,
        metadata: {
          route: "/api/admin/authority/config",
          method: "GET",
        },
      });

      res.json(getAuthorityConfigAuditSnapshot());
    } catch (error) {
      console.error("Error fetching authority config:", error);
      res.status(500).json({ error: "Failed to fetch authority config" });
    }
  }
);

router.post(
  "/config/reload",
  isAuthenticated,
  requireRole(["super_admin", "ops_admin"]),
  async (req: Request, res: Response) => {
    try {
      const actorUserId = getActorUserId(req);
      const config = reloadAuthorityConfig();
      await logAdminAction({
        action: "authority_config_reloaded",
        actorUserId,
        metadata: {
          route: "/api/admin/authority/config/reload",
          method: "POST",
          fingerprint: config.fingerprint,
        },
      });

      res.json({
        success: true,
        config: getAuthorityConfigAuditSnapshot(),
      });
    } catch (error) {
      console.error("Error reloading authority config:", error);
      res.status(500).json({ error: "Failed to reload authority config" });
    }
  }
);

export function registerAuthorityOperationsRoutes(app: any) {
  app.use("/api/admin/authority", router);
}
