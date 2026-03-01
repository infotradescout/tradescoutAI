import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import { objectives, objectiveEvents, workRequests } from "@shared/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Objective as ObjectiveDto } from "@shared/types/objective";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
};

type ObjectiveRow = typeof objectives.$inferSelect;

function serializeObjective(row: ObjectiveRow): ObjectiveDto {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date(0).toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date(0).toISOString(),
    status: (row.status ?? "active") as ObjectiveDto["status"],
    intentClass: (row.intentClass ?? "unknown") as ObjectiveDto["intentClass"],
    title: row.title,
    summary: row.summary ?? null,
    confidence: Number(row.confidence ?? 0),
    context: (row.contextJson as Record<string, unknown> | null) ?? null,
    linkedObjectType: row.linkedObjectType ?? null,
    linkedObjectId: row.linkedObjectId ?? null,
  };
}

// ============================================================================
// SCHEMAS & TYPES
// ============================================================================

const createObjectiveSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(0).max(1000),
  intentClass: z.enum([
    "unknown",
    "knowledge",
    "local_advice",
    "work_request",
    "marketplace_buy",
    "marketplace_sell",
    "community_post",
    "event",
    "safety_report",
    "account",
    "admin",
    "other",
  ]),
  confidence: z.number().min(0).max(1).default(0.5),
  contextJson: z.record(z.any()).optional(),
});

const updateObjectiveSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(0).max(1000).optional(),
  intentClass: z
    .enum([
      "unknown",
      "knowledge",
      "local_advice",
      "work_request",
      "marketplace_buy",
      "marketplace_sell",
      "community_post",
      "event",
      "safety_report",
      "account",
      "admin",
      "other",
    ])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  contextJson: z.record(z.any()).optional(),
  status: z.enum(["active", "paused", "completed", "abandoned"]).optional(),
});

