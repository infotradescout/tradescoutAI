import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import {
  notifications,
  notificationPreferences,
  notificationDeliveryLog,
  notificationJobs,
  users,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
  sendEmail: vi.fn(),
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
    type: "new_project_request",
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
          new_project_request: { enabled: true, delivery_methods: ["in_app", "email"] },
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
      [JSON.stringify({ new_project_request: preferences })]
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
