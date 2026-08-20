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

  it("creates a private business identity inside a business profile account flow", () => {
    const service = read("server/services/profileAccountService.ts");
    const route = read("server/routes/profile-accounts.ts");

    expect(route).toContain("businessName: z.string().trim().min(2).max(160).optional()");
    expect(route).toContain("businessName: parsed.data.businessName");
    expect(service).toContain("async function createPrivateBusinessProfile");
    expect(service).toContain("INSERT INTO user_profiles");
    expect(service).toContain("'business'");
    expect(service).toContain("'business_owner'");
    expect(service).toContain("'private'");
    expect(service).toContain("display_name");
    expect(service).toContain("Business name is required to create an account with this profile");
    expect(service).not.toMatch(/INSERT INTO businesses/i);
    expect(service).not.toMatch(/INSERT INTO profiles/i);
    expect(service).not.toContain("A TradeScout business profile is required");
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

  it("creates and signs in without leaving the profile for general onboarding", () => {
    const card = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const client = read("client/src/components/profile/profileAccountClient.ts");

    expect(card).toContain("<PublicProfileAccountDialog");
    expect(dialog).toContain('"/api/auth/register"');
    expect(dialog).toContain('"/api/auth/login"');
    expect(dialog).toContain("createProfileAccount");
    expect(dialog).toContain('userTypes: requiresBusiness ? ["business_owner"] : []');
    expect(dialog).toContain("Any business can create an account directly with");
    expect(dialog).toContain("Your business details stay private");
    expect(client).toContain("currentProfileAccountSourcePath");
    expect(`${card}\n${dialog}`).not.toContain("/pre-scout-setup");
    expect(`${card}\n${dialog}`).not.toContain('presence", "business"');
    expect(`${card}\n${dialog}`).not.toContain("How do you plan to use TradeScout");
  });

  it("puts the same direct account entry inside the JW Stone shopping surface", () => {
    const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");

    expect(marketplace).toContain('import { PublicProfileAccountDialog }');
    expect(marketplace).toContain("const [accountOpen, setAccountOpen] = useState(false)");
    expect(marketplace).toContain("onOpenAccount={() => setAccountOpen(true)}");
    expect(marketplace).toContain('profileSlug="jw-stone"');
    expect(marketplace).toContain('profileName={JW_STONE_PUBLIC_IDENTITY.brandName}');
    expect(header).toContain("onOpenAccount: () => void");
    expect(header).toContain('data-testid="jw-marketplace-account-button"');
    expect(header).toContain("Open your JW Stone account");
  });

  it("supports a safe JW Stone marketplace source path rather than only /u routes", () => {
    const route = read("server/routes/profile-accounts.ts");
    const service = read("server/services/profileAccountService.ts");

    expect(route).toContain("isSafeSourcePath");
    expect(route).not.toContain("regex(/^\\/u\\/");
    expect(service).toContain("function normalizeSourcePath");
    expect(service).toContain("source_path = '/'");
    expect(service).toContain("source_path ~ '^/[^/]'");
  });

  it("exposes one generic account action and never asks for a business role", () => {
    const accountCard = read("client/src/components/profile/PublicProfileAccountCard.tsx");
    const dialog = read("client/src/components/profile/PublicProfileAccountDialog.tsx");
    const trustActions = read("client/src/components/profile/PublicProfileTrustActions.tsx");
    const profileSite = read("client/src/pages/ProfileSiteView.tsx");
    const shared = read("shared/profileAccount.ts");
    const combined = `${accountCard}\n${dialog}\n${trustActions}\n${shared}`;

    expect(profileSite).toContain("renderProfileTrustActions");
    expect(trustActions).toContain('import { PublicProfileAccountCard }');
    expect(trustActions).toContain("<PublicProfileAccountCard");
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
    expect(service).not.toMatch(/INSERT INTO conversations|INSERT INTO messages|INSERT INTO stone_saved/i);
  });
});
