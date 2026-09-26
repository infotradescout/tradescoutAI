import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { JwStoneCartHolds } from "../server/services/jwStoneCartHolds";
import type { JwStonePricingSnapshot } from "../server/services/jwStoneDrivePricing";
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.JW_WORKFLOW_FIXTURE, "true");
const url = new URL(process.env.TEST_DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/ts_jw_workflow_test");
const pool = new pg.Pool({ connectionString: url.href });
const scope = {
  buyerUserId: process.env.JW_STATUS_BUYER || "",
  sellerBusinessId: process.env.JW_STATUS_SELLER || "",
};
assert(scope.buyerUserId && scope.sellerBusinessId);
try {
  assert.equal(
    (await pool.query("SELECT current_database() name")).rows[0].name,
    "ts_jw_workflow_test"
  );
  const holds = new JwStoneCartHolds(pool);
  if (process.argv.includes("--create")) {
    const snapshot = {
      sourceUpdatedAt: new Date().toISOString(),
      prices: [
        {
          stoneName: "Honey Onyx",
          stoneKey: "honey onyx",
          slabPriceCents: 10101,
          bundlePriceCents: 9090,
          bundleMinSlabs: 7,
          landedCostCents: 4040,
        },
      ],
    } as JwStonePricingSnapshot;
    await holds.reserve({
      ...scope,
      snapshot,
      request: {
        idempotencyKey: randomUUID(),
        lines: [{ inventoryPublicId: process.env.JW_STATUS_STOCK, quantity: 1 }],
        expectedSubtotalCents: 505050,
        fulfillment: { method: "pickup" },
      },
    });
  } else if (process.argv.includes("--release")) {
    const owned = await holds.recover(scope);
    assert(owned);
    await holds.release({ ...scope, reservationId: owned.reservationId });
  } else throw new Error("Choose an explicit synthetic fixture action.");
  console.log("JW_OWNED_HOLD_FIXTURE " + JSON.stringify(await holds.recover(scope)));
} finally {
  await pool.end();
}
