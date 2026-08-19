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
const profileSeo = read("client/src/features/jw-stone/JwStoneProfileSeo.tsx");
const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
const company = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");
const marketplaceRoutes = read("client/src/features/jw-stone/marketplaceRoutes.ts");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");
const contactProvisioner = read("server/services/jwStoneManagedContactProvisioning.ts");
const bootstrap = read("server/services/steelHomePackagesProfileProvisioning.ts");
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

  it("shows one TradeScout-managed contact with the company address and social identity", () => {
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('addressLocality: "Pensacola"');
    expect(identity).toContain('postalCode: "32505"');
    expect(identity).toContain('publicHandle: "@jwstonellc"');
    expect(identity).toContain('publicHandle: "JW Stone Logistics"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
    expect(identity).toContain('label: "TradeScout managed contact"');
    expect(identity).toContain('heading: "JW Stone inquiries"');
    expect(identity).toContain('phone: "(850) 543-0748"');
    expect(identity).toContain('email: "contact@thetradescout.com"');
    expect(identity).not.toContain("wagner@jwstonellc.com");

    expect(profileWrapper).toContain("profileActions={props.trustActions}");
    expect(company).toContain("useJwStoneProfileContext");
    expect(company).toContain('data-testid="jw-company-editorial-layout"');
    expect(company).toContain('data-testid="jw-tradescout-profile-actions"');
    expect(company).toContain('data-testid="jw-company-contact-card"');
    expect(company).toContain('data-testid="jw-managed-contact-card"');
    expect(company).toContain('data-testid="jw-managed-contact-phone"');
    expect(company).toContain('data-testid="jw-managed-contact-email"');
    expect(company).toContain("JW_STONE_MANAGED_CONTACT.phone");
    expect(company).toContain("JW_STONE_MANAGED_CONTACT.email");
    expect(company).toContain("[&_[data-testid=public-profile-identity]]:hidden");
    expect(company).toContain("[&>div>p:first-child]:hidden");
    expect(company).toContain("xl:sticky");
    expect(company).toContain("Founded 2017 · Pensacola, Florida");
    expect(company).toContain("About JW Stone");
    expect(company).toContain("Our Journey to Excellence");
    expect(company).toContain("Visit JW Stone");
    expect(company).toContain("Follow JW Stone");
    expect(company).not.toContain("wagner@jwstonellc.com");
  });

  it("keeps YouTube with the bottom social identity and out of the header", () => {
    expect(company).toContain('data-testid="jw-social-youtube"');
    expect(company).toContain('aria-label="Watch JW Stone on YouTube"');
    expect(header).not.toContain("JW_STONE_YOUTUBE_URL");
    expect(header).not.toContain("jw-marketplace-youtube");
    expect(header).not.toContain("Watch JW Stone on YouTube");
  });

  it("keeps Call protected while publishing the same managed contact", () => {
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
    expect(profileSeo).toContain("telephone: JW_STONE_MANAGED_CONTACT.phone");
    expect(profileSeo).toContain("email: JW_STONE_MANAGED_CONTACT.email");
    expect(marketplace).toContain("telephone: JW_STONE_MANAGED_CONTACT.phone");
    expect(marketplace).toContain("email: JW_STONE_MANAGED_CONTACT.email");
  });

  it("persists the managed phone and TradeScout inbox without transferring ownership", () => {
    expect(contactProvisioner).toContain("export async function provisionJwStoneManagedContact");
    expect(contactProvisioner).toContain("phone: JW_STONE_MANAGED_CONTACT.phone");
    expect(contactProvisioner).toContain("email: JW_STONE_MANAGED_CONTACT.email");
    expect(contactProvisioner).toContain("notificationEmail: JW_STONE_MANAGED_CONTACT.email");
    expect(contactProvisioner).toContain('contact_management: "tradescout_managed"');
    expect(contactProvisioner).toContain("String(profile.ownerUserId || \"\")");
    expect(contactProvisioner).toContain("String(business.ownerUserId || \"\")");
    expect(contactProvisioner).toContain(".update(businesses)");
    expect(contactProvisioner).not.toContain(".update(profiles)");
    expect(contactProvisioner).not.toContain(".update(users)");
    expect(contactProvisioner).not.toContain("ownerUserId:");

    expect(bootstrap).toContain(
      'import { provisionJwStoneManagedContact } from "./jwStoneManagedContactProvisioning"'
    );
    expect(bootstrap).toContain("await provisionJwStoneManagedContact();");
    expect(bootstrap).toContain("JW Stone managed contact failed");
  });
});
