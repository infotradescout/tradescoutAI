import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BIDROCK_PAYMENT_METHOD,
  BIDROCK_PRICE_VISIBILITY,
  canTransitionBidRockOrder,
  canViewBidRockPrivatePrice,
  normalizeBidRockAmountToCents,
} from "@shared/bidrock";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("BidRock marketplace recovery contract", () => {
  it("keeps seller pricing private to verified businesses and listing managers", () => {
    expect(BIDROCK_PRICE_VISIBILITY).toBe("verified_business");
    expect(canViewBidRockPrivatePrice({ verifiedBusiness: false, canManage: false })).toBe(false);
    expect(canViewBidRockPrivatePrice({ verifiedBusiness: true, canManage: false })).toBe(true);
    expect(canViewBidRockPrivatePrice({ verifiedBusiness: false, canManage: true })).toBe(true);
    expect(normalizeBidRockAmountToCents("125.75")).toBe(12_575);
  });

  it("uses the ACH transaction rail and preserves forward-only fulfillment state", () => {
    expect(BIDROCK_PAYMENT_METHOD).toBe("ach");
    expect(canTransitionBidRockOrder("reservation_active", "payment_ready")).toBe(true);
    expect(canTransitionBidRockOrder("payment_ready", "payment_processing")).toBe(true);
    expect(canTransitionBidRockOrder("payment_processing", "paid")).toBe(true);
    expect(canTransitionBidRockOrder("paid", "custody_transferred")).toBe(true);
    expect(canTransitionBidRockOrder("custody_transferred", "completed")).toBe(true);
    expect(canTransitionBidRockOrder("reservation_active", "paid")).toBe(false);
  });

  it("routes BidRock through JSON services and a real client workspace", () => {
    const routes = read("server/routes/bidrock.ts");
    const service = read("server/services/bidrockService.ts");
    const app = read("client/src/App.tsx");
    const appRoutes = read("client/src/AppRoutes.tsx");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");

    expect(routes).toContain('app.get("/api/bidrock/catalog"');
    expect(routes).toContain('"/api/bidrock/listings/:id/offers"');
    expect(routes).toContain('"/api/bidrock/orders/:id/handoffs"');
    expect(service).toContain("Photo-library records never enter BidRock here");
    expect(service).toContain("viewerCanManageListing");
    expect(service).toContain("releaseExpiredBidRockReservations");
    expect(app).toContain('pathOnly === "/bidrock"');
    expect(appRoutes).toContain('import("./features/bidrock/BidRockWorkspace")');
    expect(workspace).toContain("Search inventory");
    expect(workspace).toContain("Compare physical lots");
    expect(workspace).toContain("Seller inventory");
    expect(workspace).toContain("Transactions");
  });

  it("keeps schema changes in ordered migrations and public GET services read-only", () => {
    const stoneMigration = read("migrations/0116_stone_core_schema.sql");
    const accountMigration = read("migrations/0117_profile_accounts_and_entitlements.sql");
    const bidrockMigration = read("migrations/0118_bidrock_marketplace.sql");
    const stoneProvisioning = read("server/services/stoneCoreProvisioning.ts");
    const profileAccounts = read("server/services/profileAccountService.ts");
    const bidrock = read("server/services/bidrockService.ts");

    expect(stoneMigration).toContain("stone_inventory_position_dedup_audit");
    expect(stoneMigration).toContain("stone_inventory_positions_passport_holder_unique");
    expect(accountMigration).toContain("profile_account_entitlements");
    expect(bidrockMigration).toContain("bidrock_inventory_allocations");
    expect(bidrockMigration).toContain("enforce_bidrock_immutable_links");
    expect(`${stoneProvisioning}\n${profileAccounts}\n${bidrock}`).not.toMatch(
      /CREATE TABLE|ALTER TABLE/
    );

    const catalogBody = bidrock.slice(
      bidrock.indexOf("export async function listBidRockCatalog"),
      bidrock.indexOf("export async function listBidRockSellerInventory")
    );
    const orderBody = bidrock.slice(
      bidrock.indexOf("export async function getBidRockOrderWorkspace"),
      bidrock.indexOf("export async function markBidRockOrderPaymentReady")
    );
    expect(catalogBody).not.toContain("syncBidRockStoneInventory");
    expect(catalogBody).not.toContain("releaseExpiredBidRockReservations");
    expect(orderBody).not.toContain("releaseExpiredBidRockReservations");
  });

  it("redacts non-public listing fields and requires authoritative publication", () => {
    const service = read("server/services/bidrockService.ts");
    const detail = read("client/src/features/bidrock/BidRockDetailPanel.tsx");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    const listingMapper = service.slice(
      service.indexOf("function mapListing"),
      service.indexOf("async function listingRows")
    );

    expect(service).toContain("const saleReady =");
    expect(service).toContain('status === "active"');
    expect(service).toContain("STONE_CURRENT_INVENTORY_PUBLIC_STATUS");
    expect(service).toContain(
      "filter((listing): listing is BidRockListing => Boolean(listing?.saleReady))"
    );
    expect(service).toContain("canViewBidRockPrivatePrice({");
    expect(service).toContain("canManage: canRead || canManage");
    expect(service).toContain(
      "sellerCapabilities: { read: canRead, write: canWrite, publish: canPublish }"
    );
    expect(listingMapper).not.toContain("inventoryPositionId:");
    expect(listingMapper).not.toContain("sellerBusinessId:");
    expect(detail).toContain("{verifiedBusiness ? (");
    expect(workspace).toContain("{verifiedBusiness ? (");
  });

  it("enforces seller ownership, idempotency, canonical ACH reconciliation, and admin completion", () => {
    const routes = read("server/routes/bidrock.ts");
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0118_bidrock_marketplace.sql");

    expect(service).toContain("viewerCanManageListing(viewer, row)");
    expect(service).toContain("A seller cannot submit an offer on their own inventory");
    expect(migration).toContain("UNIQUE (buyer_user_id, idempotency_key)");
    expect(migration).toContain("UNIQUE (order_id, idempotency_key)");
    expect(service).toContain("FROM marketplace_transactions");
    expect(service).toContain(
      "Canonical marketplace transaction must identify an ACH bank transfer"
    );
    expect(service).toContain("FROM procurement_orders");
    expect(service).toContain("Completed custody handoff is required before sale completion");
    expect(routes).toContain('"/api/admin/bidrock/orders/:id/system-links"');
    expect(routes).toContain('"/api/admin/bidrock/orders/:id/payment-settled"');
    expect(routes).toContain('"/api/admin/bidrock/orders/:id/complete"');
  });

  it("keeps JW photo records in a material library separate from published stock", () => {
    const jwSurface = read("client/src/features/jw-stone/JWStoneMarketplace.tsx");
    const collection = read("client/src/features/jw-stone/StoneCollection.tsx");
    const current = read("client/src/features/jw-stone/CurrentInventorySection.tsx");

    expect(jwSurface).toContain("CurrentInventorySection");
    expect(collection).toContain('title="Material Library"');
    expect(current).toContain("Only physical lots explicitly marked sale-ready");
    expect(current).toContain("does not claim that a physical item is on hand");
    expect(current).not.toContain("sourceAssetRef");
  });
});
