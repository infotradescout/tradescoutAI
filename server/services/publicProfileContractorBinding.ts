export const JW_STONE_RECOMMENDATION_COMPATIBILITY = {
  contractorId: "bb6a45da-7730-4870-85d4-5cb0b8e0f5d6",
  profileId: "8802a941-f082-45c6-b0d3-da6c484d79da",
  profileSlug: "jw-stone",
  ownerUserId: "d61a5be3-d0ba-402b-afe3-47f994787c00",
  businessId: "3cbfd44b-59c5-4d08-8106-1a58b7746966",
} as const;

type PublicProfileBindingRequest = {
  profileId: unknown;
  profileSlug: unknown;
  ownerUserId: unknown;
  businessId: unknown;
};

type PublicProfileContractorCandidate = {
  id: unknown;
  userId: unknown;
  businessId: unknown;
  slug: unknown;
  isActive: unknown;
  verifiedLicensed: unknown;
  verifiedInsured: unknown;
  isGeneralContractor: unknown;
  isResidentialContractor: unknown;
  acceptsSubcontractWork: unknown;
};

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isExactPublicProfileContractorBindingCandidate(
  candidate: PublicProfileContractorCandidate,
  request: PublicProfileBindingRequest
): boolean {
  const expected = {
    profileId: normalized(request.profileId),
    profileSlug: normalized(request.profileSlug),
    ownerUserId: normalized(request.ownerUserId),
    businessId: normalized(request.businessId),
  };
  if (
    !expected.profileId ||
    !expected.profileSlug ||
    !expected.ownerUserId ||
    !expected.businessId ||
    normalized(candidate.businessId) !== expected.businessId ||
    normalized(candidate.slug) !== expected.profileSlug
  ) {
    return false;
  }

  const candidateUserId = normalized(candidate.userId);
  if (candidateUserId) return candidateUserId === expected.ownerUserId;

  const isExactJwStoneRequest =
    expected.profileId === JW_STONE_RECOMMENDATION_COMPATIBILITY.profileId &&
    expected.profileSlug === JW_STONE_RECOMMENDATION_COMPATIBILITY.profileSlug &&
    expected.ownerUserId === JW_STONE_RECOMMENDATION_COMPATIBILITY.ownerUserId &&
    expected.businessId === JW_STONE_RECOMMENDATION_COMPATIBILITY.businessId;

  return (
    candidate.userId === null &&
    isExactJwStoneRequest &&
    normalized(candidate.id) === JW_STONE_RECOMMENDATION_COMPATIBILITY.contractorId &&
    candidate.isActive === false &&
    candidate.verifiedLicensed === false &&
    candidate.verifiedInsured === false &&
    candidate.isGeneralContractor === false &&
    candidate.isResidentialContractor === false &&
    candidate.acceptsSubcontractWork === false
  );
}
