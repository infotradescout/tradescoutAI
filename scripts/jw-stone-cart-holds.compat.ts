import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.JW_HOLD_COMPAT_FIXTURE, "true");
const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/ts_jw_hold_compat_test");
const keep = new Set([
  "PATH",
  "HOME",
  "TMPDIR",
  "NODE_ENV",
  "TEST_DATABASE_URL",
  "JW_HOLD_COMPAT_FIXTURE",
]);
for (const key of Object.keys(process.env)) if (!keep.has(key)) delete process.env[key];
const { default: dotenv } = await import("dotenv");
dotenv.config = dotenv.configDotenv = () => ({ parsed: {} });
process.env.DATABASE_URL = url.href;
process.env.ALLOW_INSECURE_TEST_DATABASE = "true";
const { db, pool } = await import("../server/db");
const schema = await import("../shared/schema");
const { JwStoneCartHolds } = await import("../server/services/jwStoneCartHolds");
const { getStoneInventoryProfileTarget, upsertCurrentStoneInventory, setStoneInventorySaleReady } =
  await import("../server/services/stoneInventoryService");
const { loadJwStoneCartAvailability } = await import("../server/services/jwStoneCartAvailability");
const { resolveJwStonePricingAccess } = await import("../server/services/jwStonePricingAccess");
const { getJwStonePricingSnapshot } = await import("../server/services/jwStoneDrivePricing");
const { JW_STONE_PRICING_DRIVE_FILE_ID, JW_STONE_PRICING_DRIVE_FOLDER_ID } =
  await import("../shared/jwStoneMemberPricing");