const promoteObjectiveSchema = z.object({
  targetObjectType: z.enum(["workRequest", "none"]).default("none"),
  // Additional fields for work request promotion
  countyFips: z.string().length(5).optional(),
  stateCode: z.string().length(2).optional(),
  tradeId: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get user's active objective (most recent with status='active')
 */
async function getUserActiveObjective(userId: string) {
  const result = await db
    .select()
    .from(objectives)
    .where(and(eq(objectives.userId, userId), eq(objectives.status, "active")))
    .orderBy(desc(objectives.createdAt))
    .limit(1);
  return result[0] || null;
}

/**
 * Auto-pause previous active objective when creating a new one or switching topics
 */
async function autoPausePreviousObjective(userId: string) {
  const previousActive = await getUserActiveObjective(userId);
  if (previousActive) {
    await db
      .update(objectives)
      .set({ status: "paused" })
      .where(eq(objectives.id, previousActive.id));

    // Log the topic shift event
    await db.insert(objectiveEvents).values({
      objectiveId: previousActive.id,
      eventType: "topic_shift",
      actorType: "system",
      metadata: { reason: "new_objective_created" },
    });
  }
}

/**
 * Create a work request from an objective (Phase 1 promotion)
 */
async function promoteToWorkRequest(
  objective: ObjectiveRow,
  params: z.infer<typeof promoteObjectiveSchema>
) {
  // Extract minimum required fields from objective
  const countyFips = params.countyFips || objective.contextJson?.countyFips || null;
  const stateCode = params.stateCode || objective.contextJson?.stateCode || null;

  if (!countyFips || !stateCode) {
    throw new Error("countyFips and stateCode are required to promote to work request");
  }

  // Create draft work request
  const insertedWorkRequest = await db
    .insert(workRequests)
    .values({
      createdByUserId: objective.userId,
      title: objective.title,
      description: objective.summary || objective.title,
      category: objective.contextJson?.category,
      tradeId: params.tradeId,
      countyFips,
      stateCode,
      addressId: objective.contextJson?.addressId,
      scope: objective.contextJson?.scope || "personal",
      source: "scout",
      sourceRefId: objective.id, // Link back to objective
      status: "draft",
      visibility: objective.contextJson?.visibility || "private",
      exposureMode: objective.contextJson?.exposureMode || "guided",
      competitionMode: objective.contextJson?.competitionMode || "none",
      budgetMin: params.budgetMin ? String(params.budgetMin) : undefined,
      budgetMax: params.budgetMax ? String(params.budgetMax) : undefined,
    })
    .returning({ id: workRequests.id });
  const workRequestId = insertedWorkRequest[0]?.id;
  if (!workRequestId) {
    throw new Error("Failed to create work request");
  }

  // Link objective to work request
  await db
    .update(objectives)
    .set({
      linkedObjectType: "workRequest",
      linkedObjectId: workRequestId,
    })
    .where(eq(objectives.id, objective.id));

  // Log the promotion event
  await db.insert(objectiveEvents).values({
    objectiveId: objective.id,
    eventType: "promoted",
    actorType: "system",
    metadata: {
      targetObjectType: "workRequest",
      targetObjectId: workRequestId,
    },
  });

  return { success: true, workRequestId };
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export function registerObjectivesRoutes(app: Express) {
  /**
   * GET /api/objectives/active
   * Get user's currently active objective
   */
  app.get("/api/objectives/active", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      // Feature flag kill-switch
      if (process.env.OBJECTIVES_ENABLED !== "true") {
        return res.json({ objective: null });
      }

      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const objective = await getUserActiveObjective(userId);
      res.json({ objective: objective ? serializeObjective(objective) : null });
    } catch (error) {
      console.error("Error fetching active objective:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/objectives
   * Create a new objective
   * - Auto-pauses previous active objective if one exists
   * - If intent_class is unknown, can optionally auto-classify
   */
  app.post("/api/objectives", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      // Feature flag kill-switch (Guardrail A)
      if (process.env.OBJECTIVES_ENABLED !== "true") {
        return res.status(503).json({ error: "Objectives feature is currently disabled" });
      }

      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const parsed = createObjectiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      }

      // Rate limit: max 3 new objectives per user per hour (Guardrail B)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCreations = await db
        .select({ count: count() })
        .from(objectiveEvents)
        .innerJoin(objectives, eq(objectiveEvents.objectiveId, objectives.id))
        .where(
          and(
            eq(objectives.userId, userId),
            eq(objectiveEvents.eventType, "created"),
            sql`${objectiveEvents.createdAt} > ${oneHourAgo}`
          )
        );
      const recentCreateCount = Number(recentCreations[0]?.count ?? 0);

      if (recentCreateCount >= 3) {
        return res.status(429).json({
          error: "Too many objectives created recently. Max 3 per hour.",
          retryAfter: 3600,
        });
      }

      // Auto-pause previous objective
      await autoPausePreviousObjective(userId);

      // Create new objective
      const insertedObjective = await db
        .insert(objectives)
        .values({
          userId,
          title: parsed.data.title,
          summary: parsed.data.summary,
          intentClass: parsed.data.intentClass,
          confidence: String(parsed.data.confidence),
          contextJson: parsed.data.contextJson || {},
          status: "active",
        })
        .returning({ id: objectives.id });
      const objectiveId = insertedObjective[0]?.id;
      if (!objectiveId) {
        throw new Error("Failed to create objective");
      }

      // Log creation event
      await db.insert(objectiveEvents).values({
        objectiveId: objectiveId,
        eventType: "created",
        actorType: "system",
        metadata: { intentClass: parsed.data.intentClass },
      });

      const newObjective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, objectiveId))
        .then((r) => r[0]);

      res.json({
        success: true,
        objective: newObjective ? serializeObjective(newObjective) : null,
      });
    } catch (error) {
      console.error("Error creating objective:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PATCH /api/objectives/:id
   * Update an objective (title, summary, status, etc.)
   */
  app.patch("/api/objectives/:id", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;
      const parsed = updateObjectiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
      }

      // Verify ownership
      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, id))
        .then((r) => r[0]);

      if (!objective || objective.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Determine which event type to log
      let eventType: "title_updated" | "summary_updated" | "status_changed" | null = null;
      if (parsed.data.title && parsed.data.title !== objective.title) {
        eventType = "title_updated";
      } else if (parsed.data.summary && parsed.data.summary !== objective.summary) {
        eventType = "summary_updated";
      } else if (parsed.data.status && parsed.data.status !== objective.status) {
        eventType = "status_changed";
      }

      // Update objective
      await db
        .update(objectives)
        .set({
          title: parsed.data.title,
          summary: parsed.data.summary,
          intentClass: parsed.data.intentClass,
          confidence: parsed.data.confidence ? String(parsed.data.confidence) : undefined,
          contextJson: parsed.data.contextJson,
          status: parsed.data.status,
          updatedAt: new Date(),
        })
        .where(eq(objectives.id, id));

      // Log event
      if (eventType) {
        await db.insert(objectiveEvents).values({
          objectiveId: id,
          eventType,
          actorUserId: userId,
          actorType: "user",
          metadata: {
            previousStatus: objective.status,
            newStatus: parsed.data.status,
          },
        });
      }

      const updated = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, id))
        .then((r) => r[0]);

      res.json({ success: true, objective: updated ? serializeObjective(updated) : null });
    } catch (error) {
      console.error("Error updating objective:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * POST /api/objectives/:id/promote
   * Promote an objective to a concrete object (workRequest, listing, post, etc.)
   * Phase 1 supports: workRequest
   * Phase 2+ will support: marketplaceListing, communityPost, event
   */
  app.post(
    "/api/objectives/:id/promote",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.params;
        const parsed = promoteObjectiveSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
        }

        // Verify ownership
        const objective = await db
          .select()
          .from(objectives)
          .where(eq(objectives.id, id))
          .then((r) => r[0]);

        if (!objective || objective.userId !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        // Prevent re-promotion if already linked
        if (objective.linkedObjectType !== "none" && objective.linkedObjectId) {
          return res.status(400).json({ error: "Objective already promoted" });
        }

        let result: any;

        // Phase 1: only workRequest promotion
        if (parsed.data.targetObjectType === "workRequest") {
          result = await promoteToWorkRequest(objective, parsed.data);
        } else {
          return res.status(400).json({ error: "Unsupported promotion type" });
        }

        res.json(result);
      } catch (error) {
        console.error("Error promoting objective:", error);
        res.status(500).json({ error: (error as Error).message || "Internal server error" });
      }
    }
  );

  /**
   * GET /api/objectives/:id/history
   * Fetch event history for an objective
   */
  app.get(
    "/api/objectives/:id/history",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { id } = req.params;

        // Verify ownership
        const objective = await db
          .select()
          .from(objectives)
          .where(eq(objectives.id, id))
          .then((r) => r[0]);

        if (!objective || objective.userId !== userId) {
          return res.status(403).json({ error: "Forbidden" });
        }

        const history = await db
          .select()
          .from(objectiveEvents)
          .where(eq(objectiveEvents.objectiveId, id))
          .orderBy(desc(objectiveEvents.createdAt));

        res.json({ history });
      } catch (error) {
        console.error("Error fetching objective history:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  );

  /**
   * DELETE /api/objectives/:id
   * Abandon/delete an objective
   */
  app.delete("/api/objectives/:id", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { id } = req.params;

      // Verify ownership
      const objective = await db
        .select()
        .from(objectives)
        .where(eq(objectives.id, id))
        .then((r) => r[0]);

      if (!objective || objective.userId !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Soft delete: mark as abandoned
      await db.update(objectives).set({ status: "abandoned" }).where(eq(objectives.id, id));

      // Log deletion event
      await db.insert(objectiveEvents).values({
        objectiveId: id,
        eventType: "deleted",
        actorUserId: userId,
        actorType: "user",
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting objective:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
