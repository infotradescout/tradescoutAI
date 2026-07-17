import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile human-language contract", () => {
  it("treats a failed load as retryable and an unpublished link as early access", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(profileView).toContain("setLoadFailed(true)");
    expect(profileView).toContain("That page didn&apos;t load");
    expect(profileView).toContain("Try again");
    expect(profileView).toContain("You&apos;re here early");
    expect(profileView).toContain("Check back soon");
    expect(profileView).not.toContain("Profile not found");
    expect(profileView).not.toContain("private, unpublished, or unavailable");
  });

  it("shows useful profile facts without internal labels or fake zero-value stats", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(profileView).toContain('const profileTypeLabel = business ? "Local business"');
    expect(profileView).toContain("const quickFacts = [");
    expect(profileView).toContain("Photos are coming soon.");
    expect(profileView).toContain("Ask about working together");
    expect(profileView).toContain("Send a private request");
    expect(profileView).toContain("after they accept");
    expect(profileView).not.toContain("after the business accepts");
    expect(profileView).not.toContain("Website Profile");
    expect(profileView).not.toContain("Business Snapshot");
    expect(profileView).not.toContain("None listed");
    expect(profileView).not.toContain("Super Admin oversight is active");
    expect(profileView).not.toContain("TradeScout activity");
  });

  it("keeps paid profile themes customer-facing", () => {
    const stoneTheme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const autoGlassTheme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const requestPanel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");

    expect(stoneTheme).toContain("What customers say");
    expect(stoneTheme).toContain("Tell JW Stone what you need");
    expect(stoneTheme).not.toContain("Recommendations Directory");
    expect(autoGlassTheme).toContain("Customer recommendations");
    expect(autoGlassTheme).toContain("Ready when you are");
    expect(autoGlassTheme).not.toContain("TradeScout Business CV");
    expect(requestPanel).toContain("Private request");
    expect(requestPanel).toContain("No account needed to send");
    expect(requestPanel).toContain("Your details are still here");
    expect(requestPanel).not.toContain("Signup comes after send");
    expect(requestPanel).not.toContain("Express Direct Connect");
  });
});
