import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile item sharing contract", () => {
  it("passes item selection into SSR on canonical and custom profile domains", () => {
    const serverEntry = read("server/index.ts");

    expect(serverEntry).toContain("itemSlug: req.query.stone");
    expect(serverEntry).toContain("itemPhoto: req.query.photo");
    expect(serverEntry).toContain("gallerySlug: req.query.gallery");
    expect(serverEntry).toContain("requestSearchSuffix(req)");
    expect(serverEntry).toContain("`https://${customDomain}/${requestSearchSuffix(req)}`");
  });

  it("keeps exact item context in hydrated canonical and Open Graph URLs", () => {
    const helmet = read("client/src/components/SEOHelmet.tsx");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(helmet).toContain("preserveCanonicalQuery");
    expect(helmet).toContain("if (!preserveSearch) parsed.search");
    expect(profileView).toContain("preserveCanonicalQuery={Boolean(itemShareMeta)}");
    expect(profileView).toContain("galleryItemShareMeta");
    expect(profileView).toContain("categoryShareMeta");
    expect(profileView).toContain("const pageOgType = inventoryItemShareMeta");
    expect(profileView).toContain("profileImageUrl: profile.seoMeta?.imageUrl");
    expect(profileView).toContain(
      ": profileSocialPresentation.profileImageUrl || legacyProfileSeoImage"
    );
  });

  it("keeps item and category context visible and actionable outside wholesaler templates", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(profileView).toContain('data-testid="public-profile-inventory-context"');
    expect(profileView).toContain('siteTemplate !== "wholesaler"');
    expect(profileView).toContain("categoryInventoryItems.map((item)");
    expect(profileView).toContain("currentPageShareDestination");
    expect(profileView).toContain("initialStoneName={expressInventoryContext?.itemName}");
    expect(profileView).toContain("initialItemId={expressInventoryContext?.itemId}");
    expect(profileView).toContain(
      'initialRequestType={expressInventoryContext ? "request_material" : null}'
    );
  });

  it("shares and reopens the exact selected inventory photo", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");

    expect(theme).toContain("buildProfilePublicItemPath({");
    expect(theme).toContain("profileInventoryShareIndexForDisplay(");
    expect(theme).toContain("openImageIndex");
    expect(theme).toContain('params.get("photo")');
    expect(theme).toContain("setOpenImageIndex(sharedItem.imageIndex)");
  });

  it("shares exact profile gallery images with their own preview and visible destination", () => {
    const serverEntry = read("server/index.ts");
    const profileHtml = read("server/publicProfileHtml.ts");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const defaultTheme = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
    const autoGlassTheme = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const videographerTheme = read("client/src/pages/profile-sites/VideographerProfileTheme.tsx");

    expect(serverEntry).toContain("gallerySlug: req.query.gallery");
    expect(profileHtml).toContain("createProfileGalleryItemShareMetadata");
    expect(profileHtml).toContain('data-seo-profile-item="${itemShare.itemType}"');
    expect(profileHtml).toContain('"@type": "ImageObject"');
    expect(profileView).toContain("buildProfilePublicItemPath({");
    expect(profileView).toContain("renderGalleryShare={(item) => (");
    expect(defaultTheme).toContain("profile-gallery-${item.slug}");
    expect(defaultTheme).toContain("{renderGalleryShare(item)}");
    expect(profileView).toContain("sharedGallerySlug={sharedGallerySlug}");
    expect(theme).toContain("buildProfilePublicItemPath({");
    expect(theme).toContain("profile-gallery-${item.slug}");
    expect(theme).toContain("<ShareButton");
    expect(autoGlassTheme).toContain("buildProfilePublicItemPath({");
    expect(autoGlassTheme).toContain("profile-gallery-${item.slug}");
    expect(autoGlassTheme).toContain("<ShareButton");
    expect(videographerTheme).toContain("buildProfilePublicItemPath({");
    expect(videographerTheme).toContain("profile-gallery-${item.slug}");
    expect(videographerTheme).toContain("<ShareButton");
  });

  it("gives icon-only share actions an accessible name", () => {
    const shareButton = read("client/src/components/ShareButton.tsx");

    expect(shareButton).toContain("const accessibleLabel =");
    expect(shareButton).toContain("aria-label={accessibleLabel}");
    expect(shareButton).toContain("title={accessibleLabel}");
  });

  it("falls back to a visible copy path when native sharing fails", () => {
    const shareCard = read("client/src/components/share/ShareCardHost.tsx");

    expect(shareCard).toContain('if (error?.name === "AbortError") return;');
    expect(shareCard).toContain("await navigator.clipboard.writeText(payload.url)");
    expect(shareCard).toContain('title: "Could not copy the link"');
    expect(shareCard).not.toContain(
      "navigator.share({ title: payload.title, text: payload.text, url: payload.url }).catch"
    );
  });

  it("extends exact-image sharing to helper portfolio items without exposing contact", () => {
    const serverEntry = read("server/index.ts");
    const helperHtml = read("server/publicHelperProfileHtml.ts");
    const helperPage = read("client/src/pages/HelperPublicProfile.tsx");

    expect(serverEntry).toContain('app.get("/helpers/:workerId"');
    expect(serverEntry).toContain("portfolioSlug: req.query.portfolio");
    expect(helperPage).toContain("buildProfilePortfolioShareSearch(item)");
    expect(helperPage).toContain("portfolioShareMeta?.itemSlug");
    expect(helperPage).toContain("<ShareButton");
    expect(helperPage).toContain("Shared portfolio item");
    expect(helperHtml).toContain("workers.portfolioItems");
    expect(helperHtml).not.toContain("workers.phone");
    expect(helperHtml).not.toContain("workers.email");
    expect(helperHtml).toContain('"@type": "CreativeWork"');
    expect(helperHtml).toContain('const ogType = itemShare ? "article" : "profile";');
  });
});
