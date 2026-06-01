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
  userHomes,
  userHomeRecords,
} from "@shared/schema";
import {
  evaluateContractorEligibility,
  evaluateRoutingReadiness,
  type CanonicalDirectConnectRequest,
} from "@shared/directConnectRoutingSpine";
import { and, asc, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { storage } from "../storage";
import { notificationService } from "../notification-service";
import { emailService } from "../services/emailService";
import { passwordResetService } from "../services/passwordResetService";
import { emailVerificationService } from "../services/emailVerificationService";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";
import { logAdminAction } from "../services/adminAuditLogService";
import { recordTrustLedgerEvent } from "../services/trustLedgerService";
import { computeDirectConnectProviderFitScore } from "../services/directConnectProviderFitScore";
import {
  archiveInternalDirectConnectNotification,
  appendDispatchEvent,
  listInternalDirectConnectNotifications,
  markAllInternalDirectConnectNotificationsRead,
  markInternalDirectConnectNotificationRead,
  createOrGetJobWorkspaceAtContactRelease,
  ensureDirectConnectDispatchLedgerTables,
  getAllowedLifecycleActions,
  getLifecycleStatusForRecipient,
  getJobWorkspaceByRequestId,
  getUnreadLifecycleStatusCount,
  persistFinalizedDispatchRequest,
  recordContractorResponse,
  setDispatchContactGateState,
  snapshotDispatchCandidate,
} from "../services/directConnectDispatchLedgerService";
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

function readCookieValue(req: Request, name: string): string {
  const raw = String((req.headers as any)?.cookie || "");
  if (!raw) return "";
  const parts = raw.split(";").map((part) => part.trim());
  const hit = parts.find((part) => part.startsWith(`${name}=`));
  if (!hit) return "";
  const value = hit.slice(name.length + 1).trim();
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveAnonymousSessionId(req: Request): string {
  const fromHeader = String(req.headers["x-anonymous-session-id"] || "").trim();
  if (fromHeader) return fromHeader;
  const fromQuery = String((req.query as any)?.anonymousSessionId || "").trim();
  if (fromQuery) return fromQuery;
  const cookieCandidates = ["anonymousSessionId", "anonSessionId", "sessionId", "ts_session_id"];
  for (const name of cookieCandidates) {
    const value = readCookieValue(req, name);
    if (value) return value;
  }
  return "";
}

function createId(prefix: string) {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

type TimelinePhase =
  | "request"
  | "response"
  | "contact"
  | "estimate"
  | "acceptance"
  | "payment"
  | "scheduling"
  | "work"
  | "checkpoint"
  | "change_order"
  | "punch_list"
  | "completion"
  | "invoice"
  | "receipt"
  | "trust";

function mapEventTypeToPhase(eventType: string): TimelinePhase {
  if (
    [
      "request_finalized",
      "request_shared",
      "request_route_ready",
      "request_route_blocked",
      "candidate_eligible",
      "candidate_ineligible",
    ].includes(eventType)
  )
    return "request";
  if (["contractor_responded", "contractor_viewed_request"].includes(eventType)) return "response";
  if (
    ["contact_requested", "contact_approved", "contact_denied", "contact_released"].includes(
      eventType
    )
  )
    return "contact";
  if (eventType.startsWith("estimate_"))
    return eventType === "estimate_accepted" ? "acceptance" : "estimate";
  if (
    [
      "deposit_requested",
      "deposit_acknowledged",
      "deposit_paid_outside_platform",
      "deposit_waived",
      "payment_request_canceled",
      "payment_recorded",
    ].includes(eventType)
  )
    return "payment";
  if (
    [
      "schedule_proposed",
      "schedule_accepted",
      "schedule_change_requested",
      "schedule_declined",
      "job_scheduled",
    ].includes(eventType)
  )
    return "scheduling";
  if (eventType === "work_started") return "work";
  if (eventType.startsWith("checkpoint_")) return "checkpoint";
  if (eventType.startsWith("change_order_")) return "change_order";
  if (eventType.startsWith("punch_")) return "punch_list";
  if (
    [
      "completion_requested",
      "completion_confirmed",
      "completion_rejected",
      "job_completed",
    ].includes(eventType)
  )
    return "completion";
  if (eventType.startsWith("invoice_")) return "invoice";
  if (eventType.startsWith("receipt_")) return "receipt";
  return "trust";
}

function timelineCopyForEvent(eventType: string) {
  const normalized = eventType.replace(/_/g, " ");
  const title = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return {
    title,
    description: title,
  };
}

function normalizeEstimateStatus(value: unknown) {
  const status = String(value || "draft").trim();
  if (
    ["draft", "sent", "accepted", "change_requested", "declined", "expired", "void"].includes(
      status
    )
  ) {
    return status;
  }
  return "draft";
}

function buildTrustOutcomeSummary(args: {
  latestCompletionStatus: string | null;
  openPunchItemCount: number;
  openChangeOrderCount: number;
  latestInvoiceStatus: string | null;
  latestReceiptStatus: string | null;
  requestStatus: string | null;
}) {
  const completionConfirmedByRequester = args.latestCompletionStatus === "confirmed";
  const requestCompleted = completionConfirmedByRequester;
  let trustSummaryLabel:
    | "completed_cleanly"
    | "completed_with_records_pending"
    | "completion_disputed"
    | "invoice_disputed"
    | "punch_items_unresolved"
    | "job_closed_without_completion"
    | "in_progress" = "in_progress";

  if (args.latestInvoiceStatus === "disputed") trustSummaryLabel = "invoice_disputed";
  else if (args.latestCompletionStatus === "rejected") trustSummaryLabel = "completion_disputed";
  else if (args.requestStatus === "closed" && !completionConfirmedByRequester)
    trustSummaryLabel = "job_closed_without_completion";
  else if (args.openPunchItemCount > 0) trustSummaryLabel = "punch_items_unresolved";
  else if (completionConfirmedByRequester && (args.latestInvoiceStatus || args.latestReceiptStatus))
    trustSummaryLabel = "completed_with_records_pending";
  else if (completionConfirmedByRequester) trustSummaryLabel = "completed_cleanly";

  return {
    requestCompleted,
    completionConfirmedByRequester,
    unresolvedPunchItemsCount: args.openPunchItemCount,
    openChangeOrdersCount: args.openChangeOrderCount,
    invoiceStatus: args.latestInvoiceStatus,
    receiptStatus: args.latestReceiptStatus,
    reviewEligible: completionConfirmedByRequester,
    disputeFlag:
      args.latestInvoiceStatus === "disputed" || args.latestCompletionStatus === "rejected",
    trustSummaryLabel,
  };
}

function nextActionForRequester(args: {
  contactGateState: string;
  latestEstimateStatus: string | null;
  latestScheduleStatus: string | null;
  latestCompletionStatus: string | null;
  latestInvoiceStatus: string | null;
}) {
  if (args.contactGateState === "contractor_requested") return "approve_or_decline_contact";
  if (args.latestEstimateStatus === "sent") return "review_estimate";
  if (args.latestScheduleStatus === "proposed") return "review_schedule";
  if (args.latestCompletionStatus === "requested") return "review_completion_request";
  if (args.latestInvoiceStatus === "sent") return "review_invoice";
  return "wait_for_business";
}

function nextActionForBusiness(args: {
  contactGateState: string;
  latestEstimateStatus: string | null;
  latestCompletionStatus: string | null;
  latestInvoiceStatus: string | null;
}) {
  if (args.contactGateState === "locked") return "wait_for_contact_approval";
  if (!args.latestEstimateStatus) return "create_estimate";
  if (args.latestEstimateStatus === "change_requested") return "revise_estimate";
  if (args.latestCompletionStatus === "confirmed" && !args.latestInvoiceStatus)
    return "create_invoice";
  if (args.latestInvoiceStatus === "disputed") return "review_invoice_dispute";
  return "continue_workflow";
}

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

async function proposeAccountingAutomationFromDirectConnect(
  tx: any,
  input: {
    workRequestId: string;
    assignmentId: string;
    requesterUserId: string;
    providerUserId: string | null;
    actorUserId: string;
    conversationId: string | null;
    requestTitle: string;
    responseSummary: Record<string, any> | null;
    contractorId: string | null;
    responderUserId: string | null;
  }
) {
  const sourceEventKey = `direct_connect:assignment_accepted:${input.assignmentId}`;
  const metadata = {
    title: input.requestTitle,
    conversationId: input.conversationId,
    contractorId: input.contractorId,
    responderUserId: input.responderUserId,
    responseSummary: input.responseSummary,
    automationBoundary:
      "Draft accounting work only. User review is required before posting, sending invoices, marking paid, or moving money.",
  };

  try {
    await tx.execute(sql`
      INSERT INTO accounting_automation_events (
        profile_id,
        created_by,
        source_surface,
        source_type,
        source_id,
        source_event_key,
        work_request_id,
        assignment_id,
        requester_user_id,
        provider_user_id,
        automation_state,
        reason,
        metadata
      )
      VALUES (
        (SELECT id FROM accounting_profiles WHERE created_by = ${input.requesterUserId} LIMIT 1),
        ${input.actorUserId},
        'direct_connect',
        'assignment_accepted',
        ${input.assignmentId},
        ${sourceEventKey},
        ${input.workRequestId},
        ${input.assignmentId},
        ${input.requesterUserId},
        ${input.providerUserId},
        'proposed',
        'Provider accepted a Direct Connect request; prepare reviewable job accounting.',
        ${JSON.stringify(metadata)}::jsonb
      )
      ON CONFLICT (source_event_key)
      DO UPDATE SET
        automation_state = CASE
          WHEN accounting_automation_events.automation_state IN ('posted', 'skipped')
            THEN accounting_automation_events.automation_state
          ELSE 'proposed'
        END,
        profile_id = COALESCE(
          accounting_automation_events.profile_id,
          (SELECT id FROM accounting_profiles WHERE created_by = ${input.requesterUserId} LIMIT 1)
        ),
        metadata = EXCLUDED.metadata,
        updated_at = now()
    `);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (
      message.includes("accounting_automation_events") ||
      message.includes("accounting_profiles")
    ) {
      console.warn(
        "[direct-connect] accounting automation proposal skipped; books foundation migration missing"
      );
      return;
    }
    throw error;
  }
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
  targetProviderIds: z.array(z.string().min(1)).optional(),
  homeId: z.string().trim().min(1).max(120).optional(),
  assetComponentId: z.string().trim().min(1).max(120).optional(),
  assetComponentType: z
    .enum([
      "roof",
      "hvac",
      "plumbing",
      "electrical",
      "foundation",
      "exterior",
      "interior",
      "appliance",
      "permit_document",
      "other",
    ])
    .optional(),
  assetLabel: z.string().trim().max(180).optional(),
  homeContextIntent: z
    .enum(["link_existing", "create_from_request", "update_from_request", "skip_for_now"])
    .optional(),
  homePacketId: z.string().trim().min(1).max(120).optional(),
  homePacketSelectedDetailIds: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  homePacketReadinessState: z.enum(["ready_for_handoff"]).optional(),
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
  targetProviderIds: z.array(z.string().min(1)).max(25).optional(),
});

async function resolveOwnedHomeForDirectConnect(userId: string, homeId?: string | null) {
  const normalizedHomeId = String(homeId || "").trim();
  if (!normalizedHomeId) return null;
  const [home] = await db
    .select()
    .from(userHomes)
    .where(and(eq(userHomes.id, normalizedHomeId), eq(userHomes.ownerUserId, userId)))
    .limit(1);
  return home || null;
}

const HOMEID_PERSISTENCE_COMPONENTS_TITLE = "homeid:persistence:components";
const HOMEID_PERSISTENCE_EVIDENCE_TITLE = "homeid:persistence:evidence";
const HOMEID_COMPONENT_TYPES = new Set([
  "roof",
  "hvac",
  "plumbing",
  "electrical",
  "foundation",
  "exterior",
  "interior",
  "appliance",
  "water_heater",
  "custom",
]);

type HomeIdComponentStatus = "known" | "needs_review" | "unknown";
type HomeIdComponentSource =
  | "user_added"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";
type HomeIdEvidenceSource =
  | "user_uploaded"
  | "direct_connect_request"
  | "direct_connect_completed_work"
  | "homeid_packet";
type HomeIdEvidenceType =
  | "photo"
  | "document"
  | "receipt"
  | "invoice"
  | "inspection_report"
  | "warranty"
  | "manual"
  | "model_plate"
  | "other";
type HomeIdEvidenceStatus = "pending" | "verified" | "needs_review";

type HomeIdComponentRecord = {
  id: string;
  homeId: string;
  type: string;
  label: string;
  status: HomeIdComponentStatus;
  source: HomeIdComponentSource;
  linkedDirectConnectRequestIds?: string[];
  linkedHomePacketIds?: string[];
  createdAt: string;
  updatedAt: string;
};
type HomeIdEvidenceRecord = {
  id: string;
  homeId: string;
  componentId?: string;
  directConnectRequestId?: string;
  homePacketId?: string;
  selectedDetailIds?: string[];
  evidenceType: HomeIdEvidenceType;
  title: string;
  description?: string;
  source: HomeIdEvidenceSource;
  status: HomeIdEvidenceStatus;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
};

function parseJsonObjectSafe(input: unknown): Record<string, any> | null {
  if (typeof input !== "string") return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

function normalizeHomeIdComponentType(input?: string | null) {
  const value = String(input || "")
    .trim()
    .toLowerCase();
  if (!value) return "";
  if (HOMEID_COMPONENT_TYPES.has(value)) return value;
  return "custom";
}

async function upsertHomeIdComponentFromDirectConnect(params: {
  homeId: string;
  userId: string;
  requestId: string;
  homePacketId?: string | null;
  componentType?: string | null;
  componentLabel?: string | null;
  source: HomeIdComponentSource;
  status: HomeIdComponentStatus;
}) {
  const normalizedType = normalizeHomeIdComponentType(params.componentType);
  const normalizedLabel = String(params.componentLabel || "").trim();
  if (!normalizedType && !normalizedLabel) return null;

  const [existingRecord] = await db
    .select({
      id: userHomeRecords.id,
      details: userHomeRecords.details,
    })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_PERSISTENCE_COMPONENTS_TITLE)
      )
    )
    .limit(1);

  const payload = parseJsonObjectSafe(existingRecord?.details);
  const existingComponents = Array.isArray(payload?.components)
    ? (payload?.components as HomeIdComponentRecord[]) || []
    : [];
  const nowIso = new Date().toISOString();

  const componentIndex = existingComponents.findIndex((component) => {
    const typeMatch =
      normalizedType &&
      String(component.type || "")
        .trim()
        .toLowerCase() === normalizedType;
    const labelMatch =
      normalizedLabel &&
      String(component.label || "")
        .trim()
        .toLowerCase() === normalizedLabel.toLowerCase();
    return typeMatch || labelMatch;
  });

  const existing = componentIndex >= 0 ? existingComponents[componentIndex] : null;
  const linkedRequestIds = new Set<string>(existing?.linkedDirectConnectRequestIds || []);
  linkedRequestIds.add(params.requestId);
  const linkedPacketIds = new Set<string>(existing?.linkedHomePacketIds || []);
  if (params.homePacketId) linkedPacketIds.add(String(params.homePacketId));

  const baseId = existing?.id || `cmp_${randomBytes(8).toString("hex")}`;
  const nextComponent: HomeIdComponentRecord = {
    id: baseId,
    homeId: params.homeId,
    type:
      normalizedType ||
      String(existing?.type || "")
        .trim()
        .toLowerCase() ||
      "custom",
    label: normalizedLabel || String(existing?.label || "").trim() || "Custom component",
    status: params.status,
    source: params.source,
    linkedDirectConnectRequestIds: Array.from(linkedRequestIds).slice(0, 200),
    linkedHomePacketIds: Array.from(linkedPacketIds).slice(0, 200),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
  };

  const nextComponents =
    componentIndex >= 0
      ? existingComponents.map((component, idx) =>
          idx === componentIndex ? nextComponent : component
        )
      : [...existingComponents, nextComponent];
  const nextPayload = {
    components: nextComponents,
    updatedAt: nowIso,
  };

  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details: JSON.stringify(nextPayload), updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_PERSISTENCE_COMPONENTS_TITLE,
      details: JSON.stringify(nextPayload),
      tags: ["homeid", "persistence", "components"],
      updatedAt: new Date(),
    } as any);
  }

  return nextComponent;
}

async function appendHomeIdRequestContextRecord(params: {
  homeId: string;
  userId: string;
  requestId: string;
  title: string;
  description: string;
  requestCategory: string;
  componentType?: string | null;
  componentId?: string | null;
  componentLabel?: string | null;
  homeContextIntent: string;
  homePacketId?: string | null;
  homePacketSelectedDetailIds?: string[] | null;
  homePacketReadinessState?: string | null;
}) {
  await db.insert(userHomeRecords).values({
    homeId: params.homeId,
    createdByUserId: params.userId,
    recordType: "note",
    title: "homeid:direct_connect_request_context",
    details: JSON.stringify({
      source: "direct_connect_request",
      requestId: params.requestId,
      requestCategory: params.requestCategory,
      requestTitle: params.title,
      requestDescription: params.description,
      componentType: params.componentType || null,
      componentId: params.componentId || null,
      componentLabel: params.componentLabel || null,
      status: "needs_review",
      homeContextIntent: params.homeContextIntent,
      homePacketId: params.homePacketId || null,
      homePacketSelectedDetailIds: Array.isArray(params.homePacketSelectedDetailIds)
        ? params.homePacketSelectedDetailIds
        : [],
      homePacketReadinessState: params.homePacketReadinessState || null,
      capturedAt: new Date().toISOString(),
    }),
    tags: ["homeid", "direct_connect", "needs_review"],
    updatedAt: new Date(),
  } as any);

  await upsertHomeIdComponentFromDirectConnect({
    homeId: params.homeId,
    userId: params.userId,
    requestId: params.requestId,
    homePacketId: params.homePacketId || null,
    componentType: params.componentType || null,
    componentLabel: params.componentLabel || null,
    source:
      params.homeContextIntent === "link_existing" ? "homeid_packet" : "direct_connect_request",
    status: "needs_review",
  });
}

async function upsertHomeIdEvidenceFromDirectConnect(params: {
  homeId: string;
  userId: string;
  requestId: string;
  homePacketId?: string | null;
  selectedDetailIds?: string[];
  componentId?: string | null;
  evidenceType: HomeIdEvidenceType;
  title: string;
  description?: string | null;
  source: HomeIdEvidenceSource;
  status: HomeIdEvidenceStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  const [existingRecord] = await db
    .select({
      id: userHomeRecords.id,
      details: userHomeRecords.details,
    })
    .from(userHomeRecords)
    .where(
      and(
        eq(userHomeRecords.homeId, params.homeId),
        eq(userHomeRecords.createdByUserId, params.userId),
        eq(userHomeRecords.title, HOMEID_PERSISTENCE_EVIDENCE_TITLE)
      )
    )
    .limit(1);

  const payload = parseJsonObjectSafe(existingRecord?.details);
  const existingEvidence = Array.isArray(payload?.evidence)
    ? (payload?.evidence as HomeIdEvidenceRecord[]) || []
    : [];
  const nowIso = new Date().toISOString();
  const nextEvidence: HomeIdEvidenceRecord = {
    id: `evd_${randomBytes(8).toString("hex")}`,
    homeId: params.homeId,
    componentId: params.componentId || undefined,
    directConnectRequestId: params.requestId,
    homePacketId: params.homePacketId || undefined,
    selectedDetailIds: (Array.isArray(params.selectedDetailIds) ? params.selectedDetailIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, 200),
    evidenceType: params.evidenceType,
    title: params.title.trim().slice(0, 220),
    description: params.description ? params.description.trim().slice(0, 2000) : undefined,
    source: params.source,
    status: params.status,
    fileUrl: params.fileUrl ? params.fileUrl.trim().slice(0, 1000) : undefined,
    fileName: params.fileName ? params.fileName.trim().slice(0, 260) : undefined,
    mimeType: params.mimeType ? params.mimeType.trim().slice(0, 120) : undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const nextPayload = {
    evidence: [...existingEvidence, nextEvidence].slice(-1200),
    updatedAt: nowIso,
  };
  if (existingRecord?.id) {
    await db
      .update(userHomeRecords)
      .set({ details: JSON.stringify(nextPayload), updatedAt: new Date() } as any)
      .where(eq(userHomeRecords.id, existingRecord.id));
  } else {
    await db.insert(userHomeRecords).values({
      homeId: params.homeId,
      createdByUserId: params.userId,
      recordType: "note",
      title: HOMEID_PERSISTENCE_EVIDENCE_TITLE,
      details: JSON.stringify(nextPayload),
      tags: ["homeid", "persistence", "evidence"],
      updatedAt: new Date(),
    } as any);
  }
}

async function createHomeIdShellFromRequest(params: {
  userId: string;
  title: string;
  requestCategory: string;
  stateCode?: string | null;
  countyFips?: string | null;
}) {
  const nickname = `From Direct Connect: ${params.title}`.slice(0, 120);
  const [createdHome] = await db
    .insert(userHomes)
    .values({
      ownerUserId: params.userId,
      nickname,
      propertyType: "other",
      stateCode: params.stateCode || null,
      countyFips: params.countyFips || null,
      updatedAt: new Date(),
    })
    .returning();

  if (!createdHome) return null;

  await db.insert(userHomeRecords).values({
    homeId: createdHome.id,
    createdByUserId: params.userId,
    recordType: "note",
    title: "homeid:authority",
    details: JSON.stringify({
      subjectId: params.userId,
      role: "owner",
      status: "active",
      source: "direct_connect_request",
      createdAt: new Date().toISOString(),
    }),
    tags: ["homeid", "authority"],
    updatedAt: new Date(),
  } as any);

  await db.insert(userHomeRecords).values({
    homeId: createdHome.id,
    createdByUserId: params.userId,
    recordType: "note",
    title: "homeid:creation",
    details: JSON.stringify({
      source: "direct_connect_request",
      requestCategory: params.requestCategory,
      createdAt: new Date().toISOString(),
    }),
    tags: ["homeid", "creation"],
    updatedAt: new Date(),
  } as any);

  return createdHome;
}

type HomeIdTimelineContext = {
  homeId: string;
  requestOwnerUserId: string;
  homePacketId: string | null;
  selectedDetailIds: string[];
  componentType: string | null;
  componentLabel: string | null;
};

async function resolveHomeIdTimelineContextForRequest(
  requestId: string
): Promise<HomeIdTimelineContext | null> {
  const [requestRow] = await db
    .select()
    .from(workRequests)
    .where(eq(workRequests.id, requestId))
    .limit(1);
  if (!requestRow?.createdByUserId) return null;

  const requestOwnerUserId = String(requestRow.createdByUserId);
  const timelineCandidates = await db
    .select({
      metadata: workRequestEvents.metadata,
      createdAt: workRequestEvents.createdAt,
    })
    .from(workRequestEvents)
    .where(eq(workRequestEvents.workRequestId, requestId))
    .orderBy(desc(workRequestEvents.createdAt))
    .limit(30);

  let homeId: string | null = null;
  let homePacketId: string | null = null;
  let selectedDetailIds: string[] = [];
  let componentType: string | null = null;
  let componentLabel: string | null = null;

  for (const row of timelineCandidates as any[]) {
    const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const assetLink =
      metadata?.assetLink && typeof metadata.assetLink === "object" ? metadata.assetLink : {};

    if (!homeId) {
      const directHomeId = String(metadata?.homeId || "").trim();
      const assetHomeId = String(assetLink?.homeId || "").trim();
      homeId = directHomeId || assetHomeId || null;
    }
    if (!homePacketId) {
      const directPacketId = String(metadata?.homePacketId || "").trim();
      const assetPacketId = String(assetLink?.homePacketId || "").trim();
      homePacketId = directPacketId || assetPacketId || null;
    }
    if (selectedDetailIds.length === 0) {
      const directIds = Array.isArray(metadata?.selectedDetailIds)
        ? metadata.selectedDetailIds
        : [];
      const assetIds = Array.isArray(assetLink?.homePacketSelectedDetailIds)
        ? assetLink.homePacketSelectedDetailIds
        : [];
      const ids = [...directIds, ...assetIds]
        .map((id: unknown) => String(id || "").trim())
        .filter(Boolean)
        .slice(0, 50);
      if (ids.length > 0) selectedDetailIds = ids;
    }
    if (!componentType) {
      componentType = String(assetLink?.assetComponentType || "").trim() || null;
    }
    if (!componentLabel) {
      componentLabel = String(assetLink?.assetLabel || "").trim() || null;
    }
  }

  if (!homeId) return null;
  const ownedHome = await resolveOwnedHomeForDirectConnect(requestOwnerUserId, homeId);
  if (!ownedHome?.id) return null;

  return {
    homeId: String(ownedHome.id),
    requestOwnerUserId,
    homePacketId,
    selectedDetailIds,
    componentType,
    componentLabel,
  };
}

async function appendHomeIdTimelineEventFromDirectConnect(params: {
  requestId: string;
  eventType:
    | "direct_connect_request_submitted"
    | "direct_connect_estimate_sent"
    | "direct_connect_estimate_accepted"
    | "direct_connect_scheduled"
    | "direct_connect_work_started"
    | "direct_connect_change_order_created"
    | "direct_connect_completed"
    | "direct_connect_cancelled";
  title: string;
  summary?: string | null;
  occurredAt?: string;
}) {
  const context = await resolveHomeIdTimelineContextForRequest(params.requestId);
  if (!context) return;

  const nowIso = new Date().toISOString();
  const occurredAt = params.occurredAt || nowIso;
  await db.insert(userHomeRecords).values({
    homeId: context.homeId,
    createdByUserId: context.requestOwnerUserId,
    recordType: "note",
    title: `homeid:timeline:${params.eventType}`,
    details: JSON.stringify({
      homeId: context.homeId,
      directConnectRequestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      componentType: context.componentType || null,
      componentLabel: context.componentLabel || null,
      eventType: params.eventType,
      source: "direct_connect_jobflow",
      title: params.title,
      summary: params.summary || null,
      occurredAt,
      createdAt: nowIso,
    }),
    tags: ["homeid", "timeline", "direct_connect_jobflow", params.eventType],
    occurredAt: new Date(occurredAt),
    updatedAt: new Date(),
  } as any);
}

async function appendHomeIdCompletedWorkEnrichmentFromDirectConnect(params: {
  requestId: string;
  completedAt?: string;
  workSummary?: string | null;
}) {
  const context = await resolveHomeIdTimelineContextForRequest(params.requestId);
  if (!context) return;

  const nowIso = new Date().toISOString();
  const completedAt = params.completedAt || nowIso;
  await db.insert(userHomeRecords).values({
    homeId: context.homeId,
    createdByUserId: context.requestOwnerUserId,
    recordType: "note",
    title: "homeid:completed_work_enrichment",
    details: JSON.stringify({
      source: "direct_connect_completed_work",
      homeId: context.homeId,
      directConnectRequestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      componentType: context.componentType || null,
      componentLabel: context.componentLabel || null,
      completedAt,
      workSummary: params.workSummary || null,
      enrichedAt: nowIso,
    }),
    tags: ["homeid", "completed_work", "direct_connect"],
    occurredAt: new Date(completedAt),
    updatedAt: new Date(),
  } as any);

  await upsertHomeIdComponentFromDirectConnect({
    homeId: context.homeId,
    userId: context.requestOwnerUserId,
    requestId: params.requestId,
    homePacketId: context.homePacketId || null,
    componentType: context.componentType || null,
    componentLabel: context.componentLabel || null,
    source: "direct_connect_completed_work",
    status: "known",
  });

  const [requestRow] = await db
    .select({ attachments: workRequests.attachments })
    .from(workRequests)
    .where(eq(workRequests.id, params.requestId))
    .limit(1);
  const rawAttachments = (requestRow as any)?.attachments;
  const attachmentKeys = Array.isArray(rawAttachments)
    ? rawAttachments
        .map((value: unknown) => String(value || "").trim())
        .filter((value: string) => value.length >= 10)
        .slice(0, 8)
    : [];
  if (attachmentKeys.length > 0) {
    await upsertHomeIdEvidenceFromDirectConnect({
      homeId: context.homeId,
      userId: context.requestOwnerUserId,
      requestId: params.requestId,
      homePacketId: context.homePacketId || null,
      selectedDetailIds: context.selectedDetailIds,
      evidenceType: "document",
      title: "Direct Connect completed-work attachment",
      description: "Captured from completed Direct Connect request attachment reference.",
      source: "direct_connect_completed_work",
      status: "needs_review",
      fileUrl: attachmentKeys[0],
      fileName: `direct-connect-${params.requestId}-attachment-1`,
    });
  }
}

const contractorConsoleResponseSchema = z.object({
  responseType: z.enum(["interested", "need_more_info", "not_a_fit", "unavailable"]),
  message: z.string().max(600).optional(),
  availability: z.string().max(160).optional(),
  estimatedTiming: z.string().max(160).optional(),
});

const estimateCreateSchema = z.object({
  title: z.string().min(3).max(160),
  scopeSummary: z.string().min(10).max(2000),
  terms: z.string().max(2000).optional(),
  expirationDate: z.string().datetime().optional(),
  subtotalOther: z.number().min(0).max(100000000).optional(),
});

const estimateUpdateSchema = estimateCreateSchema.partial().extend({
  status: z.enum(["draft", "change_requested", "void"]).optional(),
});

const estimateSendSchema = z.object({
  note: z.string().max(500).optional(),
});

const estimateRespondSchema = z.object({
  decision: z.enum(["accept", "request_changes", "decline"]),
  note: z.string().max(1200).optional(),
});

const estimateLineItemSchema = z.object({
  lineType: z.enum(["material", "labor", "permits", "disposal", "travel", "equipment", "other"]),
  name: z.string().min(2).max(160),
  description: z.string().max(1200).optional(),
  quantity: z.number().positive().max(1000000),
  unit: z.string().min(1).max(40),
  unitCost: z.number().min(0).max(100000000).optional(),
  rate: z.number().min(0).max(100000000).optional(),
  supplier: z.string().max(160).optional(),
  sku: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
});

const paymentRequestCreateSchema = z.object({
  estimateId: z.string().min(1),
  type: z.enum(["deposit", "prepayment", "milestone", "final", "other"]),
  amount: z.number().positive().max(100000000),
  description: z.string().min(3).max(1200),
  dueDate: z.string().datetime().optional(),
  note: z.string().max(1200).optional(),
});

const paymentRequestRespondSchema = z.object({
  decision: z.enum(["acknowledge", "paid_outside_platform", "waive", "decline"]),
  note: z.string().max(1200).optional(),
});

const scheduleProposalCreateSchema = z.object({
  estimateId: z.string().min(1).optional(),
  proposedStart: z.string().datetime(),
  proposedEnd: z.string().datetime().optional(),
  timeWindow: z.string().max(160).optional(),
  notes: z.string().max(1200).optional(),
});

const scheduleProposalRespondSchema = z.object({
  decision: z.enum(["accept", "request_changes", "decline"]),
  note: z.string().max(1200).optional(),
});

const checkpointCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1600).optional(),
  dueDate: z.string().datetime().optional(),
  status: z
    .enum(["planned", "in_progress", "completed", "requester_review", "approved", "issue_reported"])
    .optional(),
});

const checkpointUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(1600).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z
    .enum([
      "planned",
      "in_progress",
      "completed",
      "requester_review",
      "approved",
      "issue_reported",
      "canceled",
    ])
    .optional(),
});

const checkpointRespondSchema = z.object({
  decision: z.enum(["approve", "report_issue"]),
  note: z.string().max(1200).optional(),
});

const changeOrderCreateSchema = z.object({
  title: z.string().min(2).max(160),
  reason: z.string().max(1200).optional(),
  scopeChangeSummary: z.string().min(5).max(2000),
  materialDelta: z.number().min(0).max(100000000).optional(),
  laborDelta: z.number().min(0).max(100000000).optional(),
  otherDelta: z.number().min(0).max(100000000).optional(),
  timelineDeltaDays: z.number().int().min(0).max(3650).optional(),
  note: z.string().max(1200).optional(),
});

const changeOrderRespondSchema = z.object({
  decision: z.enum(["approve", "decline", "request_changes"]),
  note: z.string().max(1200).optional(),
});

const punchItemCreateSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(1600).optional(),
  assignedTo: z.string().max(120).optional(),
  dueDate: z.string().datetime().optional(),
});

const punchItemUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(1600).optional(),
  assignedTo: z.string().max(120).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z
    .enum(["acknowledged", "in_progress", "resolved", "rejected", "waived", "canceled"])
    .optional(),
});

const punchItemRespondSchema = z.object({
  decision: z.enum(["approve_resolved", "reject_resolved", "waive_item"]),
  note: z.string().max(1200).optional(),
});

const completionRequestCreateSchema = z.object({
  businessNotes: z.string().max(2000).optional(),
});

const completionRequestRespondSchema = z.object({
  decision: z.enum(["confirm", "reject"]),
  requesterNotes: z.string().max(2000).optional(),
});

const invoiceCreateSchema = z.object({
  estimateId: z.string().min(1).optional(),
  title: z.string().min(2).max(160),
  summary: z.string().min(3).max(2000),
  adjustments: z.number().min(-100000000).max(100000000).optional(),
  dueDate: z.string().datetime().optional(),
  terms: z.string().max(2000).optional(),
});

const invoiceLineItemSchema = z.object({
  type: z.enum(["material", "labor", "change_order", "fee", "discount", "other"]),
  name: z.string().min(2).max(160),
  description: z.string().max(1600).optional(),
  quantity: z.number().min(0).max(1000000),
  unit: z.string().max(40).optional(),
  unitAmount: z.number().min(-100000000).max(100000000),
  sourceEstimateLineItemId: z.string().max(120).optional(),
  sourceChangeOrderId: z.string().max(120).optional(),
  notes: z.string().max(1200).optional(),
});

const invoiceUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  summary: z.string().min(3).max(2000).optional(),
  adjustments: z.number().min(-100000000).max(100000000).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  terms: z.string().max(2000).nullable().optional(),
  status: z.enum(["draft", "void"]).optional(),
  lineItems: z.array(invoiceLineItemSchema).optional(),
});

const invoiceSendSchema = z.object({
  note: z.string().max(1200).optional(),
});

const invoiceRespondSchema = z.object({
  decision: z.enum(["acknowledge", "dispute", "mark_paid_outside_platform"]),
  note: z.string().max(1200).optional(),
});

