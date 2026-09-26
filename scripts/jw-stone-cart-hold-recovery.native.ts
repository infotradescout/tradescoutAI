import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { JwStoneCartHolds } from "../server/services/jwStoneCartHolds";
import { createJwStoneFeatureStore } from "../server/services/jwStoneFeatureStore";
import { startJwStoneCartHoldExpiry } from "../server/services/jwStoneCartHoldWorker";
import { getJwStonePricingSnapshot } from "../server/services/jwStoneDrivePricing";
import {
  getStoneInventoryProfileTarget,
  upsertCurrentStoneInventory,
  setStoneInventorySaleReady,
} from "../server/services/stoneInventoryService";
import { reviewJwStoneMemberCart } from "../server/routes/jw-stone-member-pricing";
export async function verifyJwCartHoldRecovery(args: {
  pool: Pool;
  buyerId: string;
  ownerId: string;
  sellerId: string;
  stockId: string;
  note: (message: string) => void;
}) {
  const { pool, buyerId, ownerId, sellerId, stockId, note } = args;
  assert.equal(process.env.JW_HOLD_COMPAT_FIXTURE, "true");
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    "ts_jw_hold_compat_test"
  );
  const holds = new JwStoneCartHolds(pool),
    flags = createJwStoneFeatureStore(pool);
  const scope = { buyerUserId: buyerId, sellerBusinessId: sellerId };
  const source = process.env.JW_STONE_PRICING_APPROVED_IMPORT!;
  const operationId = randomUUID();
  const request = {
    idempotencyKey: operationId,
    lines: [{ inventoryPublicId: stockId, quantity: 1 }],
    expectedSubtotalCents: 15000,
    fulfillment: { method: "pickup" as const },
  };
  const snapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
  const receipt = await holds.reserve({ ...scope, snapshot, request });
  const recovered = await holds.recover(scope);
  assert.equal(recovered?.reservationId, receipt.reservationId);
  assert.equal(recovered?.totalSlabs, 1);
  assert.equal(recovered?.expiresAt, receipt.expiresAt);
  assert(
    !/Cents|currency|membership|buyer_user|fingerprint|landed/i.test(JSON.stringify(recovered))
  );
  assert.equal(
    (await holds.recover({ ...scope, operationId }))?.reservationId,
    receipt.reservationId
  );
  assert.equal(await holds.recover({ ...scope, buyerUserId: ownerId, operationId }), null);
  note(
    "active and lost-response recovery retain the owned receipt/deadline without exposing prices or another buyer's record"
  );
  const offCommand = {
    enabled: false,
    expectedRevision: (await flags.read()).revision,
    operationId: randomUUID(),
    preserveBaseServices: true,
    note: "Isolated hold cleanup test only",
  };
  await flags.change(ownerId, offCommand);
  await assert.rejects(
    holds.reserve({ ...scope, snapshot, request: { ...request, idempotencyKey: randomUUID() } }),
    (error: any) => error.code === "JW_STONE_FEATURE_UNAVAILABLE"
  );
  await pool.query(
    "UPDATE profile_account_entitlements SET status='revoked' WHERE profile_account_id IN (SELECT id FROM profile_accounts WHERE owner_user_id=$1) AND product_key='jw_stone_member_pricing'",
    [buyerId]
  );
  assert.equal((await holds.recover(scope))?.reservationId, receipt.reservationId);
  await assert.rejects(
    holds.get({ ...scope, reservationId: receipt.reservationId }),
    (error: any) => error.code === "jw_membership_required"
  );
  assert.equal(
    (await holds.release({ ...scope, reservationId: receipt.reservationId })).status,
    "released"
  );
  assert.equal((await holds.recover({ ...scope, operationId }))?.status, "released");
  assert.equal(await holds.recover(scope), null);
  note(
    "OFF blocks new holds while revoked owners still recover and release existing stock without member prices"
  );
  const expiredOperationId = randomUUID();
  const connection = await pool.connect();
  let seededId = "";
  try {
    await connection.query("BEGIN");
    const seeded = await connection.query(
      `INSERT INTO jw_stone_cart_holds
      (buyer_user_id,buyer_business_profile_id,seller_business_id,membership_id,idempotency_key,request_fingerprint,subtotal_cents,fulfillment,created_at,expires_at)
      SELECT buyer_user_id,buyer_business_profile_id,seller_business_id,membership_id,$2::uuid,repeat('0',64),subtotal_cents,fulfillment,
        statement_timestamp()-interval '31 minutes',statement_timestamp()-interval '1 minute' FROM jw_stone_cart_holds WHERE public_id=$1 RETURNING id,public_id`,
      [receipt.reservationId, expiredOperationId]
    );
    seededId = seeded.rows[0].public_id;
    await connection.query(
      `INSERT INTO jw_stone_cart_hold_items SELECT $2::uuid,inventory_position_id,inventory_public_id,material_name,quantity,unit_rate_cents,one_slab_total_cents,line_total_cents,pricing_tier
      FROM jw_stone_cart_hold_items WHERE hold_id=(SELECT id FROM jw_stone_cart_holds WHERE public_id=$1)`,
      [receipt.reservationId, seeded.rows[0].id]
    );
    await connection.query(
      "UPDATE stone_inventory_positions SET held_quantity=held_quantity+1 WHERE id=(SELECT inventory_position_id FROM jw_stone_cart_hold_items WHERE hold_id=$1::uuid)",
      [seeded.rows[0].id]
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  const stopA = startJwStoneCartHoldExpiry(holds, 25),
    stopB = startJwStoneCartHoldExpiry(holds, 25);
  try {
    for (let attempts = 0; attempts < 100; attempts++) {
      const state = (
        await pool.query("SELECT status FROM jw_stone_cart_holds WHERE public_id=$1", [seededId])
      ).rows[0];
      if (state.status === "expired") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(
      (await pool.query("SELECT status FROM jw_stone_cart_holds WHERE public_id=$1", [seededId]))
        .rows[0].status,
      "expired"
    );
    assert.equal(
      Number(
        (
          await pool.query(
            "SELECT held_quantity FROM stone_inventory_positions WHERE id=(SELECT inventory_position_id FROM jw_stone_cart_hold_items WHERE hold_id=(SELECT id FROM jw_stone_cart_holds WHERE public_id=$1))",
            [seededId]
          )
        ).rows[0].held_quantity
      ),
      0
    );
  } finally {
    stopA();
    stopB();
  }
  assert.equal(
    (await holds.recover({ ...scope, operationId: expiredOperationId }))?.status,
    "expired"
  );
  note(
    "two real idle workers expire the same due hold once while OFF and revoked, with no user traffic or negative stock"
  );
  await flags.change(ownerId, {
    ...offCommand,
    enabled: true,
    expectedRevision: (await flags.read()).revision,
    operationId: randomUUID(),
  });
  await pool.query(
    "UPDATE profile_account_entitlements SET status='pending_verification' WHERE profile_account_id IN (SELECT id FROM profile_accounts WHERE owner_user_id=$1) AND product_key='jw_stone_member_pricing'",
    [buyerId]
  );
  const target = await getStoneInventoryProfileTarget("jw-stone");
  assert(target);
  const now = new Date().toISOString();
  const other = await upsertCurrentStoneInventory(target, {
    materialSlug: "hold-second-stone",
    materialName: "Hold Second Stone",
    materialClass: "natural_stone",
    materialFamily: "Granite",
    assetKind: "slab",
    quantity: 4,
    unit: "slabs",
    dimensions: { length: 120, height: 60, unit: "in" },
    finishQuantities: [],
    imageUrls: [],
    lastConfirmedAt: now,
    confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await setStoneInventorySaleReady({
    target,
    publicId: other.id,
    saleReady: true,
    actorUserId: ownerId,
  });
  const approved = JSON.parse(source);
  approved.prices.push({
    stoneName: "Hold Second Stone",
    stoneKey: "hold second stone",
    slabPriceCents: 500,
    bundlePriceCents: 400,
    bundleMinSlabs: 7,
    landedCostCents: 100,
  });
  process.env.JW_STONE_PRICING_APPROVED_IMPORT = JSON.stringify(approved);
  const selection = {
    lines: [
      { inventoryPublicId: stockId, quantity: 3 },
      { inventoryPublicId: other.id, quantity: 4 },
    ],
    fulfillment: { method: "pickup" as const },
  };
  const reviewed = await reviewJwStoneMemberCart(buyerId, selection);
  assert.equal(reviewed.subtotalCents, 110000);
  assert.equal(reviewed.bundle.unlocked, true);
  assert.equal(reviewed.bundle.completeBundles, 1);
  const currentSnapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
  const forgedOperation = randomUUID();
  await assert.rejects(
    holds.reserve({
      ...scope,
      snapshot: currentSnapshot,
      request: { ...selection, idempotencyKey: forgedOperation, expectedSubtotalCents: 100000 },
    }),
    (error: any) => error.code === "price_changed"
  );
  assert.equal(
    Number((await pool.query("SELECT count(*) AS n FROM jw_stone_cart_holds WHERE idempotency_key=$1::uuid", [forgedOperation])).rows[0].n),
    0
  );
  const heldTotal = async () => Number(
    (await pool.query("SELECT COALESCE(sum(held_quantity),0) AS n FROM stone_inventory_positions WHERE holder_business_id=$1", [sellerId])).rows[0].n
  );
  assert.equal(await heldTotal(), 0);
  note("forged mixed-material bundle total is rejected without a hold or stock allocation");
  const mixedRequest = {
    ...selection,
    idempotencyKey: randomUUID(),
    expectedSubtotalCents: reviewed.subtotalCents,
  };
  const mixed = await holds.reserve({ ...scope, snapshot: currentSnapshot, request: mixedRequest });
  assert.equal(mixed.materialSubtotalCents, reviewed.subtotalCents);
  assert.equal(mixed.lines.length, 2);
  assert.equal(mixed.lines.find((line) => line.inventoryPublicId === stockId)?.pricingTier, "bundle");
  assert.equal(mixed.lines.find((line) => line.inventoryPublicId === stockId)?.unitRateCents, 200);
  assert.equal(mixed.lines.find((line) => line.inventoryPublicId === other.id)?.pricingTier, "bundle");
  assert.equal(mixed.lines.find((line) => line.inventoryPublicId === other.id)?.unitRateCents, 400);
  assert.equal(await heldTotal(), 7);
  const replay = await holds.reserve({ ...scope, snapshot: currentSnapshot, request: mixedRequest });
  assert.equal(replay.reservationId, mixed.reservationId);
  assert.equal(replay.expiresAt, mixed.expiresAt);
  assert.equal(await heldTotal(), 7);
  await assert.rejects(
    holds.reserve({ ...scope, snapshot: currentSnapshot, request: { ...mixedRequest, idempotencyKey: randomUUID() } }),
    (error: any) => error.code === "active_hold_exists"
  );
  const mixedRecovery = await holds.recover({ ...scope, operationId: mixedRequest.idempotencyKey });
  assert.equal(mixedRecovery?.reservationId, mixed.reservationId);
  assert.equal(mixedRecovery?.expiresAt, mixed.expiresAt);
  assert.equal(mixedRecovery?.totalSlabs, 7);
  await holds.release({ ...scope, reservationId: mixed.reservationId });
  await holds.release({ ...scope, reservationId: mixed.reservationId });
  assert.equal(await heldTotal(), 0);
  assert.equal((await holds.recover({ ...scope, operationId: mixedRequest.idempotencyKey }))?.status, "released");
  assert.equal(Number((await pool.query("SELECT count(*) AS n FROM marketplace_transactions")).rows[0].n), 0);
  process.env.JW_STONE_PRICING_APPROVED_IMPORT = source;
  note("seven mixed-material slabs use each source bundle rate and preserve one hold through replay, recovery, duplicate-block and release without payment");
  assert.equal((await flags.read()).enabled, true);
}
