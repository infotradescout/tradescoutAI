import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("JW Stone marketplace routing contract", () => {
  it("classifies only /jw-stone as the standalone marketplace route", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain('const isJwStoneMarketplaceRoute = pathOnly === "/jw-stone";');
    expect(appSource).toMatch(/const isPublicProfileRoute\s*=\s*isJwStoneMarketplaceRoute\s*\|\|/);
    expect(appSource).toContain("isJwStoneMarketplaceRoute={isJwStoneMarketplaceRoute}");
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

  it("loads the separate feature without routing the current JW profile through it", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const pageSource = read("client/src/pages/jw-stone-2/JwStoneMarketplacePage.tsx");
    const profileSource = read("client/src/pages/ProfileSiteView.tsx");

    expect(routesSource).toMatch(
      /const JWStoneMarketplace = React\.lazy\(\s*\(\) => import\("\.\/pages\/jw-stone-2\/JwStoneMarketplacePage"\)\s*\)/
    );
    expect(pageSource).toContain("data-jw-stone-2");
    expect(pageSource).toContain('import { BuyerWorkspace } from "./BuyerWorkspace";');
    expect(routesSource).not.toContain('RedirectTo to="/jw-stone"');
    expect(profileSource).not.toContain("pages/jw-stone-2/JwStoneMarketplacePage");
  });
});
