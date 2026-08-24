import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

function section(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("BidRock final bounded correction contracts", () => {
  it("upgrades the legacy profile source-path constraint and fails closed by surface", () => {
    const migration = read("migrations/0123_profile_accounts_and_entitlements.sql");
    const preflight = read("server/schemaPreflight.ts");
    const profileRoutes = read("server/routes/profile-accounts.ts");
    const bidrockRoutes = read("server/routes/bidrock.ts");

    expect(migration).toContain("pg_get_constraintdef(constraint_record.oid)");
    expect(migration).toContain("LIKE '%^/u/%'");
    expect(migration).toContain("profile_accounts_source_path_safe_check");
    expect(migration).toContain("NOT VALID");
    expect(migration).toContain("VALIDATE CONSTRAINT profile_accounts_source_path_safe_check");
    expect(preflight).toContain("profile_accounts: false");
    expect(preflight).toContain("bidrock: false");
    expect(preflight).toContain("requireCriticalSchema");
    expect(profileRoutes).toContain('requireCriticalSchema("profile_accounts")');
    expect(bidrockRoutes).toContain('requireCriticalSchema("bidrock")');
  });

  it("keeps holder/delegate capabilities exact and removes profile-owner write authority", () => {
    const stone = read("server/services/stoneInventoryService.ts");
    const bidrock = read("server/services/bidrockService.ts");

    expect(stone).not.toContain("userId === args.target.ownerUserId");
    expect(stone).toContain("userId === args.target.businessOwnerUserId");
    expect(stone).toContain("$3 = ANY(delegation.scopes)");
    expect(bidrock).toContain("readableInventoryBusinessIds");
    expect(bidrock).toContain("writableInventoryBusinessIds");
    expect(bidrock).toContain("publishableInventoryBusinessIds");
    expect(bidrock).toContain('viewerCanManageListing(viewer, row, "inventory_publish")');
    expect(bidrock).not.toContain("ownedProfileIds");
    expect(bidrock).toContain('kind: "provider_handoff"');
    const providerDto = section(bidrock, "if (!hasFullAccess) {", "const handoffs =");
    expect(providerDto).not.toContain("subtotalCents");
    expect(providerDto).not.toContain("sellerBusinessId");
    expect(providerDto).not.toContain("id: String(handoff.id)");
  });

  it("locks publication before validation, uses CAS, and preserves material identity", () => {
    const stone = read("server/services/stoneInventoryService.ts");
    const bidrock = read("server/services/bidrockService.ts");
    const stoneEdit = section(
      stone,
      "export async function upsertCurrentStoneInventory",
      "export async function setStoneInventorySaleReady"
    );
    const publication = section(
      bidrock,
      "export async function setBidRockListingSaleReady",
      "export async function setBidRockSavedListing"
    );

    expect(stoneEdit).toContain("FOR UPDATE OF ap, m, ip");
    expect(stoneEdit).toContain("WHERE inventory_position_id = $1::uuid");
    expect(stoneEdit).not.toContain("FOR UPDATE OF ap, m, ip, listing");
    expect(stoneEdit).toContain("Material identity is immutable");
    expect(stoneEdit).not.toContain("SET material_id =");
    expect(publication.indexOf("FOR UPDATE OF listing, inventory")).toBeLessThan(
      publication.indexOf("Current stock must be re-confirmed")
    );
    expect(publication).not.toContain("Set the verified-business price");
    expect(publication).toContain("AND version = $7");
    expect(publication).toContain("AND version = $4");
    expect(publication).toContain("'actorUserId', $6::text");
    expect(publication).toContain("listingUpdate.rowCount !== 1");
  });

  it("uses stable public listing/order identifiers on every external route", () => {
    const routes = read("server/routes/bidrock.ts");
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0124_bidrock_marketplace.sql");

    expect(routes).toContain("publicListingIdSchema.safeParse");
    expect(routes).toContain("publicOrderIdSchema.safeParse");
    expect(service).toContain("WHERE listing.public_id = $1");
    expect(service).toContain("WHERE orders.public_id = $1");
    expect(service).toContain("listingId: String(row.listing_public_id)");
    expect(migration).toContain("idx_bidrock_listings_public_id_unique");
    expect(migration).toContain("idx_bidrock_orders_public_id_unique");
  });

  it("computes expiry with the DB clock and retains retry keys until success", () => {
    const service = read("server/services/bidrockService.ts");
    const client = read("client/src/features/bidrock/bidrockClient.ts");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");

    expect(service).toContain("offer.expires_at <= NOW() AS is_expired");
    expect(service).toContain("orders.reservation_expires_at <= NOW() AS is_expired");
    expect(workspace).toContain("retryKeys.current.get(semanticKey)");
    expect(workspace).toContain("retryKeys.current.delete(semanticKey)");
    expect(client).toContain("idempotencyKey: args.idempotencyKey");
    expect(client).not.toContain("idempotencyKey: crypto.randomUUID()");
  });

  it("requires exact immutable ACH provenance and zero canonical fee fields", () => {
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0124_bidrock_marketplace.sql");

    expect(service).toContain(
      "expectedReference = `bidrock:${order.public_id}:${order.listing_public_id}`"
    );
    expect(service).toContain("metadata.bidrockOrderId");
    expect(service).toContain("metadata.bidrockOrderPublicId");
    expect(service).toContain("metadata.bidrockListingPublicId");
    expect(service).toContain("if (!isExplicitZero(value))");
    expect(migration).toContain("enforce_bidrock_marketplace_provenance");
    expect(migration).toContain("BidRock canonical marketplace provenance is immutable");
  });

  it("enforces one monotonic handoff per type and exposes bounded admin/mobile controls", () => {
    const service = read("server/services/bidrockService.ts");
    const migration = read("migrations/0124_bidrock_marketplace.sql");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    const panels = read("client/src/features/bidrock/BidRockOperationsPanels.tsx");
    const orderSheet = read("client/src/features/bidrock/BidRockOrderSheet.tsx");

    expect(migration.indexOf("bidrock_handoff_dedup_audit")).toBeLessThan(
      migration.indexOf("idx_bidrock_handoffs_order_type_unique")
    );
    expect(service).toContain("idempotency_history");
    expect(service).toContain("A handoff cannot be duplicated or move backward");
    expect(service).toContain("pending to in progress before completion");
    expect(workspace).toContain("BidRockAdminPanel");
    expect(workspace).toContain("projectBidRockInventory");
    expect(panels).toContain('data-testid="bidrock-mobile-seller-editor"');
    expect(orderSheet).toContain('data-testid="bidrock-provider-handoff-workspace"');
    expect(orderSheet).toContain("Next:");
  });
});
