import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const profileWrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
const profileSeo = read("client/src/features/jw-stone/JwStoneProfileSeo.tsx");
const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
const company = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");
const publicHtml = read("server/publicJwStoneMarketplaceHtml.ts");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");

describe("JW Stone profile contact and account contract", () => {
  it("keeps the full JW Stone marketplace as its profile experience", () => {
    expect(profileWrapper).toContain(
      'import JWStoneMarketplace from "@/features/jw-stone/JWStoneMarketplace"'
    );
    expect(profileWrapper).toContain("const normalizedSlug = props.profileSlug.trim().toLowerCase()");
    expect(profileWrapper).toContain("normalizedSlug === JW_STONE_PROFILE_SLUG");
    expect(profileWrapper).toContain("<JWStoneMarketplace />");
    expect(marketplace).toContain("<MarketplaceIntroduction />");
    expect(marketplace).toContain("<StoneCollection");
    expect(marketplace).toContain("<JwStoneCompanySection />");
    expect(marketplace).toContain("<WishlistPanel");
  });

  it("keeps company identity, address, and social links without public direct contact", () => {
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
    expect(company).toContain("About JW Stone");
    expect(company).toContain("Visit JW Stone");
    expect(company).toContain("Follow JW Stone");
    expect(company).not.toContain("JW_STONE_MANAGED_CONTACT");
    expect(company).not.toContain('href={`tel:');
    expect(company).not.toContain('href={`mailto:');
    expect(company).not.toContain('data-testid="jw-managed-contact-card"');
    expect(profileSeo).not.toContain("JW_STONE_MANAGED_CONTACT");
    expect(profileSeo).not.toContain("telephone:");
    expect(profileSeo).not.toContain("contactPoint:");
    expect(marketplace).not.toContain("JW_STONE_MANAGED_CONTACT");
    expect(publicHtml).not.toContain("JW_STONE_MANAGED_CONTACT");
    expect(publicHtml).not.toContain("Phone:");
    expect(publicHtml).not.toContain("TradeScout managed phone");
  });

  it("keeps direct contact exclusively behind Express Direct Connect", () => {
    expect(marketplace).toContain("<ExpressDirectConnectPanel");
    expect(marketplace).toContain('profileSlug="jw-stone"');
    expect(marketplace).toContain("allowCall");
    expect(marketplace).toContain('initialView="choice"');
    expect(expressPanel).toContain("/express-contact/reveal");
    expect(expressPanel).toContain('decision: "call"');
    expect(expressRoute).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(expressRoute).toContain("normalizeDirectConnectPhone(target.phone)");
  });

  it("puts the account utility in the sticky header and nowhere visible below", () => {
    expect(header).toContain("sticky top-0");
    expect(header).toContain('data-testid="jw-marketplace-account-button"');
    expect(header).toContain("onOpenAccount");
    expect(header).toContain("Account");
    expect(marketplace).toContain("<PublicProfileAccountDialog");
    expect(company).toContain("[&_[data-testid=public-profile-account-card]]:hidden");
    expect(company).not.toContain("<PublicProfileAccountCard");
  });

  it("keeps YouTube with the company social identity and out of the header", () => {
    expect(company).toContain('data-testid="jw-social-youtube"');
    expect(company).toContain('aria-label="Watch JW Stone on YouTube"');
    expect(header).not.toContain("JW_STONE_YOUTUBE_URL");
    expect(header).not.toContain("Watch JW Stone on YouTube");
  });
});
