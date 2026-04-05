import { describe, expect, it } from "vitest";
import { applyProviderBehaviorOwnership } from "../scout/scoutProviderBehaviorOwner";
import {
  applyMarketplaceListingNavigationOwnership,
  buildExchangeListingDraft,
} from "../scout/scoutMarketplaceBehaviorOwner";
import { applyCommunityBehaviorOwnership } from "../scout/scoutCommunityBehaviorOwner";

type ActionLike = {
  type: string;
  primary?: boolean;
  payload?: Record<string, unknown>;
};

function countPresentRequired(prefill: Record<string, unknown>, required: string[]): number {
  return required.filter((key) => {
    const value = prefill[key];
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim().length === 0) return false;
    return true;
  }).length;
}

function assertPrimaryActionContract(input: {
  actions: ActionLike[];
  expectedTarget: string;
  requiredFields: string[];
}) {
  const primaryActions = input.actions.filter((action) => action.primary);
  expect(primaryActions).toHaveLength(1);

  const primary = primaryActions[0];
  expect(["PREFILL_INPUT", "ASK_SCOUT"]).toContain(primary.type);
  expect(primary.type).not.toBe("NAVIGATE");

  const payload = (primary.payload ?? {}) as Record<string, unknown>;
  expect(typeof payload.target).toBe("string");
  expect(payload.target).toBe(input.expectedTarget);

  if (primary.type === "PREFILL_INPUT") {
    const prefill = (payload.prefill ?? {}) as Record<string, unknown>;
    const present = countPresentRequired(prefill, input.requiredFields);
    const completeness =
      input.requiredFields.length > 0 ? present / input.requiredFields.length : 1;
    expect(completeness).toBeGreaterThanOrEqual(0.8);
  }
}

describe("scout primary action contract", () => {
  it("enforces provider primary action contract across confidence bands", () => {
    const required = ["jobType", "location", "scope", "urgency"];

    const high = applyProviderBehaviorOwnership({
      actions: [],
      intentCategory: "provider_search",
      intentSlug: "plumbing",
      message: "Need a plumber for a leaking pipe tonight",
      countyCode: "Hillsborough",
      stateCode: "FL",
      confidenceBand: "high",
    });
    assertPrimaryActionContract({
      actions: high,
      expectedTarget: "direct_connect_request",
      requiredFields: required,
    });

    const medium = applyProviderBehaviorOwnership({
      actions: [],
      intentCategory: "provider_search",
      intentSlug: "electrical",
      message: "Need help with outlets not working",
      countyCode: "Orange",
      stateCode: "FL",
      confidenceBand: "medium",
    });
    assertPrimaryActionContract({
      actions: medium,
      expectedTarget: "direct_connect_request",
      requiredFields: required,
    });

    const low = applyProviderBehaviorOwnership({
      actions: [],
      intentCategory: "provider_search",
      intentSlug: "hvac",
      message: "maybe hvac issue",
      countyCode: "Seminole",
      stateCode: "FL",
      confidenceBand: "low",
    });
    assertPrimaryActionContract({
      actions: low,
      expectedTarget: "direct_connect_request",
      requiredFields: required,
    });
  });

  it("enforces marketplace primary action contract across confidence bands", () => {
    const required = ["title", "category", "location", "price", "description"];
    const buildDraft = (
      message: string,
      userRecord?: any,
      countyCode?: string,
      stateCode?: string
    ) =>
      buildExchangeListingDraft({
        originalMessage: message,
        userRecord,
        countyCode,
        stateCode,
        extractDollarAmount: (text: string) => {
          const match = text.match(/\$\s?(\d+)/);
          return match ? Number(match[1]) : null;
        },
        formatUsd: (amount: number) => `$${amount.toLocaleString("en-US")}`,
      });

    const high = applyMarketplaceListingNavigationOwnership({
      userId: "u1",
      wantsExchangeListingDraft: true,
      canPostMarketplaceItem: true,
      confidenceBand: "high",
      message: "Sell my table for $250 in Orlando",
      userRecord: { city: "Orlando", county: "Orange", state: "FL" },
      countyCode: "Orange",
      stateCode: "FL",
      actions: [],
      buildDraft,
    });
    assertPrimaryActionContract({
      actions: high,
      expectedTarget: "exchange_listing",
      requiredFields: required,
    });

    const medium = applyMarketplaceListingNavigationOwnership({
      userId: "u1",
      wantsExchangeListingDraft: true,
      canPostMarketplaceItem: true,
      confidenceBand: "medium",
      message: "Selling tools",
      userRecord: { city: "Tampa", county: "Hillsborough", state: "FL" },
      countyCode: "Hillsborough",
      stateCode: "FL",
      actions: [],
      buildDraft,
    });
    assertPrimaryActionContract({
      actions: medium,
      expectedTarget: "exchange_listing",
      requiredFields: required,
    });

    const low = applyMarketplaceListingNavigationOwnership({
      userId: "u1",
      wantsExchangeListingDraft: true,
      canPostMarketplaceItem: true,
      confidenceBand: "low",
      message: "for sale drill",
      userRecord: { city: "Miami", county: "Miami-Dade", state: "FL" },
      countyCode: "Miami-Dade",
      stateCode: "FL",
      actions: [],
      buildDraft,
    });
    assertPrimaryActionContract({
      actions: low,
      expectedTarget: "exchange_listing",
      requiredFields: required,
    });
  });

  it("enforces community primary action contract across confidence bands", () => {
    const required = ["title", "body", "countyCode", "category", "visibility"];

    const high = applyCommunityBehaviorOwnership({
      userId: "u1",
      message: "Who is a good contractor for roof repair?",
      responseMessage: "Here is a starting point.",
      actions: [],
      canPostInCommunity: true,
      communityPostCount: 4,
      lowConfidenceForLocal: false,
      communityPrefill: "Need roof recommendations in my county.",
      countyCode: "Orange",
      confidenceBand: "high",
      wantsWelcomeDraft: false,
    }).actions;
    assertPrimaryActionContract({
      actions: high,
      expectedTarget: "community_post",
      requiredFields: required,
    });

    const medium = applyCommunityBehaviorOwnership({
      userId: "u1",
      message: "Any trusted electricians nearby in my community?",
      responseMessage: "Let us draft a post.",
      actions: [],
      canPostInCommunity: true,
      communityPostCount: 1,
      lowConfidenceForLocal: false,
      communityPrefill: "",
      countyCode: "Seminole",
      confidenceBand: "medium",
      wantsWelcomeDraft: false,
    }).actions;
    assertPrimaryActionContract({
      actions: medium,
      expectedTarget: "community_post",
      requiredFields: required,
    });

    const low = applyCommunityBehaviorOwnership({
      userId: "u1",
      message: "neighbors recommend someone for fence repair",
      responseMessage: "Need quick clarification.",
      actions: [],
      canPostInCommunity: true,
      communityPostCount: 0,
      lowConfidenceForLocal: true,
      communityPrefill: "",
      countyCode: "Volusia",
      confidenceBand: "low",
      wantsWelcomeDraft: false,
    }).actions;
    assertPrimaryActionContract({
      actions: low,
      expectedTarget: "community_post",
      requiredFields: required,
    });
  });
});
