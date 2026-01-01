import type { Express, Request, Response } from "express";
import { isAuthenticated } from "../auth";
import { db } from "../db";
import {
  type WorkRequest,
  workRequests,
  workRequestEvents,
  workRequestAssignments,
  contractors,
  conversations,
} from "@shared/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { notificationService } from "../notification-service";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";

type AuthedRequest = Request & { user?: { id?: string; claims?: { sub?: string }; role?: string; [key: string]: any } };

const directConnectRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1).optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  tradeId: z.string().min(1).optional(),
  targetContractorIds: z.array(z.string().min(1)).optional(),
});

const assignmentResponseSchema = z.object({
  decision: z.enum(["accept", "decline"]),
  // Optional, private decline reason for analytics and routing quality.
  // Never exposed to requesters.
  reason: z.string().min(1).max(200).optional(),
});

export function registerDirectConnectRoutes(app: Express) {
  // Requester-facing: route an open Direct Connect request to top contractors
  app.post("/api/direct-connect/requests/:id/route", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const requestId = String(req.params.id);
      const expandReach = String(req.query?.expand ?? "").toLowerCase() === "true";

      const [requestRow] = await db
        .select()
        .from(workRequests)
        .where(eq(workRequests.id, requestId));

      if (!requestRow) {
        return res.status(404).json({ message: "Work request not found" });
      }

      // Only allow routing for Direct Connect-originated, open requests created by this user
      if ((requestRow.source as string | null) !== "direct_connect") {
        return res.status(400).json({ message: "Only Direct Connect requests can be routed here" });
      }

      // Idempotency guard: if this request has already been routed and the caller
      // is not explicitly expanding reach, return a benign 200 without creating
      // duplicate events or notifications.
      if (requestRow.status === "routed" && !expandReach) {
        const existingAssignments = await db
          .select()
          .from(workRequestAssignments)
          .where(eq(workRequestAssignments.workRequestId, requestId));

        return res.status(200).json({ assignments: existingAssignments, routed: false });
      }

      // For all other non-open states (e.g., in_progress, closed), treat routing
      // as a hard error unless the caller is explicitly expanding reach from an
      // already-routed state.
      if (requestRow.status !== "open" && !(requestRow.status === "routed" && expandReach)) {
        return res.status(400).json({ message: "Only open requests can be routed" });
      }

      if (String(requestRow.createdByUserId) !== String(userId)) {
        return res.status(403).json({ message: "You can only route your own requests" });
      }

      const countyFips = requestRow.countyFips;
      const tradeSlug = requestRow.tradeId;

      if (!countyFips || !tradeSlug) {
        return res.status(400).json({ message: "Request must have a trade and county set before routing" });
      }

      // Mirror the contractor ranking logic from /api/contractors/top
      const countyRecord = await storage.getCountyByFips(countyFips as string);
      const tradeRecord = await storage.getTradeBySlug(tradeSlug as string);

      if (!countyRecord || !tradeRecord) {
        return res.status(400).json({ message: "Unable to resolve routing geography or trade" });
      }

      const filters: any = {
        limit: expandReach ? 15 : 5,
        countyId: countyRecord.id,
        tradeIds: [tradeRecord.id],
      };

      const baseContractors = await storage.getContractors(filters);

      if (!baseContractors.length) {
        return res.status(200).json({ assignments: [], routed: false });
      }

      const contractorIds = baseContractors.map((c: any) => c.id);
      const userIds = baseContractors
        .map((c: any) => c.userId as string | undefined)
        .filter((id): id is string => Boolean(id));

      // Compliance gate: only apply if this trade has explicit requirements
      let gatedContractors = baseContractors;
      const requirements = await storage.getTradeRequirementsByTradeId(tradeRecord.id);
      if (!expandReach && requirements && userIds.length > 0) {
        const compliance = await storage.getUserVerificationSummary(userIds);

        const requiresLicense = requirements.requiresLicense ?? false;
        const requiresInsurance = requirements.requiresInsurance ?? false;
        const requiresEin = requirements.requiresEin ?? false;

        const compliantIds = baseContractors
          .filter((c: any) => {
            if (!c.userId) return false;
            const summary = compliance[c.userId];
            if (!summary) return false;
            if (requiresLicense && !summary.hasLicense) return false;
            if (requiresInsurance && !summary.hasInsurance) return false;
            if (requiresEin && !summary.hasEin) return false;
            return true;
          })
          .map((c: any) => c.id as string);

        if (compliantIds.length > 0) {
          gatedContractors = baseContractors.filter((c: any) => compliantIds.includes(c.id));
        }
      }

      if (!gatedContractors.length) {
        return res.status(200).json({ assignments: [], routed: false });
      }

      // Reach tier classification based on service area size
      const serviceAreaCounts = await storage.getContractorServiceAreaCounts(
        gatedContractors.map((c: any) => c.id),
      );

      const tierForCount = (count: number | undefined): "local" | "regional" | "wide" => {
        const n = count ?? 0;
        if (n <= 1) return "local";
        if (n <= 5) return "regional";
        return "wide";
      };

      type RankedContractor = {
        id: string;
        userId?: string | null;
        companyName?: string | null;
        positiveRecommendations?: number | null;
        totalRecommendations?: number | null;
        reachTier: "local" | "regional" | "wide";
        localCredibilityScore: number;
      };

      const ranked: RankedContractor[] = [];
      for (const contractor of gatedContractors) {
        const stats = contractor.userId
          ? await storage.getUserCredibilityStats(contractor.userId)
          : { jobsCompleted: 0, peopleHelped: 0, activeWeeks: 0 };

        const countyCount = serviceAreaCounts[contractor.id] ?? 0;
        const reachTier = tierForCount(countyCount);

        const localCredibilityScore =
          (stats.jobsCompleted ?? 0) * 3 +
          (stats.peopleHelped ?? 0) * 2 +
          (stats.activeWeeks ?? 0);

        ranked.push({
          id: contractor.id,
          userId: contractor.userId,
          companyName: contractor.companyName,
          positiveRecommendations: contractor.positiveRecommendations ?? contractor.totalRecommendations ?? 0,
          totalRecommendations: contractor.totalRecommendations ?? contractor.positiveRecommendations ?? 0,
          reachTier,
          localCredibilityScore,
        });
      }

      const tierRank: Record<"local" | "regional" | "wide", number> = {
        local: 0,
        regional: 1,
        wide: 2,
      };

      ranked.sort((a, b) => {
        const aTier = tierRank[a.reachTier] ?? 2;
        const bTier = tierRank[b.reachTier] ?? 2;
        if (aTier !== bTier) return aTier - bTier;
        const aScore = a.localCredibilityScore ?? 0;
        const bScore = b.localCredibilityScore ?? 0;
        return bScore - aScore;
      });

      const topRanked = ranked.slice(0, filters.limit || 5);

      if (!topRanked.length) {
        return res.status(200).json({ assignments: [], routed: false });
      }

      // Avoid duplicating assignments if any already exist for this request
      const existingAssignments = await db
        .select()
        .from(workRequestAssignments)
        .where(eq(workRequestAssignments.workRequestId, requestId));

      const existingByContractor = new Set(
        existingAssignments
          .map((a: any) => a.contractorId)
          .filter((id: any): id is string => Boolean(id)),
      );

      const now = new Date();
      const newAssignmentsPayload: any[] = [];
      const providerSuggestedEvents: any[] = [];

      for (const candidate of topRanked) {
        if (!candidate.id || existingByContractor.has(candidate.id)) continue;

        const recCount = Number(candidate.positiveRecommendations ?? 0) || 0;

        const reasons: string[] = [];
        if (candidate.reachTier === "local") {
          reasons.push("Local provider");
        } else if (candidate.reachTier === "regional") {
          reasons.push("Regional provider serving this county");
        } else {
          reasons.push("Serves this county and surrounding areas");
        }
        if (recCount > 0) {
          reasons.push(`${recCount} neighbor recommendations`);
        }

        const scoreSnapshot = {
          score: candidate.localCredibilityScore,
          reasons,
          tradeMatch: true,
          recommendationCount: recCount,
        };

        newAssignmentsPayload.push({
          workRequestId: requestId,
          contractorId: candidate.id,
          status: "suggested" as const,
          scoreSnapshot,
          createdAt: now,
          updatedAt: now,
        });

        providerSuggestedEvents.push({
          workRequestId: requestId,
          type: "provider_suggested" as const,
          actorUserId: String(userId),
          metadata: {
            contractorId: candidate.id,
            contractorUserId: candidate.userId ?? null,
            source: "direct_connect",
            scoreSnapshot,
          },
        });
      }

      if (!newAssignmentsPayload.length) {
        return res.status(200).json({ assignments: [], routed: false });
      }

      const insertedAssignments = await db
        .insert(workRequestAssignments)
        .values(newAssignmentsPayload)
        .returning();

      try {
        await db.insert(workRequestEvents).values(providerSuggestedEvents);
      } catch (e) {
        console.warn("[direct-connect] Failed to record provider_suggested events", e);
      }

      // Update the work request lifecycle state
      await db
        .update(workRequests)
        .set({ status: "routed", updatedAt: now })
        .where(eq(workRequests.id, requestId));

      try {
        // Notify each contractor that they have a new Direct Connect opportunity
        await Promise.all(
          topRanked.map(async (candidate) => {
            if (!candidate.userId) return;

            try {
              await notificationService.createNotification({
                userId: candidate.userId,
                type: "new_project_request",
                title: "New Direct Connect request",
                message: `You have a new Direct Connect request: ${requestRow.title}`,
                actionUrl: "/direct-connect/inbox",
                actionText: "View in Direct Connect",
                iconName: "briefcase",
                iconColor: "orange",
                deliveryMethods: ["in_app", "push"],
              });
            } catch (err) {
              console.error("[direct-connect] Failed to notify contractor for routed request", err);
            }
          }),
        );
      } catch (e) {
        console.error("[direct-connect] Failed to send notifications for routed request", e);
      }

      res.status(200).json({ assignments: insertedAssignments, routed: true });
    } catch (error: any) {
      console.error("Error routing direct connect request:", error);
      res.status(500).json({ message: error?.message || "Failed to route request" });
    }
  });

  // Requester-facing: list Direct Connect requests for the current user
  app.get("/api/direct-connect/requests", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const statusRaw = typeof req.query?.status === "string" ? (req.query.status as string) : "";
      const status = statusRaw.trim() as WorkRequest["status"] | "";

      const filters: any[] = [eq(workRequests.createdByUserId, String(userId))];
      if (status) {
        filters.push(eq(workRequests.status, status));
      }

      const whereClause = filters.length === 1 ? filters[0] : and(...filters);

      const requests = await db
        .select()
        .from(workRequests)
        .where(whereClause)
        .orderBy(desc(workRequests.createdAt));

      if (!requests.length) {
        return res.json([]);
      }

      const requestIds = requests.map((r: any) => r.id);

      // Aggregate assignments per request for requester visibility
      const assignments = await db
        .select()
        .from(workRequestAssignments)
        .where(inArray(workRequestAssignments.workRequestId, requestIds));

      const events = await db
        .select()
        .from(workRequestEvents)
        .where(inArray(workRequestEvents.workRequestId, requestIds));

      const assignmentsByRequest = new Map<string, any[]>();
      for (const a of assignments as any[]) {
        const key = String(a.workRequestId);
        const list = assignmentsByRequest.get(key) || [];
        list.push(a);
        assignmentsByRequest.set(key, list);
      }

      const lastEventByRequest = new Map<string, Date>();
      for (const e of events as any[]) {
        const key = String(e.workRequestId);
        const ts = e.createdAt ? new Date(e.createdAt) : null;
        if (!ts) continue;
        const existing = lastEventByRequest.get(key);
        if (!existing || ts > existing) {
          lastEventByRequest.set(key, ts);
        }
      }

      const enriched = requests.map((r: any) => {
        const a = assignmentsByRequest.get(String(r.id)) || [];
        const suggestedCount = a.filter((x: any) => x.status === "suggested" || x.status === "invited").length;
        const accepted = a.find((x: any) => x.status === "accepted");

        return {
          ...r,
          dcSuggestedCount: suggestedCount,
          dcAcceptedAssignmentId: accepted?.id ?? null,
          dcLastEventAt: lastEventByRequest.get(String(r.id))?.toISOString() ?? null,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching direct connect requests:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch requests" });
    }
  });

  // Requester-facing: cancel an in-progress or routed Direct Connect request
  app.post("/api/direct-connect/requests/:id/cancel", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const requestId = String(req.params.id);

      const [requestRow] = await db
        .select()
        .from(workRequests)
        .where(eq(workRequests.id, requestId));

      if (!requestRow) {
        return res.status(404).json({ message: "Work request not found" });
      }

      if (String(requestRow.createdByUserId) !== String(userId)) {
        return res.status(403).json({ message: "You can only cancel your own requests" });
      }

      if ((requestRow.source as string | null) !== "direct_connect") {
        return res.status(400).json({ message: "Only Direct Connect requests can be cancelled here" });
      }

      if (requestRow.status === "cancelled") {
        return res.status(200).json({ status: "cancelled" });
      }

      if (requestRow.status !== "in_progress" && requestRow.status !== "routed") {
        return res.status(400).json({ message: "Only routed or in-progress requests can be cancelled" });
      }

      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(workRequests)
          .set({ status: "cancelled", updatedAt: now })
          .where(eq(workRequests.id, requestId));

        // Mark any outstanding suggested/invited/accepted assignments as withdrawn
        await tx
          .update(workRequestAssignments)
          .set({ status: "withdrawn", updatedAt: now })
          .where(
            and(
              eq(workRequestAssignments.workRequestId, requestId),
              inArray(workRequestAssignments.status, ["suggested", "invited", "accepted"] as any),
            ),
          );

        try {
          await tx.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "cancelled",
            actorUserId: String(userId),
            fromStatus: requestRow.status,
            toStatus: "cancelled",
            metadata: { source: "direct_connect" },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to record cancelled event", e);
        }
      });

      // Outcome feedback: user cancelled a guided flow (negative confidence signal)
      try {
        const scope = "direct_connect";
        const outcomeEvent = {
          userId: Number(userId),
          contextType: "direct_connect" as const,
          contextId: requestId,
          action: "canceled" as const,
          scope,
        };
        await recordOutcomeEvent(outcomeEvent);
        await updateUserConfidenceStateFromOutcome(Number(userId), outcomeEvent, scope);
      } catch (e) {
        console.warn("[direct-connect] Failed to record outcome event for cancel", e);
      }

      res.status(200).json({ status: "cancelled" });
    } catch (error: any) {
      console.error("Error cancelling direct connect request:", error);
      res.status(500).json({ message: error?.message || "Failed to cancel request" });
    }
  });

  // Requester-facing: reopen a previously cancelled Direct Connect request
  app.post("/api/direct-connect/requests/:id/reopen", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const requestId = String(req.params.id);

      const [requestRow] = await db
        .select()
        .from(workRequests)
        .where(eq(workRequests.id, requestId));

      if (!requestRow) {
        return res.status(404).json({ message: "Work request not found" });
      }

      if (String(requestRow.createdByUserId) !== String(userId)) {
        return res.status(403).json({ message: "You can only reopen your own requests" });
      }

      if ((requestRow.source as string | null) !== "direct_connect") {
        return res.status(400).json({ message: "Only Direct Connect requests can be reopened here" });
      }

      if (requestRow.status !== "cancelled") {
        return res.status(400).json({ message: "Only cancelled requests can be reopened" });
      }

      const now = new Date();

      await db.transaction(async (tx) => {
        await tx
          .update(workRequests)
          .set({ status: "open", updatedAt: now })
          .where(eq(workRequests.id, requestId));

        try {
          await tx.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "status_changed",
            actorUserId: String(userId),
            fromStatus: "cancelled",
            toStatus: "open",
            metadata: { source: "direct_connect", reason: "reopened" },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to record status_changed event on reopen", e);
        }
      });

      res.status(200).json({ status: "open" });
    } catch (error: any) {
      console.error("Error reopening direct connect request:", error);
      res.status(500).json({ message: error?.message || "Failed to reopen request" });
    }
  });

  // Requester-facing: create a new Direct Connect request
  app.post("/api/direct-connect/requests", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const parse = directConnectRequestSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", issues: parse.error.flatten() });
      }
      const body = parse.data;

      const budgetMinNumber = body.budgetMin ?? NaN;
      const budgetMaxNumber = body.budgetMax ?? NaN;

      let budgetMin: string | undefined;
      let budgetMax: string | undefined;
      if (Number.isFinite(budgetMinNumber) && budgetMinNumber > 0) {
        budgetMin = String(budgetMinNumber);
      }
      if (Number.isFinite(budgetMaxNumber) && budgetMaxNumber > 0) {
        budgetMax = String(budgetMaxNumber);
      }

      // Use canonical location from the user where available
      let countyFips: string | undefined;
      let stateCode: string | undefined;
      try {
        const viewer = await storage.getUser(String(userId));
        if (viewer) {
          const vState = (viewer as any).stateCode || (viewer as any).state_code;
          const vCounty = (viewer as any).countyFips || (viewer as any).county_fips;
          if (typeof vState === "string" && vState.length === 2) stateCode = vState;
          if (typeof vCounty === "string" && vCounty.length > 0) countyFips = vCounty;
        }
      } catch (e) {
        console.warn("[direct-connect] Failed to load user for request location; continuing without canonical geo", e);
      }

      const [created] = await db
        .insert(workRequests)
        .values({
          createdByUserId: String(userId),
          title: body.title.trim(),
          description: body.description.trim(),
          category: body.category,
          countyFips,
          stateCode,
          scope: "community",
          source: "direct_connect" as any,
          status: "open",
          visibility: "community",
          exposureMode: "guided",
          competitionMode: "none",
          budgetMin,
          budgetMax,
          tradeId: body.tradeId,
        })
        .returning();

      if (created) {
        try {
          await db.insert(workRequestEvents).values({
            workRequestId: created.id,
            type: "created",
            actorUserId: String(userId),
            metadata: { source: "direct_connect" },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to record work request created event", e);
        }
      }

      res.status(201).json(created ?? null);
    } catch (error: any) {
      console.error("Error creating direct connect request:", error);
      res.status(500).json({ message: error?.message || "Failed to create request" });
    }
  });

  // Provider-facing inbox: assignments for the current contractor user
  app.get("/api/direct-connect/inbox", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const contractor = await storage.getContractorByUserId(String(userId));
      if (!contractor) {
        return res.json([]);
      }

      const assignments = await db
        .select()
        .from(workRequestAssignments)
        .where(eq(workRequestAssignments.contractorId, contractor.id))
        .orderBy(desc(workRequestAssignments.createdAt));

      if (!assignments.length) {
        return res.json([]);
      }

      const workRequestIds = assignments.map((a) => a.workRequestId);
      const requests = await db
        .select()
        .from(workRequests)
        .where(inArray(workRequests.id, workRequestIds));

      const requestById = new Map(requests.map((r: any) => [r.id, r]));

      const enriched = assignments.map((a: any) => ({
        assignment: a,
        request: requestById.get(a.workRequestId) || null,
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching direct connect inbox:", error);
      res.status(500).json({ message: error?.message || "Failed to fetch inbox" });
    }
  });

  // Provider-facing: accept/decline an assignment, and create a conversation on accept
  app.post("/api/direct-connect/assignments/:id/respond", isAuthenticated, async (req: AuthedRequest, res: Response) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const contractor = await storage.getContractorByUserId(String(userId));
      if (!contractor) {
        return res.status(403).json({ message: "Contractor profile required" });
      }

      const parse = assignmentResponseSchema.safeParse(req.body ?? {});
      if (!parse.success) {
        return res.status(400).json({ message: "Invalid request body", issues: parse.error.flatten() });
      }
      const decision = parse.data.decision;
      const declineReason = parse.data.reason;

      const result = await db.transaction(async (tx) => {
        const [assignment] = await tx
          .select()
          .from(workRequestAssignments)
          .where(eq(workRequestAssignments.id, req.params.id));

        if (!assignment || assignment.contractorId !== contractor.id) {
          return { status: 404 as const, body: { message: "Assignment not found" } };
        }

        const [requestRow] = await tx
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, assignment.workRequestId));

        if (!requestRow) {
          return { status: 404 as const, body: { message: "Work request not found" } };
        }

        // Guard against double-accept races: only allow accept while request is routed
        if (decision === "accept" && requestRow.status === "in_progress") {
          return {
            status: 409 as const,
            body: { message: "This Direct Connect request has already been accepted by another provider." },
          };
        }

        const [updatedAssignment] = await tx
          .update(workRequestAssignments)
          .set({
            status: decision === "accept" ? "accepted" : "declined",
            updatedAt: new Date(),
          })
          .where(eq(workRequestAssignments.id, assignment.id))
          .returning();

        let conversationId: string | null = null;

        if (decision === "accept") {
          try {
            // Ensure there is exactly one conversation between homeowner and contractor for this engagement
            const homeownerId = String(requestRow.createdByUserId);

            const existing = await tx
              .select()
              .from(conversations)
              .where(
                and(
                  eq(conversations.homeownerId, homeownerId),
                  eq(conversations.contractorId, contractor.id),
                ),
              )
              .orderBy(asc(conversations.createdAt))
              .limit(1);

            let convo = existing[0];
            if (!convo) {
              convo = await storage.createConversation({
                homeownerId,
                contractorId: contractor.id,
                leadId: null,
              } as any);
            }

            conversationId = String(convo.id);

            // Promote the work request to in_progress once at least one contractor accepts
            await tx
              .update(workRequests)
              .set({ status: "in_progress", updatedAt: new Date() })
              .where(eq(workRequests.id, requestRow.id));

            await tx.insert(workRequestEvents).values({
              workRequestId: requestRow.id,
              type: "provider_accepted",
              actorUserId: String(userId),
              metadata: { contractorId: contractor.id, conversationId },
            });
          } catch (e) {
            console.error("[direct-connect] Failed to create or link conversation for assignment", e);
          }
        } else {
          try {
            await tx.insert(workRequestEvents).values({
              workRequestId: requestRow.id,
              type: "provider_declined",
              actorUserId: String(userId),
              metadata: {
                contractorId: contractor.id,
                reason: declineReason || "Unavailable",
              },
            });
          } catch (e) {
            console.error("[direct-connect] Failed to log decline event", e);
          }
        }

        return { status: 200 as const, body: { assignment: updatedAssignment, conversationId } };
      });

      if (result.status !== 200) {
        return res.status(result.status).json(result.body);
      }

      res.json(result.body);
    } catch (error: any) {
      console.error("Error responding to direct connect assignment:", error);
      res.status(500).json({ message: error?.message || "Failed to respond to assignment" });
    }
  });
}
