import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical public profile projection wiring", () => {
  it.each([
    ["server/index.ts", "projectCanonicalPublicProfileRecord"],
    ["server/profileImageSitemap.ts", "projectCanonicalPublicProfileRecord"],
    ["server/profileSitemapDiscovery.ts", "projectCanonicalPublicProfileContentBlocks"],
    [
      "server/publicCustomDomainCanonicalRedirect.ts",
      "normalizeCanonicalPublicProfileCustomDomain",
    ],
    ["server/publicDirectoryProfileServiceLinks.ts", "projectCanonicalPublicProfileContentBlocks"],
    ["server/publicProfileHtml.ts", "buildCanonicalPublicProfileProjection"],
    ["server/publicProfileServiceAreaHtml.ts", "buildCanonicalPublicProfileProjection"],
    ["server/publicProfileServiceAreaLinks.ts", "buildCanonicalPublicProfileProjection"],
    ["server/publicProfileServiceHtml.ts", "buildCanonicalPublicProfileProjection"],
    ["server/publicProfileSocialPreview.ts", "buildCanonicalPublicProfileProjection"],
    ["server/routes/profiles.ts", "buildCanonicalPublicProfileProjection"],
  ])("routes %s through %s", (relativePath, authority) => {
    expect(read(relativePath)).toContain(authority);
  });

  it("never bypasses the projection for an authenticated public-profile viewer", () => {
    const route = read("server/routes/profiles.ts");

    expect(route).toContain("profile: canonicalProjection.profile");
    expect(route).toContain("business: canonicalProjection.business");
    expect(route).toContain(
      "profileItems: projectCanonicalPublicProfilePayloadValue(auxiliaryProfileItems)"
    );
    expect(route).not.toContain(
      "authenticatedViewerCanManage ? publicProfilePayload : canonicalProjection.profile"
    );
    expect(route).not.toContain("authenticatedViewerCanManage ? safeBusiness");
  });

  it("keeps the browser boundary slug-addressed and free of raw business targeting fields", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(profileView).toContain("`profile=${encodeURIComponent(profile.slug)}`");
    expect(profileView).not.toContain("directConnectOwnerUserId?: string");
    expect(profileView).not.toContain("address?: string");
    expect(profileView).not.toContain("zipCode?: string");
  });
});
