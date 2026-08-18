import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const marketplace = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
const header = read("client/src/features/jw-stone/MarketplaceHeader.tsx");
const company = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");
const identity = read("shared/jwStonePresentation.ts");
const expressPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
const expressRoute = read("server/routes/tradepartner-express.ts");
const publicHtml = read("server/publicJwStoneMarketplaceHtml.ts");

describe("JW Stone 2.0 contact and discovery contract", () => {
  it("keeps JW Stone on the separate storefront while adding the official YouTube destination", () => {
    expect(marketplace).toContain("JWStoneMarketplace");
    expect(marketplace).toContain("MarketplaceHeader");
    expect(header).toContain('data-testid="jw-marketplace-youtube"');
    expect(header).toContain("JW_STONE_YOUTUBE_URL");
    expect(company).toContain('data-testid="jw-social-youtube"');
    expect(identity).toContain('JW_STONE_YOUTUBE_URL = "https://www.youtube.com/@JWStoneLogistics"');
    expect(identity).toContain('publicHandle: "@JWStoneLogistics"');
  });

  it("shows the verified address publicly and supplies it to Express Direct Connect", () => {
    expect(identity).toContain('streetAddress: "2103 W Herman Ave"');
    expect(identity).toContain('addressLocality: "Pensacola"');
    expect(identity).toContain('postalCode: "32505"');
    expect(company).toContain("address.streetAddress");
    expect(company).toContain("address.addressLocality");
    expect(marketplace).toContain(
      "businessAddress={JW_STONE_PUBLIC_IDENTITY.address.formatted}"
    );
  });

  it("restores the protected Call choice without publishing the business phone", () => {
    expect(marketplace).toContain("allowCall");
    expect(marketplace).toContain('initialView="choice"');
    expect(expressPanel).toContain("const startCall = async () =>");
    expect(expressPanel).toContain("/express-contact/reveal");
    expect(expressPanel).toContain('decision: "call"');
    expect(expressRoute).toContain('authorityGate: z.literal("profile_direct_connect")');
    expect(expressRoute).toContain('decision: z.literal("call")');
    expect(expressRoute).toContain("normalizeDirectConnectPhone(target.phone)");
    expect(publicHtml).not.toContain("(850) 543-0748");
    expect(identity).not.toContain("(850) 543-0748");
  });

  it("publishes stable local-business discovery signals without changing the visual layout", () => {
    expect(marketplace).toContain('"@type": "LocalBusiness"');
    expect(marketplace).toContain("foundingDate: JW_STONE_PUBLIC_IDENTITY.foundingDate");
    expect(marketplace).toContain("hasMap: JW_STONE_PUBLIC_IDENTITY.address.mapUrl");
    expect(marketplace).toContain(
      "sameAs: JW_STONE_PUBLIC_IDENTITY.socials.map((social) => social.href)"
    );
    expect(marketplace).toContain("JW_STONE_SOCIAL_IMAGE_URL");
    expect(publicHtml).toContain("buildJwStoneMarketplaceSitemapXml");
    expect(publicHtml).toContain("buildJwStoneMarketplaceLlmsText");
    expect(publicHtml).toContain("JW_STONE_PUBLIC_IDENTITY.address.formatted");
    expect(publicHtml).toContain("JW_STONE_PUBLIC_IDENTITY.socials");
  });
});
