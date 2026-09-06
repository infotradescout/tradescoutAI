import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ pool: { query: vi.fn() }, db: {} }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: vi.fn(),
  hasStoneInventoryCapability: vi.fn(),
}));

import { ensureProfileAccountEntitlement } from "../services/profileAccountEntitlementService";
import { hasActiveJwStoneBusinessMembership } from "../services/jwStonePricingAccess";

const migrationSql = readFileSync(
  "migrations/0131_preserve_jw_stone_pricing_revocation.sql",
  "utf8"
);

const fixtureSql = `
  CREATE TABLE profiles (id text, slug text, business_id text);
  CREATE TABLE user_profiles (
    id text, user_id text, user_intent text, verification_status text
  );
  CREATE TABLE profile_accounts (
    id uuid, owner_user_id text, target_profile_id text, target_business_id text,
    business_profile_id text, identity_kind text, status text, verification_status text,
    updated_at timestamp default now()
  );
  CREATE TABLE profile_account_entitlements (
    profile_account_id uuid, product_key text, status text,
    created_at timestamp default now(), updated_at timestamp default now(),
    PRIMARY KEY (profile_account_id, product_key)
  );
  INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
  INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
  INSERT INTO profile_accounts VALUES (
    '00000000-0000-4000-8000-000000000131', 'member', 'jw-profile', 'jw-business', 'member-business',
    'business', 'active', 'pending', now()
  );
  INSERT INTO profile_account_entitlements VALUES (
    '00000000-0000-4000-8000-000000000131', 'jw_stone_member_pricing',
    'pending_verification', now(), now()
  );
  INSERT INTO profile_account_entitlements VALUES (
    '00000000-0000-4000-8000-000000000131', 'bidrock',
    'pending_verification', now(), now()
  );
`;

