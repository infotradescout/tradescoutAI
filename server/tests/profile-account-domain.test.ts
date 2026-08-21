import { describe, expect, it } from "vitest";
import {
  buildProfileAccountReturnPath,
  profileAccountIncludesBidRock,
  resolveProfileAccountPolicy,
} from "@shared/profileAccount";

describe("profile account policy", () => {
  it("keeps the same generic CTA while stone profiles remain business-only", () => {
    const jwPolicy = resolveProfileAccountPolicy({
      profileSlug: "jw-stone",
      profileName: "JW Stone",
      contentBlocks: [],
    });
    const issaPolicy = resolveProfileAccountPolicy({
      profileSlug: "issa-build",
      profileName: "ISSA Build",
      contentBlocks: [],
    });

    for (const policy of [jwPolicy, issaPolicy]) {
      expect(policy.enabled).toBe(true);
      expect(policy.requiredIdentity).toBe("business");
      expect(policy.includesBidRock).toBe(true);
      expect(policy.priorityKey).toBe("stone_business_access");
      expect(policy.label).toBe("Account");
      expect(policy.heading).toBe("Create an account");
      expect(policy.description).toContain("Any business can create an account directly with");
      expect(policy.description).not.toContain("TradeScout identity");
      expect(policy).not.toHaveProperty("roles");
      expect(policy).not.toHaveProperty("defaultRole");
    }
  });

  it("leaves ordinary public profiles on their own account priority", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "local-electrician",
      profileName: "Local Electrician",
      contentBlocks: [],
    });

    expect(policy.requiredIdentity).toBe("user");
    expect(policy.includesBidRock).toBe(false);
    expect(policy.priorityKey).toBe("profile_account");
    expect(policy.description).toBe("Create an account directly with Local Electrician.");
  });

  it("lets a non-stone profile set its own identity requirement and priority", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "wholesale-supply",
      profileName: "Wholesale Supply",
      contentBlocks: [],
      profilePriorityConfig: {
        requiredIdentity: "business",
        priorityKey: "dealer_access",
        description: "Approved businesses can continue through this supplier account.",
      },
    });

    expect(policy.requiredIdentity).toBe("business");
    expect(policy.includesBidRock).toBe(false);
    expect(policy.priorityKey).toBe("dealer_access");
    expect(policy.description).toBe(
      "Approved businesses can continue through this supplier account."
    );
  });

  it("does not let profile configuration downgrade an existing stone account", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "jw-stone",
      profileName: "JW Stone",
      contentBlocks: [],
      profilePriorityConfig: {
        requiredIdentity: "user",
        priorityKey: "customer_account",
      },
    });

    expect(policy.requiredIdentity).toBe("business");
    expect(policy.includesBidRock).toBe(true);
    expect(policy.priorityKey).toBe("stone_business_access");
  });

  it("detects future stone-profile BidRock inclusion without role selection", () => {
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

  it("returns to the canonical public profile without an account-role parameter", () => {
    expect(buildProfileAccountReturnPath("JW Stone")).toBe(
      "/u/jw-stone?profileAccount=1"
    );
    expect(buildProfileAccountReturnPath("Local Electrician")).toBe(
      "/u/local-electrician?profileAccount=1"
    );
  });
});
