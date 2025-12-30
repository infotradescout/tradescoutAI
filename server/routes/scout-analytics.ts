import { Router } from "express";
import { db } from "@db";
import { scoutOutcomeEvents, scoutUserConfidenceState } from "@db/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";

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

  // Admin-only gate
  const adminEmail = "traderscornerllc@gmail.com";
  if (req.user?.email !== adminEmail) {
    return res.status(403).json({ message: "Admin access required" });
  }

  try {
    // 1. Overrides per scope (how often users defy each boundary)
    const overridesByScope = await db
      .select({
        scope: scoutOutcomeEvents.scope,
        count: sql<number>`count(*)`,
        recentTimestamp: sql<string>`max(${scoutOutcomeEvents.timestamp})`,
      })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.outcomeType, "ignored_advice"))
      .groupBy(scoutOutcomeEvents.scope)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    // 2. Confidence state by scope (authority strength distribution)
    const confidenceDistribution = await db
      .select({
        scope: scoutUserConfidenceState.scope,
        successCount: scoutUserConfidenceState.successCount,
        failureCount: scoutUserConfidenceState.failureCount,
        confidence: scoutUserConfidenceState.confidence,
        lastUpdated: scoutUserConfidenceState.lastUpdated,
      })
      .from(scoutUserConfidenceState)
      .orderBy(desc(scoutUserConfidenceState.confidence))
      .limit(100);

    // 3. Outcome sequences (what happened after overrides)
    // For each ignored_advice, check if there was a subsequent success/failure in same scope
    const recentOverrides = await db
      .select({
        id: scoutOutcomeEvents.id,
        scope: scoutOutcomeEvents.scope,
        timestamp: scoutOutcomeEvents.timestamp,
        metadata: scoutOutcomeEvents.metadata,
      })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.outcomeType, "ignored_advice"))
      .orderBy(desc(scoutOutcomeEvents.timestamp))
      .limit(100);

    // For each override, find next outcome in same scope
    const outcomeSequences = await Promise.all(
      recentOverrides.map(async (override) => {
        const nextOutcome = await db
          .select({
            outcomeType: scoutOutcomeEvents.outcomeType,
            timestamp: scoutOutcomeEvents.timestamp,
          })
          .from(scoutOutcomeEvents)
          .where(
            and(
              eq(scoutOutcomeEvents.scope, override.scope),
              gte(scoutOutcomeEvents.timestamp, override.timestamp)
            )
          )
          .orderBy(scoutOutcomeEvents.timestamp)
          .limit(2); // Skip self, get next

        const subsequent = nextOutcome[1]; // First is the override itself
        return {
          overrideId: override.id,
          scope: override.scope,
          overrideTime: override.timestamp,
          followedBy: subsequent
            ? {
                outcome: subsequent.outcomeType,
                when: subsequent.timestamp,
              }
            : null,
        };
      })
    );

    // 4. Summary stats
    const totalOverrides = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.outcomeType, "ignored_advice"));

    const totalSuccesses = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.outcomeType, "success"));

    const totalFailures = await db
      .select({ count: sql<number>`count(*)` })
      .from(scoutOutcomeEvents)
      .where(eq(scoutOutcomeEvents.outcomeType, "failure"));

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
