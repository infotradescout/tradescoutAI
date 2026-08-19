import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("in-profile account foundation", () => {
  it("uses one durable relationship per TradeScout user and target profile", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("CREATE TABLE IF NOT EXISTS profile_accounts");
    expect(service).toContain("UNIQUE (owner_user_id, target_profile_id)");
    expect(service).toContain("owner_user_id TEXT NOT NULL REFERENCES users(id)");
    expect(service).toContain("business_profile_id TEXT REFERENCES user_profiles(id)");
    expect(service).toContain("target_profile_id TEXT NOT NULL REFERENCES profiles(id)");
    expect(service).toContain("identity_kind TEXT NOT NULL");
    expect(service).toContain("priority_key TEXT NOT NULL");
    expect(service).toContain("ON CONFLICT (owner_user_id, target_profile_id) DO UPDATE");
    expect(service).toContain("enforce_profile_account_identity");
    expect(service).not.toMatch(/password|password_hash/i);
  });

  it("requires a business identity only when the target profile policy requires it", () => {
    const service = read("server/services/profileAccountService.ts");
    const shared = read("shared/profileAccount.ts");

    expect(shared).toContain("requiredIdentity: ProfileAccountIdentityRequirement");
    expect(shared).toContain("const requiredIdentity: ProfileAccountIdentityRequirement");
    expect(shared).toContain('? "business"');
    expect(shared).toContain('configured.requiredIdentity || "user"');
    expect(service).toContain('policy.requiredIdentity === "business"');
    expect(service).toContain("A TradeScout business profile is required to create this account");
    expect(service).toContain("identityKind = policy.requiredIdentity");
    expect(service).toContain('viewerBusiness?.verificationStatus || "not_required"');
    expect(service).not.toContain("roles TEXT[]");
  });

  it("keeps BidRock as downstream access only for business-gated stone profiles", () => {
    const route = read("server/routes/profile-accounts.ts");
    const entitlement = read("server/services/profileAccountEntitlementService.ts");
    const shared = read("shared/profileAccount.ts");

    expect(entitlement).toContain("CREATE TABLE IF NOT EXISTS profile_account_entitlements");
    expect(entitlement).toContain("REFERENCES profile_accounts(id)");
    expect(route).toContain('productKey: "bidrock"');
    expect(route).toContain("created.policy.includesBidRock");
    expect(shared).toContain("priorityKey = stoneProfile");
    expect(shared).toContain('"stone_business_access"');
    expect(route).not.toContain("bidrock_profile_accounts");
  });

  it("resumes through ordinary account setup or business setup according to profile policy", () => {
    const route = read("server/routes/profile-accounts.ts");
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");

    expect(route).toContain('app.get("/api/u/:slug/account"');
    expect(route).toContain('"/api/u/:slug/account"');
    expect(route).toContain("isAuthenticated");
    expect(card).toContain("profileAccount");
    expect(card).toContain("/pre-scout-setup");
    expect(card).toContain('data?.policy.requiredIdentity === "business"');
    expect(card).toContain('destination.searchParams.set("presence", "business")');
    expect(card).toContain("buildProfileAccountReturnPath");
    expect(card).toContain("sourcePath");
  });

  it("exposes the same generic Create an account action while each profile keeps its own policy", () => {
    const accountCard = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const trustActions = read("client/src/components/profile/PublicProfileTrustActions.tsx");
    const profileSite = read("client/src/pages/ProfileSiteView.tsx");
    const wholesalerTheme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const steelHomeDirectory = read(
      "client/src/pages/profile-sites/steel-home-project-tools/SteelHomeBuilderDirectory.tsx"
    );
    const shared = read("shared/profileAccount.ts");

    expect(profileSite).toContain("renderProfileTrustActions");
    expect(profileSite).toContain("PublicProfileTrustActions");
    expect(trustActions).toContain('import { PublicProfileAccountCard }');
    expect(trustActions).toContain("<PublicProfileAccountCard");
    expect(trustActions).toContain("profileSlug={profileSlug}");
    expect(trustActions).toContain("profileName={profileName}");
    expect(steelHomeDirectory).toContain('import { PublicProfileAccountCard }');
    expect(steelHomeDirectory).toContain("<PublicProfileAccountCard");
    expect(accountCard).toContain('"Create an account"');
    expect(accountCard).toContain("data.policy.description");
    expect(shared).toContain("profilePriorityConfig");
    expect(wholesalerTheme).not.toContain("PublicProfileAccountCard");
    expect(wholesalerTheme).not.toContain('profileName="JW Stone"');
    expect(`${accountCard}\n${trustActions}\n${wholesalerTheme}\n${shared}`).not.toMatch(
      /Create a fabricator account/i
    );
    expect(`${accountCard}\n${trustActions}\n${wholesalerTheme}\n${shared}`).not.toContain(
      "preferredRole"
    );
    expect(`${accountCard}\n${trustActions}\n${wholesalerTheme}\n${shared}`).not.toContain(
      "PROFILE_ACCOUNT_ROLES"
    );
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
