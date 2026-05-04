import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (relativePath: string) => {
  const fullPath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(fullPath, "utf-8");
};

describe("business profile public contracts", () => {
  it("business profile route exposes richer public profile fields and visibility gating", () => {
    const source = read("server/routes/business-profile.ts");

    expect(source).toContain('profile.visibility !== "public"');
    expect(source).toContain("sanitizePublicCtaConfig");
    expect(source).toContain("sanitizePublicBookingConfig");
    expect(source).toContain("sanitizePublicContentBlocks");
    expect(source).toContain("buildDefaultSeoMeta");
    expect(source).toContain("profileSections");
    expect(source).toContain("contentBlocks");
    expect(source).toContain("bookingConfig");
  });

  it("business public page renders typed content blocks and CTA labels", () => {
    const source = read("client/src/pages/BusinessProfileView.tsx");

    expect(source).toContain('type === "hero"');
    expect(source).toContain('type === "gallery"');
    expect(source).toContain('type === "faq"');
    expect(source).toContain('type === "proof"');
    expect(source).toContain('type === "cta"');
    expect(source).toContain("block?.ctaLabel || profile.ctaConfig?.primary?.label");
    expect(source).toContain("block?.secondaryBody");
    expect(source).toContain("renderContentBlock(block, idx)");
    expect(source).toContain("Claim with Google Maps");
    expect(source).toContain('claimParams.set("businessId"');
  });

  it("business claim flow resolves profile context and starts from Google Maps", () => {
    const routeSource = read("server/routes/business-claim.ts");
    const pageSource = read("client/src/pages/claim-my-business.tsx");

    expect(routeSource).toContain("slug or businessId is required");
    expect(routeSource).toContain("businessId");
    expect(pageSource).toContain("Claim from Google Maps");
    expect(pageSource).toContain("GooglePlacesBusinessInput");
    expect(pageSource).toContain("Continue with Maps match");
    expect(pageSource).toContain("applyResolvedBusiness");
  });

  it("business SSR html includes typed block summaries and richer metadata", () => {
    const source = read("server/publicBusinessHtml.ts");

    expect(source).toContain("seoMeta?.title");
    expect(source).toContain("seoMeta?.imageUrl");
    expect(source).toContain('data-block-type=\\"faq\\"');
    expect(source).toContain('data-block-type=\\"proof\\"');
    expect(source).toContain('data-block-type=\\"cta\\"');
    expect(source).toContain("block?.secondaryBody");
    expect(source).toContain("block?.ctaLabel");
    expect(source).toContain("makesOffer");
  });

  it("business profile editor uses a real block-type select and block-specific fields", () => {
    const source = read("client/src/pages/BusinessProfileEditor.tsx");

    expect(source).toContain('<Select value={block.type || "text"}');
    expect(source).toContain('<SelectItem value="hero">Hero</SelectItem>');
    expect(source).toContain('<SelectItem value="gallery">Gallery</SelectItem>');
    expect(source).toContain('<SelectItem value="faq">FAQ</SelectItem>');
    expect(source).toContain('<SelectItem value="proof">Proof</SelectItem>');
    expect(source).toContain('<SelectItem value="cta">CTA</SelectItem>');
    expect(source).toContain("secondaryBody");
    expect(source).toContain("ctaLabel");
  });
});
