import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixture = vi.hoisted(() => ({
  query: vi.fn(), release: vi.fn(), connect: vi.fn(),
  calls: [] as string[], existing: false, businessExists: true,
  slug: "jw-stone", queueFailure: false,
  receipt: { matched: 1, recipients: 2, notifications: 2, email_jobs: 2, in_app_receipts: 2 },
}));
vi.mock("../db", () => ({ pool: { connect: fixture.connect, query: fixture.query } }));
vi.mock("@shared/profileAccount", () => ({
  buildProfileAccountReturnPath: (slug: string) => `/u/${slug}?profileAccount=1`,
  resolveProfileAccountPolicy: ({ profileSlug }: { profileSlug: string }) => ({
    enabled: true, requiredIdentity: "business", priorityKey: profileSlug, includesBidRock: false,
  }),
}));

import { ensureProfileAccount } from "../services/profileAccountService";
import {
  PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL,
  queueProfileAccountSignupNotifications,
} from "../services/profileAccountSignupNotifications";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.calls = [];
  fixture.existing = false;
  fixture.businessExists = true;
  fixture.slug = "jw-stone";
  fixture.queueFailure = false;
  fixture.receipt = { matched: 1, recipients: 2, notifications: 2, email_jobs: 2, in_app_receipts: 2 };
  fixture.connect.mockResolvedValue({ query: fixture.query, release: fixture.release });
  fixture.query.mockImplementation(async (sql: string) => {
    fixture.calls.push(sql);
    if (sql === PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL) {
      if (fixture.queueFailure) throw new Error("outbox unavailable");
      return { rows: [fixture.receipt] };
    }
    if (sql.includes("FROM profiles p")) return { rows: [{
      profile_id: "target-profile", profile_slug: fixture.slug, profile_name: "JW Stone",
      business_id: "target-business", content_blocks: [], profile_priority_config: {},
    }] };
    if (sql.includes("SELECT id FROM users")) return { rows: [{ id: "signup-user" }] };
    if (sql.includes("SELECT id FROM profile_accounts")) {
      return { rows: fixture.existing ? [{ id: "account-id" }] : [] };
    }
    if (sql.includes("FROM user_profiles") && !sql.includes("INSERT INTO user_profiles")) {
      return { rows: fixture.businessExists ? [{
        id: "customer-business", display_name: "Sample Fabricator", verification_status: "pending",
      }] : [] };
    }
    if (sql.includes("INSERT INTO user_profiles")) return { rows: [{
      id: "customer-business", display_name: "Sample Fabricator", verification_status: "pending",
    }] };
    if (sql.includes("INSERT INTO profile_accounts")) return { rows: [{
      id: "account-id", identity_kind: "business", business_profile_id: "customer-business",
      priority_key: fixture.slug, status: "active", verification_status: "pending",
      resume_path: `/u/${fixture.slug}?profileAccount=1`, last_seen_at: "2026-09-22T18:40:29Z",
    }] };
    return { rows: [] };
  });
});

const join = () => ensureProfileAccount({
  userId: "signup-user", profileSlug: fixture.slug, businessName: "Sample Fabricator",
});
const queued = () => fixture.calls.filter(sql => sql === PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL);

