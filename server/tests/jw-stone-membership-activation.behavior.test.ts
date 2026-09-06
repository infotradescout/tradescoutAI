import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db", () => ({ pool: { query: vi.fn() }, db: {} }));
vi.mock("../services/stoneInventoryService", () => ({
  getStoneInventoryProfileTarget: vi.fn(),
  hasStoneInventoryCapability: vi.fn(),
}));

import { hasActiveJwStoneBusinessMembership } from "../services/jwStonePricingAccess";

describe("JW Stone membership approval against actual SQL", () => {
  let database: PGlite;
  const access = () =>
    hasActiveJwStoneBusinessMembership("member", database as never);

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      CREATE TABLE profiles (id text, slug text, business_id text);
      CREATE TABLE user_profiles (
        id text, user_id text, user_intent text, verification_status text
      );
      CREATE TABLE profile_accounts (
        id text, owner_user_id text, target_profile_id text, target_business_id text,
        business_profile_id text, identity_kind text, status text, verification_status text
      );
      CREATE TABLE profile_account_entitlements (
        profile_account_id text, product_key text, status text
      );
      INSERT INTO profiles VALUES ('jw-profile', 'jw-stone', 'jw-business');
      INSERT INTO user_profiles VALUES ('member-business', 'member', 'business', 'pending');
      INSERT INTO profile_accounts VALUES (
        'membership', 'member', 'jw-profile', 'jw-business', 'member-business',
        'business', 'active', 'pending'
      );
      INSERT INTO profile_account_entitlements VALUES (
        'membership', 'jw_stone_member_pricing', 'pending_verification'
      );
    `);
  });

  afterEach(async () => database.close());

  it("unlocks an existing membership when its business is approved, without joining again", async () => {
    expect(await access()).toBe(false);
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    expect(await access()).toBe(true);
    const account = await database.query("SELECT verification_status FROM profile_accounts");
    expect(account.rows[0]).toEqual({ verification_status: "pending" });
  });

  it.each(["suspended", "revoked"])("preserves an explicitly %s pricing entitlement", async (status) => {
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    await database.query("UPDATE profile_account_entitlements SET status = $1", [status]);
    expect(await access()).toBe(false);
  });

  it.each(["suspended", "closed"])("blocks a %s JW Stone membership", async (status) => {
    await database.exec("UPDATE user_profiles SET verification_status = 'approved'");
    await database.query("UPDATE profile_accounts SET status = $1", [status]);
    expect(await access()).toBe(false);
  });

  it("removes pricing when the business loses approval", async () => {
    await database.exec(`
      UPDATE profile_accounts SET verification_status = 'approved';
      UPDATE profile_account_entitlements SET status = 'active';
      UPDATE user_profiles SET verification_status = 'approved';
    `);
    expect(await access()).toBe(true);
    await database.exec("UPDATE user_profiles SET verification_status = 'rejected'");
    expect(await access()).toBe(false);
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
      UPDATE profile_account_entitlements SET product_key = 'bidrock';
    `);
    expect(await access()).toBe(false);
    await database.exec(`
      UPDATE profile_account_entitlements SET product_key = 'jw_stone_member_pricing';
      UPDATE profiles SET slug = 'another-stone-business';
    `);
    expect(await access()).toBe(false);
  });
});
