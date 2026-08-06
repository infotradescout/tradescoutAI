import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("JW Stone marketplace routing contract", () => {
  it("classifies platform and custom-domain marketplace surfaces", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain("__TS_JW_STONE_MARKETPLACE_SURFACE__");
    expect(appSource).toContain('pathOnly === "/jw-stone"');
    expect(appSource).toContain('pathOnly.startsWith("/jw-stone/")');
    expect(appSource).toMatch(/const isPublicProfileRoute\s*=\s*isJwStoneMarketplaceRoute\s*\|\|/);
    expect(appSource).toContain("isJwStoneMarketplaceRoute={isJwStoneMarketplaceRoute}");
    expect(appSource).toContain('root.classList.add("jw-marketplace-scroll")');
    expect(appSource).toContain("useLayoutEffect");
  });

  it("keeps the flagship route free of platform overlays", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain("!isJwStoneMarketplaceRoute && isAuthenticated && user?.id && (");
    expect(appSource).toContain("!isJwStoneMarketplaceRoute && FEATURE_HOLD_TO_EXPLAIN");
    expect(appSource).toContain("!isJwStoneMarketplaceRoute && FEATURE_HOLD_INTRO_TUTORIAL");
    expect(appSource).toMatch(
      /Keep the flagship JW experience free of platform overlays[\s\S]*!isJwStoneMarketplaceRoute && \(/
    );
  });

  it("keeps custom domains ahead of JW Stone and existing profile routes", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const customDomainBranch = routesSource.indexOf("{isCustomDomainProfileRoute ? (");
    const jwStoneBranch = routesSource.indexOf(") : isJwStoneMarketplaceRoute ? (");
    const standaloneProfileBranch = routesSource.indexOf(") : isStandaloneProfileRoute ? (");

    expect(customDomainBranch).toBeGreaterThan(-1);
    expect(jwStoneBranch).toBeGreaterThan(customDomainBranch);
    expect(standaloneProfileBranch).toBeGreaterThan(jwStoneBranch);
    expect(routesSource).toContain('<Route path="/u/:slug">');
    expect(routesSource).toContain('<Route path="/p/:slug">');
  });

  it("loads the separate marketplace feature without routing the legacy profile through it", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const pageSource = read("client/src/pages/JWStoneMarketplace.tsx");
    const marketplaceSource = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const profileSource = read("client/src/pages/ProfileSiteView.tsx");

    expect(routesSource).toMatch(
      /const JWStoneMarketplace = React\.lazy\(\s*\(\) => import\("\.\/pages\/JWStoneMarketplace"\)\s*\)/
    );
    expect(pageSource).toContain(
      'import JWStoneMarketplace from "../features/jw-stone/JWStoneMarketplace";'
    );
    expect(marketplaceSource).toContain('import { StoneCollection } from "./StoneCollection";');
    expect(marketplaceSource).toContain("MarketplaceTrustSection");
    expect(marketplaceSource).not.toMatch(/CustomerPathGuide|BuyerJourney|BuyerWorkspace/);
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/features/jw-stone-2"))).toBe(
      false
    );
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/jw-stone-2"))).toBe(false);
    expect(routesSource).not.toContain('RedirectTo to="/jw-stone"');
    expect(profileSource).not.toContain("features/jw-stone/JWStoneMarketplace");
  });
});
