import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_HERO_POSTER,
  ISSA_BUILD_HERO_VIDEO,
  ISSA_BUILD_HONEY_ONYX_IMAGES,
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_IMAGES,
  ISSA_BUILD_PROFILE_SLUG,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";
import { isPremiumProductProfileData } from "@shared/premiumProductProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("ISSA Build public profile contract", () => {
  it("provisions ISSA Build as its own business without borrowing another company's contact", () => {
    const provisioner = read("server/services/issaBuildProfileProvisioning.ts");
    const businessRepository = read("server/repositories/businessRepository.ts");
    const entry = read("server/index.ts");
    const recommendationInsertStart = provisioner.indexOf("} else if (hasNoRecommendationBinding)");
    const recommendationUpdateStart = provisioner.indexOf(
      "} else {",
      recommendationInsertStart + 1
    );
    const recommendationBlockEnd = provisioner.indexOf(
      "const profileValues",
      recommendationUpdateStart
    );
    const newCompatibilityRowPath = provisioner.slice(
      recommendationInsertStart,
      recommendationUpdateStart
    );
    const existingRecommendationTargetPath = provisioner.slice(
      recommendationUpdateStart,
      recommendationBlockEnd
    );

    expect(ISSA_BUILD_PROFILE_SLUG).toBe("issa-build");
    expect(ISSA_BUILD_LEGACY_PROFILE_SLUG).toBe("honey-onyx");
    expect(ISSA_BUILD_BUSINESS_NAME).toBe("ISSA Build");
    expect(isIssaBuildProfileSlug("issa-build")).toBe(true);
    expect(isIssaBuildProfileSlug("honey-onyx")).toBe(true);
    expect(isIssaBuildProfileSlug("jw-stone")).toBe(false);

    expect(provisioner).toContain('ownership: "independent_business"');
    expect(provisioner).not.toContain("distributorBusiness");
    expect(provisioner).not.toContain("JW_STONE_PROFILE_SLUG");
    expect(provisioner).not.toContain("distributorPhone");
    expect(provisioner).not.toMatch(/distributor_name:\s*HONEY|distributor_name:\s*ISSA/);
    expect(provisioner).toContain("tradescout_admin_pending_owner_account_transfer");
    expect(provisioner).toContain("claimStatus:");
    expect(provisioner).toContain('status: "published"');
    expect(provisioner).toContain("publicDiscoveryEnabled: true");
    expect(provisioner).toContain("Suspended duplicate ISSA Build legacy business record");
    expect(provisioner).toContain("Unpublished duplicate ISSA Build legacy profile record");
    expect(provisioner).toContain("await quarantineDuplicateIssaBuildRecords();");
    expect(provisioner).toContain("This safety action must not be rolled back");
    expect(provisioner).toContain('status: "suspended"');
    expect(provisioner).toContain('status: "draft"');
    expect(provisioner).toContain('profileVisibility: "public"');
    expect(provisioner).toContain("publicContactEnabled: false");
    expect(provisioner).toContain("publicLocationEnabled: false");
    expect(provisioner).toContain("publicWebsiteEnabled: false");
    expect(businessRepository).toContain("business.profileData?.publicContactEnabled !== false");
    expect(businessRepository).toContain("business.profileData?.publicLocationEnabled !== false");
    expect(businessRepository).toContain("business.profileData?.publicWebsiteEnabled !== false");
    expect(provisioner).toContain("profileOwnerUserId === String(steward.id)");
    expect(provisioner).toContain("eq(contractors.userId, profileOwnerUserId)");
    expect(provisioner).toContain("eq(contractors.businessId, business.id)");
    expect(provisioner).toContain("hasNoRecommendationBinding");
    expect(provisioner).toContain("hasSingleExactRecommendationBinding");
    expect(provisioner).toContain("contractor binding is ambiguous or conflicting");
    expect(provisioner).toContain("userId: profileOwnerUserId");
    expect(newCompatibilityRowPath).toContain("verifiedLicensed: false");
    expect(newCompatibilityRowPath).toContain("verifiedInsured: false");
    expect(newCompatibilityRowPath).toContain("isActive: false");
    expect(existingRecommendationTargetPath).not.toContain("verifiedLicensed:");
    expect(existingRecommendationTargetPath).not.toContain("verifiedInsured:");
    expect(existingRecommendationTargetPath).not.toContain("isActive:");
    expect(provisioner).not.toContain("activeBusinessId");
    expect(provisioner).not.toContain("activeProfileId");
    expect(fs.existsSync(path.resolve(process.cwd(), "shared/honeyOnyxProfile.ts"))).toBe(false);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "server/services/honeyOnyxProfileProvisioning.ts"))
    ).toBe(false);
    expect(entry).toContain('await provisionProfile("ISSA Build", provisionIssaBuildProfile)');
  });

  it("keeps Honey Onyx and Multi Green Onyx as separate public offerings", () => {
    expect(ISSA_BUILD_PROFILE_IMAGES).toHaveLength(6);
    expect(new Set(ISSA_BUILD_PROFILE_IMAGES).size).toBe(6);

    for (const image of ISSA_BUILD_PROFILE_IMAGES) {
      expect(
        fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
        image
      ).toBe(true);
    }

    const inventoryBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "inventoryCatalog"
    );
    const stones = (inventoryBlock?.data as any)?.categories?.[0]?.stones || [];
    expect(stones.map((stone: any) => [stone.name, stone.slug])).toEqual([
      ["Honey Onyx", "honey-onyx"],
      ["Multi Green Onyx", "multi-green-onyx"],
    ]);
    expect(stones[0]?.images).toEqual([...ISSA_BUILD_HONEY_ONYX_IMAGES]);
    expect(stones[1]?.images).toEqual([...ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES]);
    expect(stones[0]?.images.length).toBeGreaterThanOrEqual(6);
    expect(stones[1]?.images.length).toBeGreaterThanOrEqual(6);
    expect(new Set(stones[0]?.images).size).toBe(stones[0]?.images.length);
    expect(new Set(stones[1]?.images).size).toBe(stones[1]?.images.length);
    expect(stones[0]?.images.filter((image: string) => stones[1]?.images.includes(image))).toEqual(
      []
    );
    for (const image of [...stones[0].images, ...stones[1].images]) {
      expect(
        fs.existsSync(path.resolve(process.cwd(), "client/public", image.replace(/^\//, ""))),
        image
      ).toBe(true);
    }
    expect(JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)).not.toContain("Honey Green Onyx");
  });

  it("uses approved ISSA Build photography for the first viewport", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");

    expect(ISSA_BUILD_HERO_VIDEO).toBe("/images/businesses/issa-build/video/hero.mp4");
    expect(ISSA_BUILD_HERO_POSTER).toBe("/images/businesses/issa-build/video/hero-poster.jpg");
    const heroVideoPath = path.resolve(
      process.cwd(),
      "client/public",
      ISSA_BUILD_HERO_VIDEO.replace(/^\//, "")
    );
    expect(fs.existsSync(heroVideoPath)).toBe(true);
    expect(fs.statSync(heroVideoPath).size).toBe(808_666);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "client/public", ISSA_BUILD_HERO_POSTER.replace(/^\//, ""))
      )
    ).toBe(true);
    expect(theme).toContain("isIssaBuildProfileSlug");
    expect(theme).toContain('src: "/images/businesses/jw-stone/video/hero.mp4"');
    expect(theme).toContain(
      'premiumProductData && !isIssaBuild ? "object-contain" : "object-cover"'
    );
    expect(theme).toContain("rgba(10,7,4,0.78)");
  });

  it("uses the reusable editorial product template below the hero", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const sections = read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx");
    const showcase = read("client/src/pages/profile-sites/OnyxStoneShowcase.tsx");
    const premiumBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "premiumProduct"
    );

    expect((premiumBlock?.data as any)?.variant).toBe("editorial-product");
    expect((premiumBlock?.data as any)?.presentation).toBe("horizontal-luxury-showcase");
    expect(isPremiumProductProfileData(premiumBlock?.data)).toBe(true);
    expect(
      isPremiumProductProfileData({
        ...(premiumBlock?.data as any),
        offerings: { title: "Malformed" },
      })
    ).toBe(false);
    expect((premiumBlock?.data as any)?.featuredProductSlug).toBe("honey-onyx");
    expect((premiumBlock?.data as any)?.offerings?.items?.map((item: any) => item.slug)).toEqual([
      "honey-onyx",
      "multi-green-onyx",
    ]);
    expect(theme).toContain("isPremiumProductProfileData");
    expect(theme).toContain("premiumProductData.featuredProductSlug");
    expect(theme).toContain("premiumProduct?.images[0]");
    expect(theme).toContain("products={premiumInventoryStones}");
    expect(theme).toContain("initialProductSlug={premiumSharedItem?.slug}");
    expect(theme).toContain("initialPhotoIndex={premiumSharedItem?.imageIndex}");
    expect(theme).toContain("<PremiumProductProfileSections");
    expect(theme).toContain("<TradeScoutProfileHandoff");
    expect(theme).toContain('["Collections", "collection"]');
    expect(theme).toContain('["Details", "why-us"]');
    expect(theme).toContain('premiumProductData?.presentation === "horizontal-luxury-showcase"');
    expect(JSON.stringify(premiumBlock)).toContain("Honey Onyx. Day and night.");
    expect((premiumBlock?.data as any)?.gallery?.photos).toHaveLength(8);
    expect((premiumBlock?.data as any)?.closing).toMatchObject({
      imageIndex: 2,
      imageFit: "cover",
    });
    expect(sections).toContain("<OnyxStoneShowcase");
    expect(sections).toContain("buildProfileInventoryShareSearch");
    expect(sections).not.toMatch(/profileSlug\s*===\s*["']issa-build["']/);
    expect(sections).not.toContain("<TradeScoutProfileHandoff");
    expect(showcase).toContain("activeProduct.images.map");
    expect(showcase).toContain("snap-x snap-mandatory");
    expect(showcase).toContain("Swipe, scroll, or use arrow keys");
    expect(showcase).toContain('role="dialog"');
    expect(showcase).toContain('event.key === "Escape"');
    expect(showcase).toContain('event.key !== "Tab"');
    expect(showcase).toContain("onTouchStart");
    expect(showcase).toContain('loading={index === 0 ? "eager" : "lazy"}');
    expect(showcase).toContain("prefers-reduced-motion: reduce");
    expect(showcase).toContain("Choose onyx collection");
    expect(showcase).toContain("useCallback");
    expect(showcase).toContain("scrollRailToIndex");
    expect(showcase).toContain("rail.scrollTo");
    expect(showcase).toContain('aria-live="polite"');
    // Deep-linked shared photos must scroll the rail into view so counter/nav stay aligned.
    expect(showcase).toContain("scrollRailToIndex(requestedIndex, \"auto\")");
  });

  it("canonicalizes every legacy public route without losing source context", () => {
    const entry = read("server/index.ts");
    const api = read("server/routes/profiles.ts");
    const client = read("client/src/pages/ProfileSiteView.tsx");

    expect(entry).toContain("slug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(entry).toContain("`${origin}/u/${ISSA_BUILD_PROFILE_SLUG}${requestSearchSuffix(req)}`");
    expect(api).toContain('const remainingUrl = String(req.url || "")');
    expect(api).toContain("`/api/u/${ISSA_BUILD_PROFILE_SLUG}${suffix}`");
    expect(api).toContain('router.use("/api/u/:slug"');
    expect(api).toContain('req.method === "GET" || req.method === "HEAD" ? 301 : 308');
    expect(client).toContain("slug.toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(client).toContain("window.location.search");
    expect(client).toContain("window.location.hash");
    expect(read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx")).toContain(
      'startDirectConnect(productName ?? null, productName ? "request_material" : null)'
    );
  });

  it("keeps public copy on ISSA Build product and Direct Connect only", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const profileCopy = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);

    expect(profileCopy).toContain("Private Direct Connect");
    expect(profileCopy).toContain("ISSA Build");
    expect(profileCopy).toContain("Honey Onyx");
    expect(profileCopy).toContain("Multi Green Onyx");
    expect(profileCopy).not.toContain("Honey Green Onyx");
    expect(profileCopy).toContain('"hideFinishDetails":true');
    expect(profileCopy).not.toMatch(/distribut(?:or|ed|ion)/i);
    expect(profileCopy).not.toContain("JW Stone");
    expect(profileCopy).not.toMatch(/co-?locat|same lot|share(?:s|d)? space/i);
    expect(profileCopy).not.toMatch(/850-|issaichev|@gmail\.com|password/i);
    expect(theme).toContain("text={`${stoneDisplayName} from ${displayName}`}");
    expect(theme).toContain("{ctaHeading}");
    expect(theme).toContain("contactOperatorName={contactOperatorName || undefined}");
    expect(panel).toContain("hasSeparateOperator");
  });
});
