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

  it("keeps private profiles out of public SSR without privacy narration", () => {
    const publicHtml = read("server/publicBusinessHtml.ts");
    const businessRoute = read("server/routes/business-profile.ts");

    expect(publicHtml).toContain('published?.visibility === "public"');
    expect(publicHtml).not.toContain(
      "Your contact details stay private until you choose to connect."
    );
    expect(publicHtml).toContain("You're here early. This listing is being refreshed");
    expect(publicHtml).not.toContain("Contact is protected through TradeScout Direct Connect.");
    expect(publicHtml).toContain("Paid booking deposit:");
    expect(publicHtml).toContain("Address verified on TradeScout.");
    expect(publicHtml).toContain("published.verificationStatus");
    expect(publicHtml).not.toContain("website-ready by default");
    expect(businessRoute).toContain('profile.visibility !== "public"');
    expect(businessRoute).toContain("sanitizePublicContentBlocks");
  });
});
