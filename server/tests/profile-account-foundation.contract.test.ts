import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile-native account foundation", () => {
  it("keeps one durable relationship per private identity and target profile", () => {
    const service = read("server/services/profileAccountService.ts");
    const migration = read("migrations/0115_profile_accounts.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS profile_accounts");
    expect(migration).toContain(
      "profile_accounts_owner_target_unique UNIQUE (owner_user_id, target_profile_id)"
    );
    expect(service).toContain("ON CONFLICT (owner_user_id, target_profile_id) DO UPDATE");
    expect(service).not.toMatch(/password_hash/i);
  });

  it("creates a private business identity without publishing a business listing", () => {
    const route = read("server/routes/profile-accounts.ts");
    const service = read("server/services/profileAccountService.ts");

    expect(route).toContain('"/api/profile-accounts/register"');
    expect(route).toContain("businessName: parsed.data.businessName");
    expect(route).toContain('profileVisibility: "private"');
    expect(route).toContain("onboardingCompleted: false");
    expect(service).toContain("async function createPrivateBusinessProfile");
    expect(service).toContain("INSERT INTO user_profiles");
    expect(service).toContain("'private'");
    expect(service).toContain("businessRegistrationReviewRequestedAt");
    expect(service).not.toMatch(/INSERT INTO businesses/i);
    expect(service).not.toMatch(/INSERT INTO profiles/i);
    expect(service).not.toContain("A TradeScout business profile is required");
  });

  it("keeps BidRock downstream and verification-gated", () => {
    const route = read("server/routes/profile-accounts.ts");
    const entitlement = read("server/services/profileAccountEntitlementService.ts");

    expect(route).toContain('productKey: "bidrock"');
    expect(route).toContain("verificationStatus: args.account.verificationStatus");
    expect(entitlement).toContain("pending_verification");
    expect(route).not.toContain("bidrock_profile_accounts");
  });

  it("keeps JW Stone account creation inside JW Stone", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const client = read("client/src/components/profile/profileAccountClient.ts");
    const onboarding = read("client/src/lib/postOnboardingRoute.ts");

    expect(header).toContain("sticky top-0");
    expect(header).toContain('data-testid="jw-marketplace-account-button"');
    expect(header).toContain("onOpenAccount");
    expect(header).toContain("Account");
    expect(marketplace).toContain("<PublicProfileAccountDialog");
    expect(marketplace).toContain('profileSlug="jw-stone"');
    expect(dialog).toContain("Any business can create an account directly with");
    expect(dialog).toContain("registerProfileAccount");
    expect(dialog).not.toContain("/pre-scout-setup");
    expect(client).toContain('buildApiUrl("/api/profile-accounts/register")');
    expect(client).toContain('slug === "jw-stone" ? "/jw-stone"');
    expect(onboarding).toContain('normalized === "/jw-stone"');
    expect(onboarding).toContain("/^\\/u\\/[a-z0-9]");
  });

  it("does not ask users to choose a business role", () => {
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const route = read("server/routes/profile-accounts.ts");
    const combined = `${dialog}\n${route}`;

    expect(combined).not.toMatch(/Create a fabricator account/i);
    expect(combined).not.toMatch(/Builder or contractor|Stone yard or dealer|Designer/i);
    expect(combined).not.toContain("preferredRole");
    expect(combined).not.toContain("PROFILE_ACCOUNT_ROLES");
  });

  it("keeps registration blocked until profile policy loads", () => {
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");

    expect(dialog).toContain('data-testid="profile-account-load-error"');
    expect(dialog).toContain("Account details have not finished loading");
    expect(dialog).toContain("if (submitting || !state) return");
    expect(dialog).toContain("Try again");
  });

  it("does not claim saved stones, pricing, or conversations are already synchronized", () => {
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const service = read("server/services/profileAccountService.ts");
    const combined = `${dialog}\n${service}`;

    expect(combined).not.toMatch(/saved stones are synced|conversation history restored/i);
    expect(service).not.toMatch(
      /INSERT INTO conversations|INSERT INTO messages|INSERT INTO stone_saved/i
    );
  });
});
