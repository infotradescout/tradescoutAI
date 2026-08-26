// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { buildJwStoneBrowseEvent } from "./browseAnalytics";

describe("JW Stone browse analytics", () => {
  it("records conversion position without exposing pricing or raw search text", () => {
    const event = buildJwStoneBrowseEvent({
      action: "request",
      stone: { id: "blue-bahia", shareSlug: "blue-bahia" },
      surface: "full_inventory",
      resultPosition: 2.9,
      mode: "search",
      activeFilterCount: 3.8,
    });

    expect(event).toMatchObject({
      type: "jw_stone_browse_action",
      profileSlug: "jw-stone",
      action: "request",
      surface: "full_inventory",
      stoneId: "blue-bahia",
      stoneSlug: "blue-bahia",
      resultPosition: 2,
      mode: "search",
      activeFilterCount: 3,
    });
    expect(Object.keys(event).some((key) => /price|cost|margin|query/i.test(key))).toBe(false);
  });
});
