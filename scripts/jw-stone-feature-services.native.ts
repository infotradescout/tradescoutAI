import assert from "node:assert/strict";
assert.equal(process.env.NODE_ENV, "test");
const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/ts_jw_workflow_test");
const { pool } = await import("../server/db");
const {
  requireJwStoneBusinessEnhancements,
  requireBidRockResourceEnhancements,
  pausedJwStoneBusinessIds,
} = await import("../server/services/jwStoneFeatureAccess");
const { getStoneInventoryProfileTarget, upsertCurrentStoneInventory } =
  await import("../server/services/stoneInventoryService");
const { reviewJwStoneOffer } = await import("../server/services/jwStoneOfferReview");
const { createBidRockOffer, syncBidRockStoneInventory } =
  await import("../server/services/bidrockService");
try {
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    "ts_jw_workflow_test"
  );
  const target = await getStoneInventoryProfileTarget("jw-stone");
  assert(target);
  const other = await getStoneInventoryProfileTarget("jw-feature-other");
  assert(other);
  assert.equal(other.businessId, process.env.JW_FEATURE_OTHER_BUSINESS_ID);
  const mutation = {
    materialSlug: "service-fixture",
    materialName: "Service Fixture",
    materialClass: "natural_stone" as const,
    materialFamily: "Granite",
    assetKind: "slab" as const,
    quantity: 1,
    unit: "slabs",
    dimensions: { length: 120, height: 60, unit: "in" as const },
    imageUrls: [],
    finishQuantities: [],
    lastConfirmedAt: new Date().toISOString(),
    confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  };
  const denied = (error: any) =>
    error.code === "JW_STONE_FEATURE_UNAVAILABLE" && error.status === 403;
  await assert.rejects(requireJwStoneBusinessEnhancements(target.businessId), denied);
  await assert.rejects(upsertCurrentStoneInventory(target, mutation), denied);
  await assert.rejects(
    reviewJwStoneOffer({
      profileSlug: "jw-stone",
      viewerId: target.ownerUserId,
      user: { id: target.ownerUserId },
      input: {} as any,
    }),
    denied
  );
  const listing = (
    await pool.query("SELECT public_id FROM bidrock_listings WHERE seller_business_id=$1 LIMIT 1", [
      target.businessId,
    ])
  ).rows[0];
  assert(listing);
  await assert.rejects(
    requireBidRockResourceEnhancements({ listingId: listing.public_id }),
    denied
  );
  await assert.rejects(
    createBidRockOffer({
      userId: other.ownerUserId,
      listingId: listing.public_id,
      quantity: 1,
      totalAmountCents: 100,
      idempotencyKey: "native-feature-service",
    }),
    denied
  );
  assert.deepEqual(await pausedJwStoneBusinessIds(), [target.businessId]);
  const before = (
    await pool.query("SELECT * FROM bidrock_listings WHERE seller_business_id=$1 ORDER BY id", [
      target.businessId,
    ])
  ).rows;
  await syncBidRockStoneInventory();
  assert.deepEqual(
    (
      await pool.query("SELECT * FROM bidrock_listings WHERE seller_business_id=$1 ORDER BY id", [
        target.businessId,
      ])
    ).rows,
    before,
    "Background projection must not republish paused JW stock"
  );
  await requireJwStoneBusinessEnhancements(other.businessId);
  const saved = await upsertCurrentStoneInventory(other, mutation);
  assert(saved.id, "Unrelated business retains real inventory writing");
  const otherListing = (
    await pool.query("SELECT public_id FROM bidrock_listings WHERE seller_business_id=$1 LIMIT 1", [
      other.businessId,
    ])
  ).rows[0];
  assert(otherListing);
  await requireBidRockResourceEnhancements({ listingId: otherListing.public_id });
  console.log(
    "JW_FEATURE_SERVICE_PROOF " +
      JSON.stringify({
        canonicalTenant: true,
        newJwStockDenied: true,
        directOfferServiceDenied: true,
        directBidRockServiceDenied: true,
        backgroundProjectionSkippedJw: true,
        otherBusinessWritePassed: true,
      })
  );
} finally {
  await pool.end();
}
