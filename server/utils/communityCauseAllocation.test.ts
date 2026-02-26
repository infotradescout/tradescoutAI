import { describe, expect, it } from "vitest";
import { computeAllocationShares } from "./communityCauseAllocation";

describe("computeAllocationShares", () => {
  it("returns empty object for empty input", () => {
    expect(computeAllocationShares([])).toEqual({});
  });

  it("returns zero shares when weighted totals are zero", () => {
    expect(
      computeAllocationShares([
        { id: "a", weightedVoteTotal: 0 },
        { id: "b", weightedVoteTotal: 0 },
      ])
    ).toEqual({ a: 0, b: 0 });
  });

  it("normalizes rounded shares to exactly 100.00", () => {
    const shares = computeAllocationShares([
      { id: "a", weightedVoteTotal: 1 },
      { id: "b", weightedVoteTotal: 1 },
      { id: "c", weightedVoteTotal: 1 },
    ]);

    expect(shares).toEqual({ a: 33.34, b: 33.33, c: 33.33 });
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });

  it("preserves proportional order for uneven weights", () => {
    const shares = computeAllocationShares([
      { id: "a", weightedVoteTotal: 5 },
      { id: "b", weightedVoteTotal: 3 },
      { id: "c", weightedVoteTotal: 2 },
    ]);

    expect(shares.a).toBeGreaterThan(shares.b);
    expect(shares.b).toBeGreaterThan(shares.c);
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
    expect(total).toBe(100);
  });
});
