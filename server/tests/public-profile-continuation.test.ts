import { describe, expect, it } from "vitest";
import {
  appendPublicProfileContinuation,
  parsePublicProfileContinuation,
} from "../../client/src/lib/publicProfileContinuation";

describe("public profile continuation", () => {
  it("carries business and item context into the classic TradeScout path", () => {
    const href = appendPublicProfileContinuation("/exchange?scope=local", {
      profileSlug: "honey-onyx",
      profileName: "Honey Onyx",
      itemName: "Honey Onyx",
    });

    expect(href).toContain("scope=local");
    expect(href).toContain("from=public_profile");
    expect(href).toContain("profile=honey-onyx");
    expect(href).toContain("profileName=Honey+Onyx");
    expect(href).toContain("item=Honey+Onyx");
    expect(parsePublicProfileContinuation(href)).toEqual({
      profileSlug: "honey-onyx",
      profileName: "Honey Onyx",
      itemName: "Honey Onyx",
    });
  });

  it("rejects malformed profile context", () => {
    expect(
      appendPublicProfileContinuation("/home", {
        profileSlug: "../../admin",
        profileName: "Bad profile",
      })
    ).toBe("/home");
    expect(
      parsePublicProfileContinuation(
        "/home?from=public_profile&profile=..%2F..%2Fadmin&profileName=Bad"
      )
    ).toBeNull();
  });
});
