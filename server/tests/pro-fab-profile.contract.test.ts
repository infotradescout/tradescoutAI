import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const exists = (relativePath: string) => fs.existsSync(path.resolve(process.cwd(), relativePath));

describe("Pro Fab Specialty Services public profile contract", () => {
  it("provisions the managed owner, active business, and published public profile", () => {
    const provisioning = read("server/services/proFabProfileProvisioning.ts");
    const managedProfileBootstrap = read("server/services/jrsAutoGlassProfileProvisioning.ts");

    expect(provisioning).toContain(
      'const PRO_FAB_PROFILE_SLUG = "pro-fab-specialty-services"'
    );
    expect(provisioning).toContain('name: "Pro Fab Specialty Services LLC"');
    expect(provisioning).toContain('displayName: "Pro Fab Specialty Services LLC"');
    expect(provisioning).toContain('status: "active"');
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('profileVisibility: "public"');
    expect(provisioning).toContain("activeBusinessId: business.id");
    expect(provisioning).toContain("activeProfileId: profile.id");
    expect(provisioning).toContain("tradePartner: true");
    expect(managedProfileBootstrap).toContain('import { provisionProFabProfile }');
    expect(managedProfileBootstrap).toContain("await provisionProFabProfile()");
  });

  it("routes the canonical profile through the Pro Fab theme and service-specific Express Direct Connect", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const themeRouter = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const theme = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");

    expect(profileView).toContain("isTradePartner(business)");
    expect(profileView).toContain("<WholesalerProfileTheme");
    expect(themeRouter).toContain('profileSlug !== "pro-fab-specialty-services"');
    expect(themeRouter).toContain("<ProFabProfileTheme");
    expect(themeRouter).toContain('requestMode="service"');
    expect(theme).toContain("Request welding or fabrication");
    expect(theme).toContain("Direct Connect with Pro Fab");
    expect(theme).toContain("TradeScout Business CV");
    expect(theme).toContain("Send the project details first");
  });

  it("uses supplied Pro Fab identity artwork without exposing direct contact details", () => {
    const theme = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");
    const provisioning = read("server/services/proFabProfileProvisioning.ts");
    const publicSurface = `${theme}\n${provisioning}`;

    expect(theme).toContain("/images/businesses/pro-fab-specialty-services");
    expect(theme).toContain("logo.svg");
    expect(theme).toContain("cover.svg");
    expect(theme).toContain("capabilities.svg");
    expect(exists("client/public/images/businesses/pro-fab-specialty-services/logo.svg")).toBe(
      true
    );
    expect(exists("client/public/images/businesses/pro-fab-specialty-services/cover.svg")).toBe(
      true
    );
    expect(
      exists("client/public/images/businesses/pro-fab-specialty-services/capabilities.svg")
    ).toBe(true);
    expect(publicSurface).not.toContain("Brody@wwwprofab.com");
    expect(publicSurface).not.toContain("985-320-1733");
    expect(publicSurface).not.toContain("985-320-1743");
    expect(theme.toLowerCase()).not.toContain("star rating");
    expect(theme.toLowerCase()).not.toContain("review count");
  });

  it("publishes the supplied service scope and Hammond service area without fabricated proof", () => {
    const theme = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");
    const provisioning = read("server/services/proFabProfileProvisioning.ts");

    expect(theme).toContain("Custom metal fabrication");
    expect(theme).toContain("Structural steel fabrication & installation");
    expect(theme).toContain("Pipe fabrication & process piping");
    expect(theme).toContain("MIG, TIG, stick & flux-core welding");
    expect(theme).toContain("Mobile on-site welding & field service");
    expect(theme).toContain("Equipment & heavy machinery repairs");
    expect(theme).toContain("Plant maintenance & shutdown support");
    expect(theme).toContain("Industrial maintenance & emergency repair");
    expect(theme).toContain("Hammond, Louisiana and surrounding areas");
    expect(theme).toContain("Industrial");
    expect(theme).toContain("Commercial");
    expect(theme).toContain("Residential");
    expect(provisioning).toContain("verifiedBadge: false");
    expect(provisioning).toContain("emailVerified: false");
    expect(provisioning).toContain("addressVerified: false");
    expect(theme).not.toContain("Licensed");
    expect(theme).not.toContain("Insured");
    expect(theme).not.toContain("Guaranteed");
  });

  it("preserves the existing shared TradePartner profile implementation", () => {
    const themeRouter = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const themeCore = read("client/src/pages/profile-sites/WholesalerProfileThemeCore.tsx");

    expect(themeRouter).toContain("<WholesalerProfileThemeCore {...props} />");
    expect(themeCore).toContain('const isJwStone = profileSlug === "jw-stone"');
    expect(themeCore).toContain("JW_STONE_FEATURED_OFFERS");
    expect(themeCore).toContain("Browse full inventory");
  });
});
