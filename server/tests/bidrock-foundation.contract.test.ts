import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("BidRock marketplace foundation contract", () => {
  it("projects every TradeScout profile stone and Stone Core material without manufacturing inventory", () => {
    const service = read("server/services/bidrockService.ts");

    expect(service).toContain("loadProfileInventoryCandidates");
    expect(service).toContain("inventoryCatalog");
    expect(service).toContain("loadStoneCoreCandidates");
    expect(service).toContain("FROM stone_materials");
    expect(service).toContain("syncBidRockCatalog");
    expect(service).toContain("ON CONFLICT (source_key) DO UPDATE");
    expect(service).toContain("archiveStaleListings");
    expect(service).toContain("WHEN bidrock_listings.status = 'sold' THEN 'sold'");
    expect(service).not.toMatch(/INSERT INTO stone_asset_passports/i);
    expect(service).not.toMatch(/INSERT INTO stone_inventory_positions/i);
  });

  it("keeps unrelated profile inventory out of the stone marketplace", () => {
    const domain = read("shared/bidrock.ts");
    const service = read("server/services/bidrockService.ts");
    const boundary = read("server/services/bidrockStoneBoundary.ts");
    const mount = read("server/routes/jw-stone-saved-stones-email.ts");

    expect(domain).toContain("BIDROCK_STONE_MATERIAL_FAMILIES");
    expect(domain).toContain("isBidRockStoneMaterialFamily");
    expect(service).toContain("if (!isBidRockStoneMaterialFamily(materialFamily, row.profile_slug)) return");
    expect(boundary).toContain("enforce_bidrock_stone_only");
    expect(boundary).toContain("NEW.status := 'archived'");
    expect(boundary).toContain("source_kind = 'stone_core'");
    expect(boundary).toContain("source_profile_slug = 'jw-stone'");
    expect(boundary).toContain("material_family = 'unconfirmed'");

    const boundaryCall = mount.indexOf("registerBidRockStoneBoundary(app)");
    const routeCall = mount.indexOf("registerBidRockRoutes(app)");
    expect(boundaryCall).toBeGreaterThan(-1);
    expect(routeCall).toBeGreaterThan(-1);
    expect(boundaryCall).toBeLessThan(routeCall);
  });

  it("defaults missing prices to seller choice between square foot and slab", () => {
    const service = read("server/services/bidrockService.ts");
    const route = read("server/routes/bidrock.ts");

    expect(service).toContain("pricing_mode TEXT NOT NULL DEFAULT 'seller_set'");
    expect(service).toContain("price_unit IN ('sqft', 'slab')");
    expect(service).toContain('priceState: "seller_choice"');
    expect(route).toContain("Set your price per square foot or per slab.");
    expect(route).toContain("/api/bidrock/listings/:id/price");
    expect(route).toContain("isAuthenticated");
  });

  it("keeps prices private to verified businesses and authorized sellers", () => {
    const service = read("server/services/bidrockService.ts");

    expect(service).toContain("price_visibility TEXT NOT NULL DEFAULT 'verified_business'");
    expect(service).toContain("const canSeePrice = viewer.verifiedBusiness || canManagePrice");
    expect(service).toContain("viewerCanManageListing");
    expect(service).toContain("profile_account_entitlements");
    expect(service).toContain("profile_accounts");
    expect(service).not.toContain("bidrock_accounts");
    expect(service).not.toContain("bidrock_profile_accounts");
  });

  it("uses the profile-owned account flow and removes role-specific BidRock onboarding", () => {
    const domain = read("shared/bidrock.ts");
    const route = read("server/routes/bidrock.ts");
    const service = read("server/services/bidrockService.ts");
    const jw = read("client/src/features/jw-stone/JwStoneCompanySection.tsx");

    expect(domain).toContain("buildBidRockSourceProfileAccountPath");
    expect(domain).toContain("profileAccount");
    expect(route).toContain("renderLegacyAccountRedirect");
    expect(route).toContain("buildBidRockSourceProfileAccountPath");
    expect(route).not.toContain("accountRole");
    expect(route).not.toContain("Business type");
    expect(service).not.toContain("ensureBusinessUserProfile");
    expect(service).not.toContain("ensureBidRockProfileAccount");
    expect(jw).not.toContain("Create a fabricator account");
    expect(jw).not.toContain("buildBidRockProfileAccountPath");
  });

  it("mounts BidRock after the shared profile-account routes", () => {
    const mount = read("server/routes/jw-stone-saved-stones-email.ts");
    const profileAccountCall = mount.indexOf("registerProfileAccountRoutes(app)");
    const boundaryCall = mount.indexOf("registerBidRockStoneBoundary(app)");
    const bidRockCall = mount.indexOf("registerBidRockRoutes(app)");

    expect(profileAccountCall).toBeGreaterThan(-1);
    expect(boundaryCall).toBeGreaterThan(profileAccountCall);
    expect(bidRockCall).toBeGreaterThan(boundaryCall);
  });

  it("locks ACH-only and sold-listing-fee posture without claiming checkout is live", () => {
    const domain = read("shared/bidrock.ts");
    const docs = read("docs/architecture/BIDROCK.md");

    expect(domain).toContain('BIDROCK_PAYMENT_METHOD = "ach"');
    expect(domain).toContain("BIDROCK_SOLD_LISTING_FEE_CENTS = 10_000");
    expect(docs).toContain("does not launch checkout");
    expect(docs).toContain("buyer offers");
    expect(docs).toContain("BidRock does not create a BidRock account");
  });
});
