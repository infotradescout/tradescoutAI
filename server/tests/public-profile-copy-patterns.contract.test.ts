import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const profileCopySources = [
  "shared/localServiceProfile.ts",
  "shared/jrsAutoGlassProfile.ts",
  "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
  "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
  "client/src/pages/profile-sites/ProFabProfileTheme.tsx",
  "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx",
  "client/src/pages/profile-sites/VideographerProfileTheme.tsx",
  "client/src/pages/ProfileSiteView.tsx",
  "client/src/pages/PublicProfileView.tsx",
  "client/src/pages/BusinessProfileView.tsx",
  "client/src/pages/HelperPublicProfile.tsx",
  "client/src/pages/contractor-profile.tsx",
  "server/services/laPlumbingProfileProvisioning.ts",
];

describe("public profile copy patterns", () => {
  it("keeps the generic 'built for/to/around' slogan formula off public profiles", () => {
    for (const relativePath of profileCopySources) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      expect(source, relativePath).not.toMatch(/\bbuilt\s+(?:for|to|around)\b/i);
    }
  });

  it("keeps every public-profile contact action named Direct Connect", () => {
    const forbiddenButtonLabels = [
      />\s*Request Booking\s*</i,
      />\s*Start a Request\s*</i,
      />\s*Request via Direct Connect\s*</i,
      />\s*Create Account to Connect\s*</i,
    ];

    for (const relativePath of profileCopySources) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
      for (const forbiddenLabel of forbiddenButtonLabels) {
        expect(source, relativePath).not.toMatch(forbiddenLabel);
      }
    }
  });

  it("keeps deprecated trust-card filler off the public profile experience", () => {
    const trustSurfaces = [
      "client/src/components/profile/PublicProfileTrustActions.tsx",
      "client/src/pages/profile-sites/LocalServiceProfileTheme.tsx",
      "client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx",
      "client/src/pages/profile-sites/ProFabProfileTheme.tsx",
      "client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx",
      "client/src/pages/profile-sites/VideographerProfileTheme.tsx",
    ].map((relativePath) => read(relativePath));
    const publicCopy = trustSurfaces.join("\n");

    expect(publicCopy).toContain("Community Verification Score");
    expect(publicCopy).not.toContain("TradeScout Trust Snapshot");
    expect(publicCopy).not.toContain("The useful proof, without the sales fog.");
    expect(publicCopy).not.toContain("You&apos;re here early");
  });
});
