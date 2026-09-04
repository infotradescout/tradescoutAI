import { createHash } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { workRequests, workRequestEvents } from "@shared/schema";
import { db } from "../../db";
import { emailService } from "../../services/emailService";
import { passwordResetService } from "../../services/passwordResetService";
import { emailVerificationService } from "../../services/emailVerificationService";

export const directConnectOperationIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const directConnectRequestSchema = z.object({
  operationId: directConnectOperationIdSchema.optional(),
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
export type AdminDirectConnectCategory = (typeof ADMIN_DIRECT_CONNECT_CATEGORIES)[number];

export const adminDirectConnectRequestSchema = directConnectRequestSchema
  .extend({
    category: z.enum(ADMIN_DIRECT_CONNECT_CATEGORIES).optional(),
    targetUserId: z.string().min(1).optional(),
    targetEmail: z.string().email().optional(),
  })
  .refine((data) => Boolean(data.targetUserId || data.targetEmail), {
    message: "targetUserId or targetEmail is required",
    path: ["targetUserId"],
  });

type DirectConnectCreateOperation = "requester_create_request" | "admin_create_request";

function normalizeForOperationFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForOperationFingerprint);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForOperationFingerprint(entry)])
    );
  }
  return value;
}

export function createDirectConnectOperationFingerprint(body: Record<string, unknown>): string {
  const { operationId: _operationId, ...payload } = body;
  return createHash("sha256")
    .update(JSON.stringify(normalizeForOperationFingerprint(payload)))
    .digest("hex");
}

export async function loadDirectConnectCreateOperations(params: {
  actorUserId: string;
  operation: DirectConnectCreateOperation;
  operationId: string;
}) {
  return db
    .select({
      request: workRequests,
      metadata: workRequestEvents.metadata,
    })
    .from(workRequestEvents)
    .innerJoin(workRequests, eq(workRequests.id, workRequestEvents.workRequestId))
    .where(
      and(
        eq(workRequestEvents.actorUserId, params.actorUserId),
        sql`${workRequestEvents.metadata} ->> 'operation' = ${params.operation}`,
        sql`${workRequestEvents.metadata} ->> 'operationId' = ${params.operationId}`
      )
    )
    .orderBy(desc(workRequestEvents.createdAt), desc(workRequestEvents.id))
    .limit(2);
}

export async function releaseDirectConnectOperationLock(params: {
  client: any;
  key: string;
  label: string;
}) {
  try {
    await params.client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [params.key]);
  } catch (error) {
    console.error(`[direct-connect] Failed to release ${params.label} operation lock`, {
      operationLockKey: params.key,
      error,
    });
  } finally {
    params.client.release();
  }
}

export async function sendAdminDirectConnectAccountEmail(params: {
  publicBase: string;
  targetUser: any;
  targetEmail: string | null;
}) {
  const outcome = {
    setupEmailSent: false,
    requestEmailSent: false,
    setupEmailSkippedReason: null as string | null,
    requestEmailSkippedReason: null as string | null,
    setupEmailMessageId: undefined as string | undefined,
    requestEmailMessageId: undefined as string | undefined,
    activationLinkIncluded: false,
    verifyLinkIncluded: false,
    activationLink: undefined as string | undefined,
    verifyLink: undefined as string | undefined,
  };
  if (!params.targetUser || !params.targetEmail) return outcome;

  try {
    const publicBase = params.publicBase.replace(/\/$/, "");
    const hasPassword =
      typeof params.targetUser.password === "string" && params.targetUser.password.length > 0;
    const isEmailVerified = params.targetUser.emailVerified === true;
    const shouldSendSetupFlow = !hasPassword || !isEmailVerified;
    const shouldSendActivation = shouldSendSetupFlow && !hasPassword;
    const shouldSendVerification = shouldSendSetupFlow && !isEmailVerified;
    outcome.activationLinkIncluded = shouldSendActivation;
    outcome.verifyLinkIncluded = shouldSendVerification;

    if (shouldSendActivation) {
      const reset = await passwordResetService.createToken(String(params.targetUser.id));
      outcome.activationLink =
        `${publicBase}/reset-password?token=${reset.token}&next=` +
        encodeURIComponent("/pre-scout-setup");
    }
    if (shouldSendVerification) {
      const verify = await emailVerificationService.createToken(String(params.targetUser.id));
      outcome.verifyLink =
        `${publicBase}/verify-email?token=${verify.token}&next=` +
        encodeURIComponent("/pre-scout-setup");
    }

    if (!emailService.isConfigured()) {
      if (shouldSendSetupFlow) {
        outcome.setupEmailSkippedReason = "email_provider_not_configured";
      } else {
        outcome.requestEmailSkippedReason = "email_provider_not_configured";
      }
      return outcome;
    }

    if (shouldSendSetupFlow) {
      const emailResult = await emailService.sendEmail({
        to: params.targetEmail,
        subject: "Complete setup to access your Direct Connect request",
        html: [
          "<p>Your TradeScout Direct Connect request is ready.</p>",
          shouldSendActivation
            ? "<p>Set your password to access your account.</p>"
            : "<p>Sign in to view and manage your request.</p>",
          shouldSendVerification ? "<p>Verify your email to continue.</p>" : "",
          outcome.activationLink
            ? `<p><a href=\"${outcome.activationLink}\">Set password</a>.</p>`
            : "",
          outcome.verifyLink
            ? `<p><a href=\"${outcome.verifyLink}\">Verify your email</a>.</p>`
            : "",
          "<p>If you did not expect this, you can ignore this email.</p>",
        ].join("\n"),
        text: [
          outcome.activationLink ? `Set password: ${outcome.activationLink}` : null,
          outcome.verifyLink ? `Verify email: ${outcome.verifyLink}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        purpose: "account_verification",
      });
      outcome.setupEmailSent = emailResult.skipped !== true;
      outcome.setupEmailMessageId = emailResult.messageId;
      outcome.setupEmailSkippedReason =
        emailResult.skipped === true ? "suppressed_or_unconfigured" : null;
      return outcome;
    }

    const emailResult = await emailService.sendEmail({
      to: params.targetEmail,
      subject: "You have a new TradeScout Direct Connect request",
      html: [
        "<p>A Direct Connect request was created for your account.</p>",
        `<p><a href=\"${publicBase}/direct-connect\">Open Direct Connect</a>.</p>`,
        "<p>If you did not expect this, you can ignore this email.</p>",
      ].join("\n"),
      text: `Open Direct Connect: ${publicBase}/direct-connect`,
      purpose: "notification",
    });
    outcome.requestEmailSent = emailResult.skipped !== true;
    outcome.requestEmailMessageId = emailResult.messageId;
    outcome.requestEmailSkippedReason =
      emailResult.skipped === true ? "suppressed_or_unconfigured" : null;
  } catch (error) {
    console.error("[direct-connect] Admin request email failed after request creation", error);
    if (outcome.activationLinkIncluded || outcome.verifyLinkIncluded) {
      outcome.setupEmailSkippedReason = "email_delivery_failed";
    } else {
      outcome.requestEmailSkippedReason = "email_delivery_failed";
    }
  }

  return outcome;
}

const DIRECT_CONNECT_ADMIN_STATUSES = [
  "draft",
  "open",
  "routed",
  "in_progress",
  "pending_outcome",
  "completed",
  "cancelled",
] as const;

export const directConnectAdminQueueSchema = z.object({
  status: z.enum(["all", ...DIRECT_CONNECT_ADMIN_STATUSES]).default("all"),
  search: z.string().trim().max(200).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const assignmentResponseSchema = z
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