const report = {
  passed: false,
  checks: [] as string[],
  productionWrites: false,
  fullCanonicalBaseSchema: true,
  proposalAppliedSeparately: false,
  realAuthSessionsTested: false,
};
const note = (text: string) => {
  report.checks.push(text);
  console.log("JW_HOLD_COMPAT_CHECK " + text);
};
try {
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    "ts_jw_hold_compat_test"
  );
  // The caller has run the unchanged canonical migration chain and required-schema check.
  const { inspectJwCartHoldSchema } = await import("./lib/jw-cart-hold-schema.mjs");
  assert.equal((await inspectJwCartHoldSchema(pool)).contract, true);
  note("ordered ledger migration and required schema are installed without separate DDL");
  const ownerId = "jw-hold-supplier-" + randomUUID(),
    buyerId = "jw-hold-buyer-" + randomUUID();
  for (const id of [ownerId, buyerId])
    await db.insert(schema.users).values({
      id,
      email: id + "@example.test",
      firstName: "Synthetic",
      lastName: "Reservation",
      role: "contractor",
      roles: ["contractor"],
      activeRole: "contractor",
      profileVisibility: "private",
      emailVerified: false,
      onboardingCompleted: false,
    });
  const [seller] = await db
    .insert(schema.businesses)
    .values({
      name: "Synthetic hold supplier",
      slug: "hold-supplier-" + randomUUID(),
      ownerUserId: ownerId,
      roleContext: "business_owner",
      type: "contractor",
      status: "active",
      claimStatus: "claimed",
      publicDiscoveryEnabled: true,
    })
    .returning();
  const [profile] = await db
    .insert(schema.profiles)
    .values({
      ownerUserId: ownerId,
      businessId: seller.id,
      roleContext: "contractor",
      slug: "jw-stone",
      displayName: "JW Stone",
      status: "published",
      publiclyReleased: true,
      contentBlocks: [],
    })
    .returning();
  const businessProfileId = randomUUID();
  await pool.query(
    "INSERT INTO user_profiles(id,user_id,user_intent,verification_status,display_name) VALUES($1,$2,'business','pending','Synthetic hold member')",
    [businessProfileId, buyerId]
  );
  const account = await pool.query(
    `INSERT INTO profile_accounts(owner_user_id,business_profile_id,target_profile_id,target_business_id,identity_kind,status,verification_status)
    VALUES($1,$2,$3,$4,'business','active','pending') RETURNING id`,
    [buyerId, businessProfileId, profile.id, seller.id]
  );
  await pool.query(
    "INSERT INTO profile_account_entitlements(profile_account_id,product_key,status) VALUES($1,'jw_stone_member_pricing','pending_verification') ON CONFLICT DO NOTHING",
    [account.rows[0].id]
  );
  assert.equal(
    await resolveJwStonePricingAccess({
      userId: buyerId,
      user: { id: buyerId, role: "contractor" },
    }),
    "member"
  );
  note(
    "real profile-account constraints and pending JW membership grant the existing member access"
  );
  const target = await getStoneInventoryProfileTarget("jw-stone");
  assert(target && target.businessId === seller.id);
  const now = new Date().toISOString();
  const stock = await upsertCurrentStoneInventory(target, {
    materialSlug: "hold-test-stone",
    materialName: "Hold Test Stone",
    materialClass: "natural_stone",
    materialFamily: "Granite",
    assetKind: "slab",
    quantity: 3,
    unit: "slabs",
    dimensions: { length: 120, height: 60, thickness: 1.25, unit: "in" },
    finishQuantities: [{ finish: "Polished", slabCount: 3 }],
    imageUrls: [],
    lastConfirmedAt: now,
    confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await setStoneInventorySaleReady({
    target,
    publicId: stock.id,
    saleReady: true,
    actorUserId: ownerId,
  });
  process.env.JW_STONE_PRICING_SOURCE = "approved_import";
  process.env.JW_STONE_PRICING_APPROVED_IMPORT = JSON.stringify({
    schemaVersion: 1,
    fileId: JW_STONE_PRICING_DRIVE_FILE_ID,
    folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
    sourceUpdatedAt: now,
    sourceRetrievedAt: now,
    prices: [
      {
        stoneName: "Hold Test Stone",
        stoneKey: "hold test stone",
        slabPriceCents: 300,
        bundlePriceCents: 200,
        bundleMinSlabs: 2,
        landedCostCents: 100,
      },
    ],
  });
  const snapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
  const holds = new JwStoneCartHolds(pool);
  const before = await loadJwStoneCartAvailability(seller.id, [stock.id]);
  assert.equal(before.get(stock.id)?.availableQuantity, 3);
  const receipt = await holds.reserve({
    buyerUserId: buyerId,
    sellerBusinessId: seller.id,
    snapshot,
    request: {
      idempotencyKey: randomUUID(),
      lines: [{ inventoryPublicId: stock.id, quantity: 2 }],
      expectedSubtotalCents: 20000,
      fulfillment: { method: "delivery", postalCode: "70401" },
    },
  });
  assert.equal(receipt.status, "active");
  assert.equal(receipt.materialSubtotalCents, 20000);
  assert.equal(receipt.fulfillment.method, "delivery");
  assert.equal(receipt.deliveryFeeCents, null);
  assert.equal(
    (await loadJwStoneCartAvailability(seller.id, [stock.id])).get(stock.id)?.availableQuantity,
    1
  );
  note(
    "real stock publication and validated synthetic price source support an actual two-slab hold"
  );
  note("the already-shipped cart availability reader sees only the remaining unheld slab");
  const args = {
    buyerUserId: buyerId,
    sellerBusinessId: seller.id,
    reservationId: receipt.reservationId,
  };
  assert.equal((await holds.get(args)).reservationId, receipt.reservationId);
  await holds.release(args);
  assert.equal(
    (await loadJwStoneCartAvailability(seller.id, [stock.id])).get(stock.id)?.availableQuantity,
    3
  );
  note("release restores actual canonical availability without altering physical quantity");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM bidrock_offers")).rows[0].n), 0);
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM bidrock_orders")).rows[0].n), 0);
  assert.equal(
    Number((await pool.query("SELECT count(*) AS n FROM marketplace_transactions")).rows[0].n),
    0
  );
  note("no accepted auction offers, BidRock orders or marketplace purchases are fabricated");
  const { verifyJwCartHoldRecovery } = await import("./jw-stone-cart-hold-recovery.native");
  await verifyJwCartHoldRecovery({
    pool,
    buyerId,
    ownerId,
    sellerId: seller.id,
    stockId: stock.id,
    note,
  });
  report.passed = true;
  console.log("JW_HOLD_COMPAT_SUMMARY " + JSON.stringify(report));
} finally {
  await pool.end();
}
