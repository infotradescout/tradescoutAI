import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("business profile gallery sharing contract", () => {
  it("renders gallery media on the profile with exact Share actions", () => {
    const page = read("client/src/pages/BusinessProfileView.tsx");

    expect(page).toContain("listProfileGalleryItems(profileContentBlocks)");
    expect(page).toContain("createProfileGalleryItemShareMetadata({");
    expect(page).toContain("business-gallery-${galleryItem.slug}");
    expect(page).toContain("buildProfileGalleryShareSearch(galleryItem.slug)");
    expect(page).toContain("<ShareButton");
    expect(page).toContain("<img");
    expect(page).toContain("Shared image");
  });

  it("passes a validated selector into SSR and preserves it across canonical redirects", () => {
    const serverIndex = read("server/index.ts");
    const publicHtml = read("server/publicBusinessHtml.ts");

    expect(serverIndex).toContain("normalizeProfileGalleryItemSlug(req.query.gallery)");
    expect(serverIndex).toContain("gallerySlug,");
    expect(serverIndex).toContain("${gallerySearch}");
    expect(publicHtml).toContain("createProfileGalleryItemShareMetadata({");
    expect(publicHtml).toContain('galleryMeta ? "article" : "profile"');
    expect(publicHtml).toContain("galleryJsonLd");
  });

  it("keeps private profiles out of public SSR and retains protected contact", () => {
    const publicHtml = read("server/publicBusinessHtml.ts");
    const businessRoute = read("server/routes/business-profile.ts");

    expect(publicHtml).toContain('published?.visibility === "public"');
    expect(publicHtml).toContain("Contact is protected through TradeScout Direct Connect.");
    expect(businessRoute).toContain('profile.visibility !== "public"');
    expect(businessRoute).toContain("sanitizePublicContentBlocks");
  });
});
