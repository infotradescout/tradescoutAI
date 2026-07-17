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
    expect(serverEntry).toContain("requestSearchSuffix(req)");
    expect(serverEntry).toContain("`https://${customDomain}/${requestSearchSuffix(req)}`");
  });

  it("keeps item query parameters in hydrated canonical and Open Graph URLs", () => {
    const helmet = read("client/src/components/SEOHelmet.tsx");
    const profileView = read("client/src/pages/ProfileSiteView.tsx");

    expect(helmet).toContain("preserveCanonicalQuery");
    expect(helmet).toContain("if (!preserveSearch) parsed.search");
    expect(profileView).toContain("preserveCanonicalQuery={Boolean(itemShareMeta)}");
    expect(profileView).toContain('ogType={itemShareMeta ? "product" : "profile"}');
  });

  it("shares and reopens the exact selected inventory photo", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(theme).toContain("buildProfileInventoryShareSearch(");
    expect(theme).toContain("openImageIndex");
    expect(theme).toContain('params.get("photo")');
    expect(theme).toContain("setOpenImageIndex(sharedItem.imageIndex)");
  });

  it("gives icon-only share actions an accessible name", () => {
    const shareButton = read("client/src/components/ShareButton.tsx");

    expect(shareButton).toContain("const accessibleLabel =");
    expect(shareButton).toContain("aria-label={accessibleLabel}");
    expect(shareButton).toContain("title={accessibleLabel}");
  });

  it("falls back to a visible copy path when native sharing fails", () => {
    const shareButton = read("client/src/components/ShareButton.tsx");

    expect(shareButton).toContain('if (err?.name === "AbortError") return;');
    expect(shareButton).toContain("await navigator.clipboard.writeText(shareUrl)");
    expect(shareButton).toContain('title: "Unable to share automatically"');
    expect(shareButton).not.toContain(
      "navigator.share({ title, text, url: shareUrl }).catch(() => {})"
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
