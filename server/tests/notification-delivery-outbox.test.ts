import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateNotificationEmailRetryDelayMs,
  classifyNotificationEmailFailure,
  isNotificationDeliveryTerminalStatus,
  renderNotificationEmailPayload,
  renderNotificationEmailPayloadForAttempt,
  resolveNotificationEmailRecipient,
  resolveNotificationEmailProviderTimeoutMs,
} from "../notification-service";
import { resolveEmailProviderRequestTimeoutMs } from "../services/emailService";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("durable notification email delivery policy", () => {
  it("uses bounded exponential retry delays", () => {
    expect(calculateNotificationEmailRetryDelayMs(1, 1_000, 8_000)).toBe(1_000);
    expect(calculateNotificationEmailRetryDelayMs(2, 1_000, 8_000)).toBe(2_000);
    expect(calculateNotificationEmailRetryDelayMs(4, 1_000, 8_000)).toBe(8_000);
    expect(calculateNotificationEmailRetryDelayMs(10, 1_000, 8_000)).toBe(8_000);
  });

  it("retries network, rate-limit, and provider failures but terminalizes permanent 4xx", () => {
    expect(
      classifyNotificationEmailFailure(
        Object.assign(new Error("socket timed out"), { code: "ETIMEDOUT" })
      ).retryable
    ).toBe(true);
    expect(
      classifyNotificationEmailFailure(
        Object.assign(new Error("Brevo unavailable"), { statusCode: 503 })
      ).retryable
    ).toBe(true);
    expect(
      classifyNotificationEmailFailure(
        Object.assign(new Error("Brevo rate limited"), { statusCode: 429 })
      ).retryable
    ).toBe(true);
    expect(
      classifyNotificationEmailFailure(
        Object.assign(new Error("Bad recipient"), { statusCode: 400 })
      ).retryable
    ).toBe(false);
  });

  it("never retries suppression or missing provider configuration", () => {
    expect(
      classifyNotificationEmailFailure({
        deliveryStatus: "suppressed",
        deliveryErrorCode: "EMAIL_MODE_SUPPRESSED",
        message: "Restricted email mode",
      })
    ).toMatchObject({
      retryable: false,
      status: "suppressed",
      errorCode: "EMAIL_MODE_SUPPRESSED",
    });
    expect(
      classifyNotificationEmailFailure({
        deliveryErrorCode: "EMAIL_PROVIDER_NOT_CONFIGURED",
        message: "No provider",
      }).retryable
    ).toBe(false);
  });

  it("distinguishes terminal states from active leases and scheduled retries", () => {
    for (const status of [
      "sent",
      "delivered",
      "accepted_unreconciled",
      "delivery_unknown",
      "failed",
      "bounced",
      "suppressed",
      "exhausted",
    ]) {
      expect(isNotificationDeliveryTerminalStatus(status)).toBe(true);
    }
    for (const status of ["pending", "processing", "retry_scheduled"]) {
      expect(isNotificationDeliveryTerminalStatus(status)).toBe(false);
    }
  });

  it("keeps the hard provider deadline below the refreshed claim lease", () => {
    expect(resolveNotificationEmailProviderTimeoutMs(120_000, 30_000)).toBe(30_000);
    expect(resolveNotificationEmailProviderTimeoutMs(10_000, 30_000)).toBe(7_500);
    expect(resolveNotificationEmailProviderTimeoutMs(1_000, 30_000)).toBe(750);
    expect(resolveEmailProviderRequestTimeoutMs(750)).toBe(750);
    expect(resolveEmailProviderRequestTimeoutMs(undefined)).toBe(30_000);
  });

  it("renders the durable Direct Connect request template from a nonsecret request id", () => {
    const payload = renderNotificationEmailPayload(
      {
        title: "ignored",
        message: "ignored",
        metadata: {
          emailTemplate: {
            kind: "direct_connect_request_created",
            workRequestId: "request/with spaces",
          },
        },
      },
      { firstName: "Sam" }
    );

    expect(payload.subject).toBe("You have a new TradeScout Direct Connect request");
    expect(payload.html).toContain(
      "https://www.thetradescout.com/direct-connect/engagements?requestId=request%2Fwith%20spaces"
    );
    expect(payload.text).toContain("requestId=request%2Fwith%20spaces");
    expect(JSON.stringify(payload)).not.toMatch(/reset-password|verify-email|token=/i);
  });

  it("reuses delivery-scoped account-setup credentials across retries", async () => {
    let passwordIssueCount = 0;
    let verificationIssueCount = 0;
    const passwordByDelivery = new Map<string, string>();
    const verificationByDelivery = new Map<string, string>();
    const credentialIssuer = {
      createPasswordResetToken: async (_userId: string, deliveryIntentId: string) => {
        if (!passwordByDelivery.has(deliveryIntentId)) {
          passwordByDelivery.set(deliveryIntentId, `password-scope-${++passwordIssueCount}`);
        }
        return { token: String(passwordByDelivery.get(deliveryIntentId)) };
      },
      createEmailVerificationToken: async (_userId: string, deliveryIntentId: string) => {
        if (!verificationByDelivery.has(deliveryIntentId)) {
          verificationByDelivery.set(
            deliveryIntentId,
            `verification-scope-${++verificationIssueCount}`
          );
        }
        return { token: String(verificationByDelivery.get(deliveryIntentId)) };
      },
    };
    const notification = {
      userId: "setup-user",
      title: "ignored",
      message: "ignored",
      metadata: {
        emailPurpose: "direct_connect_account_setup",
        emailTemplate: {
          kind: "direct_connect_account_setup",
          userId: "setup-user",
          workRequestId: "setup-request",
        },
      },
    };
    const recipient = {
      id: "setup-user",
      firstName: "Sam",
      password: null,
      emailVerified: false,
    };

    const first = await renderNotificationEmailPayloadForAttempt(
      notification,
      recipient,
      credentialIssuer,
      "delivery-intent-stable"
    );
    const second = await renderNotificationEmailPayloadForAttempt(
      notification,
      recipient,
      credentialIssuer,
      "delivery-intent-stable"
    );

    expect(passwordIssueCount).toBe(1);
    expect(verificationIssueCount).toBe(1);
    expect(first.text).toContain("password-scope-1");
    expect(first.text).toContain("verification-scope-1");
    expect(second.text).toContain("password-scope-1");
    expect(second.text).toContain("verification-scope-1");
    expect(JSON.stringify(notification.metadata)).toBe(
      JSON.stringify({
        emailPurpose: "direct_connect_account_setup",
        emailTemplate: {
          kind: "direct_connect_account_setup",
          userId: "setup-user",
          workRequestId: "setup-request",
        },
      })
    );
  });

  it("renders a shared-inbox TradePartner request without using the owner's login email", () => {
    const notification = {
      userId: "owner-user",
      title: "ignored",
      message: "ignored",
      metadata: {
        emailPurpose: "tradepartner_request_notification",
        emailTemplate: {
          kind: "tradepartner_profile_request",
          ownerUserId: "owner-user",
          workRequestId: "request-1",
          recipientEmail: "Dispatch@Example.com",
          businessName: "JW <Stone>",
          requesterDisplayName: "Sam & Co.",
          requestSummary: "Material request",
          stoneName: "Green > Onyx",
        },
      },
    };
    const recipient = {
      id: "owner-user",
      email: null,
      firstName: "Owner",
    };

    expect(resolveNotificationEmailRecipient(notification, recipient)).toBe("dispatch@example.com");
    const payload = renderNotificationEmailPayload(notification, recipient);
    expect(payload.subject).toBe("New request for JW <Stone>");
    expect(payload.html).toContain("JW &lt;Stone&gt;");
    expect(payload.html).toContain("Sam &amp; Co.");
    expect(payload.html).toContain("Green &gt; Onyx");
    expect(payload.text).toContain("Open Direct Connect inbox:");
    expect(JSON.stringify(payload)).not.toContain("dispatch@example.com");
    expect(JSON.stringify(payload)).not.toMatch(/reset-password|verify-email|token=/i);
  });

  it("rejects a shared-inbox recipient override not bound to the notification owner", () => {
    const notification = {
      userId: "different-user",
      metadata: {
        emailTemplate: {
          kind: "tradepartner_profile_request",
          ownerUserId: "owner-user",
          workRequestId: "request-1",
          recipientEmail: "dispatch@example.com",
          businessName: "JW Stone",
          requesterDisplayName: "Sam",
          requestSummary: "Material request",
        },
      },
    };
    const recipient = { id: "owner-user", email: "owner-login@example.com" };

    expect(resolveNotificationEmailRecipient(notification, recipient)).toBeNull();
    expect(() => renderNotificationEmailPayload(notification, recipient)).toThrow(
      "invalid durable identifiers"
    );
  });
});

