import { db, pool } from "./db";
import {
  notifications,
  notificationPreferences,
  userPersonalEvents,
  notificationTemplates,
  notificationDeliveryLog,
  notificationJobs,
  users,
  pushSubscriptions,
  type Notification,
  type InsertNotification,
  type NotificationPreferences,
  type InsertNotificationPreferences,
  type UserPersonalEvent,
  type InsertUserPersonalEvent,
  type NotificationTemplate,
  type InsertNotificationTemplate,
  type User,
  type MarketplaceListing,
} from "@shared/schema";
import { eq, and, or, sql, desc, asc, isNull, inArray } from "drizzle-orm";
import webPush from "web-push";
import { emailService, type SendEmailResult } from "./services/emailService";
import { passwordResetService } from "./services/passwordResetService";
import { emailVerificationService } from "./services/emailVerificationService";

export type NotificationEmailPurpose =
  | "notification"
  | "direct_connect_account_setup"
  | "direct_connect_request"
  | "direct_connect_admin_oversight"
  | "tradepartner_request_notification";

export type NotificationDeliveryMethod = "in_app" | "email" | "sms" | "push" | "webhook";
export type NotificationDeliveryStatus =
  | "pending"
  | "processing"
  | "retry_scheduled"
  | "sent"
  | "delivered"
  | "accepted_unreconciled"
  | "delivery_unknown"
  | "failed"
  | "bounced"
  | "suppressed"
  | "exhausted";

export type NotificationDeliveryLogInput = {
  notificationId: string;
  userId: string;
  deliveryMethod: NotificationDeliveryMethod;
  status: NotificationDeliveryStatus;
  contactInfo?: string;
  externalId?: string;
  externalResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
};

type NotificationEmailSender = Pick<typeof emailService, "isConfigured" | "sendEmail">;

export type NotificationAccountSetupCredentialIssuer = {
  createPasswordResetToken: (
    userId: string,
    deliveryIntentId: string
  ) => { token: string } | PromiseLike<{ token: string }>;
  createEmailVerificationToken: (
    userId: string,
    deliveryIntentId: string
  ) => { token: string } | PromiseLike<{ token: string }>;
};

type ClaimedEmailDelivery = {
  id: string;
  notificationId: string;
  userId: string;
  retryCount: number;
  claimToken: string;
};

export type NotificationEmailDeliveryProcessorOptions = {
  batchSize?: number;
  concurrency?: number;
  notificationId?: string;
  now?: Date;
  maxAttempts?: number;
  leaseMs?: number;
  providerTimeoutMs?: number;
  baseRetryMs?: number;
  maxRetryMs?: number;
};

export type NotificationEmailDeliveryProcessorResult = {
  claimed: number;
  sent: number;
  retryScheduled: number;
  terminal: number;
  requeuedBeforeProvider: number;
};

const KNOWN_DELIVERY_METHODS = new Set<NotificationDeliveryMethod>([
  "in_app",
  "email",
  "sms",
  "push",
  "webhook",
]);
const TERMINAL_DELIVERY_STATUSES = new Set<NotificationDeliveryStatus>([
  "sent",
  "delivered",
  "accepted_unreconciled",
  "delivery_unknown",
  "failed",
  "bounced",
  "suppressed",
  "exhausted",
]);
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ENETDOWN",
  "ENETRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const PERMANENT_EMAIL_ERROR_CODES = new Set([
  "DIRECT_CONNECT_EMAIL_TEMPLATE_INVALID",
  "EMAIL_MODE_SUPPRESSED",
  "EMAIL_NOTIFICATIONS_DISABLED",
  "EMAIL_PROVIDER_NOT_CONFIGURED",
  "GLOBAL_NOTIFICATIONS_DISABLED",
  "NOTIFICATION_TYPE_DISABLED",
  "NOTIFICATION_TYPE_EMAIL_DISABLED",
  "RECIPIENT_EMAIL_MISSING",
]);
const DEFAULT_EMAIL_DELIVERY_BATCH_SIZE = 25;
const DEFAULT_EMAIL_DELIVERY_CONCURRENCY = 5;
const DEFAULT_EMAIL_DELIVERY_LEASE_MS = 2 * 60 * 1000;
const DEFAULT_EMAIL_DELIVERY_MAX_ATTEMPTS = 5;
const DEFAULT_EMAIL_PROVIDER_TIMEOUT_MS = 30 * 1000;
const DEFAULT_EMAIL_DELIVERY_BASE_RETRY_MS = 60 * 1000;
const DEFAULT_EMAIL_DELIVERY_MAX_RETRY_MS = 60 * 60 * 1000;

function readBoundedInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function normalizeDeliveryMethods(
  methods: readonly string[] | null | undefined
): NotificationDeliveryMethod[] {
  const normalized = (methods?.length ? methods : ["in_app"]).filter(
    (method): method is NotificationDeliveryMethod =>
      KNOWN_DELIVERY_METHODS.has(method as NotificationDeliveryMethod)
  );
  return Array.from(
    new Set<NotificationDeliveryMethod>(normalized.length ? normalized : ["in_app"])
  );
}

function extractDeliveryStatusCode(error: unknown): number | null {
  const details =
    error && typeof error === "object"
      ? (error as {
          status?: unknown;
          statusCode?: unknown;
          response?: { status?: unknown };
        })
      : null;
  const explicit = Number(details?.statusCode ?? details?.status ?? details?.response?.status);
  if (Number.isInteger(explicit) && explicit >= 100 && explicit <= 599) {
    return explicit;
  }

  const message = error instanceof Error ? error.message : String(error || "");
  const match = message.match(/\b(?:failed|error|status)\s*\((\d{3})\)/i);
  const parsed = Number(match?.[1]);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 599 ? parsed : null;
}

export function isNotificationDeliveryTerminalStatus(status: unknown): boolean {
  return TERMINAL_DELIVERY_STATUSES.has(
    String(status || "")
      .trim()
      .toLowerCase() as NotificationDeliveryStatus
  );
}

export function calculateNotificationEmailRetryDelayMs(
  attemptNumber: number,
  baseRetryMs = DEFAULT_EMAIL_DELIVERY_BASE_RETRY_MS,
  maxRetryMs = DEFAULT_EMAIL_DELIVERY_MAX_RETRY_MS
): number {
  const safeAttempt = Math.max(1, Math.floor(attemptNumber));
  const safeBase = Math.max(1, Math.floor(baseRetryMs));
  const safeMaximum = Math.max(safeBase, Math.floor(maxRetryMs));
  return Math.min(safeMaximum, safeBase * 2 ** Math.max(0, safeAttempt - 1));
}

export function resolveNotificationEmailProviderTimeoutMs(
  leaseMs: number,
  requestedTimeoutMs = DEFAULT_EMAIL_PROVIDER_TIMEOUT_MS
): number {
  const safeLeaseMs = Math.max(1_000, Math.floor(leaseMs));
  const leaseSafetyMarginMs = Math.max(250, Math.min(5_000, Math.floor(safeLeaseMs / 4)));
  const maximumInLeaseTimeoutMs = safeLeaseMs - leaseSafetyMarginMs;
  const safeRequestedTimeoutMs = Math.max(250, Math.floor(requestedTimeoutMs));
  return Math.min(maximumInLeaseTimeoutMs, safeRequestedTimeoutMs);
}

export function classifyNotificationEmailFailure(error: unknown): {
  retryable: boolean;
  status: "failed" | "suppressed";
  errorCode: string;
  errorMessage: string;
  statusCode: number | null;
} {
  const failure = resolveNotificationDeliveryFailure(error, "email");
  const details =
    error && typeof error === "object"
      ? (error as { code?: unknown; deliveryErrorCode?: unknown })
      : null;
  const rawCode = String(details?.deliveryErrorCode || details?.code || "")
    .trim()
    .toUpperCase();
  const statusCode = extractDeliveryStatusCode(error);

  if (
    failure.status === "suppressed" ||
    PERMANENT_EMAIL_ERROR_CODES.has(failure.errorCode) ||
    PERMANENT_EMAIL_ERROR_CODES.has(rawCode)
  ) {
    return { ...failure, retryable: false, statusCode };
  }

  if (statusCode === 408 || statusCode === 425 || statusCode === 429) {
    return { ...failure, retryable: true, statusCode };
  }
  if (statusCode !== null && statusCode >= 500) {
    return { ...failure, retryable: true, statusCode };
  }
  if (statusCode !== null && statusCode >= 400) {
    return { ...failure, retryable: false, statusCode };
  }
  if (TRANSIENT_ERROR_CODES.has(rawCode)) {
    return { ...failure, retryable: true, statusCode };
  }

  // Unknown transport failures are retried within the bounded budget. This is
  // safer than dropping a request email on the first ambiguous network error.
  return { ...failure, retryable: true, statusCode };
}

export type EmailSuppression = {
  errorCode:
    | "GLOBAL_NOTIFICATIONS_DISABLED"
    | "NOTIFICATION_TYPE_DISABLED"
    | "NOTIFICATION_TYPE_EMAIL_DISABLED"
    | "EMAIL_NOTIFICATIONS_DISABLED"
    | "RECIPIENT_EMAIL_MISSING";
  errorMessage: string;
};

export function resolveRequestedEmailSuppression(input: {
  requestedDeliveryMethods: readonly string[];
  typeDeliveryMethods?: readonly string[] | null;
  globalNotificationsEnabled: boolean;
  typeNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  recipientEmail?: string | null;
  notificationType: string;
}): EmailSuppression | null {
  const requestedEmail = input.requestedDeliveryMethods.includes("email");
  const hasTypeOverride = Array.isArray(input.typeDeliveryMethods);
  const typeRequestsEmail = input.typeDeliveryMethods?.includes("email") === true;
  const emailWasRequested = requestedEmail || typeRequestsEmail;

  if (!emailWasRequested) return null;

  if (!input.globalNotificationsEnabled) {
    return {
      errorCode: "GLOBAL_NOTIFICATIONS_DISABLED",
      errorMessage: "Email suppressed because the recipient disabled all notifications.",
    };
  }

  if (!input.typeNotificationsEnabled) {
    return {
      errorCode: "NOTIFICATION_TYPE_DISABLED",
      errorMessage: `Email suppressed because the recipient disabled ${input.notificationType} notifications.`,
    };
  }

  if (requestedEmail && hasTypeOverride && !typeRequestsEmail) {
    return {
      errorCode: "NOTIFICATION_TYPE_EMAIL_DISABLED",
      errorMessage:
        "Email suppressed because the recipient's notification-type preference excludes email delivery.",
    };
  }

  if (!input.emailNotificationsEnabled) {
    return {
      errorCode: "EMAIL_NOTIFICATIONS_DISABLED",
      errorMessage: "Email suppressed because the recipient disabled email notifications.",
    };
  }

  if (!String(input.recipientEmail || "").trim()) {
    return {
      errorCode: "RECIPIENT_EMAIL_MISSING",
      errorMessage: "Email suppressed because the recipient has no email address.",
    };
  }

  return null;
}

