import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("public profile image sitemap wiring", () => {
  it("serves platform and mapped custom-domain feeds before public route rendering", () => {
    const middleware = read("server/middleware/landingContractHeaders.ts");
    const sitemap = read("server/profileImageSitemap.ts");

    expect(middleware).toContain("handlePublicProfileImageSitemapRequest");
    expect(middleware).toContain("attachPublicProfileImageSitemapReferences");
    expect(middleware).toContain("await handlePublicProfileImageSitemapRequest(req, res)");
    expect(middleware).toContain("/sitemap-profile-images.xml");
    expect(middleware).toContain("/landing/profile-images.xml");
    expect(sitemap).toContain('const PLATFORM_IMAGE_SITEMAP_PATH = "/sitemap-profile-images.xml"');
    expect(sitemap).toContain('const CUSTOM_DOMAIN_IMAGE_SITEMAP_PATH = "/landing/profile-images.xml"');
    expect(sitemap).toContain("mappedProfileDomainSlug");
  });

  it("inherits the same publication and thin-page gates as the public profile graph", () => {
    const sitemap = read("server/profileImageSitemap.ts");

    expect(sitemap).toContain("SitemapRepository");
    expect(sitemap).toContain("shouldIndexPublicProfileSlug");
    expect(sitemap).toContain("buildProfileSitemapUrls");
    expect(sitemap).toContain("isProfileInventoryItemPubliclyAddressable");
    expect(sitemap).toContain("isProfileInventoryCategoryPubliclyAddressable");
    expect(sitemap).toContain("isProfileGalleryItemPubliclyAddressable");
    expect(sitemap).toContain("listFactBearingProfileServices");
  });

  it("advertises the platform feed through sitemap index and robots without deprecated tags", () => {
    const sitemap = read("server/profileImageSitemap.ts");

    expect(sitemap).toContain('path !== "/sitemap.xml"');
    expect(sitemap).toContain('path !== "/robots.txt"');
    expect(sitemap).toContain("xmlns:image");
    expect(sitemap).toContain("<image:image>");
    expect(sitemap).toContain("<image:loc>");
    expect(sitemap).not.toContain("<image:caption>");
    expect(sitemap).not.toContain("<image:title>");
  });
});
