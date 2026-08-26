import { describe, expect, it } from "vitest";
import { parseCommunityComposerQuery } from "./communityComposerQuery";

describe("parseCommunityComposerQuery", () => {
  it("opens the event composer from the public event CTA query", () => {
    expect(parseCommunityComposerQuery("?compose=1&category=event")).toEqual({
      shouldOpen: true,
      prefill: null,
      category: "event",
    });
  });

  it("does not open without an explicit compose signal", () => {
    expect(parseCommunityComposerQuery("?category=event").shouldOpen).toBe(false);
  });

  it("ignores unsupported categories while preserving a safe prefill", () => {
    expect(
      parseCommunityComposerQuery("?compose=1&category=unknown&prefill=Neighborhood%20cleanup")
    ).toEqual({
      shouldOpen: true,
      prefill: "Neighborhood cleanup",
      category: null,
    });
  });
});
