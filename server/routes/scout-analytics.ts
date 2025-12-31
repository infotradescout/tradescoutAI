import { Router } from "express";
import { db } from "../db";
import { scoutOutcomeEvents, scoutUserConfidenceState } from "../../shared/schema";
import { eq, sql, and, gte, desc, count } from "drizzle-orm";

const router = Router();

/**
 * ADMIN-ONLY: Authority governance diagnostics.
 * Do not treat this as a feature—it's instrumentation to observe
 * where Scout is too soft, too strong, or correctly calibrated.
 */
router.get("/authority-diagnostics", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

    // Role-based access gate
    if (!req.user || (req.user.role !== "super_admin" && req.user.role !== "head_admin")) {
    return res.status(403).json({ message: "Admin access required" });
  }

  try {
    // 1. Overrides per scope (how often users defy each boundary)
    const overridesByScope = await db
      .select({
        scope: scoutOutcomeEvents.scope,
        count: sql<number>`count(*)`,
        recentTimestamp: sql<string>`max(${scoutOutcomeEvents.createdAt})`,
      })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "ignored_advice"))
      .groupBy(scoutOutcomeEvents.scope)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    // 2. Confidence state by scope (authority strength distribution)
    const confidenceDistribution = await db
      .select({
        scope: scoutUserConfidenceState.scope,
        baselineConfidence: scoutUserConfidenceState.baselineConfidence,
        currentConfidence: scoutUserConfidenceState.currentConfidence,
        lastUpdatedAt: scoutUserConfidenceState.lastUpdatedAt,
      })
      .from(scoutUserConfidenceState)
      .orderBy(desc(scoutUserConfidenceState.currentConfidence))
      .limit(100);

    // 3. Outcome sequences (what happened after overrides)
    // For each ignored_advice, check if there was a subsequent success/failure in same scope
    const recentOverrides = await db
      .select({
        id: scoutOutcomeEvents.id,
        scope: scoutOutcomeEvents.scope,
        createdAt: scoutOutcomeEvents.createdAt,
        value: scoutOutcomeEvents.value,
      })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "ignored_advice"))
      .orderBy(desc(scoutOutcomeEvents.createdAt))
      .limit(100);

    // For each override, find next outcome in same scope
    const outcomeSequences = await Promise.all(
      recentOverrides.map(async (override: { id: number; scope: string; createdAt: Date; value: any }) => {
        const subEvents = await db
          .select({
            action: scoutOutcomeEvents.action,
            createdAt: scoutOutcomeEvents.createdAt,
          })
          .from(scoutOutcomeEvents)
          .where(
            and(
              eq(scoutOutcomeEvents.scope, override.scope),
              gte(scoutOutcomeEvents.createdAt, override.createdAt)
            )
          )
          .orderBy(scoutOutcomeEvents.createdAt)
          .limit(2); // Skip self, get next

        const subsequent = subEvents[1]; // First is the override itself
        return {
          overrideId: override.id,
          scope: override.scope,
          overrideTime: override.createdAt,
          followedBy: subsequent
            ? {
                outcome: subsequent.action,
                when: subsequent.createdAt,
              }
            : null,
        };
      })
    );

    // 4. Summary stats
    const totalOverrides = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "ignored_advice"));

    const totalSuccesses = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "success_reported"));

    const totalFailures = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.action, "canceled"));

    res.json({
      summary: {
        totalOverrides: totalOverrides[0]?.count || 0,
        totalSuccesses: totalSuccesses[0]?.count || 0,
        totalFailures: totalFailures[0]?.count || 0,
        overrideRate:
          totalSuccesses[0]?.count || totalFailures[0]?.count
            ? (
                ((totalOverrides[0]?.count || 0) /
                  ((totalSuccesses[0]?.count || 0) +
                    (totalFailures[0]?.count || 0) +
                    (totalOverrides[0]?.count || 0))) *
                100
              ).toFixed(1) + "%"
            : "N/A",
      },
      overridesByScope,
      confidenceDistribution,
      outcomeSequences,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Authority diagnostics error:", error);
    res.status(500).json({ message: "Failed to generate diagnostics" });
  }
});

export default router;
