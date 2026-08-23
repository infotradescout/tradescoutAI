import { describe, expect, it } from "vitest";
import { shouldNoIndexBusinessProfile } from "./businessProfileIndexability";

describe("business profile hydration indexability", () => {
  it.each([
    [null, null],
    ["published", null],
    ["published", true],
    ["directory", false],
    ["directory", null],
  ] as const)("keeps source=%s crawlable=%s noindex", (profileSource, directoryCrawlable) => {
    expect(shouldNoIndexBusinessProfile({ profileSource, directoryCrawlable })).toBe(true);
  });

  it("keeps robots index only for a canonically crawlable directory response", () => {
    expect(
      shouldNoIndexBusinessProfile({ profileSource: "directory", directoryCrawlable: true })
    ).toBe(false);
  });
});
