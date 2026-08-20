import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("in-profile account foundation", () => {
  it("uses one durable relationship per private identity and target profile", () => {
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

  it("creates a private business identity and queues a real manual review", () => {
    const service = read("server/services/profileAccountService.ts");
    const route = read("server/routes/profile-accounts.ts");
    const admin = read("client/src/pages/admin-profile-verifications.tsx");

    expect(route).toContain("businessName: z.string().trim().min(2).max(160)");
    expect(route).toContain("businessName: parsed.data.businessName");
    expect(service).toContain("async function createPrivateBusinessProfile");
    expect(service).toContain("async function ensureBusinessVerificationReview");
    expect(service).toContain("INSERT INTO user_profiles");
    expect(service).toContain("verification_requirements");
    expect(service).toContain("verification_submissions");
    expect(service).toContain("businessRegistrationReviewRequestedAt");
    expect(service).toContain("businessRegistrationReviewSource");
    expect(service).toContain("'business_owner'");
    expect(service).toContain("'private'");
    expect(admin).toContain("Manual business review requested from a profile account");
    expect(admin).toContain("decisionMutation.mutate");
    expect(service).not.toMatch(/INSERT INTO businesses/i);
    expect(service).not.toMatch(/INSERT INTO profiles/i);
    expect(service).not.toContain("A TradeScout business profile is required");
  });

  it("synchronizes profile and BidRock verification after an admin decision", () => {
    const service = read("server/services/profileAccountService.ts");

    expect(service).toContain("sync_profile_account_business_verification");
    expect(service).toContain("AFTER UPDATE OF verification_status");
    expect(service).toContain("UPDATE profile_accounts");
    expect(service).toContain("UPDATE profile_account_entitlements entitlement");
    expect(service).toContain("WHEN NEW.verification_status::text = 'approved' THEN 'active'");
  });

  it("keeps BidRock as downstream access only for business-gated stone profiles", () => {
    const route = read("server/routes/profile-accounts.ts");
    const entitlement = read("server/services/profileAccountEntitlementService.ts");
    const shared = read("shared/profileAccount.ts");

    expect(entitlement).toContain("CREATE TABLE IF NOT EXISTS profile_account_entitlements");
    expect(entitlement).toContain("REFERENCES profile_accounts(id)");
    expect(route).toContain('productKey: "bidrock"');
    expect(route).toContain("includesBidRock: created.policy.includesBidRock");
    expect(shared).toContain("priorityKey = stoneProfile");
    expect(shared).toContain('"stone_business_access"');
    expect(route).not.toContain("bidrock_profile_accounts");
  });

  it("uses a dedicated profile-native registration endpoint without global business authority", () => {
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const client = read("client/src/components/profile/profileAccountClient.ts");
    const route = read("server/routes/profile-accounts.ts");

    expect(dialog).toContain("registerProfileAccount");
    expect(client).toContain('buildApiUrl("/api/profile-accounts/register")');
    expect(route).toContain('"/api/profile-accounts/register"');
    expect(route).toContain('role: "homeowner" as any');
    expect(route).toContain('profileVisibility: "private"');
    expect(route).toContain('onboardingCompleted: false');
    expect(`${dialog}\n${route}`).not.toContain('userTypes: ["business_owner"]');
    expect(`${dialog}\n${route}`).not.toContain('role: "business_owner"');
    expect(dialog).toContain("Any business can create an account directly with");
    expect(dialog).toContain("Your business details stay private");
    expect(dialog).not.toContain("/pre-scout-setup");
    expect(dialog).not.toContain("How do you plan to use TradeScout");
  });

  it("blocks registration until the target profile policy loads", () => {
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");

    expect(dialog).toContain('data-testid="profile-account-load-error"');
    expect(dialog).toContain("Account details must load before registration can continue");
    expect(dialog).toContain("if (submitting || !data) return");
    expect(dialog).toContain("Try again");
  });

  it("uses the configured API origin for profile account and sign-in requests", () => {
    const client = read("client/src/components/profile/profileAccountClient.ts");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");

    expect(client).toContain('import { buildApiUrl } from "@/lib/apiBaseUrl"');
    expect(client).toContain("buildApiUrl(`/api/u/${encodeURIComponent(profileSlug)}/account`)");
    expect(client).toContain('buildApiUrl("/api/profile-accounts/register")');
    expect(dialog).toContain('fetch(buildApiUrl("/api/auth/login")');
  });

  it("puts the account entry in the sticky JW Stone header", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const resume = read("client/src/features/jw-stone/JwStoneProfileAccountResume.tsx");

    expect(marketplace).toContain("import { PublicProfileAccountDialog }");
    expect(marketplace).toContain("onOpenAccount={() => setAccountOpen(true)}");
    expect(marketplace).toContain('profileSlug="jw-stone"');
    expect(header).toContain("sticky top-0");
    expect(header).toContain('data-testid="jw-marketplace-account-button"');
    expect(header).toContain("Create an account with JW Stone");
    expect(header).toContain("<span>Create account</span>");
    expect(theme).toContain("<JWStoneMarketplace />");
    expect(theme).toContain("<JwStoneProfileAccountResume />");
    expect(resume).toContain('params.get("profileAccount") === "1"');
  });

  it("carries verification and password reset return paths across devices", () => {
    const client = read("client/src/components/profile/profileAccountClient.ts");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const route = read("server/routes/profile-accounts.ts");
    const verifyEmail = read("client/src/pages/verify-email.tsx");
    const resetPassword = read("client/src/pages/reset-password.tsx");

    expect(client).toContain('params.set("profileAccountMode", "signin")');
    expect(client).not.toContain("localStorage");
    expect(dialog).toContain("next: profileSigninReturnPath");
    expect(route).toContain("&next=${encodeURIComponent(parsed.data.next)}");
    expect(route).toContain('"/api/profile-accounts/request-password-reset"');
    expect(route).toContain("&next=${encodeURIComponent(parsed.data.next)}");
    expect(verifyEmail).toContain("isProfileAccountResumePath(resolvedNext)");
    expect(verifyEmail).not.toContain("readRememberedProfileAccountReturnPath");
    expect(resetPassword).toContain("requestProfileAccountPasswordReset");
    expect(resetPassword).toContain("isProfileAccountResumePath(safeNext)");
    expect(resetPassword).not.toContain("readRememberedProfileAccountReturnPath");
  });

  it("keeps the profile-account state GET path read-only", () => {
    const service = read("server/services/profileAccountService.ts");
    const stateReader = service
      .split("export async function getProfileAccountState")[1]
      .split("export async function ensureProfileAccount")[0];

    expect(stateReader).toContain("SELECT id,");
    expect(stateReader).not.toContain("UPDATE profile_accounts");
    expect(stateReader).not.toContain("ensureBusinessVerificationReview");
  });

  it("supports safe source paths beyond only /u routes", () => {
    const route = read("server/routes/profile-accounts.ts");
    const service = read("server/services/profileAccountService.ts");

    expect(route).toContain("isSafeSourcePath");
    expect(service).toContain("function normalizeSourcePath");
    expect(service).toContain("source_path = '/'");
    expect(service).toContain("source_path ~ '^/[^/]'");
  });

  it("exposes one generic account action and never asks for a business role", () => {
    const accountCard = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const trustActions = read("client/src/components/profile/PublicProfileTrustActions.tsx");
    const shared = read("shared/profileAccount.ts");
    const combined = `${accountCard}\n${dialog}\n${trustActions}\n${shared}`;

    expect(trustActions).toContain("import { PublicProfileAccountCard }");
    expect(trustActions).toContain("<PublicProfileAccountCard");
    expect(trustActions).toContain('profileSlug !== "jw-stone"');
    expect(accountCard).toContain('"Create an account"');
    expect(shared).toContain("profilePriorityConfig");
    expect(combined).not.toMatch(/Create a fabricator account/i);
    expect(combined).not.toContain("preferredRole");
    expect(combined).not.toContain("PROFILE_ACCOUNT_ROLES");
    expect(combined).not.toMatch(/Fabricator|Builder or contractor|Designer|Stone yard or dealer/);
  });

  it("does not claim profile accounts already own saved items, pricing, or conversations", () => {
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const service = read("server/services/profileAccountService.ts");
    const combined = `${card}\n${dialog}\n${service}`;

    expect(combined).not.toMatch(/saved stones are synced|conversation history restored/i);
    expect(service).not.toMatch(
      /INSERT INTO conversations|INSERT INTO messages|INSERT INTO stone_saved/i
    );
  });
});
