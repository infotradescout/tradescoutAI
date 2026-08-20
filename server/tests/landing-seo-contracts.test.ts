import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildPublicLandingHtml } from "../publicLandingHtml";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("landing SEO contracts", () => {
  it("self-canonicalizes stable landing variants and noindexes only aliases/query variants", () => {
    const source = read("client/src/pages/landing.tsx");

    expect(source).toContain('pathOnly.startsWith("/lp/")');
    expect(source).toContain('pathOnly.startsWith("/landing/")');
    expect(source).toContain('const hasQueryParams = rawLocation.includes("?")');
    expect(source).toContain(
      "const shouldIndexLandingPage = !isAliasLandingPath && !hasQueryParams"
    );
    expect(source).toContain("canonical={canonicalLandingUrl}");
    expect(source).toContain("noIndex={!shouldIndexLandingPage}");
  });

  it("keeps the server-rendered public landing fallback aligned with hybrid copy", () => {
    const source = read("server/publicLandingHtml.ts");

    expect(source).toContain("Connection Without Compromise");
    expect(source).toContain("Make A Request");
    expect(source).toContain("Claim my business");
    expect(source).toContain("Made you look");
    expect(source).toContain("free forever");
    expect(source).toContain("Direct Connect");
    expect(source).toContain("/tradescout-logo-circle.png");
    expect(source).not.toContain("Find Any Local Business Near You");
    expect(source).not.toContain("Ask Scout");
    expect(source).not.toContain("Scout interprets");
    expect(source).not.toContain("Scout routes");
    expect(source).not.toContain("Get started with Scout");
    expect(source).not.toContain("routing algorithm");
    expect(source).not.toContain("authority layer");
    expect(source).not.toContain("handoff doctrine");
    expect(source).not.toContain("backend routing system");
    expect(source).not.toContain("operating system architecture");
  });

  it("renders hybrid landing copy into the server HTML body", async () => {
    const templateHtml = `<!doctype html>
<html>
  <head><title>TradeScout</title></head>
  <body>
    <div id="ts-boot-fallback"></div>
    <div id="root"></div>
  </body>
</html>`;

    const html = await buildPublicLandingHtml({
      origin: "https://www.thetradescout.com",
      templateHtml,
      requestPath: "/",
    });

    expect(html).toContain("<h1>Connection Without Compromise</h1>");
    expect(html).toContain('alt="TradeScout logo"');
    expect(html).toContain(">Make A Request</a>");
    expect(html).toContain(">Claim my business</a>");
    expect(html).toContain("Made you look");
    expect(html).toContain("free forever");
    expect(html).toContain("$1 TradeScout fee");
    expect(html).toContain("$1 purchase fee");
    expect(html).toMatch(/<div id="root">\s*<main/);
    expect(html).not.toContain('flat id="root" TradeScout fee');
    expect(html).not.toContain('id="root" purchase fee');
    expect(html).toContain('href="/direct-connect?source=landing_primary_cta"');
    expect(html).toContain('href="/claim-my-business?source=landing_business"');
    expect(html).toContain("Direct Connect");
    expect(html).not.toContain("Find Any Local Business Near You");
    expect(html).not.toContain("Ask Scout");
    expect(html).not.toContain("Scout routes");
    expect(html).not.toContain("routing algorithm");
    expect(html).not.toContain("authority layer");
    expect(html).not.toContain("handoff doctrine");
    expect(html).not.toContain("backend routing system");
    expect(html).not.toContain("operating system architecture");
  });

  it("serves the reviewed Connection Without Compromise share card", () => {
    const shareImage = fs.readFileSync(
      path.resolve(process.cwd(), "client/public/tradescout-social-preview.png")
    );
    const metadataSources = [
      read("client/index.html"),
      read("client/src/components/PageHead.tsx"),
      read("client/src/components/SEOHelmet.tsx"),
      read("client/src/pages/TradePartnerCumulusLanding.tsx"),
      read("server/index.ts"),
      read("server/invoicingDocumentsRouter.ts"),
      read("server/publicCityHtml.ts"),
      read("server/publicContractorPromoHtml.ts"),
      read("server/publicCountyHtml.ts"),
      read("server/publicDatasetsHtml.ts"),
      read("server/publicExchangeHtml.ts"),
      read("server/publicExchangeListingHtml.ts"),
      read("server/publicHandmadeProductHtml.ts"),
      read("server/publicHomeScoutListingHtml.ts"),
      read("server/publicLandingHtml.ts"),
      read("server/publicBestHtml.ts"),
      read("server/publicRecentHtml.ts"),
      read("server/publicTradeCityHtml.ts"),
      read("server/publicTradeHtml.ts"),
    ];
    const requestShareHtml = read("server/workRequestShareHtml.ts");

    expect(shareImage.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(shareImage.readUInt32BE(16)).toBe(1200);
    expect(shareImage.readUInt32BE(20)).toBe(630);
    expect(createHash("sha256").update(shareImage).digest("hex")).toBe(
      "7fd82d236c22abfd8b29c35f609624c50517db22040a512b981472e2727ca806"
    );

    for (const source of metadataSources) {
      expect(source).toContain("/tradescout-social-preview.png?v=12");
      expect(source).not.toContain("/tradescout-social-preview.png?v=11");
    }
    expect(requestShareHtml).toContain(
      "/images/social/request/${encodeURIComponent(shareToken)}.png"
    );
    expect(requestShareHtml).not.toContain("/tradescout-social-preview.png?v=12");
  });

  it("keeps social previews separate from missing member avatars", () => {
    const avatarSources = [read("server/routes.ts"), read("server/routes/worker-tasks.ts")];
    const avatarComponent = read("client/src/components/ui/avatar.tsx");

    for (const source of avatarSources) {
      expect(source).toContain('CANONICAL_DEFAULT_PROFILE_IMAGE_URL = ""');
      expect(source).toContain('"/tradescout-social-preview.png"');
      expect(source).not.toContain(
        'CANONICAL_DEFAULT_PROFILE_IMAGE_URL = "/tradescout-social-preview.png?v=12"'
      );
    }

    expect(avatarComponent).toContain('"/tradescout-social-preview.png"');
    expect(avatarComponent).toContain("return undefined");
  });
});
