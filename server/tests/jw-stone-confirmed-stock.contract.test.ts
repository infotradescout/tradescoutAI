import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  JW_STONE_CONFIRMED_STOCK_LOTS,
  isStoneInventoryConfirmationFresh,
} from "@shared/stoneInventory";
import { buildJwStoneConfirmedStockProjection } from "../services/jwStoneConfirmedStock";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8").replace(/\r\n/g, "\n");

describe("JW Stone confirmed-stock recovery", () => {
  it("contains exactly the seven owner-confirmed physical lots", () => {
    expect(
      JW_STONE_CONFIRMED_STOCK_LOTS.map((lot) => [
        lot.materialName,
        lot.lengthIn,
        lot.heightIn,
        lot.slabCount,
      ])
    ).toEqual([
      ["Blue Dunes", 133, 78.5, 8],
      ["Bianco Carrara", 122, 70.5, 6],
      ["Cristallo", 130, 77.5, 22],
      ["Gold Macaubas", 135, 78.5, 6],
      ["Rhino White", 111, 69.25, 7],
      ["Taj Mahal", 126, 79, 27],
      ["Titanium", 115, 76, 6],
    ]);
    expect(JW_STONE_CONFIRMED_STOCK_LOTS.reduce((sum, lot) => sum + lot.slabCount, 0)).toBe(82);
    expect(
      JW_STONE_CONFIRMED_STOCK_LOTS.find((lot) => lot.materialSlug === "gold-macaubas")
        ?.finishQuantities
    ).toEqual([{ finish: "Polished", slabCount: 2 }]);
  });

  it("builds stable unique passport identities without declaring a lot sale-ready", () => {
    const first = buildJwStoneConfirmedStockProjection();
    const second = buildJwStoneConfirmedStockProjection();
    expect(second).toEqual(first);
    expect(new Set(first.map((entry) => entry.passportCode)).size).toBe(7);
    expect(new Set(first.map((entry) => entry.sourceAssetRef)).size).toBe(7);
    expect(first.every((entry) => entry.condition.evidenceType === "seller_confirmed_physical_stock"))
      .toBe(true);

    const service = read("server/services/jwStoneConfirmedStock.ts");
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("STONE_CURRENT_INVENTORY_PRIVATE_STATUS");
    expect(service).toContain("Existing inventory positions are deliberately left untouched");
    expect(service).not.toContain("'published_current'");
  });

  it("keeps confirmation freshness explicit", () => {
    expect(
      isStoneInventoryConfirmationFresh({
        lastConfirmedAt: "2026-08-20T12:00:00.000Z",
        confirmationExpiresAt: "2026-10-04T12:00:00.000Z",
        now: new Date("2026-08-21T12:00:00.000Z"),
      })
    ).toBe(true);
  });
});
