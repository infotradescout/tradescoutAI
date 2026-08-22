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

describe("BidRock closure migration and readiness contracts", () => {
  it("registers the ordered recovery migrations in the journal used by db:migrate", () => {
    const packageJson = JSON.parse(read("package.json"));
    const migrateScript = read("scripts/db-migrate-safe.mjs");
    const journal = JSON.parse(read("migrations/meta/_journal.json"));
    const entries = journal.entries as Array<{ idx: number; when: number; tag: string }>;
    const recoveryEntries = entries.filter((entry) => /^012[1-5]_/.test(entry.tag));

    expect(packageJson.scripts["db:migrate"]).toBe("node scripts/db-migrate-safe.mjs");
    expect(migrateScript).toContain('run("npx drizzle-kit migrate")');
    expect(recoveryEntries.map((entry) => entry.tag)).toEqual([
      "0121_jw_stone_inventory_truth",
      "0122_stone_core_schema",
      "0123_profile_accounts_and_entitlements",
      "0124_bidrock_marketplace",
      "0125_bidrock_timed_auctions",
    ]);
    expect(recoveryEntries.map((entry) => entry.idx)).toEqual([124, 125, 126, 127, 128]);
    expect(
      recoveryEntries.every(
        (entry, index) => index === 0 || entry.when > recoveryEntries[index - 1]!.when
      )
    ).toBe(true);
    for (const entry of recoveryEntries) {
      expect(fs.existsSync(path.resolve(process.cwd(), "migrations", `${entry.tag}.sql`))).toBe(
        true
      );
    }
  });

  it("repairs and freezes public listing ids before validating uniqueness", () => {
    const migration = read("migrations/0124_bidrock_marketplace.sql");
    const audit = migration.indexOf("CREATE TABLE IF NOT EXISTS bidrock_listing_public_id_audit");
    const repair = migration.indexOf("bidrock_listing_public_id_repair_queue");
    const formatCheck = migration.indexOf("bidrock_listings_public_id_format_check");
    const uniqueIndex = migration.indexOf("idx_bidrock_listings_public_id_unique");

    expect(audit).toBeGreaterThanOrEqual(0);
    expect(repair).toBeGreaterThan(audit);
    expect(formatCheck).toBeGreaterThan(repair);
    expect(uniqueIndex).toBeGreaterThan(formatCheck);
    expect(migration).toContain("duplicate_rank > 1");
    expect(migration).toContain("public_id !~ '^brl_[a-z0-9]{20,80}$'");
    expect(migration).toContain("VALIDATE CONSTRAINT bidrock_listings_public_id_format_check");
    expect(migration).toContain("index_record.indisvalid = FALSE");
    expect(migration).toContain("DROP INDEX idx_bidrock_listings_public_id_unique");
    expect(migration).toContain("NEW.public_id IS DISTINCT FROM OLD.public_id");
    expect(migration).toContain("BEFORE UPDATE OF public_id, inventory_position_id");
  });

  it("merges every legacy handoff replay key before deduplication and fails conflicts closed", () => {
    const migration = read("migrations/0124_bidrock_marketplace.sql");
    const conflictCheck = migration.indexOf("Conflicting duplicate BidRock handoff replay history");
    const merge = migration.indexOf("-- Merge the full replay history into the survivor");
    const deletion = migration.indexOf("DELETE FROM bidrock_handoffs handoff");

    expect(conflictCheck).toBeGreaterThanOrEqual(0);
    expect(merge).toBeGreaterThan(conflictCheck);
    expect(deletion).toBeGreaterThan(merge);
    expect(migration).toContain("jsonb_object_agg(key, fingerprint ORDER BY key)");
    expect(migration).toContain("bidrock_handoffs_lifecycle_trigger");
  });

  it("requires validated constraints, ready unique indexes, enabled triggers, and scoped route guards", () => {
    const preflight = read("server/schemaPreflight.ts");
    const stoneRoutes = read("server/routes/stone-inventory.ts");
    const profileRoutes = read("server/routes/profile-accounts.ts");
    const bidrockRoutes = read("server/routes/bidrock.ts");

    expect(preflight).toContain("AND convalidated = TRUE");
    expect(preflight).toContain("index_record.indisvalid = TRUE");
    expect(preflight).toContain("index_record.indisready = TRUE");
    expect(preflight).toContain("trigger_record.tgenabled IN ('O', 'A')");
    expect(preflight).toContain("bidrock_handoffs_lifecycle_trigger");
    expect(stoneRoutes).toContain(
      'app.use("/api/u/:slug/stone-inventory", requireCriticalSchema("stone_inventory"))'
    );
    expect(stoneRoutes.match(/requireCriticalSchema\("bidrock"\)/g)?.length).toBeGreaterThanOrEqual(
      4
    );
    expect(profileRoutes).toContain('requireCriticalSchema("profile_accounts")');
    expect(bidrockRoutes).toContain('requireCriticalSchema("bidrock")');
  });

  it("requires active seller entitlement while preserving exact inventory scopes", () => {
    const service = read("server/services/bidrockService.ts");
    const orderAccess = section(
      service,
      "function viewerCanAccessOrder",
      "function viewerCanManageOrder"
    );
    const sellerInventory = section(
      service,
      "export async function listBidRockSellerInventory",
      "export async function setBidRockListingPrice"
    );
    const listingMapper = section(service, "function mapListing", "async function listingRows");

    expect(orderAccess).toContain("viewer.verifiedBusiness");
    expect(sellerInventory).toContain("...viewer.readableInventoryBusinessIds");
    expect(sellerInventory).toContain("...viewer.writableInventoryBusinessIds");
    expect(sellerInventory).toContain("...viewer.publishableInventoryBusinessIds");
    expect(service).toContain("viewer.readableInventoryBusinessIds.size > 0");
    expect(listingMapper).toContain(
      "sellerCapabilities: { read: canRead, write: canWrite, publish: canPublish }"
    );
    expect(listingMapper).not.toContain("inventoryPositionId:");
    expect(listingMapper).not.toContain("sellerBusinessId:");
  });

  it("refreshes canonical listing facts under ordered locks and CAS on edit, publish, and bulk projection", () => {
    const service = read("server/services/bidrockService.ts");
    const stone = read("server/services/stoneInventoryService.ts");
    const projection = section(
      service,
      "async function lockBidRockProjectionRows",
      "/** Project physical inventory positions only."
    );
    const publication = section(
      service,
      "export async function setBidRockListingSaleReady",
      "export async function setBidRockSavedListing"
    );

    expect(projection).toContain("FOR UPDATE OF inventory, passport, material");
    expect(projection).toContain("WHERE inventory_position_id = $1::uuid\n      FOR UPDATE");
    for (const fact of [
      "source_profile_slug",
      "source_profile_name",
      "material_slug",
      "title",
      "material_family",
      "image_url",
      "dimensions_json",
      "finish_quantities",
      "quantity",
      "unit",
    ]) {
      expect(projection).toContain(`${fact} =`);
    }
    expect(projection).toContain("WHERE id = $1::uuid AND version = $22");
    expect(stone).toContain("refreshBidRockListingProjection(client");
    expect(stone).toContain("forceDraft: true");
    expect(publication).toContain("refreshBidRockListingProjection(client");
    expect(publication).toContain("confirmation_fresh: projection.canonical?.confirmation_fresh");
    expect(service).not.toContain("ON CONFLICT (inventory_position_id) DO UPDATE SET");
  });

  it("replays offers and handoffs before mutable prerequisites and exposes a redacted provider queue", () => {
    const service = read("server/services/bidrockService.ts");
    const routes = read("server/routes/bidrock.ts");
    const workspace = read("client/src/features/bidrock/BidRockWorkspace.tsx");
    const offer = section(
      service,
      "export async function createBidRockOffer",
      "export async function listBidRockOffers"
    );
    const handoff = section(
      service,
      "export async function recordBidRockHandoff",
      "export async function completeBidRockOrder"
    );
    const queue = section(
      service,
      "export async function listBidRockProviderAssignments",
      "export async function markBidRockOrderPaymentReady"
    );

    expect(offer.indexOf("offer.idempotency_key = $2")).toBeLessThan(
      offer.indexOf("listing.status = 'active'")
    );
    expect(offer).toContain('status: "submitted", is_expired: false');
    expect(handoff.indexOf("const priorFingerprint")).toBeLessThan(
      handoff.indexOf("const mutationCapability")
    );
    expect(handoff.indexOf("const completedPrerequisites")).toBeLessThan(
      handoff.indexOf("const mutationCapability")
    );
    expect(handoff).toContain("_bidrockReplayOrderStatuses");
    expect(queue).toContain("orders.public_id AS order_reference");
    expect(queue).toContain("orders.listing_public_id AS lot_reference");
    expect(queue).not.toContain("subtotal_cents");
    expect(queue).not.toContain("buyer_user_id");
    expect(routes).toContain('"/api/bidrock/provider/assignments"');
    expect(workspace).toContain("ProviderAssignmentQueue");
    expect(workspace).toContain("Open handoff");
  });
});
