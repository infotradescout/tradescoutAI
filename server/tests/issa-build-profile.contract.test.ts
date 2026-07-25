import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ISSA_BUILD_APPLICATION_IMAGES,
  ISSA_BUILD_BUSINESS_NAME,
  ISSA_BUILD_HERO_POSTER,
  ISSA_BUILD_HERO_VIDEO,
  ISSA_BUILD_HONEY_ONYX_IMAGES,
  ISSA_BUILD_LEGACY_PROFILE_SLUG,
  ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES,
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS,
  ISSA_BUILD_PROFILE_IMAGES,
  ISSA_BUILD_PROFILE_SLUG,
  ISSA_BUILD_SLAB_IMAGES,
  isIssaBuildProfileSlug,
} from "@shared/issaBuildProfile";
import { isPremiumProductProfileData } from "@shared/premiumProductProfile";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const FORBIDDEN_ISSA_PRESENTATION_STRINGS = [
  "profile-inventory-card",
  "Search by stone name",
  "Current collection",
  "View details",
  "slab count",
  "bundle count",
  "Material to confirm",
  "Featured stones",
  "Browse full inventory",
  "warehouse",
  "stone yard",
  "Honey Green",
] as const;

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
    expect(provisioner).toContain('presentation_archetype: "lux"');
    expect(provisioner).toContain("Custom onyx installation");
    expect(provisioner).toContain("Backlighting solutions");
    expect(provisioner).toContain("Onyx customization");
    expect(provisioner).toContain("Project consultation");
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
    expect(JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS)).not.toContain("Honey Green");
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
    // Cropped hero (150px right trim) — size pinned to catch accidental asset swaps.
    expect(fs.statSync(heroVideoPath).size).toBe(1_402_114);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "client/public", ISSA_BUILD_HERO_POSTER.replace(/^\//, ""))
      )
    ).toBe(true);
    expect(theme).toContain("isIssaBuildProfileSlug");
    expect(theme).toContain("ISSA_BUILD_HERO_VIDEO");
    expect(theme).toContain("ISSA_BUILD_HERO_POSTER");
    expect(theme.indexOf("ISSA_BUILD_HERO_VIDEO")).toBeLessThan(
      theme.indexOf('src: "/images/businesses/jw-stone/video/hero.mp4"')
    );
    expect(theme).toContain(
      'premiumProductData && !isIssaBuild ? "object-contain" : "object-cover"'
    );
    expect(theme).toContain("font-editorial");
    expect(theme).toContain("Start a private consultation");
    expect(theme).toContain("View installed work");
  });

  it("uses the reusable Lux archetype below the hero", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const sections = read("client/src/pages/profile-sites/PremiumProductProfileSections.tsx");
    const luxuryHouse = read("client/src/pages/profile-sites/LuxuryMaterialHouseShowcase.tsx");
    const showcase = read("client/src/pages/profile-sites/OnyxStoneShowcase.tsx");
    const premiumBlock = ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find(
      (block) => block.type === "premiumProduct"
    );
    const premiumData = premiumBlock?.data as any;
    const house = premiumData?.luxuryHouse;

    expect(premiumData?.variant).toBe("editorial-product");
    expect(premiumData?.presentation).toBe("lux");
    expect(isPremiumProductProfileData(premiumData)).toBe(true);
    expect(
      isPremiumProductProfileData({
        ...premiumData,
        offerings: { title: "Malformed" },
      })
    ).toBe(false);
    expect(
      isPremiumProductProfileData({
        ...premiumData,
        presentation: "lux",
        luxuryHouse: undefined,
      })
    ).toBe(false);
    // Legacy presentation id still validates when luxuryHouse is present.
    expect(
      isPremiumProductProfileData({
        ...premiumData,
        presentation: "luxury-material-house",
      })
    ).toBe(true);
    expect(premiumData?.featuredProductSlug).toBe("honey-onyx");
    expect(premiumData?.offerings?.items?.map((item: any) => item.slug)).toEqual([
      "honey-onyx",
      "multi-green-onyx",
    ]);
    expect(house?.materialChapters?.map((chapter: any) => [chapter.name, chapter.slug])).toEqual([
      ["Honey Onyx", "honey-onyx"],
      ["Multi Green Onyx", "multi-green-onyx"],
    ]);
    expect(house?.designedWithLight?.image).toBe(ISSA_BUILD_APPLICATION_IMAGES[2]);
    expect(house?.materialChapters?.[0]?.applicationImage).toBe(ISSA_BUILD_APPLICATION_IMAGES[4]);
    expect(house?.materialChapters?.[0]?.detailImage).toBe(ISSA_BUILD_SLAB_IMAGES[0]);
    expect(house?.materialChapters?.[1]?.applicationImage).toBe(ISSA_BUILD_APPLICATION_IMAGES[0]);
    expect(house?.materialChapters?.[1]?.detailImage).toBe(ISSA_BUILD_SLAB_IMAGES[2]);
    expect(house?.showcase?.images?.length).toBeGreaterThanOrEqual(6);
    expect(house?.showcase?.images?.length).toBeLessThanOrEqual(9);
    for (const image of house.showcase.images) {
      expect(ISSA_BUILD_APPLICATION_IMAGES.includes(image)).toBe(true);
      expect(String(image)).not.toMatch(/slabs|yard|warehouse/i);
    }
    // First two content section heroes are installed interiors, not slab yard.
    expect(house.designedWithLight.image).toMatch(/\/applications\//);
    expect(house.materialChapters[0].applicationImage).toMatch(/\/applications\//);
    // Slab / material close-ups live in the bottom sample rail only.
    expect(house.materialSamples?.eyebrow).toBe("MATERIAL SAMPLES");
    expect(house.materialSamples?.title).toBe("Stone detail.");
    expect(
      house.materialSamples?.groups?.map((g: any) => [g.slug, g.name, g.images.length])
    ).toEqual([
      ["honey-onyx", "Honey Onyx", 2],
      ["multi-green-onyx", "Multi Green Onyx", 4],
    ]);
    const railImages = (house.materialSamples?.groups || []).flatMap((g: any) => g.images);
    expect(railImages).toEqual([...ISSA_BUILD_SLAB_IMAGES]);
    for (const image of railImages) {
      expect(String(image)).toMatch(/\/slabs\//);
    }
    expect(house.capabilities.items.map((item: any) => item.title)).toEqual([
      "Material selection",
      "Custom cutting and shaping",
      "Backlighting",
      "Custom installation",
      "Residential and commercial projects",
      "Private project consultation",
    ]);
    expect(house.designedWithLight.eyebrow).toBe("BACKLIGHTING");
    expect(house.designedWithLight.title).toBe("The finish belongs to the room.");
    expect(house.designedWithLight.body).toContain("We take projects from selection");
    expect(house.designedWithLight.body.toLowerCase()).not.toContain("designed with light");
    expect(house.capabilities.eyebrow).toBe("WHAT WE DO");
    expect(house.capabilities.body).toContain("We begin with the space");
    expect(house.materialChapters[0].title).toBe("Warm, luminous, unmistakable.");
    expect(house.materialChapters[1].title).toBe("A deeper architectural tone.");
    expect(house.showcase.eyebrow).toBe("INSTALLED WORK");
    expect(house.showcase.title).toBe("Onyx in the room.");
    expect(house.showcase.body).toBe("");
    expect(house.consultation.eyebrow).toBe("CONSULTATION");
    expect(house.consultation.title).toBe("Start with the room.");
    expect(house.consultation.body).toBe(
      "Tell us the space, dimensions, location, schedule, and whether you are considering backlighting."
    );
    expect(house.consultation.note).toBe("Your contact stays private until we accept.");
    expect(house.consultation.fields).toEqual([
      "Selected material",
      "Room / application",
      "Dimensions",
      "Location",
      "Timing",
      "Backlighting intent",
    ]);
    // No stacked privacy / material / Direct Connect labels next to the consult card.
    expect(JSON.stringify(house.consultation)).not.toMatch(/PRIVATE DIRECT CONNECT/i);
    expect(JSON.stringify(house.consultation)).not.toMatch(/Private Direct Connect/i);

    expect(theme).toContain("isPremiumProductProfileData");
    expect(theme).toContain("premiumProductData.featuredProductSlug");
    expect(theme).toContain("premiumProduct?.images[0]");
    expect(theme).toContain("products={luxuryHouseProducts}");
    expect(theme).toContain("products={premiumInventoryStones}");
    expect(theme).toContain("initialProductSlug={premiumSharedItem?.slug}");
    expect(theme).toContain("initialPhotoIndex={premiumSharedItem?.imageIndex}");
    expect(theme).toContain("<PremiumProductProfileSections");
    expect(theme).toContain("<TradeScoutProfileHandoff");
    expect(theme).toContain('data-testid="wholesaler-brand-footer"');
    expect(theme).toContain('data-testid="profile-trust-section"');
    expect(theme).toContain('data-testid="luxury-material-house-unavailable"');
    expect(theme).toContain("isLuxPresentation(rawPremiumPresentation)");
    expect(theme).toContain('"lux"');
    expect(theme).toContain("luxury-material-house");
    expect(theme.indexOf("<PremiumProductProfileSections")).toBeLessThan(
      theme.indexOf('data-testid="wholesaler-brand-footer"')
    );
    expect(theme.indexOf('data-testid="wholesaler-brand-footer"')).toBeLessThan(
      theme.indexOf("<TradeScoutProfileHandoff")
    );
    expect(theme).toContain("isLuxPresentation(premiumProductData?.presentation)");
    expect(theme).toContain('["Showcase", "showcase"]');
    expect(theme).toContain('["Consult", "consult"]');
    expect(theme).toContain('["Connect", "connect"]');
    expect(theme).toContain("issa-hero-media");
    expect(theme).toContain("issaHeroReady");
    expect(theme).toContain("stickySubtitle");
    expect(theme).toContain('data-testid="issa-trust-facts"');
    expect(theme).not.toContain("scale-[1.48]");
    expect(theme).toContain("--ts-profile-top-offset");
    expect(theme).toContain("platformEngagement=");
    expect(theme).toContain("!isLuxuryMaterialHouse");
    // Landscape hero film (1280×720): mobile uses aspect-video so object-cover
    // shows the full horizontal room — never a tall portrait + object-position crop.
    expect(theme).toContain("aspect-video");
    expect(theme).toContain(
      'className="pointer-events-none relative aspect-video w-full shrink-0 overflow-hidden bg-black md:absolute md:inset-0 md:aspect-auto md:h-full"'
    );
    expect(theme).toContain("object-cover object-center");
    expect(theme).not.toContain("object-[center_42%]");
    expect(theme).not.toContain("object-[center_28%]");
    expect(theme).not.toContain("h-[74svh]");
    expect(theme).not.toMatch(
      /isIssaBuild[\s\S]{0,220}h-\[calc\(100svh-var\(--ts-profile-top-offset/
    );
    // ISSA hero: translucent copy panel instead of full-bleed video scrim.
    expect(theme).toContain("md:bg-black/45");
    expect(theme).toContain("md:backdrop-blur-sm");
    expect(theme).not.toContain(
      "bg-[linear-gradient(180deg,rgba(8,6,4,0.12)_0%,rgba(8,6,4,0.28)_55%,rgba(8,6,4,0.72)_100%)]"
    );
    expect(theme).toContain("border-ts-orange");
    expect(theme).toContain("Direct Connect");
    expect(theme).not.toContain('["Inquire", "connect"]');
    expect(theme).toContain('premiumProductData?.presentation === "horizontal-luxury-showcase"');
    expect(
      (ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find((b) => b.type === "hero")?.data as any)?.eyebrow
    ).toBe("CUSTOM BACKLIT ONYX");
    expect(
      (ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find((b) => b.type === "hero")?.data as any)?.headerLabel
    ).toBe("Onyx, brought to light.");
    expect(
      (ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find((b) => b.type === "hero")?.data as any)?.teaser
    ).toBe(
      "Custom Honey Onyx and Multi Green Onyx installations for residential and commercial interiors."
    );
    expect(
      (
        (ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find((b) => b.type === "trust")?.data as any)?.items ||
        []
      ).length
    ).toBe(0);
    // Lux path: platform engagement keeps trust actions only — no duplicate trust facts strip.
    expect(theme).toContain('data-testid="profile-trust-section"');
    expect(theme).not.toMatch(
      /platformEngagement=\{[\s\S]*?data-testid="issa-trust-facts"[\s\S]*?\}/
    );

    expect(sections).toContain("<LuxuryMaterialHouseShowcase");
    expect(sections).toContain("isLuxPresentation(props.data.presentation)");
    expect(sections).toContain("<OnyxStoneShowcase");
    expect(sections).toContain('presentation === "horizontal-luxury-showcase"');
    expect(sections).not.toMatch(/profileSlug\s*===\s*["']issa-build["']/);
    expect(sections).not.toContain("<TradeScoutProfileHandoff");

    expect(luxuryHouse).toContain('data-testid="luxury-material-house-showcase"');
    expect(luxuryHouse).toContain("designed-with-light");
    expect(luxuryHouse).toContain("material-chapters");
    expect(luxuryHouse).toContain("capabilities");
    expect(luxuryHouse).toContain("showcase");
    expect(luxuryHouse).toContain("material-samples");
    expect(luxuryHouse).toContain("luxury-house-material-samples");
    expect(luxuryHouse).toContain("consult");
    expect(luxuryHouse).toContain("platformEngagement");
    expect(luxuryHouse).toContain("luxury-house-platform-engagement");
    expect(luxuryHouse).toContain("onDirectConnect");
    expect(luxuryHouse).toContain("itemId:");
    expect(luxuryHouse).toContain("initialPhotoIndex");
    expect(luxuryHouse).toContain("luxury-house-deep-link-lightbox");
    expect(luxuryHouse).toContain("SafeProfileImg");
    expect(luxuryHouse).toContain("Discuss your project");
    expect(luxuryHouse).toContain("font-editorial");
    expect(luxuryHouse).toContain("var(--brand-accent");
    expect(luxuryHouse).toContain("bg-black/45");
    expect(luxuryHouse).toContain("backdrop-blur-sm");
    expect(luxuryHouse).not.toContain("bg-[linear-gradient");
    expect(luxuryHouse).not.toContain("bg-gradient-to-t");
    expect(luxuryHouse).not.toContain("from-black/");
    expect(luxuryHouse).not.toContain("aspect-[16/7]");
    expect(luxuryHouse).not.toContain("Open ${chapter.name} detail image");
    expect(luxuryHouse).not.toContain('id="connect"');
    expect(luxuryHouse).not.toContain("A useful first message includes");
    expect(luxuryHouse).not.toContain("From stone to space");
    expect(luxuryHouse).not.toContain("profile-inventory-card");
    expect(luxuryHouse).not.toContain("snap-x snap-mandatory");
    expect(luxuryHouse).not.toContain("Lookbook");
    expect(luxuryHouse).not.toContain("Choose onyx collection");
    expect(luxuryHouse).not.toContain("Search by stone name");
    expect(luxuryHouse).not.toContain("View details");
    expect(luxuryHouse).not.toMatch(/profileSlug\s*===\s*["']issa-build["']/);
    for (const forbidden of FORBIDDEN_ISSA_PRESENTATION_STRINGS) {
      expect(luxuryHouse.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    // Horizontal showcase remains available for non-ISSA premium users.
    expect(showcase).toContain("activeProduct.images.map");
    expect(showcase).toContain("snap-x snap-mandatory");
    expect(showcase).toContain("Lookbook");
    expect(showcase).toContain("Choose onyx collection");

    const profileCopy = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    for (const forbidden of FORBIDDEN_ISSA_PRESENTATION_STRINGS) {
      expect(profileCopy.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(profileCopy).not.toMatch(/850-|issaichev|@gmail\.com|password|testimonial/i);
    expect(profileCopy).not.toMatch(/street|avenue|boulevard|suite\s+\d/i);
  });

  it("keeps JW Stone and ordinary wholesaler inventory grammar unchanged", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    expect(theme).toContain(
      'data-testid={isJwStone ? "jw-stone-inventory-card" : "profile-inventory-card"}'
    );
    expect(theme).toContain("Browse full inventory");
    expect(theme).toContain("Current collection");
    expect(theme).toContain("View details");
    expect(theme).toContain("Material to confirm");
    expect(theme).toContain('profileSlug === "jw-stone"');
    expect(theme).toContain("openFullInventory");
    // Inventory chrome stays gated behind non-premium / JW Stone paths.
    expect(theme).toContain("premiumProductData && premiumProduct");
    expect(theme).toContain("isLuxuryMaterialHouse");
  });

  it("canonicalizes every legacy public route without losing source context", () => {
    const entry = read("server/index.ts");
    const api = read("server/routes/profiles.ts");
    const client = read("client/src/pages/ProfileSiteView.tsx");
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const route = read("server/routes/tradepartner-express.ts");

    expect(entry).toContain("slug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(entry).toContain("`${origin}/u/${ISSA_BUILD_PROFILE_SLUG}${requestSearchSuffix(req)}`");
    expect(api).toContain('const remainingUrl = String(req.url || "")');
    expect(api).toContain("`/api/u/${ISSA_BUILD_PROFILE_SLUG}${suffix}`");
    expect(api).toContain('router.use("/api/u/:slug"');
    expect(api).toContain('req.method === "GET" || req.method === "HEAD" ? 301 : 308');
    expect(client).toContain("slug.toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(client).toContain("window.location.search");
    expect(client).toContain("window.location.hash");
    expect(theme).toContain("startDirectConnectFromTarget");
    expect(theme).toContain("resolveDirectConnectMaterial");
    expect(theme).toContain("initialItemId={expressItemId}");
    expect(panel).toContain("itemId: stableItemId || undefined");
    expect(panel).toContain('params.set("itemId", stableItemId)');
    expect(route).toContain("itemId: body.itemId || null");
  });

  it("keeps public copy on ISSA Build product and Direct Connect only", () => {
    const theme = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const panel = read("client/src/pages/profile-sites/ExpressDirectConnectPanel.tsx");
    const profileCopy = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);

    // Direct Connect stays in the action path (theme/panel), not stacked into lux consult copy.
    expect(theme).toContain("Direct Connect");
    expect(panel).toContain("Direct Connect");
    expect(profileCopy).not.toMatch(/PRIVATE DIRECT CONNECT/i);
    expect(profileCopy).not.toMatch(/Private Direct Connect/i);
    expect(profileCopy).toContain("ISSA Build");
    expect(profileCopy).toContain("Honey Onyx");
    expect(profileCopy).toContain("Multi Green Onyx");
    expect(profileCopy).not.toContain("Honey Green Onyx");
    expect(profileCopy).not.toContain("Two distinct offerings");
    expect(profileCopy).not.toMatch(/book-matched/i);
    expect(read("server/services/issaBuildProfileProvisioning.ts")).not.toMatch(/book-matched/i);
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
