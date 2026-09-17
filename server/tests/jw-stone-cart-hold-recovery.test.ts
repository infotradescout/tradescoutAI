import { describe, expect, it } from "vitest";
import { JW_STONE_CART_HOLD_PATH, parseJwStoneCartHoldRecovery } from "@shared/jwStoneCartHolds";
import { classifyJwStoneFeatureRequest } from "@shared/jwStoneFeaturePolicy";
import { inspectJwCartHoldSchema } from "../../scripts/lib/jw-cart-hold-schema.mjs";
const hold = {
  reservationId: "jwh_" + "a".repeat(32),
  status: "active",
  expiresAt: "2026-09-17T12:30:00.000Z",
  serverTime: "2026-09-17T12:00:00.000Z",
  totalSlabs: 1,
  lines: [
    { inventoryPublicId: "stone_" + "b".repeat(32), materialName: "Synthetic stone", quantity: 1 },
  ],
};
describe("reservation recovery contract", () => {
  it("validates the real owner-bound, price-free response", () => {
    expect(
      parseJwStoneCartHoldRecovery({ viewerId: "buyer", hold }, "buyer").hold?.totalSlabs
    ).toBe(1);
  });
  it("rejects another session's receipt", () => {
    expect(() => parseJwStoneCartHoldRecovery({ viewerId: "other", hold }, "buyer")).toThrow();
  });
  it("does not accept private price fields in a recovery response", () => {
    expect(() =>
      parseJwStoneCartHoldRecovery(
        { viewerId: "buyer", hold: { ...hold, materialSubtotalCents: 100 } },
        "buyer"
      )
    ).toThrow();
  });
  it.each(["active", "operations/11111111-1111-4111-8111-111111111111"])(
    "preserves GET %s during pause",
    (suffix) => {
      expect(
        classifyJwStoneFeatureRequest({
          path: JW_STONE_CART_HOLD_PATH + "/" + suffix,
          method: "GET",
        })
      ).toBeNull();
    }
  );
  it("preserves owner release under the actual member-pricing hold namespace", () => {
    expect(
      classifyJwStoneFeatureRequest({
        path: JW_STONE_CART_HOLD_PATH + "/" + hold.reservationId + "/release",
        method: "POST",
      })
    ).toBeNull();
  });
  it.each(["", "/" + hold.reservationId])(
    "does not exempt new reservations or priced receipts: %s",
    (suffix) => {
      expect(
        classifyJwStoneFeatureRequest({
          path: JW_STONE_CART_HOLD_PATH + suffix,
          method: suffix ? "GET" : "POST",
        })
      ).toBe("member_pricing");
    }
  );
});
describe("ordered hold schema acceptance", () => {
  const complete = {
    holds: true,
    items: true,
    guards: 2,
    indexes: 3,
    foreign_keys: 7,
    retry_identity: true,
    fulfillment: true,
  };
  it("accepts the complete inspection without writing", async () => {
    const queries: string[] = [];
    const result = await inspectJwCartHoldSchema({
      query: async (text: string) => {
        queries.push(text);
        return { rows: [complete] };
      },
    });
    expect(result.contract).toBe(true);
    expect(queries.every((text) => text.startsWith("SELECT"))).toBe(true);
  });
  it.each([{ holds: false }, { guards: 1 }, { retry_identity: false }, { foreign_keys: 6 }])(
    "rejects missing ledger protection %j",
    async (delta) => {
      const result = await inspectJwCartHoldSchema({
        query: async () => ({ rows: [{ ...complete, ...delta }] }),
      });
      expect(result.contract).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    }
  );
});
