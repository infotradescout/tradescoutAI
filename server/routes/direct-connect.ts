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
  counties,
} from "@shared/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { notificationService } from "../notification-service";
import { emailService } from "../services/emailService";
import { passwordResetService } from "../services/passwordResetService";
import { emailVerificationService } from "../services/emailVerificationService";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";
import { logAdminAction } from "../services/adminAuditLogService";
import {
  redactContactDetails,
  buildWorkRequestPreviewTitle,
  buildWorkRequestScopeSummary,
  formatBudgetRange,
} from "../utils/workRequestShare";
import type { PrivilegedBypassReason } from "../utils/authorityPolicy";
import {
  hasManualDirectConnectBypassRequest,
  isDirectConnectUnverifiedBypassEnabled,
  resolvePrivilegedVerificationBypass,
} from "../utils/authorityPolicy";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
};

type DirectConnectBypassSource = "none" | "privileged" | "environment" | "manual";

interface DirectConnectVerificationBypassContext {
  active: boolean;
  source: DirectConnectBypassSource;
  reason: PrivilegedBypassReason;
  matchedRoles: string[];
  matchedEmail: string | null;
}

function resolveDirectConnectVerificationBypass(
  req: Request,
  viewer: any
): DirectConnectVerificationBypassContext {
  const privileged = resolvePrivilegedVerificationBypass(viewer);
  const manualRequested = hasManualDirectConnectBypassRequest(req);

  if (manualRequested && privileged.active) {
    return {
      active: true,
      source: "manual",
      reason: "manual_direct_connect_override",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
    };
  }

  if (privileged.active) {
    return {
      active: true,
      source: "privileged",
      reason: privileged.reason,
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
    };
  }

  if (isDirectConnectUnverifiedBypassEnabled()) {
    return {
      active: true,
      source: "environment",
      reason: "direct_connect_demo_mode",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
    };
  }

  return {
    active: false,
    source: "none",
    reason: "none",
    matchedRoles: privileged.matchedRoles,
    matchedEmail: privileged.matchedEmail,
  };
}

async function auditDirectConnectBypassUsage(params: {
  req: Request;
  actorUserId: string;
  context: DirectConnectVerificationBypassContext;
  operation: "create" | "route" | "admin_create";
  requestId?: string;
}) {
  const { req, actorUserId, context, operation, requestId } = params;
  if (!context.active) return;

  try {
    await logAdminAction({
      action: "direct_connect_verification_bypass_applied",
      operation,
      actorUserId,
      requestId: requestId ?? null,
      bypassSource: context.source,
      bypassReason: context.reason,
      matchedRoles: context.matchedRoles,
      matchedEmail: context.matchedEmail,
      requestPath: req.path,
      requestMethod: req.method,
      requestIdHeader: req.headers["x-request-id"] ?? null,
    });
  } catch (error) {
    console.warn("[direct-connect] Failed to record verification bypass audit event", error);
  }
}

const directConnectRequestSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1).optional(),
  budgetMin: z.number().positive().optional(),
  budgetMax: z.number().positive().optional(),
  tradeId: z.string().min(1).optional(),
  countyFips: z.string().length(5).optional(),
  stateCode: z.string().length(2).optional(),
  autoRoute: z.boolean().optional(),
  attachments: z.array(z.string().trim().min(10).max(600)).max(8).optional(),
  targetContractorIds: z.array(z.string().min(1)).optional(),
});

const ADMIN_DIRECT_CONNECT_CATEGORIES = [
  "service_request",
  "business_request",
  "customer_support",
] as const;
type AdminDirectConnectCategory = (typeof ADMIN_DIRECT_CONNECT_CATEGORIES)[number];

