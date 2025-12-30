import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { db } from "@db";
import { eq, sql, and, gte } from "drizzle-orm";
import { isAuthenticated, requireRole } from "../auth";

const router = Router();

// Helper to parse sessionStorage activity events (stored as JSON per session)
// In production, these would come from a proper analytics table
// For now, we aggregate from user activity logs or a dedicated events table
interface ActivityEvent {
  type: string;
  ts: string;
  meta?: Record<string, unknown>;
}

// Observation Mode Lock
router.get("/observation-lock", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    // Check if observation mode lock exists in settings
    const [setting] = await db
      .select()
      .from(db.schema.siteSettings)
      .where(eq(db.schema.siteSettings.key, "observation_mode_enabled"))
      .limit(1);

    res.json({
      enabled: setting?.value !== false, // Default to true (locked)
      lastChangedBy: setting?.meta?.lastChangedBy,
      lastChangedAt: setting?.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching observation lock:", error);
    res.status(500).json({ error: "Failed to fetch observation lock" });
  }
});

router.post("/observation-lock", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const userId = req.user?.id;

    // Upsert setting
    await db
      .insert(db.schema.siteSettings)
      .values({
        id: randomUUID(),
        category: "authority",
        key: "observation_mode_enabled",
        value: enabled,
        description: "Locks authority to action-gating only. No interpretive signals allowed.",
        isActive: true,
        meta: { lastChangedBy: req.user?.email },
      })
      .onConflictDoUpdate({
        target: db.schema.siteSettings.key,
        set: {
          value: enabled,
          updatedAt: new Date(),
          meta: { lastChangedBy: req.user?.email },
        },
      });

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating observation lock:", error);
    res.status(500).json({ error: "Failed to update observation lock" });
  }
});

// Decision Card Metrics
router.get("/decision-card-metrics", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    // In production, query from analytics events table
    // For now, return aggregated mock structure (replace with real query)
    
    // This would be: SELECT COUNT(*) FROM activity_events WHERE type = 'decision_card_shown'
    // GROUP BY meta->scoutAction, meta->choice, etc.
    
    const metrics = {
      totalShown: 0,
      guidanceDistribution: {
        COMPLY: 0,
        DEFER: 0,
        BLOCK: 0,
      },
      choiceSplit: {
        contact_now: 0,
        ask_scout: 0,
        proceed_anyway: 0,
        cancel: 0,
        understand_risk: 0,
      },
      trend: {
        shown_7d_change: 0,
        choice_7d_deltas: {
          contact_now: 0,
          ask_scout: 0,
          proceed_anyway: 0,
          cancel: 0,
          understand_risk: 0,
        },
      },
    };

    // TODO: Replace with actual analytics query when events table exists
    // Example query structure:
    // const shownEvents = await db.select().from(activityEvents)
    //   .where(eq(activityEvents.type, 'decision_card_shown'));
    // 
    // const choiceEvents = await db.select().from(activityEvents)
    //   .where(eq(activityEvents.type, 'decision_card_choice'));

    res.json(metrics);
  } catch (error) {
    console.error("Error fetching decision card metrics:", error);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

// Override Legitimacy Matrix
router.get("/override-legitimacy", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    // Query override events and calculate regret correlation
    // This is where authority is proven or disproven
    
    const legitimacy = [
      {
        scoutAction: "COMPLY" as const,
        overrides: 0, // Baseline - COMPLY shouldn't have overrides
        regretAfterOverride: 0,
        interpretation: "baseline",
      },
      {
        scoutAction: "DEFER" as const,
        overrides: 0,
        regretAfterOverride: 0,
        interpretation: "calibration - insufficient data",
      },
      {
        scoutAction: "BLOCK" as const,
        overrides: 0,
        regretAfterOverride: 0,
        interpretation: "legitimacy - insufficient data",
      },
    ];

    // TODO: Replace with actual query
    // SELECT scoutAction, COUNT(*) as overrides
    // FROM activity_events
    // WHERE type = 'decision_card_override'
    // GROUP BY meta->>'scoutAction'
    //
    // Then correlate with regret signals (negative outcomes after override)

    res.json(legitimacy);
  } catch (error) {
    console.error("Error fetching override legitimacy:", error);
    res.status(500).json({ error: "Failed to fetch legitimacy matrix" });
  }
});

// Cancel Signals
router.get("/cancel-signals", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    // Cancel ≠ failure. Cancel = decision clarity.
    
    const cancelSignals = {
      cancelRate: 0,
      byGuidance: {
        COMPLY: 0,
        DEFER: 0,
        BLOCK: 0,
      },
    };

    // TODO: Replace with actual query
    // SELECT 
    //   COUNT(CASE WHEN choice = 'cancel' THEN 1 END) / COUNT(*) as cancelRate,
    //   scoutAction,
    //   COUNT(CASE WHEN choice = 'cancel' THEN 1 END) / COUNT(*) as guidanceRate
    // FROM activity_events
    // WHERE type = 'decision_card_choice'
    // GROUP BY meta->>'scoutAction'

    res.json(cancelSignals);
  } catch (error) {
    console.error("Error fetching cancel signals:", error);
    res.status(500).json({ error: "Failed to fetch cancel signals" });
  }
});

// Unlock Ledger
router.get("/unlock-ledger", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    // Query unlock conditions from settings
    const conditions = await db
      .select()
      .from(db.schema.siteSettings)
      .where(eq(db.schema.siteSettings.category, "authority_unlock"));

    const ledger = [
      {
        phase: "Phase 2B: Authority Labels",
        status: "LOCKED" as const,
        condition: conditions.find((c) => c.key === "phase_2b_unlock")?.value || 
          "Unlock only after override → regret pattern stabilizes (≥100 overrides, regret rate >60%)",
      },
      {
        phase: "Phase 2C: Outcome Weighting",
        status: "LOCKED" as const,
        condition: conditions.find((c) => c.key === "phase_2c_unlock")?.value || 
          "Unlock only after labels prove predictive (AUC >0.75 for 30 days)",
      },
    ];

    res.json(ledger);
  } catch (error) {
    console.error("Error fetching unlock ledger:", error);
    res.status(500).json({ error: "Failed to fetch unlock ledger" });
  }
});

router.post("/unlock-condition", isAuthenticated, requireRole(['head_admin', 'ops_admin']), async (req: Request, res: Response) => {
  try {
    const { phase, condition } = req.body;
    
    // Map phase to setting key
    const keyMap: Record<string, string> = {
      "Phase 2B: Authority Labels": "phase_2b_unlock",
      "Phase 2C: Outcome Weighting": "phase_2c_unlock",
    };

    const key = keyMap[phase];
    if (!key) {
      return res.status(400).json({ error: "Invalid phase" });
    }

    await db
      .insert(db.schema.siteSettings)
      .values({
        id: randomUUID(),
        category: "authority_unlock",
        key,
        value: condition,
        description: `Unlock condition for ${phase}`,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: db.schema.siteSettings.key,
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
});

export function registerAuthorityOperationsRoutes(app: any) {
  app.use("/api/admin/authority", router);
}
