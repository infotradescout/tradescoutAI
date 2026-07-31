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
    expect(source).toContain("buildPublicBusinessListingCards");
    expect(source).toContain("sellerId: profile.userId");
    expect(source).toContain("marketplaceListings");
    expect(source).toContain("resolveCanonicalBusinessProfileRoute(slug)");
    expect(source).toContain("canonicalProfilePath: canonicalProfile?.path || null");
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
    expect(source).toContain("bp-direct-connect-flow");
    expect(source).toContain("showListingsSection");
    expect(source).toContain("profile.marketplaceListings");
    expect(source).toContain("listing.detailPath");
    expect(source).toContain("<ShareButton");
    expect(source).toContain('canonicalProfilePath.startsWith("/u/")');
    expect(source).not.toContain("sellerId: String(data.userId)");
  });

  it("business claim flow resolves profile context and starts from Google Maps", () => {
    const routeSource = read("server/routes/business-claim.ts");
    const pageSource = read("client/src/pages/claim-my-business.tsx");

    expect(routeSource).toContain("slug or businessId is required");
    expect(routeSource).toContain("businessId");
    expect(routeSource).toContain("placeId");
    expect(routeSource).toContain("google_place_id");
    expect(routeSource).toContain("google_place_phone");
    expect(routeSource).toContain("google_place_website");
    const resolveRoute = routeSource.slice(
      routeSource.indexOf('app.get("/api/business-claim/resolve"'),
      routeSource.indexOf('app.post("/api/business-claim/find-or-create"')
    );
    expect(resolveRoute).toContain("and b.owner_user_id is null");
    expect(resolveRoute).toContain("and b.claim_status = 'unclaimed'");
    expect(pageSource).toContain("Claim from Google Maps");
    expect(pageSource).toContain("GooglePlacesBusinessInput");
    expect(pageSource).toContain("searchClaimableBusinesses");
    expect(pageSource).toContain('sp.set("placeId"');
    expect(pageSource).toContain('sp.set("phone"');
    expect(pageSource).toContain('sp.set("website"');
    expect(pageSource).toContain("Maps match found");
    expect(pageSource).toContain("Create from Maps");
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

  it("keeps all owner content editing in the canonical profile editor", () => {
    const canonicalEditor = read("client/src/pages/ProfileSiteEditor.tsx");
    const legacyEditorRedirect = read("client/src/pages/BusinessProfileEditor.tsx");

    expect(canonicalEditor).toContain("contentBlocksText");
    expect(canonicalEditor).toContain("buildContentBlocksForSave");
    expect(canonicalEditor).toContain('apiRequest("PUT", `/api/profiles/${profile.id}`');
    expect(legacyEditorRedirect).toContain("Compatibility-only handoff");
    expect(legacyEditorRedirect).not.toContain("UpdateProfilePayload");
  });
});
