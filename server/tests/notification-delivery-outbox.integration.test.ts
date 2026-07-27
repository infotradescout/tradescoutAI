import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { NotificationService } from "../notification-service";
import { notificationDeliveryLog, notifications, users } from "@shared/schema";

const describeWithDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;
const TEST_TIMEOUT_MS = 30_000;

vi.setConfig({ testTimeout: TEST_TIMEOUT_MS });

describeWithDb("notification delivery outbox integration", () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `notification-outbox-user-${runId}`;
  const email = `notification-outbox-${runId}@example.com`;
  const setupUserId = `notification-setup-user-${runId}`;
  const setupEmail = `notification-setup-${runId}@example.com`;

  const loadEmailDelivery = async (notificationId: string) => {
    const [delivery] = await db
      .select()
      .from(notificationDeliveryLog)
      .where(
        and(
          eq(notificationDeliveryLog.notificationId, notificationId),
          eq(notificationDeliveryLog.deliveryMethod, "email")
        )
      )
      .limit(1);
    return delivery;
  };

  const deleteNotifications = async () => {
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(notifications).where(eq(notifications.userId, setupUserId));
  };

  beforeAll(async () => {
    await db.insert(users).values({
      id: userId,
      email,
      firstName: "Outbox",
      lastName: "Tester",
      emailVerified: true,
    } as any);
    await db.insert(users).values({
      id: setupUserId,
      email: setupEmail,
      firstName: "Setup",
      lastName: "Tester",
      password: null,
      emailVerified: false,
    } as any);
  });

  afterEach(async () => {
    await deleteNotifications();
  });

  afterAll(async () => {
    await deleteNotifications();
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(users).where(eq(users.id, setupUserId));
  });

  it("persists one intent per method before sending and does not resend a terminal intent", async () => {
    let sends = 0;
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          return {
            skipped: false,
            provider: "brevo",
            messageId: `provider-${sends}`,
          };
        },
      },
    });
    const scheduledFor = new Date(Date.now() + 60_000);
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Durable request",
      message: "Review this request.",
      scheduledFor,
      deliveryMethods: ["in_app", "email"],
    });

    const intents = await db
      .select()
      .from(notificationDeliveryLog)
      .where(eq(notificationDeliveryLog.notificationId, created.id));
    expect(intents).toHaveLength(2);
    expect(intents.find((row: any) => row.deliveryMethod === "in_app")?.status).toBe("delivered");
    expect(intents.find((row: any) => row.deliveryMethod === "email")?.status).toBe("pending");
    expect(sends).toBe(0);

    await db
      .update(notifications)
      .set({ scheduledFor: new Date(0), sentAt: null })
      .where(eq(notifications.id, created.id));
    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(
        and(
          eq(notificationDeliveryLog.notificationId, created.id),
          eq(notificationDeliveryLog.deliveryMethod, "email")
        )
      );

    await service.sendNotification(created.id);
    await service.sendNotification(created.id);

    const delivered = await loadEmailDelivery(created.id);
    expect(sends).toBe(1);
    expect(delivered.status).toBe("sent");
    expect(delivered.retryCount).toBe(1);
    expect(delivered.externalId).toBe("provider-1");
  });

  it("retries a transient provider failure and later records provider acceptance", async () => {
    let sends = 0;
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          if (sends === 1) {
            throw Object.assign(new Error("Brevo unavailable"), { statusCode: 503 });
          }
          return { skipped: false, provider: "brevo", messageId: "provider-retry-success" };
        },
      },
      emailDelivery: {
        maxAttempts: 3,
        baseRetryMs: 1,
        maxRetryMs: 1,
        leaseMs: 1_000,
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Transient failure",
      message: "Retry this request email.",
      deliveryMethods: ["email"],
    });

    let delivery = await loadEmailDelivery(created.id);
    expect(delivery.status).toBe("retry_scheduled");
    expect(delivery.retryCount).toBe(1);
    expect(delivery.nextRetryAt).toBeInstanceOf(Date);

    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(eq(notificationDeliveryLog.id, delivery.id));
    const result = await service.processDueEmailDeliveries({ notificationId: created.id });

    delivery = await loadEmailDelivery(created.id);
    expect(result).toMatchObject({ claimed: 1, sent: 1 });
    expect(sends).toBe(2);
    expect(delivery.status).toBe("sent");
    expect(delivery.retryCount).toBe(2);
    expect(delivery.externalId).toBe("provider-retry-success");
  });

  it("never retries after provider acceptance when the normal evidence write fails", async () => {
    let sends = 0;
    class EvidenceWriteFailingNotificationService extends NotificationService {
      protected override async persistAcceptedEmailDelivery(): Promise<void> {
        throw new Error("simulated primary acceptance evidence write failure");
      }
    }
    const service = new EvidenceWriteFailingNotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          return {
            skipped: false,
            provider: "brevo",
            messageId: "provider-accepted-before-evidence-failure",
          };
        },
      },
      emailDelivery: {
        leaseMs: 1_000,
        providerTimeoutMs: 500,
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Acceptance evidence failure",
      message: "Do not duplicate an accepted request.",
      deliveryMethods: ["email"],
    });

    let delivery = await loadEmailDelivery(created.id);
    expect(sends).toBe(1);
    expect(delivery.status).toBe("accepted_unreconciled");
    expect(delivery.externalId).toBe("provider-accepted-before-evidence-failure");
    expect(delivery.errorCode).toBe("EMAIL_ACCEPTANCE_EVIDENCE_UNRECONCILED");
    expect(delivery.nextRetryAt).toBeNull();
    expect(delivery.sentAt).toBeInstanceOf(Date);

    const result = await service.processDueEmailDeliveries({
      notificationId: created.id,
      now: new Date(Date.now() + 60_000),
      leaseMs: 1_000,
    });
    delivery = await loadEmailDelivery(created.id);
    expect(result).toMatchObject({ claimed: 0 });
    expect(sends).toBe(1);
    expect(delivery.status).toBe("accepted_unreconciled");
  });

  it("stores no setup bearer material and reuses delivery-scoped credentials for a retry", async () => {
    let passwordIssues = 0;
    let verificationIssues = 0;
    const passwordByDelivery = new Map<string, string>();
    const verificationByDelivery = new Map<string, string>();
    const attempts: Array<{ html?: string; text?: string }> = [];
    const service = new NotificationService({
      accountSetupCredentialIssuer: {
        createPasswordResetToken: async (_userId, deliveryIntentId) => {
          if (!passwordByDelivery.has(deliveryIntentId)) {
            passwordByDelivery.set(deliveryIntentId, `db-password-secret-${++passwordIssues}`);
          }
          return { token: String(passwordByDelivery.get(deliveryIntentId)) };
        },
        createEmailVerificationToken: async (_userId, deliveryIntentId) => {
          if (!verificationByDelivery.has(deliveryIntentId)) {
            verificationByDelivery.set(
              deliveryIntentId,
              `db-verification-secret-${++verificationIssues}`
            );
          }
          return { token: String(verificationByDelivery.get(deliveryIntentId)) };
        },
      },
      emailSender: {
        isConfigured: () => true,
        sendEmail: async (params) => {
          attempts.push({ html: params.html, text: params.text });
          if (attempts.length === 1) {
            throw Object.assign(
              new Error(
                "Provider echoed https://www.thetradescout.com/reset-password?token=db-password-secret-1"
              ),
              { statusCode: 503 }
            );
          }
          return {
            skipped: false,
            provider: "brevo",
            messageId: "provider-setup-retry-success",
          };
        },
      },
      emailDelivery: {
        maxAttempts: 3,
        baseRetryMs: 1,
        maxRetryMs: 1,
        leaseMs: 1_000,
      },
    });
    const enqueued = await db.transaction((tx: any) =>
      service.enqueueDirectConnectAccountSetupEmail(tx, {
        userId: setupUserId,
        workRequestId: `setup-request-${runId}`,
      })
    );

    const firstResult = await service.dispatchDirectConnectEmail(enqueued.notification.id);
    expect(firstResult.delivery?.status).toBe("retry_scheduled");
    expect(passwordIssues).toBe(1);
    expect(verificationIssues).toBe(1);
    expect(attempts[0]?.text).toContain("db-password-secret-1");
    expect(attempts[0]?.text).toContain("db-verification-secret-1");

    const [storedNotification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, enqueued.notification.id))
      .limit(1);
    let storedDelivery = await loadEmailDelivery(enqueued.notification.id);
    const firstDurableEvidence = JSON.stringify({
      notification: storedNotification,
      delivery: storedDelivery,
    });
    expect(firstDurableEvidence).not.toMatch(
      /db-password-secret|db-verification-secret|reset-password|verify-email|token=/i
    );
    expect(storedDelivery.errorMessage).toBe(
      "Direct Connect account-setup email provider request failed."
    );

    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(eq(notificationDeliveryLog.id, storedDelivery.id));
    const retryResult = await service.processDueEmailDeliveries({
      notificationId: enqueued.notification.id,
    });

    storedDelivery = await loadEmailDelivery(enqueued.notification.id);
    expect(retryResult).toMatchObject({ claimed: 1, sent: 1 });
    expect(passwordIssues).toBe(1);
    expect(verificationIssues).toBe(1);
    expect(attempts[1]?.text).toContain("db-password-secret-1");
    expect(attempts[1]?.text).toContain("db-verification-secret-1");
    expect(storedDelivery.status).toBe("sent");
    expect(storedDelivery.retryCount).toBe(2);
    expect(storedDelivery.externalId).toBe("provider-setup-retry-success");
    expect(JSON.stringify(storedDelivery)).not.toMatch(
      /db-password-secret|db-verification-secret|reset-password|verify-email|token=/i
    );
  });

  it("keeps credential-rendering failures before the provider-attempt boundary", async () => {
    let sends = 0;
    const service = new NotificationService({
      accountSetupCredentialIssuer: {
        createPasswordResetToken: async () => {
          throw new Error("credential store unavailable");
        },
        createEmailVerificationToken: async () => ({
          token: "must-not-be-issued-after-password-failure",
        }),
      },
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          return { skipped: false, provider: "brevo", messageId: "unexpected-send" };
        },
      },
      emailDelivery: {
        maxAttempts: 3,
        baseRetryMs: 1,
        maxRetryMs: 1,
        leaseMs: 1_000,
      },
    });
    const enqueued = await db.transaction((tx: any) =>
      service.enqueueDirectConnectAccountSetupEmail(tx, {
        userId: setupUserId,
        workRequestId: `setup-render-failure-${runId}`,
      })
    );

    const result = await service.dispatchDirectConnectEmail(enqueued.notification.id);
    const delivery = await loadEmailDelivery(enqueued.notification.id);

    expect(result.delivery?.status).toBe("retry_scheduled");
    expect(sends).toBe(0);
    expect(delivery.claimToken).toBeNull();
    expect(delivery.externalResponse).not.toHaveProperty("providerAttemptStartedAt");
    expect(delivery.errorCode).toBe("DIRECT_CONNECT_SETUP_CREDENTIAL_ISSUANCE_FAILED");
  });

  it("terminalizes permanent failures without scheduling a retry", async () => {
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          throw Object.assign(new Error("Bad recipient"), { statusCode: 400 });
        },
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Permanent failure",
      message: "Do not retry this malformed request.",
      deliveryMethods: ["email"],
    });

    const delivery = await loadEmailDelivery(created.id);
    expect(delivery.status).toBe("failed");
    expect(delivery.retryCount).toBe(1);
    expect(delivery.nextRetryAt).toBeNull();
    expect(delivery.failedAt).toBeInstanceOf(Date);
  });

  it("exhausts the bounded attempt budget", async () => {
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          throw Object.assign(new Error("Provider unavailable"), { statusCode: 503 });
        },
      },
      emailDelivery: {
        maxAttempts: 2,
        baseRetryMs: 1,
        maxRetryMs: 1,
        leaseMs: 1_000,
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Exhaust attempts",
      message: "Bound this retry sequence.",
      deliveryMethods: ["email"],
    });
    const firstAttempt = await loadEmailDelivery(created.id);
    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(eq(notificationDeliveryLog.id, firstAttempt.id));

    await service.processDueEmailDeliveries({ notificationId: created.id });
    const exhausted = await loadEmailDelivery(created.id);
    expect(exhausted.status).toBe("exhausted");
    expect(exhausted.retryCount).toBe(2);
    expect(exhausted.nextRetryAt).toBeNull();
    expect(exhausted.failedAt).toBeInstanceOf(Date);
  });

  it("terminalizes a stale processing lease as unknown without risking a duplicate send", async () => {
    let sends = 0;
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          return { skipped: false, provider: "brevo", messageId: "stale-lease-recovered" };
        },
      },
      emailDelivery: {
        maxAttempts: 3,
        leaseMs: 1_000,
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Recover lease",
      message: "Recover this stale claim.",
      scheduledFor: new Date(Date.now() + 60_000),
      deliveryMethods: ["email"],
    });
    const delivery = await loadEmailDelivery(created.id);
    await db
      .update(notifications)
      .set({ scheduledFor: new Date(0) })
      .where(eq(notifications.id, created.id));
    await db
      .update(notificationDeliveryLog)
      .set({
        status: "processing",
        retryCount: 1,
        nextRetryAt: null,
        externalResponse: {
          deliveryIntentId: delivery.id,
          providerAttemptStartedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        updatedAt: new Date(Date.now() - 60_000),
      })
      .where(eq(notificationDeliveryLog.id, delivery.id));

    const result = await service.processDueEmailDeliveries({
      notificationId: created.id,
      leaseMs: 1_000,
    });
    const recovered = await loadEmailDelivery(created.id);
    expect(result).toMatchObject({ claimed: 0, sent: 0, terminal: 1 });
    expect(sends).toBe(0);
    expect(recovered.status).toBe("delivery_unknown");
    expect(recovered.errorCode).toBe("EMAIL_DELIVERY_OUTCOME_UNKNOWN");
    expect(recovered.nextRetryAt).toBeNull();
    expect(recovered.retryCount).toBe(1);
  });

  it("safely requeues a stale claim that never crossed the provider-attempt boundary", async () => {
    let sends = 0;
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          sends += 1;
          return { skipped: false, provider: "brevo", messageId: "safe-pre-provider-retry" };
        },
      },
      emailDelivery: {
        maxAttempts: 3,
        leaseMs: 1_000,
      },
    });
    const created = await service.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Recover pre-provider claim",
      message: "This claim never reached the provider.",
      scheduledFor: new Date(Date.now() + 60_000),
      deliveryMethods: ["email"],
    });
    const delivery = await loadEmailDelivery(created.id);
    await db
      .update(notifications)
      .set({ scheduledFor: new Date(0) })
      .where(eq(notifications.id, created.id));
    await db
      .update(notificationDeliveryLog)
      .set({
        status: "processing",
        retryCount: 1,
        nextRetryAt: null,
        externalResponse: {
          deliveryIntentId: delivery.id,
          lastClaimedAt: new Date(Date.now() - 60_000).toISOString(),
        },
        updatedAt: new Date(Date.now() - 60_000),
      })
      .where(eq(notificationDeliveryLog.id, delivery.id));

    const result = await service.processDueEmailDeliveries({
      notificationId: created.id,
      leaseMs: 1_000,
    });
    const recovered = await loadEmailDelivery(created.id);
    expect(result).toMatchObject({
      requeuedBeforeProvider: 1,
      claimed: 1,
      sent: 1,
      terminal: 0,
    });
    expect(sends).toBe(1);
    expect(recovered.status).toBe("sent");
    expect(recovered.retryCount).toBe(1);
  });

  it("starts claimed rows in bounded concurrent waves", async () => {
    let activeSends = 0;
    let maximumConcurrentSends = 0;
    let sends = 0;
    const service = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          activeSends += 1;
          maximumConcurrentSends = Math.max(maximumConcurrentSends, activeSends);
          sends += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          activeSends -= 1;
          return { skipped: false, provider: "brevo", messageId: `bounded-wave-${sends}` };
        },
      },
    });
    const created = await Promise.all(
      [1, 2, 3].map((index) =>
        service.createNotification({
          userId,
          type: "direct_connect_beta_request",
          title: `Bounded wave ${index}`,
          message: "Start every claimed row inside a bounded wave.",
          scheduledFor: new Date(Date.now() + 60_000),
          deliveryMethods: ["email"],
        })
      )
    );
    const notificationIds = created.map((notification) => notification.id);
    await db
      .update(notifications)
      .set({ scheduledFor: new Date(0) })
      .where(inArray(notifications.id, notificationIds));
    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(inArray(notificationDeliveryLog.notificationId, notificationIds));

    const result = await service.processDueEmailDeliveries({
      batchSize: 3,
      concurrency: 2,
    });
    expect(result).toMatchObject({ claimed: 3, sent: 3 });
    expect(sends).toBe(3);
    expect(maximumConcurrentSends).toBe(2);
  });

  it("prevents an expired pre-provider owner from sending after another worker reclaims", async () => {
    let oldWorkerSends = 0;
    let newWorkerSends = 0;
    let releaseOldContext!: () => void;
    let markOldContextEntered!: () => void;
    const oldContextEntered = new Promise<void>((resolve) => {
      markOldContextEntered = resolve;
    });
    const oldContextRelease = new Promise<void>((resolve) => {
      releaseOldContext = resolve;
    });

    class PausedBeforeProviderService extends NotificationService {
      private pauseFirstContext = true;

      protected override async loadNotificationDeliveryContext(notificationId: string) {
        const context = await super.loadNotificationDeliveryContext(notificationId);
        if (this.pauseFirstContext) {
          this.pauseFirstContext = false;
          markOldContextEntered();
          await oldContextRelease;
        }
        return context;
      }
    }

    const oldWorker = new PausedBeforeProviderService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          oldWorkerSends += 1;
          return { skipped: false, provider: "brevo", messageId: "stale-owner-send" };
        },
      },
      emailDelivery: { leaseMs: 1_000 },
    });
    const newWorker = new NotificationService({
      emailSender: {
        isConfigured: () => true,
        sendEmail: async () => {
          newWorkerSends += 1;
          return { skipped: false, provider: "brevo", messageId: "current-owner-send" };
        },
      },
      emailDelivery: { leaseMs: 1_000 },
    });
    const created = await oldWorker.createNotification({
      userId,
      type: "direct_connect_beta_request",
      title: "Ownership handoff",
      message: "Only the current lease owner may send.",
      scheduledFor: new Date(Date.now() + 60_000),
      deliveryMethods: ["email"],
    });
    await db
      .update(notifications)
      .set({ scheduledFor: new Date(0) })
      .where(eq(notifications.id, created.id));
    await db
      .update(notificationDeliveryLog)
      .set({ nextRetryAt: new Date(0) })
      .where(eq(notificationDeliveryLog.notificationId, created.id));

    const oldRun = oldWorker.processDueEmailDeliveries({
      notificationId: created.id,
      leaseMs: 1_000,
    });
    await oldContextEntered;
    const oldClaim = await loadEmailDelivery(created.id);
    expect(oldClaim.status).toBe("processing");
    expect(oldClaim.claimToken).toBeTruthy();

    await db
      .update(notificationDeliveryLog)
      .set({ updatedAt: new Date(Date.now() - 60_000) })
      .where(
        and(
          eq(notificationDeliveryLog.id, oldClaim.id),
          eq(notificationDeliveryLog.claimToken, oldClaim.claimToken)
        )
      );
    const newResult = await newWorker.processDueEmailDeliveries({
      notificationId: created.id,
      leaseMs: 1_000,
    });
    const newCompletion = await loadEmailDelivery(created.id);

    releaseOldContext();
    await oldRun;
    const finalDelivery = await loadEmailDelivery(created.id);
    expect(newResult).toMatchObject({ requeuedBeforeProvider: 1, claimed: 1, sent: 1 });
    expect(oldWorkerSends).toBe(0);
    expect(newWorkerSends).toBe(1);
    expect(newCompletion.status).toBe("sent");
    expect(newCompletion.externalId).toBe("current-owner-send");
    expect(newCompletion.claimToken).toBeNull();
    expect(finalDelivery.status).toBe("sent");
    expect(finalDelivery.externalId).toBe("current-owner-send");
  });

  it.each(["accepted", "failed"] as const)(
    "prevents a stale provider owner from overwriting delivery_unknown with %s evidence",
    async (providerOutcome) => {
      let releaseProvider!: () => void;
      let markProviderStarted!: () => void;
      const providerStarted = new Promise<void>((resolve) => {
        markProviderStarted = resolve;
      });
      const providerRelease = new Promise<void>((resolve) => {
        releaseProvider = resolve;
      });
      const staleWorker = new NotificationService({
        emailSender: {
          isConfigured: () => true,
          sendEmail: async () => {
            markProviderStarted();
            await providerRelease;
            if (providerOutcome === "failed") {
              throw Object.assign(new Error("provider rejected after lease loss"), {
                statusCode: 503,
              });
            }
            return { skipped: false, provider: "brevo", messageId: "late-provider-acceptance" };
          },
        },
        emailDelivery: { leaseMs: 1_000 },
      });
      const recoveryWorker = new NotificationService({
        emailSender: {
          isConfigured: () => true,
          sendEmail: async () => {
            throw new Error("delivery_unknown must not be reclaimed");
          },
        },
        emailDelivery: { leaseMs: 1_000 },
      });
      const created = await staleWorker.createNotification({
        userId,
        type: "direct_connect_beta_request",
        title: `Late provider ${providerOutcome}`,
        message: "A stale owner cannot rewrite the recovery state.",
        scheduledFor: new Date(Date.now() + 60_000),
        deliveryMethods: ["email"],
      });
      await db
        .update(notifications)
        .set({ scheduledFor: new Date(0) })
        .where(eq(notifications.id, created.id));
      await db
        .update(notificationDeliveryLog)
        .set({ nextRetryAt: new Date(0) })
        .where(eq(notificationDeliveryLog.notificationId, created.id));

      const staleRun = staleWorker.processDueEmailDeliveries({
        notificationId: created.id,
        leaseMs: 1_000,
      });
      await providerStarted;
      const activeAttempt = await loadEmailDelivery(created.id);
      expect(activeAttempt.claimToken).toBeTruthy();
      expect(activeAttempt.externalResponse).toHaveProperty("providerAttemptStartedAt");
      await db
        .update(notificationDeliveryLog)
        .set({ updatedAt: new Date(Date.now() - 60_000) })
        .where(
          and(
            eq(notificationDeliveryLog.id, activeAttempt.id),
            eq(notificationDeliveryLog.claimToken, activeAttempt.claimToken)
          )
        );

      const recoveryResult = await recoveryWorker.processDueEmailDeliveries({
        notificationId: created.id,
        leaseMs: 1_000,
      });
      const recoveryState = await loadEmailDelivery(created.id);
      expect(recoveryResult).toMatchObject({ claimed: 0, terminal: 1 });
      expect(recoveryState.status).toBe("delivery_unknown");
      expect(recoveryState.claimToken).toBeNull();

      releaseProvider();
      await staleRun;
      const finalDelivery = await loadEmailDelivery(created.id);
      expect(finalDelivery.status).toBe("delivery_unknown");
      expect(finalDelivery.claimToken).toBeNull();
      expect(finalDelivery.externalId).toBeNull();
      expect(finalDelivery.errorCode).toBe("EMAIL_DELIVERY_OUTCOME_UNKNOWN");
      expect(finalDelivery.nextRetryAt).toBeNull();
    }
  );
});
