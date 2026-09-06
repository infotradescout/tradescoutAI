import { afterEach, describe, expect, it, vi } from "vitest";
import {
  JW_STONE_PRICING_DRIVE_FILE_ID,
  JW_STONE_PRICING_DRIVE_FOLDER_ID,
} from "@shared/jwStoneMemberPricing";
import {
  getJwStonePricingSnapshot,
  resetJwStoneDrivePricingCacheForTests,
} from "../services/jwStoneDrivePricing";
import {
  getJwStonePricingSourceMode,
  readApprovedJwStonePricingImport,
} from "../services/jwStonePricingImport";

function source() {
  return {
    schemaVersion: 1,
    fileId: JW_STONE_PRICING_DRIVE_FILE_ID,
    folderId: JW_STONE_PRICING_DRIVE_FOLDER_ID,
    sourceUpdatedAt: "2026-09-05T02:50:50.000Z",
    sourceRetrievedAt: "2026-09-06T03:00:00.000Z",
    prices: [
      {
        stoneName: "Test Stone",
        stoneKey: "test stone",
        landedCostCents: 100,
        slabPriceCents: 300,
        bundlePriceCents: 200,
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetJwStoneDrivePricingCacheForTests();
});

describe("private JW Stone workbook import", () => {
  it("uses the explicitly selected import without attempting a Drive access change", async () => {
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "approved_import");
    vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", JSON.stringify(source()));
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const snapshot = await getJwStonePricingSnapshot({ forceRefresh: true });
    expect(snapshot.prices[0].slabPriceCents).toBe(300);
    expect(snapshot.sourceUpdatedAt).toBe(source().sourceUpdatedAt);
    expect(fetch).not.toHaveBeenCalled();
    expect(Object.isFrozen(snapshot.prices[0])).toBe(true);
  });

  it("keeps Drive as the default and rejects unknown source modes", () => {
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "");
    expect(getJwStonePricingSourceMode()).toBe("drive");
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "public");
    expect(() => getJwStonePricingSourceMode()).toThrow(/invalid/);
  });

  it.each([
    (value: any) => {
      value.fileId = "another-file";
    },
    (value: any) => {
      value.folderId = "another-folder";
    },
    (value: any) => {
      value.prices[0].slabPriceCents = -1;
    },
    (value: any) => {
      value.prices[0].bundlePriceCents = 1.5;
    },
    (value: any) => {
      value.prices[0].stoneKey = "unrelated stone";
    },
    (value: any) => {
      value.prices.push({ ...value.prices[0] });
    },
    (value: any) => {
      value.sourceRetrievedAt = "2026-09-04T00:00:00.000Z";
    },
  ])("rejects an invalid source, price, date, or ambiguous stone", (mutate) => {
    const value = source();
    mutate(value);
    expect(() => readApprovedJwStonePricingImport(JSON.stringify(value))).toThrow();
  });

  it("fails closed on missing or malformed imports", async () => {
    vi.stubEnv("JW_STONE_PRICING_SOURCE", "approved_import");
    vi.stubEnv("JW_STONE_PRICING_APPROVED_IMPORT", "");
    await expect(getJwStonePricingSnapshot({ forceRefresh: true })).rejects.toThrow(/missing/);
    expect(() => readApprovedJwStonePricingImport("bad-json")).toThrow(/invalid/);
  });
});
