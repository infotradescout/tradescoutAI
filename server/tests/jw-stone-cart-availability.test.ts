import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../db", () => ({ pool: bridge, db: {} }));
import { loadJwStoneCartAvailability, unheldJwStoneSlabCount } from "../services/jwStoneCartAvailability";

const publicId = `stone_${"a".repeat(32)}`;
const validRow = () => ({
  public_id: publicId, position_id: "private-position", quantity: "3.000", held_quantity: "2.000", unit: "slabs",
  condition_json: { lastConfirmedAt: new Date(Date.now() - 60000).toISOString(), confirmationExpiresAt: new Date(Date.now() + 86400000).toISOString() },
});

describe("JW Stone unheld slab availability", () => {
  beforeEach(() => { bridge.query.mockReset(); bridge.query.mockResolvedValue({ rows: [validRow()] }); });
  it.each([[3, 2, 1], [3, 0, 3], [3, 3, 0], [0, 0, 0], ["3.000", "2.000", 1], [" 3 ", "0", 3]])(
    "subtracts integral physical %s minus held %s", (quantity, held, expected) => {
      expect(unheldJwStoneSlabCount(quantity, held)).toBe(expected);
    }
  );
  it.each([undefined, null, "", " ", false, true, [], {}, "NaN", NaN, "Infinity", Infinity, -1, "-1", 0.5, "0.5", "0x0", "1e0", Number.MAX_SAFE_INTEGER + 1])(
    "does not turn an unproven held count into zero: %j", (held) => {
      expect(unheldJwStoneSlabCount(3, held)).toBeNull();
    }
  );
  it("rejects an overallocated position without silently clamping the counter", () => {
    expect(unheldJwStoneSlabCount(3, 4)).toBeNull();
    expect(unheldJwStoneSlabCount(null, 0)).toBeNull();
    expect(unheldJwStoneSlabCount(1.5, 0)).toBeNull();
  });
  it("reads only the requested seller's distinct public stock IDs", async () => {
    const result = await loadJwStoneCartAvailability("jw-business", [publicId, publicId]);
    expect(result.get(publicId)).toEqual({ inventoryPositionId: "private-position", physicalQuantity: 3, availableQuantity: 1, unit: "slabs" });
    expect(bridge.query).toHaveBeenCalledOnce();
    expect(bridge.query.mock.calls[0][1]).toEqual(["jw-business", [publicId], "available", "published_current", "verified"]);
    expect(bridge.query.mock.calls[0][0]).toMatch(/^SELECT\s/);
  });
  it("performs no query for an empty cart", async () => {
    expect((await loadJwStoneCartAvailability("jw-business", [])).size).toBe(0);
    expect(bridge.query).not.toHaveBeenCalled();
  });
  it("rejects an empty seller, private IDs, and overlarge lookups before querying", async () => {
    await expect(loadJwStoneCartAvailability("", [publicId])).rejects.toThrow();
    await expect(loadJwStoneCartAvailability("jw-business", ["private-position"])).rejects.toThrow();
    await expect(loadJwStoneCartAvailability("jw-business", Array.from({ length: 51 }, (_, index) => `stone_${index.toString(16).padStart(32, "0")}`))).rejects.toThrow();
    expect(bridge.query).not.toHaveBeenCalled();
  });
  it("fails closed for duplicate positions and ignores unsolicited identities", async () => {
    bridge.query.mockResolvedValue({ rows: [validRow(), { ...validRow(), position_id: "another-position" }, { ...validRow(), public_id: `stone_${"b".repeat(32)}` }] });
    const result = await loadJwStoneCartAvailability("jw-business", [publicId]);
    expect(result.get(publicId)).toBeNull(); expect(result.size).toBe(1);
  });
  it("propagates database errors instead of fabricating availability", async () => {
    bridge.query.mockRejectedValue(new Error("Database unavailable"));
    await expect(loadJwStoneCartAvailability("jw-business", [publicId])).rejects.toThrow("Database unavailable");
  });
});