export function resolveNotificationDeliveryFailure(
  error: unknown,
  deliveryMethod: NotificationDeliveryMethod
): {
  status: "failed" | "suppressed";
  errorCode: string;
  errorMessage: string;
} {
  const details =
    error && typeof error === "object"
      ? (error as {
          code?: unknown;
          statusCode?: unknown;
          deliveryStatus?: unknown;
          deliveryErrorCode?: unknown;
          message?: unknown;
        })
      : null;
  const status = details?.deliveryStatus === "suppressed" ? "suppressed" : "failed";
  const explicitCode = String(details?.deliveryErrorCode || "").trim();
  const providerCode = String(details?.code || details?.statusCode || "")
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  const prefix = deliveryMethod.toUpperCase();
  const errorCode =
    explicitCode || (providerCode ? `${prefix}_${providerCode}` : `${prefix}_DELIVERY_FAILED`);
  const errorMessage =
    error instanceof Error
      ? error.message
      : String(details?.message || error || `${deliveryMethod} delivery failed`);

  return {
    status,
    errorCode,
    errorMessage,
  };
}

export function buildNotificationDeliveryLogValues(
  input: NotificationDeliveryLogInput,
  now: Date = new Date()
) {
  return {
    notificationId: input.notificationId,
    userId: input.userId,
    deliveryMethod: input.deliveryMethod,
    status: input.status,
    contactInfo: input.contactInfo,
    externalId: input.externalId,
    externalResponse: input.externalResponse,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    // "sent" means the provider accepted the message. A provider callback
    // must establish "delivered"; acceptance alone never sets deliveredAt.
    sentAt: input.status === "sent" || input.status === "delivered" ? now : undefined,
    deliveredAt: input.status === "delivered" ? now : undefined,
    failedAt: input.status === "failed" ? now : undefined,
  };
}

class NotificationDeliveryAttemptError extends Error {
  constructor(
    readonly deliveryStatus: "failed" | "suppressed",
    readonly deliveryErrorCode: string,
    message: string
  ) {
    super(message);
    this.name = "NotificationDeliveryAttemptError";
  }
}

const CANONICAL_TRADESCOUT_BASE_URL = "https://www.thetradescout.com";

export function resolveNotificationEmailPurpose(metadata: unknown): NotificationEmailPurpose {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "notification";
  }

  if (!Object.prototype.hasOwnProperty.call(metadata, "emailPurpose")) {
    return "notification";
  }

  const purpose = String((metadata as Record<string, unknown>).emailPurpose || "")
    .toLowerCase()
    .trim();

  if (
    purpose === "direct_connect_account_setup" ||
    purpose === "direct_connect_request" ||
    purpose === "direct_connect_admin_oversight" ||
    purpose === "tradepartner_request_notification"
  ) {
    return purpose;
  }

  return "notification";
}

function isOperationalDirectConnectEmailPurpose(purpose: NotificationEmailPurpose): boolean {
  return (
    purpose === "direct_connect_account_setup" ||
    purpose === "direct_connect_request" ||
    purpose === "direct_connect_admin_oversight" ||
    purpose === "tradepartner_request_notification"
  );
}

export function resolveCanonicalTradeScoutBaseUrl(
  candidate: unknown = process.env.APP_BASE_URL
): string {
  if (typeof candidate !== "string" || !candidate.trim()) {
    return CANONICAL_TRADESCOUT_BASE_URL;
  }

  try {
    const url = new URL(candidate.trim());
    if (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "www.thetradescout.com" &&
      !url.username &&
      !url.password
    ) {
      return CANONICAL_TRADESCOUT_BASE_URL;
    }
  } catch {
    // Fall through to the canonical production origin.
  }

  return CANONICAL_TRADESCOUT_BASE_URL;
}

export function resolveNotificationEmailActionUrl(
  actionUrl: unknown,
  candidateBaseUrl?: unknown
): string | null {
  const rawActionUrl = String(actionUrl || "").trim();
  if (!rawActionUrl) return null;

  const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl);
  try {
    const resolved = new URL(rawActionUrl, `${canonicalBaseUrl}/`);
    const canonical = new URL(canonicalBaseUrl);
    if (resolved.origin !== canonical.origin) return null;

    return `${canonicalBaseUrl}${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function escapeNotificationEmailHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type NotificationEmailContent = {
  userId?: unknown;
  title?: unknown;
  message?: unknown;
  actionUrl?: unknown;
  actionText?: unknown;
};

type NotificationEmailRecipient = {
  id?: unknown;
  firstName?: unknown;
  email?: unknown;
  password?: unknown;
  emailVerified?: unknown;
};

export function renderNotificationEmailHtml(
  notification: NotificationEmailContent,
  user: NotificationEmailRecipient,
  candidateBaseUrl?: unknown
): string {
  const title = escapeNotificationEmailHtml(notification.title);
  const message = escapeNotificationEmailHtml(notification.message);
  const userName = escapeNotificationEmailHtml(user.firstName || "there");
  const actionText = escapeNotificationEmailHtml(notification.actionText || "View Details");
  const actionUrl = resolveNotificationEmailActionUrl(notification.actionUrl, candidateBaseUrl);
  const safeActionUrl = actionUrl ? escapeNotificationEmailHtml(actionUrl) : null;

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f97316; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #f97316;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 10px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>TradeScout</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>Hi ${userName},</p>
            <p>${message}</p>
            ${
              safeActionUrl
                ? `<p><a href="${safeActionUrl}" class="button">${actionText}</a></p>`
                : ""
            }
          </div>
          <div class="footer">
            <p>This notification was sent from TradeScout. If you no longer wish to receive these emails, you can update your notification preferences in your account settings.</p>
          </div>
        </div>
      </body>
      </html>
    `;
}

