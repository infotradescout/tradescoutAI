import { describe, expect, it } from "vitest";
import {
  buildProfileAccountReturnPath,
  isProfileAccountBusinessRole,
  isProfileAccountRole,
  profileAccountRoleIncludesBidRock,
  resolveProfileAccountPolicy,
} from "@shared/profileAccount";

describe("profile account policy", () => {
  it("treats JW Stone as a profile-owned stone relationship with a fabricator default", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "jw-stone",
      profileName: "JW Stone",
      hasBusiness: true,
      contentBlocks: [],
    });

    expect(policy.kind).toBe("stone_business");
    expect(policy.defaultRole).toBe("fabricator");
    expect(policy.roles).toContain("customer");
    expect(policy.roles).toContain("fabricator");
    expect(policy.roles).toContain("builder_contractor");
    expect(policy.roles).toContain("designer");
  });

  it("detects a stone business from a published profile inventory without requiring a hardcoded slug", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "future-stone-yard",
      profileName: "Future Stone Yard",
      hasBusiness: true,
      contentBlocks: [
        {
          type: "inventoryCatalog",
          data: {
            categories: [{ category: "Quartzite", stones: [{ name: "Example" }] }],
          },
        },
      ],
    });

    expect(policy.kind).toBe("stone_business");
    expect(policy.roles).toContain("stone_yard_dealer");
  });

  it("keeps ordinary business profiles out of BidRock account roles", () => {
    const policy = resolveProfileAccountPolicy({
      profileSlug: "local-electrician",
      profileName: "Local Electrician",
      hasBusiness: true,
      contentBlocks: [],
    });

    expect(policy.kind).toBe("business");
    expect(policy.roles).toEqual(["customer", "trade_professional"]);
    expect(profileAccountRoleIncludesBidRock("trade_professional")).toBe(false);
  });

  it("separates relationship roles, business-persona roles, and product entitlements", () => {
    expect(isProfileAccountRole("customer")).toBe(true);
    expect(isProfileAccountRole("fabricator")).toBe(true);
    expect(isProfileAccountRole("unknown")).toBe(false);
    expect(isProfileAccountBusinessRole("customer")).toBe(false);
    expect(isProfileAccountBusinessRole("fabricator")).toBe(true);
    expect(profileAccountRoleIncludesBidRock("fabricator")).toBe(true);
    expect(profileAccountRoleIncludesBidRock("customer")).toBe(false);
  });

  it("returns to the exact profile through an internal TradeScout route", () => {
    expect(buildProfileAccountReturnPath({ profileSlug: "JW Stone", role: "fabricator" })).toBe(
      "/u/jw-stone?profileAccount=1&role=fabricator"
    );
  });
});
