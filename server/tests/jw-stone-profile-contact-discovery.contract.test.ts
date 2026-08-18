import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const selector = read("client/src/pages/ProfileSiteView.tsx");
const profile = read("client/src/features/jw-stone/JWStoneProfile.tsx");
const experience = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
const company = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");
const serverIndex = read("server/index.ts");

describe("JW Stone 2.0 profile contact and discovery contract", () => {
  it("keeps the current JW Stone 2.0 design as the visible TradeScout profile", () => {
    expect(selector).toContain("profileSlug === JW_STONE_PROFILE_SLUG");
    expect(selector).toContain("<JWStoneProfile />");
    expect(profile).toContain("<JWStoneProfileExperience />");
    expect(experience).toContain("<MarketplaceIntroduction />");
    expect(experience).toContain("<StoneCollection");
    expect(experience).toContain("<ColorPaletteRail");
    expect(experience).toContain("<MaterialCategoryRail");
    expect(experience).toContain("<JwStoneStorySection />");
    expect(experience).toContain("<JwStoneCompanySection />");
  });

  it("keeps the original founder story, verified address, and official social identity visible", () => {
    expect(identity).toContain("JW Stone was born from a shared vision between two lifelong friends");
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('addressLocality: "Pensacola"');
    expect(identity).toContain('postalCode: "32505"');
    expect(identity).toContain('publicHandle: "@jwstonellc"');
    expect(identity).toContain('publicHandle: "JW Stone Logistics"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
    expect(company).toContain('data-testid="jw-founder-story"');
    expect(company).toContain("address.streetAddress");
    expect(company).toContain('data-testid="jw-social-youtube"');
    expect(header).toContain("JW_STONE_YOUTUBE_URL");
  });

  it("restores Call inside Express Direct Connect without publishing the phone", () => {
    expect(experience).toContain('profileSlug="jw-stone"');
    expect(experience).toContain("businessAddress={JW_STONE_PUBLIC_IDENTITY.address.formatted}");
    expect(experience).toContain("allowCall");
    expect(experience).toContain('initialView="choice"');
    expect(expressPanel).toContain("const startCall = async () =>");
    expect(expressPanel).toContain("/express-contact/reveal");
    expect(expressPanel).toContain('decision: "call"');
    expect(expressRoute).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(expressRoute).toContain('decision: z.literal("call")');
    expect(expressRoute).toContain("normalizeDirectConnectPhone(target.phone)");
    expect(identity).not.toContain("(850) 543-0748");
    expect(profile).not.toContain("(850) 543-0748");
  });

  it("publishes the modern experience as a profile page with profile-owned canonical URLs", () => {
    expect(profile).toContain('"@type": "ProfilePage"');
    expect(profile).toContain('"@type": "LocalBusiness"');
    expect(profile).toContain("PLATFORM_PROFILE_URL");
    expect(profile).toContain("/u/${JW_STONE_PROFILE_SLUG}");
    expect(profile).toContain("JW_STONE_PUBLIC_IDENTITY.address.mapUrl");
    expect(profile).toContain("JW_STONE_PUBLIC_IDENTITY.socials.map");
    expect(profile).toContain('ogType="profile"');
    expect(serverIndex).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(serverIndex).not.toContain("serveJwStoneMarketplaceCustomDomainPath");
  });
});
