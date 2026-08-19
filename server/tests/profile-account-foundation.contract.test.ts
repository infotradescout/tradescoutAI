import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("in-profile account foundation", () => {
  it("uses one durable relationship per TradeScout business and target profile", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("CREATE TABLE IF NOT EXISTS profile_business_accounts");
    expect(service).toContain("UNIQUE (business_profile_id, target_profile_id)");
    expect(service).toContain("REFERENCES user_profiles(id)");
    expect(service).toContain("REFERENCES profiles(id)");
    expect(service).toContain("ON CONFLICT (business_profile_id, target_profile_id) DO UPDATE");
    expect(service).not.toMatch(/password|password_hash/i);
  });

  it("requires an existing TradeScout business profile instead of inventing an account type", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("user_intent = 'business'");
    expect(service).toContain("A TradeScout business profile is required to create this account");
    expect(service).not.toContain("ensurePrivateBusinessPersona");
    expect(service).not.toContain("businessProfilePlan");
    expect(service).not.toContain("roles TEXT[]");
  });

  it("keeps BidRock as downstream product access for eligible stone profiles", () => {
    const route = read("server/routes/profile-accounts.ts");
    const entitlement = read("server/services/profileAccountEntitlementService.ts");

    expect(entitlement).toContain("CREATE TABLE IF NOT EXISTS profile_account_entitlements");
    expect(entitlement).toContain("REFERENCES profile_business_accounts(id)");
    expect(route).toContain('productKey: "bidrock"');
    expect(route).toContain("created.policy.includesBidRock");
    expect(route).not.toContain("bidrock_profile_accounts");
  });

  it("creates the relationship inside the profile route and resumes after business setup", () => {
    const route = read("server/routes/profile-accounts.ts");
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");

    expect(route).toContain('app.get("/api/u/:slug/account"');
    expect(route).toContain('"/api/u/:slug/account"');
    expect(route).toContain("isAuthenticated");
    expect(card).toContain("profileAccount");
    expect(card).toContain("/pre-scout-setup");
    expect(card).toContain('destination.searchParams.set("presence", "business")');
    expect(card).toContain("buildProfileAccountReturnPath");
    expect(card).toContain("sourcePath");
  });

  it("uses the exact generic CTA and removes fabricator-specific account copy", () => {
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const shared = read("shared/profileAccount.ts");

    expect(card).toContain("Create an account");
    expect(card).toContain("Businesses can create an account");
    expect(theme).toContain("PublicProfileAccountCard");
    expect(theme).toContain('profileSlug={JW_STONE_PROFILE_SLUG}');
    expect(`${card}\n${theme}\n${shared}`).not.toMatch(/Create a fabricator account/i);
    expect(`${card}\n${theme}\n${shared}`).not.toContain("preferredRole");
    expect(`${card}\n${theme}\n${shared}`).not.toContain("PROFILE_ACCOUNT_ROLES");
  });

  it("mounts platform profile-account routes independently from BidRock routes", () => {
    const mount = read("server/routes/jw-stone-saved-stones-email.ts");

    expect(mount).toContain('import { registerProfileAccountRoutes } from "./profile-accounts"');
    expect(mount).toContain("registerProfileAccountRoutes(app)");
    expect(mount).not.toContain("registerBidRockRoutes(app)");
  });

  it("does not claim profile accounts already own saved items, pricing, or conversations", () => {
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const service = read("server/services/profileAccountService.ts");
    const combined = `${card}\n${service}`;

    expect(combined).not.toMatch(/unlock pricing|saved stones are synced|conversation history restored/i);
    expect(service).not.toMatch(/INSERT INTO conversations|INSERT INTO messages|INSERT INTO stone_saved/i);
  });
});