const receiptCreateSchema = z.object({
  invoiceId: z.string().min(1).optional(),
  type: z.enum(["receipt", "payment_record", "refund_record", "credit_record"]),
  paymentMethod: z.enum(["outside_platform", "cash", "check", "card", "bank_transfer", "other"]),
  amount: z.number().min(0).max(100000000),
  status: z.enum(["recorded", "disputed", "void"]).optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

function resolveTargetProviderIds(body: {
  targetContractorIds?: string[];
  targetProviderIds?: string[];
}) {
  const raw =
    Array.isArray(body.targetProviderIds) && body.targetProviderIds.length > 0
      ? body.targetProviderIds
      : Array.isArray(body.targetContractorIds)
        ? body.targetContractorIds
        : [];
  return Array.from(new Set(raw.map((value) => String(value || "").trim()).filter(Boolean)));
}

function hasExplicitTradeRequirements(requirements: any): boolean {
  if (!requirements) return false;
  return Boolean(
    requirements.requiresLicense || requirements.requiresInsurance || requirements.requiresEin
  );
}

function isOpenDirectConnectCategory(category: unknown): boolean {
  const requestCategory = typeof category === "string" ? category.trim().toLowerCase() : "";
  return new Set(["employment", "odd_job", "helper", "general", "other"]).has(requestCategory);
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

async function resolveRequestCountyRecord(requestRow: any) {
  const countyFips = typeof requestRow?.countyFips === "string" ? requestRow.countyFips.trim() : "";
  if (!countyFips) return null;
  return await storage.getCountyByFips(countyFips);
}

async function filterContractorsEligibleForRequest(contractorRows: any[], requestRow: any) {
  const countyRecord = await resolveRequestCountyRecord(requestRow);
  if (!countyRecord?.id) {
    return {
      eligible: [] as any[],
      ineligible: contractorRows
        .map((contractor: any) => String(contractor.id || "").trim())
        .filter(Boolean)
        .map((contractorId) => ({ contractorId, reason: "missing_request_county" })),
      tradeEligibility: {
        eligible: [] as any[],
        ineligible: [] as Array<{ contractorId: string; missingRequirements: string[] }>,
        requirementsApplied: false,
      },
    };
  }

  const contractorIds = contractorRows
    .map((contractor: any) => String(contractor.id || "").trim())
    .filter(Boolean);
  const serviceRows = contractorIds.length
    ? await db
        .select({ contractorId: contractorCounties.contractorId })
        .from(contractorCounties)
        .where(
          and(
            inArray(contractorCounties.contractorId, contractorIds),
            eq(contractorCounties.countyId, String(countyRecord.id))
          )
        )
    : [];
  const servesCountyIds = new Set(serviceRows.map((row) => String(row.contractorId)));
  const countyEligible = contractorRows.filter((contractor: any) =>
    servesCountyIds.has(String(contractor.id || "").trim())
  );
  const countyIneligible = contractorRows
    .filter((contractor: any) => !servesCountyIds.has(String(contractor.id || "").trim()))
    .map((contractor: any) => String(contractor.id || "").trim())
    .filter(Boolean)
    .map((contractorId) => ({ contractorId, reason: "outside_request_county" }));

  const tradeEligibility = await filterEligibleContractorsByTradeRequirements(
    countyEligible,
    requestRow?.tradeId ? String(requestRow.tradeId) : null
  );

  return {
    eligible: tradeEligibility.eligible,
    ineligible: countyIneligible,
    tradeEligibility,
  };
}

async function filterBusinessesEligibleForRequest(businessRows: any[], requestRow: any) {
  const countyRecord = await resolveRequestCountyRecord(requestRow);
  const tradeRecord = await resolveTradeRecordBySlugOrId(
    requestRow?.tradeId ? String(requestRow.tradeId) : null
  );
  const requirements = tradeRecord?.id
    ? await storage.getTradeRequirementsByTradeId(String(tradeRecord.id))
    : null;
  if (
    hasExplicitTradeRequirements(requirements) &&
    !isOpenDirectConnectCategory(requestRow?.category)
  ) {
    return {
      eligible: [] as any[],
      ineligible: businessRows
        .map((business: any) => String(business.id || "").trim())
        .filter(Boolean)
        .map((businessId) => ({ businessId, reason: "regulated_trade_requires_contractor" })),
    };
  }

  if (!countyRecord?.id) {
    return {
      eligible: [] as any[],
      ineligible: businessRows
        .map((business: any) => String(business.id || "").trim())
        .filter(Boolean)
        .map((businessId) => ({ businessId, reason: "missing_request_county" })),
    };
  }

  const businessIds = businessRows
    .map((business: any) => String(business.id || "").trim())
    .filter(Boolean);
  const countyRows = businessIds.length
    ? await db
        .select({ businessId: businessCounties.businessId })
        .from(businessCounties)
        .where(
          and(
            inArray(businessCounties.businessId, businessIds),
            eq(businessCounties.countyId, String(countyRecord.id))
          )
        )
    : [];
  const servesCountyIds = new Set(countyRows.map((row) => String(row.businessId)));
  return {
    eligible: businessRows.filter((business: any) =>
      servesCountyIds.has(String(business.id || "").trim())
    ),
    ineligible: businessRows
      .filter((business: any) => !servesCountyIds.has(String(business.id || "").trim()))
      .map((business: any) => String(business.id || "").trim())
      .filter(Boolean)
      .map((businessId) => ({ businessId, reason: "outside_request_county" })),
  };
}

async function canResponderUserAccessRequest(userId: string, requestRow: any): Promise<boolean> {
  const requestId = String(requestRow?.id || "");
  if (!requestId || String(requestRow?.createdByUserId) === String(userId)) return true;

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
    if (assignment) return true;
  }

  const [responderAssignment] = await db
    .select()
    .from(workRequestAssignments)
    .where(
      and(
        eq(workRequestAssignments.workRequestId, requestId),
        eq((workRequestAssignments as any).responderUserId, String(userId))
      )
    )
    .limit(1);

  return Boolean(responderAssignment);
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
  void ensureDirectConnectDispatchLedgerTables().catch((error) => {
    console.warn("[direct-connect] Failed to ensure dispatch ledger tables", error);
  });
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
    const isOpenCategory = isOpenDirectConnectCategory(requestRow.category);

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
    // Must fail closed when no provider satisfies required verification.
    let gatedContractors = baseContractors;
    const requirements = tradeRecord?.id
      ? await storage.getTradeRequirementsByTradeId(tradeRecord.id)
      : null;
    const hasExplicitRequirements = hasExplicitTradeRequirements(requirements);
    if (!expandReach && requirements && hasExplicitRequirements && !bypassVerificationGate) {
      const requiresLicense = requirements.requiresLicense ?? false;
      const requiresInsurance = requirements.requiresInsurance ?? false;
      const requiresEin = requirements.requiresEin ?? false;
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

    if (hasExplicitRequirements && !bypassVerificationGate && !isOpenCategory) {
      businessCandidates = [];
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
      providerFitScore: number;
      providerFitBreakdown: Record<string, unknown>;
      fitReasons: string[];
      isBusinessProvider?: boolean;
    };

    const ranked: RankedCandidate[] = [];
    for (const contractor of gatedContractors) {
      const stats = contractor.userId
        ? await storage.getUserCredibilityStats(contractor.userId)
        : { jobsCompleted: 0, peopleHelped: 0, activeWeeks: 0 };

      const countyCount = serviceAreaCounts[contractor.id] ?? 0;
      const reachTier = tierForCount(countyCount);

      const recSignal = Math.max(
        0,
        Math.min(1, (Number(contractor.positiveRecommendations ?? 0) || 0) / 25)
      );
      const completionSignal = Math.max(
        0,
        Math.min(1, (Number(stats.jobsCompleted ?? 0) || 0) / 25)
      );
      const activitySignal = Math.max(0, Math.min(1, (Number(stats.activeWeeks ?? 0) || 0) / 52));
      const fit = computeDirectConnectProviderFitScore({
        countyMatch: Boolean(countyRecord?.id),
        tradeMatch: Boolean(tradeRecord?.id),
        verificationScore: requirements ? 0.8 : 0.6,
        responseRate: 0.6,
        completionRate: completionSignal,
        recentActivity: activitySignal,
        recommendationTrust: recSignal,
        disputePenalty: 0,
        overCapacityPenalty: reachTier === "wide" ? 0.2 : 0,
      });

      ranked.push({
        id: contractor.id,
        userId: contractor.userId,
        companyName: contractor.companyName,
        positiveRecommendations:
          contractor.positiveRecommendations ?? contractor.totalRecommendations ?? 0,
        totalRecommendations:
          contractor.totalRecommendations ?? contractor.positiveRecommendations ?? 0,
        reachTier,
        providerFitScore: fit.score,
        providerFitBreakdown: fit.breakdown as any,
        fitReasons: fit.reasons,
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
      const completionSignal = Math.max(
        0,
        Math.min(1, (Number(stats.jobsCompleted ?? 0) || 0) / 25)
      );
      const activitySignal = Math.max(0, Math.min(1, (Number(stats.activeWeeks ?? 0) || 0) / 52));
      const fit = computeDirectConnectProviderFitScore({
        countyMatch: Boolean(countyRecord?.id),
        tradeMatch: Boolean(tradeRecord?.id),
        verificationScore: 0.65,
        responseRate: 0.55,
        completionRate: completionSignal,
        recentActivity: activitySignal,
        recommendationTrust: 0.45,
        disputePenalty: 0,
        overCapacityPenalty: 0,
      });
      ranked.push({
        id: biz.id,
        userId: biz.userId,
        companyName: biz.companyName,
        positiveRecommendations: 0,
        totalRecommendations: 0,
        reachTier: "local",
        providerFitScore: fit.score,
        providerFitBreakdown: fit.breakdown as any,
        fitReasons: fit.reasons,
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
      const completionSignal = Math.max(
        0,
        Math.min(1, (Number(stats.jobsCompleted ?? 0) || 0) / 25)
      );
      const activitySignal = Math.max(0, Math.min(1, (Number(stats.activeWeeks ?? 0) || 0) / 52));
      const fit = computeDirectConnectProviderFitScore({
        countyMatch: true,
        tradeMatch: Boolean(tradeRecord?.id),
        verificationScore: 0.55,
        responseRate: 0.5,
        completionRate: completionSignal,
        recentActivity: activitySignal,
        recommendationTrust: 0.4,
        disputePenalty: 0,
        overCapacityPenalty: 0,
      });
      ranked.push({
        id: worker.workerId, // use workerId as the assignment key for workers
        userId: worker.userId,
        companyName: `${worker.firstName} ${worker.lastName}`,
        positiveRecommendations: 0,
        totalRecommendations: 0,
        reachTier: "local",
        providerFitScore: fit.score,
        providerFitBreakdown: fit.breakdown as any,
        fitReasons: fit.reasons,
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
      const aScore = a.providerFitScore ?? 0;
      const bScore = b.providerFitScore ?? 0;
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
    const existingByWorker = new Set(
      existingAssignments.map((a: any) => a.workerId).filter((id: any): id is string => Boolean(id))
    );

    const now = new Date();
    const newAssignmentsPayload: any[] = [];
    const providerSuggestedEvents: any[] = [];

    for (const candidate of topRanked) {
      if (!candidate.id) continue;
      // Skip if already assigned (by contractorId for contractors, by responderUserId for businesses/workers, by workerId for workers)
      if ((candidate as any).isWorkerProvider) {
        if (existingByWorker.has(candidate.id)) continue;
        if (candidate.userId && existingByResponderUser.has(candidate.userId)) continue;
      } else if ((candidate as any).isBusinessProvider) {
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
        score: candidate.providerFitScore,
        providerFitScore: candidate.providerFitScore,
        providerFitBreakdown: candidate.providerFitBreakdown,
        reasons,
        fitReasons: candidate.fitReasons,
        tradeMatch: Boolean(tradeRecord),
        recommendationCount: recCount,
        routingMode: usedExpandedFallback ? "expanded_fallback" : "county_localized",
      };
      await snapshotDispatchCandidate({
        requestId,
        businessId: (candidate as any).isBusinessProvider ? candidate.id : null,
        contractorId:
          (candidate as any).isBusinessProvider || (candidate as any).isWorkerProvider
            ? null
            : candidate.id,
        responderUserId:
          (candidate as any).isBusinessProvider || (candidate as any).isWorkerProvider
            ? (candidate.userId ?? null)
            : null,
        workerId: (candidate as any).isWorkerProvider ? candidate.id : null,
        eligibility: { status: "eligible", eligible: true },
        eligibilityReasons: ["route_ready_eligible_pool"],
        territoryMatched: true,
        categoryMatched: true,
        verificationState: "eligible",
        profileReadiness: "ready",
        contactEligibility: true,
        trustState: "eligible",
      });
      await appendDispatchEvent({
        requestId,
        actorType: "system",
        actorId: null,
        eventType: "candidate_eligible",
        metadata: {
          candidateId: candidate.id,
          providerType: (candidate as any).isWorkerProvider
            ? "worker"
            : (candidate as any).isBusinessProvider
              ? "business"
              : "contractor",
          scoreSnapshot,
        },
      });

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

    try {
      await recordTrustLedgerEvent({
        actorUserId,
        entityType: "work_request",
        entityId: requestId,
        eventType: "direct_connect_routed",
        sourceSurface: "direct_connect",
        verificationLevel: "system_verified",
        confidence: 0.82,
        metadata: {
          assignmentCount: insertedAssignments.length,
          routingMode: usedExpandedFallback ? "expanded_fallback" : "county_localized",
          countyFips: countyFips || null,
          tradeId: tradeRecord?.id || null,
        },
      });
    } catch (e) {
      console.warn("[direct-connect] Failed to write trust ledger routed event", e);
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
        const requestedTargetIds = resolveTargetProviderIds(routeBody);
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
          // IDs from /api/business-providers/search may be contractor IDs or business IDs; we try both.
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

          const contractorEligibility = await filterContractorsEligibleForRequest(
            invitedContractors,
            requestRow
          );
          const eligibleContractors = contractorEligibility.eligible;
          const businessEligibility = await filterBusinessesEligibleForRequest(
            invitedBusinesses,
            requestRow
          );
          const eligibleBusinesses = businessEligibility.eligible;

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
            eligibleBusinesses.length > 0
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
          const businessesToAssign = eligibleBusinesses.filter(
            (biz) =>
              biz.ownerUserId && !existingResponderUserIds.has(String(biz.ownerUserId || "").trim())
          );

          if (!contractorsToAssign.length && !businessesToAssign.length) {
            return res.status(200).json({
              assignments: [],
              routed: false,
              excludedTargets: [
                ...contractorEligibility.ineligible,
                ...contractorEligibility.tradeEligibility.ineligible,
                ...businessEligibility.ineligible,
              ],
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
            excludedTargets: [
              ...contractorEligibility.ineligible,
              ...contractorEligibility.tradeEligibility.ineligible,
              ...businessEligibility.ineligible,
            ],
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
        // Contract anchor (board conversation merge): acceptedResponderUserIds + allProviderKeys
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

  app.get(
    "/api/direct-connect/notifications",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const roleRaw = String((req.query as any)?.role || "requester")
          .trim()
          .toLowerCase();
        const recipientRole = roleRaw === "business" ? "business" : "requester";
        const statusRaw = String((req.query as any)?.status || "all")
          .trim()
          .toLowerCase();
        const status =
          statusRaw === "unread" ||
          statusRaw === "read" ||
          statusRaw === "archived" ||
          statusRaw === "dismissed"
            ? statusRaw
            : "all";
        const limitRaw = Number((req.query as any)?.limit || 50);
        const notifications = await listInternalDirectConnectNotifications({
          recipientRole,
          recipientUserId: userId,
          status: status as any,
          limit: Number.isFinite(limitRaw) ? limitRaw : 50,
        });
        const unreadDirectConnectNotificationCount = notifications.filter(
          (item: any) => String(item?.status || "") === "unread"
        ).length;
        return res.json({
          notifications,
          unreadDirectConnectNotificationCount,
          latestNotification: notifications[0] || null,
          pendingActionKey: notifications.find((item: any) => String(item?.status) === "unread")
            ?.action_key
            ? String(
                notifications.find((item: any) => String(item?.status) === "unread")?.action_key
              )
            : null,
        });
      } catch (error: any) {
        console.error("Error fetching Direct Connect notifications:", error);
        return res.status(500).json({
          message: "Failed to fetch notifications",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/notifications/:notificationId/read",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const notificationId = String(req.params.notificationId || "").trim();
        if (!notificationId) return res.status(400).json({ message: "notificationId is required" });
        const roleRaw = String((req.body as any)?.role || (req.query as any)?.role || "requester")
          .trim()
          .toLowerCase();
        const recipientRole = roleRaw === "business" ? "business" : "requester";
        const ok = await markInternalDirectConnectNotificationRead({
          notificationId,
          recipientRole,
          recipientUserId: userId,
        });
        if (!ok) return res.status(404).json({ message: "Notification not found" });
        return res.json({ ok: true });
      } catch (error: any) {
        console.error("Error marking Direct Connect notification read:", error);
        return res.status(500).json({
          message: "Failed to mark notification read",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/notifications/read-all",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const roleRaw = String((req.body as any)?.role || (req.query as any)?.role || "requester")
          .trim()
          .toLowerCase();
        const recipientRole = roleRaw === "business" ? "business" : "requester";
        const updated = await markAllInternalDirectConnectNotificationsRead({
          recipientRole,
          recipientUserId: userId,
        });
        return res.json({ ok: true, updated });
      } catch (error: any) {
        console.error("Error marking all Direct Connect notifications read:", error);
        return res.status(500).json({
          message: "Failed to mark notifications read",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/notifications/:notificationId/archive",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const notificationId = String(req.params.notificationId || "").trim();
        if (!notificationId) return res.status(400).json({ message: "notificationId is required" });
        const roleRaw = String((req.body as any)?.role || (req.query as any)?.role || "requester")
          .trim()
          .toLowerCase();
        const recipientRole = roleRaw === "business" ? "business" : "requester";
        const ok = await archiveInternalDirectConnectNotification({
          notificationId,
          recipientRole,
          recipientUserId: userId,
        });
        if (!ok) return res.status(404).json({ message: "Notification not found" });
        return res.json({ ok: true });
      } catch (error: any) {
        console.error("Error archiving Direct Connect notification:", error);
        return res.status(500).json({
          message: "Failed to archive notification",
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
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) {
          return res.status(401).json({
            code: "AUTH_REQUIRED_TO_VIEW_REQUESTS",
            message: "Sign in is required to view posted Direct Connect requests.",
          });
        }

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

        const filters: any[] = [eq(workRequests.source, "direct_connect" as any)];
        filters.push(eq(workRequests.createdByUserId, String(userId)));
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
        const validStatuses = new Set([
          "open",
          "routed",
          "in_progress",
          "pending_outcome",
          "completed",
          "cancelled",
        ]);
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

        const ownedRequests = filteredRequests;

        if (!ownedRequests.length) {
          return res.json([]);
        }

        // Keep share token lifecycle strict:
        // - live requests get/keep a token
        // - closed requests lose tokens
        for (const row of ownedRequests as any[]) {
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

        const requestIds = ownedRequests.map((r: any) => r.id);

        const dispatchMetaByRequestId = new Map<string, any>();
        if (requestIds.length) {
          try {
            const dispatchRows = await db.execute(sql`
              SELECT
                id,
                request_type,
                county,
                city_area,
                urgency,
                completeness_state,
                routing_readiness_state,
                contact_gate_state,
                updated_at
              FROM direct_connect_dispatch_requests
              WHERE id = ANY(${requestIds}::text[])
            `);
            for (const row of (dispatchRows.rows || []) as any[]) {
              dispatchMetaByRequestId.set(String(row.id), row);
            }
          } catch {
            // fail-soft for older environments before dispatch ledger bootstrap
          }
        }
        const safeSelectRows = async (label: string, statement: () => Promise<unknown>) => {
          try {
            const result = await statement();
            return (result as { rows?: unknown[] }).rows || [];
          } catch (error) {
            if (isSchemaMismatchError(error)) {
              console.warn(
                `[direct-connect] Schema mismatch while building request list metadata (${label}); continuing with fallback`,
                error
              );
              return [];
            }
            console.warn(
              `[direct-connect] Optional metadata query failed while building request list (${label}); continuing with fallback`,
              error
            );
            return [];
          }
        };
        const workspaceByRequestId = new Map<string, any>();
        if (requestIds.length) {
          const workspaceRows = await safeSelectRows("workspaces", () =>
            db.execute(sql`
              SELECT request_id, id, status, active_stage, updated_at
              FROM direct_connect_job_workspaces
              WHERE request_id = ANY(${requestIds}::text[])
            `)
          );
          for (const row of workspaceRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || workspaceByRequestId.has(key)) continue;
            workspaceByRequestId.set(key, row);
          }
        }
        const estimateSummaryByRequestId = new Map<
          string,
          {
            activeEstimateId: string | null;
            latestEstimateStatus: string | null;
            estimateCount: number;
          }
        >();
        if (requestIds.length) {
          const estimateRows = await safeSelectRows("estimate summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(e.id)::int AS estimate_count,
                (
                  SELECT e2.id
                  FROM job_estimates e2
                  WHERE e2.workspace_id = w.id
                  ORDER BY e2.created_at DESC
                  LIMIT 1
                ) AS active_estimate_id,
                (
                  SELECT e3.status
                  FROM job_estimates e3
                  WHERE e3.workspace_id = w.id
                  ORDER BY e3.created_at DESC
                  LIMIT 1
                ) AS latest_estimate_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_estimates e ON e.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of estimateRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || estimateSummaryByRequestId.has(key)) continue;
            estimateSummaryByRequestId.set(key, {
              activeEstimateId: row.active_estimate_id ? String(row.active_estimate_id) : null,
              latestEstimateStatus: row.latest_estimate_status
                ? String(row.latest_estimate_status)
                : null,
              estimateCount: Number(row.estimate_count || 0),
            });
          }
        }
        const paymentSummaryByRequestId = new Map<
          string,
          { latestPaymentRequestStatus: string | null; paymentRequestCount: number }
        >();
        if (requestIds.length) {
          const paymentRows = await safeSelectRows("payment summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(p.id)::int AS payment_request_count,
                (
                  SELECT p2.status
                  FROM job_payment_requests p2
                  WHERE p2.workspace_id = w.id
                  ORDER BY p2.created_at DESC
                  LIMIT 1
                ) AS latest_payment_request_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_payment_requests p ON p.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of paymentRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || paymentSummaryByRequestId.has(key)) continue;
            paymentSummaryByRequestId.set(key, {
              latestPaymentRequestStatus: row.latest_payment_request_status
                ? String(row.latest_payment_request_status)
                : null,
              paymentRequestCount: Number(row.payment_request_count || 0),
            });
          }
        }
        const scheduleSummaryByRequestId = new Map<
          string,
          {
            latestScheduleStatus: string | null;
            scheduleProposalCount: number;
            activeScheduleProposalId: string | null;
          }
        >();
        if (requestIds.length) {
          const scheduleRows = await safeSelectRows("schedule summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(s.id)::int AS schedule_proposal_count,
                (
                  SELECT s2.id
                  FROM job_schedule_proposals s2
                  WHERE s2.workspace_id = w.id
                  ORDER BY s2.created_at DESC
                  LIMIT 1
                ) AS active_schedule_proposal_id,
                (
                  SELECT s3.status
                  FROM job_schedule_proposals s3
                  WHERE s3.workspace_id = w.id
                  ORDER BY s3.created_at DESC
                  LIMIT 1
                ) AS latest_schedule_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_schedule_proposals s ON s.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of scheduleRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || scheduleSummaryByRequestId.has(key)) continue;
            scheduleSummaryByRequestId.set(key, {
              latestScheduleStatus: row.latest_schedule_status
                ? String(row.latest_schedule_status)
                : null,
              scheduleProposalCount: Number(row.schedule_proposal_count || 0),
              activeScheduleProposalId: row.active_schedule_proposal_id
                ? String(row.active_schedule_proposal_id)
                : null,
            });
          }
        }
        const invoiceSummaryByRequestId = new Map<
          string,
          {
            latestInvoiceStatus: string | null;
            invoiceCount: number;
            activeInvoiceId: string | null;
          }
        >();
        if (requestIds.length) {
          const invoiceRows = await safeSelectRows("invoice summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(i.id)::int AS invoice_count,
                (
                  SELECT i2.id FROM job_invoices i2 WHERE i2.workspace_id = w.id ORDER BY i2.created_at DESC LIMIT 1
                ) AS active_invoice_id,
                (
                  SELECT i3.status FROM job_invoices i3 WHERE i3.workspace_id = w.id ORDER BY i3.created_at DESC LIMIT 1
                ) AS latest_invoice_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_invoices i ON i.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of invoiceRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || invoiceSummaryByRequestId.has(key)) continue;
            invoiceSummaryByRequestId.set(key, {
              latestInvoiceStatus: row.latest_invoice_status
                ? String(row.latest_invoice_status)
                : null,
              invoiceCount: Number(row.invoice_count || 0),
              activeInvoiceId: row.active_invoice_id ? String(row.active_invoice_id) : null,
            });
          }
        }
        const receiptSummaryByRequestId = new Map<
          string,
          {
            latestReceiptStatus: string | null;
            latestPaymentRecordStatus: string | null;
            receiptCount: number;
          }
        >();
        if (requestIds.length) {
          const receiptRows = await safeSelectRows("receipt summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(r.id)::int AS receipt_count,
                (
                  SELECT r2.status FROM job_receipts r2 WHERE r2.workspace_id = w.id ORDER BY r2.created_at DESC LIMIT 1
                ) AS latest_receipt_status,
                (
                  SELECT r3.status FROM job_receipts r3 WHERE r3.workspace_id = w.id AND r3.receipt_type = 'payment_record' ORDER BY r3.created_at DESC LIMIT 1
                ) AS latest_payment_record_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_receipts r ON r.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of receiptRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || receiptSummaryByRequestId.has(key)) continue;
            receiptSummaryByRequestId.set(key, {
              latestReceiptStatus: row.latest_receipt_status
                ? String(row.latest_receipt_status)
                : null,
              latestPaymentRecordStatus: row.latest_payment_record_status
                ? String(row.latest_payment_record_status)
                : null,
              receiptCount: Number(row.receipt_count || 0),
            });
          }
        }
        const checkpointSummaryByRequestId = new Map<
          string,
          {
            latestCheckpointStatus: string | null;
            checkpointCount: number;
            openCheckpointCount: number;
          }
        >();
        if (requestIds.length) {
          const checkpointRows = await safeSelectRows("checkpoint summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(c.id)::int AS checkpoint_count,
                COUNT(c.id) FILTER (WHERE c.status NOT IN ('approved', 'completed', 'canceled'))::int AS open_checkpoint_count,
                (
                  SELECT c2.status FROM job_checkpoints c2 WHERE c2.workspace_id = w.id ORDER BY c2.created_at DESC LIMIT 1
                ) AS latest_checkpoint_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_checkpoints c ON c.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of checkpointRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || checkpointSummaryByRequestId.has(key)) continue;
            checkpointSummaryByRequestId.set(key, {
              latestCheckpointStatus: row.latest_checkpoint_status
                ? String(row.latest_checkpoint_status)
                : null,
              checkpointCount: Number(row.checkpoint_count || 0),
              openCheckpointCount: Number(row.open_checkpoint_count || 0),
            });
          }
        }
        const changeOrderSummaryByRequestId = new Map<
          string,
          {
            latestChangeOrderStatus: string | null;
            changeOrderCount: number;
            openChangeOrderCount: number;
          }
        >();
        if (requestIds.length) {
          const changeOrderRows = await safeSelectRows("change order summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(c.id)::int AS change_order_count,
                COUNT(c.id) FILTER (WHERE c.status IN ('draft','sent','change_requested'))::int AS open_change_order_count,
                (
                  SELECT c2.status FROM job_change_orders c2 WHERE c2.workspace_id = w.id ORDER BY c2.created_at DESC LIMIT 1
                ) AS latest_change_order_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_change_orders c ON c.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of changeOrderRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || changeOrderSummaryByRequestId.has(key)) continue;
            changeOrderSummaryByRequestId.set(key, {
              latestChangeOrderStatus: row.latest_change_order_status
                ? String(row.latest_change_order_status)
                : null,
              changeOrderCount: Number(row.change_order_count || 0),
              openChangeOrderCount: Number(row.open_change_order_count || 0),
            });
          }
        }
        const punchSummaryByRequestId = new Map<
          string,
          {
            latestPunchListStatus: string | null;
            punchItemCount: number;
            openPunchItemCount: number;
          }
        >();
        if (requestIds.length) {
          const punchRows = await safeSelectRows("punch list summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(p.id)::int AS punch_item_count,
                COUNT(p.id) FILTER (WHERE p.status NOT IN ('resolved','waived','canceled'))::int AS open_punch_item_count,
                (
                  SELECT p2.status FROM job_punch_list_items p2 WHERE p2.workspace_id = w.id ORDER BY p2.created_at DESC LIMIT 1
                ) AS latest_punch_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_punch_list_items p ON p.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of punchRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || punchSummaryByRequestId.has(key)) continue;
            punchSummaryByRequestId.set(key, {
              latestPunchListStatus: row.latest_punch_status
                ? String(row.latest_punch_status)
                : null,
              punchItemCount: Number(row.punch_item_count || 0),
              openPunchItemCount: Number(row.open_punch_item_count || 0),
            });
          }
        }
        const completionSummaryByRequestId = new Map<
          string,
          { latestCompletionStatus: string | null; activeCompletionRequestId: string | null }
        >();
        if (requestIds.length) {
          const completionRows = await safeSelectRows("completion summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                (
                  SELECT c2.id FROM job_completion_requests c2 WHERE c2.workspace_id = w.id ORDER BY c2.created_at DESC LIMIT 1
                ) AS active_completion_request_id,
                (
                  SELECT c3.status FROM job_completion_requests c3 WHERE c3.workspace_id = w.id ORDER BY c3.created_at DESC LIMIT 1
                ) AS latest_completion_status
              FROM direct_connect_job_workspaces w
              WHERE w.request_id = ANY(${requestIds}::text[])
            `)
          );
          for (const row of completionRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || completionSummaryByRequestId.has(key)) continue;
            completionSummaryByRequestId.set(key, {
              latestCompletionStatus: row.latest_completion_status
                ? String(row.latest_completion_status)
                : null,
              activeCompletionRequestId: row.active_completion_request_id
                ? String(row.active_completion_request_id)
                : null,
            });
          }
        }
        const responseCountByRequestId = new Map<string, number>();
        const contactRequestCountByRequestId = new Map<string, number>();
        const lifecycleByRequestId = new Map<
          string,
          { lifecycleStatus: string; latestStatus: string; latestStatusAt: unknown }
        >();
        const unreadStatusCountByRequestId = new Map<string, number>();
        if (requestIds.length) {
          try {
            const responseRows = await db.execute(sql`
              SELECT request_id, COUNT(*)::int AS count
              FROM direct_connect_contractor_responses
              WHERE request_id = ANY(${requestIds}::text[])
              GROUP BY request_id
            `);
            for (const row of (responseRows.rows || []) as any[]) {
              responseCountByRequestId.set(String(row.request_id), Number(row.count || 0));
            }
          } catch {
            // fail-soft for older environments before dispatch ledger bootstrap
          }
          try {
            const contactRows = await db.execute(sql`
              SELECT request_id, COUNT(*)::int AS count
              FROM direct_connect_dispatch_events
              WHERE request_id = ANY(${requestIds}::text[])
                AND event_type = 'contact_requested'
              GROUP BY request_id
            `);
            for (const row of (contactRows.rows || []) as any[]) {
              contactRequestCountByRequestId.set(String(row.request_id), Number(row.count || 0));
            }

            const lifecycleRows = await db.execute(sql`
              SELECT DISTINCT ON (request_id)
                request_id,
                lifecycle_status,
                message_text,
                created_at
              FROM direct_connect_lifecycle_notifications
              WHERE request_id = ANY(${requestIds}::text[])
                AND recipient_type = 'requester'
                AND recipient_id = ${String(userId)}
              ORDER BY request_id, created_at DESC
            `);
            for (const row of (lifecycleRows.rows || []) as any[]) {
              lifecycleByRequestId.set(String(row.request_id), {
                lifecycleStatus: String(row.lifecycle_status || ""),
                latestStatus: String(row.message_text || ""),
                latestStatusAt: row.created_at || null,
              });
            }

            const unreadRows = await db.execute(sql`
              SELECT request_id, COUNT(*)::int AS count
              FROM direct_connect_lifecycle_notifications
              WHERE request_id = ANY(${requestIds}::text[])
                AND recipient_type = 'requester'
                AND recipient_id = ${String(userId)}
                AND is_read = false
              GROUP BY request_id
            `);
            for (const row of (unreadRows.rows || []) as any[]) {
              unreadStatusCountByRequestId.set(String(row.request_id), Number(row.count || 0));
            }
          } catch {
            // fail-soft for older environments before dispatch ledger bootstrap
          }
        }

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

        // Accepted contractor assignments (contractorId set)
        const acceptedContractorAssignments = (assignments as any[]).filter(
          (x: any) => x.status === "accepted" && x.contractorId
        );
        const acceptedContractorIds = Array.from(
          new Set(
            acceptedContractorAssignments
              .map((x: any) => String(x.contractorId))
              .filter((id: string) => id.length > 0)
          )
        );
        // Accepted business/worker assignments (responderUserId set, no contractorId).
        // The respond endpoint stores these conversations using userId as the contractorId key.
        const acceptedResponderAssignments = (assignments as any[]).filter(
          (x: any) => x.status === "accepted" && !x.contractorId && (x as any).responderUserId
        );
        const acceptedResponderUserIds = Array.from(
          new Set(
            acceptedResponderAssignments
              .map((x: any) => String((x as any).responderUserId))
              .filter((id: string) => id.length > 0)
          )
        );
        // Combine all provider keys to query conversations in one pass.
        const allProviderKeys = [...acceptedContractorIds, ...acceptedResponderUserIds];
        let conversationsForAccepted: any[] = [];
        if (allProviderKeys.length > 0) {
          try {
            conversationsForAccepted = await db
              .select()
              .from(conversations)
              .where(
                and(
                  eq(conversations.homeownerId, String(userId || "")),
                  inArray(conversations.contractorId, allProviderKeys)
                )
              )
              .orderBy(desc(conversations.createdAt));
          } catch (error) {
            const label = isSchemaMismatchError(error)
              ? "[direct-connect] conversations schema mismatch while resolving accepted threads; continuing without conversation links"
              : "[direct-connect] Optional conversation lookup failed while resolving accepted threads; continuing without conversation links";
            console.warn(label, error);
            conversationsForAccepted = [];
          }
        }
        // Single map keyed by contractorId (which is also userId for business/worker providers).
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
          const label = isSchemaMismatchError(error)
            ? "[direct-connect] work_request_events schema mismatch while listing requests; continuing without event timeline"
            : "[direct-connect] Optional event timeline lookup failed while listing requests; continuing without event timeline";
          console.warn(label, error);
          events = [];
        }

        const assignmentsByRequest = new Map<string, any[]>();
        for (const a of assignments as any[]) {
          const key = String(a.workRequestId);
          const list = assignmentsByRequest.get(key) || [];
          list.push(a);
          assignmentsByRequest.set(key, list);
        }

        const lastEventByRequest = new Map<string, Date>();
        const homeIdDraftCreatedByRequest = new Set<string>();
        const homeIdDraftSubmittedByRequest = new Set<string>();
        for (const e of events as any[]) {
          const key = String(e.workRequestId);
          const ts = e.createdAt ? new Date(e.createdAt) : null;
          if (!ts) continue;
          const existing = lastEventByRequest.get(key);
          if (!existing || ts > existing) {
            lastEventByRequest.set(key, ts);
          }
          const type = String((e as any).type || "").toLowerCase();
          if (type === "homeid_draft_created") homeIdDraftCreatedByRequest.add(key);
          if (type === "homeid_draft_submitted") homeIdDraftSubmittedByRequest.add(key);
        }

        const enriched = ownedRequests.map((r: any) => {
          const a = assignmentsByRequest.get(String(r.id)) || [];
          const suggestedCount = a.filter(
            (x: any) => x.status === "suggested" || x.status === "invited"
          ).length;
          const accepted = a.find((x: any) => x.status === "accepted");
          // Resolve conversation key: contractor profile ID for contractors,
          // responderUserId for business/worker providers (stored as contractorId in conversations).
          const acceptedProviderKey = accepted?.contractorId
            ? String(accepted.contractorId)
            : accepted && (accepted as any).responderUserId
              ? String((accepted as any).responderUserId)
              : null;
          const conversationThreadId = acceptedProviderKey
            ? conversationByContractorId.get(acceptedProviderKey) || null
            : null;

          const dispatchMeta = dispatchMetaByRequestId.get(String(r.id)) || null;
          const lifecycleMeta = lifecycleByRequestId.get(String(r.id)) || null;
          const estimateMeta = estimateSummaryByRequestId.get(String(r.id)) || null;
          const paymentMeta = paymentSummaryByRequestId.get(String(r.id)) || null;
          const scheduleMeta = scheduleSummaryByRequestId.get(String(r.id)) || null;
          const checkpointMeta = checkpointSummaryByRequestId.get(String(r.id)) || null;
          const changeOrderMeta = changeOrderSummaryByRequestId.get(String(r.id)) || null;
          const punchMeta = punchSummaryByRequestId.get(String(r.id)) || null;
          const completionMeta = completionSummaryByRequestId.get(String(r.id)) || null;
          const invoiceMeta = invoiceSummaryByRequestId.get(String(r.id)) || null;
          const receiptMeta = receiptSummaryByRequestId.get(String(r.id)) || null;
          const workspaceMeta = workspaceByRequestId.get(String(r.id)) || null;
          return {
            ...r,
            attachmentCount: getAttachmentCount(r),
            dcSuggestedCount: suggestedCount,
            dcAcceptedAssignmentId: accepted?.id ?? null,
            dcAcceptedResponseSummary: (accepted as any)?.responseSummary ?? null,
            dcConversationThreadId: conversationThreadId,
            dcLastEventAt: lastEventByRequest.get(String(r.id))?.toISOString() ?? null,
            dcMiniLandingUrl: String((r as any).shareToken || "").trim()
              ? `${resolveOrigin(req)}/r/${encodeURIComponent(String((r as any).shareToken))}`
              : null,
            requestType: dispatchMeta?.request_type ?? null,
            county: dispatchMeta?.county ?? null,
            cityArea: dispatchMeta?.city_area ?? null,
            urgency: dispatchMeta?.urgency ?? null,
            completenessState: dispatchMeta?.completeness_state ?? null,
            routingReadinessState: dispatchMeta?.routing_readiness_state ?? null,
            contactGateState: dispatchMeta?.contact_gate_state ?? "locked",
            responseCount: responseCountByRequestId.get(String(r.id)) ?? 0,
            contactRequestCount: contactRequestCountByRequestId.get(String(r.id)) ?? 0,
            lifecycleStatus: lifecycleMeta?.lifecycleStatus ?? null,
            latestStatus: lifecycleMeta?.latestStatus ?? "Waiting for local businesses",
            latestStatusAt:
              lifecycleMeta?.latestStatusAt ??
              dispatchMeta?.updated_at ??
              r.updatedAt ??
              r.createdAt ??
              null,
            unreadStatusCount: unreadStatusCountByRequestId.get(String(r.id)) ?? 0,
            isHomeIdPreviewDraft:
              homeIdDraftCreatedByRequest.has(String(r.id)) &&
              !homeIdDraftSubmittedByRequest.has(String(r.id)),
            latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
            estimateCount: estimateMeta?.estimateCount ?? 0,
            activeEstimateId: estimateMeta?.activeEstimateId ?? null,
            latestPaymentRequestStatus: paymentMeta?.latestPaymentRequestStatus ?? null,
            paymentRequestCount: paymentMeta?.paymentRequestCount ?? 0,
            latestScheduleStatus: scheduleMeta?.latestScheduleStatus ?? null,
            scheduleProposalCount: scheduleMeta?.scheduleProposalCount ?? 0,
            activeScheduleProposalId: scheduleMeta?.activeScheduleProposalId ?? null,
            latestWorkStatus: workspaceMeta?.status ? String(workspaceMeta.status) : null,
            currentPhase: workspaceMeta?.active_stage
              ? String(workspaceMeta.active_stage)
              : "request",
            latestCheckpointStatus: checkpointMeta?.latestCheckpointStatus ?? null,
            checkpointCount: checkpointMeta?.checkpointCount ?? 0,
            openCheckpointCount: checkpointMeta?.openCheckpointCount ?? 0,
            latestChangeOrderStatus: changeOrderMeta?.latestChangeOrderStatus ?? null,
            changeOrderCount: changeOrderMeta?.changeOrderCount ?? 0,
            openChangeOrderCount: changeOrderMeta?.openChangeOrderCount ?? 0,
            latestPunchListStatus: punchMeta?.latestPunchListStatus ?? null,
            punchItemCount: punchMeta?.punchItemCount ?? 0,
            openPunchItemCount: punchMeta?.openPunchItemCount ?? 0,
            latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
            activeCompletionRequestId: completionMeta?.activeCompletionRequestId ?? null,
            latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            invoiceCount: invoiceMeta?.invoiceCount ?? 0,
            activeInvoiceId: invoiceMeta?.activeInvoiceId ?? null,
            latestReceiptStatus: receiptMeta?.latestReceiptStatus ?? null,
            latestPaymentRecordStatus: receiptMeta?.latestPaymentRecordStatus ?? null,
            receiptCount: receiptMeta?.receiptCount ?? 0,
            nextActionForRequester: nextActionForRequester({
              contactGateState: dispatchMeta?.contact_gate_state
                ? String(dispatchMeta.contact_gate_state)
                : "locked",
              latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
              latestScheduleStatus: scheduleMeta?.latestScheduleStatus ?? null,
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            }),
            nextActionForBusiness: nextActionForBusiness({
              contactGateState: dispatchMeta?.contact_gate_state
                ? String(dispatchMeta.contact_gate_state)
                : "locked",
              latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            }),
            trustOutcomeStatus: buildTrustOutcomeSummary({
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              openPunchItemCount: punchMeta?.openPunchItemCount ?? 0,
              openChangeOrderCount: changeOrderMeta?.openChangeOrderCount ?? 0,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
              latestReceiptStatus: receiptMeta?.latestReceiptStatus ?? null,
              requestStatus: r.status ? String(r.status) : null,
            }).trustSummaryLabel,
            completionBlockedReason:
              completionMeta?.latestCompletionStatus === "requested" &&
              (punchMeta?.openPunchItemCount ?? 0) > 0
                ? "open_punch_items"
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

  app.get(
    "/api/direct-connect/requests/:id",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) {
          return res.status(401).json({
            code: "AUTH_REQUIRED_TO_VIEW_REQUEST_DETAIL",
            message: "Sign in is required to view posted Direct Connect request details.",
          });
        }
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

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
            .json({ message: "Only Direct Connect requests are supported here" });
        }
        const dispatchOwnerRows = await db.execute(sql`
          SELECT user_id, anonymous_session_id
          FROM direct_connect_dispatch_requests
          WHERE id = ${requestId}
          LIMIT 1
        `);
        const dispatchOwner = ((dispatchOwnerRows.rows || []) as any[])[0] || null;
        const ownerUserId = String(
          dispatchOwner?.user_id || requestRow.createdByUserId || ""
        ).trim();
        const authOwnerMatch = ownerUserId.length > 0 && ownerUserId === userId;
        if (!authOwnerMatch) {
          return res.status(403).json({ message: "You can only view your own requests" });
        }

        const assignmentRows = await db
          .select()
          .from(workRequestAssignments)
          .where(eq(workRequestAssignments.workRequestId, requestId));

        const responseRows = await db.execute(sql`
          SELECT
            response_type,
            message,
            availability,
            estimated_timing,
            contact_request_state,
            created_at
          FROM direct_connect_contractor_responses
          WHERE request_id = ${requestId}
          ORDER BY created_at DESC
        `);

        const eventRows = await db.execute(sql`
          SELECT event_type, actor_type, created_at, metadata_json
          FROM direct_connect_dispatch_events
          WHERE request_id = ${requestId}
          ORDER BY created_at ASC
        `);

        const dispatchRows = await db.execute(sql`
          SELECT
            request_type,
            county,
            city_area,
            urgency,
            completeness_state,
            routing_readiness_state,
            contact_gate_state,
            answers_json,
            description
          FROM direct_connect_dispatch_requests
          WHERE id = ${requestId}
          LIMIT 1
        `);
        const dispatch = ((dispatchRows.rows || []) as any[])[0] || null;

        const contractorResponses = ((responseRows.rows || []) as any[]).map((row: any) => ({
          responseType: String(row.response_type || ""),
          message: row.message ? String(row.message) : null,
          availability: row.availability ? String(row.availability) : null,
          estimatedTiming: row.estimated_timing ? String(row.estimated_timing) : null,
          contactRequestState: String(row.contact_request_state || "locked"),
          createdAt: row.created_at || null,
        }));

        const lifecycleStatus = await getLifecycleStatusForRecipient({
          requestId,
          recipientType: "requester",
          recipientId: String(userId),
        }).catch(() => null);
        const unreadStatusCount = await getUnreadLifecycleStatusCount({
          requestId,
          recipientType: "requester",
          recipientId: String(userId),
        }).catch(() => 0);
        const jobWorkspace = await getJobWorkspaceByRequestId(requestId).catch(() => null);
        const workspaceStage = String(jobWorkspace?.active_stage || "contact") as any;
        const allowedLifecycleActions = jobWorkspace
          ? getAllowedLifecycleActions({ stage: workspaceStage, role: "requester" })
          : [];
        const estimateSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS estimate_count,
                  (
                    SELECT id
                    FROM job_estimates
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_estimate_id,
                  (
                    SELECT status
                    FROM job_estimates
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_estimate_status
                FROM job_estimates
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const estimateSummary = estimateSummaryRows
          ? (((estimateSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const paymentSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS payment_request_count,
                  (
                    SELECT status
                    FROM job_payment_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_payment_request_status
                FROM job_payment_requests
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const paymentSummary = paymentSummaryRows
          ? (((paymentSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const scheduleSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS schedule_proposal_count,
                  (
                    SELECT id
                    FROM job_schedule_proposals
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_schedule_proposal_id,
                  (
                    SELECT status
                    FROM job_schedule_proposals
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_schedule_status
                FROM job_schedule_proposals
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const scheduleSummary = scheduleSummaryRows
          ? (((scheduleSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const checkpointSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS checkpoint_count,
                  COUNT(id) FILTER (WHERE status NOT IN ('approved', 'completed', 'canceled'))::int AS open_checkpoint_count,
                  (
                    SELECT status
                    FROM job_checkpoints
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_checkpoint_status
                FROM job_checkpoints
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const checkpointSummary = checkpointSummaryRows
          ? (((checkpointSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const changeOrderSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS change_order_count,
                  COUNT(id) FILTER (WHERE status IN ('draft', 'sent', 'change_requested'))::int AS open_change_order_count,
                  (
                    SELECT status
                    FROM job_change_orders
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_change_order_status
                FROM job_change_orders
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const changeOrderSummary = changeOrderSummaryRows
          ? (((changeOrderSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const punchSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS punch_item_count,
                  COUNT(id) FILTER (WHERE status NOT IN ('resolved', 'waived', 'canceled'))::int AS open_punch_item_count,
                  (
                    SELECT status
                    FROM job_punch_list_items
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_punch_status
                FROM job_punch_list_items
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const punchSummary = punchSummaryRows
          ? (((punchSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const completionSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  (
                    SELECT id
                    FROM job_completion_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_completion_request_id,
                  (
                    SELECT status
                    FROM job_completion_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_completion_status
              `)
          : null;
        const completionSummary = completionSummaryRows
          ? (((completionSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const invoiceSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS invoice_count,
                  (
                    SELECT id
                    FROM job_invoices
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_invoice_id,
                  (
                    SELECT status
                    FROM job_invoices
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_invoice_status
                FROM job_invoices
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const invoiceSummary = invoiceSummaryRows
          ? (((invoiceSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const receiptSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS receipt_count,
                  (
                    SELECT status
                    FROM job_receipts
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_receipt_status,
                  (
                    SELECT status
                    FROM job_receipts
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                      AND receipt_type = 'payment_record'
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_payment_record_status
                FROM job_receipts
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const receiptSummary = receiptSummaryRows
          ? (((receiptSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        await appendDispatchEvent({
          requestId,
          actorType: "requester",
          actorId: userId,
          eventType: "requester_viewed_request",
          metadata: { surface: "direct_connect_requests_detail" },
        }).catch(() => undefined);
        await appendDispatchEvent({
          requestId,
          actorType: "requester",
          actorId: userId,
          eventType: "homeowner_viewed_request",
          metadata: { surface: "direct_connect_requests_detail", compatibility: true },
        }).catch(() => undefined);

        if (contractorResponses.length > 0) {
          await appendDispatchEvent({
            requestId,
            actorType: "requester",
            actorId: userId,
            eventType: "requester_viewed_response",
            metadata: { count: contractorResponses.length },
          }).catch(() => undefined);
          await appendDispatchEvent({
            requestId,
            actorType: "requester",
            actorId: userId,
            eventType: "homeowner_viewed_response",
            metadata: { count: contractorResponses.length, compatibility: true },
          }).catch(() => undefined);
        }
        const timelineItems = ((eventRows.rows || []) as any[]).map((eventRow: any) => {
          const eventType = String(eventRow.event_type || "");
          const copy = timelineCopyForEvent(eventType);
          return {
            id: String(eventRow.event_id || ""),
            requestId,
            jobWorkspaceId: jobWorkspace?.id ? String(jobWorkspace.id) : null,
            eventType,
            phase: mapEventTypeToPhase(eventType),
            title: copy.title,
            description: copy.description,
            actorType: String(eventRow.actor_type || "system"),
            actorLabel: String(eventRow.actor_type || "system"),
            visibility: "both",
            createdAt: eventRow.created_at || null,
            metadataSummary: {},
          };
        });
        const latestTimelineItem = timelineItems.length
          ? timelineItems[timelineItems.length - 1]
          : null;
        const trustOutcome = buildTrustOutcomeSummary({
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          openPunchItemCount: Number(punchSummary?.open_punch_item_count || 0),
          openChangeOrderCount: Number(changeOrderSummary?.open_change_order_count || 0),
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
          latestReceiptStatus: receiptSummary?.latest_receipt_status
            ? String(receiptSummary.latest_receipt_status)
            : null,
          requestStatus: requestRow.status ? String(requestRow.status) : null,
        });
        const nextRequester = nextActionForRequester({
          contactGateState: String(dispatch?.contact_gate_state || "locked"),
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          latestScheduleStatus: scheduleSummary?.latest_schedule_status
            ? String(scheduleSummary.latest_schedule_status)
            : null,
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
        });
        const nextBusiness = nextActionForBusiness({
          contactGateState: String(dispatch?.contact_gate_state || "locked"),
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
        });

        return res.status(200).json({
          requestId,
          requestSummary: {
            title: String(requestRow.title || "Direct Connect request"),
            description: String(dispatch?.description || requestRow.description || ""),
            requestType: dispatch?.request_type ?? null,
            category: requestRow.category ?? null,
            county: dispatch?.county ?? null,
            cityArea: dispatch?.city_area ?? null,
            urgency: dispatch?.urgency ?? null,
            createdAt: requestRow.createdAt ?? null,
            status: requestRow.status ?? "open",
            attachmentCount: getAttachmentCount(requestRow),
          },
          answers: dispatch?.answers_json ?? {},
          completenessState: dispatch?.completeness_state ?? null,
          routingReadinessState: dispatch?.routing_readiness_state ?? null,
          contactGateState: dispatch?.contact_gate_state ?? "locked",
          lifecycleStatus: lifecycleStatus?.lifecycleStatus ?? null,
          latestStatus: lifecycleStatus?.latestStatus ?? "Waiting for local businesses",
          latestStatusAt: lifecycleStatus?.latestStatusAt ?? null,
          unreadStatusCount,
          jobWorkspaceId: jobWorkspace?.id ? String(jobWorkspace.id) : null,
          activeStage: jobWorkspace?.active_stage ? String(jobWorkspace.active_stage) : null,
          currentPhase:
            latestTimelineItem?.phase ??
            mapEventTypeToPhase(String(dispatch?.last_event_type || "request_shared")),
          latestJobStatus: jobWorkspace?.status ? String(jobWorkspace.status) : null,
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          estimateCount: Number(estimateSummary?.estimate_count || 0),
          activeEstimateId: estimateSummary?.active_estimate_id
            ? String(estimateSummary.active_estimate_id)
            : null,
          latestPaymentRequestStatus: paymentSummary?.latest_payment_request_status
            ? String(paymentSummary.latest_payment_request_status)
            : null,
          paymentRequestCount: Number(paymentSummary?.payment_request_count || 0),
          latestScheduleStatus: scheduleSummary?.latest_schedule_status
            ? String(scheduleSummary.latest_schedule_status)
            : null,
          scheduleProposalCount: Number(scheduleSummary?.schedule_proposal_count || 0),
          activeScheduleProposalId: scheduleSummary?.active_schedule_proposal_id
            ? String(scheduleSummary.active_schedule_proposal_id)
            : null,
          latestWorkStatus: jobWorkspace?.status ? String(jobWorkspace.status) : null,
          latestCheckpointStatus: checkpointSummary?.latest_checkpoint_status
            ? String(checkpointSummary.latest_checkpoint_status)
            : null,
          checkpointCount: Number(checkpointSummary?.checkpoint_count || 0),
          openCheckpointCount: Number(checkpointSummary?.open_checkpoint_count || 0),
          latestChangeOrderStatus: changeOrderSummary?.latest_change_order_status
            ? String(changeOrderSummary.latest_change_order_status)
            : null,
          changeOrderCount: Number(changeOrderSummary?.change_order_count || 0),
          openChangeOrderCount: Number(changeOrderSummary?.open_change_order_count || 0),
          latestPunchListStatus: punchSummary?.latest_punch_status
            ? String(punchSummary.latest_punch_status)
            : null,
          punchItemCount: Number(punchSummary?.punch_item_count || 0),
          openPunchItemCount: Number(punchSummary?.open_punch_item_count || 0),
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          activeCompletionRequestId: completionSummary?.active_completion_request_id
            ? String(completionSummary.active_completion_request_id)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
          invoiceCount: Number(invoiceSummary?.invoice_count || 0),
          activeInvoiceId: invoiceSummary?.active_invoice_id
            ? String(invoiceSummary.active_invoice_id)
            : null,
          latestReceiptStatus: receiptSummary?.latest_receipt_status
            ? String(receiptSummary.latest_receipt_status)
            : null,
          latestPaymentRecordStatus: receiptSummary?.latest_payment_record_status
            ? String(receiptSummary.latest_payment_record_status)
            : null,
          receiptCount: Number(receiptSummary?.receipt_count || 0),
          nextActionForRequester: nextRequester,
          nextActionForBusiness: nextBusiness,
          trustOutcomeStatus: trustOutcome.trustSummaryLabel,
          completionStatus: trustOutcome.completionConfirmedByRequester ? "confirmed" : "pending",
          financialStatus:
            (invoiceSummary?.latest_invoice_status
              ? String(invoiceSummary.latest_invoice_status)
              : null) ||
            (receiptSummary?.latest_receipt_status
              ? String(receiptSummary.latest_receipt_status)
              : null) ||
            "none",
          timelinePreview: timelineItems.slice(Math.max(0, timelineItems.length - 5)),
          latestTimelineItem,
          trustOutcome,
          completionBlockedReason:
            completionSummary?.latest_completion_status === "requested" &&
            Number(punchSummary?.open_punch_item_count || 0) > 0
              ? "open_punch_items"
              : null,
          allowedLifecycleActions,
          responses: contractorResponses,
          responseCount: contractorResponses.length,
          contactRequestCount: contractorResponses.filter((x: any) =>
            ["contractor_requested", "user_approved", "released"].includes(
              String(x.contactRequestState || "")
            )
          ).length,
          assignments: assignmentRows.map((assignment: any) => ({
            assignmentId: String(assignment.id),
            status: String(assignment.status || "suggested"),
            updatedAt: assignment.updatedAt || assignment.createdAt || null,
          })),
          timeline: timelineItems,
          allowedRequesterActions: {
            canApproveContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canDenyContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved",
          },
          // Backward compatibility for older clients/tests.
          allowedHomeownerActions: {
            canApproveContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canDenyContact:
              String(dispatch?.contact_gate_state || "locked") === "contractor_requested",
            canReleaseContact: String(dispatch?.contact_gate_state || "locked") === "user_approved",
          },
        });
      } catch (error) {
        console.error("Error fetching direct connect request detail:", error);
        return res.status(500).json({
          message: "Failed to load request detail",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/requests/:id/timeline",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId));
        if (!requestRow) return res.status(404).json({ message: "Work request not found" });
        if (String(requestRow.createdByUserId || "") !== userId) {
          return res.status(403).json({ message: "Request not available for this requester" });
        }

        const workspace = await getJobWorkspaceByRequestId(requestId).catch(() => null);
        const events = await db.execute(sql`
          SELECT event_id, request_id, actor_type, actor_id, event_type, metadata_json, created_at
          FROM direct_connect_dispatch_events
          WHERE request_id = ${requestId}
          ORDER BY created_at ASC
        `);
        const timeline = ((events.rows || []) as any[]).map((row) => {
          const eventType = String(row.event_type || "");
          const copy = timelineCopyForEvent(eventType);
          return {
            id: String(row.event_id),
            requestId: String(row.request_id || requestId),
            jobWorkspaceId: workspace?.id ? String(workspace.id) : null,
            eventType,
            phase: mapEventTypeToPhase(eventType),
            title: copy.title,
            description: copy.description,
            actorType: String(row.actor_type || "system"),
            actorLabel: String(row.actor_type || "system"),
            visibility: "both",
            createdAt: row.created_at || null,
            metadataSummary: {},
          };
        });

        return res.status(200).json({
          requestId,
          jobWorkspaceId: workspace?.id ? String(workspace.id) : null,
          timeline,
          latestTimelineItem: timeline.length ? timeline[timeline.length - 1] : null,
        });
      } catch (error) {
        console.error("Error loading requester timeline:", error);
        return res.status(500).json({
          message: "Failed to load timeline",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/timeline",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const requesterOwns = String(workspace.requester_user_id || "") === userId;
        let contractorCanView = false;
        if (!requesterOwns) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligible = contractorId
            ? await db.execute(
                sql`SELECT request_id FROM direct_connect_dispatch_candidates WHERE request_id = ${String(workspace.request_id)} AND eligibility_state = 'eligible' AND (contractor_id = ${contractorId} OR responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT request_id FROM direct_connect_dispatch_candidates WHERE request_id = ${String(workspace.request_id)} AND eligibility_state = 'eligible' AND (responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND worker_id = ${workerId})) LIMIT 1`
              );
          contractorCanView = Boolean(((eligible.rows || []) as any[])[0]);
        }
        if (!requesterOwns && !contractorCanView) {
          return res.status(403).json({ message: "Timeline not available for this account" });
        }

        const events = await db.execute(sql`
          SELECT event_id, request_id, actor_type, actor_id, event_type, metadata_json, created_at
          FROM direct_connect_dispatch_events
          WHERE request_id = ${String(workspace.request_id)}
          ORDER BY created_at ASC
        `);
        const timeline = ((events.rows || []) as any[]).map((row) => {
          const eventType = String(row.event_type || "");
          const copy = timelineCopyForEvent(eventType);
          return {
            id: String(row.event_id),
            requestId: String(row.request_id || workspace.request_id),
            jobWorkspaceId: String(workspace.id),
            eventType,
            phase: mapEventTypeToPhase(eventType),
            title: copy.title,
            description: copy.description,
            actorType: String(row.actor_type || "system"),
            actorLabel: String(row.actor_type || "system"),
            visibility: "both",
            createdAt: row.created_at || null,
            metadataSummary: {},
          };
        });
        return res.status(200).json({
          requestId: String(workspace.request_id),
          jobWorkspaceId: String(workspace.id),
          timeline,
          latestTimelineItem: timeline.length ? timeline[timeline.length - 1] : null,
        });
      } catch (error) {
        console.error("Error loading job timeline:", error);
        return res.status(500).json({
          message: "Failed to load job timeline",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Requester-facing: read-only fetch of an existing share URL for a Direct Connect request
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

        const shareToken = String((requestRow as any).shareToken || "").trim();
        if (!shareToken) {
          return res.status(404).json({
            message: "No share link has been created yet. Use POST to create one.",
          });
        }

        const origin = resolveOrigin(req);
        const shareUrl = `${origin}/r/${encodeURIComponent(shareToken)}`;

        return res.status(200).json({
          shareToken,
          shareUrl,
          policy: "scope_only_join_and_verify_required",
        });
      } catch (error: any) {
        console.error("Error fetching direct connect share link:", error);
        return res.status(500).json({
          message: "Failed to fetch share link",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Requester-facing: create/fetch a public share URL for a Direct Connect request
  app.post(
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

        const hasAccess = await canResponderUserAccessRequest(String(userId), requestRow);

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

  app.post(
    "/api/direct-connect/requests/:id/contact-gate",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const requestId = String(req.params.id || "").trim();
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) {
          return res.status(401).json({
            code: "AUTH_REQUIRED_TO_UPDATE_CONTACT_GATE",
            message: "Sign in is required before approving or releasing contact.",
          });
        }
        const nextState = String((req.body as any)?.nextState || "").trim() as
          | "locked"
          | "contractor_requested"
          | "user_approved"
          | "released"
          | "denied"
          | "expired";
        if (!requestId || !nextState) {
          return res.status(400).json({ message: "requestId and nextState are required" });
        }
        if (
          ![
            "locked",
            "contractor_requested",
            "user_approved",
            "released",
            "denied",
            "expired",
          ].includes(nextState)
        ) {
          return res.status(400).json({ message: "Invalid contact gate state" });
        }

        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId));
        if (!requestRow) return res.status(404).json({ message: "Work request not found" });
        const dispatchOwnerRows = await db.execute(sql`
          SELECT user_id, anonymous_session_id
          FROM direct_connect_dispatch_requests
          WHERE id = ${requestId}
          LIMIT 1
        `);
        const dispatchOwner = ((dispatchOwnerRows.rows || []) as any[])[0] || null;
        const ownerUserId = String(
          dispatchOwner?.user_id || requestRow.createdByUserId || ""
        ).trim();
        const authOwnerMatch = ownerUserId.length > 0 && ownerUserId === userId;
        if (!authOwnerMatch) {
          return res
            .status(403)
            .json({ message: "Only the request owner can update contact approval" });
        }

        const dispatchRowResult = await db.execute(sql`
          SELECT contact_gate_state
          FROM direct_connect_dispatch_requests
          WHERE id = ${requestId}
          LIMIT 1
        `);
        const currentState = String(
          ((dispatchRowResult.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );

        const allowedTransitions = new Set([
          "contractor_requested->user_approved",
          "user_approved->released",
          "contractor_requested->denied",
        ]);
        const transitionKey = `${currentState}->${nextState}`;
        if (currentState !== nextState && !allowedTransitions.has(transitionKey)) {
          return res.status(409).json({
            message: `Invalid contact gate transition from ${currentState} to ${nextState}.`,
          });
        }

        await setDispatchContactGateState({ requestId, nextState });
        if (nextState === "released" && ownerUserId) {
          const candidateRows = await db.execute(sql`
            SELECT contractor_id, business_id, responder_user_id
            FROM direct_connect_dispatch_candidates
            WHERE request_id = ${requestId}
              AND eligibility_state = 'eligible'
            ORDER BY created_at ASC
            LIMIT 1
          `);
          const candidate = ((candidateRows.rows || []) as any[])[0] || null;
          const responseRows = await db.execute(sql`
            SELECT id
            FROM direct_connect_contractor_responses
            WHERE request_id = ${requestId}
            ORDER BY created_at DESC
            LIMIT 1
          `);
          const latestResponse = ((responseRows.rows || []) as any[])[0] || null;
          const dispatchRows = await db.execute(sql`
            SELECT category, county, city_area
            FROM direct_connect_dispatch_requests
            WHERE id = ${requestId}
            LIMIT 1
          `);
          const dispatch = ((dispatchRows.rows || []) as any[])[0] || null;
          const workspace = await createOrGetJobWorkspaceAtContactRelease({
            requestId,
            requesterUserId: ownerUserId,
            businessId: candidate?.business_id ? String(candidate.business_id) : null,
            contractorId: candidate?.contractor_id ? String(candidate.contractor_id) : null,
            contractorResponseId: latestResponse?.id ? String(latestResponse.id) : null,
            category: dispatch?.category ? String(dispatch.category) : null,
            county: dispatch?.county ? String(dispatch.county) : null,
            cityArea: dispatch?.city_area ? String(dispatch.city_area) : null,
          });
          if (workspace?.id) {
            await appendDispatchEvent({
              requestId,
              actorType: "system",
              actorId: null,
              eventType: "job_workspace_created",
              metadata: { workspaceId: String(workspace.id), source: "contact_released" },
            });
          }
        }
        const eventType =
          nextState === "user_approved"
            ? "contact_approved"
            : nextState === "denied"
              ? "contact_denied"
              : nextState === "released"
                ? "contact_released"
                : nextState === "contractor_requested"
                  ? "contact_requested"
                  : "request_shared";
        await appendDispatchEvent({
          requestId,
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { nextState, previousState: currentState, actor: "requester" },
        });
        return res.status(200).json({ requestId, contactGateState: nextState });
      } catch (error: any) {
        if (String(error?.message || "") === "CONTACT_RELEASE_REQUIRES_APPROVAL") {
          return res.status(409).json({
            message: "Contact cannot release without explicit user approval.",
          });
        }
        return res.status(500).json({ message: "Failed to update contact gate state" });
      }
    }
  );

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

        try {
          await appendDispatchEvent({
            requestId,
            actorType: "requester",
            actorId: String(userId),
            eventType: "request_closed",
            metadata: { reason: "cancelled" },
          });
          await recordTrustLedgerEvent({
            actorUserId: String(userId),
            entityType: "work_request",
            entityId: requestId,
            eventType: "direct_connect_cancelled",
            sourceSurface: "direct_connect",
            verificationLevel: undefined,
            confidence: undefined,
            metadata: {
              source: "direct_connect",
              fromStatus: String(requestRow.status || "unknown"),
              toStatus: "cancelled",
            },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to write trust ledger event on cancel", e);
        }

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

        await appendHomeIdTimelineEventFromDirectConnect({
          requestId,
          eventType: "direct_connect_cancelled",
          title: "Direct Connect request cancelled",
          summary: "The linked Direct Connect request was cancelled.",
        });

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

        try {
          await appendDispatchEvent({
            requestId,
            actorType: "requester",
            actorId: String(userId),
            eventType: "request_closed",
            metadata: { reason: "completed" },
          });
          await recordTrustLedgerEvent({
            actorUserId: String(userId),
            entityType: "work_request",
            entityId: requestId,
            eventType: "direct_connect_reopened",
            sourceSurface: "direct_connect",
            verificationLevel: undefined,
            confidence: undefined,
            metadata: {
              source: "direct_connect",
              fromStatus: "cancelled",
              toStatus: "open",
            },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to write trust ledger event on reopen", e);
        }

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
        // Contract anchor: status(200) on success
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

        try {
          await recordTrustLedgerEvent({
            actorUserId: String(userId),
            entityType: "work_request",
            entityId: requestId,
            eventType: "direct_connect_pending_outcome",
            sourceSurface: "direct_connect",
            verificationLevel: undefined,
            confidence: undefined,
            metadata: {
              source: "direct_connect",
              fromStatus: "in_progress",
              toStatus: "pending_outcome",
            },
          });
        } catch (e) {
          console.warn(
            "[direct-connect] Failed to write trust ledger event on mark-pending-outcome",
            e
          );
        }

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
        // Contract anchor: status(200) on success
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

        try {
          await recordTrustLedgerEvent({
            actorUserId: String(userId),
            entityType: "work_request",
            entityId: requestId,
            eventType: "direct_connect_completed",
            sourceSurface: "direct_connect",
            verificationLevel: undefined,
            confidence: undefined,
            metadata: {
              source: "direct_connect",
              fromStatus: String(fromStatus || "unknown"),
              toStatus: "completed",
            },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to write trust ledger event on complete", e);
        }

        // Outcome feedback: user completed a DC engagement (positive confidence signal)
        try {
          const scope = "direct_connect";
          const outcomeEvent = {
            userId: String(userId),
            contextType: "direct_connect" as const,
            contextId: requestId,
            action: "completed_flow" as const,
            scope,
          };
          await recordOutcomeEvent(outcomeEvent);
          await updateUserConfidenceStateFromOutcome(String(userId), outcomeEvent, scope);
        } catch (e) {
          console.warn("[direct-connect] Failed to record outcome event for completion", e);
        }
        // Notify the accepted provider(s) that the requester marked the job complete.
        try {
          const acceptedAssignments = await db
            .select()
            .from(workRequestAssignments)
            .where(
              and(
                eq(workRequestAssignments.workRequestId, requestId),
                eq(workRequestAssignments.status, "accepted" as any)
              )
            );
          const providerUserIds = new Set<string>();
          for (const a of acceptedAssignments as any[]) {
            if (a.responderUserId) providerUserIds.add(String(a.responderUserId));
            if (a.contractorId) {
              const [c] = await db
                .select({ userId: contractors.userId })
                .from(contractors)
                .where(eq(contractors.id, String(a.contractorId)))
                .limit(1);
              if (c?.userId) providerUserIds.add(String(c.userId));
            }
          }
          await Promise.all(
            Array.from(providerUserIds).map(async (providerUserId) => {
              try {
                await notificationService.createNotification({
                  userId: providerUserId,
                  type: "dc_request_completed",
                  title: "Job marked complete",
                  message: `The requester marked "${String(requestRow.title || "your request")}" as complete.`,
                  actionUrl: "/direct-connect/inbox",
                  actionText: "View in inbox",
                  iconName: "check-circle",
                  iconColor: "green",
                  deliveryMethods: ["in_app", "push"],
                });
              } catch (notifErr) {
                console.warn("[direct-connect] Failed to notify provider of completion", notifErr);
              }
            })
          );
        } catch (e) {
          console.warn("[direct-connect] Failed to send completion notifications to providers", e);
        }
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId,
          eventType: "direct_connect_completed",
          title: "Direct Connect request completed",
          summary: "The linked Direct Connect request was marked complete.",
        });
        await appendHomeIdCompletedWorkEnrichmentFromDirectConnect({
          requestId,
          completedAt: new Date().toISOString(),
          workSummary: String(requestRow.description || requestRow.title || "").trim() || null,
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
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) {
          return res.status(401).json({
            code: "AUTH_REQUIRED_TO_SHARE_REQUEST",
            message:
              "Create your free account to share this request. We ask requesters to sign in before sharing so local businesses know every request is real.",
          });
        }
        const ownerUserId = userId;

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

        // Authenticated requester gates (profile/verification) stay enforced.
        const viewer = await storage.getUser(String(ownerUserId));
        let bypassContext: ReturnType<typeof resolveDirectConnectVerificationBypass> | null = null;
        let canBypassVerification = false;
        if (viewer && ownerUserId) {
          const requesterRole = (viewer as any)?.role || "homeowner";
          const firstName = String((viewer as any)?.firstName || "").trim();
          const lastName = String((viewer as any)?.lastName || "").trim();
          const fullName = String(
            (viewer as any)?.name || (viewer as any)?.displayName || ""
          ).trim();
          const hasName =
            (firstName.length > 0 && lastName.length > 0) ||
            fullName.split(/\s+/).filter(Boolean).length >= 2 ||
            fullName.length >= 3;
          const phoneDigits = String((viewer as any)?.phone || "")
            .replace(/\D+/g, "")
            .trim();
          const userStateCode = String(
            (viewer as any)?.stateCode || (viewer as any)?.state_code || ""
          )
            .trim()
            .toUpperCase();
          const userCountyFips = String(
            (viewer as any)?.countyFips || (viewer as any)?.county_fips || ""
          ).trim();
          const hasLocation = /^[A-Z]{2}$/.test(userStateCode) && /^\d{5}$/.test(userCountyFips);
          const hasContactInfo = phoneDigits.length >= 10;

          if (!hasName || !hasLocation || !hasContactInfo) {
            return res.status(428).json({
              code: "PROFILE_BASICS_REQUIRED",
              message:
                "Name, location, and contact info are required before posting a Direct Connect request.",
              required: {
                name: !hasName,
                location: !hasLocation,
                contactInfo: !hasContactInfo,
              },
              next: "/onboarding/profile",
            });
          }

          bypassContext = resolveDirectConnectVerificationBypass(req, viewer);
          canBypassVerification = bypassContext.active;
          if (!canBypassVerification && bypassContext.deniedReason) {
            await auditDirectConnectBypassUsage({
              req,
              actorUserId: String(ownerUserId),
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

        const targetProviderIds = resolveTargetProviderIds(body);
        const isDirectToProviders = targetProviderIds.length > 0;
        const shouldAutoRoute = body.autoRoute !== false && !isDirectToProviders;

        const [created] = await db
          .insert(workRequests)
          .values({
            createdByUserId: String(ownerUserId),
            title: sanitizedTitle,
            description: sanitizedDescription,
            category: body.category,
            countyFips,
            stateCode,
            // Direct-to-provider requests should not be listed as "community board" jobs.
            scope: isDirectToProviders ? "personal" : "community",
            source: "direct_connect" as any,
            status: "open" as const,
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
        if (createdRequestId) {
          const requestCategory = String(body.category || "direct_connect");
          const canonicalAnswers: Record<"what" | "where" | "when" | "details", string> = {
            what: sanitizedTitle,
            where: [countyFips, stateCode].filter(Boolean).join(", "),
            when: "",
            details: sanitizedDescription,
          };
          const completenessState =
            sanitizedTitle.trim().length >= 3 && sanitizedDescription.trim().length >= 10
              ? "ready_to_share"
              : "too_vague";
          const routingReadiness = evaluateRoutingReadiness({
            category: requestCategory,
            answers: canonicalAnswers,
            description: sanitizedDescription,
            completenessState,
          });
          const canonical: CanonicalDirectConnectRequest = {
            requestId: createdRequestId,
            intent: String((req.query.intent as string) || requestCategory || "direct_connect"),
            requestType: requestCategory,
            category: requestCategory,
            county: countyFips || null,
            cityArea: null,
            urgency: null,
            description: sanitizedDescription,
            answers: canonicalAnswers,
            completenessState,
            routingReadiness,
            visibilityState: "review_ready",
            contactGateState: "locked",
            createdAt: new Date().toISOString(),
            sourceSurface: "direct_connect",
          };
          try {
            await persistFinalizedDispatchRequest({
              canonical,
              userId: String(ownerUserId),
              anonymousSessionId: null,
            });
            await appendDispatchEvent({
              requestId: createdRequestId,
              actorType: "requester",
              actorId: String(ownerUserId),
              eventType: "request_finalized",
              metadata: {
                category: requestCategory,
                routingReadiness,
              },
            });
            await appendDispatchEvent({
              requestId: createdRequestId,
              actorType: "system",
              actorId: null,
              eventType:
                routingReadiness === "route_ready"
                  ? "request_route_ready"
                  : "request_route_blocked",
              metadata: { routingReadiness },
            });
            await appendDispatchEvent({
              requestId: createdRequestId,
              actorType: "requester",
              actorId: String(ownerUserId),
              eventType: "request_shared",
              metadata: { source: "direct_connect_create" },
            });
          } catch (error) {
            if (isSchemaMismatchError(error)) {
              console.warn(
                "[direct-connect] Dispatch ledger schema mismatch while creating request; continuing with work request only",
                error
              );
            } else {
              throw error;
            }
          }
        }

        if (created) {
          try {
            await db.insert(workRequestEvents).values({
              workRequestId: created.id,
              type: "created",
              actorUserId: ownerUserId ? String(ownerUserId) : null,
              metadata: { source: "direct_connect" },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record work request created event", e);
          }
        }

        const assetLink = {
          homeId: body.homeId || null,
          assetComponentId: body.assetComponentId || null,
          assetComponentType: body.assetComponentType || null,
          assetLabel: body.assetLabel || null,
          homeContextIntent: body.homeContextIntent || "skip_for_now",
          homePacketId: body.homePacketId || null,
          homePacketSelectedDetailIds: body.homePacketSelectedDetailIds || [],
          homePacketReadinessState: body.homePacketReadinessState || null,
          source: "direct_connect_request",
        };

        if (
          created &&
          (assetLink.homeId ||
            assetLink.assetComponentId ||
            assetLink.assetComponentType ||
            assetLink.homeContextIntent !== "skip_for_now")
        ) {
          try {
            await db.insert(workRequestEvents).values({
              workRequestId: created.id,
              type: "asset_linked",
              actorUserId: ownerUserId ? String(ownerUserId) : null,
              metadata: { assetLink },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record asset link event", e);
          }
        }

        if (created?.id && body.homePacketId) {
          try {
            await db.insert(workRequestEvents).values({
              workRequestId: created.id,
              type: "homeid_draft_created",
              actorUserId: ownerUserId ? String(ownerUserId) : null,
              metadata: {
                source: "homeid_packet",
                homeId: body.homeId || null,
                homePacketId: body.homePacketId,
                selectedDetailIds: body.homePacketSelectedDetailIds || [],
                readinessState: body.homePacketReadinessState || null,
              },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record homeid_draft_created event", e);
          }
        }

        if (created?.id && String(body.homeContextIntent || "skip_for_now") !== "skip_for_now") {
          try {
            const requestedHomeId = String(body.homeId || "").trim() || null;
            const ownedLinkedHome = await resolveOwnedHomeForDirectConnect(
              ownerUserId,
              requestedHomeId
            );
            const homeContextIntent = String(body.homeContextIntent || "skip_for_now");
            let targetHomeId = ownedLinkedHome?.id ? String(ownedLinkedHome.id) : null;

            if (!targetHomeId && homeContextIntent === "create_from_request") {
              const createdHome = await createHomeIdShellFromRequest({
                userId: ownerUserId,
                title: sanitizedTitle,
                requestCategory: String(body.category || "direct_connect"),
                stateCode: stateCode || null,
                countyFips: countyFips || null,
              });
              targetHomeId = createdHome?.id ? String(createdHome.id) : null;
            }

            if (
              targetHomeId &&
              (homeContextIntent === "create_from_request" ||
                homeContextIntent === "update_from_request" ||
                homeContextIntent === "link_existing")
            ) {
              await appendHomeIdRequestContextRecord({
                homeId: targetHomeId,
                userId: ownerUserId,
                requestId: String(created.id),
                title: sanitizedTitle,
                description: sanitizedDescription,
                requestCategory: String(body.category || "direct_connect"),
                componentType: body.assetComponentType || null,
                componentId: body.assetComponentId || null,
                componentLabel: body.assetLabel || null,
                homeContextIntent,
                homePacketId: body.homePacketId || null,
                homePacketSelectedDetailIds: body.homePacketSelectedDetailIds || [],
                homePacketReadinessState: body.homePacketReadinessState || null,
              });
              if (
                homeContextIntent === "create_from_request" ||
                homeContextIntent === "update_from_request"
              ) {
                await storage.logEvent(
                  homeContextIntent === "create_from_request"
                    ? "direct_connect_homeid_created_from_request"
                    : "direct_connect_homeid_updated_from_request",
                  {
                    type:
                      homeContextIntent === "create_from_request"
                        ? "direct_connect_homeid_created_from_request"
                        : "direct_connect_homeid_updated_from_request",
                    surface: "direct_connect",
                    source: "direct_connect_server",
                    userState: "authenticated",
                    viewport: "desktop",
                    homeId: targetHomeId,
                    requestId: String(created.id),
                    packetId: body.homePacketId || null,
                    componentType: body.assetComponentType || null,
                    ts: new Date().toISOString(),
                  }
                );
              }
            } else if (requestedHomeId && !ownedLinkedHome) {
              await db.insert(workRequestEvents).values({
                workRequestId: created.id,
                type: "asset_linked",
                actorUserId: ownerUserId ? String(ownerUserId) : null,
                metadata: {
                  assetLink: {
                    homeId: requestedHomeId,
                    homeContextIntent,
                    source: "direct_connect_request",
                    status: "skipped_not_owner",
                  },
                },
              });
            }
          } catch (error) {
            console.warn(
              "[direct-connect] Failed to create/update HomeID from request context",
              error
            );
          }
        }

        if (bypassContext && ownerUserId) {
          await auditDirectConnectBypassUsage({
            req,
            actorUserId: String(ownerUserId),
            context: bypassContext,
            operation: "create",
            requestId: createdRequestId,
          });
        }

        // Explicit targeting preserves requester choice; this is not automatic routing.
        if (created && targetProviderIds.length > 0) {
          try {
            const requestedIds = targetProviderIds;
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
            const contractorEligibility = await filterContractorsEligibleForRequest(
              invitedContractors,
              created
            );
            const eligibleContractors = contractorEligibility.eligible;
            const businessEligibility = await filterBusinessesEligibleForRequest(
              invitedBusinesses,
              created
            );
            const eligibleBusinesses = businessEligibility.eligible;
            // Contract anchor (direct-pick creation): responderUserId: biz.ownerUserId!; allAssignments;
            // ...contractorAssignments, ...businessAssignments; businessEvents; contractorEvents; notifyUserIds;
            // invitedBusinesses.map((b) => b.ownerUserId)
            if (createdRequestId) {
              await Promise.all([
                ...eligibleContractors.map((contractor: any) =>
                  snapshotDispatchCandidate({
                    requestId: createdRequestId,
                    contractorId: String(contractor.id),
                    responderUserId: contractor.userId ? String(contractor.userId) : null,
                    eligibility: { status: "eligible", eligible: true },
                    eligibilityReasons: ["eligible_for_dispatch"],
                    territoryMatched: true,
                    categoryMatched: true,
                    verificationState: "verified_or_allowed",
                    profileReadiness: "ready",
                    contactEligibility: true,
                    trustState: "eligible",
                  })
                ),
                ...contractorEligibility.ineligible.map((entry: any) =>
                  snapshotDispatchCandidate({
                    requestId: createdRequestId,
                    contractorId: String(entry.contractorId || ""),
                    eligibility: evaluateContractorEligibility({
                      isActive: true,
                      isVerified: false,
                      profileComplete: true,
                      contactEligible: false,
                      categoryMatch: true,
                      territoryMatch: !String(entry.reason || "").includes("outside"),
                      trustOrCvsEligible: true,
                    }),
                    ineligibilityReasons: [String(entry.reason || "not_eligible")],
                    territoryMatched: !String(entry.reason || "").includes("outside"),
                    categoryMatched: true,
                    verificationState: "unknown",
                    profileReadiness: "unknown",
                    contactEligibility: false,
                    trustState: "unknown",
                  })
                ),
                ...eligibleBusinesses.map((business: any) =>
                  snapshotDispatchCandidate({
                    requestId: createdRequestId,
                    businessId: String(business.id),
                    responderUserId: business.ownerUserId ? String(business.ownerUserId) : null,
                    eligibility: { status: "eligible", eligible: true },
                    eligibilityReasons: ["eligible_for_dispatch"],
                    territoryMatched: true,
                    categoryMatched: true,
                    verificationState: "verified_or_allowed",
                    profileReadiness: "ready",
                    contactEligibility: true,
                    trustState: "eligible",
                  })
                ),
                ...businessEligibility.ineligible.map((entry: any) =>
                  snapshotDispatchCandidate({
                    requestId: createdRequestId,
                    businessId: String(entry.businessId || ""),
                    eligibility: { status: "not_eligible", eligible: false },
                    ineligibilityReasons: [String(entry.reason || "not_eligible")],
                    territoryMatched: !String(entry.reason || "").includes("outside"),
                    categoryMatched: !String(entry.reason || "").includes("category"),
                    verificationState: "unknown",
                    profileReadiness: "unknown",
                    contactEligibility: false,
                    trustState: "unknown",
                  })
                ),
              ]);
            }
            const now = new Date();
            const contractorAssignments = eligibleContractors.map((contractor) => ({
              workRequestId: created.id,
              contractorId: contractor.id,
              status: "invited" as const,
              createdAt: now,
              updatedAt: now,
            }));
            const businessAssignments = eligibleBusinesses
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
                const businessEvents = eligibleBusinesses
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
                  ...(eligibleBusinesses.map((b) => b.ownerUserId).filter(Boolean) as string[]),
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
    "/api/direct-connect/requests/:id/submit-homeid-draft",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const payload = (req.body ?? {}) as {
          homeId?: string;
          homePacketId?: string;
          selectedDetailIds?: string[];
        };
        const homeId = String(payload.homeId || "").trim();
        const homePacketId = String(payload.homePacketId || "").trim();
        const selectedDetailIds = Array.isArray(payload.selectedDetailIds)
          ? payload.selectedDetailIds
              .map((id) => String(id || "").trim())
              .filter(Boolean)
              .slice(0, 50)
          : [];

        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId))
          .limit(1);
        if (!requestRow) return res.status(404).json({ message: "Work request not found" });
        if (String(requestRow.createdByUserId || "") !== userId) {
          return res.status(403).json({ message: "Request not available for this requester" });
        }

        await db
          .update(workRequests)
          .set({ updatedAt: new Date() })
          .where(eq(workRequests.id, requestId));

        try {
          await db.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "homeid_draft_reviewed",
            actorUserId: userId,
            metadata: {
              source: "homeid_packet",
              homeId: homeId || null,
              homePacketId: homePacketId || null,
              selectedDetailIds,
            },
          });
          await db.insert(workRequestEvents).values({
            workRequestId: requestId,
            type: "homeid_draft_submitted",
            actorUserId: userId,
            metadata: {
              source: "homeid_packet",
              homeId: homeId || null,
              homePacketId: homePacketId || null,
              selectedDetailIds,
              directConnectRequestId: requestId,
            },
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to record homeid draft submit events", e);
        }

        if (homeId && homePacketId) {
          const ownedHome = await resolveOwnedHomeForDirectConnect(userId, homeId);
          if (ownedHome) {
            try {
              await db.insert(userHomeRecords).values({
                homeId,
                createdByUserId: userId,
                recordType: "note",
                title: "homeid:direct_connect_request_submitted",
                details: JSON.stringify({
                  source: "homeid_packet",
                  event: "direct_connect_request_submitted",
                  directConnectRequestId: requestId,
                  homePacketId,
                  selectedDetailIds,
                  submittedAt: new Date().toISOString(),
                }),
                tags: ["homeid", "direct_connect", "submitted"],
                updatedAt: new Date(),
              } as any);
            } catch (e) {
              console.warn("[direct-connect] Failed to write HomeID submit backlink record", e);
            }
          }
        }

        await appendHomeIdTimelineEventFromDirectConnect({
          requestId,
          eventType: "direct_connect_request_submitted",
          title: "Direct Connect request submitted",
          summary: "A HomeID-linked request was reviewed and submitted.",
        });

        return res.status(200).json({
          requestId,
          status: String(requestRow.status || "open"),
          submitted: true,
          source: "homeid_packet",
        });
      } catch (error) {
        console.error("Error submitting homeid draft request:", error);
        return res.status(500).json({
          message: "Failed to submit HomeID draft request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

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
        const targetProviderIds = resolveTargetProviderIds(body);
        const isDirectToProviders = targetProviderIds.length > 0;
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
            status: "open" as const,
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
        if (created && targetProviderIds.length > 0) {
          try {
            const requestedIds = targetProviderIds;
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
            const contractorEligibility = await filterContractorsEligibleForRequest(
              invitedContractors,
              created
            );
            const eligibleContractors = contractorEligibility.eligible;
            const businessEligibility = await filterBusinessesEligibleForRequest(
              invitedBusinesses,
              created
            );
            const eligibleBusinesses = businessEligibility.eligible;
            const now = new Date();
            const contractorAssignments = eligibleContractors.map((contractor) => ({
              workRequestId: created.id,
              contractorId: contractor.id,
              status: "invited" as const,
              createdAt: now,
              updatedAt: now,
            }));
            const businessAssignments = eligibleBusinesses
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
                const businessEvents = eligibleBusinesses
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
                  ...(eligibleBusinesses.map((b) => b.ownerUserId).filter(Boolean) as string[]),
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
        const buildProviderInboxItems = async (
          assignments: any[],
          providerUserId?: string
        ): Promise<any[]> => {
          if (!assignments.length) return [];
          const workRequestIds = assignments.map((a: any) => a.workRequestId);
          const requests = await db
            .select()
            .from(workRequests)
            .where(inArray(workRequests.id, workRequestIds));
          const requestById = new Map(requests.map((r: any) => [r.id, r]));
          // Resolve conversation threads for accepted assignments.
          // Business/worker providers are stored in conversations using userId as contractorId.
          const conversationByHomeowner = new Map<string, string>();
          if (providerUserId) {
            const acceptedAssignments = assignments.filter((a: any) => a.status === "accepted");
            if (acceptedAssignments.length) {
              const homeownerIds = Array.from(
                new Set(
                  acceptedAssignments
                    .map((a: any) => {
                      const req = requestById.get(a.workRequestId) as any;
                      return req?.createdByUserId ? String(req.createdByUserId) : null;
                    })
                    .filter((id): id is string => Boolean(id))
                )
              );
              if (homeownerIds.length) {
                try {
                  const convRows = await db
                    .select()
                    .from(conversations)
                    .where(
                      and(
                        eq(conversations.contractorId, providerUserId),
                        inArray(conversations.homeownerId, homeownerIds)
                      )
                    )
                    .orderBy(desc(conversations.createdAt));
                  for (const convo of convRows as any[]) {
                    const homeownerId = String((convo as any).homeownerId || "");
                    if (!homeownerId || conversationByHomeowner.has(homeownerId)) continue;
                    conversationByHomeowner.set(homeownerId, String((convo as any).id));
                  }
                } catch (e) {
                  console.warn(
                    "[direct-connect] Failed to resolve conversation threads for business/worker inbox",
                    e
                  );
                }
              }
            }
          }
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
            conversationThreadId: (() => {
              if (!providerUserId) return null;
              const reqRow = requestById.get(a.workRequestId) as any;
              if (!reqRow?.createdByUserId) return null;
              return conversationByHomeowner.get(String(reqRow.createdByUserId)) || null;
            })(),
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
            const bizItems = await buildProviderInboxItems(bizAssignments, String(userId));
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
              const workerItems = await buildProviderInboxItems(workerAssignments, String(userId));
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

  app.get(
    "/api/direct-connect/contractor/requests",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;

        const contractorId = contractor?.id ? String(contractor.id) : null;
        const safeSelectRows = async (label: string, statement: () => Promise<unknown>) => {
          try {
            const result = await statement();
            return (result as { rows?: unknown[] }).rows || [];
          } catch (error) {
            if (isSchemaMismatchError(error)) {
              console.warn(
                `[direct-connect] Schema mismatch while building contractor request list (${label}); continuing with fallback`,
                error
              );
              return [];
            }
            console.warn(
              `[direct-connect] Optional metadata query failed while building contractor request list (${label}); continuing with fallback`,
              error
            );
            return [];
          }
        };

        const candidateRows = await safeSelectRows("dispatch candidates", () =>
          contractorId
            ? db.execute(sql`
              SELECT
                c.request_id,
                c.eligibility_state,
                c.eligibility_reasons,
                c.ineligibility_reasons,
                c.territory_matched,
                c.category_matched,
                c.verification_state,
                c.profile_readiness,
                c.contact_eligibility,
                c.trust_state,
                c.created_at AS candidate_created_at,
                r.intent,
                r.request_type,
                r.category,
                r.county,
                r.city_area,
                r.urgency,
                r.description,
                r.answers_json,
                r.routing_readiness_state,
                r.contact_gate_state,
                r.created_at,
                r.updated_at
              FROM direct_connect_dispatch_candidates c
              INNER JOIN direct_connect_dispatch_requests r
                ON r.id = c.request_id
              WHERE c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              ORDER BY r.updated_at DESC, r.created_at DESC, c.created_at DESC
            `)
            : db.execute(sql`
              SELECT
                c.request_id,
                c.eligibility_state,
                c.eligibility_reasons,
                c.ineligibility_reasons,
                c.territory_matched,
                c.category_matched,
                c.verification_state,
                c.profile_readiness,
                c.contact_eligibility,
                c.trust_state,
                c.created_at AS candidate_created_at,
                r.intent,
                r.request_type,
                r.category,
                r.county,
                r.city_area,
                r.urgency,
                r.description,
                r.answers_json,
                r.routing_readiness_state,
                r.contact_gate_state,
                r.created_at,
                r.updated_at
              FROM direct_connect_dispatch_candidates c
              INNER JOIN direct_connect_dispatch_requests r
                ON r.id = c.request_id
              WHERE c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              ORDER BY r.updated_at DESC, r.created_at DESC, c.created_at DESC
            `)
        );

        const responseByRequest = new Map<string, any>();
        const responseRows = await safeSelectRows("contractor responses", () =>
          contractorId
            ? db.execute(sql`
              SELECT DISTINCT ON (request_id)
                request_id,
                response_type,
                contact_request_state,
                created_at
              FROM direct_connect_contractor_responses
              WHERE contractor_id = ${contractorId}
                 OR responder_user_id = ${userId}
              ORDER BY request_id, created_at DESC
            `)
            : db.execute(sql`
              SELECT DISTINCT ON (request_id)
                request_id,
                response_type,
                contact_request_state,
                created_at
              FROM direct_connect_contractor_responses
              WHERE responder_user_id = ${userId}
              ORDER BY request_id, created_at DESC
            `)
        );
        for (const row of responseRows as any[]) {
          responseByRequest.set(String(row.request_id), row);
        }
        const requestIds = Array.from(
          new Set((candidateRows as any[]).map((row: any) => String(row.request_id || "")))
        ).filter(Boolean);
        const workspaceByRequestId = new Map<string, any>();
        if (requestIds.length) {
          const workspaceRows = await safeSelectRows("workspaces", () =>
            db.execute(sql`
              SELECT request_id, id, status, active_stage, updated_at
              FROM direct_connect_job_workspaces
              WHERE request_id = ANY(${requestIds}::text[])
            `)
          );
          for (const row of workspaceRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || workspaceByRequestId.has(key)) continue;
            workspaceByRequestId.set(key, row);
          }
        }
        const lifecycleByRequestId = new Map<
          string,
          { lifecycleStatus: string; latestStatus: string; latestStatusAt: unknown }
        >();
        const unreadStatusCountByRequestId = new Map<string, number>();
        if (requestIds.length) {
          const lifecycleRows = await safeSelectRows("lifecycle notifications", () =>
            db.execute(sql`
              SELECT DISTINCT ON (request_id)
                request_id,
                lifecycle_status,
                message_text,
                created_at
              FROM direct_connect_lifecycle_notifications
              WHERE request_id = ANY(${requestIds}::text[])
                AND recipient_type = 'contractor'
                AND recipient_id = ${userId}
              ORDER BY request_id, created_at DESC
            `)
          );
          for (const row of lifecycleRows as any[]) {
            lifecycleByRequestId.set(String(row.request_id), {
              lifecycleStatus: String(row.lifecycle_status || ""),
              latestStatus: String(row.message_text || ""),
              latestStatusAt: row.created_at || null,
            });
          }
          const unreadRows = await safeSelectRows("unread lifecycle counts", () =>
            db.execute(sql`
              SELECT request_id, COUNT(*)::int AS count
              FROM direct_connect_lifecycle_notifications
              WHERE request_id = ANY(${requestIds}::text[])
                AND recipient_type = 'contractor'
                AND recipient_id = ${userId}
                AND is_read = false
              GROUP BY request_id
            `)
          );
          for (const row of unreadRows as any[]) {
            unreadStatusCountByRequestId.set(String(row.request_id), Number(row.count || 0));
          }
        }
        const estimateSummaryByRequestId = new Map<
          string,
          {
            activeEstimateId: string | null;
            latestEstimateStatus: string | null;
            estimateCount: number;
          }
        >();
        if (requestIds.length) {
          const estimateRows = await safeSelectRows("estimate summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(e.id)::int AS estimate_count,
                (
                  SELECT e2.id
                  FROM job_estimates e2
                  WHERE e2.workspace_id = w.id
                  ORDER BY e2.created_at DESC
                  LIMIT 1
                ) AS active_estimate_id,
                (
                  SELECT e3.status
                  FROM job_estimates e3
                  WHERE e3.workspace_id = w.id
                  ORDER BY e3.created_at DESC
                  LIMIT 1
                ) AS latest_estimate_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_estimates e ON e.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of estimateRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || estimateSummaryByRequestId.has(key)) continue;
            estimateSummaryByRequestId.set(key, {
              activeEstimateId: row.active_estimate_id ? String(row.active_estimate_id) : null,
              latestEstimateStatus: row.latest_estimate_status
                ? String(row.latest_estimate_status)
                : null,
              estimateCount: Number(row.estimate_count || 0),
            });
          }
        }
        const paymentSummaryByRequestId = new Map<
          string,
          { latestPaymentRequestStatus: string | null; paymentRequestCount: number }
        >();
        if (requestIds.length) {
          const paymentRows = await safeSelectRows("payment summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(p.id)::int AS payment_request_count,
                (
                  SELECT p2.status
                  FROM job_payment_requests p2
                  WHERE p2.workspace_id = w.id
                  ORDER BY p2.created_at DESC
                  LIMIT 1
                ) AS latest_payment_request_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_payment_requests p ON p.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of paymentRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || paymentSummaryByRequestId.has(key)) continue;
            paymentSummaryByRequestId.set(key, {
              latestPaymentRequestStatus: row.latest_payment_request_status
                ? String(row.latest_payment_request_status)
                : null,
              paymentRequestCount: Number(row.payment_request_count || 0),
            });
          }
        }
        const scheduleSummaryByRequestId = new Map<
          string,
          {
            latestScheduleStatus: string | null;
            scheduleProposalCount: number;
            activeScheduleProposalId: string | null;
          }
        >();
        if (requestIds.length) {
          const scheduleRows = await safeSelectRows("schedule summaries", () =>
            db.execute(sql`
              SELECT
                w.request_id,
                COUNT(s.id)::int AS schedule_proposal_count,
                (
                  SELECT s2.id
                  FROM job_schedule_proposals s2
                  WHERE s2.workspace_id = w.id
                  ORDER BY s2.created_at DESC
                  LIMIT 1
                ) AS active_schedule_proposal_id,
                (
                  SELECT s3.status
                  FROM job_schedule_proposals s3
                  WHERE s3.workspace_id = w.id
                  ORDER BY s3.created_at DESC
                  LIMIT 1
                ) AS latest_schedule_status
              FROM direct_connect_job_workspaces w
              LEFT JOIN job_schedule_proposals s ON s.workspace_id = w.id
              WHERE w.request_id = ANY(${requestIds}::text[])
              GROUP BY w.request_id, w.id
            `)
          );
          for (const row of scheduleRows as any[]) {
            const key = String(row.request_id || "");
            if (!key || scheduleSummaryByRequestId.has(key)) continue;
            scheduleSummaryByRequestId.set(key, {
              latestScheduleStatus: row.latest_schedule_status
                ? String(row.latest_schedule_status)
                : null,
              scheduleProposalCount: Number(row.schedule_proposal_count || 0),
              activeScheduleProposalId: row.active_schedule_proposal_id
                ? String(row.active_schedule_proposal_id)
                : null,
            });
          }
        }
        // Optional enrichment maps. These are read below to shape response metadata.
        // Keep them initialized even when enrichment queries are omitted so list fetches
        // never fail closed for providers.
        const checkpointSummaryByRequestId = new Map<
          string,
          {
            latestCheckpointStatus: string | null;
            checkpointCount: number;
            openCheckpointCount: number;
          }
        >();
        const changeOrderSummaryByRequestId = new Map<
          string,
          {
            latestChangeOrderStatus: string | null;
            changeOrderCount: number;
            openChangeOrderCount: number;
          }
        >();
        const punchSummaryByRequestId = new Map<
          string,
          {
            latestPunchListStatus: string | null;
            punchItemCount: number;
            openPunchItemCount: number;
          }
        >();
        const completionSummaryByRequestId = new Map<
          string,
          { latestCompletionStatus: string | null; activeCompletionRequestId: string | null }
        >();
        const invoiceSummaryByRequestId = new Map<
          string,
          {
            latestInvoiceStatus: string | null;
            invoiceCount: number;
            activeInvoiceId: string | null;
          }
        >();
        const receiptSummaryByRequestId = new Map<
          string,
          {
            latestReceiptStatus: string | null;
            latestPaymentRecordStatus: string | null;
            receiptCount: number;
          }
        >();

        const deduped = new Map<string, any>();
        for (const row of candidateRows as any[]) {
          const requestId = String(row.request_id || "");
          if (!requestId || deduped.has(requestId)) continue;
          const latestResponse = responseByRequest.get(requestId) || null;
          const lifecycleMeta = lifecycleByRequestId.get(requestId) || null;
          const estimateMeta = estimateSummaryByRequestId.get(requestId) || null;
          const paymentMeta = paymentSummaryByRequestId.get(requestId) || null;
          const scheduleMeta = scheduleSummaryByRequestId.get(requestId) || null;
          const checkpointMeta = checkpointSummaryByRequestId.get(requestId) || null;
          const changeOrderMeta = changeOrderSummaryByRequestId.get(requestId) || null;
          const punchMeta = punchSummaryByRequestId.get(requestId) || null;
          const completionMeta = completionSummaryByRequestId.get(requestId) || null;
          const invoiceMeta = invoiceSummaryByRequestId.get(requestId) || null;
          const receiptMeta = receiptSummaryByRequestId.get(requestId) || null;
          const workspace = workspaceByRequestId.get(requestId) || null;
          const allowedLifecycleActions = workspace
            ? getAllowedLifecycleActions({
                stage: String(workspace.active_stage || "contact") as any,
                role: "contractor",
              })
            : [];
          deduped.set(requestId, {
            requestId,
            requestType: String(row.request_type || ""),
            category: String(row.category || ""),
            county: row.county ? String(row.county) : null,
            cityArea: row.city_area ? String(row.city_area) : null,
            urgency: row.urgency ? String(row.urgency) : null,
            description: String(row.description || ""),
            answersSummary: row.answers_json || {},
            routingReadinessState: String(row.routing_readiness_state || ""),
            eligibilityState: String(row.eligibility_state || ""),
            eligibilityReasons: Array.isArray(row.eligibility_reasons)
              ? row.eligibility_reasons
              : [],
            contactGateState: String(row.contact_gate_state || "locked"),
            createdAt: row.created_at || null,
            responseState: latestResponse ? String(latestResponse.response_type || "") : null,
            lifecycleStatus: lifecycleMeta?.lifecycleStatus ?? null,
            latestStatus: lifecycleMeta?.latestStatus ?? null,
            latestStatusAt: lifecycleMeta?.latestStatusAt ?? null,
            unreadStatusCount: unreadStatusCountByRequestId.get(requestId) ?? 0,
            latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
            estimateCount: estimateMeta?.estimateCount ?? 0,
            activeEstimateId: estimateMeta?.activeEstimateId ?? null,
            latestPaymentRequestStatus: paymentMeta?.latestPaymentRequestStatus ?? null,
            paymentRequestCount: paymentMeta?.paymentRequestCount ?? 0,
            latestScheduleStatus: scheduleMeta?.latestScheduleStatus ?? null,
            scheduleProposalCount: scheduleMeta?.scheduleProposalCount ?? 0,
            activeScheduleProposalId: scheduleMeta?.activeScheduleProposalId ?? null,
            latestWorkStatus: workspace?.status ? String(workspace.status) : null,
            latestCheckpointStatus: checkpointMeta?.latestCheckpointStatus ?? null,
            checkpointCount: checkpointMeta?.checkpointCount ?? 0,
            openCheckpointCount: checkpointMeta?.openCheckpointCount ?? 0,
            latestChangeOrderStatus: changeOrderMeta?.latestChangeOrderStatus ?? null,
            changeOrderCount: changeOrderMeta?.changeOrderCount ?? 0,
            openChangeOrderCount: changeOrderMeta?.openChangeOrderCount ?? 0,
            latestPunchListStatus: punchMeta?.latestPunchListStatus ?? null,
            punchItemCount: punchMeta?.punchItemCount ?? 0,
            openPunchItemCount: punchMeta?.openPunchItemCount ?? 0,
            latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
            activeCompletionRequestId: completionMeta?.activeCompletionRequestId ?? null,
            latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            invoiceCount: invoiceMeta?.invoiceCount ?? 0,
            activeInvoiceId: invoiceMeta?.activeInvoiceId ?? null,
            latestReceiptStatus: receiptMeta?.latestReceiptStatus ?? null,
            latestPaymentRecordStatus: receiptMeta?.latestPaymentRecordStatus ?? null,
            receiptCount: receiptMeta?.receiptCount ?? 0,
            completionBlockedReason:
              completionMeta?.latestCompletionStatus === "requested" &&
              (punchMeta?.openPunchItemCount ?? 0) > 0
                ? "open_punch_items"
                : null,
            jobWorkspaceId: workspace?.id ? String(workspace.id) : null,
            activeStage: workspace?.active_stage ? String(workspace.active_stage) : null,
            currentPhase: workspace?.active_stage ? String(workspace.active_stage) : "request",
            latestJobStatus: workspace?.status ? String(workspace.status) : null,
            allowedLifecycleActions,
            nextActionForRequester: nextActionForRequester({
              contactGateState: String(row.contact_gate_state || "locked"),
              latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
              latestScheduleStatus: scheduleMeta?.latestScheduleStatus ?? null,
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            }),
            nextActionForBusiness: nextActionForBusiness({
              contactGateState: String(row.contact_gate_state || "locked"),
              latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            }),
            trustOutcomeStatus: buildTrustOutcomeSummary({
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              openPunchItemCount: punchMeta?.openPunchItemCount ?? 0,
              openChangeOrderCount: changeOrderMeta?.openChangeOrderCount ?? 0,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
              latestReceiptStatus: receiptMeta?.latestReceiptStatus ?? null,
              requestStatus: null,
            }).trustSummaryLabel,
          });
        }

        return res.status(200).json(Array.from(deduped.values()));
      } catch (error) {
        console.error("Error listing contractor routed direct connect requests:", error);
        return res.status(500).json({
          message: "Failed to list routed requests",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/contractor/requests/:id",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;

        const contractorId = contractor?.id ? String(contractor.id) : null;
        const candidateResult = contractorId
          ? await db.execute(sql`
              SELECT
                c.request_id,
                c.eligibility_state,
                c.eligibility_reasons,
                c.ineligibility_reasons,
                c.territory_matched,
                c.category_matched,
                c.verification_state,
                c.profile_readiness,
                c.contact_eligibility,
                c.trust_state,
                r.intent,
                r.request_type,
                r.category,
                r.county,
                r.city_area,
                r.urgency,
                r.description,
                r.answers_json,
                r.routing_readiness_state,
                r.contact_gate_state,
                r.visibility_state,
                r.created_at,
                r.updated_at
              FROM direct_connect_dispatch_candidates c
              INNER JOIN direct_connect_dispatch_requests r
                ON r.id = c.request_id
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              ORDER BY c.created_at DESC
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT
                c.request_id,
                c.eligibility_state,
                c.eligibility_reasons,
                c.ineligibility_reasons,
                c.territory_matched,
                c.category_matched,
                c.verification_state,
                c.profile_readiness,
                c.contact_eligibility,
                c.trust_state,
                r.intent,
                r.request_type,
                r.category,
                r.county,
                r.city_area,
                r.urgency,
                r.description,
                r.answers_json,
                r.routing_readiness_state,
                r.contact_gate_state,
                r.visibility_state,
                r.created_at,
                r.updated_at
              FROM direct_connect_dispatch_candidates c
              INNER JOIN direct_connect_dispatch_requests r
                ON r.id = c.request_id
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              ORDER BY c.created_at DESC
              LIMIT 1
            `);

        const candidate = ((candidateResult.rows || []) as any[])[0];
        if (!candidate) {
          return res.status(403).json({ message: "Request not available for this contractor" });
        }

        await appendDispatchEvent({
          requestId,
          actorType: "contractor",
          actorId: userId,
          eventType: "contractor_viewed_request",
          metadata: { surface: "contractor_console" },
        }).catch(() => undefined);

        const latestResponseResult = contractorId
          ? await db.execute(sql`
              SELECT response_type, contact_request_state, message, availability, estimated_timing, created_at
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND (
                  contractor_id = ${contractorId}
                  OR responder_user_id = ${userId}
                )
              ORDER BY created_at DESC
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT response_type, contact_request_state, message, availability, estimated_timing, created_at
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND responder_user_id = ${userId}
              ORDER BY created_at DESC
              LIMIT 1
            `);
        const latestResponse = ((latestResponseResult.rows || []) as any[])[0] || null;
        const lifecycleStatus = await getLifecycleStatusForRecipient({
          requestId,
          recipientType: "contractor",
          recipientId: userId,
        }).catch(() => null);
        const unreadStatusCount = await getUnreadLifecycleStatusCount({
          requestId,
          recipientType: "contractor",
          recipientId: userId,
        }).catch(() => 0);
        const jobWorkspace = await getJobWorkspaceByRequestId(requestId).catch(() => null);
        const allowedLifecycleActions = jobWorkspace
          ? getAllowedLifecycleActions({
              stage: String(jobWorkspace.active_stage || "contact") as any,
              role: "contractor",
            })
          : [];
        const estimateSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS estimate_count,
                  (
                    SELECT id
                    FROM job_estimates
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_estimate_id,
                  (
                    SELECT status
                    FROM job_estimates
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_estimate_status
                FROM job_estimates
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const estimateSummary = estimateSummaryRows
          ? (((estimateSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const paymentSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS payment_request_count,
                  (
                    SELECT status
                    FROM job_payment_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_payment_request_status
                FROM job_payment_requests
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const paymentSummary = paymentSummaryRows
          ? (((paymentSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const scheduleSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS schedule_proposal_count,
                  (
                    SELECT id
                    FROM job_schedule_proposals
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_schedule_proposal_id,
                  (
                    SELECT status
                    FROM job_schedule_proposals
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_schedule_status
                FROM job_schedule_proposals
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const scheduleSummary = scheduleSummaryRows
          ? (((scheduleSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const checkpointSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS checkpoint_count,
                  COUNT(id) FILTER (WHERE status NOT IN ('approved', 'completed', 'canceled'))::int AS open_checkpoint_count,
                  (
                    SELECT status
                    FROM job_checkpoints
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_checkpoint_status
                FROM job_checkpoints
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const checkpointSummary = checkpointSummaryRows
          ? (((checkpointSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const changeOrderSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS change_order_count,
                  COUNT(id) FILTER (WHERE status IN ('draft', 'sent', 'change_requested'))::int AS open_change_order_count,
                  (
                    SELECT status
                    FROM job_change_orders
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_change_order_status
                FROM job_change_orders
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const changeOrderSummary = changeOrderSummaryRows
          ? (((changeOrderSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const punchSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS punch_item_count,
                  COUNT(id) FILTER (WHERE status NOT IN ('resolved', 'waived', 'canceled'))::int AS open_punch_item_count,
                  (
                    SELECT status
                    FROM job_punch_list_items
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_punch_status
                FROM job_punch_list_items
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const punchSummary = punchSummaryRows
          ? (((punchSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const completionSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  (
                    SELECT id
                    FROM job_completion_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_completion_request_id,
                  (
                    SELECT status
                    FROM job_completion_requests
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_completion_status
              `)
          : null;
        const completionSummary = completionSummaryRows
          ? (((completionSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const invoiceSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS invoice_count,
                  (
                    SELECT id
                    FROM job_invoices
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS active_invoice_id,
                  (
                    SELECT status
                    FROM job_invoices
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_invoice_status
                FROM job_invoices
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const invoiceSummary = invoiceSummaryRows
          ? (((invoiceSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const receiptSummaryRows = jobWorkspace?.id
          ? await db.execute(sql`
                SELECT
                  COUNT(id)::int AS receipt_count,
                  (
                    SELECT status
                    FROM job_receipts
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_receipt_status,
                  (
                    SELECT status
                    FROM job_receipts
                    WHERE workspace_id = ${String(jobWorkspace.id)}
                      AND receipt_type = 'payment_record'
                    ORDER BY created_at DESC
                    LIMIT 1
                  ) AS latest_payment_record_status
                FROM job_receipts
                WHERE workspace_id = ${String(jobWorkspace.id)}
              `)
          : null;
        const receiptSummary = receiptSummaryRows
          ? (((receiptSummaryRows.rows || []) as any[])[0] ?? null)
          : null;
        const eventRows = await db.execute(sql`
          SELECT event_id, event_type, actor_type, actor_id, metadata, created_at
          FROM direct_connect_dispatch_events
          WHERE request_id = ${requestId}
          ORDER BY created_at ASC
        `);
        const timelineItems = ((eventRows.rows || []) as any[]).map((eventRow: any) => {
          const eventType = String(eventRow.event_type || "");
          const copy = timelineCopyForEvent(eventType);
          return {
            id: String(eventRow.event_id || ""),
            requestId,
            jobWorkspaceId: jobWorkspace?.id ? String(jobWorkspace.id) : null,
            eventType,
            phase: mapEventTypeToPhase(eventType),
            title: copy.title,
            description: copy.description,
            actorType: String(eventRow.actor_type || "system"),
            actorLabel: String(eventRow.actor_type || "system"),
            visibility: "both",
            createdAt: eventRow.created_at || null,
            metadataSummary: {},
          };
        });
        const latestTimelineItem = timelineItems.length
          ? timelineItems[timelineItems.length - 1]
          : null;
        const trustOutcome = buildTrustOutcomeSummary({
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          openPunchItemCount: Number(punchSummary?.open_punch_item_count || 0),
          openChangeOrderCount: Number(changeOrderSummary?.open_change_order_count || 0),
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
          latestReceiptStatus: receiptSummary?.latest_receipt_status
            ? String(receiptSummary.latest_receipt_status)
            : null,
          requestStatus: candidate.status ? String(candidate.status) : null,
        });
        const nextRequester = nextActionForRequester({
          contactGateState: String(candidate.contact_gate_state || "locked"),
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          latestScheduleStatus: scheduleSummary?.latest_schedule_status
            ? String(scheduleSummary.latest_schedule_status)
            : null,
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
        });
        const nextBusiness = nextActionForBusiness({
          contactGateState: String(candidate.contact_gate_state || "locked"),
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
        });

        return res.status(200).json({
          requestId,
          requestType: String(candidate.request_type || ""),
          category: String(candidate.category || ""),
          county: candidate.county ? String(candidate.county) : null,
          cityArea: candidate.city_area ? String(candidate.city_area) : null,
          urgency: candidate.urgency ? String(candidate.urgency) : null,
          description: String(candidate.description || ""),
          answers: candidate.answers_json || {},
          routingReadinessState: String(candidate.routing_readiness_state || ""),
          eligibilityState: String(candidate.eligibility_state || ""),
          eligibilityReasons: Array.isArray(candidate.eligibility_reasons)
            ? candidate.eligibility_reasons
            : [],
          ineligibilityReasons: Array.isArray(candidate.ineligibility_reasons)
            ? candidate.ineligibility_reasons
            : [],
          contactGateState: String(candidate.contact_gate_state || "locked"),
          lifecycleStatus: lifecycleStatus?.lifecycleStatus ?? null,
          latestStatus: lifecycleStatus?.latestStatus ?? null,
          latestStatusAt: lifecycleStatus?.latestStatusAt ?? null,
          unreadStatusCount,
          latestEstimateStatus: estimateSummary?.latest_estimate_status
            ? String(estimateSummary.latest_estimate_status)
            : null,
          estimateCount: Number(estimateSummary?.estimate_count || 0),
          activeEstimateId: estimateSummary?.active_estimate_id
            ? String(estimateSummary.active_estimate_id)
            : null,
          latestPaymentRequestStatus: paymentSummary?.latest_payment_request_status
            ? String(paymentSummary.latest_payment_request_status)
            : null,
          paymentRequestCount: Number(paymentSummary?.payment_request_count || 0),
          latestScheduleStatus: scheduleSummary?.latest_schedule_status
            ? String(scheduleSummary.latest_schedule_status)
            : null,
          scheduleProposalCount: Number(scheduleSummary?.schedule_proposal_count || 0),
          activeScheduleProposalId: scheduleSummary?.active_schedule_proposal_id
            ? String(scheduleSummary.active_schedule_proposal_id)
            : null,
          latestWorkStatus: jobWorkspace?.status ? String(jobWorkspace.status) : null,
          latestCheckpointStatus: checkpointSummary?.latest_checkpoint_status
            ? String(checkpointSummary.latest_checkpoint_status)
            : null,
          checkpointCount: Number(checkpointSummary?.checkpoint_count || 0),
          openCheckpointCount: Number(checkpointSummary?.open_checkpoint_count || 0),
          latestChangeOrderStatus: changeOrderSummary?.latest_change_order_status
            ? String(changeOrderSummary.latest_change_order_status)
            : null,
          changeOrderCount: Number(changeOrderSummary?.change_order_count || 0),
          openChangeOrderCount: Number(changeOrderSummary?.open_change_order_count || 0),
          latestPunchListStatus: punchSummary?.latest_punch_status
            ? String(punchSummary.latest_punch_status)
            : null,
          punchItemCount: Number(punchSummary?.punch_item_count || 0),
          openPunchItemCount: Number(punchSummary?.open_punch_item_count || 0),
          latestCompletionStatus: completionSummary?.latest_completion_status
            ? String(completionSummary.latest_completion_status)
            : null,
          activeCompletionRequestId: completionSummary?.active_completion_request_id
            ? String(completionSummary.active_completion_request_id)
            : null,
          latestInvoiceStatus: invoiceSummary?.latest_invoice_status
            ? String(invoiceSummary.latest_invoice_status)
            : null,
          invoiceCount: Number(invoiceSummary?.invoice_count || 0),
          activeInvoiceId: invoiceSummary?.active_invoice_id
            ? String(invoiceSummary.active_invoice_id)
            : null,
          latestReceiptStatus: receiptSummary?.latest_receipt_status
            ? String(receiptSummary.latest_receipt_status)
            : null,
          latestPaymentRecordStatus: receiptSummary?.latest_payment_record_status
            ? String(receiptSummary.latest_payment_record_status)
            : null,
          receiptCount: Number(receiptSummary?.receipt_count || 0),
          completionBlockedReason:
            completionSummary?.latest_completion_status === "requested" &&
            Number(punchSummary?.open_punch_item_count || 0) > 0
              ? "open_punch_items"
              : null,
          jobWorkspaceId: jobWorkspace?.id ? String(jobWorkspace.id) : null,
          activeStage: jobWorkspace?.active_stage ? String(jobWorkspace.active_stage) : null,
          latestJobStatus: jobWorkspace?.status ? String(jobWorkspace.status) : null,
          currentPhase:
            latestTimelineItem?.phase ??
            (jobWorkspace?.active_stage ? String(jobWorkspace.active_stage) : "request"),
          allowedLifecycleActions,
          nextActionForRequester: nextRequester,
          nextActionForBusiness: nextBusiness,
          trustOutcomeStatus: trustOutcome.trustSummaryLabel,
          completionStatus: trustOutcome.completionConfirmedByRequester ? "confirmed" : "pending",
          financialStatus:
            (invoiceSummary?.latest_invoice_status
              ? String(invoiceSummary.latest_invoice_status)
              : null) ||
            (receiptSummary?.latest_receipt_status
              ? String(receiptSummary.latest_receipt_status)
              : null) ||
            "none",
          timelinePreview: timelineItems.slice(Math.max(0, timelineItems.length - 5)),
          latestTimelineItem,
          trustOutcome,
          visibilityState: String(candidate.visibility_state || "private"),
          allowedActions: {
            canRespond: true,
            canRequestContact: true,
          },
          responseState: latestResponse ? String(latestResponse.response_type || "") : null,
          response: latestResponse
            ? {
                responseType: String(latestResponse.response_type || ""),
                message: latestResponse.message ? String(latestResponse.message) : null,
                availability: latestResponse.availability
                  ? String(latestResponse.availability)
                  : null,
                estimatedTiming: latestResponse.estimated_timing
                  ? String(latestResponse.estimated_timing)
                  : null,
                contactRequestState: String(latestResponse.contact_request_state || "locked"),
                createdAt: latestResponse.created_at || null,
              }
            : null,
          createdAt: candidate.created_at || null,
          updatedAt: candidate.updated_at || null,
          homeownerContact: null,
          timeline: timelineItems,
        });
      } catch (error) {
        console.error("Error fetching contractor routed direct connect request detail:", error);
        return res.status(500).json({
          message: "Failed to load request detail",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/contractor/requests/:id/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const parse = contractorConsoleResponseSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid response payload", issues: parse.error.flatten() });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;

        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Request not available for this contractor" });
        }

        const existing = contractorId
          ? await db.execute(sql`
              SELECT id
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND (
                  contractor_id = ${contractorId}
                  OR responder_user_id = ${userId}
                )
              ORDER BY created_at DESC
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT id
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND responder_user_id = ${userId}
              ORDER BY created_at DESC
              LIMIT 1
            `);
        if (((existing.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "A response already exists for this request." });
        }

        const responseType = parse.data.responseType;
        const canRequestContact =
          responseType === "interested" || responseType === "need_more_info";
        await recordContractorResponse({
          requestId,
          contractorId,
          responderUserId: userId,
          responseType,
          message: parse.data.message ? String(parse.data.message).trim() : null,
          availability: parse.data.availability ? String(parse.data.availability).trim() : null,
          estimatedTiming: parse.data.estimatedTiming
            ? String(parse.data.estimatedTiming).trim()
            : null,
          contactRequestState: canRequestContact ? "contractor_requested" : "locked",
        });
        await appendDispatchEvent({
          requestId,
          actorType: "contractor",
          actorId: userId,
          eventType: "contractor_responded",
          metadata: { responseType },
        });

        return res.status(200).json({
          ok: true,
          requestId,
          responseType,
          contactRequestState: canRequestContact ? "contractor_requested" : "locked",
        });
      } catch (error) {
        console.error("Error recording contractor console response:", error);
        return res.status(500).json({
          message: "Failed to submit response",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/contractor/requests/:id/request-contact",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id || "").trim();
        if (!requestId) return res.status(400).json({ message: "Request id is required" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;

        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${requestId}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Request not available for this contractor" });
        }

        const latestResponseResult = contractorId
          ? await db.execute(sql`
              SELECT response_type
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND (
                  contractor_id = ${contractorId}
                  OR responder_user_id = ${userId}
                )
              ORDER BY created_at DESC
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT response_type
              FROM direct_connect_contractor_responses
              WHERE request_id = ${requestId}
                AND responder_user_id = ${userId}
              ORDER BY created_at DESC
              LIMIT 1
            `);
        const latestResponse = ((latestResponseResult.rows || []) as any[])[0];
        const responseType = String(latestResponse?.response_type || "");
        if (!["interested", "need_more_info"].includes(responseType)) {
          return res.status(409).json({
            message: "Submit an interested or need_more_info response before requesting contact.",
          });
        }

        await setDispatchContactGateState({ requestId, nextState: "contractor_requested" });
        await appendDispatchEvent({
          requestId,
          actorType: "contractor",
          actorId: userId,
          eventType: "contact_requested",
          metadata: { via: "contractor_console" },
        });

        return res.status(200).json({
          ok: true,
          requestId,
          contactGateState: "contractor_requested",
        });
      } catch (error) {
        console.error("Error requesting contact from contractor console:", error);
        return res.status(500).json({
          message: "Failed to request contact",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const parse = estimateCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id, active_stage, status
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const dispatchRows = await db.execute(sql`
          SELECT contact_gate_state
          FROM direct_connect_dispatch_requests
          WHERE id = ${String(workspace.request_id)}
          LIMIT 1
        `);
        const contactGateState = String(
          ((dispatchRows.rows || []) as any[])[0]?.contact_gate_state || "locked"
        );
        if (contactGateState !== "released") {
          return res.status(409).json({ message: "Estimate creation requires released contact." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;

        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create this estimate." });
        }

        const estimateId = createId("est");
        await db.execute(sql`
          INSERT INTO job_estimates (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id, title, scope_summary,
            status, subtotal_materials, subtotal_labor, subtotal_other, total_estimate, terms, expiration_date,
            created_by, created_at, updated_at
          )
          VALUES (
            ${estimateId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.scopeSummary.trim()},
            'draft',
            0,
            0,
            ${parse.data.subtotalOther ?? 0},
            ${parse.data.subtotalOther ?? 0},
            ${parse.data.terms ? parse.data.terms.trim() : null},
            ${parse.data.expirationDate ? new Date(parse.data.expirationDate).toISOString() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'estimate', status = 'estimate_draft', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_started",
          metadata: { jobWorkspaceId, estimateId },
        });

        return res.status(201).json({
          estimateId,
          jobWorkspaceId,
          status: "draft",
          requestId: String(workspace.request_id),
        });
      } catch (error) {
        console.error("Error creating estimate:", error);
        return res.status(500).json({
          message: "Failed to create estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/line-items",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateLineItemSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid line item payload", issues: parse.error.flatten() });
        }
        const estimateRows = await db.execute(sql`
          SELECT e.id, e.workspace_id, e.request_id, e.status
          FROM job_estimates e
          WHERE e.id = ${estimateId}
            AND e.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const estimateStatus = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(estimateStatus)) {
          return res.status(409).json({
            message: "Line items can be edited only while estimate is draft or change requested.",
          });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can edit this estimate." });
        }

        const quantity = Number(parse.data.quantity);
        const unitPrice = parse.data.unitCost ?? parse.data.rate ?? 0;
        const totalCost = Number((quantity * Number(unitPrice)).toFixed(2));
        const lineId = createId("eli");
        await db.execute(sql`
          INSERT INTO job_estimate_line_items (
            id, estimate_id, line_type, name, description, quantity, unit, rate, unit_price, total_cost, supplier, sku, notes, created_at
          )
          VALUES (
            ${lineId},
            ${estimateId},
            ${parse.data.lineType},
            ${parse.data.name.trim()},
            ${parse.data.description ? parse.data.description.trim() : null},
            ${quantity},
            ${parse.data.unit.trim()},
            ${parse.data.rate ?? null},
            ${parse.data.unitCost ?? null},
            ${totalCost},
            ${parse.data.supplier ? parse.data.supplier.trim() : null},
            ${parse.data.sku ? parse.data.sku.trim() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            now()
          )
        `);

        const totalsRows = await db.execute(sql`
          SELECT
            COALESCE(SUM(CASE WHEN line_type = 'material' THEN total_cost ELSE 0 END), 0) AS subtotal_materials,
            COALESCE(SUM(CASE WHEN line_type = 'labor' THEN total_cost ELSE 0 END), 0) AS subtotal_labor,
            COALESCE(SUM(CASE WHEN line_type NOT IN ('material', 'labor') THEN total_cost ELSE 0 END), 0) AS subtotal_other_lines
          FROM job_estimate_line_items
          WHERE estimate_id = ${estimateId}
        `);
        const totals = ((totalsRows.rows || []) as any[])[0] || {};
        const material = toNumber(totals.subtotal_materials);
        const labor = toNumber(totals.subtotal_labor);
        const otherLines = toNumber(totals.subtotal_other_lines);
        const currentEstimateRows = await db.execute(sql`
          SELECT subtotal_other
          FROM job_estimates
          WHERE id = ${estimateId}
          LIMIT 1
        `);
        const fixedOther = toNumber(((currentEstimateRows.rows || []) as any[])[0]?.subtotal_other);
        const subtotalOther = Number((otherLines + fixedOther).toFixed(2));
        const totalEstimate = Number((material + labor + subtotalOther).toFixed(2));
        await db.execute(sql`
          UPDATE job_estimates
          SET subtotal_materials = ${material},
              subtotal_labor = ${labor},
              subtotal_other = ${subtotalOther},
              total_estimate = ${totalEstimate},
              updated_at = now()
          WHERE id = ${estimateId}
        `);

        await appendDispatchEvent({
          requestId: String(estimate.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_line_item_added",
          metadata: { estimateId, lineType: parse.data.lineType, lineId },
        });

        return res.status(201).json({
          lineItemId: lineId,
          estimateId,
          totals: {
            subtotalMaterials: material,
            subtotalLabor: labor,
            subtotalOther,
            totalEstimate,
          },
        });
      } catch (error) {
        console.error("Error adding estimate line item:", error);
        return res.status(500).json({
          message: "Failed to add estimate line item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        if (!jobWorkspaceId || !estimateId) {
          return res.status(400).json({ message: "jobWorkspaceId and estimateId are required" });
        }
        const rows = await db.execute(sql`
          SELECT
            e.id,
            e.workspace_id,
            e.request_id,
            e.requester_user_id,
            e.title,
            e.scope_summary,
            e.status,
            e.subtotal_materials,
            e.subtotal_labor,
            e.subtotal_other,
            e.total_estimate,
            e.terms,
            e.expiration_date,
            e.sent_at,
            e.responded_at,
            e.created_at,
            e.updated_at
          FROM job_estimates e
          WHERE e.id = ${estimateId}
            AND e.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        const requesterUserId = String(estimate.requester_user_id || "").trim();
        const isRequester = requesterUserId === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(estimate.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.contractor_id = ${contractorId}
                    OR c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `)
            : await db.execute(sql`
                SELECT c.request_id
                FROM direct_connect_dispatch_candidates c
                WHERE c.request_id = ${String(estimate.request_id)}
                  AND c.eligibility_state = 'eligible'
                  AND (
                    c.responder_user_id = ${userId}
                    OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                  )
                LIMIT 1
              `);
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Estimate not available for this account." });
          }
        }
        if (isRequester && status === "draft") {
          return res.status(404).json({ message: "Estimate not available" });
        }
        const lineRows = await db.execute(sql`
          SELECT id, line_type, name, description, quantity, unit, rate, unit_price, total_cost, supplier, sku, notes
          FROM job_estimate_line_items
          WHERE estimate_id = ${estimateId}
          ORDER BY created_at ASC
        `);
        return res.status(200).json({
          estimateId: String(estimate.id),
          jobWorkspaceId: String(estimate.workspace_id),
          requestId: String(estimate.request_id || ""),
          title: String(estimate.title || ""),
          scopeSummary: String(estimate.scope_summary || ""),
          status,
          subtotalMaterials: toNumber(estimate.subtotal_materials),
          subtotalLabor: toNumber(estimate.subtotal_labor),
          subtotalOther: toNumber(estimate.subtotal_other),
          totalEstimate: toNumber(estimate.total_estimate),
          terms: estimate.terms ? String(estimate.terms) : null,
          expirationDate: estimate.expiration_date || null,
          sentAt: estimate.sent_at || null,
          respondedAt: estimate.responded_at || null,
          createdAt: estimate.created_at || null,
          updatedAt: estimate.updated_at || null,
          lineItems: ((lineRows.rows || []) as any[]).map((item: any) => ({
            id: String(item.id),
            lineType: String(item.line_type || "other"),
            name: String(item.name || ""),
            description: item.description ? String(item.description) : null,
            quantity: Number(item.quantity || 0),
            unit: item.unit ? String(item.unit) : null,
            rate: item.rate === null || item.rate === undefined ? null : Number(item.rate),
            unitCost:
              item.unit_price === null || item.unit_price === undefined
                ? null
                : Number(item.unit_price),
            totalCost: Number(item.total_cost || 0),
            supplier: item.supplier ? String(item.supplier) : null,
            sku: item.sku ? String(item.sku) : null,
            notes: item.notes ? String(item.notes) : null,
          })),
        });
      } catch (error) {
        console.error("Error fetching estimate:", error);
        return res
          .status(500)
          .json({ message: "Failed to load estimate", requestId: (req as any).requestId || null });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate update payload", issues: parse.error.flatten() });
        }
        const estimateRows = await db.execute(sql`
          SELECT id, request_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(status)) {
          return res
            .status(409)
            .json({ message: "Only draft or change-requested estimates can be revised." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can revise this estimate." });
        }
        const payload = parse.data;
        await db.execute(sql`
          UPDATE job_estimates
          SET
            title = COALESCE(${payload.title ? payload.title.trim() : null}, title),
            scope_summary = COALESCE(${payload.scopeSummary ? payload.scopeSummary.trim() : null}, scope_summary),
            terms = COALESCE(${payload.terms ? payload.terms.trim() : null}, terms),
            expiration_date = COALESCE(${payload.expirationDate ? new Date(payload.expirationDate).toISOString() : null}, expiration_date),
            status = COALESCE(${payload.status ?? null}, status),
            updated_at = now()
          WHERE id = ${estimateId}
        `);
        const updateEventType = payload.status === "void" ? "estimate_voided" : "estimate_started";
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: updateEventType,
          metadata: { estimateId, revised: true },
        });
        return res.status(200).json({ ok: true, estimateId });
      } catch (error) {
        console.error("Error updating estimate:", error);
        return res.status(500).json({
          message: "Failed to update estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/send",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateSendSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate send payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        const status = normalizeEstimateStatus(estimate.status);
        if (!["draft", "change_requested"].includes(status)) {
          return res.status(409).json({ message: "Only draft or revised estimates can be sent." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(estimate.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can send this estimate." });
        }
        await db.execute(sql`
          UPDATE job_estimates
          SET status = 'sent', sent_at = now(), updated_at = now()
          WHERE id = ${estimateId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'estimate', status = 'estimate_sent', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: "estimate_sent",
          metadata: { estimateId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(estimate.request_id || ""),
          eventType: "direct_connect_estimate_sent",
          title: "Estimate sent",
          summary: "A contractor sent an estimate for this request.",
        });
        return res.status(200).json({ ok: true, estimateId, status: "sent" });
      } catch (error) {
        console.error("Error sending estimate:", error);
        return res
          .status(500)
          .json({ message: "Failed to send estimate", requestId: (req as any).requestId || null });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/estimates/:estimateId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const estimateId = String(req.params.estimateId || "").trim();
        const parse = estimateRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid estimate response payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_estimates
          WHERE id = ${estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((rows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        if (String(estimate.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this estimate." });
        }
        const status = normalizeEstimateStatus(estimate.status);
        if (status !== "sent") {
          return res.status(409).json({ message: "Only sent estimates can be responded to." });
        }

        let nextStatus: "accepted" | "change_requested" | "declined" = "declined";
        let eventType: "estimate_accepted" | "estimate_change_requested" | "estimate_declined" =
          "estimate_declined";
        let workspaceStage: "acceptance" | "estimate" = "estimate";
        let workspaceStatus = "estimate_declined";
        if (parse.data.decision === "accept") {
          nextStatus = "accepted";
          eventType = "estimate_accepted";
          workspaceStage = "acceptance";
          workspaceStatus = "estimate_accepted";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "estimate_change_requested";
          workspaceStage = "estimate";
          workspaceStatus = "estimate_change_requested";
        }

        await db.execute(sql`
          UPDATE job_estimates
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${estimateId}
        `);
        if (nextStatus === "accepted") {
          await db.execute(sql`
            INSERT INTO job_acceptances (id, workspace_id, estimate_id, accepted_by, accepted_at, note)
            VALUES (${createId("acc")}, ${jobWorkspaceId}, ${estimateId}, ${userId}, now(), ${parse.data.note ? parse.data.note.trim() : null})
          `);
        }
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = ${workspaceStage}, status = ${workspaceStatus}, updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(estimate.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { estimateId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        if (eventType === "estimate_accepted") {
          await appendHomeIdTimelineEventFromDirectConnect({
            requestId: String(estimate.request_id || ""),
            eventType: "direct_connect_estimate_accepted",
            title: "Estimate accepted",
            summary: "The request owner accepted an estimate.",
          });
        }
        return res.status(200).json({ ok: true, estimateId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to estimate:", error);
        return res.status(500).json({
          message: "Failed to respond to estimate",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });
        const parse = paymentRequestCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid payment request payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id, active_stage
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const estimateRows = await db.execute(sql`
          SELECT id, status
          FROM job_estimates
          WHERE id = ${parse.data.estimateId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const estimate = ((estimateRows.rows || []) as any[])[0] || null;
        if (!estimate) return res.status(404).json({ message: "Estimate not found" });
        if (normalizeEstimateStatus(estimate.status) !== "accepted") {
          return res
            .status(409)
            .json({ message: "Payment requests require an accepted estimate." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can request deposit or prepayment." });
        }

        const paymentRequestId = createId("payreq");
        await db.execute(sql`
          INSERT INTO job_payment_requests (
            id, workspace_id, request_id, estimate_id, requester_user_id, business_id, contractor_id,
            payment_type, amount, currency, description, due_date, status, note, created_by, sent_at, created_at, updated_at
          )
          VALUES (
            ${paymentRequestId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(parse.data.estimateId)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.type},
            ${parse.data.amount},
            'USD',
            ${parse.data.description.trim()},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            'sent',
            ${parse.data.note ? parse.data.note.trim() : null},
            ${userId},
            now(),
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'deposit', status = 'deposit_requested', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "deposit_requested",
          metadata: { paymentRequestId, type: parse.data.type, amount: parse.data.amount },
        });

        return res.status(201).json({
          paymentRequestId,
          jobWorkspaceId,
          status: "sent",
        });
      } catch (error) {
        console.error("Error creating payment request:", error);
        return res.status(500).json({
          message: "Failed to create payment request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/payment-requests/:paymentRequestId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const paymentRequestId = String(req.params.paymentRequestId || "").trim();
        const parse = paymentRequestRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid payment request response payload",
            issues: parse.error.flatten(),
          });
        }

        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_payment_requests
          WHERE id = ${paymentRequestId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const paymentRequest = ((rows.rows || []) as any[])[0] || null;
        if (!paymentRequest) return res.status(404).json({ message: "Payment request not found" });
        if (String(paymentRequest.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this payment request." });
        }

        let nextStatus: string = "acknowledged";
        let eventType:
          | "deposit_acknowledged"
          | "deposit_paid_outside_platform"
          | "deposit_waived"
          | "payment_request_canceled" = "deposit_acknowledged";
        if (parse.data.decision === "paid_outside_platform") {
          nextStatus = "paid_outside_platform";
          eventType = "deposit_paid_outside_platform";
        } else if (parse.data.decision === "waive") {
          nextStatus = "waived";
          eventType = "deposit_waived";
        } else if (parse.data.decision === "decline") {
          nextStatus = "canceled";
          eventType = "payment_request_canceled";
        }

        await db.execute(sql`
          UPDATE job_payment_requests
          SET status = ${nextStatus}, acknowledged_at = now(), note = COALESCE(${parse.data.note ? parse.data.note.trim() : null}, note), updated_at = now()
          WHERE id = ${paymentRequestId}
        `);
        await appendDispatchEvent({
          requestId: String(paymentRequest.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { paymentRequestId, decision: parse.data.decision },
        });

        return res.status(200).json({ ok: true, paymentRequestId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to payment request:", error);
        return res.status(500).json({
          message: "Failed to respond to payment request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });
        const parse = scheduleProposalCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid schedule proposal payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        if (parse.data.estimateId) {
          const estimateRows = await db.execute(sql`
            SELECT id, status
            FROM job_estimates
            WHERE id = ${parse.data.estimateId}
              AND workspace_id = ${jobWorkspaceId}
            LIMIT 1
          `);
          const estimate = ((estimateRows.rows || []) as any[])[0] || null;
          if (!estimate || normalizeEstimateStatus(estimate.status) !== "accepted") {
            return res
              .status(409)
              .json({ message: "Schedule proposals require an accepted estimate." });
          }
        } else {
          const acceptedEstimateRows = await db.execute(sql`
            SELECT id
            FROM job_estimates
            WHERE workspace_id = ${jobWorkspaceId}
              AND status = 'accepted'
            LIMIT 1
          `);
          if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
            return res
              .status(409)
              .json({ message: "Schedule proposals require an accepted estimate." });
          }
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can propose schedule." });
        }

        const scheduleProposalId = createId("sched");
        await db.execute(sql`
          INSERT INTO job_schedule_proposals (
            id, workspace_id, request_id, estimate_id, requester_user_id, business_id, contractor_id,
            proposed_start, proposed_end, time_window, notes, status, created_by, created_at, updated_at
          )
          VALUES (
            ${scheduleProposalId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${parse.data.estimateId ? parse.data.estimateId : null},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${new Date(parse.data.proposedStart).toISOString()},
            ${parse.data.proposedEnd ? new Date(parse.data.proposedEnd).toISOString() : null},
            ${parse.data.timeWindow ? parse.data.timeWindow.trim() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            'proposed',
            ${userId},
            now(),
            now()
          )
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'scheduling', status = 'schedule_proposed', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "schedule_proposed",
          metadata: { scheduleProposalId },
        });
        return res.status(201).json({ scheduleProposalId, status: "proposed", jobWorkspaceId });
      } catch (error) {
        console.error("Error proposing schedule:", error);
        return res.status(500).json({
          message: "Failed to propose schedule",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/schedule-proposals/:scheduleProposalId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const scheduleProposalId = String(req.params.scheduleProposalId || "").trim();
        const parse = scheduleProposalRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid schedule response payload", issues: parse.error.flatten() });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_schedule_proposals
          WHERE id = ${scheduleProposalId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const proposal = ((rows.rows || []) as any[])[0] || null;
        if (!proposal) return res.status(404).json({ message: "Schedule proposal not found" });
        if (String(proposal.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this schedule proposal." });
        }
        if (String(proposal.status || "proposed") !== "proposed") {
          return res.status(409).json({ message: "Only proposed schedules can be responded to." });
        }
        let nextStatus: "accepted" | "change_requested" | "declined" = "declined";
        let eventType: "schedule_accepted" | "schedule_change_requested" | "schedule_declined" =
          "schedule_declined";
        let workspaceStatus = "schedule_declined";
        if (parse.data.decision === "accept") {
          nextStatus = "accepted";
          eventType = "schedule_accepted";
          workspaceStatus = "job_scheduled";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "schedule_change_requested";
          workspaceStatus = "schedule_change_requested";
        }
        await db.execute(sql`
          UPDATE job_schedule_proposals
          SET status = ${nextStatus}, notes = COALESCE(${parse.data.note ? parse.data.note.trim() : null}, notes), responded_at = now(), updated_at = now()
          WHERE id = ${scheduleProposalId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'scheduling', status = ${workspaceStatus}, updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(proposal.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { scheduleProposalId, decision: parse.data.decision },
        });
        if (eventType === "schedule_accepted") {
          await appendDispatchEvent({
            requestId: String(proposal.request_id || ""),
            actorType: "system",
            actorId: null,
            eventType: "job_scheduled",
            metadata: { scheduleProposalId },
          });
          await appendHomeIdTimelineEventFromDirectConnect({
            requestId: String(proposal.request_id || ""),
            eventType: "direct_connect_scheduled",
            title: "Job scheduled",
            summary: "A schedule proposal was accepted for this request.",
          });
        }
        return res.status(200).json({ ok: true, scheduleProposalId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to schedule proposal:", error);
        return res.status(500).json({
          message: "Failed to respond to schedule proposal",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/start-work",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        if (!jobWorkspaceId)
          return res.status(400).json({ message: "Job workspace id is required" });

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Work start requires an accepted estimate." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Only the eligible business can start work." });
        }

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'in_progress', status = 'in_progress', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "work_started",
          metadata: { jobWorkspaceId },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(workspace.request_id),
          eventType: "direct_connect_work_started",
          title: "Work started",
          summary: "A contractor started work for this request.",
        });
        return res.status(200).json({ ok: true, jobWorkspaceId, status: "in_progress" });
      } catch (error) {
        console.error("Error starting work:", error);
        return res
          .status(500)
          .json({ message: "Failed to start work", requestId: (req as any).requestId || null });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = checkpointCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid checkpoint payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Checkpoints require an accepted estimate." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create checkpoints." });
        }

        const checkpointId = createId("chk");
        const checkpointStatus = parse.data.status || "planned";
        await db.execute(sql`
          INSERT INTO job_checkpoints (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id,
            title, description, status, due_date, created_by, created_at, updated_at
          )
          VALUES (
            ${checkpointId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.description ? parse.data.description.trim() : null},
            ${checkpointStatus},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            ${userId},
            now(),
            now()
          )
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "checkpoint_created",
          metadata: { checkpointId, status: checkpointStatus },
        });
        return res.status(201).json({ checkpointId, status: checkpointStatus, jobWorkspaceId });
      } catch (error) {
        console.error("Error creating checkpoint:", error);
        return res.status(500).json({
          message: "Failed to create checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const checkpointId = String(req.params.checkpointId || "").trim();
        const parse = checkpointUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid checkpoint update payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const checkpointRows = await db.execute(sql`
          SELECT id, status
          FROM job_checkpoints
          WHERE id = ${checkpointId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const checkpoint = ((checkpointRows.rows || []) as any[])[0] || null;
        if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can update checkpoints." });
        }

        await db.execute(sql`
          UPDATE job_checkpoints
          SET
            title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
            description = COALESCE(${parse.data.description ? parse.data.description.trim() : null}, description),
            due_date = CASE
              WHEN ${parse.data.dueDate === null} THEN NULL
              WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz
              ELSE due_date
            END,
            status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
            completed_at = CASE WHEN ${parse.data.status === "completed"} THEN now() ELSE completed_at END,
            updated_at = now()
          WHERE id = ${checkpointId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "checkpoint_updated",
          metadata: { checkpointId, status: parse.data.status || String(checkpoint.status || "") },
        });
        if (parse.data.status === "completed") {
          await appendDispatchEvent({
            requestId: String(workspace.request_id),
            actorType: "contractor",
            actorId: userId,
            eventType: "checkpoint_completed",
            metadata: { checkpointId },
          });
        }
        return res.status(200).json({ ok: true, checkpointId });
      } catch (error) {
        console.error("Error updating checkpoint:", error);
        return res.status(500).json({
          message: "Failed to update checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/checkpoints/:checkpointId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const checkpointId = String(req.params.checkpointId || "").trim();
        const parse = checkpointRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid checkpoint response payload",
            issues: parse.error.flatten(),
          });
        }
        const rows = await db.execute(sql`
          SELECT c.id, c.request_id, c.requester_user_id
          FROM job_checkpoints c
          WHERE c.id = ${checkpointId}
            AND c.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const checkpoint = ((rows.rows || []) as any[])[0] || null;
        if (!checkpoint) return res.status(404).json({ message: "Checkpoint not found" });
        if (String(checkpoint.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this checkpoint." });
        }

        const nextStatus = parse.data.decision === "approve" ? "approved" : "issue_reported";
        const eventType =
          parse.data.decision === "approve" ? "checkpoint_approved" : "checkpoint_issue_reported";
        await db.execute(sql`
          UPDATE job_checkpoints
          SET status = ${nextStatus}, requester_responded_at = now(), updated_at = now()
          WHERE id = ${checkpointId}
        `);
        await appendDispatchEvent({
          requestId: String(checkpoint.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { checkpointId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, checkpointId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to checkpoint:", error);
        return res.status(500).json({
          message: "Failed to respond to checkpoint",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = changeOrderCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid change order payload", issues: parse.error.flatten() });
        }
        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(sql`
          SELECT id
          FROM job_estimates
          WHERE workspace_id = ${jobWorkspaceId}
            AND status = 'accepted'
          LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Change orders require an accepted estimate." });
        }
        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create change orders." });
        }

        const materialDelta = parse.data.materialDelta ?? 0;
        const laborDelta = parse.data.laborDelta ?? 0;
        const otherDelta = parse.data.otherDelta ?? 0;
        const totalDelta = materialDelta + laborDelta + otherDelta;
        const changeOrderId = createId("chg");
        await db.execute(sql`
          INSERT INTO job_change_orders (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id,
            title, reason, scope_change_summary, material_delta, labor_delta, other_delta, total_delta,
            timeline_delta_days, status, created_by, sent_at, created_at, updated_at
          )
          VALUES (
            ${changeOrderId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${parse.data.title.trim()},
            ${parse.data.reason ? parse.data.reason.trim() : null},
            ${parse.data.scopeChangeSummary.trim()},
            ${materialDelta},
            ${laborDelta},
            ${otherDelta},
            ${totalDelta},
            ${parse.data.timelineDeltaDays ?? null},
            'sent',
            ${userId},
            now(),
            now(),
            now()
          )
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "change_order_created",
          metadata: { changeOrderId, totalDelta },
        });
        await appendHomeIdTimelineEventFromDirectConnect({
          requestId: String(workspace.request_id),
          eventType: "direct_connect_change_order_created",
          title: "Change order created",
          summary: "A change order was created for this request.",
        });
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "change_order_sent",
          metadata: {
            changeOrderId,
            totalDelta,
            note: parse.data.note ? parse.data.note.trim() : null,
          },
        });
        return res.status(201).json({ changeOrderId, status: "sent", totalDelta, jobWorkspaceId });
      } catch (error) {
        console.error("Error creating change order:", error);
        return res.status(500).json({
          message: "Failed to create change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const changeOrderId = String(req.params.changeOrderId || "").trim();

        const rows = await db.execute(sql`
          SELECT c.*, w.requester_user_id
          FROM job_change_orders c
          JOIN direct_connect_job_workspaces w ON w.id = c.workspace_id
          WHERE c.id = ${changeOrderId}
            AND c.workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const changeOrder = ((rows.rows || []) as any[])[0] || null;
        if (!changeOrder) return res.status(404).json({ message: "Change order not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const isRequester = String(changeOrder.requester_user_id || "") === userId;
        const isEligibleBusiness = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(changeOrder.request_id || "")}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(changeOrder.request_id || "")}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!isRequester && !((isEligibleBusiness.rows || []) as any[])[0]) {
          return res.status(403).json({ message: "Not allowed to view this change order." });
        }

        return res.status(200).json({
          id: String(changeOrder.id),
          jobWorkspaceId: String(changeOrder.workspace_id),
          requestId: String(changeOrder.request_id || ""),
          title: String(changeOrder.title || ""),
          reason: changeOrder.reason ? String(changeOrder.reason) : null,
          scopeChangeSummary: String(changeOrder.scope_change_summary || ""),
          materialDelta: Number(changeOrder.material_delta || 0),
          laborDelta: Number(changeOrder.labor_delta || 0),
          otherDelta: Number(changeOrder.other_delta || 0),
          totalDelta: Number(changeOrder.total_delta || 0),
          timelineDeltaDays:
            changeOrder.timeline_delta_days === null ||
            changeOrder.timeline_delta_days === undefined
              ? null
              : Number(changeOrder.timeline_delta_days),
          status: String(changeOrder.status || "draft"),
          sentAt: changeOrder.sent_at || null,
          respondedAt: changeOrder.responded_at || null,
          createdAt: changeOrder.created_at || null,
          updatedAt: changeOrder.updated_at || null,
        });
      } catch (error) {
        console.error("Error loading change order:", error);
        return res.status(500).json({
          message: "Failed to load change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/change-orders/:changeOrderId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const changeOrderId = String(req.params.changeOrderId || "").trim();
        const parse = changeOrderRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res.status(400).json({
            message: "Invalid change order response payload",
            issues: parse.error.flatten(),
          });
        }
        const rows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, status
          FROM job_change_orders
          WHERE id = ${changeOrderId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const changeOrder = ((rows.rows || []) as any[])[0] || null;
        if (!changeOrder) return res.status(404).json({ message: "Change order not found" });
        if (String(changeOrder.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this change order." });
        }
        if (String(changeOrder.status || "sent") !== "sent") {
          return res.status(409).json({ message: "Only sent change orders can be responded to." });
        }

        let nextStatus: "approved" | "declined" | "change_requested" = "declined";
        let eventType:
          | "change_order_approved"
          | "change_order_declined"
          | "change_order_change_requested" = "change_order_declined";
        if (parse.data.decision === "approve") {
          nextStatus = "approved";
          eventType = "change_order_approved";
        } else if (parse.data.decision === "request_changes") {
          nextStatus = "change_requested";
          eventType = "change_order_change_requested";
        }

        await db.execute(sql`
          UPDATE job_change_orders
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${changeOrderId}
        `);
        await appendDispatchEvent({
          requestId: String(changeOrder.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { changeOrderId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, changeOrderId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to change order:", error);
        return res.status(500).json({
          message: "Failed to respond to change order",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/ready-for-punchout",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const acceptedEstimateRows = await db.execute(sql`
          SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1
        `);
        if (!((acceptedEstimateRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Punchout requires an accepted estimate." });
        }
        const startedRows = await db.execute(sql`
          SELECT id FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
            AND status IN ('in_progress', 'schedule_proposed', 'schedule_change_requested', 'job_scheduled', 'punchout')
          LIMIT 1
        `);
        if (!((startedRows.rows || []) as any[])[0]) {
          return res.status(409).json({ message: "Punchout requires work to be started." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.contractor_id = ${contractorId}
                  OR c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `)
          : await db.execute(sql`
              SELECT c.request_id
              FROM direct_connect_dispatch_candidates c
              WHERE c.request_id = ${String(workspace.request_id)}
                AND c.eligibility_state = 'eligible'
                AND (
                  c.responder_user_id = ${userId}
                  OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})
                )
              LIMIT 1
            `);
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can start punchout." });
        }

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'punch_list', status = 'punchout', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "punch_list_started",
          metadata: { jobWorkspaceId },
        });
        return res.status(200).json({ ok: true, jobWorkspaceId, status: "punchout" });
      } catch (error) {
        console.error("Error marking ready for punchout:", error);
        return res.status(500).json({
          message: "Failed to mark ready for punchout",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = punchItemCreateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid punch item payload", issues: parse.error.flatten() });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id, business_id, contractor_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(
          sql`SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1`
        );
        if (!((acceptedEstimateRows.rows || []) as any[])[0])
          return res.status(409).json({ message: "Punch list requires an accepted estimate." });

        const isRequester = String(workspace.requester_user_id || "") === userId;
        let canBusinessWrite = false;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          canBusinessWrite = Boolean(((eligibilityResult.rows || []) as any[])[0]);
        }
        if (!isRequester && !canBusinessWrite)
          return res.status(403).json({ message: "Not allowed to create punch list items." });

        const punchItemId = createId("punch");
        await db.execute(sql`
        INSERT INTO job_punch_list_items (
          id, workspace_id, request_id, requester_user_id, business_id, contractor_id, title, description, status, created_by, assigned_to, due_date, created_at, updated_at
        ) VALUES (
          ${punchItemId}, ${jobWorkspaceId}, ${String(workspace.request_id)}, ${String(workspace.requester_user_id || "")},
          ${workspace.business_id ? String(workspace.business_id) : null}, ${workspace.contractor_id ? String(workspace.contractor_id) : null},
          ${parse.data.title.trim()}, ${parse.data.description ? parse.data.description.trim() : null}, 'open', ${userId},
          ${parse.data.assignedTo ? parse.data.assignedTo.trim() : null}, ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}, now(), now()
        )
      `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: isRequester ? "requester" : "contractor",
          actorId: userId,
          eventType: "punch_item_created",
          metadata: { punchItemId },
        });
        return res.status(201).json({ punchItemId, status: "open", jobWorkspaceId });
      } catch (error) {
        console.error("Error creating punch list item:", error);
        return res.status(500).json({
          message: "Failed to create punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const punchItemId = String(req.params.punchItemId || "").trim();
        const parse = punchItemUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid punch item update payload", issues: parse.error.flatten() });

        const rows = await db.execute(sql`
        SELECT p.id, p.request_id, p.requester_user_id, p.status
        FROM job_punch_list_items p
        WHERE p.id = ${punchItemId} AND p.workspace_id = ${jobWorkspaceId}
        LIMIT 1
      `);
        const item = ((rows.rows || []) as any[])[0] || null;
        if (!item) return res.status(404).json({ message: "Punch list item not found" });

        const workspaceRows = await db.execute(
          sql`SELECT request_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0])
          return res
            .status(403)
            .json({ message: "Only the eligible business can update punch list items." });

        await db.execute(sql`
        UPDATE job_punch_list_items
        SET
          title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
          description = COALESCE(${parse.data.description ? parse.data.description.trim() : null}, description),
          assigned_to = CASE WHEN ${parse.data.assignedTo === null} THEN NULL WHEN ${typeof parse.data.assignedTo === "string"} THEN ${parse.data.assignedTo ? parse.data.assignedTo.trim() : null} ELSE assigned_to END,
          due_date = CASE WHEN ${parse.data.dueDate === null} THEN NULL WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz ELSE due_date END,
          status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
          resolved_at = CASE WHEN ${parse.data.status === "resolved"} THEN now() ELSE resolved_at END,
          updated_at = now()
        WHERE id = ${punchItemId}
      `);

        let eventType: "punch_item_acknowledged" | "punch_item_started" | "punch_item_resolved" =
          "punch_item_acknowledged";
        if (parse.data.status === "in_progress") eventType = "punch_item_started";
        if (parse.data.status === "resolved") eventType = "punch_item_resolved";
        await appendDispatchEvent({
          requestId: String(item.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType,
          metadata: { punchItemId, status: parse.data.status || String(item.status || "") },
        });
        return res.status(200).json({ ok: true, punchItemId });
      } catch (error) {
        console.error("Error updating punch list item:", error);
        return res.status(500).json({
          message: "Failed to update punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/punch-list-items/:punchItemId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const punchItemId = String(req.params.punchItemId || "").trim();
        const parse = punchItemRespondSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res.status(400).json({
            message: "Invalid punch item response payload",
            issues: parse.error.flatten(),
          });
        const rows = await db.execute(
          sql`SELECT id, request_id, requester_user_id, status FROM job_punch_list_items WHERE id = ${punchItemId} AND workspace_id = ${jobWorkspaceId} LIMIT 1`
        );
        const item = ((rows.rows || []) as any[])[0] || null;
        if (!item) return res.status(404).json({ message: "Punch list item not found" });
        if (String(item.requester_user_id || "") !== userId)
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to this punch item." });

        let nextStatus: "resolved" | "open" | "waived" = "open";
        let eventType: "punch_item_approved" | "punch_item_rejected" | "punch_item_waived" =
          "punch_item_rejected";
        if (parse.data.decision === "approve_resolved") {
          nextStatus = "resolved";
          eventType = "punch_item_approved";
        } else if (parse.data.decision === "waive_item") {
          nextStatus = "waived";
          eventType = "punch_item_waived";
        }
        await db.execute(
          sql`UPDATE job_punch_list_items SET status = ${nextStatus}, requester_responded_at = now(), updated_at = now() WHERE id = ${punchItemId}`
        );
        await appendDispatchEvent({
          requestId: String(item.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { punchItemId, note: parse.data.note ? parse.data.note.trim() : null },
        });
        return res.status(200).json({ ok: true, punchItemId, status: nextStatus });
      } catch (error) {
        console.error("Error responding to punch list item:", error);
        return res.status(500).json({
          message: "Failed to respond to punch list item",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/completion-request",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = completionRequestCreateSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res
            .status(400)
            .json({ message: "Invalid completion request payload", issues: parse.error.flatten() });

        const workspaceRows = await db.execute(
          sql`SELECT id, request_id, requester_user_id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} LIMIT 1`
        );
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });
        const acceptedEstimateRows = await db.execute(
          sql`SELECT id FROM job_estimates WHERE workspace_id = ${jobWorkspaceId} AND status = 'accepted' LIMIT 1`
        );
        if (!((acceptedEstimateRows.rows || []) as any[])[0])
          return res
            .status(409)
            .json({ message: "Completion request requires an accepted estimate." });
        const startedRows = await db.execute(
          sql`SELECT id FROM direct_connect_job_workspaces WHERE id = ${jobWorkspaceId} AND active_stage IN ('in_progress','punch_list','checkpoint','change_order') LIMIT 1`
        );
        if (!((startedRows.rows || []) as any[])[0])
          return res.status(409).json({ message: "Completion request requires started work." });

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0])
          return res
            .status(403)
            .json({ message: "Only the eligible business can request completion." });

        const completionRequestId = createId("complete");
        await db.execute(sql`
        INSERT INTO job_completion_requests (
          id, workspace_id, request_id, requester_user_id, business_id, contractor_id, status, business_notes, requested_at, created_at, updated_at
        ) VALUES (
          ${completionRequestId}, ${jobWorkspaceId}, ${String(workspace.request_id)}, ${String(workspace.requester_user_id || "")},
          null, ${contractorId}, 'requested', ${parse.data.businessNotes ? parse.data.businessNotes.trim() : null}, now(), now(), now()
        )
      `);
        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "completion_requested",
          metadata: { completionRequestId },
        });
        return res.status(201).json({ completionRequestId, status: "requested", jobWorkspaceId });
      } catch (error) {
        console.error("Error requesting completion:", error);
        return res.status(500).json({
          message: "Failed to request completion",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/completion-request/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = completionRequestRespondSchema.safeParse(req.body ?? {});
        if (!parse.success)
          return res.status(400).json({
            message: "Invalid completion response payload",
            issues: parse.error.flatten(),
          });

        const completionRows = await db.execute(sql`
        SELECT id, request_id, requester_user_id, status
        FROM job_completion_requests
        WHERE workspace_id = ${jobWorkspaceId}
        ORDER BY created_at DESC
        LIMIT 1
      `);
        const completionRequest = ((completionRows.rows || []) as any[])[0] || null;
        if (!completionRequest)
          return res.status(404).json({ message: "Completion request not found" });
        if (String(completionRequest.requester_user_id || "") !== userId)
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to completion." });
        if (String(completionRequest.status || "requested") !== "requested")
          return res.status(409).json({ message: "Completion request is no longer pending." });

        if (parse.data.decision === "confirm") {
          const unresolvedRows = await db.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM job_punch_list_items
          WHERE workspace_id = ${jobWorkspaceId}
            AND status NOT IN ('resolved', 'waived', 'canceled')
        `);
          const unresolvedCount = Number(((unresolvedRows.rows || []) as any[])[0]?.count || 0);
          if (unresolvedCount > 0) {
            return res.status(409).json({
              message: "Unresolved punch list items block completion.",
              completionBlockedReason: "open_punch_items",
            });
          }
        }

        const nextStatus = parse.data.decision === "confirm" ? "confirmed" : "rejected";
        await db.execute(sql`
        UPDATE job_completion_requests
        SET status = ${nextStatus}, requester_notes = ${parse.data.requesterNotes ? parse.data.requesterNotes.trim() : null}, responded_at = now(), updated_at = now()
        WHERE id = ${String(completionRequest.id)}
      `);
        if (parse.data.decision === "confirm") {
          await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'completed', status = 'completed', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);
        }
        await appendDispatchEvent({
          requestId: String(completionRequest.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType:
            parse.data.decision === "confirm" ? "completion_confirmed" : "completion_rejected",
          metadata: { completionRequestId: String(completionRequest.id) },
        });
        if (parse.data.decision === "confirm") {
          await appendDispatchEvent({
            requestId: String(completionRequest.request_id || ""),
            actorType: "system",
            actorId: null,
            eventType: "job_completed",
            metadata: { completionRequestId: String(completionRequest.id) },
          });
          await appendHomeIdTimelineEventFromDirectConnect({
            requestId: String(completionRequest.request_id || ""),
            eventType: "direct_connect_completed",
            title: "Job completed",
            summary: "Direct Connect completion was confirmed for this request.",
          });
          await appendHomeIdCompletedWorkEnrichmentFromDirectConnect({
            requestId: String(completionRequest.request_id || ""),
            completedAt: new Date().toISOString(),
            workSummary: parse.data.requesterNotes ? parse.data.requesterNotes.trim() : null,
          });
        }
        return res.status(200).json({
          ok: true,
          completionRequestId: String(completionRequest.id),
          status: nextStatus,
        });
      } catch (error) {
        console.error("Error responding to completion request:", error);
        return res.status(500).json({
          message: "Failed to respond to completion request",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = invoiceCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res
            .status(409)
            .json({ message: "Invoice creation requires confirmed completion." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can create invoices." });
        }

        const estimateId =
          parse.data.estimateId && parse.data.estimateId.trim().length > 0
            ? parse.data.estimateId.trim()
            : null;

        const invoiceId = createId("inv");
        await db.execute(sql`
          INSERT INTO job_invoices (
            id, workspace_id, request_id, requester_user_id, business_id, contractor_id, estimate_id,
            title, summary, status, subtotal, adjustments, total_due, due_date, terms, created_by, created_at, updated_at
          ) VALUES (
            ${invoiceId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : contractorId},
            ${estimateId},
            ${parse.data.title.trim()},
            ${parse.data.summary.trim()},
            'draft',
            0,
            ${parse.data.adjustments ?? 0},
            ${parse.data.adjustments ?? 0},
            ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null},
            ${parse.data.terms ? parse.data.terms.trim() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'invoicing', status = 'invoice_draft', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: "contractor",
          actorId: userId,
          eventType: "invoice_started",
          metadata: { invoiceId, jobWorkspaceId },
        });

        return res.status(201).json({ invoiceId, status: "draft", jobWorkspaceId });
      } catch (error) {
        console.error("Error creating invoice:", error);
        return res.status(500).json({
          message: "Failed to create invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();

        const rows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, title, summary, status, subtotal, adjustments, total_due, due_date, terms, sent_at, responded_at, created_at, updated_at
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((rows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const status = String(invoice.status || "draft");
        const isRequester = String(invoice.requester_user_id || "") === userId;
        if (isRequester && status === "draft") {
          return res.status(404).json({ message: "Invoice not available" });
        }
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Invoice not available for this account." });
          }
        }

        const lineRows = await db.execute(sql`
          SELECT id, line_type, name, description, quantity, unit, unit_amount, total_amount, source_estimate_line_item_id, source_change_order_id, notes
          FROM job_invoice_line_items
          WHERE invoice_id = ${invoiceId}
          ORDER BY created_at ASC
        `);

        return res.status(200).json({
          invoiceId: String(invoice.id),
          jobWorkspaceId: String(invoice.workspace_id),
          requestId: String(invoice.request_id || ""),
          title: String(invoice.title || ""),
          summary: String(invoice.summary || ""),
          status,
          subtotal: toNumber(invoice.subtotal),
          adjustments: toNumber(invoice.adjustments),
          totalDue: toNumber(invoice.total_due),
          dueDate: invoice.due_date || null,
          terms: invoice.terms ? String(invoice.terms) : null,
          sentAt: invoice.sent_at || null,
          respondedAt: invoice.responded_at || null,
          lineItems: ((lineRows.rows || []) as any[]).map((line) => ({
            id: String(line.id),
            type: String(line.line_type || "other"),
            name: String(line.name || ""),
            description: line.description ? String(line.description) : null,
            quantity: toNumber(line.quantity),
            unit: line.unit ? String(line.unit) : null,
            unitAmount: toNumber(line.unit_amount),
            totalAmount: toNumber(line.total_amount),
            sourceEstimateLineItemId: line.source_estimate_line_item_id
              ? String(line.source_estimate_line_item_id)
              : null,
            sourceChangeOrderId: line.source_change_order_id
              ? String(line.source_change_order_id)
              : null,
            notes: line.notes ? String(line.notes) : null,
          })),
        });
      } catch (error) {
        console.error("Error fetching invoice:", error);
        return res.status(500).json({
          message: "Failed to fetch invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.patch(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceUpdateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice update payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        const status = String(invoice.status || "draft");
        if (!["draft", "disputed"].includes(status)) {
          return res
            .status(409)
            .json({ message: "Invoice can only be edited while draft or disputed." });
        }

        const contractor = await storage.getContractorByUserId(userId);
        const workerProfile = await db
          .select({ id: (workers as any).id })
          .from(workers as any)
          .where(eq((workers as any).userId, userId))
          .limit(1);
        const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
        const contractorId = contractor?.id ? String(contractor.id) : null;
        const eligibilityResult = contractorId
          ? await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            )
          : await db.execute(
              sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(invoice.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
            );
        if (!((eligibilityResult.rows || []) as any[])[0]) {
          return res
            .status(403)
            .json({ message: "Only the eligible business can edit this invoice." });
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET
            title = COALESCE(${parse.data.title ? parse.data.title.trim() : null}, title),
            summary = COALESCE(${parse.data.summary ? parse.data.summary.trim() : null}, summary),
            adjustments = COALESCE(${typeof parse.data.adjustments === "number" ? parse.data.adjustments : null}, adjustments),
            due_date = CASE WHEN ${parse.data.dueDate === null} THEN NULL WHEN ${typeof parse.data.dueDate === "string"} THEN ${parse.data.dueDate ? new Date(parse.data.dueDate).toISOString() : null}::timestamptz ELSE due_date END,
            terms = CASE WHEN ${parse.data.terms === null} THEN NULL WHEN ${typeof parse.data.terms === "string"} THEN ${parse.data.terms ? parse.data.terms.trim() : null} ELSE terms END,
            status = COALESCE(${parse.data.status ? parse.data.status : null}, status),
            updated_at = now()
          WHERE id = ${invoiceId}
        `);

        if (Array.isArray(parse.data.lineItems)) {
          await db.execute(sql`DELETE FROM job_invoice_line_items WHERE invoice_id = ${invoiceId}`);
          for (const rawLine of parse.data.lineItems) {
            const quantity = Number(rawLine.quantity ?? 0);
            const unitAmount = Number(rawLine.unitAmount ?? 0);
            const totalAmount = Number((quantity * unitAmount).toFixed(2));
            const lineId = createId("invli");
            await db.execute(sql`
              INSERT INTO job_invoice_line_items (
                id, invoice_id, line_type, name, description, quantity, unit, unit_amount, total_amount,
                source_estimate_line_item_id, source_change_order_id, notes, created_at
              ) VALUES (
                ${lineId},
                ${invoiceId},
                ${rawLine.type},
                ${rawLine.name.trim()},
                ${rawLine.description ? rawLine.description.trim() : null},
                ${quantity},
                ${rawLine.unit ? rawLine.unit.trim() : null},
                ${unitAmount},
                ${totalAmount},
                ${rawLine.sourceEstimateLineItemId ? rawLine.sourceEstimateLineItemId.trim() : null},
                ${rawLine.sourceChangeOrderId ? rawLine.sourceChangeOrderId.trim() : null},
                ${rawLine.notes ? rawLine.notes.trim() : null},
                now()
              )
            `);
            await appendDispatchEvent({
              requestId: String(invoice.request_id || ""),
              actorType: "contractor",
              actorId: userId,
              eventType: "invoice_line_item_added",
              metadata: { invoiceId, lineItemId: lineId, lineType: rawLine.type },
            });
          }
        }

        const totalsRows = await db.execute(sql`
          SELECT COALESCE(SUM(total_amount), 0) AS subtotal
          FROM job_invoice_line_items
          WHERE invoice_id = ${invoiceId}
        `);
        const subtotal = toNumber(((totalsRows.rows || []) as any[])[0]?.subtotal);
        const invoiceMetaRows = await db.execute(
          sql`SELECT adjustments FROM job_invoices WHERE id = ${invoiceId} LIMIT 1`
        );
        const adjustments = toNumber(((invoiceMetaRows.rows || []) as any[])[0]?.adjustments);
        const totalDue = Number((subtotal + adjustments).toFixed(2));
        await db.execute(sql`
          UPDATE job_invoices
          SET subtotal = ${subtotal}, total_due = ${totalDue}, updated_at = now()
          WHERE id = ${invoiceId}
        `);

        return res.status(200).json({ invoiceId, subtotal, adjustments, totalDue });
      } catch (error) {
        console.error("Error updating invoice:", error);
        return res.status(500).json({
          message: "Failed to update invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/send",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceSendSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice send payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res.status(409).json({ message: "Invoice send requires confirmed completion." });
        }

        if (!["draft", "disputed"].includes(String(invoice.status || "draft"))) {
          return res
            .status(409)
            .json({ message: "Invoice can only be sent from draft or disputed." });
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET status = 'sent', sent_at = now(), updated_at = now()
          WHERE id = ${invoiceId}
        `);
        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'invoicing', status = 'invoice_sent', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(invoice.request_id || ""),
          actorType: "contractor",
          actorId: userId,
          eventType: "invoice_sent",
          metadata: { invoiceId, note: parse.data.note ? parse.data.note.trim() : null },
        });

        return res.status(200).json({ ok: true, invoiceId, status: "sent" });
      } catch (error) {
        console.error("Error sending invoice:", error);
        return res.status(500).json({
          message: "Failed to send invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/invoices/:invoiceId/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const invoiceId = String(req.params.invoiceId || "").trim();
        const parse = invoiceRespondSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid invoice response payload", issues: parse.error.flatten() });
        }

        const invoiceRows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, status
          FROM job_invoices
          WHERE id = ${invoiceId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const invoice = ((invoiceRows.rows || []) as any[])[0] || null;
        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        if (String(invoice.requester_user_id || "") !== userId) {
          return res
            .status(403)
            .json({ message: "Only the request owner can respond to invoice." });
        }
        if (String(invoice.status || "") !== "sent") {
          return res.status(409).json({ message: "Invoice is not awaiting requester response." });
        }

        let nextStatus = "acknowledged";
        let eventType:
          | "invoice_acknowledged"
          | "invoice_disputed"
          | "invoice_marked_paid_outside_platform" = "invoice_acknowledged";
        if (parse.data.decision === "dispute") {
          nextStatus = "disputed";
          eventType = "invoice_disputed";
        } else if (parse.data.decision === "mark_paid_outside_platform") {
          nextStatus = "marked_paid_outside_platform";
          eventType = "invoice_marked_paid_outside_platform";
        }

        await db.execute(sql`
          UPDATE job_invoices
          SET status = ${nextStatus}, responded_at = now(), updated_at = now()
          WHERE id = ${invoiceId}
        `);
        await appendDispatchEvent({
          requestId: String(invoice.request_id || ""),
          actorType: "requester",
          actorId: userId,
          eventType,
          metadata: { invoiceId, note: parse.data.note ? parse.data.note.trim() : null },
        });

        return res.status(200).json({
          ok: true,
          invoiceId,
          status: nextStatus,
          platformPaymentProcessed: false,
        });
      } catch (error) {
        console.error("Error responding to invoice:", error);
        return res.status(500).json({
          message: "Failed to respond to invoice",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.post(
    "/api/direct-connect/jobs/:jobWorkspaceId/receipts",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const parse = receiptCreateSchema.safeParse(req.body ?? {});
        if (!parse.success) {
          return res
            .status(400)
            .json({ message: "Invalid receipt payload", issues: parse.error.flatten() });
        }

        const workspaceRows = await db.execute(sql`
          SELECT id, request_id, requester_user_id, business_id, contractor_id
          FROM direct_connect_job_workspaces
          WHERE id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const workspace = ((workspaceRows.rows || []) as any[])[0] || null;
        if (!workspace) return res.status(404).json({ message: "Job workspace not found" });

        const completionRows = await db.execute(sql`
          SELECT id, status
          FROM job_completion_requests
          WHERE workspace_id = ${jobWorkspaceId}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const completion = ((completionRows.rows || []) as any[])[0] || null;
        if (String(completion?.status || "") !== "confirmed") {
          return res.status(409).json({ message: "Receipt records require confirmed completion." });
        }

        const isRequester = String(workspace.requester_user_id || "") === userId;
        let isEligibleBusiness = false;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(workspace.request_id)} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          isEligibleBusiness = Boolean(((eligibilityResult.rows || []) as any[])[0]);
        }
        if (!isRequester && !isEligibleBusiness) {
          return res
            .status(403)
            .json({ message: "Only requester or eligible business can record receipts." });
        }

        const receiptId = createId("rcpt");
        await db.execute(sql`
          INSERT INTO job_receipts (
            id, workspace_id, request_id, invoice_id, requester_user_id, business_id, contractor_id,
            receipt_type, payment_method, amount, status, paid_at, notes, created_by, created_at, updated_at
          ) VALUES (
            ${receiptId},
            ${jobWorkspaceId},
            ${String(workspace.request_id)},
            ${parse.data.invoiceId ? parse.data.invoiceId.trim() : null},
            ${String(workspace.requester_user_id || "")},
            ${workspace.business_id ? String(workspace.business_id) : null},
            ${workspace.contractor_id ? String(workspace.contractor_id) : null},
            ${parse.data.type},
            ${parse.data.paymentMethod},
            ${parse.data.amount},
            ${parse.data.status ?? "recorded"},
            ${parse.data.paidAt ? new Date(parse.data.paidAt).toISOString() : null},
            ${parse.data.notes ? parse.data.notes.trim() : null},
            ${userId},
            now(),
            now()
          )
        `);

        await db.execute(sql`
          UPDATE direct_connect_job_workspaces
          SET active_stage = 'receipt', status = 'receipt_recorded', updated_at = now()
          WHERE id = ${jobWorkspaceId}
        `);

        await appendDispatchEvent({
          requestId: String(workspace.request_id),
          actorType: isRequester ? "requester" : "contractor",
          actorId: userId,
          eventType: parse.data.type === "receipt" ? "receipt_uploaded" : "payment_recorded",
          metadata: {
            receiptId,
            invoiceId: parse.data.invoiceId ?? null,
            paymentMethod: parse.data.paymentMethod,
          },
        });

        return res.status(201).json({ receiptId, status: parse.data.status ?? "recorded" });
      } catch (error) {
        console.error("Error creating receipt record:", error);
        return res.status(500).json({
          message: "Failed to create receipt record",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  app.get(
    "/api/direct-connect/jobs/:jobWorkspaceId/receipts/:receiptId",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = String(req.user?.id || req.user?.claims?.sub || "").trim();
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const jobWorkspaceId = String(req.params.jobWorkspaceId || "").trim();
        const receiptId = String(req.params.receiptId || "").trim();

        const rows = await db.execute(sql`
          SELECT id, workspace_id, request_id, requester_user_id, invoice_id, receipt_type, payment_method, amount, status, paid_at, notes, created_at, updated_at
          FROM job_receipts
          WHERE id = ${receiptId}
            AND workspace_id = ${jobWorkspaceId}
          LIMIT 1
        `);
        const receipt = ((rows.rows || []) as any[])[0] || null;
        if (!receipt) return res.status(404).json({ message: "Receipt not found" });

        const isRequester = String(receipt.requester_user_id || "") === userId;
        if (!isRequester) {
          const contractor = await storage.getContractorByUserId(userId);
          const workerProfile = await db
            .select({ id: (workers as any).id })
            .from(workers as any)
            .where(eq((workers as any).userId, userId))
            .limit(1);
          const workerId = workerProfile[0]?.id ? String(workerProfile[0].id) : null;
          const contractorId = contractor?.id ? String(contractor.id) : null;
          const eligibilityResult = contractorId
            ? await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(receipt.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.contractor_id = ${contractorId} OR c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              )
            : await db.execute(
                sql`SELECT c.request_id FROM direct_connect_dispatch_candidates c WHERE c.request_id = ${String(receipt.request_id || "")} AND c.eligibility_state = 'eligible' AND (c.responder_user_id = ${userId} OR (${workerId} IS NOT NULL AND c.worker_id = ${workerId})) LIMIT 1`
              );
          if (!((eligibilityResult.rows || []) as any[])[0]) {
            return res.status(403).json({ message: "Receipt not available for this account." });
          }
        }

        return res.status(200).json({
          receiptId: String(receipt.id),
          jobWorkspaceId: String(receipt.workspace_id),
          requestId: String(receipt.request_id || ""),
          invoiceId: receipt.invoice_id ? String(receipt.invoice_id) : null,
          type: String(receipt.receipt_type || "receipt"),
          paymentMethod: String(receipt.payment_method || "outside_platform"),
          amount: toNumber(receipt.amount),
          status: String(receipt.status || "recorded"),
          paidAt: receipt.paid_at || null,
          notes: receipt.notes ? String(receipt.notes) : null,
          storesPaymentCredentials: false,
          createdAt: receipt.created_at || null,
          updatedAt: receipt.updated_at || null,
        });
      } catch (error) {
        console.error("Error fetching receipt record:", error);
        return res.status(500).json({
          message: "Failed to fetch receipt record",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );

  // Provider-facing: accept/decline an assignment, and create a conversation on accept
  app.post(
    "/api/direct-connect/assignments/:id/respond",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        // Contract anchor: requester notifications on response outcomes.
        // createNotification -> dc_provider_accepted / dc_provider_declined
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
          const assignmentLockResult = await tx.execute(sql`
            SELECT *
            FROM work_request_assignments
            WHERE id = ${req.params.id}
            FOR UPDATE
          `);
          const assignment = (assignmentLockResult.rows?.[0] as any) || null;
          const assignmentContractorId = assignment
            ? String(assignment.contractorId ?? assignment.contractor_id ?? "")
            : "";
          const assignmentResponderUserId = assignment
            ? String(assignment.responderUserId ?? assignment.responder_user_id ?? "")
            : "";
          const assignmentWorkerId = assignment
            ? String(assignment.workerId ?? assignment.worker_id ?? "")
            : "";
          const assignmentWorkRequestId = assignment
            ? String(assignment.workRequestId ?? assignment.work_request_id ?? "")
            : "";
          const assignmentStatus = assignment ? String(assignment.status || "") : "";

          // Authorization: the calling user must be the contractor, the responderUserId,
          // or the worker whose workerId is on the assignment.
          const isContractorAssignment = contractor && assignmentContractorId === contractor.id;
          const isBusinessAssignment = assignment && assignmentResponderUserId === String(userId);
          // Worker assignment: check if this user owns the worker profile linked to the assignment
          let isWorkerAssignment = false;
          if (!isContractorAssignment && !isBusinessAssignment && assignmentWorkerId) {
            const [wp] = await tx
              .select({ id: (workers as any).id })
              .from(workers as any)
              .where(
                and(
                  eq((workers as any).id, assignmentWorkerId),
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

          const requestLockResult = await tx.execute(sql`
            SELECT *
            FROM work_requests
            WHERE id = ${assignmentWorkRequestId}
            FOR UPDATE
          `);
          const requestRow = (requestLockResult.rows?.[0] as any) || null;

          if (!requestRow) {
            return { status: 404 as const, body: { message: "Work request not found" } };
          }

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
                responseSummary: responseSummary as any,
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
                const [createdConversation] = await tx
                  .insert(conversations)
                  .values({
                    homeownerId,
                    contractorId: providerContractorId,
                    leadId: null,
                  } as any)
                  .returning();
                convo = createdConversation;
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

              await proposeAccountingAutomationFromDirectConnect(tx, {
                workRequestId: String(requestRow.id),
                assignmentId: String(updatedAssignment.id),
                requesterUserId: String(requestRow.createdByUserId),
                providerUserId: String(userId),
                actorUserId: String(userId),
                conversationId,
                requestTitle: String(requestRow.title || "Direct Connect request"),
                responseSummary,
                contractorId: isContractorAssignment ? contractor!.id : null,
                responderUserId: isBusinessAssignment ? String(userId) : null,
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
        try {
          const { assignment: updatedAssignment, responseSummary } = result.body as any;
          const responseType =
            updatedAssignment.status === "accepted"
              ? "interested"
              : declineReason
                ? "not_a_fit"
                : "unavailable";
          const requestId = String(updatedAssignment.workRequestId || "");
          await recordContractorResponse({
            requestId,
            contractorId: contractor?.id ? String(contractor.id) : null,
            responderUserId: String(userId),
            responseType,
            message:
              responseType === "interested"
                ? String(responseSummary?.scopeNote || "")
                : String(declineReason || ""),
            availability:
              responseType === "interested"
                ? String(responseSummary?.availabilityWindow || "")
                : null,
            estimatedTiming:
              responseType === "interested"
                ? String(responseSummary?.availabilityWindow || "")
                : null,
            contactRequestState: responseType === "interested" ? "contractor_requested" : "locked",
          });
          await appendDispatchEvent({
            requestId,
            actorType: "contractor",
            actorId: String(userId),
            eventType: "contractor_responded",
            metadata: { responseType },
          });
          if (responseType === "interested") {
            await appendDispatchEvent({
              requestId,
              actorType: "contractor",
              actorId: String(userId),
              eventType: "contact_requested",
              metadata: { via: "assignment_response" },
            });
          }
        } catch (ledgerError) {
          console.warn(
            "[direct-connect] Failed to persist contractor response in dispatch ledger",
            ledgerError
          );
        }
        // Notify the requester that a provider has accepted or declined their request.
        // This runs outside the transaction so a notification failure never blocks the response.
        try {
          const { assignment: updatedAssignment, conversationId: convId } = result.body as any;
          // Re-fetch the requester userId from the work request (already committed by the tx above).
          const [reqRow] = await db
            .select({ createdByUserId: workRequests.createdByUserId, title: workRequests.title })
            .from(workRequests)
            .where(eq(workRequests.id, updatedAssignment.workRequestId))
            .limit(1);
          if (reqRow?.createdByUserId) {
            const isAccept = updatedAssignment.status === "accepted";
            await notificationService.createNotification({
              userId: String(reqRow.createdByUserId),
              type: isAccept ? "dc_provider_accepted" : "dc_provider_declined",
              title: isAccept
                ? "A provider accepted your request"
                : "A provider declined your request",
              message: isAccept
                ? `A provider accepted your Direct Connect request: ${reqRow.title}`
                : `A provider declined your Direct Connect request: ${reqRow.title}`,
              actionUrl:
                isAccept && convId ? `/direct-connect?conversation=${convId}` : "/direct-connect",
              actionText: isAccept ? "Open conversation" : "View request",
              iconName: isAccept ? "check-circle" : "x-circle",
              iconColor: isAccept ? "green" : "gray",
              deliveryMethods: ["in_app", "push"],
            });
          }
        } catch (notifErr) {
          console.warn(
            "[direct-connect] Failed to notify requester of provider response",
            notifErr
          );
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

  // Provider-facing: self-select on an open board request the provider was not directly invited to.
  // This creates a "suggested" assignment for the provider and notifies the requester.
  app.post(
    "/api/direct-connect/requests/:id/express-interest",
    isAuthenticated,
    async (req: AuthedRequest, res: Response) => {
      try {
        const userId = req.user?.id || req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "Unauthorized" });
        const requestId = String(req.params.id);
        // Resolve provider identity: contractor profile or business/worker (responderUserId)
        const contractor = await storage.getContractorByUserId(String(userId));
        const business = await storage.getActiveBusinessForUser(String(userId));
        if (!contractor && !business) {
          return res.status(403).json({
            message: "Only registered providers (contractors or businesses) can express interest.",
          });
        }
        const [requestRow] = await db
          .select()
          .from(workRequests)
          .where(eq(workRequests.id, requestId));
        if (!requestRow) {
          return res.status(404).json({ message: "Work request not found" });
        }
        if ((requestRow.source as string | null) !== "direct_connect") {
          return res.status(400).json({ message: "Only Direct Connect requests support this." });
        }
        const openStatuses = ["open", "routed"];
        if (!openStatuses.includes(String(requestRow.status || ""))) {
          return res.status(409).json({
            message: "This request is no longer accepting new responses.",
          });
        }
        // Prevent the requester from expressing interest in their own request
        if (String(requestRow.createdByUserId) === String(userId)) {
          return res.status(400).json({ message: "You cannot respond to your own request." });
        }
        const contractorEligibility = contractor
          ? await filterContractorsEligibleForRequest([contractor], requestRow)
          : { eligible: [] as any[] };
        const businessEligibility = business
          ? await filterBusinessesEligibleForRequest([business], requestRow)
          : { eligible: [] as any[] };
        const eligibleContractor = contractorEligibility.eligible[0] || null;
        const eligibleBusiness = businessEligibility.eligible[0] || null;
        if (!eligibleContractor && !eligibleBusiness) {
          return res.status(403).json({
            message:
              "This request is outside your Direct Connect service area or requires a different provider verification.",
          });
        }
        const now = new Date();
        const isContractorProvider = Boolean(eligibleContractor?.id);
        const providerContractorId = isContractorProvider ? String(eligibleContractor!.id) : null;
        const providerResponderUserId = isContractorProvider ? null : String(userId);

        const assignmentResult = await db.transaction(async (tx) => {
          const requestLockResult = await tx.execute(sql`
            SELECT id, status
            FROM work_requests
            WHERE id = ${requestId}
            FOR UPDATE
          `);
          const lockedRequestRow = (requestLockResult.rows?.[0] as any) || null;
          if (!lockedRequestRow) {
            return { requestMissing: true as const };
          }
          const lockedRequestStatus = String(lockedRequestRow.status || "");

          const existingQuery = isContractorProvider
            ? tx
                .select()
                .from(workRequestAssignments)
                .where(
                  and(
                    eq(workRequestAssignments.workRequestId, requestId),
                    eq(workRequestAssignments.contractorId, providerContractorId!)
                  )
                )
                .limit(1)
            : tx
                .select()
                .from(workRequestAssignments)
                .where(
                  and(
                    eq(workRequestAssignments.workRequestId, requestId),
                    eq((workRequestAssignments as any).responderUserId, providerResponderUserId!)
                  )
                )
                .limit(1);

          const [existing] = await existingQuery;
          if (existing) {
            if (lockedRequestStatus === "open") {
              await tx
                .update(workRequests)
                .set({ status: "routed", updatedAt: now })
                .where(eq(workRequests.id, requestId));
            }
            return { assignment: existing, alreadyAssigned: true };
          }

          const [created] = await tx
            .insert(workRequestAssignments)
            .values({
              workRequestId: requestId,
              contractorId: providerContractorId,
              responderUserId: providerResponderUserId,
              workerId: null,
              status: "suggested" as const,
              scoreSnapshot: {
                score: 0,
                reasons: ["Provider expressed interest from board"],
                routingMode: "self_selected",
              },
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          try {
            await tx.insert(workRequestEvents).values({
              workRequestId: requestId,
              type: "provider_self_selected" as const,
              actorUserId: String(userId),
              metadata: {
                contractorId: providerContractorId,
                responderUserId: providerResponderUserId,
                source: "self_selected",
                businessId: isContractorProvider ? null : (eligibleBusiness?.id ?? null),
              },
            });
          } catch (e) {
            console.warn("[direct-connect] Failed to record self-select event", e);
          }

          if (lockedRequestStatus === "open") {
            await tx
              .update(workRequests)
              .set({ status: "routed", updatedAt: now })
              .where(eq(workRequests.id, requestId));
          }

          return { assignment: created, alreadyAssigned: false };
        });
        if ((assignmentResult as any)?.requestMissing) {
          return res.status(404).json({ message: "Work request not found" });
        }
        // Notify the requester that a provider has expressed interest
        try {
          const providerName = isContractorProvider
            ? String(
                (eligibleContractor as any).companyName ||
                  (eligibleContractor as any).name ||
                  "A provider"
              )
            : String((eligibleBusiness as any)?.name || "A provider");
          await notificationService.createNotification({
            userId: String(requestRow.createdByUserId),
            type: "dc_provider_interested",
            title: "A provider is interested",
            message: `${providerName} expressed interest in your request: ${String(requestRow.title || "")}`,
            actionUrl: "/direct-connect/engagements",
            actionText: "View request",
            iconName: "user-check",
            iconColor: "blue",
            deliveryMethods: ["in_app", "push"],
          });
        } catch (e) {
          console.warn("[direct-connect] Failed to notify requester of provider interest", e);
        }
        res.status(assignmentResult.alreadyAssigned ? 200 : 201).json(assignmentResult);
      } catch (error: any) {
        console.error("Error expressing interest in direct connect request:", error);
        res.status(500).json({
          message: "Failed to express interest",
          requestId: (req as any).requestId || null,
        });
      }
    }
  );
}
