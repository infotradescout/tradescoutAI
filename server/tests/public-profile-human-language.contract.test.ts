import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile human-language contract", () => {
  it("treats a failed load as retryable and an unavailable link without future claims", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const serverEntry = read("server/index.ts");
    const profileHtml = read("server/publicProfileHtml.ts");

    expect(profileView).toContain("setLoadFailed(true)");
    expect(profileView).toContain("This page took a quick pit stop.");
    expect(profileView).toContain("Try again");
    expect(profileView).toContain("This public profile is not available.");
    expect(profileView).not.toContain("No private account details are exposed here.");
    expect(profileView).toContain("Browse the Community");
    expect(profileView).toContain("Report this link");
    expect(profileView).toContain('fetch("/api/error-reports"');
    expect(profileView).not.toContain("Profile not found");
    expect(profileView).not.toMatch(/opening soon|opening day|finishing touches|finished profile/i);
    expect(serverEntry).toContain("buildPublicProfileEarlyHtml({ slug, origin, templateHtml })");
    expect(serverEntry).not.toContain('res.status(404).send("Profile not found")');
    expect(profileHtml).toContain('data-public-profile-state="unavailable"');
    expect(profileHtml).toContain("This public profile is not available.");
    expect(profileHtml).not.toMatch(/opening soon|opening day|finishing touches|finished profile/i);
    expect(profileHtml).toContain("Browse the Community");
    expect(profileHtml).toContain('id="ts-report-link"');
    expect(profileHtml).toContain('fetch("/api/error-reports"');
  });

  it("shows useful profile facts without internal labels or fake zero-value stats", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const defaultTheme = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx");

    expect(profileView).toContain('const profileTypeLabel = business ? "Local business"');
    expect(profileView).toContain("const quickFacts = [");
    expect(profileView).toContain("stats={quickFacts}");
    expect(defaultTheme).not.toContain("Choose a service to start a private request");
    expect(defaultTheme).not.toContain("Your details stay private until the business responds.");
    expect(defaultTheme).not.toContain("TradeScout securely holds requests");
    expect(defaultTheme).toContain("businessInitials(businessName)");
    for (const source of [profileView, defaultTheme]) {
      expect(source).not.toContain("after the business accepts");
      expect(source).not.toContain("Website Profile");
      expect(source).not.toContain("Business Snapshot");
      expect(source).not.toContain("None listed");
      expect(source).not.toContain("Super Admin oversight is active");
      expect(source).not.toContain("TradeScout activity");
    }
  });

  it("keeps paid profile themes customer-facing", () => {
    const stoneTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
    const jwPresentation = read("client/src/data/jwStoneProfilePresentation.ts");
    const autoGlassTheme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const requestPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(stoneTheme).toContain("What customers say");
    expect(stoneTheme).toContain("`Tell ${displayName} what you need`");
    expect(jwPresentation).toContain("Tell JW Stone what you need");
    expect(stoneTheme).not.toContain("Recommendations Directory");
    expect(autoGlassTheme).toContain("Customer recommendations");
    expect(autoGlassTheme).toContain("Ready when you are");
    expect(autoGlassTheme).not.toContain("TradeScout Business CV");
    expect(requestPanel).toContain("Direct Connect");
    expect(requestPanel).toContain("Call");
    expect(requestPanel).toContain("Fill out the form");
    expect(requestPanel).toContain("Make A Request");
    expect(requestPanel).not.toContain("Your details are still here");
    expect(requestPanel).not.toContain("Signup comes after send");
    expect(requestPanel).not.toContain("Express Direct Connect");
  });
});
