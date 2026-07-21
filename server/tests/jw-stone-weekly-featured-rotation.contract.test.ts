import { describe, expect, it } from "vitest";
import {
  getIsoWeekMondayKey,
  pickWeeklyRandomStones,
} from "../../client/src/lib/weeklyFeaturedRotation";

describe("JW Stone Featured-this-week rotation", () => {
  it("keys every day within the same Mon-Sun week identically", () => {
    // 2026-07-20 is a Monday; 2026-07-26 is the following Sunday.
    const monday = new Date("2026-07-20T00:00:00.000Z");
    const wednesday = new Date("2026-07-22T13:45:00.000Z");
    const sunday = new Date("2026-07-26T23:59:00.000Z");

    const mondayKey = getIsoWeekMondayKey(monday);
    expect(getIsoWeekMondayKey(wednesday)).toBe(mondayKey);
    expect(getIsoWeekMondayKey(sunday)).toBe(mondayKey);
    expect(mondayKey).toBe("2026-07-20");
  });

  it("keys the next Monday differently from the previous week", () => {
    const thisMonday = new Date("2026-07-20T00:00:00.000Z");
    const nextMonday = new Date("2026-07-27T00:00:00.000Z");
    expect(getIsoWeekMondayKey(nextMonday)).not.toBe(getIsoWeekMondayKey(thisMonday));
  });

  const stones = Array.from({ length: 10 }, (_, i) => ({ slug: `stone-${i}` }));

  it("returns the same picks for any two moments in the same week", () => {
    const a = pickWeeklyRandomStones(stones, 3, new Date("2026-07-20T02:00:00.000Z"));
    const b = pickWeeklyRandomStones(stones, 3, new Date("2026-07-25T22:00:00.000Z"));
    expect(a.map((s) => s.slug)).toEqual(b.map((s) => s.slug));
  });

  it("is very likely to return different picks the following week", () => {
    const week1 = pickWeeklyRandomStones(stones, 3, new Date("2026-07-20T00:00:00.000Z"));
    const week2 = pickWeeklyRandomStones(stones, 3, new Date("2026-07-27T00:00:00.000Z"));
    expect(week1.map((s) => s.slug)).not.toEqual(week2.map((s) => s.slug));
  });

  it("respects the requested count and never fabricates stones", () => {
    const picks = pickWeeklyRandomStones(stones, 3, new Date("2026-07-20T00:00:00.000Z"));
    expect(picks).toHaveLength(3);
    for (const pick of picks) {
      expect(stones.some((s) => s.slug === pick.slug)).toBe(true);
    }
    // No duplicates -- a real shuffle-and-slice, not sampling with replacement.
    expect(new Set(picks.map((s) => s.slug)).size).toBe(3);
  });

  it("degrades gracefully with fewer stones than requested", () => {
    const twoStones = stones.slice(0, 2);
    const picks = pickWeeklyRandomStones(twoStones, 3, new Date("2026-07-20T00:00:00.000Z"));
    expect(picks).toHaveLength(2);
  });

  it("returns nothing for an empty catalog", () => {
    expect(pickWeeklyRandomStones([], 3, new Date("2026-07-20T00:00:00.000Z"))).toEqual([]);
  });
});
