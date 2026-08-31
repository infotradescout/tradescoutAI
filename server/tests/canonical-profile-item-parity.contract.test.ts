import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical profile item parity", () => {
  it("loads only active or published profile items into compact public summaries", () => {
    const profilesRoute = read("server/routes/profiles.ts");

    expect(profilesRoute).toContain("WHERE seller_user_id = $1");
    expect(profilesRoute).toContain("AND is_active = true");
    expect(profilesRoute).toContain(".map(toPublicProfileOffer)");
    expect(profilesRoute).toContain(
      "storage.getHandmadeProducts({ sellerId: ownerUserId, limit: 8 })"
    );
    expect(profilesRoute).toContain(
      "storage.getCommunityPosts({ authorId: ownerUserId, limit: 6 })"
    );
    expect(profilesRoute).toContain("storage.getMarketplaceListings({");
    expect(profilesRoute).toContain('status: "active"');
    expect(profilesRoute).toContain("buildPublicBusinessListingCards({ listings, categories })");
    expect(profilesRoute).toContain("listHandmadeProductImageUrls(product)");
    expect(profilesRoute).toContain("listCommunityPostImageUrls(post.imageUrls)");
  });

  it("does not add owner identity or contact fields to the profile item payload", () => {
    const profilesRoute = read("server/routes/profiles.ts");

    expect(profilesRoute).toContain(".map(({ sellerUserId: _sellerUserId, ...offer }) => offer)");
    expect(profilesRoute).toContain("sanitizePublicProfileOfferText(product.title)");
    expect(profilesRoute).toContain("sanitizePublicProfileOfferText(post.content)");
    expect(profilesRoute).toContain("profileItems: {");
    expect(profilesRoute).toContain("marketplaceListings: publicMarketplaceListings");
    expect(profilesRoute).not.toContain("profileItems: {\n      ownerUserId");
    expect(profilesRoute).not.toContain("profileItems: {\n      sellerUserId");
  });

  it("renders the same shareable items on standard and premium canonical profiles", () => {
    const profileView = read("client/src/pages/ProfileSiteView.tsx");
    const wholesalerWrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const wholesaler = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
    const autoGlass = read("client/src/pages/profile-sites/JrsAutoGlassProfileTheme.tsx");
    const localService = read("client/src/pages/profile-sites/LocalServiceProfileTheme.tsx");
    const proFab = read("client/src/pages/profile-sites/ProFabProfileTheme.tsx");
    const videographer = read("client/src/pages/profile-sites/VideographerProfileTheme.tsx");
    const precisionAerial = read("client/src/pages/profile-sites/PrecisionAerialProfile.tsx");
    const defaultProfile = read("client/src/pages/profile-sites/DefaultProfileTheme.tsx");

    expect(profileView).toContain("const profileItems = data.profileItems || {};");
    expect(profileView.match(/<PublicProfileItems/g)?.length).toBe(7);
    expect(
      profileView.match(/<PublicProfileItems[^>]*platformBaseHref=\{platformBaseHref\}[^>]*\/>/g)
        ?.length
    ).toBe(7);
    expect(profileView).toContain("profileItems={");
    expect(wholesalerWrapper).toContain("return <LegacyWholesalerProfileTheme {...props} />");
    for (const theme of [
      wholesaler,
      autoGlass,
      localService,
      proFab,
      videographer,
      precisionAerial,
      defaultProfile,
    ]) {
      expect(theme).toContain("profileItems?: ReactNode");
      expect(theme).toContain("{profileItems}");
    }
  });

  it("uses every durable item route and exact-image helper without adding contact actions or process copy", () => {
    const items = read("client/src/components/profile/PublicProfileItems.tsx");

    expect(items).toContain("buildProfileServiceOfferPath(offer.id)");
    expect(items).toContain("buildProfileOfferExchangePath(");
    expect(items).toContain("buildHandmadeProductPath(product.id)");
    expect(items).toContain("buildCommunityPostPath(post.id)");
    expect(items).toContain("listing.detailPath");
    expect(items).toContain("listing.imageUrl");
    expect(items).toContain("listProfileOfferImageUrls(offer.metadata)");
    expect(items).toContain("listHandmadeProductImageUrls({");
    expect(items).toContain("listCommunityPostImageUrls(post.imageUrls)");
    expect(items).toContain("<ShareButton");
    expect(items).not.toContain("Send Message");
    expect(items).not.toContain("Start Job");
    expect(items).not.toContain("See something you like?");
    expect(items).not.toContain("Your contact details stay");
    expect(items).not.toContain("private until you choose to connect.");
    expect(items).not.toContain("Contact, job routing, and transactions continue through");
  });

  it("honors section visibility independently for services, products, and posts", () => {
    const items = read("client/src/components/profile/PublicProfileItems.tsx");
    const profilesRoute = read("server/routes/profiles.ts");

    expect(items).toContain('offer.offerType === "service"');
    expect(items).toContain("profileSections?.services !== false");
    expect(items).toContain("profileSections?.marketplaceListings !== false");
    expect(items).toContain("profileSections?.communityActivity !== false");
    expect(profilesRoute).toContain(
      "profileSections.services !== false || profileSections.marketplaceListings !== false"
    );
  });

  it("fails commercial profile exposure closed through the shared Trust/CVS authority path", () => {
    const profilesRoute = read("server/routes/profiles.ts");
    const legacyRoutes = read("server/routes.ts");
    const exposureAuthority = read("server/services/exposureAuthority.ts");

    expect(profilesRoute).toContain("buildExposureAuthorityMap([ownerUserId])");
    expect(profilesRoute).toContain("canExposeCommercialItems");
    expect(profilesRoute).toContain("Fail closed for commercial exposure");
    expect(legacyRoutes).toContain(
      'import { buildExposureAuthorityMap } from "./services/exposureAuthority"'
    );
    expect(exposureAuthority).toContain("hasEmailGate");
    expect(exposureAuthority).toContain("hasAddressGate || hasIdentityGate || hasBusinessGate");
  });
});