describe("durable notification outbox contracts", () => {
  const service = read("server/notification-service.ts");
  const scheduler = read("server/index.ts");
  const emailProvider = read("server/services/emailService.ts");
  const schema = read("shared/schema.ts");
  const migration = read("migrations/0112_notification_delivery_claim_ownership.sql");
  const productionSchemaGuard = read("scripts/check-required-production-schema.mjs");
  const directConnectRoute = read("server/routes/direct-connect.ts");
  const adminUi = read("client/src/components/admin/AdminDirectConnectRequestDetail.tsx");

  it("persists method intents before dispatch and serializes fallback intent creation", () => {
    expect(service).toContain("async enqueueNotification(tx: any");
    expect(service).toContain("this.enqueueNotification(tx, notification)");
    expect(service).toContain("await tx.insert(notificationDeliveryLog).values");
    expect(service).toContain("notification-delivery-intent:");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain('status: deliveryMethod === "in_app" ? "delivered" : "pending"');
  });

  it("claims due email work atomically and terminalizes ambiguous stale claims", () => {
    expect(service).toContain("FOR UPDATE OF ndl SKIP LOCKED");
    expect(service).toContain("SET status = 'processing'");
    expect(service).toContain("AND updated_at <= $1");
    expect(service).toContain("COALESCE(ndl.retry_count, 0) < $2");
    expect(service).toContain("status = 'delivery_unknown'");
    expect(service).toContain("status = 'accepted_unreconciled'");
    expect(service).toContain("EMAIL_ACCEPTANCE_EVIDENCE_UNRECONCILED");
    expect(service).toContain("EMAIL_DELIVERY_OUTCOME_UNKNOWN");
    expect(service).toContain("EMAIL_DELIVERY_PRE_PROVIDER_LEASE_EXPIRED");
    expect(service).toContain("external_response ? 'providerAttemptStartedAt'");
    expect(service).toContain(
      "NOT (COALESCE(external_response, '{}'::jsonb) ? 'providerAttemptStartedAt')"
    );
    expect(service).toContain('status: "retry_scheduled"');
    expect(service).toContain("calculateNotificationEmailRetryDelayMs");
    const claimStart = service.indexOf("private async claimDueEmailDeliveries");
    const claimEnd = service.indexOf("protected async persistAcceptedEmailDelivery", claimStart);
    const claimSource = service.slice(claimStart, claimEnd);
    expect(claimSource).toContain("ndl.status IN ('pending', 'retry_scheduled')");
    expect(claimSource).not.toContain("ndl.status = 'processing'");
    expect(service).toContain("Math.min(options.concurrency, remainingBatchCapacity)");
    expect(service).toContain("await Promise.all(");
  });

  it("fences every claimed attempt with a rotated database ownership token", () => {
    expect(schema).toContain('claimToken: varchar("claim_token")');
    expect(migration).toContain("claim_token varchar");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS claim_token varchar");
    expect(productionSchemaGuard).toContain("'claim_token'");
    expect(service).toContain("claim_token = gen_random_uuid()::text");
    expect(service).toContain('ndl.claim_token AS "claimToken"');
    expect(service).toContain("eq(notificationDeliveryLog.claimToken, delivery.claimToken)");
    expect(service).toContain("eq(notificationDeliveryLog.claimToken, input.delivery.claimToken)");
    expect(service).toContain("AND claim_token = $4");
    expect(service).toContain("AND claim_token = $7");
    expect(service.match(/claimToken: null/g)?.length || 0).toBeGreaterThanOrEqual(5);
    expect(service.match(/claim_token = NULL/g)?.length || 0).toBeGreaterThanOrEqual(3);
  });

  it("runs SKIP LOCKED email claims on every scheduler instance despite a leader-lock miss", () => {
    const schedulerLaneStart = scheduler.indexOf(
      "// Every scheduler-enabled instance may run the durable email processor."
    );
    const processorStart = scheduler.indexOf(
      "const runNotificationDeliveryTick",
      schedulerLaneStart
    );
    const legacyLeaderGuard = scheduler.indexOf("if (backgroundJobsEnabled) {", processorStart);
    const birthdayStart = scheduler.indexOf(
      "// Run birthday notifications only on the elected scheduler instance.",
      processorStart
    );

    expect(schedulerLaneStart).toBeGreaterThan(-1);
    expect(processorStart).toBeGreaterThan(schedulerLaneStart);
    expect(legacyLeaderGuard).toBeGreaterThan(processorStart);
    expect(processorStart).toBeLessThan(birthdayStart);
    expect(scheduler).toContain("await notificationService.processDueEmailDeliveries()");
    expect(scheduler).toContain("notificationDeliveryTickActive");
  });

  it("enforces provider transport timeouts below refreshed delivery leases", () => {
    expect(service).toContain("resolveNotificationEmailProviderTimeoutMs");
    expect(service).toContain("providerAttemptStartedAt");
    expect(service).toContain("AND status = 'processing'");
    expect(service).toContain("requestTimeoutMs");
    expect(emailProvider).toContain("sendgridMailer.setTimeout(requestTimeoutMs)");
    expect(emailProvider).toContain("signal: AbortSignal.timeout(requestTimeoutMs)");
  });

  it("prepares payloads and credentials before crossing the provider-attempt boundary", () => {
    const completionStart = service.indexOf("private async completeEmailDelivery");
    const completionEnd = service.indexOf("async processDueEmailDeliveries", completionStart);
    const completion = service.slice(completionStart, completionEnd);
    const prepare = completion.indexOf("await this.prepareEmailNotification");
    const providerBoundary = completion.indexOf("'providerAttemptStartedAt'");
    const providerRequest = completion.indexOf("await this.sendEmailNotification");

    expect(prepare).toBeGreaterThan(-1);
    expect(providerBoundary).toBeGreaterThan(prepare);
    expect(providerRequest).toBeGreaterThan(providerBoundary);
  });

  it("uses the owner-bound shared inbox throughout a claimed delivery attempt", () => {
    const completionStart = service.indexOf("private async completeEmailDelivery");
    const completionEnd = service.indexOf("async processDueEmailDeliveries", completionStart);
    const completion = service.slice(completionStart, completionEnd);

    expect(completion).toContain(
      "const recipientEmail = resolveNotificationEmailRecipient(notification, user)"
    );
    expect(completion).toContain("recipientEmail,");
    expect(completion).toContain("contactInfo: recipientEmail");
    expect(completion).not.toContain("recipientEmail: user.email");
    expect(completion).not.toContain("contactInfo: user.email");
    expect(completion).not.toContain("user.email || null");
    expect(service).toContain("to: recipientEmail");
  });

  it("exposes retry and terminal evidence to Direct Connect operators", () => {
    expect(directConnectRoute).toContain('AS "retryCount"');
    expect(directConnectRoute).toContain('AS "nextRetryAt"');
    expect(directConnectRoute).toContain("END AS terminal");
    expect(adminUi).toContain("Automatic retry scheduled for");
    expect(adminUi).toContain("automatic retries have stopped");
    expect(adminUi).toContain("automatic retry stops for reconciliation");
    expect(adminUi).toContain("The processing lease expired without a durable provider outcome");
  });

  it("uses typed nonsecret durable templates for both admin Direct Connect email flows", () => {
    expect(service).toContain("createDirectConnectRequestEmail");
    expect(service).toContain('kind: "direct_connect_request_created"');
    expect(service).toContain("enqueueDirectConnectAccountSetupEmail");
    expect(service).toContain('kind: "direct_connect_account_setup"');
    expect(directConnectRoute).toContain("notificationService.enqueueDirectConnectRequestEmail");
    expect(directConnectRoute).toContain(
      "notificationService.enqueueDirectConnectAccountSetupEmail"
    );
    expect(directConnectRoute).toContain("notificationService.dispatchDirectConnectEmail");
    const creationTransactionStart = directConnectRoute.indexOf(
      "const creationResult = await db.transaction"
    );
    const requestEnqueue = directConnectRoute.indexOf(
      "notificationService.enqueueDirectConnectRequestEmail",
      creationTransactionStart
    );
    const setupEnqueue = directConnectRoute.indexOf(
      "notificationService.enqueueDirectConnectAccountSetupEmail",
      creationTransactionStart
    );
    const creationTransactionEnd = directConnectRoute.indexOf(
      "const created = creationResult.request",
      creationTransactionStart
    );
    expect(requestEnqueue).toBeGreaterThan(creationTransactionStart);
    expect(requestEnqueue).toBeLessThan(creationTransactionEnd);
    expect(setupEnqueue).toBeGreaterThan(creationTransactionStart);
    expect(setupEnqueue).toBeLessThan(creationTransactionEnd);

    const setupPersistenceStart = service.indexOf("async enqueueDirectConnectAccountSetupEmail");
    const setupPersistenceEnd = service.indexOf(
      "private serializeDirectConnectRequestEmailDelivery",
      setupPersistenceStart
    );
    const setupPersistence = service.slice(setupPersistenceStart, setupPersistenceEnd);
    expect(setupPersistence).toContain('kind: "direct_connect_account_setup"');
    expect(setupPersistence).toContain("userId,");
    expect(setupPersistence).toContain("workRequestId,");
    expect(setupPersistence).not.toMatch(/\btoken\b|reset-password|verify-email/i);
    expect(setupPersistence).not.toContain("\n        html:");
    expect(setupPersistence).not.toContain("\n        text:");
    expect(directConnectRoute).not.toContain("passwordResetService.createToken");
    expect(directConnectRoute).not.toContain("emailVerificationService.createToken");
    expect(directConnectRoute).not.toContain("emailService.sendEmail");
  });

  it("treats Direct Connect mail as operational and stores one visible notification", () => {
    expect(service).toContain("isOperationalDirectConnectEmailPurpose");
    expect(service).toContain('purpose === "direct_connect_account_setup"');
    expect(service).toContain('purpose === "direct_connect_request"');
    expect(service).toContain(
      "isOperationalDirectConnectEmail || preferences?.enableEmailNotifications !== false"
    );
    expect(service).toContain('deliveryMethods: ["in_app", "email"]');

    const adminCreateStart = directConnectRoute.indexOf(
      "const creationResult = await db.transaction"
    );
    const adminCreateEnd = directConnectRoute.indexOf(
      "await auditDirectConnectBypassUsage",
      adminCreateStart
    );
    const adminCreateRoute = directConnectRoute.slice(adminCreateStart, adminCreateEnd);
    expect(adminCreateRoute).toContain("notificationService.enqueueDirectConnectRequestEmail");
    expect(adminCreateRoute).toContain("notificationService.enqueueDirectConnectAccountSetupEmail");
    expect(adminCreateRoute).not.toContain("notificationService.createNotification({");
  });
});
