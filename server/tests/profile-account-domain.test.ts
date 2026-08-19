import { describe, expect, it } from "vitest";
import {
  buildProfileAccountReturnPath,
  profileAccountIncludesBidRock,
  resolveProfileAccountPolicy,
} from "@shared/profileAccount";

describe("profile account policy", () => {
  it("uses the same generic business-only account action on every public profile", () => {
    const jwPolicy = resolveProfileAccountPolicy({
      profileSlug: "jw-stone",
      profileName: "JW Stone",
      contentBlocks: [],
    });
    const ordinaryPolicy = resolveProfileAccountPolicy({
      profileSlug: "local-electrician",
      profileName: "Local Electrician",
      contentBlocks: [],
    });

    for (const policy of [jwPolicy, ordinaryPolicy]) {
      expect(policy.enabled).toBe(true);
      expect(policy.businessOnly).toBe(true);
      expect(policy.label).toBe("Account");
      expect(policy.heading).toBe("Create an account");
      expect(policy).not.toHaveProperty("roles");
      expect(policy).not.toHaveProperty("defaultRole");
    }
    expect(jwPolicy.description).toContain("Businesses can create an account with JW Stone");
    expect(ordinaryPolicy.description).toContain(
      "Businesses can create an account with Local Electrician"
    );
  });

  it("detects stone-profile BidRock inclusion without changing the account action", () => {
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
