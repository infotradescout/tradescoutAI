import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile TradeScout footer", () => {
  const footerSource = read("client/src/pages/profile-sites/TradeScoutProfileHandoff.tsx");
  const routeSource = read("client/src/AppRoutes.tsx");

  it("renders one qualified Powered by TradeScout link without another action path", () => {
    expect(footerSource.match(/<a/g)).toHaveLength(1);
    expect(footerSource.match(/Powered by TradeScout/g)).toHaveLength(1);
    expect(footerSource).toContain('qualifyPublicProfileItemDestination("/", platformBaseHref)');
    for (const href of ["/scout", "/community-feed", "/exchange", "/homes"]) {
      expect(footerSource).not.toContain(href);
    }
    expect(footerSource).not.toContain("appendPublicProfileContinuation");
    expect(footerSource).not.toContain("business_profile_call");
    expect(footerSource).not.toContain("destinations.map");
    expect(footerSource).not.toContain("Direct Connect");
    expect(footerSource).not.toContain("/direct-connect");
  });

  it("covers every public profile-site renderer", () => {
    for (const relativePath of [
      "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
      "client/src/pages/profile-sites/ProFabProfileTheme.tsx",
      "client/src/pages/profile-sites/VideographerProfileTheme.tsx",
      "client/src/pages/profile-sites/PrecisionAerialProfile.tsx",
      "client/src/pages/ProfileSiteView.tsx",
    ]) {
      expect(read(relativePath), relativePath).toContain("<TradeScoutProfileHandoff");
    }

    expect(read("client/src/pages/profile-sites/DefaultProfileTheme.tsx")).toContain(
      "{tradeScoutHandoff}"
    );

    for (const [relativePath, footerTestId] of [
      [
        "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx",
        'data-testid="wholesaler-brand-footer"',
      ],
      [
        "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
        'data-testid="local-service-brand-footer"',
      ],
    ] as const) {
      const source = read(relativePath);
      expect(source, relativePath).not.toContain("<TradeScoutProfileHandoff");
      expect(source, relativePath).toContain(footerTestId);
      expect(source.match(/Powered by TradeScout/g), relativePath).toHaveLength(1);
      expect(source, relativePath).toContain(
        'qualifyPublicProfileItemDestination("/", platformBaseHref)'
      );
    }

    // Premium sections are nested content and never own site-level footer chrome.
    expect(read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx")).not.toContain(
      "<TradeScoutProfileHandoff"
    );
  });

  it("covers every legacy public profile success renderer without touching editors", () => {
    const legacyRenderers = [
      ["client/src/pages/PublicProfileView.tsx", "/profile/:userId"],
      ["client/src/pages/BusinessProfileView.tsx", "/business/:slug"],
      ["client/src/pages/contractor-profile.tsx", "/contractors/:slug"],
      ["client/src/pages/HelperPublicProfile.tsx", "/helpers/:id"],
      ["client/src/pages/CommunityProfile.tsx", "/community/u/:userId"],
    ] as const;

    for (const [relativePath, routePath] of legacyRenderers) {
      const source = read(relativePath);
      expect(source, relativePath).toContain(
        'import TradeScoutProfileHandoff from "@/pages/profile-sites/TradeScoutProfileHandoff"'
      );
      expect(source, relativePath).toContain("<TradeScoutProfileHandoff");
      expect(routeSource).toContain(`path="${routePath}"`);
    }

    for (const protectedPath of [
      "client/src/pages/ProfileSiteEditor.tsx",
      "client/src/pages/BusinessProfileEditor.tsx",
    ]) {
      expect(read(protectedPath), protectedPath).not.toContain("<TradeScoutProfileHandoff");
    }
  });

  it("renders as a compact single-link site footer", () => {
    expect(footerSource).toContain("<footer");
    expect(footerSource).toContain("mt-auto");
    expect(footerSource).toContain("justify-center");
    expect(footerSource).not.toContain("<nav");
    expect(footerSource).not.toContain("grid-cols-4");
  });
});
