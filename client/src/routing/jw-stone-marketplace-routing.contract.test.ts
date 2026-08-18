import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("JW Stone marketplace routing contract", () => {
  it("classifies platform and custom-domain public surfaces", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain("isJwStoneProfileRoute");
    expect(appSource).toContain('pathOnly === "/jw-stone"');
    expect(appSource).toContain('pathOnly.startsWith("/jw-stone/")');
    expect(appSource).toMatch(/const isPublicProfileRoute\s*=\s*isJwStoneProfileRoute\s*\|\|/);
    expect(appSource).toContain("isPublicProfileRoute");
    expect(appSource).not.toContain("isJwStoneMarketplaceRoute");
    expect(appSource).toContain("useLayoutEffect");
  });

  it("keeps the flagship profile route free of platform overlays", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain(
      "!isPublicProfileRoute && !isCustomDomainProfileRoute && isAuthenticated && user?.id && ("
    );
    expect(appSource).toContain(
      "!isPublicProfileRoute && !isCustomDomainProfileRoute && FEATURE_HOLD_TO_EXPLAIN"
    );
    expect(appSource).toContain(
      "!isPublicProfileRoute && !isCustomDomainProfileRoute && FEATURE_HOLD_INTRO_TUTORIAL"
    );
    expect(appSource).toContain("Keep the flagship JW experience free of platform overlays.");
  });

  it("keeps custom domains ahead of existing profile routes", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const customDomainBranch = routesSource.indexOf("{isCustomDomainProfileRoute ? (");
    const standaloneProfileBranch = routesSource.indexOf(") : isStandaloneProfileRoute ? (");
    const publicCampaignBranch = routesSource.indexOf(") : isPublicCampaignRoute ? (");

    expect(customDomainBranch).toBeGreaterThan(-1);
    expect(standaloneProfileBranch).toBeGreaterThan(customDomainBranch);
    expect(publicCampaignBranch).toBeGreaterThan(standaloneProfileBranch);
    expect(routesSource).toContain('<Route path="/u/:slug">');
    expect(routesSource).toContain('<Route path="/p/:slug">');
  });

  it("loads the public JW home through /u/:slug and keeps marketplace data on the profile surface", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const pageSource = read("client/src/pages/JWStoneMarketplace.tsx");
    const marketplaceSource = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const profileSource = read("client/src/pages/ProfileSiteView.tsx");
    const canonicalBusiness = read("server/services/canonicalBusinessProfileRoute.ts");
    const serverIndex = read("server/index.ts");

    expect(routesSource).not.toContain("const JWStoneMarketplace");
    expect(routesSource).not.toContain("resolveJwStonePublicStorefrontRedirect");
    expect(routesSource).toContain('Route path="/u/:slug"');
    expect(routesSource).toContain('Route path="/p/:slug"');

    expect(pageSource).toContain(
      'import JWStoneMarketplace from "../features/jw-stone/JWStoneMarketplace";'
    );
    expect(marketplaceSource).toContain('import { StoneCollection } from "./StoneCollection";');
    expect(marketplaceSource).not.toContain("MarketplaceTrustSection");
    expect(marketplaceSource).not.toMatch(/CustomerPathGuide|BuyerJourney|BuyerWorkspace/);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/features/jw-stone-2"))).toBe(
      false
    );
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/jw-stone-2"))).toBe(false);
    expect(canonicalBusiness).toContain('path: "/jw-stone"');
    expect(serverIndex).toContain('app.get("/jw-stone"');
    expect(serverIndex).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(profileSource).not.toContain("features/jw-stone/JWStoneMarketplace");
  });
});
