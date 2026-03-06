import type { Express, Request, Response } from "express";
import { isAuthenticated, isStaff } from "../auth";
import { db } from "../db";
import { randomBytes } from "crypto";
import {
  type WorkRequest,
  workRequests,
  workRequestEvents,
  workRequestAssignments,
  contractors,
  conversations,
  trades,
} from "@shared/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { notificationService } from "../notification-service";
import { emailService } from "../services/emailService";
import { passwordResetService } from "../services/passwordResetService";
import { emailVerificationService } from "../services/emailVerificationService";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";
import {
  redactContactDetails,
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  formatBudgetRange,
} from "../utils/workRequestShare";
import { hasPrivilegedVerificationBypass } from "../utils/privilegedVerification";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
};

const directConnectRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1).optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  tradeId: z.string().min(1).optional(),
  countyFips: z.string().length(5).optional(),
  stateCode: z.string().length(2).optional(),
  targetContractorIds: z.array(z.string().min(1)).optional(),
});

const adminDirectConnectRequestSchema = directConnectRequestSchema
  .extend({
    targetUserId: z.string().min(1).optional(),
    targetEmail: z.string().email().optional(),
  })
  .refine((data) => Boolean(data.targetUserId || data.targetEmail), {
    message: "targetUserId or targetEmail is required",
    path: ["targetUserId"],
  });

const assignmentResponseSchema = z.object({
  decision: z.enum(["accept", "decline"]),
  // Optional, private decline reason for analytics and routing quality.
  // Never exposed to requesters.
  reason: z.string().min(1).max(200).optional(),
});

