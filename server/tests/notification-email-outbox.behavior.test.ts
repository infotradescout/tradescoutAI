import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import {
  notifications,
  notificationPreferences,
  notificationDeliveryLog,
  notificationJobs,
  users,
  workRequests,
  workRequestAssignments,
  workRequestEvents,
  contractors,
  businesses,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
  sendEmail: vi.fn(),
  eligible: vi.fn(),
}));
vi.mock("../db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.database = new PGlite();
  return { db: drizzle(fixture.database) };
});
vi.mock("../services/emailService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/emailService")>();
  return { ...original, emailService: { sendEmail: fixture.sendEmail } };
});
import { NotificationService } from "../notification-service";
import { EmailDeliveryError } from "../services/emailService";

const service = new NotificationService();
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const rows = async (query: string, params: any[] = []) =>
  (await fixture.database!.query<any>(query, params)).rows;
const jobs = () => rows("SELECT * FROM notification_jobs ORDER BY id");
const emailLogs = () =>
  rows(
    "SELECT * FROM notification_delivery_log WHERE delivery_method = 'email' ORDER BY created_at"
  );

beforeAll(async () => {
  // Disposable PostgreSQL projection with the real schema defaults, primary
  // keys, and required columns. This runs the actual queue SQL/transactions;
  // it is not proof of the deployed schema or multi-process PostgreSQL locks.
  const dialect = new PgDialect();
  const types: Record<string, string> = {
    boolean: "boolean",
    number: "integer",
    json: "jsonb",
    date: "timestamp",
    array: "text[]",
  };
  for (const table of [
    users,
    notifications,
    notificationPreferences,
    notificationDeliveryLog,
    notificationJobs,
    workRequests,
    workRequestAssignments,
    workRequestEvents,
    contractors,
    businesses,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      let defaultSql = "";
      if (column.default instanceof SQL) defaultSql = dialect.sqlToQuery(column.default).sql;
      else if (typeof column.default === "string")
        defaultSql = `'${column.default.replaceAll("'", "''")}'`;
      else if (typeof column.default === "boolean" || typeof column.default === "number")
        defaultSql = String(column.default);
      return `${quote(column.name)} ${types[column.dataType] || "text"}${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}${defaultSql ? ` DEFAULT ${defaultSql}` : ""}`;
    });
    await fixture.database!.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
  }
});

beforeEach(async () => {
  await fixture.database!.exec(
    "TRUNCATE notification_delivery_log, notification_jobs, notifications, notification_preferences, users"
  );
  await fixture.database!.exec(
    "TRUNCATE work_requests, work_request_assignments, work_request_events, contractors, businesses"
  );
  fixture.eligible.mockReset().mockResolvedValue(true);
  service.configureDirectConnectEmailEligibility(fixture.eligible);
  await fixture.database!.query(
    "INSERT INTO users (id, email, first_name) VALUES ('owner', 'owner@example.com', '<Owner>')"
  );
  fixture.sendEmail
    .mockReset()
    .mockResolvedValue({ skipped: false, provider: "brevo", messageId: "provider-123" });
  vi.stubEnv("APP_URL", "https://www.thetradescout.com");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture.database?.close();
});

async function create(overrides: Record<string, any> = {}) {
  return service.createNotification({
    userId: "owner",
    type: "dc_provider_accepted",
    title: "Call 555-123-4567",
    message: "Private request from buyer@example.com",
    deliveryMethods: ["in_app", "email"],
    actionUrl: "/direct-connect/inbox",
    ...overrides,
  });
}

