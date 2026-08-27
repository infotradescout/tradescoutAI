import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("videographer public profile", () => {
  const theme = read("client/src/pages/profile-sites/VideographerProfileTheme.tsx");
  const profileView = read("client/src/pages/ProfileSiteView.tsx");
  const directConnectPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
  const expressRoute = read("server/routes/tradepartner-express.ts");

  it("is a reusable template wired into the canonical public profile route", () => {
    expect(profileView).not.toMatch(/import VideographerProfileTheme from/);
    expect(profileView).toMatch(
      /const VideographerProfileTheme = lazy\(\s*\(\) => import\("@\/pages\/profile-sites\/VideographerProfileTheme"\)\s*\)/
    );
    expect(profileView).toContain('if (siteTemplate === "videographer")');
    expect(profileView).not.toMatch(/siteTemplate === "videographer"\s*\|\|/);
    expect(profileView).toContain("<VideographerProfileBoundary>");
    expect(profileView).toContain("</VideographerProfileBoundary>");
    expect(profileView).toMatch(
      /data-testid="videographer-profile-loading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/
    );
    expect(profileView).toContain("<VideographerProfileTheme");
    expect(profileView).toContain("services={serviceTags}");
    expect(profileView).toContain("galleryItems={galleryItems}");
    expect(profileView).toContain("sharedGallerySlug={sharedGallerySlug}");
    expect(profileView).toContain("onDirectConnect={openServiceDirectConnect}");
    expect(profileView).toMatch(
      /profileServiceTags\.length > 0\s*\?\s*profileServiceTags\s*:\s*businessServiceTags\.length > 0\s*\?\s*businessServiceTags\s*:\s*publicCategories/
    );
    expect(profileView).toContain('requestMode="service"');
    expect(profileView).toContain("initialServiceName={expressServiceContext}");
  });

  it("puts real portfolio data ahead of services and keeps contact in Direct Connect", () => {
    expect(theme.indexOf('id="work"')).toBeLessThan(theme.indexOf('id="services"'));
    expect(theme).toContain('data-testid="videographer-portfolio"');
    expect(theme).toContain("onDirectConnect");
    expect(theme).toContain("onDirectConnect(service.trim().slice(0, 180))");
    expect(theme).toContain("Direct Connect");
    expect(theme).not.toMatch(/href=["']tel:/);
    expect(theme).not.toMatch(/href=["']mailto:/);
  });

  it("does not hard-code a person, drone business, location, or unsupported capability", () => {
    for (const forbidden of [
      "Precision Aerial",
      "Precision Drone",
      "Cameron",
      "Pensacola",
      "LiDAR",
      "RTK",
      "thermal",
      "mission planning",
    ]) {
      expect(theme).not.toContain(forbidden);
    }
  });

  it("only accepts the two supported social networks from profile data", () => {
    expect(theme).toContain('safeSocialUrl(hero.instagramUrl, ["instagram.com"])');
    expect(theme).toContain('safeSocialUrl(hero.tiktokUrl, ["tiktok.com"])');
  });

  it("preserves the selected offering through the Direct Connect request", () => {
    expect(profileView).toContain("sanitizePublicDiscoveryText(serviceName, 180)");
    expect(directConnectPanel).toContain("initialServiceName?: string | null");
    expect(directConnectPanel).toContain("serviceName: selectedServiceName || undefined");
    expect(expressRoute).toContain("serviceName: z.string().trim().max(180).optional()");
    expect(expressRoute).toContain("serviceName: body.serviceName || null");
    expect(expressRoute).toContain('requestWorkspaceParams.set("service", body.serviceName)');
  });

  it("uses an explicit About block before falling back to hero copy", () => {
    expect(profileView).toContain('const explicitAboutText = readProfileBlockText("about")');
    expect(profileView).toContain('const heroAboutFallback = readProfileBlockText("hero")');
    expect(profileView).toContain("const aboutText = explicitAboutText || heroAboutFallback");
  });
});
