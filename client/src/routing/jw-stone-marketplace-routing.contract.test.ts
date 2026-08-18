import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");

describe("JW Stone 2.0 profile routing contract", () => {
  it("classifies platform and custom-domain JW routes as public profile surfaces", () => {
    const appSource = read("client/src/App.tsx");

    expect(appSource).toContain("isJwStoneProfileRoute");
    expect(appSource).toContain('pathOnly === "/jw-stone"');
    expect(appSource).toContain('pathOnly.startsWith("/jw-stone/")');
    expect(appSource).toMatch(/const isPublicProfileRoute\s*=\s*isJwStoneProfileRoute\s*\|\|/);
    expect(appSource).not.toContain("isJwStoneMarketplaceRoute");
  });

  it("keeps custom domains and profile routes ahead of unrelated application surfaces", () => {
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

  it("selects the modern JW Stone 2.0 renderer inside the canonical profile entry point", () => {
    const selectorSource = read("client/src/pages/ProfileSiteView.tsx");
    const legacySource = read("client/src/pages/ProfileSiteViewLegacy.tsx");
    const jwProfileSource = read("client/src/features/jw-stone/JWStoneProfile.tsx");
    const experienceSource = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");

    expect(selectorSource).toContain('import("@/features/jw-stone/JWStoneProfile")');
    expect(selectorSource).toContain('import("./ProfileSiteViewLegacy")');
    expect(selectorSource).toContain("profileSlug === JW_STONE_PROFILE_SLUG");
    expect(selectorSource).toContain("<JWStoneProfile />");
    expect(legacySource).toContain("<WholesalerProfileTheme");
    expect(jwProfileSource).toContain('import JWStoneProfileExperience from "./JWStoneMarketplace"');
    expect(jwProfileSource).toContain("<JWStoneProfileExperience />");
    expect(experienceSource).toContain('import { StoneCollection } from "./StoneCollection";');
    expect(experienceSource).toContain("<JwStoneCompanySection />");
    expect(experienceSource).toContain("<JwStoneStorySection />");
  });

  it("writes profile-owned stone and material URLs while continuing to read released aliases", () => {
    const routeSource = read("client/src/features/jw-stone/marketplaceRoutes.ts");

    expect(routeSource).toContain('JW_STONE_PLATFORM_PROFILE_BASE = `/u/${JW_STONE_PROFILE_SLUG}`');
    expect(routeSource).toContain("isJwStoneProfileDomainSurface");
    expect(routeSource).toContain("__TS_CUSTOM_DOMAIN_PROFILE_SLUG__");
    expect(routeSource).toContain('return JW_STONE_PLATFORM_PROFILE_BASE;');
    expect(routeSource).toContain('pathname.startsWith("/jw-stone/")');
    expect(routeSource).toContain('(?:/(?:u|p)/jw-stone)');
  });

  it("keeps the server and custom domain on profile authority instead of a separate marketplace route", () => {
    const routesSource = read("client/src/AppRoutes.tsx");
    const serverIndex = read("server/index.ts");
    const canonicalBusiness = read("server/services/canonicalBusinessProfileRoute.ts");

    expect(routesSource).not.toContain("const JWStoneMarketplace");
    expect(routesSource).not.toContain("ProfileSiteOrJwMarketplaceRedirect");
    expect(serverIndex).toContain('app.get("/jw-stone"');
    expect(serverIndex).toContain("`${origin}/u/${JW_STONE_PROFILE_SLUG}`");
    expect(serverIndex).not.toContain("serveJwStoneMarketplaceCustomDomainPath");
    expect(canonicalBusiness).toContain("path: `/u/${encodeURIComponent(profileSlug)}`");
  });
});
