import { describe, expect, it } from "vitest";

import {
  isExactPublicProfileContractorBindingCandidate,
  JW_STONE_RECOMMENDATION_COMPATIBILITY,
} from "../services/publicProfileContractorBinding";

const request = {
  profileId: JW_STONE_RECOMMENDATION_COMPATIBILITY.profileId,
  profileSlug: JW_STONE_RECOMMENDATION_COMPATIBILITY.profileSlug,
  ownerUserId: JW_STONE_RECOMMENDATION_COMPATIBILITY.ownerUserId,
  businessId: JW_STONE_RECOMMENDATION_COMPATIBILITY.businessId,
};

const inactiveJwStoneAdapter = {
  id: JW_STONE_RECOMMENDATION_COMPATIBILITY.contractorId,
  userId: null,
  businessId: JW_STONE_RECOMMENDATION_COMPATIBILITY.businessId,
  slug: JW_STONE_RECOMMENDATION_COMPATIBILITY.profileSlug,
  isActive: false,
  verifiedLicensed: false,
  verifiedInsured: false,
  isGeneralContractor: false,
  isResidentialContractor: false,
  acceptsSubcontractWork: false,
};

describe("public-profile contractor binding", () => {
  it("accepts the one exact inactive and unverified JW Stone compatibility adapter", () => {
    expect(isExactPublicProfileContractorBindingCandidate(inactiveJwStoneAdapter, request)).toBe(
      true
    );
  });

  it("continues to accept an ordinary contractor owned by the exact profile owner", () => {
    expect(
      isExactPublicProfileContractorBindingCandidate(
        {
          ...inactiveJwStoneAdapter,
          id: "f0543759-86e7-45eb-bdea-272433549e9d",
          userId: request.ownerUserId,
          isActive: true,
          verifiedLicensed: true,
          verifiedInsured: true,
          isGeneralContractor: true,
          isResidentialContractor: true,
          acceptsSubcontractWork: true,
        },
        request
      )
    ).toBe(true);
  });

  it.each([
    ["isActive", true],
    ["verifiedLicensed", true],
    ["verifiedInsured", true],
    ["isGeneralContractor", true],
    ["isResidentialContractor", true],
    ["acceptsSubcontractWork", true],
  ] as const)("rejects a null-user adapter when %s is true", (field, value) => {
    expect(
      isExactPublicProfileContractorBindingCandidate(
        { ...inactiveJwStoneAdapter, [field]: value },
        request
      )
    ).toBe(false);
  });

  it("rejects a null-user row that does not use the deterministic adapter id", () => {
    expect(
      isExactPublicProfileContractorBindingCandidate(
        { ...inactiveJwStoneAdapter, id: "f0543759-86e7-45eb-bdea-272433549e9d" },
        request
      )
    ).toBe(false);
  });

  it("rejects a contractor assigned to a different user", () => {
    expect(
      isExactPublicProfileContractorBindingCandidate(
        { ...inactiveJwStoneAdapter, userId: "f0543759-86e7-45eb-bdea-272433549e9d" },
        request
      )
    ).toBe(false);
  });

  it.each([
    ["profileId", "f0543759-86e7-45eb-bdea-272433549e9d"],
    ["profileSlug", "not-jw-stone"],
    ["ownerUserId", "f0543759-86e7-45eb-bdea-272433549e9d"],
    ["businessId", "f0543759-86e7-45eb-bdea-272433549e9d"],
  ] as const)("rejects the adapter for a different %s", (field, value) => {
    const mismatchedRequest = { ...request, [field]: value };
    const candidate = {
      ...inactiveJwStoneAdapter,
      ...(field === "profileSlug" ? { slug: value } : {}),
      ...(field === "businessId" ? { businessId: value } : {}),
    };

    expect(isExactPublicProfileContractorBindingCandidate(candidate, mismatchedRequest)).toBe(
      false
    );
  });

  it("requires an explicit null user for the compatibility path", () => {
    expect(
      isExactPublicProfileContractorBindingCandidate(
        { ...inactiveJwStoneAdapter, userId: undefined },
        request
      )
    ).toBe(false);
  });
});