export function registerDirectConnectRoutes(app: Express) {
  const makeShareToken = () => randomBytes(16).toString("hex");
  const isSchemaMismatchError = (error: unknown): boolean => {
    const err = error as { code?: string; message?: string } | null;
    const code = String(err?.code || "").trim();
    if (code === "42P01" || code === "42703") return true; // undefined_table / undefined_column

    const message = String(err?.message || "").toLowerCase();
    return (
      (message.includes("relation") && message.includes("does not exist")) ||
      (message.includes("column") && message.includes("does not exist"))
    );
  };
  const sanitizeWorkRequestText = (value: string, maxLength: number) =>
    redactContactDetails(String(value || ""))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLength);

  const resolveOrigin = (req: Request) => {
    const protoHeader = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim();
    const proto = protoHeader || req.protocol || "https";
    const host = req.get("host") || "www.thetradescout.com";
    return `${proto}://${host}`;
  };

  // Requester-facing: route an open Direct Connect request to top contractors
  app.post(
    "/api/direct-connect/requests/:id/route",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be routed here" });
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
          return res
            .status(400)
            .json({ message: "Request must have a trade and county set before routing" });
        }

        // Mirror the contractor ranking logic from /api/contractors/top
        const countyRecord = await storage.getCountyByFips(countyFips as string);
        let tradeRecord = await storage.getTradeBySlug(tradeSlug as string);

        // Back-compat: some callers may store the DB trade id in work_requests.trade_id.
        // Prefer slug, but allow resolving by id to avoid blocking routing.
        if (!tradeRecord && tradeSlug) {
          const [byId] = await db
            .select()
            .from(trades)
            .where(eq(trades.id, String(tradeSlug)));
          tradeRecord = byId;
        }

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
          gatedContractors.map((c: any) => c.id)
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
            positiveRecommendations:
              contractor.positiveRecommendations ?? contractor.totalRecommendations ?? 0,
            totalRecommendations:
              contractor.totalRecommendations ?? contractor.positiveRecommendations ?? 0,
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
            .filter((id: any): id is string => Boolean(id))
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
          const insertedContractorIds = new Set(
            insertedAssignments
              .map((a: any) => a.contractorId)
              .filter((id: any): id is string => Boolean(id))
          );
          const contractorsToNotify = topRanked.filter(
            (candidate) => candidate.id && insertedContractorIds.has(candidate.id)
          );

          // Notify each contractor that they have a new Direct Connect opportunity
          await Promise.all(
            contractorsToNotify.map(async (candidate) => {
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
                console.error(
                  "[direct-connect] Failed to notify contractor for routed request",
                  err
                );
              }
            })
          );
        } catch (e) {
          console.error("[direct-connect] Failed to send notifications for routed request", e);
        }

        res.status(200).json({ assignments: insertedAssignments, routed: true });
      } catch (error: any) {
        console.error("Error routing direct connect request:", error);
        res
          .status(500)
          .json({ message: "Failed to route request", requestId: (req as any).requestId || null });
      }
    }
  );

  // Requester-facing: list Direct Connect requests for the current user
  app.get(
    "/api/direct-connect/requests",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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

        let requests: any[] = [];
        try {
          requests = await db
            .select()
            .from(workRequests)
            .where(whereClause)
            .orderBy(desc(workRequests.createdAt));
        } catch (error) {
          if (isSchemaMismatchError(error)) {
            console.warn(
              "[direct-connect] work_requests schema mismatch while listing requests; returning empty list",
              error
            );
            return res.json([]);
          }
          throw error;
        }

        if (!requests.length) {
          return res.json([]);
        }

        const requestIds = requests.map((r: any) => r.id);

        // Aggregate assignments per request for requester visibility
        let assignments: any[] = [];
        try {
          assignments = await db
            .select()
            .from(workRequestAssignments)
            .where(inArray(workRequestAssignments.workRequestId, requestIds));
        } catch (error) {
          if (isSchemaMismatchError(error)) {
            console.warn(
              "[direct-connect] work_request_assignments schema mismatch while listing requests; continuing without assignments",
              error
            );
            assignments = [];
          } else {
            throw error;
          }
        }

        const acceptedAssignments = (assignments as any[]).filter(
          (x: any) => x.status === "accepted" && x.contractorId
        );
        const acceptedContractorIds = Array.from(
          new Set(
            acceptedAssignments
              .map((x: any) => String(x.contractorId))
              .filter((id: string) => id.length > 0)
          )
        );

        let conversationsForAccepted: any[] = [];
        if (acceptedContractorIds.length > 0) {
          try {
            conversationsForAccepted = await db
              .select()
              .from(conversations)
              .where(
                and(
                  eq(conversations.homeownerId, String(userId)),
                  inArray(conversations.contractorId, acceptedContractorIds)
                )
              )
              .orderBy(desc(conversations.createdAt));
          } catch (error) {
            if (isSchemaMismatchError(error)) {
              console.warn(
                "[direct-connect] conversations schema mismatch while resolving accepted threads; continuing without conversation links",
                error
              );
              conversationsForAccepted = [];
            } else {
              throw error;
            }
          }
        }

        const conversationByContractorId = new Map<string, string>();
        for (const convo of conversationsForAccepted as any[]) {
          const contractorId = String((convo as any).contractorId || "");
          if (!contractorId || conversationByContractorId.has(contractorId)) continue;
          conversationByContractorId.set(contractorId, String((convo as any).id));
        }

        let events: any[] = [];
        try {
          events = await db
            .select()
            .from(workRequestEvents)
            .where(inArray(workRequestEvents.workRequestId, requestIds));
        } catch (error) {
          if (isSchemaMismatchError(error)) {
            console.warn(
              "[direct-connect] work_request_events schema mismatch while listing requests; continuing without event timeline",
              error
            );
            events = [];
          } else {
            throw error;
          }
        }

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
          const suggestedCount = a.filter(
            (x: any) => x.status === "suggested" || x.status === "invited"
          ).length;
          const accepted = a.find((x: any) => x.status === "accepted");
          const acceptedContractorId = accepted?.contractorId
            ? String(accepted.contractorId)
            : null;
          const conversationThreadId = acceptedContractorId
            ? conversationByContractorId.get(acceptedContractorId) || null
            : null;

          return {
            ...r,
            dcSuggestedCount: suggestedCount,
            dcAcceptedAssignmentId: accepted?.id ?? null,
            dcConversationThreadId: conversationThreadId,
            dcLastEventAt: lastEventByRequest.get(String(r.id))?.toISOString() ?? null,
          };
        });

        res.json(enriched);
      } catch (error: any) {
        console.error("Error fetching direct connect requests:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch requests", requestId: (req as any).requestId || null });
      }
    }
  );

  // Requester-facing: create/fetch a public share URL for a Direct Connect request
  app.get(
    "/api/direct-connect/requests/:id/share",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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

        if ((requestRow.source as string | null) !== "direct_connect") {
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be shared here" });
        }

        if (String(requestRow.createdByUserId) !== String(userId)) {
          return res.status(403).json({ message: "You can only share your own requests" });
        }

        let shareToken = String((requestRow as any).shareToken || "");
        if (!shareToken) {
          let attempts = 0;
          while (!shareToken && attempts < 5) {
            attempts += 1;
            const candidate = makeShareToken();
            try {
              await db
                .update(workRequests)
                .set({ shareToken: candidate, updatedAt: new Date() })
                .where(eq(workRequests.id, requestId));
              shareToken = candidate;
            } catch {
              // Retry on collision/constraint issues.
            }
          }
        }

        if (!shareToken) {
          return res.status(500).json({ message: "Failed to create share link" });
        }

        const origin = resolveOrigin(req);
        const shareUrl = `${origin}/r/${encodeURIComponent(shareToken)}`;

        return res.status(200).json({
          shareToken,
          shareUrl,
          policy: "scope_only_join_and_verify_required",
        });
      } catch (error: any) {
        console.error("Error creating direct connect share link:", error);
        return res.status(500).json({
          message: "Failed to create share link",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Public redacted payload for a shared Direct Connect request
  app.get("/api/direct-connect/share/:token", async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "").trim();
      if (!token) {
        return res.status(400).json({ message: "Share token is required" });
      }

      const [requestRow] = await db
        .select()
        .from(workRequests)
        .where(eq(workRequests.shareToken, token));

      if (!requestRow || (requestRow.source as string | null) !== "direct_connect") {
        return res.status(404).json({ message: "Shared request not found" });
      }

      const trade = requestRow.tradeId
        ? await storage.getTradeBySlug(String(requestRow.tradeId))
        : null;
      const county = requestRow.countyFips
        ? await storage.getCountyByFips(String(requestRow.countyFips))
        : null;

      const tradeLabel = String((trade as any)?.name || requestRow.tradeId || "Project");
      const countyName = String((county as any)?.name || "");
      const stateCode = requestRow.stateCode ? String(requestRow.stateCode) : "";
      const locationLabel = countyName
        ? stateCode
          ? `${countyName}, ${stateCode}`
          : countyName
        : stateCode || "Local area";

      const scopeSummary = buildWorkRequestScopeSummary(String(requestRow.description || ""));
      const budgetRange = formatBudgetRange(requestRow.budgetMin, requestRow.budgetMax);

      return res.status(200).json({
        id: requestRow.id,
        title: buildWorkRequestPreviewTitle(String(requestRow.title || ""), "Shared request"),
        scopeSummary,
        category: requestRow.category || null,
        tradeLabel,
        locationLabel,
        budgetRange,
        postedAt: requestRow.createdAt,
        gating: {
          contactLocked: true,
          claimLocked: true,
          requiresJoinAndVerification: true,
        },
      });
    } catch (error: any) {
      console.error("Error fetching shared direct connect request:", error);
      return res.status(500).json({
        message: "Failed to load shared request",
        requestId: (req as any).requestId || null,
      });
    }
  });

  // Requester-facing: cancel an in-progress or routed Direct Connect request
  app.post(
    "/api/direct-connect/requests/:id/cancel",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be cancelled here" });
        }

        if (requestRow.status === "cancelled") {
          return res.status(200).json({ status: "cancelled" });
        }

        if (requestRow.status !== "in_progress" && requestRow.status !== "routed") {
          return res
            .status(400)
            .json({ message: "Only routed or in-progress requests can be cancelled" });
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
                inArray(workRequestAssignments.status, ["suggested", "invited", "accepted"] as any)
              )
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
            userId: String(userId),
            contextType: "direct_connect" as const,
            contextId: requestId,
            action: "canceled" as const,
            scope,
          };
          await recordOutcomeEvent(outcomeEvent);
          await updateUserConfidenceStateFromOutcome(String(userId), outcomeEvent, scope);
        } catch (e) {
          console.warn("[direct-connect] Failed to record outcome event for cancel", e);
        }

        res.status(200).json({ status: "cancelled" });
      } catch (error: any) {
        console.error("Error cancelling direct connect request:", error);
        res
          .status(500)
          .json({ message: "Failed to cancel request", requestId: (req as any).requestId || null });
      }
    }
  );

  // Requester-facing: reopen a previously cancelled Direct Connect request
  app.post(
    "/api/direct-connect/requests/:id/reopen",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be reopened here" });
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
        res
          .status(500)
          .json({ message: "Failed to reopen request", requestId: (req as any).requestId || null });
      }
    }
  );

  // Requester-facing: create a new Direct Connect request
  app.post(
    "/api/direct-connect/requests",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const parse = directConnectRequestSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid request body", issues: parse.error.flatten() });
        }
        const body = parse.data;
        const sanitizedTitle = sanitizeWorkRequestText(body.title, 180);
        const sanitizedDescription = sanitizeWorkRequestText(body.description, 5000);
        if (!sanitizedTitle || !sanitizedDescription) {
          return res.status(400).json({
            message: "Please include non-contact project details in title and scope.",
          });
        }

        // C2-3: Verification gate - check homeowner address verification (REQUEST_CONTRACTOR_QUOTE action)
        const viewer = await storage.getUser(String(userId));
        const requesterRole = (viewer as any)?.role || "homeowner";

        const canBypassVerification = hasPrivilegedVerificationBypass(viewer);
        if (
          !canBypassVerification &&
          requesterRole === "homeowner" &&
          !(viewer as any)?.addressVerified
        ) {
          const { buildVerificationGateResponse } =
            await import("../utils/explainAndOfferVerification");

          const gateResponse = buildVerificationGateResponse({
            action: "REQUEST_CONTRACTOR_QUOTE",
            missingRequirements: ["address"],
            userRole: requesterRole,
            targetUserId: undefined,
            targetRole: "contractor",
            context: { intent: "create_work_request", category: body.category },
          });

          return res.status(200).json({
            ...gateResponse,
            verificationRequired: {
              action: "REQUEST_CONTRACTOR_QUOTE",
              retryPath: `/api/direct-connect/requests`,
              context: { category: body.category, title: body.title },
            },
          });
        }

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
          if (viewer) {
            const vState = (viewer as any).stateCode || (viewer as any).state_code;
            const vCounty = (viewer as any).countyFips || (viewer as any).county_fips;
            if (typeof vState === "string" && vState.length === 2) stateCode = vState;
            if (typeof vCounty === "string" && vCounty.length > 0) countyFips = vCounty;
          }
        } catch (e) {
          console.warn(
            "[direct-connect] Failed to load user for request location; continuing without canonical geo",
            e
          );
        }

        const bodyCounty = typeof body.countyFips === "string" ? body.countyFips : undefined;
        const bodyState =
          typeof body.stateCode === "string" ? body.stateCode.toUpperCase() : undefined;
        if (bodyCounty) countyFips = bodyCounty;
        if (bodyState) stateCode = bodyState;

        const isDirectToProviders =
          Array.isArray(body.targetContractorIds) && body.targetContractorIds.length > 0;

        const [created] = await db
          .insert(workRequests)
          .values({
            createdByUserId: String(userId),
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: body.category,
            countyFips,
            stateCode,
            // Direct-to-provider requests should not be listed as "community board" jobs.
            scope: isDirectToProviders ? "personal" : "community",
            source: "direct_connect" as any,
            status: "open",
            visibility: isDirectToProviders ? "private" : "community",
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

        if (created && body.targetContractorIds && body.targetContractorIds.length > 0) {
          try {
            const requestedIds = Array.from(new Set(body.targetContractorIds));
            const invitedContractors = await db
              .select()
              .from(contractors)
              .where(inArray(contractors.id, requestedIds));

            if (invitedContractors.length > 0) {
              const now = new Date();
              const assignments = invitedContractors.map((contractor) => ({
                workRequestId: created.id,
                contractorId: contractor.id,
                status: "invited" as const,
                createdAt: now,
                updatedAt: now,
              }));

              await db.insert(workRequestAssignments).values(assignments);

              await db
                .update(workRequests)
                .set({ status: "routed", updatedAt: now })
                .where(eq(workRequests.id, created.id));

              try {
                await db.insert(workRequestEvents).values(
                  invitedContractors.map((contractor) => ({
                    workRequestId: created.id,
                    type: "provider_invited" as const,
                    actorUserId: String(userId),
                    metadata: {
                      contractorId: contractor.id,
                      contractorUserId: contractor.userId ?? null,
                      source: "direct_connect",
                    },
                  }))
                );
              } catch (e) {
                console.warn("[direct-connect] Failed to record provider_invited events", e);
              }

              try {
                await Promise.all(
                  invitedContractors.map(async (contractor) => {
                    if (!contractor.userId) return;
                    await notificationService.createNotification({
                      userId: contractor.userId,
                      type: "new_project_request",
                      title: "New Direct Connect request",
                      message: `You have a new Direct Connect request: ${created.title}`,
                      actionUrl: "/direct-connect/inbox",
                      actionText: "View in Direct Connect",
                      iconName: "briefcase",
                      iconColor: "orange",
                      deliveryMethods: ["in_app", "push"],
                    });
                  })
                );
              } catch (e) {
                console.error("[direct-connect] Failed to notify invited contractors", e);
              }
            }
          } catch (e) {
            console.error("[direct-connect] Failed to invite target contractors", e);
          }
        }

        res.status(201).json(created ?? null);
      } catch (error: any) {
        console.error("Error creating direct connect request:", error);
        if (isSchemaMismatchError(error)) {
          return res.status(503).json({
            message: "Direct Connect is initializing right now. Please retry in a moment.",
            code: "DIRECT_CONNECT_SCHEMA_MISMATCH",
          });
        }
        res
          .status(500)
          .json({ message: "Failed to create request", requestId: (req as any).requestId || null });
      }
    }
  );

  // Staff-facing: create a Direct Connect request for a user account
  app.post(
    "/api/admin/direct-connect/requests",
    isAuthenticated,
    isStaff,
    async (req: AuthedRequest, res: Response) => {
      try {
        const actorUserId = req.user?.id || req.user?.claims?.sub;
        if (!actorUserId) return res.status(401).json({ message: "Unauthorized" });

        const parse = adminDirectConnectRequestSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid request body", issues: parse.error.flatten() });
        }

        const body = parse.data;
        const sanitizedTitle = sanitizeWorkRequestText(body.title, 180);
        const sanitizedDescription = sanitizeWorkRequestText(body.description, 5000);
        if (!sanitizedTitle || !sanitizedDescription) {
          return res.status(400).json({
            message: "Please include non-contact project details in title and scope.",
          });
        }
        let targetUser = null as any;
        let targetUserProvisioned = false;
        let setupEmailSent = false;
        let activationLinkIncluded = false;
        let verifyLinkIncluded = false;
        let activationLink: string | undefined;
        let verifyLink: string | undefined;
        if (body.targetUserId) {
          targetUser = await storage.getUser(body.targetUserId);
        } else if (body.targetEmail) {
          const normalizedEmail = body.targetEmail.toLowerCase();
          targetUser = await storage.getUserByEmail(normalizedEmail);
          if (!targetUser) {
            targetUser = await storage.createUser({
              email: normalizedEmail,
              role: "homeowner" as any,
              roles: ["homeowner"],
              activeRole: "homeowner",
              emailVerified: false,
              addressVerified: false,
              preferences: {
                provisional: {
                  userTypes: ["homeowner"],
                  source: "admin_direct_connect_request",
                  capturedAt: new Date().toISOString(),
                },
              },
            } as any);
            targetUserProvisioned = true;
          }

          const publicBase = resolveOrigin(req).replace(/\/$/, "");
          const shouldSendActivation = !targetUser.password;
          const shouldSendVerification = targetUser.emailVerified !== true;
          activationLinkIncluded = shouldSendActivation;
          verifyLinkIncluded = shouldSendVerification;

          if (shouldSendActivation) {
            const reset = passwordResetService.createToken(String(targetUser.id));
            activationLink = `${publicBase}/reset-password?token=${reset.token}`;
          }
          if (shouldSendVerification) {
            const verify = emailVerificationService.createToken(String(targetUser.id));
            verifyLink = `${publicBase}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
          }

          if (shouldSendActivation || shouldSendVerification) {
            const canSendEmail = emailService.isConfigured();
            if (canSendEmail) {
              const htmlParts: string[] = [
                "<p>Your TradeScout Direct Connect request is ready.</p>",
                "<p>Finish account setup to view and manage your request.</p>",
              ];
              if (activationLink && shouldSendActivation) {
                htmlParts.push(`<p><a href="${activationLink}">Set your password</a>.</p>`);
              }
              if (verifyLink && shouldSendVerification) {
                htmlParts.push(`<p><a href="${verifyLink}">Verify your email</a>.</p>`);
              }
              htmlParts.push("<p>If you did not expect this, you can ignore this email.</p>");

              await emailService.sendEmail({
                to: normalizedEmail,
                subject: "Your TradeScout Direct Connect request is ready",
                html: htmlParts.join("\n"),
                text: [
                  shouldSendActivation && activationLink ? `Set password: ${activationLink}` : null,
                  shouldSendVerification && verifyLink ? `Verify email: ${verifyLink}` : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
                purpose: "account_creation",
              });
              setupEmailSent = true;
            } else if (process.env.NODE_ENV !== "production") {
              // In local/dev environments return links for manual testing.
              setupEmailSent = false;
            }
          }
        }

        if (!targetUser) {
          return res.status(404).json({ message: "Target user not found" });
        }

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

        // Default location from target user; body fields can override.
        let countyFips: string | undefined;
        let stateCode: string | undefined;
        const vState = (targetUser as any).stateCode || (targetUser as any).state_code;
        const vCounty = (targetUser as any).countyFips || (targetUser as any).county_fips;
        if (typeof vState === "string" && vState.length === 2) stateCode = vState;
        if (typeof vCounty === "string" && vCounty.length > 0) countyFips = vCounty;

        const bodyCounty = typeof body.countyFips === "string" ? body.countyFips : undefined;
        const bodyState =
          typeof body.stateCode === "string" ? body.stateCode.toUpperCase() : undefined;
        if (bodyCounty) countyFips = bodyCounty;
        if (bodyState) stateCode = bodyState;

        const [created] = await db
          .insert(workRequests)
          .values({
            createdByUserId: String(targetUser.id),
            title: sanitizedTitle,
            description: sanitizedDescription,
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
              actorUserId: String(actorUserId),
              metadata: {
                source: "direct_connect_admin",
                createdForUserId: String(targetUser.id),
              },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record admin-created request event", e);
          }
        }

        if (created && body.targetContractorIds && body.targetContractorIds.length > 0) {
          try {
            const requestedIds = Array.from(new Set(body.targetContractorIds));
            const invitedContractors = await db
              .select()
              .from(contractors)
              .where(inArray(contractors.id, requestedIds));

            if (invitedContractors.length > 0) {
              const now = new Date();
              const assignments = invitedContractors.map((contractor) => ({
                workRequestId: created.id,
                contractorId: contractor.id,
                status: "invited" as const,
                createdAt: now,
                updatedAt: now,
              }));

              await db.insert(workRequestAssignments).values(assignments);

              await db
                .update(workRequests)
                .set({ status: "routed", updatedAt: now })
                .where(eq(workRequests.id, created.id));

              try {
                await db.insert(workRequestEvents).values(
                  invitedContractors.map((contractor) => ({
                    workRequestId: created.id,
                    type: "provider_invited" as const,
                    actorUserId: String(actorUserId),
                    metadata: {
                      contractorId: contractor.id,
                      contractorUserId: contractor.userId ?? null,
                      source: "direct_connect_admin",
                      createdForUserId: String(targetUser.id),
                    },
                  }))
                );
              } catch (e) {
                console.warn(
                  "[direct-connect] Failed to record provider_invited events for admin-created request",
                  e
                );
              }

              try {
                await Promise.all(
                  invitedContractors.map(async (contractor) => {
                    if (!contractor.userId) return;
                    await notificationService.createNotification({
                      userId: contractor.userId,
                      type: "new_project_request",
                      title: "New Direct Connect request",
                      message: `You have a new Direct Connect request: ${created.title}`,
                      actionUrl: "/direct-connect/inbox",
                      actionText: "View in Direct Connect",
                      iconName: "briefcase",
                      iconColor: "orange",
                      deliveryMethods: ["in_app", "push"],
                    });
                  })
                );
              } catch (e) {
                console.error(
                  "[direct-connect] Failed to notify invited contractors for admin-created request",
                  e
                );
              }
            }
          } catch (e) {
            console.error(
              "[direct-connect] Failed to invite target contractors for admin-created request",
              e
            );
          }
        }

        return res.status(201).json({
          request: created ?? null,
          createdForUser: {
            id: String(targetUser.id),
            email: String(targetUser.email || ""),
          },
          targetUserProvisioned,
          setupEmailSent,
          activationLinkIncluded,
          verifyLinkIncluded,
          ...(process.env.NODE_ENV !== "production" && activationLink ? { activationLink } : {}),
          ...(process.env.NODE_ENV !== "production" && verifyLink ? { verifyLink } : {}),
          createdByStaffUserId: String(actorUserId),
        });
      } catch (error: any) {
        console.error("Error creating admin direct connect request:", error);
        return res.status(500).json({
          message: "Failed to create request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Provider-facing inbox: assignments for the current contractor user
  app.get(
    "/api/direct-connect/inbox",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
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

        const homeownerIds = Array.from(
          new Set(
            (requests as any[])
              .map((r: any) => String(r.createdByUserId || ""))
              .filter((id: string) => id.length > 0)
          )
        );

        const candidateConversations =
          homeownerIds.length > 0
            ? await db
                .select()
                .from(conversations)
                .where(
                  and(
                    eq(conversations.contractorId, contractor.id),
                    inArray(conversations.homeownerId, homeownerIds)
                  )
                )
                .orderBy(desc(conversations.createdAt))
            : [];

        const conversationByHomeowner = new Map<string, string>();
        for (const convo of candidateConversations as any[]) {
          const homeownerId = String((convo as any).homeownerId || "");
          if (!homeownerId || conversationByHomeowner.has(homeownerId)) continue;
          conversationByHomeowner.set(homeownerId, String((convo as any).id));
        }

        const enriched = assignments.map((a: any) => ({
          assignment: a,
          request: requestById.get(a.workRequestId) || null,
          conversationThreadId: (() => {
            const reqRow = requestById.get(a.workRequestId) as any;
            if (!reqRow?.createdByUserId) return null;
            return conversationByHomeowner.get(String(reqRow.createdByUserId)) || null;
          })(),
        }));

        res.json(enriched);
      } catch (error: any) {
        console.error("Error fetching direct connect inbox:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch inbox", requestId: (req as any).requestId || null });
      }
    }
  );

  // Provider-facing: accept/decline an assignment, and create a conversation on accept
  app.post(
    "/api/direct-connect/assignments/:id/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const contractor = await storage.getContractorByUserId(String(userId));
        if (!contractor) {
          return res.status(403).json({ message: "Contractor profile required" });
        }

        const parse = assignmentResponseSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid request body", issues: parse.error.flatten() });
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

          const assignmentStatus = String(assignment.status || "");
          const canRespond = assignmentStatus === "suggested" || assignmentStatus === "invited";
          if (!canRespond) {
            if (decision === "accept" && assignmentStatus === "accepted") {
              return {
                status: 409 as const,
                body: {
                  message: "You have already accepted this request.",
                },
              };
            }
            return {
              status: 409 as const,
              body: {
                message: "This request is no longer available for response.",
              },
            };
          }

          if (decision === "accept" && requestRow.status !== "routed") {
            return {
              status: 409 as const,
              body: {
                message: "This Direct Connect request is no longer accepting new responses.",
              },
            };
          }

          const now = new Date();
          let updatedAssignment: any;

          let conversationId: string | null = null;

          if (decision === "accept") {
            await tx
              .update(workRequestAssignments)
              .set({ status: "withdrawn", updatedAt: now })
              .where(
                and(
                  eq(workRequestAssignments.workRequestId, requestRow.id),
                  inArray(workRequestAssignments.status, [
                    "suggested",
                    "invited",
                    "accepted",
                  ] as any)
                )
              );

            [updatedAssignment] = await tx
              .update(workRequestAssignments)
              .set({
                status: "accepted",
                updatedAt: now,
              })
              .where(eq(workRequestAssignments.id, assignment.id))
              .returning();

            try {
              // Ensure there is exactly one conversation between homeowner and contractor for this engagement
              const homeownerId = String(requestRow.createdByUserId);

              const existing = await tx
                .select()
                .from(conversations)
                .where(
                  and(
                    eq(conversations.homeownerId, homeownerId),
                    eq(conversations.contractorId, contractor.id)
                  )
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
                .set({ status: "in_progress", updatedAt: now })
                .where(eq(workRequests.id, requestRow.id));

              await tx.insert(workRequestEvents).values({
                workRequestId: requestRow.id,
                type: "provider_accepted",
                actorUserId: String(userId),
                metadata: { contractorId: contractor.id, conversationId },
              });
            } catch (e) {
              console.error(
                "[direct-connect] Failed to create or link conversation for assignment",
                e
              );
            }
          } else {
            [updatedAssignment] = await tx
              .update(workRequestAssignments)
              .set({
                status: "declined",
                updatedAt: now,
              })
              .where(eq(workRequestAssignments.id, assignment.id))
              .returning();

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
        res.status(500).json({
          message: "Failed to respond to assignment",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