const adminDirectConnectRequestSchema = directConnectRequestSchema
  .extend({
    category: z.enum(ADMIN_DIRECT_CONNECT_CATEGORIES).optional(),
    targetUserId: z.string().min(1).optional(),
    targetEmail: z.string().email().optional(),
    forceSetupEmail: z.boolean().optional(),
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

const normalizeTradeSlugInput = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

const toTradeDisplayName = (value: string): string => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!cleaned) return "Custom Trade";
  return cleaned
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ")
    .slice(0, 120);
};

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

  const isPrivateAttachmentObjectKey = (value: unknown): value is string => {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    if (!trimmed.startsWith("private/")) return false;
    if (/^https?:\/\//i.test(trimmed)) return false;

    const parts = trimmed.split("/").filter(Boolean);
    const fileId = parts[parts.length - 1] || "";
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId);
  };

  const normalizeAttachmentKeys = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];

    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
          .filter((entry) => isPrivateAttachmentObjectKey(entry))
      )
    ).slice(0, 8);
  };

  const getAttachmentCount = (requestRow: unknown): number => {
    if (!requestRow || typeof requestRow !== "object") return 0;
    return normalizeAttachmentKeys((requestRow as { attachments?: unknown }).attachments).length;
  };

  const resolveOrCreateAdminTrade = async (
    rawTradeId: string | undefined
  ): Promise<{ slug: string; created: boolean } | null> => {
    const raw = String(rawTradeId || "").trim();
    if (!raw) return null;

    const existingBySlug = await storage.getTradeBySlug(raw);
    if (existingBySlug) return { slug: existingBySlug.slug, created: false };

    const [existingById] = await db.select().from(trades).where(eq(trades.id, raw)).limit(1);
    if (existingById) return { slug: String(existingById.slug), created: false };

    const normalizedSlug = normalizeTradeSlugInput(raw);
    if (!normalizedSlug) return null;

    const existingByNormalizedSlug = await storage.getTradeBySlug(normalizedSlug);
    if (existingByNormalizedSlug) return { slug: existingByNormalizedSlug.slug, created: false };

    try {
      const createdTrade = await storage.createTrade({
        name: toTradeDisplayName(raw),
        slug: normalizedSlug,
      } as any);
      return { slug: String(createdTrade.slug), created: true };
    } catch (error: any) {
      if (String(error?.code || "") === "23505") {
        const existing = await storage.getTradeBySlug(normalizedSlug);
        if (existing) return { slug: existing.slug, created: false };
      }
      throw error;
    }
  };

  const resolveOrigin = (req: Request) => {
    const protoHeader = String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim();
    const proto = protoHeader || req.protocol || "https";
    const host = req.get("host") || "www.thetradescout.com";
    return `${proto}://${host}`;
  };

  const routeRequestToTopContractors = async ({
    requestRow,
    actorUserId,
    expandReach,
    bypassVerificationGate,
  }: {
    requestRow: any;
    actorUserId: string;
    expandReach: boolean;
    bypassVerificationGate: boolean;
  }): Promise<{ assignments: any[]; routed: boolean }> => {
    const requestId = String(requestRow.id);
    let countyFips = typeof requestRow.countyFips === "string" ? requestRow.countyFips.trim() : "";
    let stateCode = typeof requestRow.stateCode === "string" ? requestRow.stateCode.trim() : "";
    const tradeSlug = typeof requestRow.tradeId === "string" ? requestRow.tradeId : "";

    let countyRecord = countyFips ? await storage.getCountyByFips(countyFips) : null;

    // County resolution fallback for demo/pilot reliability:
    // if request payload lacks county_fips but requester profile has county_id,
    // resolve and persist canonical county_fips/state_code on the request.
    if (!countyRecord) {
      const requesterUserId = String(requestRow.createdByUserId || "");
      if (requesterUserId) {
        const requester = await storage.getUser(requesterUserId);
        if (requester) {
          const requesterCountyFipsRaw =
            (requester as any).countyFips || (requester as any).county_fips;
          const requesterCountyFips =
            typeof requesterCountyFipsRaw === "string" ? requesterCountyFipsRaw.trim() : "";
          if (!countyRecord && requesterCountyFips) {
            countyFips = requesterCountyFips;
            countyRecord = await storage.getCountyByFips(countyFips);
          }

          const requesterCountyIdRaw = (requester as any).countyId || (requester as any).county_id;
          const requesterCountyId =
            typeof requesterCountyIdRaw === "string" ? requesterCountyIdRaw.trim() : "";
          if (!countyRecord && requesterCountyId) {
            const [resolvedById] = await db
              .select()
              .from(counties)
              .where(eq(counties.id, requesterCountyId))
              .limit(1);
            if (resolvedById) {
              countyRecord = resolvedById as any;
              countyFips = String((resolvedById as any).fips || "").trim();
            }
          }

          const requesterStateRaw = (requester as any).stateCode || (requester as any).state_code;
          const requesterState =
            typeof requesterStateRaw === "string" ? requesterStateRaw.trim().toUpperCase() : "";
          if (!stateCode && requesterState.length === 2) {
            stateCode = requesterState;
          }
        }
      }

      if (countyRecord && countyFips) {
        await db
          .update(workRequests)
          .set({
            countyFips,
            stateCode: stateCode || String((countyRecord as any).stateCode || "").toUpperCase(),
            updatedAt: new Date(),
          })
          .where(eq(workRequests.id, requestId));
      }
    }

    // Preserve county-scoped routing invariants unless an explicit bypass mode is active.
    if (!countyRecord && !bypassVerificationGate) {
      return { assignments: [], routed: false };
    }

    let tradeRecord: any = null;
    if (tradeSlug) {
      tradeRecord = await storage.getTradeBySlug(tradeSlug);
      if (!tradeRecord) {
        const [byId] = await db
          .select()
          .from(trades)
          .where(eq(trades.id, String(tradeSlug)));
        tradeRecord = byId || null;
      }
    }

    const filters: any = {
      limit: expandReach ? 15 : 5,
    };
    if (countyRecord?.id) {
      filters.countyId = countyRecord.id;
    }
    if (tradeRecord?.id) {
      filters.tradeIds = [tradeRecord.id];
    }

    let usedExpandedFallback = false;
    let baseContractors = await storage.getContractors(filters);

    // Demo/pilot fallback: if county-constrained routing yields no candidates and
    // bypass mode is active, expand to platform-wide contractor candidates.
    if (!baseContractors.length && bypassVerificationGate) {
      const expandedFilters: any = {
        limit: expandReach ? 15 : 5,
      };
      if (tradeRecord?.id) {
        expandedFilters.tradeIds = [tradeRecord.id];
      }
      baseContractors = await storage.getContractors(expandedFilters);
      usedExpandedFallback = true;
    }

    if (!baseContractors.length) {
      return { assignments: [], routed: false };
    }

    // Compliance gate: only apply if this trade has explicit requirements.
    // Must fail closed when no contractor satisfies required verification.
    let gatedContractors = baseContractors;
    const requirements = tradeRecord?.id
      ? await storage.getTradeRequirementsByTradeId(tradeRecord.id)
      : null;
    if (!expandReach && requirements && !bypassVerificationGate) {
      const requiresLicense = requirements.requiresLicense ?? false;
      const requiresInsurance = requirements.requiresInsurance ?? false;
      const requiresEin = requirements.requiresEin ?? false;
      const hasExplicitRequirements = requiresLicense || requiresInsurance || requiresEin;

      if (hasExplicitRequirements) {
        const userIds = baseContractors
          .map((c: any) => c.userId as string | undefined)
          .filter((id): id is string => Boolean(id));
        const compliance =
          userIds.length > 0 ? await storage.getUserVerificationSummary(userIds) : {};

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

        gatedContractors = baseContractors.filter((c: any) => compliantIds.includes(c.id));
      }
    }

    if (!gatedContractors.length) {
      return { assignments: [], routed: false };
    }

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
        (stats.jobsCompleted ?? 0) * 3 + (stats.peopleHelped ?? 0) * 2 + (stats.activeWeeks ?? 0);

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
      return { assignments: [], routed: false };
    }

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
      if (usedExpandedFallback) {
        reasons.push("Expanded provider reach (demo fallback)");
      } else if (candidate.reachTier === "local") {
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
        tradeMatch: Boolean(tradeRecord),
        recommendationCount: recCount,
        routingMode: usedExpandedFallback ? "expanded_fallback" : "county_localized",
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
        actorUserId: String(actorUserId),
        metadata: {
          contractorId: candidate.id,
          contractorUserId: candidate.userId ?? null,
          source: "direct_connect",
          scoreSnapshot,
        },
      });
    }

    if (!newAssignmentsPayload.length) {
      return { assignments: [], routed: false };
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
            console.error("[direct-connect] Failed to notify contractor for routed request", err);
          }
        })
      );
    } catch (e) {
      console.error("[direct-connect] Failed to send notifications for routed request", e);
    }

    return { assignments: insertedAssignments, routed: true };
  };

  // Requester-facing: route an open Direct Connect request to top contractors
  app.post(
    "/api/direct-connect/requests/:id/route",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const viewer = await storage.getUser(String(userId));
        const bypassContext = resolveDirectConnectVerificationBypass(req, viewer);
        const bypassVerificationGate = bypassContext.active;

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

        await auditDirectConnectBypassUsage({
          req,
          actorUserId: String(userId),
          context: bypassContext,
          operation: "route",
          requestId,
        });

        const routeResult = await routeRequestToTopContractors({
          requestRow,
          actorUserId: String(userId),
          expandReach,
          bypassVerificationGate,
        });

        res.status(200).json(routeResult);
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
    "/api/direct-connect/board",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const viewer = await storage.getUser(String(userId));
        const queryCounty =
          typeof req.query?.countyFips === "string" ? String(req.query.countyFips).trim() : "";
        const countyFips =
          queryCounty ||
          String((viewer as any)?.countyFips || (viewer as any)?.county_fips || "").trim();

        if (!countyFips) {
          return res.json([]);
        }

        const category =
          typeof req.query?.category === "string" ? String(req.query.category).trim() : "";
        const activeStatuses = ["open", "routed", "in_progress"] as const;

        const filters: any[] = [
          eq(workRequests.source, "direct_connect" as any),
          eq(workRequests.countyFips, countyFips),
          inArray(workRequests.status, activeStatuses as any),
        ];

        if (category) {
          filters.push(eq(workRequests.category, category as any));
        }

        const whereClause = filters.length === 1 ? filters[0] : and(...filters);

        let rows: any[] = [];
        try {
          rows = await db
            .select()
            .from(workRequests)
            .where(whereClause)
            .orderBy(desc(workRequests.updatedAt), desc(workRequests.createdAt));
        } catch (error) {
          if (isSchemaMismatchError(error)) {
            console.warn(
              "[direct-connect] work_requests schema mismatch while listing board requests; returning empty list",
              error
            );
            return res.json([]);
          }
          throw error;
        }

        const nowMs = Date.now();
        const maxAgeMs = 60 * 24 * 60 * 60 * 1000; // keep board current (60 days)

        const board = rows
          .filter((row: any) => {
            const visibility = String(row.visibility || "").toLowerCase();
            const scope = String(row.scope || "").toLowerCase();
            if (visibility === "private" || scope === "personal") return false;

            const ts = row.updatedAt || row.createdAt;
            if (!ts) return false;
            const ageMs = nowMs - new Date(ts).getTime();
            if (Number.isFinite(ageMs) && ageMs > maxAgeMs) return false;

            return true;
          })
          .map((row: any) => ({
            ...row,
            attachmentCount: getAttachmentCount(row),
            isMine: String(row.createdByUserId || "") === String(userId),
          }));

        return res.json(board);
      } catch (error: any) {
        console.error("Error fetching direct connect board:", error);
        return res.status(500).json({
          message: "Failed to fetch board requests",
          requestId: (req as any).requestId || null,
        });
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

        const filters: any[] = [
          eq(workRequests.createdByUserId, String(userId)),
          eq(workRequests.source, "direct_connect" as any),
        ];
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
            attachmentCount: getAttachmentCount(r),
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

  app.get(
    "/api/direct-connect/requests/:id/attachments/:index",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const requestId = String(req.params.id || "");
        const attachmentIndex = Number.parseInt(String(req.params.index || ""), 10);
        if (!Number.isInteger(attachmentIndex) || attachmentIndex < 0) {
          return res.status(400).json({ message: "Attachment index is invalid" });
        }

        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId))
          .limit(1);

        if (!requestRow) return res.status(404).json({ message: "Work request not found" });
        if ((requestRow.source as string | null) !== "direct_connect") {
          return res.status(400).json({ message: "Only Direct Connect attachments are available" });
        }

        let hasAccess = String(requestRow.createdByUserId) === String(userId);
        if (!hasAccess) {
          const contractor = await storage.getContractorByUserId(String(userId));
          if (contractor) {
            const [assignment] = await db
              .select()
              .from(workRequestAssignments)
              .where(
                and(
                  eq(workRequestAssignments.workRequestId, requestId),
                  eq(workRequestAssignments.contractorId, contractor.id)
                )
              )
              .limit(1);
            hasAccess = Boolean(assignment);
          }
        }

        if (!hasAccess) {
          return res.status(403).json({ message: "You do not have access to this attachment" });
        }

        const attachments = normalizeAttachmentKeys((requestRow as any).attachments);
        const objectKey = attachments[attachmentIndex];
        if (!objectKey) return res.status(404).json({ message: "Attachment not found" });
        if (!isPrivateAttachmentObjectKey(objectKey)) {
          return res.status(404).json({ message: "Attachment not found" });
        }

        const useR2 = Boolean(process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID);
        const filename = `direct-connect-${requestId}-${attachmentIndex + 1}`;

        if (useR2) {
          try {
            const { R2StorageService } = await import("../localStorage");
            const storageService = new R2StorageService();
            const url = await storageService.getDownloadURL(objectKey, { filename });
            return res.redirect(302, url);
          } catch (err) {
            console.error("[direct-connect] Failed to sign attachment download URL:", err);
            return res.status(500).json({ message: "Failed to download attachment" });
          }
        }

        try {
          const { LocalStorageService } = await import("../localStorage");
          const storageService = new LocalStorageService();
          const filePath = await storageService.getPrivateFilePathFromObjectKey(objectKey);
          if (!filePath) return res.status(404).json({ message: "File not found" });
          return res.download(filePath, filename);
        } catch (err) {
          console.error("[direct-connect] Failed to download private attachment:", err);
          return res.status(500).json({ message: "Failed to download attachment" });
        }
      } catch (error: any) {
        console.error("Error fetching direct connect attachment:", error);
        return res.status(500).json({
          message: "Failed to load attachment",
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

        if (
          requestRow.status !== "open" &&
          requestRow.status !== "in_progress" &&
          requestRow.status !== "routed"
        ) {
          return res
            .status(400)
            .json({ message: "Only open, routed, or in-progress requests can be cancelled" });
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

        const bypassContext = resolveDirectConnectVerificationBypass(req, viewer);
        const canBypassVerification = bypassContext.active;
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

          return res.status(428).json({
            code: "VERIFICATION_REQUIRED",
            message: gateResponse.message,
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
        const attachments = normalizeAttachmentKeys(body.attachments);
        if (bodyCounty) countyFips = bodyCounty;
        if (bodyState) stateCode = bodyState;

        const isDirectToProviders =
          Array.isArray(body.targetContractorIds) && body.targetContractorIds.length > 0;
        const shouldAutoRoute = body.autoRoute !== false && !isDirectToProviders;

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
            status: shouldAutoRoute ? ("routed" as const) : ("open" as const),
            visibility: isDirectToProviders ? "private" : "community",
            exposureMode: "guided",
            competitionMode: "none",
            budgetMin,
            budgetMax,
            attachments,
            tradeId: body.tradeId,
          })
          .returning();

        let createdResponse = created;
        const createdRequestId = created?.id ? String(created.id) : undefined;

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

        await auditDirectConnectBypassUsage({
          req,
          actorUserId: String(userId),
          context: bypassContext,
          operation: "create",
          requestId: createdRequestId,
        });

        // Explicit targeting preserves requester choice; this is not automatic routing.
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

        // Default behavior: submit -> live. Non-targeted requests auto-route on create.
        if (created && shouldAutoRoute) {
          try {
            await routeRequestToTopContractors({
              requestRow: created,
              actorUserId: String(userId),
              expandReach: false,
              bypassVerificationGate: canBypassVerification,
            });
            const [fresh] = await db
              .select()
              .from(workRequests)
              .where(eq(workRequests.id, created.id))
              .limit(1);
            if (fresh) {
              createdResponse = fresh as any;
            }
          } catch (e) {
            console.error("[direct-connect] Failed to auto-route request on create", e);
          }
        }

        res.status(201).json(createdResponse ?? null);
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
        const resolvedAdminCategory: AdminDirectConnectCategory =
          body.category || "service_request";
        const sanitizedTitle = sanitizeWorkRequestText(body.title, 180);
        const sanitizedDescription = sanitizeWorkRequestText(body.description, 5000);
        if (!sanitizedTitle || !sanitizedDescription) {
          return res.status(400).json({
            message: "Please include non-contact project details in title and scope.",
          });
        }
        let targetUser = null as any;
        let targetUserProvisioned = false;
        let targetUserExisted = false;
        let setupEmailSent = false;
        let requestEmailSent = false;
        let setupEmailSkippedReason: string | null = null;
        let requestEmailSkippedReason: string | null = null;
        let setupEmailMessageId: string | undefined;
        let requestEmailMessageId: string | undefined;
        let activationLinkIncluded = false;
        let verifyLinkIncluded = false;
        let activationLink: string | undefined;
        let verifyLink: string | undefined;
        let targetEmailForNotification: string | null = null;
        let targetResolutionSource: "target_user_id" | "target_email" = "target_user_id";
        if (body.targetUserId) {
          targetUser = await storage.getUser(body.targetUserId);
          targetUserExisted = Boolean(targetUser);
          targetResolutionSource = "target_user_id";
          if (targetUser?.email) {
            targetEmailForNotification = String(targetUser.email).trim().toLowerCase();
          }
        } else if (body.targetEmail) {
          const normalizedEmail = body.targetEmail.trim().toLowerCase();
          targetResolutionSource = "target_email";
          targetEmailForNotification = normalizedEmail;
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
          } else {
            targetUserExisted = true;
          }
        }

        if (targetUser && targetEmailForNotification) {
          const publicBase = resolveOrigin(req).replace(/\/$/, "");
          const hasPassword =
            typeof targetUser.password === "string" && targetUser.password.length > 0;
          const isEmailVerified = targetUser.emailVerified === true;
          const shouldSendSetupFlow = !hasPassword || !isEmailVerified;
          const shouldSendActivation = shouldSendSetupFlow && !hasPassword;
          const shouldSendVerification = shouldSendSetupFlow && !isEmailVerified;
          activationLinkIncluded = shouldSendActivation;
          verifyLinkIncluded = shouldSendVerification;
          if (shouldSendActivation) {
            const reset = passwordResetService.createToken(String(targetUser.id));
            activationLink = `${publicBase}/reset-password?token=${reset.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
          }
          if (shouldSendVerification) {
            const verify = emailVerificationService.createToken(String(targetUser.id));
            verifyLink = `${publicBase}/verify-email?token=${verify.token}&next=${encodeURIComponent("/pre-scout-setup")}`;
          }
          const canSendEmail = emailService.isConfigured();
          if (canSendEmail) {
            if (shouldSendSetupFlow) {
              const htmlParts: string[] = [
                "<p>Your TradeScout Direct Connect request is ready.</p>",
                shouldSendActivation
                  ? "<p>Set your password to access your account.</p>"
                  : "<p>Sign in to view and manage your request.</p>",
                shouldSendVerification ? "<p>Verify your email to continue.</p>" : "",
                activationLink ? `<p><a href=\"${activationLink}\">Set password</a>.</p>` : "",
                verifyLink ? `<p><a href=\"${verifyLink}\">Verify your email</a>.</p>` : "",
                "<p>If you did not expect this, you can ignore this email.</p>",
              ];
              const emailResult = await emailService.sendEmail({
                to: targetEmailForNotification,
                subject: "Complete setup to access your Direct Connect request",
                html: htmlParts.join("\n"),
                text: [
                  activationLink ? `Set password: ${activationLink}` : null,
                  verifyLink ? `Verify email: ${verifyLink}` : null,
                ]
                  .filter(Boolean)
                  .join("\n"),
                purpose: "account_verification",
              });
              setupEmailSent = emailResult.skipped !== true;
              setupEmailMessageId = emailResult.messageId;
              setupEmailSkippedReason =
                emailResult.skipped === true ? "suppressed_or_unconfigured" : null;
            } else {
              // User is already verified, just notify them of the new request
              const emailResult = await emailService.sendEmail({
                to: targetEmailForNotification,
                subject: "You have a new TradeScout Direct Connect request",
                html: [
                  "<p>A Direct Connect request was created for your account.</p>",
                  `<p><a href=\"${publicBase}/direct-connect\">Open Direct Connect</a>.</p>`,
                  "<p>If you did not expect this, you can ignore this email.</p>",
                ].join("\n"),
                text: `Open Direct Connect: ${publicBase}/direct-connect`,
                purpose: "notification",
              });
              requestEmailSent = emailResult.skipped !== true;
              requestEmailMessageId = emailResult.messageId;
              requestEmailSkippedReason =
                emailResult.skipped === true ? "suppressed_or_unconfigured" : null;
            }
          } else if (process.env.NODE_ENV !== "production") {
            // In local/dev environments return links for manual testing.
            setupEmailSent = false;
            if (shouldSendSetupFlow) {
              setupEmailSkippedReason = "email_provider_not_configured";
            } else {
              requestEmailSkippedReason = "email_provider_not_configured";
            }
          } else {
            if (shouldSendSetupFlow) {
              setupEmailSkippedReason = "email_provider_not_configured";
            } else {
              requestEmailSkippedReason = "email_provider_not_configured";
            }
          }
        }

        if (!targetUser) {
          return res.status(404).json({ message: "Target user not found" });
        }
        const resolvedTargetUserId = String(targetUser.id);

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

        const resolvedTrade = await resolveOrCreateAdminTrade(body.tradeId);
        const isDirectToProviders =
          Array.isArray(body.targetContractorIds) && body.targetContractorIds.length > 0;
        const shouldAutoRoute = body.autoRoute !== false && !isDirectToProviders;
        const adminBypassContext = resolveDirectConnectVerificationBypass(req, req.user);
        const adminBypassVerification = adminBypassContext.active;

        const [created] = await db
          .insert(workRequests)
          .values({
            createdByUserId: resolvedTargetUserId,
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: resolvedAdminCategory,
            countyFips,
            stateCode,
            scope: "community",
            source: "direct_connect" as any,
            status: shouldAutoRoute ? ("routed" as const) : ("open" as const),
            visibility: "community",
            exposureMode: "guided",
            competitionMode: "none",
            budgetMin,
            budgetMax,
            tradeId: resolvedTrade?.slug,
          })
          .returning();

        let createdResponse = created;
        const createdRequestId = created?.id ? String(created.id) : undefined;

        if (created) {
          try {
            await db.insert(workRequestEvents).values({
              workRequestId: created.id,
              type: "created",
              actorUserId: String(actorUserId),
              metadata: {
                source: "direct_connect_admin",
                createdForUserId: resolvedTargetUserId,
                requesterIntent: "hire_provider",
              },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record admin-created request event", e);
          }

          try {
            await notificationService.createNotification({
              userId: resolvedTargetUserId,
              type: "new_project_request",
              title: "A Direct Connect request was created for you",
              message: `Open Direct Connect to review: ${created.title}`,
              actionUrl: "/direct-connect",
              actionText: "Open Direct Connect",
              iconName: "briefcase",
              iconColor: "orange",
              deliveryMethods: ["in_app"],
            });
          } catch (e) {
            console.error(
              "[direct-connect] Failed to notify target user for admin-created request",
              e
            );
          }

          console.info("[direct-connect] Admin-created request", {
            requestId: created.id,
            targetUserId: resolvedTargetUserId,
            targetEmail: targetEmailForNotification,
            setupEmailSent,
            requestEmailSent,
            targetResolutionSource,
          });

          await logAdminAction({
            action: "admin_direct_connect_target_resolved",
            actorUserId: String(actorUserId),
            targetUserId: resolvedTargetUserId,
            targetEmail: targetEmailForNotification,
            resolutionSource: targetResolutionSource,
            targetUserProvisioned,
            targetUserExisted,
          });
        }

        await auditDirectConnectBypassUsage({
          req,
          actorUserId: String(actorUserId),
          context: adminBypassContext,
          operation: "admin_create",
          requestId: createdRequestId,
        });

        // Staff-directed explicit targeting preserves individual choice for this request.
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
                      createdForUserId: resolvedTargetUserId,
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

        if (created && shouldAutoRoute) {
          try {
            await routeRequestToTopContractors({
              requestRow: created,
              actorUserId: String(actorUserId),
              expandReach: false,
              bypassVerificationGate: adminBypassVerification,
            });
            const [fresh] = await db
              .select()
              .from(workRequests)
              .where(eq(workRequests.id, created.id))
              .limit(1);
            if (fresh) {
              createdResponse = fresh as any;
            }
          } catch (e) {
            console.error("[direct-connect] Failed to auto-route admin-created request", e);
          }
        }

        return res.status(201).json({
          request: createdResponse ?? null,
          requesterIntent: "hire_provider",
          resolvedCategory: resolvedAdminCategory,
          createdForUser: {
            id: String(targetUser.id),
            email: String(targetUser.email || ""),
          },
          targetUserProvisioned,
          targetUserExisted,
          setupEmailSent,
          requestEmailSent,
          setupEmailSkippedReason,
          requestEmailSkippedReason,
          setupEmailMessageId,
          requestEmailMessageId,
          activationLinkIncluded,
          verifyLinkIncluded,
          resolvedTradeId: resolvedTrade?.slug ?? null,
          createdTradeId: resolvedTrade?.created === true,
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

  // Inbox for any user:
  // - Providers see assignments (opportunities to respond)
  // - Requesters see status updates for their own Direct Connect requests
  app.get(
    "/api/direct-connect/inbox",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const inboxItems: any[] = [];
        const contractor = await storage.getContractorByUserId(String(userId));

        if (contractor) {
          const assignments = await db
            .select()
            .from(workRequestAssignments)
            .where(eq(workRequestAssignments.contractorId, contractor.id))
            .orderBy(desc(workRequestAssignments.createdAt));

          if (assignments.length) {
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

            const providerItems = assignments.map((a: any) => ({
              assignment: a,
              request: (() => {
                const requestRow = requestById.get(a.workRequestId) as any;
                if (!requestRow) return null;
                return {
                  id: String(requestRow.id),
                  title: String(requestRow.title || "Direct Connect request"),
                  description: String(requestRow.description || ""),
                  status: String(requestRow.status || "open"),
                  tradeId: requestRow.tradeId ?? null,
                  countyFips: requestRow.countyFips ?? null,
                  createdAt: requestRow.createdAt ?? null,
                  attachmentCount: getAttachmentCount(requestRow),
                };
              })(),
              conversationThreadId: (() => {
                const reqRow = requestById.get(a.workRequestId) as any;
                if (!reqRow?.createdByUserId) return null;
                return conversationByHomeowner.get(String(reqRow.createdByUserId)) || null;
              })(),
            }));
            inboxItems.push(...providerItems);
          }
        }

        const ownRequests = await db
          .select()
          .from(workRequests)
          .where(
            and(
              eq(workRequests.createdByUserId, String(userId)),
              eq(workRequests.source, "direct_connect" as any)
            )
          )
          .orderBy(desc(workRequests.updatedAt), desc(workRequests.createdAt));

        const mapRequesterStatusToInbox = (
          status: string
        ): "suggested" | "accepted" | "declined" => {
          const normalized = String(status || "").toLowerCase();
          if (normalized === "cancelled" || normalized === "closed") return "declined";
          if (
            normalized === "in_progress" ||
            normalized === "accepted" ||
            normalized === "completed"
          ) {
            return "accepted";
          }
          return "suggested";
        };

        const requesterItems = ownRequests.map((requestRow: any) => ({
          assignment: {
            id: `request-${String(requestRow.id)}`,
            workRequestId: String(requestRow.id),
            status: mapRequesterStatusToInbox(String(requestRow.status || "open")),
            scoreSnapshot: null,
            createdAt: requestRow.updatedAt || requestRow.createdAt,
            updatedAt: requestRow.updatedAt || requestRow.createdAt,
          },
          request: {
            id: String(requestRow.id),
            title: String(requestRow.title || "Direct Connect request"),
            description: String(requestRow.description || ""),
            status: String(requestRow.status || "open"),
            tradeId: requestRow.tradeId ?? null,
            countyFips: requestRow.countyFips ?? null,
            createdAt: requestRow.createdAt ?? null,
            attachmentCount: getAttachmentCount(requestRow),
          },
          conversationThreadId: null,
        }));

        inboxItems.push(...requesterItems);

        const dedupedByRequest = new Map<string, any>();
        for (const item of inboxItems) {
          const key = String(item?.assignment?.workRequestId || "");
          const existing = dedupedByRequest.get(key);
          if (!existing) {
            dedupedByRequest.set(key, item);
            continue;
          }
          const existingTs = new Date(
            String(existing?.assignment?.updatedAt || existing?.assignment?.createdAt || 0)
          ).getTime();
          const nextTs = new Date(
            String(item?.assignment?.updatedAt || item?.assignment?.createdAt || 0)
          ).getTime();
          if (Number.isFinite(nextTs) && (!Number.isFinite(existingTs) || nextTs > existingTs)) {
            dedupedByRequest.set(key, item);
          }
        }

        const sorted = Array.from(dedupedByRequest.values()).sort((left: any, right: any) => {
          const leftTs = new Date(
            String(left?.assignment?.updatedAt || left?.assignment?.createdAt || 0)
          ).getTime();
          const rightTs = new Date(
            String(right?.assignment?.updatedAt || right?.assignment?.createdAt || 0)
          ).getTime();
          return rightTs - leftTs;
        });

        res.json(sorted);
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
