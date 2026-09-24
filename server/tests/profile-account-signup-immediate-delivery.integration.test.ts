import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { SQL } from "drizzle-orm";
import {
  users,
  notifications,
  notificationPreferences,
  notificationDeliveryLog,
  notificationJobs,
} from "@shared/schema";

const fixture = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
  sendEmail: vi.fn(),
  committed: false,
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
import { queueProfileAccountSignupNotifications } from "../services/profileAccountSignupNotifications";

const accountId = "00000000-0000-4000-8000-000000000177";
const service = new NotificationService();
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const rows = async (query: string) => (await fixture.database!.query<any>(query)).rows;

beforeAll(async () => {
  // Project the actual outbox models into disposable PGlite. The four
  // membership tables include only columns consumed by the producer SQL.
  const dialect = new PgDialect();
  const types: Record<string, string> = {
    boolean: "boolean", number: "integer", json: "jsonb", date: "timestamp", array: "text[]",
  };
  for (const table of [
    users, notifications, notificationPreferences, notificationDeliveryLog, notificationJobs,
  ]) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column) => {
      let defaultSql = "";
      if (column.default instanceof SQL) defaultSql = dialect.sqlToQuery(column.default).sql;
      else if (typeof column.default === "string")
        defaultSql = `'${column.default.replaceAll("'", "''")}'`;
      else if (typeof column.default === "boolean" || typeof column.default === "number")
        defaultSql = String(column.default);
      return `${quote(column.name)} ${types[column.dataType] || "text"}` +
        `${column.primary ? " PRIMARY KEY" : ""}${column.notNull ? " NOT NULL" : ""}` +
        `${defaultSql ? ` DEFAULT ${defaultSql}` : ""}`;
    });
    await fixture.database!.exec(`CREATE TABLE ${quote(config.name)} (${columns.join(", ")})`);
  }

  await fixture.database!.exec(`
    CREATE TABLE businesses (
      id text PRIMARY KEY, owner_user_id text, profile_data jsonb
    );
    CREATE TABLE profiles (
      id text PRIMARY KEY, slug text, owner_user_id text, business_id text
    );
    CREATE TABLE user_profiles (id text PRIMARY KEY, display_name text);
    CREATE TABLE profile_accounts (
      id uuid PRIMARY KEY, owner_user_id text, target_profile_id text,
      business_profile_id text, created_at timestamp, verification_status text,
      status text
    );
  `);

  await fixture.database!.query(
    `INSERT INTO users (id, email, first_name, last_name, email_verified)
     VALUES ('staff-owner', 'owner@example.test', 'Staff', 'Owner', true),
            ('staff-contact', 'contact@example.test', 'Staff', 'Contact', true),
            ('customer', 'customer@example.test', 'Sample', 'Buyer', true)`
  );
  await fixture.database!.query(
    `INSERT INTO businesses (id, owner_user_id, profile_data)
     VALUES ('jw-business', 'staff-owner', '{"notificationEmail":"contact@example.test"}'::jsonb)`
  );
  await fixture.database!.query(
    `INSERT INTO profiles (id, slug, owner_user_id, business_id)
     VALUES ('jw-profile', 'jw-stone', 'staff-owner', 'jw-business')`
  );
  await fixture.database!.query(
    `INSERT INTO user_profiles (id, display_name)
     VALUES ('customer-business', 'Sample Fabricator')`
  );
  await fixture.database!.query(
    `INSERT INTO profile_accounts (
       id, owner_user_id, target_profile_id, business_profile_id,
       created_at, verification_status, status
     ) VALUES ($1, 'customer', 'jw-profile', 'customer-business', NOW(), 'pending', 'active')`,
    [accountId]
  );
  vi.stubEnv("APP_URL", "https://www.thetradescout.com");
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture.database?.close();
});

describe("JW Stone signup SQL to immediate email handoff", () => {
  it("submits only the committed signup's staff jobs through the real outbox worker", async () => {
    fixture.sendEmail.mockImplementation(async () => {
      expect(fixture.committed).toBe(true);
      return { skipped: false, provider: "brevo", messageId: "synthetic-provider-receipt" };
    });

    await fixture.database!.exec("BEGIN");
    let committed = false;
    let jobIds: string[] = [];
    try {
      jobIds = await queueProfileAccountSignupNotifications(
        { query: fixture.database!.query.bind(fixture.database) } as any,
        accountId
      );
      expect(jobIds).toEqual([
        `notification-email:profile-account-signup:${accountId}:staff-contact`,
        `notification-email:profile-account-signup:${accountId}:staff-owner`,
      ]);
      expect(fixture.sendEmail).not.toHaveBeenCalled();
      expect(await rows("SELECT COUNT(*)::int AS count FROM notification_jobs"))
        .toEqual([{ count: 2 }]);
      await fixture.database!.exec("COMMIT");
      committed = true;
      fixture.committed = true;
    } finally {
      if (!committed) await fixture.database!.exec("ROLLBACK");
    }

    expect(await service.processEmailDeliveryJobsById(jobIds)).toBe(2);
    expect(fixture.sendEmail).toHaveBeenCalledTimes(2);
    expect(fixture.sendEmail.mock.calls.map(([mail]) => mail.to).sort()).toEqual([
      "contact@example.test", "owner@example.test",
    ]);
    expect(fixture.sendEmail.mock.calls.every(([mail]) =>
      mail.purpose === "jw_stone_signup_staff" && mail.singleAttempt === true
    )).toBe(true);
    expect(await rows("SELECT status FROM notification_jobs ORDER BY id"))
      .toEqual([{ status: "completed" }, { status: "completed" }]);
    expect(await service.processEmailDeliveryJobsById(jobIds)).toBe(0);
    expect(fixture.sendEmail).toHaveBeenCalledTimes(2);
  });
});
