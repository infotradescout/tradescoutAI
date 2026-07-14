import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("JR's Auto Glass public profile contract", () => {
  it("provisions the confirmed owner, business, and published profile at production boot", () => {
    const provisioning = read("server/services/jrsAutoGlassProfileProvisioning.ts");
    const developmentEntry = read("server/index.ts");
    const productionEntry = read("server/index.prod.ts");

    expect(provisioning).toContain('const JRS_PROFILE_SLUG = "jrs-auto-glass"');
    expect(provisioning).toContain('displayName: "JR\'s Auto Glass"');
    expect(provisioning).toContain('status: "published"');
    expect(provisioning).toContain('profileVisibility: "public"');
    expect(provisioning).toContain("activeBusinessId: business.id");
    expect(provisioning).toContain("activeProfileId: profile.id");
    expect(developmentEntry).toContain("await provisionJrsAutoGlassProfile()");
    expect(productionEntry).toContain("await provisionJrsAutoGlassProfile()");
  });

  it("mounts the branded theme on the canonical dynamic route", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");

    expect(profileView).toContain("import JrsAutoGlassProfileTheme");
    expect(profileView).toContain('profile.slug === "jrs-auto-glass"');
    expect(profileView).toContain("<JrsAutoGlassProfileTheme");
    expect(theme).toContain("/images/businesses/jrs-auto-glass/logo.svg");
    expect(theme).toContain("Skip the national-chain runaround.");
    expect(theme).toContain("Direct Connect with JR&apos;s");
    expect(
      fs.existsSync(path.resolve(process.cwd(), "client/public/u/jrs-auto-glass/index.html"))
    ).toBe(false);
  });

  it("publishes confirmed public proof without exposing direct contact details", () => {
    const theme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const provisioning = read("server/services/jrsAutoGlassProfileProvisioning.ts");
    const publicSurface = `${theme}\n${provisioning}`;

    expect(theme).toContain("4.8 Google rating");
    expect(theme).toContain("17 Google reviews");
    expect(publicSurface).toContain("Ponchatoula");
    expect(theme).toContain("Mobile auto glass");
    expect(theme).toContain("Windshield replacement");
    expect(publicSurface).not.toContain("985");
    expect(publicSurface).not.toContain("S Range Rd");
    expect(publicSurface).not.toContain("jrs.autoglass3");
    expect(theme).not.toContain("Affordable pricing");
  });

  it("routes a profile CTA to its owner through a private Direct Connect assignment", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const composer = read("client/src/pages/direct-connect/DirectConnectShell.tsx");
    const route = read("server/routes/direct-connect.ts");

    expect(profileView).toContain("const jrsDirectConnectTarget = business?.directConnectOwnerUserId");
    expect(profileView).toContain("target=${encodeURIComponent(business.directConnectOwnerUserId)}");
    expect(profileView).toContain("Vehicle year, make, model, and VIN (if available)");
    expect(profileView).toContain("Camera or sensors near the glass");
    expect(profileView).toContain("Insurance claim or self-pay");
    expect(composer).toContain("payload.targetProfileSlug = prefillContextId.trim()");
    expect(route).toContain("targetProfileSlug:");
    expect(route).toContain("await storage.getProfileBySlugPublic(body.targetProfileSlug)");
    expect(route).toContain('scope: isExplicitTarget ? "personal" : "community"');
    expect(route).toContain('visibility: isExplicitTarget ? "private" : "community"');
    expect(route).toContain("responderUserId: targetProfileOwnerUserId");
    expect(route).toContain('routingMode: "profile_direct_connect"');
    expect(route).toContain('source: "profile_direct_connect"');
  });
});
