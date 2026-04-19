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
  contractorCounties,
  conversations,
  trades,
  counties,
  businesses,
  businessCounties,
  workers,
} from "@shared/schema";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
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
  isDirectConnectBypassProductionLockEnabled,
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
  deniedReason: string | null;
  productionMode: boolean;
  manualRequested: boolean;
  environmentRequested: boolean;
}

function resolveDirectConnectVerificationBypass(
  req: Request,
  viewer: any
): DirectConnectVerificationBypassContext {
  const privileged = resolvePrivilegedVerificationBypass(viewer);
  const manualRequested = hasManualDirectConnectBypassRequest(req);
  const environmentRequested = isDirectConnectUnverifiedBypassEnabled();
  const productionMode = isDirectConnectBypassProductionLockEnabled();
  const isAdminPath = req.path.startsWith("/api/admin/");

  if (manualRequested && !privileged.active) {
    return {
      active: false,
      source: "manual",
      reason: "none",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: "manual_requires_privileged_actor",
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (manualRequested && !isAdminPath) {
    return {
      active: false,
      source: "manual",
      reason: "none",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: "manual_requires_admin_route",
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (manualRequested && productionMode) {
    return {
      active: false,
      source: "manual",
      reason: "none",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: "manual_disabled_in_production",
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (manualRequested && privileged.active) {
    return {
      active: true,
      source: "manual",
      reason: "manual_direct_connect_override",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: null,
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (privileged.active) {
    return {
      active: true,
      source: "privileged",
      reason: privileged.reason,
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: null,
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (environmentRequested && productionMode) {
    return {
      active: false,
      source: "environment",
      reason: "none",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: "environment_disabled_in_production",
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  if (environmentRequested) {
    return {
      active: true,
      source: "environment",
      reason: "direct_connect_demo_mode",
      matchedRoles: privileged.matchedRoles,
      matchedEmail: privileged.matchedEmail,
      deniedReason: null,
      productionMode,
      manualRequested,
      environmentRequested,
    };
  }

  return {
    active: false,
    source: "none",
    reason: "none",
    matchedRoles: privileged.matchedRoles,
    matchedEmail: privileged.matchedEmail,
    deniedReason: null,
    productionMode,
    manualRequested,
    environmentRequested,
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
  const shouldAudit = context.active || Boolean(context.deniedReason);
  if (!shouldAudit) return;

  try {
    await logAdminAction({
      action: context.active
        ? "direct_connect_verification_bypass_applied"
        : "direct_connect_verification_bypass_denied",
      operation,
      actorUserId,
      requestId: requestId ?? null,
      bypassActive: context.active,
      bypassSource: context.source,
      bypassReason: context.reason,
      bypassDeniedReason: context.deniedReason,
      matchedRoles: context.matchedRoles,
      matchedEmail: context.matchedEmail,
      productionMode: context.productionMode,
      manualRequested: context.manualRequested,
      environmentRequested: context.environmentRequested,
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

const assignmentResponseSchema = z
  .object({
    decision: z.enum(["accept", "decline"]),
    // Optional, private decline reason for analytics and routing quality.
    // Never exposed to requesters.
    reason: z.string().min(1).max(200).optional(),
    availabilityWindow: z.string().min(3).max(160).optional(),
    priceBand: z.enum(["budget", "standard", "premium", "custom_quote"]).optional(),
    scopeNote: z.string().min(10).max(400).optional(),
  })
  .refine(
    (payload) => {
      if (payload.decision !== "accept") return true;
      return Boolean(
        payload.availabilityWindow?.trim() && payload.priceBand && payload.scopeNote?.trim()
      );
    },
    {
      message:
        "Accepted replies require availabilityWindow, priceBand, and scopeNote for structured comparison.",
      path: ["availabilityWindow"],
    }
  );

const directConnectRouteRequestSchema = z.object({
  autoRoute: z.boolean().optional(),
  targetContractorIds: z.array(z.string().min(1)).max(25).optional(),
});

function hasExplicitTradeRequirements(requirements: any): boolean {
  if (!requirements) return false;
  return Boolean(
    requirements.requiresLicense || requirements.requiresInsurance || requirements.requiresEin
  );
}

function getMissingTradeRequirements(requirements: any, summary: any): string[] {
  const missing: string[] = [];
  if (!requirements) return missing;
  if (requirements.requiresLicense && !summary?.hasLicense) missing.push("license");
  if (requirements.requiresInsurance && !summary?.hasInsurance) missing.push("insurance");
  if (requirements.requiresEin && !summary?.hasEin) missing.push("ein");
  return missing;
}

async function resolveTradeRecordBySlugOrId(tradeRef: string | null | undefined) {
  const normalized = String(tradeRef || "").trim();
  if (!normalized) return null;
  const bySlug = await storage.getTradeBySlug(normalized);
  if (bySlug) return bySlug;
  const [byId] = await db.select().from(trades).where(eq(trades.id, normalized));
  return byId || null;
}

async function filterEligibleContractorsByTradeRequirements(
  contractorRows: any[],
  tradeRef: string | null | undefined
) {
  const tradeRecord = await resolveTradeRecordBySlugOrId(tradeRef);
  const requirements = tradeRecord?.id
    ? await storage.getTradeRequirementsByTradeId(String(tradeRecord.id))
    : null;

  if (!hasExplicitTradeRequirements(requirements)) {
    return {
      eligible: contractorRows,
      ineligible: [] as Array<{ contractorId: string; missingRequirements: string[] }>,
      requirementsApplied: false,
    };
  }

  const userIds = contractorRows
    .map((contractor: any) => String(contractor.userId || "").trim())
    .filter(Boolean);
  const verificationByUserId =
    userIds.length > 0 ? await storage.getUserVerificationSummary(userIds) : {};

  const eligible: any[] = [];
  const ineligible: Array<{ contractorId: string; missingRequirements: string[] }> = [];

  for (const contractor of contractorRows) {
    const contractorId = String(contractor.id || "").trim();
    const contractorUserId = String(contractor.userId || "").trim();
    const summary = contractorUserId ? verificationByUserId[contractorUserId] : null;
    const missingRequirements = getMissingTradeRequirements(requirements, summary);
    if (missingRequirements.length === 0) {
      eligible.push(contractor);
      continue;
    }
    if (contractorId) {
      ineligible.push({ contractorId, missingRequirements });
    }
  }

  return { eligible, ineligible, requirementsApplied: true };
}

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
  const ACTIVE_BOARD_STATUSES = new Set(["open", "routed", "in_progress"]);
  const ACTIVE_SHARE_STATUSES = new Set(["open", "routed", "in_progress"]);
  const isShareableRequestStatus = (status: unknown) =>
    ACTIVE_SHARE_STATUSES.has(String(status || "").toLowerCase());
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

  const looksLikeHiddenOrTestRequest = (requestRow: unknown): boolean => {
    if (!requestRow || typeof requestRow !== "object") return false;
    const row = requestRow as { title?: unknown; description?: unknown };
    const title = String(row.title || "").toLowerCase();
    const description = String(row.description || "").toLowerCase();
    const body = `${title} ${description}`;

    if (body.includes("[hidden]")) return true;

    const testMarkers = [
      "playwright",
      "smoke test",
      "e2e test",
      "e2e",
      "qa test",
      "test request",
      "integration test",
    ];
    return testMarkers.some((marker) => body.includes(marker));
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

  const ensureShareTokenForRequest = async (
    requestId: string,
    tx: typeof db | any = db
  ): Promise<string | null> => {
    const [requestRow] = await tx
      .select()
      .from(workRequests)
      .where(eq(workRequests.id, requestId))
      .limit(1);
    if (!requestRow) return null;
    if (!isShareableRequestStatus((requestRow as any).status)) return null;

    const existing = String((requestRow as any).shareToken || "").trim();
    if (existing) return existing;

    let shareToken = "";
    let attempts = 0;
    while (!shareToken && attempts < 5) {
      attempts += 1;
      const candidate = makeShareToken();
      try {
        await tx
          .update(workRequests)
          .set({ shareToken: candidate, updatedAt: new Date() })
          .where(eq(workRequests.id, requestId));
        shareToken = candidate;
      } catch {
        // Retry on collision/transient DB errors.
      }
    }

    return shareToken || null;
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
    const requestCategory =
      typeof requestRow.category === "string" ? requestRow.category.trim().toLowerCase() : "";
    // Categories that do NOT require contractor-level license/insurance verification.
    // These are routed to any active business in the county.
    const OPEN_CATEGORIES = new Set(["employment", "odd_job", "helper", "general", "other"]);
    const isOpenCategory = OPEN_CATEGORIES.has(requestCategory);

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

    // Universal business routing: for open-category requests (employment, odd jobs, etc.),
    // also query active businesses in the county. These bypass the contractor compliance gate.
    // For trade-specific requests, businesses are included as supplementary candidates.
    let businessCandidates: Array<{
      id: string; // assignment key — use businessId
      userId: string | null;
      companyName: string;
      positiveRecommendations: number;
      totalRecommendations: number;
      isBusinessProvider: true;
    }> = [];
    if (countyRecord?.id) {
      try {
        const bizRows = await storage.getProvidersByCountyAndCategory({
          countyId: countyRecord.id,
          limit: expandReach ? 15 : 5,
        });
        businessCandidates = bizRows
          .filter((b) => b.ownerUserId) // must have an owner to receive notifications
          .map((b) => ({
            id: b.businessId,
            userId: b.ownerUserId,
            companyName: b.name,
            positiveRecommendations: 0,
            totalRecommendations: 0,
            isBusinessProvider: true as const,
          }));
      } catch (e) {
        console.warn("[direct-connect] Failed to fetch business candidates for routing", e);
      }
    }

    // Worker (helper) routing: for open-category requests, also query available workers in the county.
    let workerCandidates: Array<{
      workerId: string;
      userId: string;
      firstName: string;
      lastName: string;
      skills: string[];
      hourlyRate: string | null;
      isWorkerProvider: true;
    }> = [];
    if (isOpenCategory && countyFips) {
      try {
        const wRows = await storage.getWorkersByCountyAndSkills({
          countyFips,
          limit: expandReach ? 10 : 5,
        });
        workerCandidates = wRows.map((w) => ({
          ...w,
          isWorkerProvider: true as const,
        }));
      } catch (e) {
        console.warn("[direct-connect] Failed to fetch worker candidates for routing", e);
      }
    }

    // For open-category requests with no contractor candidates, fall back to businesses/workers only.
    if (!baseContractors.length && !businessCandidates.length && !workerCandidates.length) {
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

    // For open-category requests, businesses alone are sufficient — don't require contractors.
    if (!gatedContractors.length && !isOpenCategory && !businessCandidates.length) {
      return { assignments: [], routed: false };
    }

    const serviceAreaCounts = gatedContractors.length
      ? await storage.getContractorServiceAreaCounts(gatedContractors.map((c: any) => c.id))
      : {};

    const tierForCount = (count: number | undefined): "local" | "regional" | "wide" => {
      const n = count ?? 0;
      if (n <= 1) return "local";
      if (n <= 5) return "regional";
      return "wide";
    };

    type RankedCandidate = {
      id: string;
      userId?: string | null;
      companyName?: string | null;
      positiveRecommendations?: number | null;
      totalRecommendations?: number | null;
      reachTier: "local" | "regional" | "wide";
      localCredibilityScore: number;
      isBusinessProvider?: boolean;
    };

    const ranked: RankedCandidate[] = [];
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
        isBusinessProvider: false,
      });
    }

    // Merge business candidates (always treated as "local" tier, score from credibility stats).
    // Deduplicate by userId to avoid notifying the same person twice (contractor + business owner).
    const seenUserIds = new Set(ranked.map((r) => r.userId).filter(Boolean));
    for (const biz of businessCandidates) {
      if (biz.userId && seenUserIds.has(biz.userId)) continue;
      const stats = biz.userId
        ? await storage.getUserCredibilityStats(biz.userId)
        : { jobsCompleted: 0, peopleHelped: 0, activeWeeks: 0 };
      const localCredibilityScore =
        (stats.jobsCompleted ?? 0) * 3 + (stats.peopleHelped ?? 0) * 2 + (stats.activeWeeks ?? 0);
      ranked.push({
        id: biz.id,
        userId: biz.userId,
        companyName: biz.companyName,
        positiveRecommendations: 0,
        totalRecommendations: 0,
        reachTier: "local",
        localCredibilityScore,
        isBusinessProvider: true,
      });
      if (biz.userId) seenUserIds.add(biz.userId);
    }

    // Merge worker (helper) candidates — always local tier, dedup by userId.
    for (const worker of workerCandidates) {
      if (seenUserIds.has(worker.userId)) continue;
      const stats = await storage.getUserCredibilityStats(worker.userId).catch(() => ({
        jobsCompleted: 0,
        peopleHelped: 0,
        activeWeeks: 0,
      }));
      const localCredibilityScore =
        (stats.jobsCompleted ?? 0) * 3 + (stats.peopleHelped ?? 0) * 2 + (stats.activeWeeks ?? 0);
      ranked.push({
        id: worker.workerId, // use workerId as the assignment key for workers
        userId: worker.userId,
        companyName: `${worker.firstName} ${worker.lastName}`,
        positiveRecommendations: 0,
        totalRecommendations: 0,
        reachTier: "local",
        localCredibilityScore,
        isWorkerProvider: true,
      } as any);
      seenUserIds.add(worker.userId);
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
    const existingByResponderUser = new Set(
      existingAssignments
        .map((a: any) => a.responderUserId)
        .filter((id: any): id is string => Boolean(id))
    );

    const now = new Date();
    const newAssignmentsPayload: any[] = [];
    const providerSuggestedEvents: any[] = [];

    for (const candidate of topRanked) {
      if (!candidate.id) continue;
      // Skip if already assigned (by contractorId for contractors, by responderUserId for businesses)
      if ((candidate as any).isBusinessProvider) {
        if (candidate.userId && existingByResponderUser.has(candidate.userId)) continue;
      } else {
        if (existingByContractor.has(candidate.id)) continue;
      }

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

      const isBusinessProvider = Boolean((candidate as any).isBusinessProvider);
      const isWorkerProvider = Boolean((candidate as any).isWorkerProvider);
      newAssignmentsPayload.push({
        workRequestId: requestId,
        // For contractor-profile candidates, set contractorId.
        // For business providers, set responderUserId.
        // For worker/helper providers, set both workerId and responderUserId.
        contractorId: isBusinessProvider || isWorkerProvider ? null : candidate.id,
        responderUserId: isBusinessProvider || isWorkerProvider ? (candidate.userId ?? null) : null,
        workerId: isWorkerProvider ? candidate.id : null,
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
          contractorId: isBusinessProvider || isWorkerProvider ? null : candidate.id,
          contractorUserId: candidate.userId ?? null,
          responderUserId:
            isBusinessProvider || isWorkerProvider ? (candidate.userId ?? null) : null,
          workerId: isWorkerProvider ? candidate.id : null,
          providerType: isWorkerProvider
            ? "worker"
            : isBusinessProvider
              ? "business"
              : "contractor",
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
      // Collect all userIds to notify: contractor owners + business owners.
      const notifyUserIds = new Set<string>();
      for (const a of insertedAssignments as any[]) {
        if (a.contractorId) {
          // Resolve contractor -> userId
          const candidate = topRanked.find((c) => c.id === a.contractorId);
          if (candidate?.userId) notifyUserIds.add(candidate.userId);
        }
        if (a.responderUserId) {
          notifyUserIds.add(String(a.responderUserId));
        }
      }

      await Promise.all(
        Array.from(notifyUserIds).map(async (notifyUserId) => {
          try {
            await notificationService.createNotification({
              userId: notifyUserId,
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
            console.error("[direct-connect] Failed to notify provider for routed request", err);
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
        const parse = directConnectRouteRequestSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid route request body", issues: parse.error.flatten() });
        }
        const routeBody = parse.data;
        const requestedTargetIds = Array.from(
          new Set((routeBody.targetContractorIds || []).map((value) => String(value || "").trim()))
        ).filter(Boolean);
        const isDirectToProviders = requestedTargetIds.length > 0;
        const shouldAutoRoute = routeBody.autoRoute !== false && !isDirectToProviders;

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
        if (requestRow.status === "routed" && !expandReach && shouldAutoRoute) {
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

        if (isDirectToProviders) {
          // Resolve contractor IDs (legacy path) and business IDs (universal provider path).
          // IDs from /api/providers/search may be contractor IDs or business IDs; we try both.
          const invitedContractors = await db
            .select()
            .from(contractors)
            .where(inArray(contractors.id, requestedTargetIds));

          const invitedContractorIds = new Set(
            invitedContractors.map((c) => String(c.id || "").trim()).filter(Boolean)
          );

          // Any IDs not resolved as contractors are treated as potential business IDs.
          const potentialBusinessIds = requestedTargetIds.filter(
            (id) => !invitedContractorIds.has(id)
          );
          const invitedBusinesses =
            potentialBusinessIds.length > 0
              ? await db
                  .select()
                  .from(businesses)
                  .where(
                    and(
                      inArray(businesses.id, potentialBusinessIds),
                      eq(businesses.status, "active" as any)
                    )
                  )
              : [];

          if (!invitedContractors.length && !invitedBusinesses.length) {
            return res.status(200).json({ assignments: [], routed: false });
          }

          const eligibility = await filterEligibleContractorsByTradeRequirements(
            invitedContractors,
            requestRow.tradeId ? String(requestRow.tradeId) : null
          );
          const eligibleContractors = eligibility.eligible;

          const existingContractorAssignments =
            eligibleContractors.length > 0
              ? await db
                  .select({ contractorId: workRequestAssignments.contractorId })
                  .from(workRequestAssignments)
                  .where(
                    and(
                      eq(workRequestAssignments.workRequestId, requestId),
                      inArray(
                        workRequestAssignments.contractorId,
                        eligibleContractors
                          .map((contractor) => String(contractor.id || "").trim())
                          .filter(Boolean)
                      )
                    )
                  )
              : [];

          const existingContractorIds = new Set(
            existingContractorAssignments
              .map((assignment) => String(assignment.contractorId || "").trim())
              .filter(Boolean)
          );

          const contractorsToAssign = eligibleContractors.filter(
            (contractor) => !existingContractorIds.has(String(contractor.id || "").trim())
          );

          // For businesses: check existing responderUserId assignments to avoid duplicates.
          const existingBizAssignments =
            invitedBusinesses.length > 0
              ? await db
                  .select({ responderUserId: (workRequestAssignments as any).responderUserId })
                  .from(workRequestAssignments)
                  .where(eq(workRequestAssignments.workRequestId, requestId))
              : [];
          const existingResponderUserIds = new Set(
            existingBizAssignments
              .map((a: any) => String(a.responderUserId || "").trim())
              .filter(Boolean)
          );
          const businessesToAssign = invitedBusinesses.filter(
            (biz) =>
              biz.ownerUserId && !existingResponderUserIds.has(String(biz.ownerUserId || "").trim())
          );

          if (!contractorsToAssign.length && !businessesToAssign.length) {
            return res.status(200).json({
              assignments: [],
              routed: false,
              excludedTargets: eligibility.ineligible,
              routeMode: "owner_direct",
            });
          }

          const now = new Date();
          const contractorAssignmentsPayload = contractorsToAssign.map((contractor) => ({
            workRequestId: requestId,
            contractorId: contractor.id,
            status: "invited" as const,
            createdAt: now,
            updatedAt: now,
          }));
          const businessAssignmentsPayload = businessesToAssign.map((biz) => ({
            workRequestId: requestId,
            contractorId: null as any,
            responderUserId: biz.ownerUserId!,
            status: "invited" as const,
            createdAt: now,
            updatedAt: now,
          }));
          const allAssignmentsPayload = [
            ...contractorAssignmentsPayload,
            ...businessAssignmentsPayload,
          ];
          const assignments = await db
            .insert(workRequestAssignments)
            .values(allAssignmentsPayload)
            .returning();

          await db
            .update(workRequests)
            .set({ status: "routed", updatedAt: now })
            .where(eq(workRequests.id, requestId));

          try {
            const contractorEvents = contractorsToAssign.map((contractor) => ({
              workRequestId: requestId,
              type: "provider_invited" as const,
              actorUserId: String(userId),
              metadata: {
                contractorId: contractor.id,
                contractorUserId: contractor.userId ?? null,
                source: "direct_connect",
                routeMode: "owner_direct",
              },
            }));
            const businessEvents = businessesToAssign.map((biz) => ({
              workRequestId: requestId,
              type: "provider_invited" as const,
              actorUserId: String(userId),
              metadata: {
                businessId: biz.id,
                responderUserId: biz.ownerUserId ?? null,
                source: "direct_connect",
                routeMode: "owner_direct",
              },
            }));
            if (contractorEvents.length || businessEvents.length) {
              await db.insert(workRequestEvents).values([...contractorEvents, ...businessEvents]);
            }
          } catch (error) {
            console.warn("[direct-connect] Failed to record direct provider_invited events", error);
          }

          try {
            const notifyUserIds: string[] = [
              ...(contractorsToAssign.map((c) => c.userId).filter(Boolean) as string[]),
              ...(businessesToAssign.map((b) => b.ownerUserId).filter(Boolean) as string[]),
            ];
            await Promise.all(
              notifyUserIds.map(async (notifyUserId) => {
                await notificationService.createNotification({
                  userId: notifyUserId,
                  type: "new_project_request",
                  title: "New Direct Connect request",
                  message: `You have a new Direct Connect request: ${requestRow.title}`,
                  actionUrl: "/direct-connect/inbox",
                  actionText: "View in Direct Connect",
                  iconName: "briefcase",
                  iconColor: "orange",
                  deliveryMethods: ["in_app", "push"],
                });
              })
            );
          } catch (error) {
            console.error("[direct-connect] Failed to notify directly invited providers", error);
          }

          return res.status(200).json({
            assignments,
            routed: true,
            excludedTargets: eligibility.ineligible,
            routeMode: "owner_direct",
          });
        }

        if (!shouldAutoRoute) {
          return res.status(200).json({ assignments: [], routed: false, routeMode: "manual_hold" });
        }

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
        const viewerCountyFips = String(
          (viewer as any)?.countyFips || (viewer as any)?.county_fips || ""
        ).trim();

        // Build the complete set of counties this user is allowed to operate in.
        // For provider accounts, this is all declared contractor service counties.
        // For non-provider accounts, fallback to the user's primary county.
        const allowedCountyFips = new Set<string>();
        if (viewerCountyFips) {
          allowedCountyFips.add(viewerCountyFips);
        }

        const viewerContractor = await storage.getContractorByUserId(String(userId));
        if (viewerContractor?.id) {
          const providerCountyRows = await db
            .select({ fips: counties.fips })
            .from(contractorCounties)
            .innerJoin(counties, eq(contractorCounties.countyId, counties.id))
            .where(eq(contractorCounties.contractorId, String(viewerContractor.id)));
          for (const row of providerCountyRows) {
            const fips = String((row as any).fips || "").trim();
            if (fips) {
              allowedCountyFips.add(fips);
            }
          }
        }
        // Also include counties from any active business profile owned by this user.
        // This allows any business type (not just licensed contractors) to see the board.
        const viewerBusiness = await storage.getActiveBusinessForUser(String(userId));
        if (viewerBusiness?.id) {
          const businessCountyRows = await db
            .select({ fips: counties.fips })
            .from(businessCounties)
            .innerJoin(counties, eq(businessCounties.countyId, counties.id))
            .where(eq(businessCounties.businessId, String(viewerBusiness.id)));
          for (const row of businessCountyRows) {
            const fips = String((row as any).fips || "").trim();
            if (fips) allowedCountyFips.add(fips);
          }
        }
        if (!allowedCountyFips.size) {
          return res.json([]);
        }

        let effectiveCountyFipsList = Array.from(allowedCountyFips);
        if (queryCounty) {
          if (!allowedCountyFips.has(queryCounty)) {
            return res.json([]);
          }
          effectiveCountyFipsList = [queryCounty];
        }

        const category =
          typeof req.query?.category === "string" ? String(req.query.category).trim() : "";
        const activeStatuses = ["open", "routed", "in_progress"] as const;

        const filters: any[] = [
          eq(workRequests.source, "direct_connect" as any),
          inArray(workRequests.countyFips, effectiveCountyFipsList as any),
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
            const normalizedStatus = String(row.status || "").toLowerCase();
            if (!ACTIVE_BOARD_STATUSES.has(normalizedStatus)) return false;

            const visibility = String(row.visibility || "").toLowerCase();
            const scope = String(row.scope || "").toLowerCase();
            if (visibility === "private" || scope === "personal") return false;
            if (looksLikeHiddenOrTestRequest(row)) return false;

            const ts = row.updatedAt || row.createdAt;
            if (!ts) return false;
            const ageMs = nowMs - new Date(ts).getTime();
            if (Number.isFinite(ageMs) && ageMs > maxAgeMs) return false;

            return true;
          })
          .map((row: any) => ({ ...row }));

        for (const row of board as any[]) {
          const hasToken = String(row.shareToken || "").trim().length > 0;
          if (isShareableRequestStatus(row.status)) {
            if (!hasToken) {
              const token = await ensureShareTokenForRequest(String(row.id));
              if (token) row.shareToken = token;
            }
          } else if (hasToken) {
            await db
              .update(workRequests)
              .set({ shareToken: null, updatedAt: new Date() })
              .where(eq(workRequests.id, String(row.id)));
            row.shareToken = null;
          }
        }

        const viewerContractorUserId = String(viewerContractor?.userId || "").trim();
        const viewerVerificationSummary = viewerContractorUserId
          ? (await storage.getUserVerificationSummary([viewerContractorUserId]))[
              viewerContractorUserId
            ]
          : null;
        const tradeRequirementCache = new Map<string, any>();

        const boardWithMeta = [] as any[];
        for (const row of board) {
          let viewerEligibility: {
            canSelect: boolean;
            hasExplicitRequirements: boolean;
            missingRequirements: string[];
          } | null = null;

          const tradeRef = String((row as any).tradeId || "").trim();
          if (tradeRef) {
            if (!tradeRequirementCache.has(tradeRef)) {
              const tradeRecord = await resolveTradeRecordBySlugOrId(tradeRef);
              const requirements = tradeRecord?.id
                ? await storage.getTradeRequirementsByTradeId(String(tradeRecord.id))
                : null;
              tradeRequirementCache.set(tradeRef, requirements);
            }

            const requirements = tradeRequirementCache.get(tradeRef);
            const explicit = hasExplicitTradeRequirements(requirements);
            const missingRequirements = explicit
              ? getMissingTradeRequirements(requirements, viewerVerificationSummary)
              : [];

            viewerEligibility = {
              canSelect: !explicit || missingRequirements.length === 0,
              hasExplicitRequirements: explicit,
              missingRequirements,
            };
          }

          boardWithMeta.push({
            ...row,
            attachmentCount: getAttachmentCount(row),
            isMine: String(row.createdByUserId || "") === String(userId),
            dcMiniLandingUrl: String(row.shareToken || "").trim()
              ? `${resolveOrigin(req)}/r/${encodeURIComponent(String(row.shareToken))}`
              : null,
            viewerEligibility,
            canSelectForResponse: Boolean(viewerEligibility?.canSelect ?? true),
          });
        }

        return res.json(boardWithMeta);
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

        const viewer = await storage.getUser(String(userId));
        const viewerCountyFips = String(
          (viewer as any)?.countyFips || (viewer as any)?.county_fips || ""
        ).trim();

        const statusRaw = typeof req.query?.status === "string" ? (req.query.status as string) : "";
        const status = statusRaw.trim() as WorkRequest["status"] | "";
        const scopeRaw = typeof req.query?.scope === "string" ? String(req.query.scope) : "";
        const scope = scopeRaw.trim().toLowerCase();
        const localOnly = scope !== "all";
        const queryCountyFips =
          typeof req.query?.countyFips === "string" ? String(req.query.countyFips).trim() : "";
        const effectiveCountyFips = queryCountyFips || viewerCountyFips;

        const filters: any[] = [
          eq(workRequests.createdByUserId, String(userId)),
          eq(workRequests.source, "direct_connect" as any),
        ];
        if (localOnly && effectiveCountyFips) {
          filters.push(eq(workRequests.countyFips, effectiveCountyFips));
        }
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
            .orderBy(desc(workRequests.updatedAt), desc(workRequests.createdAt));
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

        const nowMs = Date.now();
        const maxAgeMs = 120 * 24 * 60 * 60 * 1000; // keep requests current by default (120 days)
        const validStatuses = new Set(["open", "routed", "in_progress", "completed", "cancelled"]);
        const filteredRequests = requests.filter((row: any) => {
          const normalizedStatus = String(row.status || "").toLowerCase();
          if (!validStatuses.has(normalizedStatus)) return false;
          if (normalizedStatus === "draft") return false;
          if (looksLikeHiddenOrTestRequest(row)) return false;

          const ts = row.updatedAt || row.createdAt;
          if (!ts) return false;
          const ageMs = nowMs - new Date(ts).getTime();
          if (Number.isFinite(ageMs) && ageMs > maxAgeMs) return false;
          return true;
        });

        if (!filteredRequests.length) {
          return res.json([]);
        }

        // Keep share token lifecycle strict:
        // - live requests get/keep a token
        // - closed requests lose tokens
        for (const row of filteredRequests as any[]) {
          const hasToken = String(row.shareToken || "").trim().length > 0;
          if (isShareableRequestStatus(row.status)) {
            if (!hasToken) {
              const token = await ensureShareTokenForRequest(String(row.id));
              if (token) row.shareToken = token;
            }
          } else if (hasToken) {
            await db
              .update(workRequests)
              .set({ shareToken: null, updatedAt: new Date() })
              .where(eq(workRequests.id, String(row.id)));
            row.shareToken = null;
          }
        }

        const requestIds = filteredRequests.map((r: any) => r.id);

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

        const enriched = filteredRequests.map((r: any) => {
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
            dcMiniLandingUrl: String((r as any).shareToken || "").trim()
              ? `${resolveOrigin(req)}/r/${encodeURIComponent(String((r as any).shareToken))}`
              : null,
          };
        });

        enriched.sort((a: any, b: any) => {
          const aTs = new Date(a.dcLastEventAt || a.updatedAt || a.createdAt || 0).getTime();
          const bTs = new Date(b.dcLastEventAt || b.updatedAt || b.createdAt || 0).getTime();
          return bTs - aTs;
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

        if (!isShareableRequestStatus((requestRow as any).status)) {
          if (String((requestRow as any).shareToken || "").trim()) {
            await db
              .update(workRequests)
              .set({ shareToken: null, updatedAt: new Date() })
              .where(eq(workRequests.id, requestId));
          }
          return res
            .status(409)
            .json({ message: "This request is closed and no longer shareable." });
        }

        if (String(requestRow.createdByUserId) !== String(userId)) {
          return res.status(403).json({ message: "You can only share your own requests" });
        }

        const shareToken = await ensureShareTokenForRequest(requestId);

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

      if (!isShareableRequestStatus((requestRow as any).status)) {
        await db
          .update(workRequests)
          .set({ shareToken: null, updatedAt: new Date() })
          .where(eq(workRequests.id, String((requestRow as any).id)));
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
            .set({ status: "cancelled", shareToken: null, updatedAt: now })
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

        const shareToken = await ensureShareTokenForRequest(requestId);
        res.status(200).json({
          status: "open",
          shareToken: shareToken || null,
          dcMiniLandingUrl: shareToken
            ? `${resolveOrigin(req)}/r/${encodeURIComponent(String(shareToken))}`
            : null,
        });
      } catch (error: any) {
        console.error("Error reopening direct connect request:", error);
        res
          .status(500)
          .json({ message: "Failed to reopen request", requestId: (req as any).requestId || null });
      }
    }
  );

  // Requester-facing: mark a request as pending outcome
  app.post(
    "/api/direct-connect/requests/:id/mark-pending-outcome",
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
          return res.status(403).json({ message: "You can only update your own requests" });
        }

        if ((requestRow.source as string | null) !== "direct_connect") {
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be updated here" });
        }

        if (requestRow.status !== "in_progress") {
          return res
            .status(400)
            .json({ message: "Only in-progress requests can be marked as pending outcome" });
        }

        const now = new Date();

        await db.transaction(async (tx) => {
          await tx
            .update(workRequests)
            .set({ status: "pending_outcome", updatedAt: now })
            .where(eq(workRequests.id, requestId));

          try {
            await tx.insert(workRequestEvents).values({
              workRequestId: requestId,
              type: "status_changed",
              actorUserId: String(userId),
              fromStatus: "in_progress",
              toStatus: "pending_outcome",
              metadata: { source: "direct_connect", reason: "mark_pending_outcome" },
            });
          } catch (e) {
            console.warn(
              "[direct-connect] Failed to record status_changed event on mark-pending-outcome",
              e
            );
          }
        });

        res.status(200).json({ status: "pending_outcome" });
      } catch (error: any) {
        console.error("Error marking direct connect request as pending outcome:", error);
        res.status(500).json({ message: "Failed to mark request as pending outcome" });
      }
    }
  );

  // Requester-facing: mark a request as complete
  app.post(
    "/api/direct-connect/requests/:id/complete",
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
          return res.status(403).json({ message: "You can only complete your own requests" });
        }

        if ((requestRow.source as string | null) !== "direct_connect") {
          return res
            .status(400)
            .json({ message: "Only Direct Connect requests can be completed here" });
        }

        const allowedStatuses = ["in_progress", "pending_outcome"];
        if (!allowedStatuses.includes(requestRow.status as string)) {
          return res.status(400).json({
            message: "Only in-progress or pending-outcome requests can be marked complete",
          });
        }

        const fromStatus = requestRow.status;
        const now = new Date();

        await db.transaction(async (tx) => {
          await tx
            .update(workRequests)
            .set({ status: "completed", updatedAt: now })
            .where(eq(workRequests.id, requestId));

          try {
            await tx.insert(workRequestEvents).values({
              workRequestId: requestId,
              type: "status_changed",
              actorUserId: String(userId),
              fromStatus: fromStatus as string,
              toStatus: "completed",
              metadata: { source: "direct_connect", reason: "mark_complete" },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record status_changed event on complete", e);
          }
        });

        res.status(200).json({ status: "completed" });
      } catch (error: any) {
        console.error("Error completing direct connect request:", error);
        res.status(500).json({ message: "Failed to complete request" });
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
        if (!canBypassVerification && bypassContext.deniedReason) {
          await auditDirectConnectBypassUsage({
            req,
            actorUserId: String(userId),
            context: bypassContext,
            operation: "create",
          });
        }
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
            // Resolve contractor IDs and business IDs from the universal provider search.
            const invitedContractors = await db
              .select()
              .from(contractors)
              .where(inArray(contractors.id, requestedIds));
            const invitedContractorIds = new Set(
              invitedContractors.map((c) => String(c.id || "").trim()).filter(Boolean)
            );
            const potentialBusinessIds = requestedIds.filter((id) => !invitedContractorIds.has(id));
            const invitedBusinesses =
              potentialBusinessIds.length > 0
                ? await db
                    .select()
                    .from(businesses)
                    .where(
                      and(
                        inArray(businesses.id, potentialBusinessIds),
                        eq(businesses.status, "active" as any)
                      )
                    )
                : [];
            const eligibility = await filterEligibleContractorsByTradeRequirements(
              invitedContractors,
              created.tradeId ? String(created.tradeId) : null
            );
            const eligibleContractors = eligibility.eligible;
            const now = new Date();
            const contractorAssignments = eligibleContractors.map((contractor) => ({
              workRequestId: created.id,
              contractorId: contractor.id,
              status: "invited" as const,
              createdAt: now,
              updatedAt: now,
            }));
            const businessAssignments = invitedBusinesses
              .filter((biz) => biz.ownerUserId)
              .map((biz) => ({
                workRequestId: created.id,
                contractorId: null as any,
                responderUserId: biz.ownerUserId!,
                status: "invited" as const,
                createdAt: now,
                updatedAt: now,
              }));
            const allAssignments = [...contractorAssignments, ...businessAssignments];
            if (allAssignments.length > 0) {
              await db.insert(workRequestAssignments).values(allAssignments);
              await db
                .update(workRequests)
                .set({ status: "routed", updatedAt: now })
                .where(eq(workRequests.id, created.id));
              try {
                const contractorEvents = eligibleContractors.map((contractor) => ({
                  workRequestId: created.id,
                  type: "provider_invited" as const,
                  actorUserId: String(userId),
                  metadata: {
                    contractorId: contractor.id,
                    contractorUserId: contractor.userId ?? null,
                    source: "direct_connect",
                  },
                }));
                const businessEvents = invitedBusinesses
                  .filter((biz) => biz.ownerUserId)
                  .map((biz) => ({
                    workRequestId: created.id,
                    type: "provider_invited" as const,
                    actorUserId: String(userId),
                    metadata: {
                      businessId: biz.id,
                      responderUserId: biz.ownerUserId ?? null,
                      source: "direct_connect",
                    },
                  }));
                if (contractorEvents.length || businessEvents.length) {
                  await db
                    .insert(workRequestEvents)
                    .values([...contractorEvents, ...businessEvents]);
                }
              } catch (e) {
                console.warn("[direct-connect] Failed to record provider_invited events", e);
              }
              try {
                const notifyUserIds: string[] = [
                  ...(eligibleContractors.map((c) => c.userId).filter(Boolean) as string[]),
                  ...(invitedBusinesses.map((b) => b.ownerUserId).filter(Boolean) as string[]),
                ];
                await Promise.all(
                  notifyUserIds.map(async (notifyUserId) => {
                    await notificationService.createNotification({
                      userId: notifyUserId,
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
                console.error("[direct-connect] Failed to notify invited providers", e);
              }
            }
          } catch (e) {
            console.error("[direct-connect] Failed to invite target providers", e);
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

        if (created?.id) {
          const shareToken = await ensureShareTokenForRequest(String(created.id));
          if (shareToken && createdResponse) {
            (createdResponse as any).shareToken = shareToken;
            (createdResponse as any).dcMiniLandingUrl =
              `${resolveOrigin(req)}/r/${encodeURIComponent(String(shareToken))}`;
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
            // Resolve contractor IDs and business IDs from the universal provider search.
            const invitedContractors = await db
              .select()
              .from(contractors)
              .where(inArray(contractors.id, requestedIds));
            const invitedContractorIds = new Set(
              invitedContractors.map((c) => String(c.id || "").trim()).filter(Boolean)
            );
            const potentialBusinessIds = requestedIds.filter((id) => !invitedContractorIds.has(id));
            const invitedBusinesses =
              potentialBusinessIds.length > 0
                ? await db
                    .select()
                    .from(businesses)
                    .where(
                      and(
                        inArray(businesses.id, potentialBusinessIds),
                        eq(businesses.status, "active" as any)
                      )
                    )
                : [];
            const eligibility = await filterEligibleContractorsByTradeRequirements(
              invitedContractors,
              created.tradeId ? String(created.tradeId) : null
            );
            const eligibleContractors = eligibility.eligible;
            const now = new Date();
            const contractorAssignments = eligibleContractors.map((contractor) => ({
              workRequestId: created.id,
              contractorId: contractor.id,
              status: "invited" as const,
              createdAt: now,
              updatedAt: now,
            }));
            const businessAssignments = invitedBusinesses
              .filter((biz) => biz.ownerUserId)
              .map((biz) => ({
                workRequestId: created.id,
                contractorId: null as any,
                responderUserId: biz.ownerUserId!,
                status: "invited" as const,
                createdAt: now,
                updatedAt: now,
              }));
            const allAssignments = [...contractorAssignments, ...businessAssignments];
            if (allAssignments.length > 0) {
              await db.insert(workRequestAssignments).values(allAssignments);
              await db
                .update(workRequests)
                .set({ status: "routed", updatedAt: now })
                .where(eq(workRequests.id, created.id));
              try {
                const contractorEvents = eligibleContractors.map((contractor) => ({
                  workRequestId: created.id,
                  type: "provider_invited" as const,
                  actorUserId: String(actorUserId),
                  metadata: {
                    contractorId: contractor.id,
                    contractorUserId: contractor.userId ?? null,
                    source: "direct_connect_admin",
                    createdForUserId: resolvedTargetUserId,
                  },
                }));
                const businessEvents = invitedBusinesses
                  .filter((biz) => biz.ownerUserId)
                  .map((biz) => ({
                    workRequestId: created.id,
                    type: "provider_invited" as const,
                    actorUserId: String(actorUserId),
                    metadata: {
                      businessId: biz.id,
                      responderUserId: biz.ownerUserId ?? null,
                      source: "direct_connect_admin",
                      createdForUserId: resolvedTargetUserId,
                    },
                  }));
                if (contractorEvents.length || businessEvents.length) {
                  await db
                    .insert(workRequestEvents)
                    .values([...contractorEvents, ...businessEvents]);
                }
              } catch (e) {
                console.warn("[direct-connect] Failed to record provider_invited events", e);
              }
              try {
                const notifyUserIds: string[] = [
                  ...(eligibleContractors.map((c) => c.userId).filter(Boolean) as string[]),
                  ...(invitedBusinesses.map((b) => b.ownerUserId).filter(Boolean) as string[]),
                ];
                await Promise.all(
                  notifyUserIds.map(async (notifyUserId) => {
                    await notificationService.createNotification({
                      userId: notifyUserId,
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
                console.error("[direct-connect] Failed to notify invited providers", e);
              }
            }
          } catch (e) {
            console.error("[direct-connect] Failed to invite target providers", e);
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

        if (created?.id) {
          const shareToken = await ensureShareTokenForRequest(String(created.id));
          if (shareToken && createdResponse) {
            (createdResponse as any).shareToken = shareToken;
            (createdResponse as any).dcMiniLandingUrl =
              `${resolveOrigin(req)}/r/${encodeURIComponent(String(shareToken))}`;
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

        // Helper to build provider inbox items from a set of assignments
        const buildProviderInboxItems = async (assignments: any[]): Promise<any[]> => {
          if (!assignments.length) return [];
          const workRequestIds = assignments.map((a: any) => a.workRequestId);
          const requests = await db
            .select()
            .from(workRequests)
            .where(inArray(workRequests.id, workRequestIds));
          const requestById = new Map(requests.map((r: any) => [r.id, r]));
          return assignments.map((a: any) => ({
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
            conversationThreadId: null,
          }));
        };

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

        // Business provider inbox: fetch assignments routed to this user as a business owner
        // (responderUserId = userId, not covered by contractor lookup above)
        try {
          const bizAssignments = await db
            .select()
            .from(workRequestAssignments)
            .where(eq((workRequestAssignments as any).responderUserId, String(userId)))
            .orderBy(desc(workRequestAssignments.createdAt));
          if (bizAssignments.length) {
            const bizItems = await buildProviderInboxItems(bizAssignments);
            inboxItems.push(...bizItems);
          }
        } catch (e) {
          // responderUserId column may not exist in older DB instances — fail soft
          console.warn("[direct-connect] Failed to fetch business provider inbox items", e);
        }
        // Worker/helper inbox: fetch assignments routed to this user as a worker profile.
        // Workers use responderUserId (same as business providers) but also have a workerId FK.
        // The responderUserId query above already covers these; this block is a no-op guard
        // that ensures worker-specific assignments are not missed if workerId-only rows exist.
        try {
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, String(userId)))
            .limit(1);
          if (workerProfile.length) {
            const workerAssignments = await db
              .select()
              .from(workRequestAssignments)
              .where(
                and(
                  eq((workRequestAssignments as any).workerId, String(workerProfile[0].id)),
                  // Exclude rows already fetched via responderUserId to avoid duplicates
                  eq((workRequestAssignments as any).responderUserId, null as any)
                )
              )
              .orderBy(desc(workRequestAssignments.createdAt));
            if (workerAssignments.length) {
              const workerItems = await buildProviderInboxItems(workerAssignments);
              inboxItems.push(...workerItems);
            }
          }
        } catch (e) {
          console.warn("[direct-connect] Failed to fetch worker inbox items", e);
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
        // Business providers don't need a contractor profile — they respond via responderUserId.
        // We still look up contractor for backward compat with contractor-profile assignments.

        const parse = assignmentResponseSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid request body", issues: parse.error.flatten() });
        }
        const decision = parse.data.decision;
        const declineReason = parse.data.reason;
        const responseSummary =
          decision === "accept"
            ? {
                availabilityWindow: String(parse.data.availabilityWindow || "").trim(),
                priceBand: String(parse.data.priceBand || ""),
                scopeNote: String(parse.data.scopeNote || "").trim(),
              }
            : null;

        const result = await db.transaction(async (tx) => {
          const [assignment] = await tx
            .select()
            .from(workRequestAssignments)
            .where(eq(workRequestAssignments.id, req.params.id));

          // Authorization: the calling user must be the contractor, the responderUserId,
          // or the worker whose workerId is on the assignment.
          const isContractorAssignment = contractor && assignment?.contractorId === contractor.id;
          const isBusinessAssignment =
            assignment && (assignment as any).responderUserId === String(userId);
          // Worker assignment: check if this user owns the worker profile linked to the assignment
          let isWorkerAssignment = false;
          if (!isContractorAssignment && !isBusinessAssignment && assignment?.workerId) {
            const [wp] = await tx
              .select({ id: (workers as any).id })
              .from(workers as any)
              .where(
                and(
                  eq((workers as any).id, String(assignment.workerId)),
                  eq((workers as any).userId, String(userId))
                )
              )
              .limit(1);
            isWorkerAssignment = Boolean(wp);
          }
          if (
            !assignment ||
            (!isContractorAssignment && !isBusinessAssignment && !isWorkerAssignment)
          ) {
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
              // Ensure there is exactly one conversation between requester and provider for this engagement.
              // For contractor-profile providers, use contractor.id;
              // for business/worker providers, use userId as the contractorId key.
              const homeownerId = String(requestRow.createdByUserId);
              const providerContractorId = isContractorAssignment ? contractor!.id : String(userId);

              const existing = await tx
                .select()
                .from(conversations)
                .where(
                  and(
                    eq(conversations.homeownerId, homeownerId),
                    eq(conversations.contractorId, providerContractorId)
                  )
                )
                .orderBy(asc(conversations.createdAt))
                .limit(1);

              let convo = existing[0];
              if (!convo) {
                convo = await storage.createConversation({
                  homeownerId,
                  contractorId: providerContractorId,
                  leadId: null,
                } as any);
              }

              conversationId = String(convo.id);

              // Promote the work request to in_progress once at least one provider accepts
              await tx
                .update(workRequests)
                .set({ status: "in_progress", updatedAt: now })
                .where(eq(workRequests.id, requestRow.id));

              await tx.insert(workRequestEvents).values({
                workRequestId: requestRow.id,
                type: "provider_accepted",
                actorUserId: String(userId),
                metadata: {
                  contractorId: isContractorAssignment ? contractor!.id : null,
                  responderUserId: isBusinessAssignment ? String(userId) : null,
                  conversationId,
                  responseSummary,
                },
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
                  contractorId: isContractorAssignment ? contractor!.id : null,
                  responderUserId: isBusinessAssignment ? String(userId) : null,
                  reason: declineReason || "Unavailable",
                },
              });
            } catch (e) {
              console.error("[direct-connect] Failed to log decline event", e);
            }
          }

          return {
            status: 200 as const,
            body: { assignment: updatedAssignment, conversationId, responseSummary },
          };
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