describe("JW Stone staff signup notification producer", () => {
  it("queues both channel intents before COMMIT on the same connection", async () => {
    await join();
    expect(queued()).toHaveLength(1);
    expect(fixture.calls.indexOf(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL))
      .toBeLessThan(fixture.calls.indexOf("COMMIT"));
    expect(fixture.connect).toHaveBeenCalledTimes(1);
    expect(fixture.release).toHaveBeenCalledOnce();
    expect(fixture.query).toHaveBeenCalledWith(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL, ["account-id"]);
  });
  it("also notifies when registration creates a new private business identity", async () => {
    fixture.businessExists = false;
    await join();
    expect(fixture.calls.some(sql => sql.includes("INSERT INTO user_profiles"))).toBe(true);
    expect(queued()).toHaveLength(1);
  });
  it("notifies for a new relationship even while business verification is pending", async () => {
    const result = await join();
    expect(result.account.verificationStatus).toBe("pending");
    expect(queued()).toHaveLength(1);
  });
  it("does not send signup alerts again on existing membership sign-in or reload", async () => {
    fixture.existing = true;
    await join();
    expect(queued()).toHaveLength(0);
    expect(fixture.calls).toContain("COMMIT");
  });
  it("does not enroll ISSA Build or other profiles in JW Stone alerts", async () => {
    fixture.slug = "issa-build";
    await join();
    expect(queued()).toHaveLength(0);
    expect(fixture.calls.some(sql => sql.includes("SELECT id FROM profile_accounts"))).toBe(false);
  });
  it("locks the joining identity before deciding whether the relationship is new", async () => {
    await join();
    const lock = fixture.calls.findIndex(sql => sql.includes("SELECT id FROM users") && sql.includes("FOR UPDATE"));
    const check = fixture.calls.findIndex(sql => sql.includes("SELECT id FROM profile_accounts"));
    expect(lock).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(lock);
  });
  it("rolls back a new membership rather than silently losing its staff alert", async () => {
    fixture.queueFailure = true;
    await expect(join()).rejects.toThrow("outbox unavailable");
    expect(fixture.calls).toContain("ROLLBACK");
    expect(fixture.calls).not.toContain("COMMIT");
    expect(fixture.release).toHaveBeenCalledOnce();
  });
  it("does not make returning members depend on the new notification producer", async () => {
    fixture.existing = true;
    fixture.queueFailure = true;
    await expect(join()).resolves.toHaveProperty("account.id", "account-id");
    expect(queued()).toHaveLength(0);
  });
  it("rejects a missing account identifier before querying", async () => {
    await expect(queueProfileAccountSignupNotifications({ query: fixture.query } as any, " "))
      .rejects.toThrow("identity is required");
    expect(fixture.query).not.toHaveBeenCalled();
  });
  it("passes the identifier as a parameter, never interpolated SQL", async () => {
    const identifier = "quote' ; SELECT 1; --";
    await queueProfileAccountSignupNotifications({ query: fixture.query } as any, identifier);
    expect(fixture.query).toHaveBeenCalledWith(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL, [identifier]);
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).not.toContain(identifier);
  });
  it("fails the transaction when a JW signup has no staff recipient", async () => {
    fixture.receipt = { matched: 1, recipients: 0, notifications: 0, email_jobs: 0, in_app_receipts: 0 };
    await expect(join()).rejects.toThrow("recipient is unavailable");
    expect(fixture.calls).toContain("ROLLBACK");
  });
  it("accepts a deduplicated replay without resetting any prior job", async () => {
    fixture.receipt = { matched: 1, recipients: 2, notifications: 0, email_jobs: 0, in_app_receipts: 0 };
    await expect(queueProfileAccountSignupNotifications({ query: fixture.query } as any, "account-id"))
      .resolves.toBeUndefined();
  });
  it("rejects incomplete channel receipts", async () => {
    fixture.receipt.email_jobs = 1;
    await expect(join()).rejects.toThrow("channel intents are incomplete");
    expect(fixture.calls).not.toContain("COMMIT");
  });
  it("only uses canonical owners or the verified configured notification contact", () => {
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("r.id = s.profile_owner_id");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("r.id = s.business_owner_id");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("r.email_verified = true");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("lower(trim(s.notification_email))");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).not.toContain("'super_admin'");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("p.slug = 'jw-stone'");
  });
  it("preserves the existing durable email worker's identity and retry contract", () => {
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("'notification-email:' || id");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("'notification_email_v1'");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).toContain("jsonb_build_object('notificationId', id)");
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL.match(/ON CONFLICT \(id\) DO NOTHING/g)).toHaveLength(3);
    expect(PROFILE_ACCOUNT_SIGNUP_NOTIFICATION_SQL).not.toContain("DO UPDATE");
  });
  it("both registration and authenticated join continue using the same producer", () => {
    const routes = readFileSync(resolve(process.cwd(), "server/routes/profile-accounts.ts"), "utf8");
    expect(routes.match(/await ensureProfileAccount\(/g)?.length).toBe(2);
    expect(routes).toContain('"/api/profile-accounts/register"');
    expect(routes).toContain('"/api/u/:slug/account"');
  });
});
