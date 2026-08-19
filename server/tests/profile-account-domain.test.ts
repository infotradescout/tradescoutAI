import { describe, expect, it } from "vitest";
import {
  buildProfileAccountReturnPath,
  profileAccountIncludesBidRock,
  resolveProfileAccountPolicy,
} from "@shared/profileAccount";

describe("profile account policy", () => {
  it("uses one generic business-only account action on JW Stone", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "jw-stone",
      profileName: "JW Stone",
      contentBlocks: [],
    });

    expect(policy.businessOnly).toBe(true);
    expect(policy.includesBidRock).toBe(true);
    expect(policy.heading).toBe("Create an account with JW Stone");
    expect(policy.description).toContain("Businesses can create an account");
    expect(policy).not.toHaveProperty("roles");
    expect(policy).not.toHaveProperty("defaultRole");
  });

  it("detects stone-profile BidRock inclusion without role selection", () => {
    expect(
      profileAccountIncludesBidRock({
        profileSlug: "future-stone-yard",
        contentBlocks: [
          {
            type: "inventoryCatalog",
            data: {
              categories: [{ category: "Quartzite", stones: [{ name: "Example" }] }],
            },
          },
        ],
      })
    ).toBe(true);
  });

  it("does not grant BidRock from an ordinary profile", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "local-electrician",
      profileName: "Local Electrician",
      contentBlocks: [],
    });

    expect(policy.businessOnly).toBe(true);
    expect(policy.includesBidRock).toBe(false);
  });

  it("returns to the exact profile without an account-role parameter", () => {
    expect(buildProfileAccountReturnPath("JW Stone")).toBe(
      "/u/jw-stone?profileAccount=1"
    );
  });
});