export function renderNotificationEmailText(
  notification: NotificationEmailContent,
  candidateBaseUrl?: unknown
): string {
  const actionUrl = resolveNotificationEmailActionUrl(notification.actionUrl, candidateBaseUrl);
  return [
    String(notification.message ?? ""),
    actionUrl ? `${String(notification.actionText || "View Details")}: ${actionUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type NotificationEmailPayload = {
  subject: string;
  html: string;
  text: string;
};

type PreparedNotificationEmail = {
  recipientEmail: string;
  purpose: NotificationEmailPurpose;
  payload: NotificationEmailPayload;
};

function resolveNotificationEmailTemplate(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const template = (metadata as Record<string, unknown>).emailTemplate;
  return template && typeof template === "object" && !Array.isArray(template)
    ? (template as Record<string, unknown>)
    : null;
}

function normalizeNotificationRecipientEmail(value: unknown): string | null {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function normalizeNotificationTemplateText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function resolveNotificationEmailRecipient(
  notification: NotificationEmailContent & { metadata?: unknown },
  user: NotificationEmailRecipient
): string | null {
  const template = resolveNotificationEmailTemplate(notification.metadata);
  if (template?.kind !== "tradepartner_profile_request") {
    return normalizeNotificationRecipientEmail(user.email);
  }

  const templateOwnerUserId = String(template.ownerUserId || "").trim();
  const notificationUserId = String(notification.userId || "").trim();
  const recipientUserId = String(user.id || "").trim();
  if (
    !templateOwnerUserId ||
    !notificationUserId ||
    !recipientUserId ||
    templateOwnerUserId !== notificationUserId ||
    templateOwnerUserId !== recipientUserId
  ) {
    return null;
  }
  return normalizeNotificationRecipientEmail(template.recipientEmail);
}

export function renderNotificationEmailPayload(
  notification: NotificationEmailContent & { metadata?: unknown },
  user: NotificationEmailRecipient,
  candidateBaseUrl?: unknown
): NotificationEmailPayload {
  const template = resolveNotificationEmailTemplate(notification.metadata);

  if (template?.kind === "direct_connect_request_created") {
    const workRequestId = String(template.workRequestId || "").trim();
    if (!workRequestId) {
      throw new NotificationDeliveryAttemptError(
        "failed",
        "DIRECT_CONNECT_EMAIL_TEMPLATE_INVALID",
        "Direct Connect request email is missing its durable request identifier."
      );
    }
    const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl);
    const requestUrl = `${canonicalBaseUrl}/direct-connect/engagements?requestId=${encodeURIComponent(
      workRequestId
    )}`;
    const safeRequestUrl = escapeNotificationEmailHtml(requestUrl);
    return {
      subject: "You have a new TradeScout Direct Connect request",
      html: [
        "<p>A Direct Connect request was created for your account.</p>",
        `<p><a href="${safeRequestUrl}">Open Direct Connect</a>.</p>`,
        "<p>If you did not expect this, you can ignore this email.</p>",
      ].join("\n"),
      text: `Open Direct Connect: ${requestUrl}`,
    };
  }

  if (template?.kind === "tradepartner_profile_request") {
    const workRequestId = String(template.workRequestId || "").trim();
    const businessName = normalizeNotificationTemplateText(template.businessName, 180);
    const requesterDisplayName = normalizeNotificationTemplateText(
      template.requesterDisplayName,
      120
    );
    const requestSummary = normalizeNotificationTemplateText(template.requestSummary, 180);
    const stoneName = normalizeNotificationTemplateText(template.stoneName, 180);
    const recipientEmail = resolveNotificationEmailRecipient(notification, user);
    if (
      !workRequestId ||
      !businessName ||
      !requesterDisplayName ||
      !requestSummary ||
      !recipientEmail
    ) {
      throw new NotificationDeliveryAttemptError(
        "failed",
        "DIRECT_CONNECT_EMAIL_TEMPLATE_INVALID",
        "TradePartner request email has invalid durable identifiers."
      );
    }
    const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl);
    const inboxUrl = `${canonicalBaseUrl}/direct-connect/inbox`;
    const safeInboxUrl = escapeNotificationEmailHtml(inboxUrl);
    const safeBusinessName = escapeNotificationEmailHtml(businessName);
    const safeRequesterDisplayName = escapeNotificationEmailHtml(requesterDisplayName);
    const safeRequestSummary = escapeNotificationEmailHtml(requestSummary);
    const safeStoneName = stoneName ? escapeNotificationEmailHtml(stoneName) : null;
    return {
      subject: `New request for ${businessName}`,
      html: [
        `<p>${safeRequesterDisplayName} sent a request through your ${safeBusinessName} profile on TradeScout.</p>`,
        safeStoneName ? `<p><strong>Stone:</strong> ${safeStoneName}</p>` : "",
        `<p><strong>Request type:</strong> ${safeRequestSummary}</p>`,
        "<p>Contact details stay inside TradeScout until you respond -- open Direct Connect to view the full message and reply.</p>",
        `<p><a href="${safeInboxUrl}">Open Direct Connect inbox</a>.</p>`,
      ]
        .filter(Boolean)
        .join("\n"),
      text: [
        `${requesterDisplayName} sent a request through your ${businessName} profile on TradeScout.`,
        stoneName ? `Stone: ${stoneName}` : null,
        `Request type: ${requestSummary}`,
        `Open Direct Connect inbox: ${inboxUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    subject: String(notification.title || ""),
    html: renderNotificationEmailHtml(notification, user, candidateBaseUrl),
    text: renderNotificationEmailText(notification, candidateBaseUrl),
  };
}

export async function renderNotificationEmailPayloadForAttempt(
  notification: NotificationEmailContent & { metadata?: unknown },
  user: NotificationEmailRecipient,
  credentialIssuer: NotificationAccountSetupCredentialIssuer,
  deliveryIntentId: string,
  candidateBaseUrl?: unknown
): Promise<NotificationEmailPayload> {
  const template = resolveNotificationEmailTemplate(notification.metadata);
  if (template?.kind !== "direct_connect_account_setup") {
    return renderNotificationEmailPayload(notification, user, candidateBaseUrl);
  }

  const workRequestId = String(template.workRequestId || "").trim();
  const templateUserId = String(template.userId || "").trim();
  const notificationUserId = String(notification.userId || "").trim();
  const recipientUserId = String(user.id || "").trim();
  const normalizedDeliveryIntentId = String(deliveryIntentId || "").trim();
  if (
    !workRequestId ||
    !templateUserId ||
    !notificationUserId ||
    !recipientUserId ||
    !normalizedDeliveryIntentId ||
    templateUserId !== notificationUserId ||
    templateUserId !== recipientUserId
  ) {
    throw new NotificationDeliveryAttemptError(
      "failed",
      "DIRECT_CONNECT_EMAIL_TEMPLATE_INVALID",
      "Direct Connect account-setup email has invalid durable identifiers."
    );
  }

  const needsPassword = typeof user.password !== "string" || user.password.length === 0;
  const needsEmailVerification = user.emailVerified !== true;
  let passwordCredential: { token: string } | null = null;
  let verificationCredential: { token: string } | null = null;
  try {
    if (needsPassword) {
      passwordCredential = await credentialIssuer.createPasswordResetToken(
        templateUserId,
        normalizedDeliveryIntentId
      );
    }
    if (needsEmailVerification) {
      verificationCredential = await credentialIssuer.createEmailVerificationToken(
        templateUserId,
        normalizedDeliveryIntentId
      );
    }
  } catch {
    throw new NotificationDeliveryAttemptError(
      "failed",
      "DIRECT_CONNECT_SETUP_CREDENTIAL_ISSUANCE_FAILED",
      "Direct Connect account-setup credentials could not be issued for this delivery attempt."
    );
  }

  if (
    (needsPassword && !String(passwordCredential?.token || "").trim()) ||
    (needsEmailVerification && !String(verificationCredential?.token || "").trim())
  ) {
    throw new NotificationDeliveryAttemptError(
      "failed",
      "DIRECT_CONNECT_SETUP_CREDENTIAL_ISSUANCE_FAILED",
      "Direct Connect account-setup credentials could not be issued for this delivery attempt."
    );
  }

  const canonicalBaseUrl = resolveCanonicalTradeScoutBaseUrl(candidateBaseUrl);
  const requestUrl = `${canonicalBaseUrl}/direct-connect/engagements?requestId=${encodeURIComponent(
    workRequestId
  )}`;
  const passwordUrl = passwordCredential
    ? `${canonicalBaseUrl}/reset-password?token=${encodeURIComponent(
        passwordCredential.token
      )}&next=${encodeURIComponent("/pre-scout-setup")}`
    : null;
  const verificationUrl = verificationCredential
    ? `${canonicalBaseUrl}/verify-email?token=${encodeURIComponent(
        verificationCredential.token
      )}&next=${encodeURIComponent("/pre-scout-setup")}`
    : null;
  const safeRequestUrl = escapeNotificationEmailHtml(requestUrl);
  const safePasswordUrl = passwordUrl ? escapeNotificationEmailHtml(passwordUrl) : null;
  const safeVerificationUrl = verificationUrl ? escapeNotificationEmailHtml(verificationUrl) : null;

  return {
    subject: "Complete setup to access your Direct Connect request",
    html: [
      "<p>Your TradeScout Direct Connect request is ready.</p>",
      needsPassword
        ? "<p>Set your password to access your account.</p>"
        : "<p>Sign in to view and manage your request.</p>",
      needsEmailVerification ? "<p>Verify your email to continue.</p>" : "",
      safePasswordUrl ? `<p><a href="${safePasswordUrl}">Set password</a>.</p>` : "",
      safeVerificationUrl ? `<p><a href="${safeVerificationUrl}">Verify your email</a>.</p>` : "",
      `<p><a href="${safeRequestUrl}">Open Direct Connect</a>.</p>`,
      "<p>If you did not expect this, you can ignore this email.</p>",
    ].join("\n"),
    text: [
      passwordUrl ? `Set password: ${passwordUrl}` : null,
      verificationUrl ? `Verify email: ${verificationUrl}` : null,
      `Open Direct Connect: ${requestUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export type NotificationServiceOptions = {
  emailSender?: NotificationEmailSender;
  accountSetupCredentialIssuer?: NotificationAccountSetupCredentialIssuer;
  emailDelivery?: Omit<
    NotificationEmailDeliveryProcessorOptions,
    "batchSize" | "notificationId" | "now"
  >;
};

export type DirectConnectRequestEmailInput = {
  userId: string;
  workRequestId: string;
  requestTitle: string;
  metadata?: Record<string, unknown>;
};

export type DirectConnectAccountSetupEmailInput = {
  userId: string;
  workRequestId: string;
};

export type TradePartnerRequestNotificationInput = {
  ownerUserId: string;
  workRequestId: string;
  recipientEmail: string | null;
  businessName: string;
  requesterDisplayName: string;
  requestSummary: string;
  stoneName?: string | null;
};

export type DirectConnectEmailResult = {
  notification: Notification;
  delivery: {
    id: string;
    status: string;
    externalId: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    retryCount: number;
    nextRetryAt: Date | null;
  } | null;
};

export type DirectConnectRequestEmailResult = DirectConnectEmailResult;

// Notification Service Class
export class NotificationService {
  private webPushConfigured = false;
  private readonly emailSender: NotificationEmailSender;
  private readonly accountSetupCredentialIssuer: NotificationAccountSetupCredentialIssuer;
  private readonly emailDeliveryDefaults: Required<
    Pick<
      NotificationEmailDeliveryProcessorOptions,
      "maxAttempts" | "leaseMs" | "providerTimeoutMs" | "baseRetryMs" | "maxRetryMs"
    >
  >;

  constructor(options: NotificationServiceOptions = {}) {
    this.emailSender = options.emailSender || emailService;
    this.accountSetupCredentialIssuer = options.accountSetupCredentialIssuer || {
      createPasswordResetToken: async (userId: string, deliveryIntentId: string) =>
        await passwordResetService.createScopedToken(
          userId,
          `notification-delivery:${deliveryIntentId}`
        ),
      createEmailVerificationToken: async (userId: string, deliveryIntentId: string) =>
        await emailVerificationService.createScopedToken(
          userId,
          `notification-delivery:${deliveryIntentId}`
        ),
    };
    this.emailDeliveryDefaults = {
      maxAttempts:
        options.emailDelivery?.maxAttempts ??
        readBoundedInteger(
          process.env.NOTIFICATION_EMAIL_MAX_ATTEMPTS,
          DEFAULT_EMAIL_DELIVERY_MAX_ATTEMPTS,
          1,
          12
        ),
      leaseMs:
        options.emailDelivery?.leaseMs ??
        readBoundedInteger(
          process.env.NOTIFICATION_EMAIL_LEASE_MS,
          DEFAULT_EMAIL_DELIVERY_LEASE_MS,
          10_000,
          15 * 60 * 1000
        ),
      providerTimeoutMs:
        options.emailDelivery?.providerTimeoutMs ??
        readBoundedInteger(
          process.env.NOTIFICATION_EMAIL_PROVIDER_TIMEOUT_MS,
          DEFAULT_EMAIL_PROVIDER_TIMEOUT_MS,
          250,
          2 * 60 * 1000
        ),
      baseRetryMs:
        options.emailDelivery?.baseRetryMs ??
        readBoundedInteger(
          process.env.NOTIFICATION_EMAIL_RETRY_BASE_MS,
          DEFAULT_EMAIL_DELIVERY_BASE_RETRY_MS,
          1_000,
          60 * 60 * 1000
        ),
      maxRetryMs:
        options.emailDelivery?.maxRetryMs ??
        readBoundedInteger(
          process.env.NOTIFICATION_EMAIL_RETRY_MAX_MS,
          DEFAULT_EMAIL_DELIVERY_MAX_RETRY_MS,
          1_000,
          24 * 60 * 60 * 1000
        ),
    };
    if (
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ) {
      webPush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      this.webPushConfigured = true;
    }
  }

  // =====================================
  // GEO UTILS
  // =====================================

  /**
   * Compute haversine distance between two lat/lng points in meters.
   */
  private haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371e3; // Earth radius in meters

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // =====================================
  // NOTIFICATION OPERATIONS
  // =====================================

  async enqueueNotification(tx: any, notification: InsertNotification): Promise<Notification> {
    const notificationData: any = {
      ...notification,
      deliveryMethods: normalizeDeliveryMethods(notification.deliveryMethods as string[] | null),
    };
    const [inserted] = await tx.insert(notifications).values([notificationData]).returning();
    const now = new Date();
    const deliveryMethods = normalizeDeliveryMethods(inserted.deliveryMethods);
    await tx.insert(notificationDeliveryLog).values(
      deliveryMethods.map((deliveryMethod) => ({
        notificationId: inserted.id,
        userId: inserted.userId,
        deliveryMethod,
        status: deliveryMethod === "in_app" ? "delivered" : "pending",
        retryCount: 0,
        nextRetryAt:
          deliveryMethod === "in_app"
            ? null
            : inserted.scheduledFor || notification.scheduledFor || now,
        deliveredAt: deliveryMethod === "in_app" ? now : null,
        createdAt: now,
        updatedAt: now,
      }))
    );
    return inserted;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const created = await db.transaction((tx: any) => this.enqueueNotification(tx, notification));
    // Send notification if not scheduled
    if (!notification.scheduledFor) {
      await this.sendNotification(created.id);
    }

    return created;
  }

  async createDirectConnectRequestEmail(
    input: DirectConnectRequestEmailInput
  ): Promise<DirectConnectRequestEmailResult> {
    const enqueued = await db.transaction((tx: any) =>
      this.enqueueDirectConnectRequestEmail(tx, input)
    );
    return this.dispatchDirectConnectRequestEmail(enqueued.notification.id);
  }

  async enqueueDirectConnectRequestEmail(
    tx: any,
    input: DirectConnectRequestEmailInput
  ): Promise<DirectConnectRequestEmailResult> {
    const workRequestId = String(input.workRequestId || "").trim();
    if (!workRequestId) {
      throw new Error("Direct Connect request email requires a workRequestId.");
    }
    const now = new Date();
    const [notification] = await tx
      .insert(notifications)
      .values({
        userId: input.userId,
        type: "new_project_request",
        priority: "high",
        title: "You have a new TradeScout Direct Connect request",
        message: `A Direct Connect request was created for your account: ${input.requestTitle}`,
        actionUrl: `/direct-connect/engagements?requestId=${encodeURIComponent(workRequestId)}`,
        actionText: "Open Direct Connect",
        iconName: "briefcase",
        iconColor: "orange",
        metadata: {
          ...(input.metadata || {}),
          workRequestId,
          emailPurpose: "direct_connect_request",
          emailTemplate: {
            kind: "direct_connect_request_created",
            workRequestId,
          },
        },
        deliveryMethods: ["in_app", "email"],
      })
      .returning();
    const deliveryIntents = await tx
      .insert(notificationDeliveryLog)
      .values([
        {
          notificationId: notification.id,
          userId: input.userId,
          deliveryMethod: "in_app",
          status: "delivered",
          retryCount: 0,
          nextRetryAt: null,
          deliveredAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          notificationId: notification.id,
          userId: input.userId,
          deliveryMethod: "email",
          status: "pending",
          retryCount: 0,
          nextRetryAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .returning();
    const delivery = deliveryIntents.find((intent: any) => intent.deliveryMethod === "email");
    if (!delivery) {
      throw new Error("Direct Connect request email intent was not persisted.");
    }

    return {
      notification,
      delivery: this.serializeDirectConnectRequestEmailDelivery(delivery),
    };
  }

  async enqueueDirectConnectAccountSetupEmail(
    tx: any,
    input: DirectConnectAccountSetupEmailInput
  ): Promise<DirectConnectEmailResult> {
    const userId = String(input.userId || "").trim();
    const workRequestId = String(input.workRequestId || "").trim();
    if (!userId || !workRequestId) {
      throw new Error(
        "Direct Connect account-setup email requires durable user and work request identifiers."
      );
    }

    const now = new Date();
    const [notification] = await tx
      .insert(notifications)
      .values({
        userId,
        type: "new_project_request",
        priority: "high",
        title: "Complete setup to access your Direct Connect request",
        message: "Your TradeScout Direct Connect request is ready.",
        actionUrl: `/direct-connect/engagements?requestId=${encodeURIComponent(workRequestId)}`,
        actionText: "Open Direct Connect",
        iconName: "briefcase",
        iconColor: "orange",
        metadata: {
          workRequestId,
          emailPurpose: "direct_connect_account_setup",
          emailTemplate: {
            kind: "direct_connect_account_setup",
            userId,
            workRequestId,
          },
        },
        deliveryMethods: ["in_app", "email"],
      })
      .returning();
    const deliveryIntents = await tx
      .insert(notificationDeliveryLog)
      .values([
        {
          notificationId: notification.id,
          userId,
          deliveryMethod: "in_app",
          status: "delivered",
          retryCount: 0,
          nextRetryAt: null,
          deliveredAt: now,
          createdAt: now,
          updatedAt: now,
        },
        {
          notificationId: notification.id,
          userId,
          deliveryMethod: "email",
          status: "pending",
          retryCount: 0,
          nextRetryAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .returning();
    const delivery = deliveryIntents.find((intent: any) => intent.deliveryMethod === "email");
    if (!delivery) {
      throw new Error("Direct Connect account-setup email intent was not persisted.");
    }

    return {
      notification,
      delivery: this.serializeDirectConnectRequestEmailDelivery(delivery),
    };
  }

  async enqueueTradePartnerRequestNotification(
    tx: any,
    input: TradePartnerRequestNotificationInput
  ): Promise<DirectConnectEmailResult> {
    const ownerUserId = String(input.ownerUserId || "").trim();
    const workRequestId = String(input.workRequestId || "").trim();
    const recipientEmail = input.recipientEmail
      ? normalizeNotificationRecipientEmail(input.recipientEmail)
      : null;
    const businessName = normalizeNotificationTemplateText(input.businessName, 180);
    const requesterDisplayName = normalizeNotificationTemplateText(input.requesterDisplayName, 120);
    const requestSummary = normalizeNotificationTemplateText(input.requestSummary, 180);
    const stoneName = normalizeNotificationTemplateText(input.stoneName, 180) || null;
    if (
      !ownerUserId ||
      !workRequestId ||
      !businessName ||
      !requesterDisplayName ||
      !requestSummary ||
      (input.recipientEmail && !recipientEmail)
    ) {
      throw new Error(
        "TradePartner request notification requires valid durable routing identifiers."
      );
    }

    const now = new Date();
    const deliveryMethods: NotificationDeliveryMethod[] = recipientEmail
      ? ["in_app", "email"]
      : ["in_app"];
    const [notification] = await tx
      .insert(notifications)
      .values({
        userId: ownerUserId,
        type: "new_project_request",
        priority: "high",
        title: `New request for ${businessName}`,
        message: `${requesterDisplayName} sent a request from the public profile.`,
        actionUrl: "/direct-connect/inbox",
        actionText: "Open request",
        iconName: "briefcase",
        iconColor: "orange",
        metadata: {
          workRequestId,
          emailPurpose: "tradepartner_request_notification",
          emailTemplate: {
            kind: "tradepartner_profile_request",
            ownerUserId,
            workRequestId,
            recipientEmail,
            businessName,
            requesterDisplayName,
            requestSummary,
            stoneName,
          },
        },
        deliveryMethods,
      })
      .returning();
    const deliveryIntents = await tx
      .insert(notificationDeliveryLog)
      .values(
        deliveryMethods.map((deliveryMethod) => ({
          notificationId: notification.id,
          userId: ownerUserId,
          deliveryMethod,
          status: deliveryMethod === "in_app" ? "delivered" : "pending",
          retryCount: 0,
          nextRetryAt: deliveryMethod === "in_app" ? null : now,
          deliveredAt: deliveryMethod === "in_app" ? now : null,
          createdAt: now,
          updatedAt: now,
        }))
      )
      .returning();
    const delivery =
      deliveryIntents.find((intent: any) => intent.deliveryMethod === "email") || null;
    if (recipientEmail && !delivery) {
      throw new Error("TradePartner request email intent was not persisted.");
    }

    return {
      notification,
      delivery: this.serializeDirectConnectRequestEmailDelivery(delivery),
    };
  }

  private serializeDirectConnectRequestEmailDelivery(delivery: any) {
    return delivery
      ? {
          id: String(delivery.id),
          status: String(delivery.status),
          externalId: delivery.externalId || null,
          errorCode: delivery.errorCode || null,
          errorMessage: delivery.errorMessage || null,
          retryCount: Number(delivery.retryCount || 0),
          nextRetryAt: delivery.nextRetryAt || null,
        }
      : null;
  }

  async dispatchDirectConnectRequestEmail(
    notificationId: string
  ): Promise<DirectConnectRequestEmailResult> {
    return this.dispatchDirectConnectEmail(notificationId);
  }

  async dispatchDirectConnectEmail(notificationId: string): Promise<DirectConnectEmailResult> {
    await this.sendNotification(notificationId);
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);
    if (!notification) {
      throw new Error("Direct Connect email notification was not found.");
    }
    const [delivery] = await db
      .select()
      .from(notificationDeliveryLog)
      .where(
        and(
          eq(notificationDeliveryLog.notificationId, notificationId),
          eq(notificationDeliveryLog.deliveryMethod, "email")
        )
      )
      .orderBy(desc(notificationDeliveryLog.createdAt), desc(notificationDeliveryLog.id))
      .limit(1);

    return {
      notification,
      delivery: this.serializeDirectConnectRequestEmailDelivery(delivery),
    };
  }

  async getUserNotifications(
    userId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: string;
    } = {}
  ): Promise<Notification[]> {
    const conditions = [eq(notifications.userId, userId)];

    if (options.unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    if (options.type) {
      conditions.push(eq(notifications.type, options.type as any));
    }

    const baseQuery = db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));

    const withLimit = options.limit ? baseQuery.limit(options.limit) : baseQuery;
    const finalQuery = options.offset ? withLimit.offset(options.offset) : withLimit;

    return await finalQuery;
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return result[0]?.count || 0;
  }

  async archiveNotification(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  }

  // =====================================
  // NOTIFICATION PREFERENCES
  // =====================================

  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));

    return preferences || null;
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<InsertNotificationPreferences>
  ): Promise<NotificationPreferences> {
    // Check if preferences exist
    const existing = await this.getUserPreferences(userId);

    if (existing) {
      const updateData: any = { ...preferences, updatedAt: new Date() };
      const [updated] = await db
        .update(notificationPreferences)
        .set(updateData)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return updated;
    } else {
      // Create new preferences
      const [created] = await db
        .insert(notificationPreferences)
        .values({ userId, ...preferences } as any)
        .returning();
      return created;
    }
  }

  async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const preferencesData: any = {
      userId,
      enableNotifications: true,
      enableEmailNotifications: true,
      enableSmsNotifications: false,
      enablePushNotifications: true,
      typePreferences: {
        birthday: { enabled: true, delivery_methods: ["in_app", "email"] },
        anniversary: { enabled: true, delivery_methods: ["in_app"] },
        new_message: { enabled: true, delivery_methods: ["in_app", "email"] },
        new_inquiry: { enabled: true, delivery_methods: ["in_app", "email"] },
        review_received: { enabled: true, delivery_methods: ["in_app"] },
        system_update: { enabled: true, delivery_methods: ["in_app"] },
        promotional: { enabled: true, delivery_methods: ["in_app", "push"] },
      },
    };

    const [created] = await db
      .insert(notificationPreferences)
      .values(preferencesData as any)
      .returning();

    return created;
  }

  // =====================================
  // PERSONAL EVENTS (BIRTHDAYS, ANNIVERSARIES)
  // =====================================

  async addPersonalEvent(event: InsertUserPersonalEvent): Promise<UserPersonalEvent> {
    const eventData: any = {
      ...event,
      notifyDaysBefore: event.notifyDaysBefore || [0, 1, 7],
    };

    const [created] = await db.insert(userPersonalEvents).values([eventData]).returning();
    return created;
  }

  async getUserPersonalEvents(userId: string): Promise<UserPersonalEvent[]> {
    return await db
      .select()
      .from(userPersonalEvents)
      .where(eq(userPersonalEvents.userId, userId))
      .orderBy(asc(userPersonalEvents.eventDate));
  }

  async updatePersonalEvent(
    eventId: string,
    userId: string,
    updates: Partial<InsertUserPersonalEvent>
  ): Promise<UserPersonalEvent | null> {
    const updateData: any = { ...updates, updatedAt: new Date() };
    const [updated] = await db
      .update(userPersonalEvents)
      .set(updateData)
      .where(and(eq(userPersonalEvents.id, eventId), eq(userPersonalEvents.userId, userId)))
      .returning();

    return updated || null;
  }

  async deletePersonalEvent(eventId: string, userId: string): Promise<void> {
    await db
      .delete(userPersonalEvents)
      .where(and(eq(userPersonalEvents.id, eventId), eq(userPersonalEvents.userId, userId)));
  }

  // =====================================
  // BIRTHDAY AND ANNIVERSARY PROCESSING
  // =====================================

  async processBirthdayNotifications(): Promise<void> {
    const today = new Date();
    const todayString =
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0"); // MM-DD format

    // Find all birthday events for today
    const birthdayEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(
        and(
          eq(userPersonalEvents.eventType, "birthday"),
          eq(userPersonalEvents.eventDate, todayString),
          eq(userPersonalEvents.enableNotifications, true)
        )
      );

    for (const { user_personal_events: event, users: user } of birthdayEvents) {
      // Calculate age if birth year is provided
      let age: number | null = null;
      if (event.eventYear) {
        age = today.getFullYear() - event.eventYear;
      }

      // Create birthday notification
      await this.createNotification({
        userId: user.id,
        type: "birthday",
        priority: "normal",
        title: age ? `Happy ${age}th Birthday!` : "Happy Birthday!",
        message:
          event.customMessage ||
          `${user.firstName ? `Happy birthday, ${user.firstName}` : "Happy birthday"}! 🎉 Wishing you a wonderful day filled with joy and celebration.`,
        iconName: "gift",
        iconColor: "pink",
        deliveryMethods: ["in_app", "email"] as string[],
        metadata: {
          age: age,
          eventType: "birthday",
          celebrationYear: today.getFullYear(),
        } as any,
      });
    }

    // Process anniversary notifications similarly
    await this.processAnniversaryNotifications(todayString);
  }

  async processAnniversaryNotifications(todayString?: string): Promise<void> {
    if (!todayString) {
      const today = new Date();
      todayString =
        String(today.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(today.getDate()).padStart(2, "0");
    }

    const anniversaryEvents = await db
      .select()
      .from(userPersonalEvents)
      .innerJoin(users, eq(userPersonalEvents.userId, users.id))
      .where(
        and(
          or(
            eq(userPersonalEvents.eventType, "work_anniversary"),
            eq(userPersonalEvents.eventType, "business_anniversary")
          ),
          eq(userPersonalEvents.eventDate, todayString),
          eq(userPersonalEvents.enableNotifications, true)
        )
      );

    for (const { user_personal_events: event, users: user } of anniversaryEvents) {
      let years: number | null = null;
      if (event.eventYear) {
        years = new Date().getFullYear() - event.eventYear;
      }

      const anniversaryType = event.eventType === "work_anniversary" ? "work" : "business";

      await this.createNotification({
        userId: user.id,
        type: "anniversary",
        priority: "normal",
        title: years
          ? `${years} Year ${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!`
          : `${anniversaryType.charAt(0).toUpperCase() + anniversaryType.slice(1)} Anniversary!`,
        message:
          event.customMessage ||
          `Congratulations on your ${years ? `${years} year ` : ""}${anniversaryType} anniversary! 🎊`,
        iconName: "award",
        iconColor: "gold",
        deliveryMethods: ["in_app", "email"] as string[],
        metadata: {
          years: years,
          eventType: event.eventType,
          anniversaryYear: new Date().getFullYear(),
        } as any,
      });
    }
  }

  // =====================================
  // NOTIFICATION DELIVERY
  // =====================================

  protected async loadNotificationDeliveryContext(notificationId: string) {
    const [notificationData] = await db
      .select()
      .from(notifications)
      .innerJoin(users, eq(notifications.userId, users.id))
      .leftJoin(notificationPreferences, eq(notifications.userId, notificationPreferences.userId))
      .where(eq(notifications.id, notificationId));

    return notificationData || null;
  }

  private async getOrCreateDeliveryIntent(
    notification: Notification,
    method: NotificationDeliveryMethod
  ): Promise<any> {
    return db.transaction(async (tx: any) => {
      const intentLockKey = `notification-delivery-intent:${notification.id}:${method}`;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${intentLockKey}, 0))`);
      const [existing] = await tx
        .select()
        .from(notificationDeliveryLog)
        .where(
          and(
            eq(notificationDeliveryLog.notificationId, notification.id),
            eq(notificationDeliveryLog.deliveryMethod, method)
          )
        )
        .orderBy(desc(notificationDeliveryLog.createdAt), desc(notificationDeliveryLog.id))
        .limit(1);

      if (existing) return existing;

      const now = new Date();
      const [created] = await tx
        .insert(notificationDeliveryLog)
        .values({
          notificationId: notification.id,
          userId: notification.userId,
          deliveryMethod: method,
          status: method === "in_app" ? "delivered" : "pending",
          retryCount: 0,
          nextRetryAt: method === "in_app" ? null : notification.scheduledFor || now,
          deliveredAt: method === "in_app" ? now : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return created;
    });
  }

  private async suppressDeliveryIntent(input: {
    notification: Notification;
    method: NotificationDeliveryMethod;
    errorCode: string;
    errorMessage: string;
    contactInfo?: string | null;
  }): Promise<void> {
    const intent = await this.getOrCreateDeliveryIntent(input.notification, input.method);
    if (isNotificationDeliveryTerminalStatus(intent.status)) return;
    const now = new Date();
    await db
      .update(notificationDeliveryLog)
      .set({
        status: "suppressed",
        contactInfo: input.contactInfo || null,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
        nextRetryAt: null,
        failedAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDeliveryLog.id, intent.id),
          inArray(notificationDeliveryLog.status, ["pending", "processing", "retry_scheduled"])
        )
      );
  }

  private async processImmediateDeliveryMethod(input: {
    notification: Notification;
    user: User;
    method: Exclude<NotificationDeliveryMethod, "email" | "in_app">;
  }): Promise<void> {
    const intent = await this.getOrCreateDeliveryIntent(input.notification, input.method);
    if (isNotificationDeliveryTerminalStatus(intent.status)) return;

    const now = new Date();
    const [claimed] = await db
      .update(notificationDeliveryLog)
      .set({
        status: "processing",
        retryCount: sql`COALESCE(${notificationDeliveryLog.retryCount}, 0) + 1`,
        nextRetryAt: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationDeliveryLog.id, intent.id),
          inArray(notificationDeliveryLog.status, ["pending", "retry_scheduled"])
        )
      )
      .returning();
    if (!claimed) return;

    try {
      let externalResponse: Record<string, unknown> | null = null;
      if (input.method === "sms") {
        await this.sendSMSNotification(input.notification, input.user);
      } else if (input.method === "push") {
        externalResponse = await this.sendPushNotification(input.notification, input.user.id);
      } else {
        throw new NotificationDeliveryAttemptError(
          "suppressed",
          "WEBHOOK_PROVIDER_NOT_CONFIGURED",
          "Webhook delivery is not configured."
        );
      }

      await db
        .update(notificationDeliveryLog)
        .set({
          status: "sent",
          contactInfo:
            input.method === "sms" ? input.user.phone || null : claimed.contactInfo || null,
          sentAt: new Date(),
          failedAt: null,
          errorCode: null,
          errorMessage: null,
          externalResponse,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveryLog.id, claimed.id));
    } catch (error) {
      const failure = resolveNotificationDeliveryFailure(error, input.method);
      await db
        .update(notificationDeliveryLog)
        .set({
          status: failure.status,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          nextRetryAt: null,
          failedAt: failure.status === "failed" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveryLog.id, claimed.id));
    }
  }

  async sendNotification(notificationId: string): Promise<void> {
    const notificationData = await this.loadNotificationDeliveryContext(notificationId);
    if (!notificationData) throw new Error("Notification not found");

    const {
      notifications: notification,
      users: user,
      notification_preferences: preferences,
    } = notificationData;
    const requestedDeliveryMethods = normalizeDeliveryMethods(notification.deliveryMethods);
    const typePrefs = (preferences?.typePreferences || {}) as Record<
      string,
      { enabled?: boolean; delivery_methods?: string[] }
    >;
    const currentTypePrefs = typePrefs[notification.type as string];
    const emailPurpose = resolveNotificationEmailPurpose(notification.metadata);
    const isOperationalDirectConnectEmail = isOperationalDirectConnectEmailPurpose(emailPurpose);
    const recipientEmail = resolveNotificationEmailRecipient(notification, user);
    const typeDeliveryMethods =
      !isOperationalDirectConnectEmail && Array.isArray(currentTypePrefs?.delivery_methods)
        ? normalizeDeliveryMethods(currentTypePrefs.delivery_methods)
        : null;
    const emailSuppression = resolveRequestedEmailSuppression({
      requestedDeliveryMethods,
      typeDeliveryMethods,
      globalNotificationsEnabled:
        isOperationalDirectConnectEmail || preferences?.enableNotifications !== false,
      typeNotificationsEnabled:
        isOperationalDirectConnectEmail || currentTypePrefs?.enabled !== false,
      emailNotificationsEnabled:
        isOperationalDirectConnectEmail || preferences?.enableEmailNotifications !== false,
      recipientEmail,
      notificationType: String(notification.type),
    });

    if (emailSuppression) {
      await this.suppressDeliveryIntent({
        notification,
        method: "email",
        contactInfo: recipientEmail || undefined,
        errorCode: emailSuppression.errorCode,
        errorMessage: emailSuppression.errorMessage,
      });
    }

    const deliveryMethods = typeDeliveryMethods || requestedDeliveryMethods;
    if (typeDeliveryMethods) {
      await Promise.all(
        requestedDeliveryMethods
          .filter(
            (method) =>
              method !== "in_app" && method !== "email" && !deliveryMethods.includes(method)
          )
          .map((method) =>
            this.suppressDeliveryIntent({
              notification,
              method,
              errorCode: "NOTIFICATION_TYPE_DELIVERY_METHOD_DISABLED",
              errorMessage: `${method} suppressed because the recipient's notification-type preference excludes it.`,
            })
          )
      );
    }

    // Preserve global and per-type suppression for every external method after
    // recording why a requested email was not attempted. The in-app record was
    // persisted atomically with the notification and remains immediately visible.
    if (
      !isOperationalDirectConnectEmail &&
      (preferences?.enableNotifications === false || currentTypePrefs?.enabled === false)
    ) {
      await Promise.all(
        deliveryMethods
          .filter((method) => method !== "in_app" && method !== "email")
          .map((method) =>
            this.suppressDeliveryIntent({
              notification,
              method,
              errorCode:
                preferences?.enableNotifications === false
                  ? "GLOBAL_NOTIFICATIONS_DISABLED"
                  : "NOTIFICATION_TYPE_DISABLED",
              errorMessage:
                preferences?.enableNotifications === false
                  ? "Delivery suppressed because the recipient disabled all notifications."
                  : `Delivery suppressed because the recipient disabled ${String(notification.type)} notifications.`,
            })
          )
      );
      try {
        await db
          .update(notifications)
          .set({ sentAt: new Date() })
          .where(eq(notifications.id, notificationId));
      } catch (error) {
        console.error("[notifications] Failed to mark suppressed notification attempted", {
          notificationId,
          error,
        });
      }
      return;
    }

    for (const method of deliveryMethods) {
      try {
        switch (method) {
          case "email":
            if (!emailSuppression) {
              await this.getOrCreateDeliveryIntent(notification, "email");
              await this.processDueEmailDeliveries({
                notificationId,
                batchSize: 1,
              });
            }
            break;
          case "sms":
            if (preferences?.enableSmsNotifications && user.phone) {
              await this.processImmediateDeliveryMethod({ notification, user, method: "sms" });
            } else {
              await this.suppressDeliveryIntent({
                notification,
                method: "sms",
                contactInfo: user.phone,
                errorCode: user.phone ? "SMS_NOTIFICATIONS_DISABLED" : "RECIPIENT_PHONE_MISSING",
                errorMessage: user.phone
                  ? "SMS suppressed because the recipient disabled SMS notifications."
                  : "SMS suppressed because the recipient has no phone number.",
              });
            }
            break;
          case "in_app":
            await this.getOrCreateDeliveryIntent(notification, "in_app");
            break;
          case "push":
            if (preferences?.enablePushNotifications && this.webPushConfigured) {
              await this.processImmediateDeliveryMethod({ notification, user, method: "push" });
            } else {
              await this.suppressDeliveryIntent({
                notification,
                method: "push",
                errorCode: this.webPushConfigured
                  ? "PUSH_NOTIFICATIONS_DISABLED"
                  : "PUSH_PROVIDER_NOT_CONFIGURED",
                errorMessage: this.webPushConfigured
                  ? "Push suppressed because the recipient disabled push notifications."
                  : "Push delivery is not configured.",
              });
            }
            break;
          case "webhook":
            await this.processImmediateDeliveryMethod({ notification, user, method: "webhook" });
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${method} notification:`, error);
      }
    }

    // Marking the aggregate notification is evidence, not delivery itself.
    // A write failure here must not report an already-attempted email as an
    // overall send failure and invite duplicate retries.
    try {
      await db
        .update(notifications)
        .set({ sentAt: new Date() })
        .where(eq(notifications.id, notificationId));
    } catch (error) {
      console.error("[notifications] Failed to mark notification sent", {
        notificationId,
        error,
      });
    }
  }

  private resolveEmailDeliveryProcessorOptions(
    options: NotificationEmailDeliveryProcessorOptions
  ): Required<
    Pick<
      NotificationEmailDeliveryProcessorOptions,
      | "batchSize"
      | "concurrency"
      | "now"
      | "maxAttempts"
      | "leaseMs"
      | "providerTimeoutMs"
      | "baseRetryMs"
      | "maxRetryMs"
    >
  > &
    Pick<NotificationEmailDeliveryProcessorOptions, "notificationId"> {
    const leaseMs = readBoundedInteger(
      options.leaseMs,
      this.emailDeliveryDefaults.leaseMs,
      1_000,
      15 * 60 * 1000
    );
    return {
      batchSize: readBoundedInteger(options.batchSize, DEFAULT_EMAIL_DELIVERY_BATCH_SIZE, 1, 100),
      concurrency: readBoundedInteger(
        options.concurrency,
        DEFAULT_EMAIL_DELIVERY_CONCURRENCY,
        1,
        10
      ),
      notificationId: options.notificationId,
      now: options.now || new Date(),
      maxAttempts: readBoundedInteger(
        options.maxAttempts,
        this.emailDeliveryDefaults.maxAttempts,
        1,
        12
      ),
      leaseMs,
      providerTimeoutMs: resolveNotificationEmailProviderTimeoutMs(
        leaseMs,
        readBoundedInteger(
          options.providerTimeoutMs,
          this.emailDeliveryDefaults.providerTimeoutMs,
          250,
          2 * 60 * 1000
        )
      ),
      baseRetryMs: readBoundedInteger(
        options.baseRetryMs,
        this.emailDeliveryDefaults.baseRetryMs,
        1,
        60 * 60 * 1000
      ),
      maxRetryMs: readBoundedInteger(
        options.maxRetryMs,
        this.emailDeliveryDefaults.maxRetryMs,
        1,
        24 * 60 * 60 * 1000
      ),
    };
  }

  private async resolveStaleEmailDeliveryClaims(input: {
    staleBefore: Date;
    now: Date;
    notificationId?: string;
  }): Promise<{ deliveryUnknown: number; requeuedBeforeProvider: number }> {
    const unknownResult = await pool.query(
      `UPDATE notification_delivery_log
       SET status = 'delivery_unknown',
           claim_token = NULL,
           next_retry_at = NULL,
           failed_at = NULL,
           error_code = 'EMAIL_DELIVERY_OUTCOME_UNKNOWN',
           error_message =
             'The delivery claim expired before a durable provider outcome was recorded. Automatic retries stopped to avoid a possible duplicate email.',
           external_response = COALESCE(external_response, '{}'::jsonb)
             || jsonb_build_object(
               'terminal', true,
               'terminalReason', 'ambiguous_processing_lease',
               'outcomeKnown', false
             ),
           updated_at = $2
       WHERE delivery_method = 'email'
         AND status = 'processing'
         AND updated_at <= $1
         AND external_response ? 'providerAttemptStartedAt'
         AND ($3::text IS NULL OR notification_id = $3)`,
      [input.staleBefore, input.now, input.notificationId || null]
    );
    const requeueResult = await pool.query(
      `UPDATE notification_delivery_log
       SET status = 'retry_scheduled',
           claim_token = NULL,
           retry_count = GREATEST(COALESCE(retry_count, 0) - 1, 0),
           next_retry_at = $2,
           failed_at = NULL,
           error_code = 'EMAIL_DELIVERY_PRE_PROVIDER_LEASE_EXPIRED',
           error_message =
             'The delivery claim expired before a provider request began. It is safe to retry automatically.',
           external_response = COALESCE(external_response, '{}'::jsonb)
             || jsonb_build_object(
               'terminal', false,
               'terminalReason', 'pre_provider_lease_expired',
               'providerAttempted', false
             ),
           updated_at = $2
       WHERE delivery_method = 'email'
         AND status = 'processing'
         AND updated_at <= $1
         AND NOT (COALESCE(external_response, '{}'::jsonb) ? 'providerAttemptStartedAt')
         AND ($3::text IS NULL OR notification_id = $3)`,
      [input.staleBefore, input.now, input.notificationId || null]
    );
    return {
      deliveryUnknown: unknownResult.rowCount || 0,
      requeuedBeforeProvider: requeueResult.rowCount || 0,
    };
  }

  private async claimDueEmailDeliveries(input: {
    now: Date;
    maxAttempts: number;
    batchSize: number;
    notificationId?: string;
  }): Promise<ClaimedEmailDelivery[]> {
    const result = await pool.query<ClaimedEmailDelivery>(
      `WITH due AS (
         SELECT ndl.id
         FROM notification_delivery_log ndl
         INNER JOIN notifications n ON n.id = ndl.notification_id
         WHERE ndl.delivery_method = 'email'
           AND COALESCE(ndl.retry_count, 0) < $2
           AND (
             (
               ndl.status IN ('pending', 'retry_scheduled')
               AND COALESCE(ndl.next_retry_at, ndl.created_at) <= $1
             )
           )
           AND (n.scheduled_for IS NULL OR n.scheduled_for <= $1)
           AND ($4::text IS NULL OR ndl.notification_id = $4)
         ORDER BY COALESCE(ndl.next_retry_at, ndl.created_at) ASC, ndl.created_at ASC
         FOR UPDATE OF ndl SKIP LOCKED
         LIMIT $3
       )
       UPDATE notification_delivery_log ndl
       SET status = 'processing',
           claim_token = gen_random_uuid()::text,
           retry_count = COALESCE(ndl.retry_count, 0) + 1,
           next_retry_at = NULL,
           external_response = (
             COALESCE(ndl.external_response, '{}'::jsonb)
               - 'providerAttemptStartedAt'
               - 'providerRequestTimeoutMs'
           )
             || jsonb_build_object(
               'deliveryIntentId', ndl.id,
               'lastClaimedAt', $1
             ),
           updated_at = $1
       FROM due
       WHERE ndl.id = due.id
       RETURNING
         ndl.id,
         ndl.notification_id AS "notificationId",
         ndl.user_id AS "userId",
         COALESCE(ndl.retry_count, 0)::int AS "retryCount",
         ndl.claim_token AS "claimToken"`,
      [input.now, input.maxAttempts, input.batchSize, input.notificationId || null]
    );
    return result.rows;
  }

  protected async persistAcceptedEmailDelivery(input: {
    delivery: ClaimedEmailDelivery;
    recipientEmail: string | null;
    result: SendEmailResult;
    completedAt: Date;
  }): Promise<void> {
    const updated = await db
      .update(notificationDeliveryLog)
      .set({
        status: "sent",
        contactInfo: input.recipientEmail,
        externalId: input.result.messageId || null,
        externalResponse: {
          deliveryIntentId: input.delivery.id,
          provider: input.result.provider,
          providerStatus: "accepted",
          attempts: input.delivery.retryCount,
          terminal: true,
        },
        errorCode: null,
        errorMessage: null,
        nextRetryAt: null,
        claimToken: null,
        sentAt: input.completedAt,
        failedAt: null,
        updatedAt: input.completedAt,
      })
      .where(
        and(
          eq(notificationDeliveryLog.id, input.delivery.id),
          eq(notificationDeliveryLog.status, "processing"),
          eq(notificationDeliveryLog.claimToken, input.delivery.claimToken)
        )
      )
      .returning({ id: notificationDeliveryLog.id });
    if (updated.length !== 1) {
      throw new Error("Provider acceptance evidence did not update its claimed delivery row.");
    }
  }

  private async completeEmailDelivery(
    delivery: ClaimedEmailDelivery,
    options: ReturnType<NotificationService["resolveEmailDeliveryProcessorOptions"]>
  ): Promise<"sent" | "retry_scheduled" | "terminal" | "ownership_lost"> {
    const notificationData = await this.loadNotificationDeliveryContext(delivery.notificationId);
    if (!notificationData) {
      // The FK normally cascades this row with its notification. If legacy
      // schema drift leaves an orphan, terminalize it rather than spin forever.
      const terminalized = await db
        .update(notificationDeliveryLog)
        .set({
          status: "failed",
          claimToken: null,
          errorCode: "NOTIFICATION_NOT_FOUND",
          errorMessage: "The notification record no longer exists.",
          nextRetryAt: null,
          failedAt: options.now,
          updatedAt: options.now,
        })
        .where(
          and(
            eq(notificationDeliveryLog.id, delivery.id),
            eq(notificationDeliveryLog.status, "processing"),
            eq(notificationDeliveryLog.claimToken, delivery.claimToken)
          )
        )
        .returning({ id: notificationDeliveryLog.id });
      return terminalized.length === 1 ? "terminal" : "ownership_lost";
    }

    const {
      notifications: notification,
      users: user,
      notification_preferences: preferences,
    } = notificationData;
    const requestedDeliveryMethods = normalizeDeliveryMethods(notification.deliveryMethods);
    const typePrefs = (preferences?.typePreferences || {}) as Record<
      string,
      { enabled?: boolean; delivery_methods?: string[] }
    >;
    const currentTypePrefs = typePrefs[notification.type as string];
    const typeDeliveryMethods = Array.isArray(currentTypePrefs?.delivery_methods)
      ? normalizeDeliveryMethods(currentTypePrefs.delivery_methods)
      : null;
    const emailPurpose = resolveNotificationEmailPurpose(notification.metadata);
    const isOperationalDirectConnectEmail = isOperationalDirectConnectEmailPurpose(emailPurpose);
    const recipientEmail = resolveNotificationEmailRecipient(notification, user);
    const suppression = resolveRequestedEmailSuppression({
      requestedDeliveryMethods,
      typeDeliveryMethods: isOperationalDirectConnectEmail ? null : typeDeliveryMethods,
      globalNotificationsEnabled:
        isOperationalDirectConnectEmail || preferences?.enableNotifications !== false,
      typeNotificationsEnabled:
        isOperationalDirectConnectEmail || currentTypePrefs?.enabled !== false,
      emailNotificationsEnabled:
        isOperationalDirectConnectEmail || preferences?.enableEmailNotifications !== false,
      recipientEmail,
      notificationType: String(notification.type),
    });

    if (suppression) {
      const suppressed = await db
        .update(notificationDeliveryLog)
        .set({
          status: "suppressed",
          claimToken: null,
          contactInfo: recipientEmail,
          errorCode: suppression.errorCode,
          errorMessage: suppression.errorMessage,
          nextRetryAt: null,
          failedAt: null,
          externalResponse: {
            deliveryIntentId: delivery.id,
            terminal: true,
            terminalReason: "suppressed",
            attempts: delivery.retryCount,
          },
          updatedAt: options.now,
        })
        .where(
          and(
            eq(notificationDeliveryLog.id, delivery.id),
            eq(notificationDeliveryLog.status, "processing"),
            eq(notificationDeliveryLog.claimToken, delivery.claimToken)
          )
        )
        .returning({ id: notificationDeliveryLog.id });
      return suppressed.length === 1 ? "terminal" : "ownership_lost";
    }

    try {
      // Rendering and setup-credential issuance are pre-provider work. If they
      // fail or the worker exits here, stale recovery can safely requeue.
      const prepared = await this.prepareEmailNotification(
        notification,
        user,
        recipientEmail,
        delivery.id
      );

      // Mark the provider-attempt boundary only after the complete request is
      // prepared, then call the provider immediately. The ownership predicate
      // prevents an expired worker from crossing this boundary after reclaim.
      const providerAttemptStartedAt = new Date();
      const providerAttemptClaim = await pool.query<{ id: string }>(
        `UPDATE notification_delivery_log
         SET external_response = COALESCE(external_response, '{}'::jsonb)
               || jsonb_build_object(
                 'providerAttemptStartedAt', $2::timestamptz,
                 'providerRequestTimeoutMs', $3::int
               ),
             updated_at = $2
         WHERE id = $1
           AND status = 'processing'
           AND claim_token = $4
         RETURNING id`,
        [delivery.id, providerAttemptStartedAt, options.providerTimeoutMs, delivery.claimToken]
      );
      if (providerAttemptClaim.rowCount !== 1) {
        console.warn(
          "[notifications] Email provider attempt skipped because its claim is no longer active",
          {
            deliveryIntentId: delivery.id,
            notificationId: delivery.notificationId,
          }
        );
        return "ownership_lost";
      }

      const result = await this.sendEmailNotification(
        prepared,
        delivery.id,
        options.providerTimeoutMs
      );
      const completedAt = new Date();
      try {
        await this.persistAcceptedEmailDelivery({
          delivery,
          recipientEmail,
          result,
          completedAt,
        });
        return "sent";
      } catch (evidenceError) {
        // The provider explicitly accepted the request. A subsequent evidence
        // write failure is not a provider failure and must never enter the
        // automatic retry path.
        console.error("[notifications] Provider acceptance evidence write failed", {
          deliveryIntentId: delivery.id,
          notificationId: delivery.notificationId,
          provider: result.provider,
          providerMessageId: result.messageId || null,
          error: evidenceError,
        });
        try {
          const fallbackResult = await pool.query(
            `UPDATE notification_delivery_log
             SET status = 'accepted_unreconciled',
                 claim_token = NULL,
                 contact_info = $2,
                 external_id = $3,
                 external_response = jsonb_build_object(
                   'deliveryIntentId', $1::text,
                   'provider', $4::text,
                   'providerStatus', 'accepted',
                   'attempts', $5::int,
                   'terminal', true,
                   'terminalReason', 'provider_accepted_evidence_write_failed'
                 ),
                 error_code = 'EMAIL_ACCEPTANCE_EVIDENCE_UNRECONCILED',
                 error_message =
                   'The provider accepted this email, but the normal acceptance evidence write failed. Automatic retries stopped.',
                 next_retry_at = NULL,
                 sent_at = COALESCE(sent_at, $6),
                 failed_at = NULL,
                 updated_at = $6
             WHERE id = $1
               AND status = 'processing'
               AND claim_token = $7`,
            [
              delivery.id,
              recipientEmail,
              result.messageId || null,
              result.provider,
              delivery.retryCount,
              completedAt,
              delivery.claimToken,
            ]
          );
          if (fallbackResult.rowCount !== 1) {
            console.warn(
              "[notifications] Acceptance evidence fallback skipped because claim ownership was lost",
              {
                deliveryIntentId: delivery.id,
                notificationId: delivery.notificationId,
              }
            );
            return "ownership_lost";
          }
        } catch (fallbackError) {
          // If the database remains unavailable, the processing lease later
          // becomes delivery_unknown. Stale processing rows are never reclaimed
          // automatically because their provider outcome is ambiguous.
          console.error("[notifications] Acceptance evidence fallback write failed", {
            deliveryIntentId: delivery.id,
            notificationId: delivery.notificationId,
            provider: result.provider,
            providerMessageId: result.messageId || null,
            error: fallbackError,
          });
        }
        return "terminal";
      }
    } catch (error) {
      const failure = classifyNotificationEmailFailure(error);
      const attemptsExhausted = delivery.retryCount >= options.maxAttempts;
      const retryable = failure.retryable && !attemptsExhausted;
      const failedAt = new Date();

      if (retryable) {
        const retryDelayMs = calculateNotificationEmailRetryDelayMs(
          delivery.retryCount,
          options.baseRetryMs,
          options.maxRetryMs
        );
        const nextRetryAt = new Date(failedAt.getTime() + retryDelayMs);
        const retryScheduled = await db
          .update(notificationDeliveryLog)
          .set({
            status: "retry_scheduled",
            claimToken: null,
            contactInfo: recipientEmail,
            errorCode: failure.errorCode,
            errorMessage: failure.errorMessage,
            nextRetryAt,
            failedAt: null,
            externalResponse: {
              deliveryIntentId: delivery.id,
              lastFailureStatusCode: failure.statusCode,
              retryable: true,
              attempts: delivery.retryCount,
              nextRetryAt: nextRetryAt.toISOString(),
              terminal: false,
            },
            updatedAt: failedAt,
          })
          .where(
            and(
              eq(notificationDeliveryLog.id, delivery.id),
              eq(notificationDeliveryLog.status, "processing"),
              eq(notificationDeliveryLog.claimToken, delivery.claimToken)
            )
          )
          .returning({ id: notificationDeliveryLog.id });
        return retryScheduled.length === 1 ? "retry_scheduled" : "ownership_lost";
      }

      const terminalized = await db
        .update(notificationDeliveryLog)
        .set({
          status: attemptsExhausted && failure.retryable ? "exhausted" : failure.status,
          claimToken: null,
          contactInfo: recipientEmail,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          nextRetryAt: null,
          failedAt: failure.status === "suppressed" ? null : failedAt,
          externalResponse: {
            deliveryIntentId: delivery.id,
            lastFailureStatusCode: failure.statusCode,
            retryable: failure.retryable,
            attempts: delivery.retryCount,
            maxAttempts: options.maxAttempts,
            terminal: true,
            terminalReason:
              attemptsExhausted && failure.retryable
                ? "attempt_budget_exhausted"
                : "permanent_failure",
          },
          updatedAt: failedAt,
        })
        .where(
          and(
            eq(notificationDeliveryLog.id, delivery.id),
            eq(notificationDeliveryLog.status, "processing"),
            eq(notificationDeliveryLog.claimToken, delivery.claimToken)
          )
        )
        .returning({ id: notificationDeliveryLog.id });
      return terminalized.length === 1 ? "terminal" : "ownership_lost";
    }
  }

  async processDueEmailDeliveries(
    requestedOptions: NotificationEmailDeliveryProcessorOptions = {}
  ): Promise<NotificationEmailDeliveryProcessorResult> {
    const options = this.resolveEmailDeliveryProcessorOptions(requestedOptions);
    const staleBefore = new Date(options.now.getTime() - options.leaseMs);
    const staleResolution = await this.resolveStaleEmailDeliveryClaims({
      staleBefore,
      now: options.now,
      notificationId: options.notificationId,
    });
    const result: NotificationEmailDeliveryProcessorResult = {
      claimed: 0,
      sent: 0,
      retryScheduled: 0,
      terminal: staleResolution.deliveryUnknown,
      requeuedBeforeProvider: staleResolution.requeuedBeforeProvider,
    };

    let remainingBatchCapacity = options.batchSize;
    while (remainingBatchCapacity > 0) {
      const claimWaveSize = Math.min(options.concurrency, remainingBatchCapacity);
      const deliveries = await this.claimDueEmailDeliveries({
        now: requestedOptions.now || new Date(),
        maxAttempts: options.maxAttempts,
        batchSize: claimWaveSize,
        notificationId: options.notificationId,
      });
      if (deliveries.length === 0) break;
      result.claimed += deliveries.length;
      remainingBatchCapacity -= deliveries.length;

      // Claim only one bounded wave at a time, then begin every row in that
      // wave concurrently. No claimed row waits behind an entire provider
      // batch long enough for its lease to expire before attempt marking.
      await Promise.all(
        deliveries.map(async (delivery) => {
          try {
            const outcome = await this.completeEmailDelivery(delivery, options);
            if (outcome === "sent") result.sent += 1;
            else if (outcome === "retry_scheduled") result.retryScheduled += 1;
            else if (outcome === "terminal") result.terminal += 1;
          } catch (error) {
            // The durable provider-attempt marker determines safe recovery:
            // pre-provider claims requeue; started provider requests become
            // delivery_unknown and never resend automatically.
            console.error("[notifications] Email delivery intent processing failed", {
              deliveryIntentId: delivery.id,
              notificationId: delivery.notificationId,
              error,
            });
          }
        })
      );

      if (deliveries.length < claimWaveSize) break;
    }
    return result;
  }

  // =====================================
  // HYPER-LOCAL NEARBY CONTENT
  // =====================================

  /**
   * Notify geo-opted-in users when a marketplace listing goes live near them.
   *
   * Uses user.preferences.geo.homeLocation (lat/lng) and an optional
   * geo.notifyNearbyRadiusMeters (default ~0.5mi ≈ 800m).
   */
  async notifyNearbyUsersOfMarketplaceListing(listing: MarketplaceListing): Promise<void> {
    // Respect listing-level location privacy; only notify for exact-location listings
    const visibility: string | undefined = (listing as any).locationVisibility as any;
    if (visibility && visibility !== "exact") {
      return;
    }

    // Require coordinates on the listing
    const listingLatRaw: any = (listing as any).latitude;
    const listingLngRaw: any = (listing as any).longitude;

    const listingLat = listingLatRaw != null ? Number(listingLatRaw) : NaN;
    const listingLng = listingLngRaw != null ? Number(listingLngRaw) : NaN;

    if (!Number.isFinite(listingLat) || !Number.isFinite(listingLng)) {
      return;
    }

    // Fetch users who have geo preferences defined
    const usersWithGeo = await db
      .select()
      .from(users)
      .where(sql<boolean>`preferences ? 'geo'`);

    if (!usersWithGeo.length) {
      return;
    }

    const defaultRadiusMeters = 800; // ~0.5 miles

    for (const user of usersWithGeo) {
      const prefs: any = (user as any).preferences || {};
      const geo = prefs.geo;

      if (!geo || !geo.homeLocation) {
        continue;
      }

      if (geo.enableNearbyDeals === false) {
        continue;
      }

      const includeTypes: string[] =
        Array.isArray(geo.includeTypes) && geo.includeTypes.length
          ? geo.includeTypes
          : ["marketplace", "trade"];

      if (!includeTypes.includes("marketplace")) {
        continue;
      }

      const homeLat = Number(geo.homeLocation.lat);
      const homeLng = Number(geo.homeLocation.lng);

      if (!Number.isFinite(homeLat) || !Number.isFinite(homeLng)) {
        continue;
      }

      const radiusMeters: number =
        Number(geo.notifyNearbyRadiusMeters) > 0
          ? Number(geo.notifyNearbyRadiusMeters)
          : defaultRadiusMeters;

      const distanceMeters = this.haversineDistanceMeters(homeLat, homeLng, listingLat, listingLng);

      if (!Number.isFinite(distanceMeters) || distanceMeters > radiusMeters) {
        continue;
      }

      const price = (listing as any).price;
      const priceText =
        typeof price === "string" || typeof price === "number"
          ? `$${Number(price).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : "a new item";

      const distanceText =
        distanceMeters < 100
          ? "right by you"
          : `${(distanceMeters / 1609.34).toFixed(2)} miles away`;

      const actionUrl = listing.slug
        ? `/exchange?item=${encodeURIComponent(listing.slug)}`
        : `/exchange?item=${encodeURIComponent(listing.id)}`;

      await this.createNotification({
        userId: (user as any).id,
        type: "promotional",
        priority: "normal",
        title: "New Exchange listing near you",
        message: `${listing.title} just went live ${distanceText} for ${priceText}.`,
        iconName: "MapPin",
        iconColor: "orange",
        actionUrl,
        actionText: "View listing",
        deliveryMethods: ["in_app", "push"] as string[],
        metadata: {
          source: "marketplace",
          listingId: listing.id,
          radiusMeters,
          distanceMeters,
          city: listing.city,
          state: listing.state,
        } as any,
      });
    }
  }

  private async prepareEmailNotification(
    notification: Notification,
    user: User,
    recipientEmail: string | null,
    deliveryIntentId: string
  ): Promise<PreparedNotificationEmail> {
    if (!recipientEmail) {
      throw new NotificationDeliveryAttemptError(
        "suppressed",
        "RECIPIENT_EMAIL_MISSING",
        "Email suppressed because the recipient has no email address."
      );
    }
    if (!this.emailSender.isConfigured()) {
      throw new NotificationDeliveryAttemptError(
        "failed",
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email delivery failed because no email provider is configured."
      );
    }

    const purpose = resolveNotificationEmailPurpose(notification.metadata);
    const payload = await renderNotificationEmailPayloadForAttempt(
      notification,
      user,
      this.accountSetupCredentialIssuer,
      deliveryIntentId
    );
    return {
      recipientEmail,
      purpose,
      payload,
    };
  }

  private async sendEmailNotification(
    prepared: PreparedNotificationEmail,
    deliveryIntentId: string,
    requestTimeoutMs: number
  ): Promise<SendEmailResult> {
    const { recipientEmail, purpose, payload } = prepared;
    let result: SendEmailResult;
    try {
      result = await this.emailSender.sendEmail({
        to: recipientEmail,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        purpose,
        headers: {
          // The same durable ID is reused after stale-lease recovery. Providers
          // do not guarantee deduplication, but this keeps ambiguous acceptance
          // traceable and gives downstream logs a stable correlation key for
          // recognizing the repeated intent.
          "X-TradeScout-Delivery-Intent": deliveryIntentId,
        },
        requestTimeoutMs,
      });
    } catch (error) {
      if (
        purpose !== "direct_connect_account_setup" &&
        purpose !== "tradepartner_request_notification"
      ) {
        throw error;
      }

      // Provider failures can contain arbitrary response text. Preserve only
      // machine-safe classification fields so a provider echo can never write
      // an in-memory setup credential or URL into durable delivery evidence.
      const statusCode = extractDeliveryStatusCode(error);
      const code =
        error && typeof error === "object"
          ? String((error as { code?: unknown }).code || "")
              .replace(/[^a-zA-Z0-9_]+/g, "_")
              .slice(0, 100)
          : "";
      throw Object.assign(new Error("Operational Direct Connect email provider request failed."), {
        ...(statusCode ? { statusCode } : {}),
        ...(code ? { code } : {}),
      });
    }

    if (result.skipped) {
      if (result.skippedReason === "email_mode_suppressed") {
        throw new NotificationDeliveryAttemptError(
          "suppressed",
          "EMAIL_MODE_SUPPRESSED",
          `Email suppressed by EMAIL_MODE for purpose ${purpose}.`
        );
      }
      throw new NotificationDeliveryAttemptError(
        "failed",
        "EMAIL_PROVIDER_NOT_CONFIGURED",
        "Email delivery failed because no email provider is configured."
      );
    }

    return result;
  }

  private async sendSMSNotification(notification: Notification, user: User): Promise<void> {
    // SMS implementation would go here (Twilio, etc.)
    // For now, just log that SMS would be sent
    console.log(`SMS notification would be sent to ${user.phone}: ${notification.message}`);
    await this.logDelivery({
      notificationId: notification.id,
      userId: user.id,
      deliveryMethod: "sms",
      status: "sent",
      contactInfo: user.phone || undefined,
    });
  }

  private async sendPushNotification(
    notification: Notification,
    userId: string
  ): Promise<Record<string, unknown>> {
    if (!this.webPushConfigured) {
      throw new NotificationDeliveryAttemptError(
        "suppressed",
        "PUSH_PROVIDER_NOT_CONFIGURED",
        "Push delivery is not configured."
      );
    }

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (!subs.length) {
      throw new NotificationDeliveryAttemptError(
        "suppressed",
        "PUSH_SUBSCRIPTION_MISSING",
        "Push suppressed because the recipient has no active subscription."
      );
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      url: notification.actionUrl || undefined,
    });

    const results = await Promise.all(
      subs.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: sub.keys as any,
            },
            payload
          );
          await this.logDelivery({
            notificationId: notification.id,
            userId,
            deliveryMethod: "push",
            status: "sent",
            contactInfo: sub.endpoint,
          });
          return true;
        } catch (err: any) {
          console.error("Failed to send web push notification", err);
          const failure = resolveNotificationDeliveryFailure(err, "push");
          await this.logDelivery({
            notificationId: notification.id,
            userId,
            deliveryMethod: "push",
            status: failure.status,
            contactInfo: sub.endpoint,
            errorCode: failure.errorCode,
            errorMessage: failure.errorMessage,
          });

          const statusCode = err?.statusCode ?? err?.statusCode?.value;
          if (statusCode === 404 || statusCode === 410) {
            try {
              await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
            } catch (cleanupErr) {
              console.error("Failed to cleanup dead push subscription", cleanupErr);
            }
          }
          return false;
        }
      })
    );
    const accepted = results.filter(Boolean).length;
    if (accepted === 0) {
      throw new NotificationDeliveryAttemptError(
        "failed",
        "PUSH_DELIVERY_FAILED",
        "Push delivery failed for every active subscription."
      );
    }
    return {
      attemptedSubscriptions: results.length,
      acceptedSubscriptions: accepted,
      failedSubscriptions: results.length - accepted,
    };
  }

  private async logDelivery(input: NotificationDeliveryLogInput): Promise<void> {
    try {
      await db.insert(notificationDeliveryLog).values(buildNotificationDeliveryLogValues(input));
    } catch (error) {
      // Delivery evidence must never become a second delivery gate. In
      // particular, a missing/lagging delivery-log migration must not prevent
      // later methods (email/push) from being attempted.
      console.error("[notifications] Failed to persist delivery evidence", {
        notificationId: input.notificationId,
        userId: input.userId,
        deliveryMethod: input.deliveryMethod,
        status: input.status,
        error,
      });
    }
  }

  // =====================================
  // BULK OPERATIONS
  // =====================================

  async sendBulkNotification(
    userIds: string[],
    notification: Omit<InsertNotification, "userId">
  ): Promise<void> {
    const deliveryMethods = normalizeDeliveryMethods(
      notification.deliveryMethods as string[] | null
    );
    const notificationRecords: any[] = userIds.map((userId) => ({
      ...notification,
      userId,
      deliveryMethods,
    }));

    await db.transaction(async (tx: any) => {
      const created = await tx.insert(notifications).values(notificationRecords).returning();
      const now = new Date();
      if (!created.length) return;
      await tx.insert(notificationDeliveryLog).values(
        created.flatMap((record: Notification) =>
          deliveryMethods.map((deliveryMethod) => ({
            notificationId: record.id,
            userId: record.userId,
            deliveryMethod,
            status: deliveryMethod === "in_app" ? "delivered" : "pending",
            retryCount: 0,
            nextRetryAt:
              deliveryMethod === "in_app"
                ? null
                : record.scheduledFor || notification.scheduledFor || now,
            deliveredAt: deliveryMethod === "in_app" ? now : null,
            createdAt: now,
            updatedAt: now,
          }))
        )
      );
    });
  }

  async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    // Get notifications scheduled for now or earlier that haven't been sent
    const scheduledNotifications = await db
      .select()
      .from(notifications)
      .where(and(sql`${notifications.scheduledFor} <= ${now}`, isNull(notifications.sentAt)));

    for (const notification of scheduledNotifications) {
      try {
        await this.sendNotification(notification.id);
      } catch (error) {
        console.error(`Failed to send scheduled notification ${notification.id}:`, error);
      }
    }
  }

  // =====================================
  // ROLE-SPECIFIC NOTIFICATIONS
  // =====================================

  async sendWelcomeNotification(userId: string, userRole: string): Promise<void> {
    const roleMessages: Record<string, { title: string; message: string; actionUrl?: string }> = {
      homeowner: {
        title: "Welcome to TradeScout! 🏠",
        message:
          "Ready to find reliable contractors for your home? Start by opening a Direct Connect request and exploring contractors in your area. Scout surfaces local options, and TradeScout routes your next step for quotes and coordination.",
        actionUrl: "/contractors/board",
      },
      contractor_user: {
        title: "Welcome to TradeScout! 🔨",
        message:
          "Start growing your contracting business today! Complete your profile to attract quality leads and join our contractor community.",
        actionUrl: "/profile",
      },
      helper: {
        title: "Welcome to TradeScout Helpers! 🤝",
        message:
          "Ready to find work opportunities? Browse helper and crew opportunities from contractors and communities. Homeowners start coordination in Direct Connect; you respond here.",
        actionUrl: "/helpers",
      },
      accelerator_member: {
        title: "Welcome to TradeScout Accelerator! ⭐",
        message:
          "Unlock premium features, priority leads, and advanced business tools. Your accelerated growth starts now!",
        actionUrl: "/dashboard",
      },
    };

    const roleConfig = roleMessages[userRole] || roleMessages.homeowner;

    await this.createNotification({
      userId,
      type: "welcome",
      priority: "normal",
      title: roleConfig.title,
      message: roleConfig.message,
      actionUrl: roleConfig.actionUrl,
      actionText: "Get Started",
      iconName: "sparkles",
      iconColor: "blue",
      deliveryMethods: ["in_app", "email"] as string[],
    });
  }

  async sendMilestoneNotification(
    userId: string,
    milestone: string,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: "milestone",
      priority: "normal",
      title: `Milestone Achieved: ${milestone}! 🎉`,
      message: description,
      iconName: "award",
      iconColor: "gold",
      deliveryMethods: ["in_app"] as string[],
      metadata: {
        milestone: milestone,
        ...metadata,
      } as any,
    });
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