describe("durable notification email outbox", () => {
  it("binds preference creation and updates to the authenticated owner", async () => {
    const created = await service.updateUserPreferences("owner", {
      userId: "different-user",
      enableEmailNotifications: false,
    });
    expect(created.userId).toBe("owner");
    const updated = await service.updateUserPreferences("owner", {
      userId: "different-user",
      enableEmailNotifications: true,
    });
    expect(updated.userId).toBe("owner");
    expect(await service.getUserPreferences("different-user")).toBeNull();
  });

  it("atomically saves intent and deduplicates repeated dispatch by notification id", async () => {
    const notification = await create();
    await Promise.all([
      service.sendNotification(notification.id),
      service.sendNotification(notification.id),
    ]);
    expect(await jobs()).toHaveLength(1);
    expect(fixture.sendEmail).not.toHaveBeenCalled();
    expect(await service.processEmailDeliveryJobs()).toBe(1);
    expect((await jobs())[0]).toMatchObject({
      status: "completed",
      retry_count: 1,
      success_count: 1,
    });
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("rolls back the inbox insert when durable intent cannot be persisted", async () => {
    await fixture.database!.exec(
      "ALTER TABLE notification_jobs ADD CONSTRAINT reject_fixture CHECK (job_type <> 'notification_email_v1')"
    );
    try {
      await expect(create()).rejects.toThrow();
      expect(await rows("SELECT id FROM notifications")).toEqual([]);
    } finally {
      await fixture.database!.exec("ALTER TABLE notification_jobs DROP CONSTRAINT reject_fixture");
    }
  });

  it("persists provider acceptance and message id without claiming mailbox delivery", async () => {
    await create();
    await service.processEmailDeliveryJobs();
    expect((await emailLogs())[0]).toMatchObject({
      status: "accepted",
      external_id: "provider-123",
      delivered_at: null,
      contact_info: "o***@example.com",
    });
    expect((await emailLogs())[0].sent_at).toBeTruthy();
    const payload = fixture.sendEmail.mock.calls[0][0];
    expect(payload).toMatchObject({
      purpose: "notification",
      singleAttempt: true,
      subject: "Direct Connect update",
    });
    expect(payload.html).toContain('href="https://www.thetradescout.com/direct-connect/inbox"');
    expect(payload.html).not.toContain("555-123-4567");
    expect(payload.html).not.toContain("buyer@example.com");
    expect(payload.text).not.toContain("buyer@example.com");
    expect(payload).not.toHaveProperty("replyTo");
  });

  it("keeps in-app-only oversight in app despite broad type preferences", async () => {
    await fixture.database!.query(
      "INSERT INTO notification_preferences (user_id, type_preferences) VALUES ('owner', $1::jsonb)",
      [
        JSON.stringify({
          dc_provider_accepted: { enabled: true, delivery_methods: ["in_app", "email"] },
        }),
      ]
    );
    await create({ deliveryMethods: ["in_app"] });
    await service.processEmailDeliveryJobs();
    expect(await jobs()).toEqual([]);
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["enable_notifications", "enable_email_notifications"])(
    "rechecks %s immediately before provider submission",
    async (column) => {
      await create();
      await fixture.database!.exec(
        `INSERT INTO notification_preferences (user_id, ${column}) VALUES ('owner', false)`
      );
      await service.processEmailDeliveryJobs();
      expect((await jobs())[0].status).toBe("cancelled");
      expect(fixture.sendEmail).not.toHaveBeenCalled();
    }
  );

  it.each([
    { enabled: false, delivery_methods: ["email"] },
    { enabled: true, delivery_methods: ["in_app"] },
  ])("honors per-type opt-outs after enqueue: %j", async (preferences) => {
    await create();
    await fixture.database!.query(
      "INSERT INTO notification_preferences (user_id, type_preferences) VALUES ('owner', $1::jsonb)",
      [JSON.stringify({ dc_provider_accepted: preferences })]
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["expired", "archived", "missing", "wrong_recipient"])(
    "cancels %s work before sending",
    async (state) => {
      await create();
      if (state === "expired")
        await fixture.database!.exec(
          "UPDATE notifications SET expires_at = NOW() - INTERVAL '1 hour'"
        );
      if (state === "archived")
        await fixture.database!.exec("UPDATE notifications SET is_archived = true");
      if (state === "missing") await fixture.database!.exec("DELETE FROM notifications");
      if (state === "wrong_recipient")
        await fixture.database!.exec(
          `UPDATE notification_jobs SET target_user_ids = '["different-user"]'::jsonb`
        );
      await service.processEmailDeliveryJobs();
      expect((await jobs())[0].status).toBe("cancelled");
      expect(fixture.sendEmail).not.toHaveBeenCalled();
    }
  );

  it("does not send scheduled work early and resumes it from a fresh service", async () => {
    await create({ scheduledFor: new Date(Date.now() + 86_400_000) });
    expect(await service.processEmailDeliveryJobs()).toBe(0);
    await fixture.database!.exec(
      "UPDATE notification_jobs SET scheduled_for = NOW() - INTERVAL '1 minute'"
    );
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).not.toHaveBeenCalled();
    expect((await jobs())[0].retry_count).toBe(0);
    await fixture.database!.exec(
      "UPDATE notification_jobs SET scheduled_for = NOW() - INTERVAL '1 minute'; UPDATE notifications SET scheduled_for = NOW() - INTERVAL '1 minute'"
    );
    expect(await new NotificationService().processEmailDeliveryJobs()).toBe(1);
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("queues bulk email intent in the same database owner", async () => {
    await service.sendBulkNotification(["owner"], {
      type: "system_update",
      title: "Update",
      message: "Update",
      deliveryMethods: ["email"],
    });
    expect(await jobs()).toHaveLength(1);
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate a send when two service instances claim concurrently", async () => {
    await create();
    await Promise.all([
      service.processEmailDeliveryJobs(),
      new NotificationService().processEmailDeliveryJobs(),
    ]);
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("backs off known rate-limit rejection and stops after five attempts", async () => {
    await create();
    fixture.sendEmail.mockRejectedValue(new EmailDeliveryError("retryable"));
    for (let attempt = 1; attempt <= 5; attempt++) {
      await service.processEmailDeliveryJobs();
      const [job] = await jobs();
      expect(job.retry_count).toBe(attempt);
      expect(job.status).toBe(attempt < 5 ? "retry" : "failed");
      if (attempt < 5) {
        expect(new Date(job.next_retry_at).getTime()).toBeGreaterThan(Date.now());
        expect(await service.processEmailDeliveryJobs()).toBe(0);
        await fixture.database!.exec(
          "UPDATE notification_jobs SET next_retry_at = NOW() - INTERVAL '1 minute'"
        );
      }
    }
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).toHaveBeenCalledTimes(5);
  });

  it.each(["unknown", "rejected"] as const)(
    "never automatically resends a %s outcome",
    async (disposition) => {
      await create();
      fixture.sendEmail.mockRejectedValue(new EmailDeliveryError(disposition));
      await service.processEmailDeliveryJobs();
      await service.processEmailDeliveryJobs();
      expect((await jobs())[0].status).toBe(disposition === "unknown" ? "unknown" : "failed");
      expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
    }
  );

  it("does not send again after receipt persistence fails following provider acceptance", async () => {
    await create();
    await fixture.database!.exec(
      "ALTER TABLE notification_delivery_log ADD CONSTRAINT reject_receipt CHECK (delivery_method <> 'email')"
    );
    try {
      await expect(service.processEmailDeliveryJobs()).rejects.toThrow();
      expect((await jobs())[0].status).toBe("running");
    } finally {
      await fixture.database!.exec(
        "ALTER TABLE notification_delivery_log DROP CONSTRAINT reject_receipt"
      );
    }
    await fixture.database!.exec(
      "UPDATE notification_jobs SET started_at = NOW() - INTERVAL '11 minutes'"
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("unknown");
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("never logs a configured-provider skip as acceptance", async () => {
    await create();
    fixture.sendEmail.mockResolvedValue({
      skipped: true,
      provider: "none",
      skippedReason: "provider_not_configured",
    });
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("retry");
    expect((await emailLogs())[0]).toMatchObject({
      status: "retry",
      sent_at: null,
      delivered_at: null,
    });
  });

  it("honors the existing account-only email policy without retrying suppressed mail", async () => {
    await create();
    fixture.sendEmail.mockResolvedValue({
      skipped: true,
      provider: "brevo",
      skippedReason: "email_mode_suppressed",
    });
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect((await emailLogs())[0].sent_at).toBeNull();
  });

  it("escapes untrusted HTML and rejects non-platform action links", async () => {
    await create({
      type: "system_update",
      title: "<script>alert(1)</script>",
      message: "<img src=x onerror=alert(1)>",
      actionUrl: "https://attacker.example/collect",
      actionText: "<svg onload=alert(1)>",
    });
    await service.processEmailDeliveryJobs();
    const html = fixture.sendEmail.mock.calls[0][0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("attacker.example");
    expect(html).toContain("&lt;Owner&gt;");
  });
});

async function seedProviderInvitation(kind: "contractor" | "business" = "contractor") {
  await fixture.database!.exec(`
    UPDATE users SET email_verified = true;
    INSERT INTO work_requests (id, created_by_user_id, source, status, title, description, attachments, county_fips)
      VALUES ('request-1', 'requester', 'direct_connect', 'routed', 'Private 555-123-4567', 'Private details', '[]', '12001');
    INSERT INTO contractors (id, user_id, company_name, slug) VALUES ('contractor-1', 'owner', 'Fixture', 'fixture');
    INSERT INTO businesses (id, owner_user_id, name, slug, role_context) VALUES ('business-1', 'owner', 'Fixture', 'fixture', 'business_owner');
    INSERT INTO notification_preferences (user_id, enable_notifications, enable_email_notifications, type_preferences)
      VALUES ('owner', true, true, '{"new_project_request":{"enabled":true,"delivery_methods":["in_app","email"]}}');
  `);
  await fixture.database!.query(
    "INSERT INTO work_request_assignments (id, work_request_id, contractor_id, responder_user_id, status, created_at) VALUES ('assignment-1', 'request-1', $1, $2, 'invited', '2026-09-01')",
    [kind === "contractor" ? "contractor-1" : null, kind === "business" ? "owner" : null]
  );
  await fixture.database!.query(
    "INSERT INTO work_request_events (id, work_request_id, actor_user_id, type, metadata, created_at) VALUES ('event-1', 'request-1', 'requester', 'provider_invited', $1, '2026-09-02')",
    [
      JSON.stringify({
        source: "direct_connect",
        ...(kind === "contractor"
          ? { contractorId: "contractor-1", contractorUserId: "owner" }
          : { businessId: "business-1", responderUserId: "owner" }),
      }),
    ]
  );
}

function notifyProvider() {
  return service.createAssignedProviderNotification(
    {
      userId: "owner",
      type: "new_project_request",
      title: "Private 555-123-4567",
      message: "Private buyer@example.com",
      deliveryMethods: ["in_app", "push"],
      actionUrl: "/direct-connect/inbox",
    },
    "request-1"
  );
}

describe("normal Direct Connect provider email activation", () => {
  it("recovers same-event enrollment after transient eligibility failure without repeating inbox delivery", async () => {
    await seedProviderInvitation();
    fixture.eligible.mockRejectedValueOnce(new Error("Temporary lookup failure"));
    const first = await notifyProvider();
    expect(first.metadata?.directConnectProviderEmailDeferred).toBe(true);
    expect(await jobs()).toEqual([]);
    expect((await notifyProvider()).id).toBe(first.id);
    expect(await rows("SELECT id FROM notifications")).toHaveLength(1);
    expect(
      await rows("SELECT id FROM notification_delivery_log WHERE delivery_method = 'in_app'")
    ).toHaveLength(1);
    expect(await jobs()).toHaveLength(1);
    await service.processEmailDeliveryJobs();
    await notifyProvider();
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not backfill an old event when the recipient opts in later", async () => {
    await seedProviderInvitation();
    await fixture.database!.exec(
      "UPDATE notification_preferences SET enable_email_notifications = false"
    );
    const first = await notifyProvider();
    expect(first.metadata?.directConnectProviderEmailDeferred).toBe(false);
    await fixture.database!.exec(
      "UPDATE notification_preferences SET enable_email_notifications = true"
    );
    expect((await notifyProvider()).id).toBe(first.id);
    expect(await jobs()).toEqual([]);
  });

  it("preserves terminal job identity when recovering deferred enrollment", async () => {
    await seedProviderInvitation();
    fixture.eligible.mockRejectedValueOnce(new Error("Temporary lookup failure"));
    const first = await notifyProvider();
    await fixture.database!.query(
      "INSERT INTO notification_jobs (id, job_type, scheduled_for, notification_type, status, template_data, retry_count) VALUES ($1, 'notification_email_v1', NOW(), 'new_project_request', 'unknown', $2, 1)",
      [`notification-email:${first.id}`, JSON.stringify({ notificationId: first.id })]
    );
    await notifyProvider();
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0]).toMatchObject({ status: "unknown", retry_count: 1 });
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    "UPDATE work_request_assignments SET status = 'withdrawn'",
    "UPDATE notification_preferences SET enable_email_notifications = false",
    "UPDATE users SET email_verified = false",
    "UPDATE users SET email = 'changed@example.com'",
  ])(
    "honors revocation committed during asynchronous eligibility validation: %s",
    async (mutation) => {
      await seedProviderInvitation();
      await notifyProvider();
      fixture.eligible.mockImplementationOnce(async () => {
        await fixture.database!.exec(mutation);
        return true;
      });
      await service.processEmailDeliveryJobs();
      expect((await jobs())[0].status).toBe("cancelled");
      expect(fixture.sendEmail).not.toHaveBeenCalled();
    }
  );

  it("keeps malformed legacy preferences in app and cancels malformed preferences introduced after enqueue", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    await fixture.database!.exec(
      `UPDATE notification_preferences SET type_preferences = '{"new_project_request":{"enabled":true,"delivery_methods":"email"}}'`
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
    await fixture.database!.exec(
      "DELETE FROM notification_delivery_log; DELETE FROM notification_jobs; DELETE FROM notifications"
    );
    expect((await notifyProvider()).deliveryMethods).not.toContain("email");
    expect(await jobs()).toEqual([]);
  });

  it("retries a transient validation failure before submission and later sends once", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    fixture.eligible.mockRejectedValueOnce(
      new Error("Eligibility database temporarily unavailable")
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0]).toMatchObject({ status: "retry", retry_count: 1 });
    expect(fixture.sendEmail).not.toHaveBeenCalled();
    await fixture.database!.exec(
      "UPDATE notification_jobs SET next_retry_at = NOW() - INTERVAL '1 minute'"
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0]).toMatchObject({ status: "completed", retry_count: 2 });
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("recovers an interrupted validation lease without treating it as an uncertain submission", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    await fixture.database!.exec(
      "UPDATE notification_jobs SET status = 'validating', started_at = NOW() - INTERVAL '11 minutes', retry_count = 1"
    );
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("retry");
    await fixture.database!.exec(
      "UPDATE notification_jobs SET next_retry_at = NOW() - INTERVAL '1 minute'"
    );
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not submit using a validation lease that another worker has replaced", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    fixture.eligible.mockImplementationOnce(async () => {
      await fixture.database!.exec(
        `UPDATE notification_jobs SET template_data = template_data || '{"leaseId":"different-lease"}'::jsonb`
      );
      return true;
    });
    await service.processEmailDeliveryJobs();
    expect(fixture.sendEmail).not.toHaveBeenCalled();
    expect((await jobs())[0].status).toBe("validating");
  });

  it("preserves in-app notification creation when provider context lookup is unavailable", async () => {
    await seedProviderInvitation();
    await fixture.database!.exec("ALTER TABLE work_request_events RENAME TO unavailable_events");
    try {
      const notification = await notifyProvider();
      expect(notification.deliveryMethods).toEqual(["in_app", "push"]);
      expect(await rows("SELECT id FROM notifications")).toHaveLength(1);
      expect(await jobs()).toEqual([]);
    } finally {
      await fixture.database!.exec("ALTER TABLE unavailable_events RENAME TO work_request_events");
    }
  });

  it("fails closed when the canonical eligibility validator was not registered", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    await new NotificationService().processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["contractor", "business"] as const)(
    "enrolls an explicitly consenting verified %s once per persisted event",
    async (kind) => {
      await seedProviderInvitation(kind);
      const notification = await notifyProvider();
      expect((await notifyProvider()).id).toBe(notification.id);
      expect(await rows("SELECT id FROM notifications")).toHaveLength(1);
      expect(await jobs()).toHaveLength(1);
      expect(notification.metadata?.directConnectProviderEmail).toEqual({
        requestId: "request-1",
        assignmentId: "assignment-1",
        eventId: "event-1",
      });
      await service.processEmailDeliveryJobs();
      expect(fixture.sendEmail).toHaveBeenCalledTimes(1);
      expect(fixture.sendEmail.mock.calls[0][0]).toMatchObject({
        purpose: "notification",
        subject: "Direct Connect update",
      });
      expect(fixture.sendEmail.mock.calls[0][0].html).not.toMatch(/555-123-4567|buyer@example.com/);
      expect(fixture.eligible).toHaveBeenCalledTimes(3);
      expect(fixture.eligible.mock.lastCall?.[0].request.countyFips).toBe("12001");
    }
  );

  it.each([
    "UPDATE users SET email_verified = false",
    "DELETE FROM notification_preferences",
    "UPDATE notification_preferences SET type_preferences = '{}'",
    "UPDATE notification_preferences SET enable_email_notifications = false",
    'UPDATE notification_preferences SET type_preferences = \'{"new_project_request":{"enabled":true,"delivery_methods":["in_app"]}}\'',
  ])("requires explicit consent before queue enrollment: %s", async (mutation) => {
    await seedProviderInvitation();
    await fixture.database!.exec(mutation);
    const notification = await notifyProvider();
    expect(notification.deliveryMethods).toEqual(["in_app", "push"]);
    expect(await jobs()).toEqual([]);
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    "UPDATE users SET email_verified = false",
    "UPDATE notification_preferences SET type_preferences = '{}'",
    "UPDATE work_request_assignments SET status = 'withdrawn'",
    "UPDATE work_request_assignments SET status = 'accepted'",
    "UPDATE work_requests SET status = 'cancelled'",
    "UPDATE contractors SET user_id = 'new-owner'",
    "UPDATE work_request_events SET actor_user_id = 'operator'",
    'UPDATE work_request_events SET metadata = metadata || \'{"source":"direct_connect_admin"}\'::jsonb',
    "DELETE FROM work_request_events",
    "UPDATE work_request_events SET id = 'different-event'",
    "INSERT INTO work_request_events SELECT 'event-2', work_request_id, type, actor_user_id, from_status, to_status, metadata, created_at FROM work_request_events",
    'UPDATE notifications SET metadata = \'{"directConnectProviderEmail":{"requestId":"wrong-request","assignmentId":"assignment-1","eventId":"event-1"}}\'',
  ])("cancels stale or misbound invitations at drain: %s", async (mutation) => {
    await seedProviderInvitation();
    await notifyProvider();
    await fixture.database!.exec(mutation);
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it("rechecks the canonical eligibility validator with current provider and request rows", async () => {
    await seedProviderInvitation();
    await notifyProvider();
    await fixture.database!.exec(
      "UPDATE work_requests SET county_fips = '12003'; UPDATE contractors SET verified_licensed = false"
    );
    fixture.eligible.mockResolvedValue(false);
    await service.processEmailDeliveryJobs();
    expect(fixture.eligible.mock.lastCall?.[0]).toMatchObject({
      request: { countyFips: "12003" },
      contractor: { verifiedLicensed: false },
    });
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });

  it("does not enroll email for ambiguous assignments, staff invitations, or unsupported workers", async () => {
    await seedProviderInvitation();
    await fixture.database!.exec(
      'UPDATE work_request_events SET metadata = metadata || \'{"routeMode":"admin_manual"}\'::jsonb'
    );
    expect((await notifyProvider()).deliveryMethods).not.toContain("email");
    await fixture.database!.exec(
      "UPDATE work_request_events SET metadata = metadata - 'routeMode'; UPDATE work_request_assignments SET worker_id = 'worker-1'"
    );
    expect((await notifyProvider()).deliveryMethods).not.toContain("email");
    await fixture.database!.exec(
      "UPDATE work_request_assignments SET worker_id = NULL; INSERT INTO work_request_assignments (id, work_request_id, contractor_id, status) VALUES ('another-assignment', 'request-1', 'contractor-1', 'declined')"
    );
    expect((await notifyProvider()).deliveryMethods).not.toContain("email");
    expect(await jobs()).toEqual([]);
  });

  it("does not silently turn staff oversight or unbound new-request notifications into email", async () => {
    await seedProviderInvitation();
    await service.createNotification({
      userId: "owner",
      type: "new_project_request",
      title: "Staff oversight",
      message: "Staff only",
      deliveryMethods: ["in_app"],
    });
    expect(await jobs()).toEqual([]);
    await service.createNotification({
      userId: "owner",
      type: "new_project_request",
      title: "Unbound",
      message: "Unbound",
      deliveryMethods: ["email"],
    });
    await service.processEmailDeliveryJobs();
    expect((await jobs())[0].status).toBe("cancelled");
    expect(fixture.sendEmail).not.toHaveBeenCalled();
  });
});
