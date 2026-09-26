import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import { db, pool } from "../server/db";
import { users, businesses, profiles } from "../shared/schema";
/** Caller has already stripped credentials and migrated its fresh loopback database. */
export async function prepareJwStoneFeatureFixture() {
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(new URL(process.env.DATABASE_URL || "").hostname, "127.0.0.1");
  assert.equal(
    (await pool.query("SELECT current_database() name")).rows[0].name,
    "ts_jw_workflow_test"
  );
  async function identity(role: "super_admin" | "contractor", label: string) {
    const id = "jw-feature-" + label + "-" + randomUUID();
    const email = id + "@example.invalid",
      password = randomUUID() + randomUUID();
    await db
      .insert(users)
      .values({
        id,
        email,
        password: await bcrypt.hash(password, 10),
        firstName: "Synthetic",
        lastName: label,
        role,
        roles: [role],
        activeRole: role,
        phone: "2025550147",
        stateCode: "FL",
        countyFips: "12001",
        addressVerified: true,
        emailVerified: true,
        verificationStatus: "approved",
        verifiedBadge: true,
        onboardingCompleted: true,
        profileVersion: 1,
        locationCommitted: true,
      });
    return { id, email, password };
  }
  const admin = await identity("super_admin", "controller");
  const otherOwner = await identity("contractor", "other-owner");
  const [otherBusiness] = await db
    .insert(businesses)
    .values({
      name: "Other synthetic supplier",
      slug: "jw-feature-other-business",
      ownerUserId: otherOwner.id,
      roleContext: "business_owner",
      type: "contractor",
      status: "active",
      claimStatus: "claimed",
      publicDiscoveryEnabled: true,
    })
    .returning();
  await db
    .insert(profiles)
    .values({
      ownerUserId: otherOwner.id,
      businessId: otherBusiness.id,
      roleContext: "contractor",
      slug: "jw-feature-other",
      displayName: "Other synthetic supplier",
      status: "published",
      publiclyReleased: true,
      contentBlocks: [],
    });
  const {
    getStoneInventoryProfileTarget,
    upsertCurrentStoneInventory,
    setStoneInventorySaleReady,
  } = await import("../server/services/stoneInventoryService");
  const otherTarget = await getStoneInventoryProfileTarget("jw-feature-other");
  assert(otherTarget);
  const otherStock = await upsertCurrentStoneInventory(otherTarget, {
    materialSlug: "fixture-granite",
    materialName: "Fixture Granite",
    materialClass: "natural_stone",
    materialFamily: "Granite",
    assetKind: "slab",
    quantity: 5,
    unit: "slabs",
    dimensions: { length: 120, height: 60, unit: "in" },
    imageUrls: [],
    finishQuantities: [],
    lastConfirmedAt: new Date().toISOString(),
    confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await setStoneInventorySaleReady({
    target: otherTarget,
    publicId: otherStock.id,
    saleReady: true,
    actorUserId: otherOwner.id,
  });
  const { syncBidRockStoneInventory } = await import("../server/services/bidrockService");
  await syncBidRockStoneInventory();
  return { admin, otherOwner, otherBusinessId: otherBusiness.id, otherStockId: otherStock.id };
}
