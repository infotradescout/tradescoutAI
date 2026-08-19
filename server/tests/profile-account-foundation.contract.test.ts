import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("in-profile account foundation", () => {
  it("uses one TradeScout identity and one durable relationship per user and profile", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("CREATE TABLE IF NOT EXISTS profile_accounts");
    expect(service).toContain("UNIQUE (user_id, profile_id)");
    expect(service).toContain("REFERENCES users(id)");
    expect(service).toContain("REFERENCES profiles(id)");
    expect(service).toContain("ON CONFLICT (user_id, profile_id) DO UPDATE");
    expect(service).not.toMatch(/password|password_hash/i);
  });

  it("creates a private TradeScout business persona only for business account roles", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("isProfileAccountBusinessRole");
    expect(service).toContain("ensurePrivateBusinessPersona");
    expect(service).toContain("user_intent = 'business'");
    expect(service).toContain("'private'");
    expect(service).toContain("verification_status");
  });

  it("keeps BidRock as a product entitlement granted from a profile account", () => {
    const route = read("server/routes/profile-accounts.ts");
    const entitlement = read("server/services/profileAccountEntitlementService.ts");

    expect(entitlement).toContain("CREATE TABLE IF NOT EXISTS profile_account_entitlements");
    expect(entitlement).toContain("REFERENCES profile_accounts(id)");
    expect(route).toContain('productKey: "bidrock"');
    expect(route).toContain("profileAccountRoleIncludesBidRock");
    expect(route).not.toContain("bidrock_profile_accounts");
  });

  it("creates the relationship inside the profile route and resumes after TradeScout signup", () => {
    const route = read("server/routes/profile-accounts.ts");
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");

    expect(route).toContain('app.get("/api/u/:slug/account"');
    expect(route).toContain('"/api/u/:slug/account"');
    expect(route).toContain("isAuthenticated");
    expect(card).toContain("profileAccount");
    expect(card).toContain("/pre-scout-setup");
    expect(card).toContain("buildProfileAccountReturnPath");
    expect(card).toContain("sourcePath");
  });

  it("puts the generic profile-account flow inside JW Stone without making BidRock the account owner", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const jwCompany = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");

    expect(theme).toContain("PublicProfileAccountCard");
    expect(theme).toContain('preferredRole="fabricator"');
    expect(theme).toContain('profileSlug={JW_STONE_PROFILE_SLUG}');
    expect(theme).not.toContain("buildBidRockProfileAccountPath");
    expect(jwCompany).not.toContain("BidRock business account together");
  });

  it("mounts platform profile-account routes independently from saved-stone behavior", () => {
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
