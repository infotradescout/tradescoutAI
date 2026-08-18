import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const app = read("client/src/App.tsx");
const routes = read("client/src/AppRoutes.tsx");
const profileView = read("client/src/pages/ProfileSiteView.tsx");
const profileWrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
const legacyTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
const company = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");
const marketplaceRoutes = read("client/src/features/jw-stone/marketplaceRoutes.ts");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");
const serverIndex = read("server/index.ts");

describe("JW Stone 2.0 profile contact and discovery contract", () => {
  it("keeps the complete JW Stone 2.0 experience as the custom JW profile theme", () => {
    expect(app).toContain("isJwStoneProfileRoute");
    expect(app).not.toContain("isJwStoneMarketplaceRoute");
    expect(routes).not.toContain("const JWStoneMarketplace");
    expect(routes).not.toContain("ProfileSiteOrJwMarketplaceRedirect");
    expect(routes).toContain('<Route path="/u/:slug">');
    expect(profileView).toContain("<WholesalerProfileTheme");
    expect(profileWrapper).toContain('import JWStoneMarketplace from "@/features/jw-stone/JWStoneMarketplace"');
    expect(profileWrapper).toContain("props.profileSlug.trim().toLowerCase() === JW_STONE_PROFILE_SLUG");
    expect(profileWrapper).toContain("<JWStoneMarketplace />");
    expect(profileWrapper).toContain("<LegacyWholesalerProfileTheme {...props} />");
    expect(legacyTheme).toContain("export default function WholesalerProfileTheme");

    expect(marketplace).toContain("<MarketplaceIntroduction />");
    expect(marketplace).toContain("<FirstCutSection");
    expect(marketplace).toContain("<StoneCollection");
    expect(marketplace).toContain("<ColorPaletteRail");
    expect(marketplace).toContain("<MaterialCategoryRail");
    expect(marketplace).toContain("<JwStoneStorySection />");
    expect(marketplace).toContain("<JwStoneCompanySection />");
    expect(marketplace).toContain("<WishlistPanel");
  });

  it("keeps JW Stone profile-owned on both TradeScout and its custom domain", () => {
    expect(marketplaceRoutes).toContain("JW_STONE_PLATFORM_PROFILE_BASE");
    expect(marketplaceRoutes).toContain('`/u/${JW_STONE_PROFILE_SLUG}`');
    expect(marketplaceRoutes).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(marketplaceRoutes).toContain("/u/jw-stone|/p/jw-stone");
    expect(serverIndex).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(serverIndex).not.toContain("serveJwStoneMarketplaceCustomDomainPath");
  });

  it("keeps verified company identity and TradeScout profile actions inside 2.0", () => {
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('addressLocality: "Pensacola"');
    expect(identity).toContain('postalCode: "32505"');
    expect(identity).toContain('publicHandle: "@jwstonellc"');
    expect(identity).toContain('publicHandle: "JW Stone Logistics"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
    expect(profileWrapper).toContain("profileActions={props.trustActions}");
    expect(company).toContain("useJwStoneProfileContext");
    expect(company).toContain('data-testid="jw-tradescout-profile-actions"');
    expect(company).toContain("About JW Stone");
    expect(company).toContain("Visit JW Stone");
    expect(company).toContain("Follow JW Stone");
  });

  it("keeps YouTube with the bottom social identity and out of the header", () => {
    expect(company).toContain('data-testid="jw-social-youtube"');
    expect(company).toContain('aria-label="Watch JW Stone on YouTube"');
    expect(header).not.toContain("JW_STONE_YOUTUBE_URL");
    expect(header).not.toContain("jw-marketplace-youtube");
    expect(header).not.toContain("Watch JW Stone on YouTube");
  });

  it("keeps Call protected behind the deliberate Direct Connect choice", () => {
    expect(marketplace).toContain('profileSlug="jw-stone"');
    expect(marketplace).toContain("businessAddress={JW_STONE_PUBLIC_IDENTITY.address.formatted}");
    expect(marketplace).toContain("allowCall");
    expect(marketplace).toContain('initialView="choice"');
    expect(expressPanel).toContain("const startCall = async () =>");
    expect(expressPanel).toContain("/express-contact/reveal");
    expect(expressPanel).toContain('decision: "call"');
    expect(expressRoute).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(expressRoute).toContain('decision: z.literal("call")');
    expect(expressRoute).toContain("normalizeDirectConnectPhone(target.phone)");
    expect(identity).not.toContain("(850) 543-0748");
  });
});
