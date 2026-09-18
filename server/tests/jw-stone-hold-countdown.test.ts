import { describe, expect, it } from "vitest";
import { jwStoneHoldRemainingSeconds, type JwStoneCartHoldStatus } from "@shared/jwStoneCartHolds";

const hold: JwStoneCartHoldStatus = {
  reservationId: "jwh_" + "a".repeat(32),
  status: "active",
  expiresAt: "2026-09-17T12:30:00.000Z",
  serverTime: "2026-09-17T12:00:00.000Z",
  totalSlabs: 1,
  lines: [
    { inventoryPublicId: "stone_" + "b".repeat(32), materialName: "Synthetic stone", quantity: 1 },
  ],
};
describe("server-confirmed reservation countdown", () => {
  it("uses the server duration and elapsed request time, not the device date", () => {
    expect(jwStoneHoldRemainingSeconds(hold, 100, 2100)).toBe(1798);
  });
  it("deducts a slow request instead of restarting the full hold duration", () => {
    expect(jwStoneHoldRemainingSeconds(hold, 500, 60500)).toBe(1740);
  });
  it("retains only the original deadline after a later server refresh", () => {
    expect(
      jwStoneHoldRemainingSeconds({ ...hold, serverTime: "2026-09-17T12:29:00.000Z" }, 800, 1800)
    ).toBe(59);
  });
  it("never shows a negative timer after the deadline", () => {
    expect(jwStoneHoldRemainingSeconds(hold, 0, 1801000)).toBe(0);
  });
  it.each(["released", "expired"] as const)("does not count down a %s receipt", (status) => {
    expect(jwStoneHoldRemainingSeconds({ ...hold, status }, 0, 0)).toBeNull();
  });
  it("withholds an estimate for invalid timing", () => {
    expect(jwStoneHoldRemainingSeconds(hold, 100, 0)).toBeNull();
    expect(jwStoneHoldRemainingSeconds(hold, 0, NaN)).toBeNull();
    expect(jwStoneHoldRemainingSeconds({ ...hold, serverTime: "invalid" }, 0, 0)).toBeNull();
  });
});
