Warning: truncated output (original token count: 104185)
Total output lines: 10336

import type { Express, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { isAuthenticated, requireRole } from "../auth";
import { db, pool } from "../db";
import { randomBytes } from "crypto";
import {
  type WorkRequest,
  affiliateShareLinks,
  directConnectGiveawayEntries,
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
  profiles,
  workers,
  userHomes,
  userHomeRecords,
  users,
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
import { notifySuperAdminsOfDirectConnectRequest } from "../services/directConnectBetaOversight";
import { emailService } from "../services/emailService";
import { passwordResetService } from "../services/passwordResetService";
import { emailVerificationService } from "../services/emailVerificationService";
import { recordOutcomeEvent, updateUserConfidenceStateFromOutcome } from "../scout/outcomeTracker";
import { logAdminAction } from "../services/adminAuditLogService";
import { recordTrustLedgerEvent } from "../services/trustLedgerService";
import { computeDirectConnectProviderFitScore } from "../services/directConnectProviderFitScore";
import {
  classifyServiceAreaReach,
  computeRequiredVerificationScore,
  normalizeMeasuredCountSignal,
  normalizeMeasuredRate,
  type ServiceAreaReachTier,
} from "../services/directConnectMeasuredEvidence";
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
  serializeDirectConnectCardContactGatePayload,
} from "../utils/workRequestShare";
import type { PrivilegedBypassReason } from "../utils/authorityPolicy";
import {
  hasManualDirectConnectBypassRequest,
  isDirectConnectBypassProductionLockEnabled,
  isDirectConnectUnverifiedBypassEnabled,
  resolvePrivilegedVerificationBypass,
} from "../utils/authorityPolicy";
import { createPostgresRateLimitStore } from "../utils/postgresRateLimitStore";
import { readPositiveIntegerEnv } from "../utils/rateLimitConfig";
import { resolveAnonymousSessionId } from "../utils/anonymousSession";
import { publicBusinessDetailExposureSqlPredicate } from "../publicationBusiness";
import { loadCanonicalPublicMapProfileUrls } from "../repositories/profileRepository";
import { registerDirectConnectJobLifecycleRoutes } from "./direct-connect/job-lifecycle";
import { DiscoveryObservatoryService } from "../services/discoveryObservatoryService";
import { verifyDiscoveryAttributionToken } from "../utils/discoveryAttribution";
import { hasVerifiedTradeScoutAdminCustody } from "../services/ownerConfirmedDirectProfile";
import { isSteelHomePackagesProfileSlug } from "@shared/steelHomePackagesProfile";
import { getCountyByFips as getStaticCountyByFips } from "@shared/states-counties";

type AuthedRequest = Request & {
  user?: { id?: string; claims?: { sub?: string }; role?: string | null; [key: string]: any };
};

const discoveryObservatory = new DiscoveryObservatoryService(pool, async (eventType, data) =>
  storage.logEvent(eventType, data)
);

const DIRECT_CONNECT_GIVEAWAY_PROMOTION_KEY = "direct_connect_giveaway_2026_06";
const DIRECT_CONNECT_GIVEAWAY_ELIGIBLE_STATE = "FL";

function normalizeStateCode(value: unknown): string | null {
  const state = String(value || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : null;
}

function resolveDirectConnectGiveawayEligibility(params: {
  stateCode?: string | null;
  viewer?: Record<string, any> | null;
}) {
  const profileState =
    normalizeStateCode(params.viewer?.stateCode) || normalizeStateCode(params.viewer?.state_code);
  const requestState = normalizeStateCode(params.stateCode);
  const residencyStateCode = profileState || requestState;
  const isEligible = residencyStateCode === DIRECT_CONNECT_GIVEAWAY_ELIGIBLE_STATE;

  return {
    residencyStateCode,
    isEligible,
    eligibilityReason: isEligible
      ? "fl_resident_18_plus_required"
      : residencyStateCode
        ? "not_florida_resident"
        : "missing_residency_state",
    eligibilitySnapshot: {
      promotionKey: DIRECT_CONNECT_GIVEAWAY_PROMOTION_KEY,
      eligibleState: DIRECT_CONNECT_GIVEAWAY_ELIGIBLE_STATE,
      profileState,
      requestState,
      evaluatedAt: new Date().toISOString(),
    },
  };
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
  latestPaymentStatus: string | null;
  latestCompletionStatus: string | null;
  latestInvoiceStatus: string | null;
}) {
  if (args.contactGateState === "contractor_requested") return "approve_or_decline_contact";
  if (args.latestEstimateStatus === "sent") return "review_estimate";
  if (args.latestPaymentStatus === "sent") return "review_payment_request";
  if (args.latestScheduleStatus === "proposed") return "review_schedule";
  if (args.latestCompletionStatus === "requested") return "review_completion_request";
  if (args.latestInvoiceStatus === "sent") return "review_invoice";
  return "wait_for_business";
}

function nextActionForBusiness(args: {
  contactGateState: string;
  latestEstimateStatus: string | null;
  latestPaymentStatus: string | null;
  latestCompletionStatus: string | null;
  latestInvoiceStatus: string | null;
}) {
  if (args.contactGateState === "locked") return "wait_for_contact_approval";
  if (!args.latestEstimateStatus) return "create_estimate";
  if (args.latestEstimateStatus === "change_requested") return "revise_estimate";
  // Requesting a deposit/progress payment is optional, not a gate -- only surface it
  // once while the job is still active (before completion), so it doesn't linger as
  // "next action" after the job is effectively done.
  if (
    args.latestEstimateStatus === "accepted" &&
    !args.latestPaymentStatus &&
    !args.latestCompletionStatus
  )
    return "create_payment_request";
  if (args.latestCompletionStatus === "confirmed" && !args.latestInvoiceStatus)
    return "create_invoice";
  if (args.latestInvoiceStatus === "disputed") return "review_invoice_dispute";
  return "continue_workflow";
}

function labelLifecycleAction(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "Review job";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMessageJobAssist(args: {
  viewerRole: "requester" | "provider";
  requestId: string;
  workspaceId: string | null;
  requestTitle: string;
  requestDescription: string;
  category: string | null;
  county: string | null;
  cityArea: string | null;
  responseSummary: any;
  allowedLifecycleActions: string[];
  latestEstimateStatus: string | null;
  latestScheduleStatus: string | null;
  latestPaymentStatus: string | null;
  latestCompletionStatus: string | null;
  latestInvoiceStatus: string | null;
  latestReceiptStatus: string | null;
  openPunchItemCount: number;
  latestEstimateId: string | null;
  latestScheduleProposalId: string | null;
  latestPaymentRequestId: string | null;
  latestInvoiceId: string | null;
  activeCompletionRequestId: string | null;
  latestEstimateTotal: number | null;
  latestInvoiceTotal: number | null;
  latestPaymentAmount: number | null;
}) {
  const requesterAction = nextActionForRequester({
    contactGateState: "released",
    latestEstimateStatus: args.latestEstimateStatus,
    latestScheduleStatus: args.latestScheduleStatus,
    latestPaymentStatus: args.latestPaymentStatus,
    latestCompletionStatus: args.latestCompletionStatus,
    latestInvoiceStatus: args.latestInvoiceStatus,
  });
  const providerAction = nextActionForBusiness({
    contactGateState: "released",
    latestEstimateStatus: args.latestEstimateStatus,
    latestPaymentStatus: args.latestPaymentStatus,
    latestCompletionStatus: args.latestCompletionStatus,
    latestInvoiceStatus: args.latestInvoiceStatus,
  });
  const primaryActionKey = args.viewerRole === "requester" ? requesterAction : providerAction;
  const detailHref =
    args.viewerRole === "requester"
      ? `/direct-connect/engagements?requestId=${encodeURIComponent(args.requestId)}`
      : `/direct-connect/inbox?requestId=${encodeURIComponent(args.requestId)}`;
  const workspaceQuery = args.workspaceId
    ? `&jobWorkspaceId=${encodeURIComponent(args.workspaceId)}`
    : "";
  const prefillQuery = [
    `requestId=${encodeURIComponent(args.requestId)}`,
    args.workspaceId ? `jobWorkspaceId=${encodeURIComponent(args.workspaceId)}` : "",
    args.category ? `category=${encodeURIComponent(args.category)}` : "",
    args.county ? `county=${encodeURIComponent(args.county)}` : "",
    args.cityArea ? `cityArea=${encodeURIComponent(args.cityArea)}` : "",
    `title=${encodeURIComponent(args.requestTitle)}`,
  ]
    .filter(Boolean)
    .join("&");

  const actionHrefByKey: Record<string, string> = {
    create_estimate: `/direct-connect/inbox?${prefillQuery}&action=create_estimate`,
    revise_estimate: `/direct-connect/inbox?${prefillQuery}&estimateId=${encodeURIComponent(
      args.latestEstimateId || ""
    )}&action=revise_estimate`,
    create_payment_request: `/direct-connect/inbox?${prefillQuery}&estimateId=${encodeURIComponent(
      args.latestEstimateId || ""
    )}&action=create_payment_request`,
    create_invoice: `/direct-connect/inbox?${prefillQuery}&invoiceId=${encodeURIComponent(
      args.latestInvoiceId || ""
    )}&action=create_invoice`,
    review_invoice_dispute: `/direct-connect/inbox?${prefillQuery}&invoiceId=${encodeURIComponent(
      args.latestInvoiceId || ""
    )}&action=review_invoice_dispute`,
    continue_workflow: `/direct-connect/inbox?${prefillQuery}&action=continue_workflow`,
    review_estimate: `${detailHref}${workspaceQuery}&estimateId=${encodeURIComponent(
      args.latestEstimateId || ""
    )}&action=review_estimate`,
    review_payment_request: `${detailHref}${workspaceQuery}&paymentRequestId=${encodeURIComponent(
      args.latestPaymentRequestId || ""
    )}&action=review_payment_request`,
    review_schedule: `${detailHref}${workspaceQuery}&scheduleProposalId=${encodeURIComponent(
      args.latestScheduleProposalId || ""
    )}&action=review_schedule`,
    review_completion_request: `${detailHref}${workspaceQuery}&completionRequestId=${encodeURIComponent(
      args.activeCompletionRequestId || ""
    )}&action=review_completion_request`,
    review_invoice: `${detailHref}${workspaceQuery}&invoiceId=${encodeURIComponent(
      args.latestInvoiceId || ""
    )}&action=review_invoice`,
    wait_for_business: `${detailHref}${workspaceQuery}`,
  };
  const oneClickAction =
    args.viewerRole === "provider" &&
    args.workspaceId &&
    args.allowedLifecycleActions.includes("start_work") &&
    args.latestEstimateStatus === "accepted"
      ? {
          key: "start_work",
          label: "Mark work started",
          method: "POST",
          endpoint: `/api/direct-connect/jobs/${args.workspaceId}/start-work`,
        }
      : args.viewerRole === "provider" &&
          args.workspaceId &&
          args.allowedLifecycleActions.includes("mark_ready_for_punchout")
        ? {
            key: "mark_ready_for_punchout",
            label: "Ready for punch list",
            method: "POST",
            endpoint: `/api/direct-connect/jobs/${args.workspaceId}/ready-for-punchout`,
          }
        : null;
  const primaryAction = {
    key: primaryActionKey,
    label:
      primaryActionKey === "wait_for_business"
        ? "Waiting on business"
        : labelLifecycleAction(primaryActionKey),
    href: actionHrefByKey[primaryActionKey] || detailHref,
    oneClick: oneClickAction,
  };
  const costSignal =
    args.latestInvoiceTotal ?? args.latestEstimateTotal ?? args.latestPaymentAmount ?? null;
  const timelineSignal =
    args.responseSummary?.estimatedTiming ||
    args.responseSummary?.availabilityWindow ||
    args.responseSummary?.availability ||
    null;
  const satisfactionSignal =
    args.latestCompletionStatus === "confirmed"
      ? "Completion confirmed"
      : args.openPunchItemCount > 0
        ? `${args.openPunchItemCount} punch item${args.openPunchItemCount === 1 ? "" : "s"} open`
        : args.latestInvoiceStatus === "disputed"
          ? "Invoice disputed"
          : args.latestCompletionStatus === "rejected"
            ? "Completion rejected"
            : "In progress";

  return {
    primaryAction,
    detailHref,
    prefill: {
      title: args.requestTitle,
      scope: args.requestDescription,
      category: args.category,
      county: args.county,
      cityArea: args.cityArea,
      availabilityWindow:
        args.responseSummary?.availabilityWindow || args.responseSummary?.availability || null,
      estimatedTiming: timelineSignal,
      priceBand: args.responseSummary?.priceBand || null,
      scopeNote: args.responseSummary?.scopeNote || null,
    },
    learningSignals: {
      cost: {
        label: costSignal === null ? "Cost learning pending" : "Latest captured amount",
        value: costSignal,
        source:
          args.latestInvoiceTotal !== null
            ? "invoice"
            : args.latestEstimateTotal !== null
              ? "estimate"
              : args.latestPaymentAmount !== null
                ? "payment"
                : null,
      },
      timeline: {
        label: timelineSignal ? "Timeline signal captured" : "Timeline learning pending",
        value: timelineSignal,
      },
      satisfaction: {
        label: "Customer satisfaction signal",
        value: satisfactionSignal,
      },
      trust: {
        label: "Trust/CVS outcome signal",
        value:
          args.latestReceiptStatus ||
          args.latestInvoiceStatus ||
          args.latestCompletionStatus ||
          args.latestEstimateStatus ||
          "Collecting",
      },
    },
  };
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
  targetProfileSlug: z.string().trim().min(1).max(120).optional(),
  discoveryAttributionToken: z
    .string()
    .trim()
    .max(4096)
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    .optional(),
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
  })
  .refine((data) => Boolean(data.targetUserId || data.targetEmail), {
    message: "targetUserId or targetEmail is required",
    path: ["targetUserId"],
  });

const DIRECT_CONNECT_ADMIN_STATUSES = [
  "draft",
  "open",
  "routed",
  "in_progress",
  "pending_outcome",
  "completed",
  "cancelled",
] as const;

const directConnectAdminQueueSchema = z.object({
  status: z.enum(["all", ...DIRECT_CONNECT_ADMIN_STATUSES]).default("all"),
  search: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const isDirectConnectOperator = requireRole(["ops_admin", "super_admin"]);

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

type DirectConnectFunnelEventType =
  | "direct_connect_request_submitted"
  | "direct_connect_visible_to_contractors"
  | "direct_connect_request_visible_to_contractors"
  | "direct_connect_contractor_action_started";

function logDirectConnectFunnelEvent(
  eventType: DirectConnectFunnelEventType,
  metadata: Record<string, unknown>
) {
  void storage
    .logEvent(eventType, {
      type: eventType,
      surface: "direct_connect",
      source: "direct_connect_server",
      userState: "authenticated",
      ...metadata,
      ts: new Date().toISOString(),
    })
    .catch((error) => {
      console.warn(`[direct-connect] Failed to log ${eventType}`, error);
    });
}

function logDirectConnectVisibilityEvent(metadata: Record<string, unknown>) {
  logDirectConnectFunnelEvent("direct_connect_visible_to_contractors", metadata);
  // Keep the previous event name for existing reports while the canonical funnel name rolls out.
  logDirectConnectFunnelEvent("direct_connect_request_visible_to_contractors", metadata);
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

async function filterContractorsByPublicProfileTrust(contractorRows: any[]) {
  const userIds = Array.from(
    new Set(
      contractorRows
        .map((contractor: any) => String(contractor.userId || "").trim())
        .filter(Boolean)
    )
  );
  const publicProfileByUserId = await loadCanonicalPublicMapProfileUrls(userIds);
  return {
    eligible: contractorRows.filter((contractor: any) =>
      publicProfileByUserId.has(String(contractor.userId || "").trim())
    ),
    ineligible: contractorRows
      .filter(
        (contractor: any) => !publicProfileByUserId.has(String(contractor.userId || "").trim())
      )
      .map((contractor: any) => String(contractor.id || "").trim())
      .filter(Boolean)
      .map((contractorId) => ({
        contractorId,
        reason: "contractor_profile_not_publicly_eligible",
      })),
  };
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

  const publicTrustEligibility = await filterContractorsByPublicProfileTrust(contractorRows);
  const publiclyEligibleContractors = publicTrustEligibility.eligible;

  const contractorIds = publiclyEligibleContractors
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
  const countyEligible = publiclyEligibleContractors.filter((contractor: any) =>
    servesCountyIds.has(String(contractor.id || "").trim())
  );
  const countyIneligible = publiclyEligibleContractors
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
    ineligible: [...publicTrustEligibility.ineligible, ...countyIneligible],
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
  const publiclyEligibleRows = businessIds.length
    ? await db
        .select({ businessId: businesses.id })
        .from(businesses)
        .leftJoin(users, eq(businesses.ownerUserId, users.id))
        .where(
          and(
            inArray(businesses.id, businessIds),
            eq(businesses.status, "active" as any),
            eq(businesses.publicDiscoveryEnabled, true),
            publicBusinessDetailExposureSqlPredicate()
          )
        )
    : [];
  const publiclyEligibleIds = new Set(publiclyEligibleRows.map((row) => String(row.businessId)));
  const publiclyEligibleBusinesses = businessRows.filter((business: any) =>
    publiclyEligibleIds.has(String(business.id || "").trim())
  );
  const publicTrustIneligible = businessRows
    .filter((business: any) => !publiclyEligibleIds.has(String(business.id || "").trim()))
    .map((business: any) => String(business.id || "").trim())
    .filter(Boolean)
    .map((businessId) => ({ businessId, reason: "business_not_publicly_eligible" }));
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
    eligible: publiclyEligibleBusinesses.filter((business: any) =>
      servesCountyIds.has(String(business.id || "").trim())
    ),
    ineligible: [
      ...publicTrustIneligible,
      ...publiclyEligibleBusinesses
        .filter((business: any) => !servesCountyIds.has(String(business.id || "").trim()))
        .map((business: any) => String(business.id || "").trim())
        .filter(Boolean)
        .map((businessId) => ({ businessId, reason: "outside_request_county" })),
    ],
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
  const isProductionEnv = process.env.NODE_ENV === "production";
  const noopRateLimiter: any = (_req: any, _res: any, next: any) => next();
  const directConnectRateLimitKey = (req: AuthedRequest) => {
    const userId = req?.user?.id || req?.user?.claims?.sub;
    if (userId) return `u:${userId}`;
    const anonymousSessionId = resolveAnonymousSessionId(req);
    if (anonymousSessionId) return `anon:${anonymousSessionId}`;
    const email =
      typeof req?.body?.email === "string" ? String(req.body.email).trim().toLowerCase() : "";
    if (email) return `ip:${req.ip}|e:${email}`;
    return req.ip || "unknown";
  };
  const directConnectLimiterStore = (prefix: string) =>
    createPostgresRateLimitStore({
      pool,
      prefix: `rl:direct_connect:${prefix}`,
      cleanupIntervalMs: Number(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS || 10 * 60 * 1000),
    });
  const directConnectCreateLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 15 * 60 * 1000,
        max: readPositiveIntegerEnv("DIRECT_CONNECT_CREATE_LIMIT_15M", 12),
        message: {
          message: "Too many Direct Connect requests. Please slow down and try again shortly.",
          code: "DIRECT_CONNECT_RATE_LIMITED",
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: directConnectRateLimitKey,
        store: directConnectLimiterStore("create"),
      })
    : noopRateLimiter;
  const directConnectWorkflowLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 60 * 1000,
        max: readPositiveIntegerEnv("DIRECT_CONNECT_WORKFLOW_LIMIT_1M", 90),
        message: {
          message: "Too many Direct Connect actions. Please slow down and try again shortly.",
          code: "DIRECT_CONNECT_RATE_LIMITED",
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: directConnectRateLimitKey,
        store: directConnectLimiterStore("workflow"),
      })
    : noopRateLimiter;
  const directConnectProviderResponseLimiter = isProductionEnv
    ? rateLimit({
        windowMs: 10 * 60 * 1000,
        max: readPositiveIntegerEnv("DIRECT_CONNECT_PROVIDER_RESPONSE_LIMIT_10M", 60),
        message: {
          message: "Too many Direct Connect responses. Please slow down and try again shortly.",
          code: "DIRECT_CONNECT_RATE_LIMITED",
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: directConnectRateLimitKey,
        store: directConnectLimiterStore("provider_response"),
      })
    : noopRateLimiter;
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
      const [affiliateCollision] = await tx
        .select({ id: affiliateShareLinks.id })
        .from(affiliateShareLinks)
        .where(eq(affiliateShareLinks.friendlySlug, candidate))
        .limit(1);
      if (affiliateCollision?.id) continue;

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

      if (countyRecord && countyFips)…64185 tokens truncated…rkers as any)
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
              WHERE request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              WHERE request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              WHERE request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              WHERE w.request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              WHERE w.request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              WHERE w.request_id IN (${sql.join(
                requestIds.map((requestId) => sql`${requestId}`),
                sql`, `
              )})
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
              latestPaymentStatus: paymentMeta?.latestPaymentRequestStatus ?? null,
              latestCompletionStatus: completionMeta?.latestCompletionStatus ?? null,
              latestInvoiceStatus: invoiceMeta?.latestInvoiceStatus ?? null,
            }),
            nextActionForBusiness: nextActionForBusiness({
              contactGateState: String(row.contact_gate_state || "locked"),
              latestEstimateStatus: estimateMeta?.latestEstimateStatus ?? null,
              latestPaymentStatus: paymentMeta?.latestPaymentRequestStatus ?? null,
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
          latestPaymentStatus: paymentSummary?.latest_payment_request_status
            ? String(paymentSummary.latest_payment_request_status)
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
          latestPaymentStatus: paymentSummary?.latest_payment_request_status
            ? String(paymentSummary.latest_payment_request_status)
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
    directConnectProviderResponseLimiter,
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

  registerDirectConnectJobLifecycleRoutes(app, {
    isAuthenticated,
    db,
    sql,
    storage,
    workers,
    eq,
    createId,
    toNumber,
    normalizeEstimateStatus,
    labelLifecycleAction,
    getAllowedLifecycleActions,
    getLifecycleStatusForRecipient,
    getUnreadLifecycleStatusCount,
    getJobWorkspaceByRequestId,
    appendDispatchEvent,
    notificationService,
    logDirectConnectFunnelEvent,
    recordOutcomeEvent,
    updateUserConfidenceStateFromOutcome,
    appendHomeIdTimelineEventFromDirectConnect,
    appendHomeIdCompletedWorkEnrichmentFromDirectConnect,
    estimateCreateSchema,
    estimateUpdateSchema,
    estimateSendSchema,
    estimateRespondSchema,
    estimateLineItemSchema,
    paymentRequestCreateSchema,
    paymentRequestRespondSchema,
    scheduleProposalCreateSchema,
    scheduleProposalRespondSchema,
    checkpointCreateSchema,
    checkpointUpdateSchema,
    checkpointRespondSchema,
    changeOrderCreateSchema,
    changeOrderRespondSchema,
    punchItemCreateSchema,
    punchItemUpdateSchema,
    punchItemRespondSchema,
    completionRequestCreateSchema,
    completionRequestRespondSchema,
    invoiceCreateSchema,
    invoiceLineItemSchema,
    invoiceUpdateSchema,
    invoiceSendSchema,
    invoiceRespondSchema,
    receiptCreateSchema,
  });

  // Provider-facing: accept/decline an assignment, and create a conversation on accept
  app.post(
    "/api/direct-connect/assignments/:id/respond",
    isAuthenticated,
    directConnectProviderResponseLimiter,
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
          const { assignment: updatedAssignment } = result.body as any;
          await discoveryObservatory.recordJourneyOutcome({
            workRequestId: String(updatedAssignment.workRequestId || ""),
            kind: "provider_response",
            state: updatedAssignment.status === "accepted" ? "accepted" : "declined",
            actorAuthority: "authenticated_assigned_provider",
          });
        } catch (observatoryError) {
          console.warn(
            "[direct-connect] Discovery provider-response capture failed",
            observatoryError
          );
        }
        try {
          const { assignment: updatedAssignment, responseSummary } = result.body as any;
          logDirectConnectFunnelEvent("direct_connect_contractor_action_started", {
            requestId: String(updatedAssignment.workRequestId || ""),
            assignmentId: String(updatedAssignment.id || ""),
            decision: String(updatedAssignment.status || decision),
            responderType: contractor ? "contractor" : "business_or_worker",
          });
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
                isAccept && convId
                  ? `/messages?thread=${encodeURIComponent(String(convId))}`
                  : "/direct-connect",
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
    directConnectProviderResponseLimiter,
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