describe("JW Stone membership activation against actual SQL", () => {
  let database: PGlite;
  const access = () => hasActiveJwStoneBusinessMembership("member", database as never);

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(fixtureSql);
    await database.exec(migrationSql);
  });

  afterEach(async () => database.close());

  it("unlocks prices on business membership creation without another verification gate", async () => {
    expect(await access()).toBe(true);
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    expect(await access()).toBe(true);
    const account = await database.query("SELECT verification_status FROM profile_accounts");
    expect(account.rows[0]).toEqual({ verification_status: "approved" });
  });

  it.each(["pending", "under_review", "approved", "expired"])(
    "keeps an active JW membership priced while business verification is %s",
    async (status) => {
      await database.query("UPDATE user_profiles SET verification_status = $1", [status]);
      expect(await access()).toBe(true);
      const entitlements = await database.query(
        "SELECT product_key, status FROM profile_account_entitlements ORDER BY product_key"
      );
      expect(entitlements.rows).toEqual([
        {
          product_key: "bidrock",
          status: status === "approved" ? "active" : "pending_verification",
        },
        { product_key: "jw_stone_member_pricing", status: "pending_verification" },
      ]);
    }
  );

  it.each(["suspended", "revoked"])(
    "preserves an explicitly %s pricing entitlement",
    async (status) => {
      await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
      await database.query("UPDATE profile_account_entitlements SET status = $1", [status]);
      expect(await access()).toBe(false);
    }
  );

  it.each(["suspended", "closed"])("blocks a %s JW Stone membership", async (status) => {
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    await database.query("UPDATE profile_accounts SET status = $1", [status]);
    expect(await access()).toBe(false);
  });

  it("removes pricing when the business identity is explicitly rejected", async () => {
    await database.exec(`
      UPDATE profile_accounts SET verification_status = 'approved';
      UPDATE profile_account_entitlements SET status = 'active';
      UPDATE user_profiles SET verification_status = 'approved';
    `);
    expect(await access()).toBe(true);
    await database.exec("UPDATE user_profiles SET verification_status = 'rejected'");
    expect(await access()).toBe(false);
  });

  it("removes pricing when the business identity is explicitly suspended", async () => {
    await database.exec("UPDATE user_profiles SET verification_status = 'suspended'");
    expect(await access()).toBe(false);
  });

  it("does not reactivate an explicitly revoked price entitlement on account retry", async () => {
    await database.exec(
      "UPDATE profile_account_entitlements SET status = 'revoked' WHERE product_key = 'jw_stone_member_pricing'"
    );
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    const entitlement = await ensureProfileAccountEntitlement(
      {
        profileAccountId: "00000000-0000-4000-8000-000000000131",
        productKey: "jw_stone_member_pricing",
        verificationStatus: "not_required",
      },
      database as never
    );
    expect(entitlement.status).toBe("revoked");
    expect(await access()).toBe(false);
  });

  it("reactivates a verification-derived BidRock revocation after approval", async () => {
    await database.exec(
      "UPDATE profile_account_entitlements SET status = 'revoked' WHERE product_key = 'bidrock'"
    );
    const entitlement = await ensureProfileAccountEntitlement(
      {
        profileAccountId: "00000000-0000-4000-8000-000000000131",
        productKey: "bidrock",
        verificationStatus: "approved",
      },
      database as never
    );
    expect(entitlement.status).toBe("active");
  });

  it("preserves an explicit revocation made while the business identity is blocked", async () => {
    await database.exec("UPDATE user_profiles SET verification_status = 'rejected'");
    await database.exec(
      "UPDATE profile_account_entitlements SET status = 'revoked' WHERE product_key = 'jw_stone_member_pricing'"
    );
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    const entitlement = await ensureProfileAccountEntitlement(
      {
        profileAccountId: "00000000-0000-4000-8000-000000000131",
        productKey: "jw_stone_member_pricing",
        verificationStatus: "not_required",
      },
      database as never
    );
    expect(entitlement.status).toBe("revoked");
    expect(await access()).toBe(false);
  });

  it("performs a one-time cutover of legacy automatic revocations", async () => {
    const cutover = new PGlite();
    try {
      await cutover.exec(fixtureSql);
      await cutover.exec(`
        UPDATE user_profiles SET verification_status = 'rejected';
        UPDATE profile_accounts SET verification_status = 'rejected';
        UPDATE profile_account_entitlements
           SET status = 'revoked'
         WHERE product_key = 'jw_stone_member_pricing';
      `);
      await cutover.exec(migrationSql);

      expect(await hasActiveJwStoneBusinessMembership("member", cutover as never)).toBe(false);
      const normalized = await cutover.query(
        "SELECT status FROM profile_account_entitlements WHERE product_key = 'jw_stone_member_pricing'"
      );
      expect(normalized.rows).toEqual([{ status: "active" }]);

      await cutover.exec("UPDATE user_profiles SET verification_status = 'approved'");
      expect(await hasActiveJwStoneBusinessMembership("member", cutover as never)).toBe(true);

      await cutover.exec(
        "UPDATE profile_account_entitlements SET status = 'revoked' WHERE product_key = 'jw_stone_member_pricing'"
      );
      await cutover.exec(migrationSql);
      const replayed = await cutover.query(
        "SELECT status FROM profile_account_entitlements WHERE product_key = 'jw_stone_member_pricing'"
      );
      expect(replayed.rows).toEqual([{ status: "revoked" }]);
    } finally {
      await cutover.close();
    }
  });

  it("does not use another business owner's approved identity", async () => {
    await database.exec(`
      UPDATE profile_accounts SET verification_status = 'approved';
      UPDATE profile_account_entitlements SET status = 'active';
      UPDATE user_profiles SET verification_status = 'approved', user_id = 'someone-else';
    `);
    expect(await access()).toBe(false);
  });

  it("requires the exact JW Stone membership and pricing entitlement", async () => {
    await database.exec(`
      UPDATE user_profiles SET verification_status = 'approved';
      DELETE FROM profile_account_entitlements WHERE product_key = 'bidrock';
      UPDATE profile_account_entitlements
         SET product_key = 'bidrock'
       WHERE product_key = 'jw_stone_member_pricing';
    `);
    expect(await access()).toBe(false);
    await database.exec(`
      UPDATE profile_account_entitlements SET product_key = 'jw_stone_member_pricing';
      UPDATE profiles SET slug = 'another-stone-business';
    `);
    expect(await access()).toBe(false);
  });
});
