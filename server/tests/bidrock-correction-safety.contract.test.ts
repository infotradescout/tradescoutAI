import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function slice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("BidRock correction safety contracts", () => {
  it("orders audits before unique canonical constraints and keeps runtime services DDL-free", () => {
    const stoneMigration = read("migrations/0122_stone_core_schema.sql");
    const bidrockMigration = read("migrations/0124_bidrock_marketplace.sql");
    const services = [
      "server/services/stoneCoreProvisioning.ts",
      "server/services/profileAccountService.ts",
      "server/services/profileAccountEntitlementService.ts",
      "server/services/bidrockService.ts",
    ]
      .map(read)
      .join("\n");

    expect(stoneMigration.indexOf("stone_inventory_position_dedup_audit")).toBeLessThan(
      stoneMigration.indexOf("stone_inventory_positions_passport_holder_unique")
    );
    expect(bidrockMigration.indexOf("bidrock_canonical_link_dedup_audit")).toBeLessThan(
      bidrockMigration.indexOf("idx_bidrock_orders_marketplace_transaction_unique")
    );
    expect(bidrockMigration).toContain("enforce_bidrock_immutable_links");
    expect(bidrockMigration).toContain("bidrock_order_delegations");
    expect(bidrockMigration).toContain("bidrock_legacy_listing_audit");
    expect(bidrockMigration.indexOf("bidrock_legacy_listing_audit")).toBeLessThan(
      bidrockMigration.indexOf("ALTER COLUMN inventory_position_id SET NOT NULL")
    );
    expect(bidrockMigration).toContain("DROP COLUMN IF EXISTS sold_listing_fee_cents");
    expect(services).not.toMatch(/CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE TRIGGER/);

    const handoffTable = slice(
      bidrockMigration,
      "CREATE TABLE IF NOT EXISTS bidrock_handoffs",
      "ALTER TABLE bidrock_handoffs"
    );
    expect(handoffTable.match(/\n\s+status TEXT/g)).toHaveLength(1);
  });

  it("keeps public reads pure and publication evidence authoritative", () => {
    const bidrock = read("server/services/bidrockService.ts");
    const routes = read("server/routes/bidrock.ts");
    const catalog = slice(
      bidrock,
      "export async function listBidRockCatalog",
      "export async function listBidRockSellerInventory"
    );
    const orderRead = slice(
      bidrock,
      "export async function getBidRockOrderWorkspace",
      "export async function listBidRockOrders"
    );

    expect(catalog).not.toMatch(/UPDATE |INSERT INTO|DELETE FROM|releaseExpired|syncBidRock/);
    expect(orderRead).not.toMatch(/UPDATE |INSERT INTO|DELETE FROM|releaseExpired|syncBidRock/);
    expect(bidrock).toContain("Object.keys(recordValue(row.publication_evidence)).length > 0");
    expect(bidrock).toContain("Boolean(row.inventory_published_at)");
    expect(bidrock).toContain(
      "SET price_unit = $2, price_cents = $3, status = 'draft', published_at = NULL"
    );
    const stoneInventory = read("server/services/stoneInventoryService.ts");
    expect(stoneInventory).toContain(
      "Object.keys(recordValue(row.publication_evidence)).length > 0"
    );
    expect(stoneInventory).toContain("Boolean(row.published_at)");
    expect(stoneInventory).toContain(
      "Reserved inventory cannot be published until its hold is released"
    );
    expect(stoneInventory).toContain("status NOT IN ('reserved', 'sold', 'archived')");
    expect(routes).toContain('"/api/admin/bidrock/maintenance/project-inventory"');
    expect(routes).toContain('"/api/admin/bidrock/maintenance/expire-holds"');

    const inventoryRoutes = read("server/routes/stone-inventory.ts");
    expect(inventoryRoutes).toContain(
      "const projectedListings = await syncBidRockStoneInventory()"
    );
  });

  it("uses DB-clock expiry, row locks, CAS versions, canonical holds, and one-time effects", () => {
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0124_bidrock_marketplace.sql");

    expect(service).toContain("reservation.expires_at <= NOW()");
    expect(service).toContain(
      "FOR UPDATE OF reservation, orders, listing, allocation, inventory SKIP LOCKED"
    );
    expect(service).toContain(
      "SET status = 'expired', expired_at = NOW(), inventory_effect_status = 'released'"
    );
    expect(service).toContain("SET held_quantity = held_quantity + $2");
    expect(service).toContain("quantity - held_quantity >= $2");
    expect(service).toContain("INSERT INTO bidrock_inventory_allocations");
    expect(service).toContain("AND version = $2 AND inventory_effect_status = 'held'");
    expect(service).toContain("AND status = 'held'\n        RETURNING id");
    expect(migration).toContain(
      "CHECK (inventory_effect_status IN ('held', 'released', 'consumed'))"
    );
    expect(migration).toContain("WHEN orders.status IN ('cancelled', 'expired') THEN 'released'");
  });

  it("validates immutable ACH and procurement provenance again at settlement", () => {
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0124_bidrock_marketplace.sql");
    const settlement = slice(
      service,
      "export async function recordBidRockPaymentSettlement",
      "function nextOrderStatusForHandoff"
    );

    for (const field of [
      "platform_fee",
      "processing_fee",
      "buyer_fee_share",
      "seller_fee_share",
      "estimated_delivery_fee_cents",
      "estimated_service_fee_cents",
      "actual_delivery_fee_cents",
      "actual_service_fee_cents",
    ]) {
      expect(service).toContain(field);
    }
    expect(service).toContain("if (!isExplicitZero(value))");
    expect(service).toContain('row.source_channel !== "bidrock"');
    expect(service).toContain("metadata.bidrockOrderId");
    expect(service).toContain("metadata.sellerBusinessId");
    expect(service).toContain("row.stripe_payment_intent_id || row.stripe_transfer_id");
    expect(service).toContain('row.payment_method !== "off_platform_direct"');
    expect(settlement).toContain("validateCanonicalMarketplaceTransaction(");
    expect(settlement).toContain("validateCanonicalProcurementOrder(");
    expect(settlement).toContain("true");
    expect(migration).toContain("idx_bidrock_orders_marketplace_transaction_unique");
    expect(migration).toContain("idx_bidrock_orders_procurement_order_unique");
  });

  it("locks staged handoffs to sellers, admins, or durable scoped delegates", () => {
    const service = read("server/services/bidrockService.ts");
    const routes = read("server/routes/bidrock.ts");
    const handoff = slice(
      service,
      "export async function recordBidRockHandoff",
      "export async function completeBidRockOrder"
    );

    expect(service).toContain("bidrock_order_delegations delegation");
    expect(service).toContain("export async function setBidRockOrderDelegation");
    expect(routes).toContain('"/api/admin/bidrock/orders/:id/delegations"');
    expect(service).toContain("$3 = ANY(delegation.handoff_types)");
    expect(handoff).toContain("SELECT * FROM bidrock_orders WHERE public_id = $1 FOR UPDATE");
    expect(handoff).toContain("Provider evidence is required when a handoff starts");
    expect(handoff).toContain(
      "Completed handoffs require a provider reference and truthful evidence"
    );
    expect(handoff).toContain("buildBidRockProviderHandoffActionCapability({");
    expect(handoff).toContain("completedHandoffTypes: Array.from(completedTypes)");
    expect(handoff).toContain("if (!mutationCapability.enabled)");
    expect(handoff).toContain("if (args.status !== mutationCapability.nextStatus)");
    expect(handoff).toContain("requestFingerprint({");
    expect(handoff).toContain("evidence,");
    expect(handoff).toContain("AND version = $3 RETURNING *");
    expect(routes).toContain("evidence: z.record(z.unknown()).optional()");
  });

  it("renders only server-authorized actions and routed mobile detail workflows", () => {
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    const activity = read("client/src/features/bidrock/BidRockOperationsPanels.tsx");
    const orderSheet = read("client/src/features/bidrock/BidRockOrderSheet.tsx");
    const client = read("client/src/features/bidrock/bidrockClient.ts");

    expect(activity).toContain("offer.actions.accept");
    expect(activity).toContain("offer.actions.counter");
    expect(activity).toContain("offer.actions.reject");
    expect(activity).toContain("order.actions.prepareAch");
    expect(activity).toContain("order.actions.cancel");
    expect(orderSheet).toContain("order.actions.linkCanonical");
    expect(orderSheet).toContain("order.actions.settleAch");
    expect(orderSheet).toContain("order.actions.complete");
    expect(orderSheet).toContain("order.actions.installationHomeId");
    expect(workspace).toContain('data-testid="bidrock-mobile-lot-detail"');
    expect(workspace).toContain('window.matchMedia("(max-width: 1023px)")');
    expect(workspace).toContain("BidRockOrderSheet");
    expect(client).toContain("counterBidRockOffer");
    expect(client).toContain("linkBidRockOrderSystems");
    expect(client).toContain("settleBidRockAch");
  });
});
