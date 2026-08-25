import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("../db", () => ({
  db: {
    execute: (...args: unknown[]) => mocks.execute(...args),
  },
}));

import {
  hasActiveTradeCountyScope,
  hasActiveTradeScope,
  hasActiveTradeStateScope,
  listActiveCountyTradeScopes,
  listActiveTradeCountyScopes,
  listActiveTradeScopes,
  listActiveTradeStateScopes,
  resetSeoDirectoryNavigationCacheForTests,
} from "../services/seoDirectoryNavigationService";

const snapshotRows = [
  {
    trade_slug: "electrical",
    state_code: "FL",
    county_slug: "bay",
    business_count: 1,
  },
  {
    trade_slug: "electrical",
    state_code: "FL",
    county_slug: "santa-rosa",
    business_count: 2,
  },
  {
    trade_slug: "plumbing",
    state_code: "LA",
    county_slug: "tangipahoa-parish",
    business_count: 1,
  },
];

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("active SEO directory scope snapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T12:00:00.000Z"));
    mocks.execute.mockReset();
    resetSeoDirectoryNavigationCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("loads one snapshot and derives trade, state, county, and membership views from it", async () => {
    mocks.execute.mockResolvedValue({ rows: snapshotRows });

    await expect(listActiveTradeScopes()).resolves.toEqual([
      { tradeSlug: "electrical", businessCount: 3 },
      { tradeSlug: "plumbing", businessCount: 1 },
    ]);
    await expect(listActiveTradeStateScopes("electrical")).resolves.toEqual([
      { stateCode: "FL", businessCount: 3 },
    ]);
    await expect(listActiveTradeCountyScopes("electrical", "fl")).resolves.toEqual([
      { countySlug: "santa-rosa", businessCount: 2 },
      { countySlug: "bay", businessCount: 1 },
    ]);
    await expect(listActiveCountyTradeScopes("la", "tangipahoa-parish")).resolves.toEqual([
      { tradeSlug: "plumbing", businessCount: 1 },
    ]);

    await expect(hasActiveTradeScope("electrical")).resolves.toBe(true);
    await expect(hasActiveTradeScope("roofing")).resolves.toBe(false);
    await expect(hasActiveTradeStateScope("electrical", "FL")).resolves.toBe(true);
    await expect(hasActiveTradeStateScope("electrical", "AL")).resolves.toBe(false);
    await expect(hasActiveTradeCountyScope("plumbing", "LA", "tangipahoa-parish")).resolves.toBe(
      true
    );
    await expect(hasActiveTradeCountyScope("plumbing", "LA", "ouachita-parish")).resolves.toBe(
      false
    );

    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("uses the last known public scope set when a later refresh fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.execute.mockResolvedValueOnce({ rows: snapshotRows });

    await expect(hasActiveTradeCountyScope("electrical", "FL", "bay")).resolves.toBe(true);

    vi.setSystemTime(new Date("2026-08-25T12:06:00.000Z"));
    mocks.execute.mockRejectedValueOnce(new Error("temporary database pressure"));

    await expect(hasActiveTradeCountyScope("electrical", "FL", "bay")).resolves.toBe(true);
    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(warning).toHaveBeenCalledWith(
      "[SEO] Active directory snapshot refresh failed; using the last known public scope set",
      expect.any(Error)
    );
  });

  it("does not invent an active scope when the first snapshot read fails", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("snapshot unavailable"));

    await expect(hasActiveTradeCountyScope("roofing", "AL", "mobile")).rejects.toThrow(
      "snapshot unavailable"
    );
  });

  it("locks inactive trade routes to real not-found behavior instead of empty successful pages", () => {
    const renderer = read("server/publicTradeHtml.ts");
    const navigation = read("server/services/seoDirectoryNavigationService.ts");

    expect(renderer).toContain("hasActiveTradeCountyScope");
    expect(renderer).toContain(
      "if (!(await hasActiveTradeCountyScope(canonicalSlug, stateCode, countySlug))) return null;"
    );
    expect(renderer).toContain("if (activeStates.length === 0) return null;");
    expect(renderer).toContain("if (activeCounties.length === 0) return null;");
    expect(renderer).toContain("if (items.length === 0) return null;");
    expect(renderer).not.toContain("listingQueryDegraded");
    expect(renderer).not.toContain("serving fallback page without listings");
    expect(renderer).not.toContain("stateScopeQueryFailed");
    expect(renderer).not.toContain("countyScopeQueryFailed");

    expect(navigation).toContain("const SNAPSHOT_TTL_MS = 5 * 60 * 1000;");
    expect(navigation).toContain("cachedSnapshot");
    expect(navigation).toContain("refreshPromise");
  });
});
