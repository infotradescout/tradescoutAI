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
import { resolveProfilePublicMediaObjectKey } from "@shared/profilePublicMedia";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const block = (type: string) =>
  ISSA_BUILD_PROFILE_CONTENT_BLOCKS.find((entry) => entry.type === type) as
    | { type: string; data: Record<string, any> }
    | undefined;

describe("ISSA Build public profile contract", () => {
  it("keeps ISSA Build independent, public, 100% verified, and routed through TradeScout", () => {
    const provisioner = read("server/services/issaBuildProfileProvisioning.ts");
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");
    const managedContact = read("server/services/jwStoneManagedContactProvisioning.ts");
    const registry = read("shared/managedPartnerProfileRegistry.ts");
    const sourceRecord = read("docs/profile-sources/ISSA_BUILD.md");

    expect(ISSA_BUILD_PROFILE_SLUG).toBe("issa-build");
    expect(ISSA_BUILD_LEGACY_PROFILE_SLUG).toBe("honey-onyx");
    expect(ISSA_BUILD_BUSINESS_NAME).toBe("ISSA Build");
    expect(isIssaBuildProfileSlug("issa-build")).toBe(true);
    expect(isIssaBuildProfileSlug("honey-onyx")).toBe(true);
    expect(isIssaBuildProfileSlug("jw-stone")).toBe(false);

    expect(provisioner).toContain('ownership: "independent_business"');
    expect(provisioner).toContain("publicDiscoveryEnabled: true");
    expect(normalizer).toContain('ISSA_BUILD_VERIFICATION_STATUS = "fully_verified"');
    expect(normalizer).toContain("verification_percent: 100");
    expect(normalizer).toContain('verification_label: "100% Verified by TradeScout"');
    expect(normalizer).toContain('request_routing: "tradescout_managed_inquiry_funnel"');
    expect(normalizer).toContain('service_delivery: "issa_build"');
    expect(normalizer).toContain("publicDiscoveryEnabled: true");
    expect(managedContact).toContain("await normalizeIssaBuildVerifiedFullServiceProfile();");
    expect(registry).toContain("Fully verified independent business");
    expect(registry).toContain("does not reduce verification");
    expect(sourceRecord).toContain("100% verified");
    expect(sourceRecord).toContain("TradeScout manages the inquiry funnel");
    expect(sourceRecord).toContain("only an account-control state");
  });

  it("preserves Honey Onyx and Multi Green Onyx as distinct offerings with approved media", () => {
    const inventory = block("inventoryCatalog")?.data;
    const premium = block("premiumProduct")?.data;
    const stones = inventory?.categories?.[0]?.stones || [];

    expect(ISSA_BUILD_PROFILE_IMAGES.length).toBeGreaterThanOrEqual(6);
    expect(ISSA_BUILD_APPLICATION_IMAGES.length).toBeGreaterThanOrEqual(5);
    expect(ISSA_BUILD_SLAB_IMAGES.length).toBeGreaterThanOrEqual(2);
    expect(ISSA_BUILD_HONEY_ONYX_IMAGES.length).toBeGreaterThan(0);
    expect(ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES.length).toBeGreaterThan(0);
    expect(new Set(ISSA_BUILD_PROFILE_IMAGES).size).toBe(ISSA_BUILD_PROFILE_IMAGES.length);

    for (const publicAsset of [
      ...ISSA_BUILD_PROFILE_IMAGES,
      ISSA_BUILD_HERO_VIDEO,
      ISSA_BUILD_HERO_POSTER,
    ]) {
      expect(resolveProfilePublicMediaObjectKey(publicAsset)).toBeTruthy();
      expect(fs.existsSync(path.resolve(process.cwd(), `client/public${publicAsset}`))).toBe(false);
    }

    expect(inventory?.categories).toHaveLength(1);
    expect(stones).toHaveLength(2);
    expect(stones.map((entry: any) => entry.name)).toEqual(["Honey Onyx", "Multi Green Onyx"]);
    expect(stones[0].publicKind).toBe("offering");
    expect(stones[1].publicKind).toBe("offering");
    expect(stones[0].images).toEqual(ISSA_BUILD_HONEY_ONYX_IMAGES);
    expect(stones[1].images).toEqual(ISSA_BUILD_MULTI_GREEN_ONYX_IMAGES);
    expect(stones[0]).not.toHaveProperty("price");
    expect(stones[0]).not.toHaveProperty("available");
    expect(stones[1]).not.toHaveProperty("price");
    expect(stones[1]).not.toHaveProperty("available");

    expect(isPremiumProductProfileData(premium)).toBe(true);
    expect(premium?.presentation).toBe("lux");
    expect(premium?.offerings?.items.map((entry: any) => entry.slug)).toEqual([
      "honey-onyx",
      "multi-green-onyx",
    ]);
  });

  it("uses the premium ISSA presentation and states the complete service scope", () => {
    const wrapper = read("client/src/pages/profile-sites/WholesalerProfileTheme.tsx");
    const legacyTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");
    const premiumSections = read(
      "client/src/pages/profile-sites/PremiumProductProfileSections.tsx"
    );
    const luxShowcase = read("client/src/pages/profile-sites/LuxuryMaterialHouseShowcase.tsx");
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");

    expect(wrapper).toContain("LegacyWholesalerProfileTheme");
    expect(legacyTheme).toContain("isIssaBuildProfileSlug");
    expect(legacyTheme).toContain("ISSA_BUILD_HERO_VIDEO");
    expect(legacyTheme).toContain("ISSA_BUILD_HERO_POSTER");
    expect(legacyTheme).toContain('data-testid="issa-hero-media"');
    expect(legacyTheme).toContain('className="pointer-events-none relative aspect-video');
    expect(legacyTheme).toContain("<PremiumProductProfileSections");
    expect(premiumSections).toContain("<LuxuryMaterialHouseShowcase {...props} />");
    expect(luxShowcase).toContain('data-testid="luxury-material-house-showcase"');
    expect(luxShowcase).toContain("house.capabilities.items.map");

    for (const service of [
      "Material selection",
      "Custom onyx fabrication",
      "Backlighting design and installation",
      "Custom onyx installation",
      "Residential and commercial projects",
      "Project consultation",
    ]) {
      expect(normalizer).toContain(service);
    }
    expect(normalizer).toContain(
      "TradeScout manages the inquiry; ISSA Build handles material selection, custom fabrication, backlighting, and installation"
    );
    expect(normalizer).toContain('label: "Start a Request"');
  });

  it("canonicalizes the legacy URL without losing selected material context", () => {
    const serverIndex = read("server/index.ts");
    const profileRoutes = read("server/routes/profiles.ts");
    const legacyTheme = read("client/src/pages/profile-sites/WholesalerProfileThemeLegacy.tsx");

    expect(serverIndex).toContain("ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(serverIndex).toContain("ISSA_BUILD_PROFILE_SLUG");
    expect(serverIndex).toContain(
      "if (slug.trim().toLowerCase() === ISSA_BUILD_LEGACY_PROFILE_SLUG)"
    );
    expect(serverIndex).toContain(
      "`${origin}/u/${ISSA_BUILD_PROFILE_SLUG}${requestSearchSuffix(req)}`"
    );
    expect(profileRoutes).toContain('router.use("/api/u/:slug", (req, res, next) => {');
    expect(profileRoutes).toContain("slug !== ISSA_BUILD_LEGACY_PROFILE_SLUG");
    expect(profileRoutes).toContain(
      "const canonicalUrl = `/api/u/${ISSA_BUILD_PROFILE_SLUG}${suffix}`;"
    );
    expect(profileRoutes).toContain(
      'const status = req.method === "GET" || req.method === "HEAD" ? 301 : 308;'
    );
    expect(legacyTheme).toContain("resolveProfilePublicItemRoute");
    expect(legacyTheme).toContain(
      'routedItem?.itemType === "inventory" ? routedItem.itemSlug : params.get("stone")'
    );
    expect(legacyTheme).toContain("setPremiumSharedItem");
    expect(legacyTheme).toContain("buildProfilePublicItemPath");
  });

  it("keeps the public copy on ISSA Build, verification, service delivery, and Start a Request", () => {
    const publicBlocks = JSON.stringify(ISSA_BUILD_PROFILE_CONTENT_BLOCKS);
    const normalizer = read("server/services/issaBuildVerifiedProfileNormalization.ts");
    const sourceRecord = read("docs/profile-sources/ISSA_BUILD.md");

    expect(publicBlocks).not.toMatch(/JW Stone/i);
    expect(publicBlocks).not.toMatch(/co-tenant/i);
    expect(publicBlocks).not.toMatch(/co-locat/i);
    expect(publicBlocks).not.toMatch(/damage count/i);
    expect(publicBlocks).not.toMatch(/shipping document/i);
    expect(publicBlocks).not.toMatch(/@thetradescout\.com/i);
    expect(publicBlocks).not.toMatch(/850[\s().-]*543[\s.-]*0748/i);

    expect(normalizer).toContain("100% Verified by TradeScout");
    expect(normalizer).toContain("ISSA Build handles the complete project");
    expect(normalizer).toContain('label: "Start a Request"');
    expect(normalizer).not.toContain(".update(users)");
    expect(normalizer).not.toContain(".update(contractors)");
    expect(sourceRecord).toContain("without transferring ISSA Build ownership");
    expect(sourceRecord).not.toMatch(/@thetradescout\.com/i);
    expect(sourceRecord).not.toMatch(/850[\s().-]*543[\s.-]*0748/i);
  });
});
