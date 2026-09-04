export type DirectConnectCompletenessState =
  | "ready_to_share"
  | "needs_one_more_detail"
  | "too_vague";

export type DirectConnectRoutingReadiness =
  | "route_ready"
  | "needs_location"
  | "needs_category"
  | "needs_scope"
  | "manual_review"
  | "blocked";

export type DirectConnectVisibilityState = "private_draft" | "review_ready" | "shared_local";

export type DirectConnectContactGateState = "locked" | "review_required" | "request_shared" | "released";

export type CanonicalDirectConnectRequest = {
  requestId: string;
  intent: string;
  requestType: string;
  category: string;
  county: string | null;
  cityArea: string | null;
  urgency: string | null;
  description: string;
  answers: Record<"what" | "where" | "when" | "details", string>;
  completenessState: DirectConnectCompletenessState;
  routingReadiness: DirectConnectRoutingReadiness;
  visibilityState: DirectConnectVisibilityState;
  contactGateState: DirectConnectContactGateState;
  createdAt: string;
  sourceSurface: string;
};

export function evaluateRoutingReadiness(params: {
  category: string;
  answers: Record<"what" | "where" | "when" | "details", string>;
  description: string;
  completenessState: DirectConnectCompletenessState;
}): DirectConnectRoutingReadiness {
  if (params.completenessState === "too_vague") return "blocked";
  if (!params.category || params.category.trim().length < 2) return "needs_category";
  if (!params.answers.where || params.answers.where.trim().length < 2) return "needs_location";
  const hasScope =
    params.answers.what.trim().length >= 3 ||
    params.answers.details.trim().length >= 10 ||
    params.description.trim().length >= 10;
  if (!hasScope) return "needs_scope";
  if (params.completenessState === "needs_one_more_detail") return "manual_review";
  return "route_ready";
}

export type ContractorEligibilityReason =
  | "eligible"
  | "not_eligible"
  | "needs_verification"
  | "needs_profile_completion"
  | "outside_territory"
  | "category_mismatch";

export type ContractorEligibilityInput = {
  isActive: boolean;
  isVerified: boolean;
  profileComplete: boolean;
  contactEligible: boolean;
  categoryMatch: boolean;
  territoryMatch: boolean;
  trustOrCvsEligible: boolean;
  paymentStatus?: "paid" | "unpaid" | "none";
  adStatus?: "active" | "inactive" | "none";
  featuredPlacement?: boolean;
  subscriptionLevel?: "free" | "pro" | "enterprise" | "none";
};

export type ContractorEligibilityResult = {
  status: ContractorEligibilityReason;
  eligible: boolean;
};

export function evaluateContractorEligibility(
  input: ContractorEligibilityInput
): ContractorEligibilityResult {
  if (!input.isActive || !input.contactEligible) {
    return { status: "not_eligible", eligible: false };
  }
  if (!input.isVerified) {
    return { status: "needs_verification", eligible: false };
  }
  if (!input.profileComplete) {
    return { status: "needs_profile_completion", eligible: false };
  }
  if (!input.categoryMatch) {
    return { status: "category_mismatch", eligible: false };
  }
  if (!input.territoryMatch) {
    return { status: "outside_territory", eligible: false };
  }
  if (!input.trustOrCvsEligible) {
    return { status: "not_eligible", eligible: false };
  }
  return { status: "eligible", eligible: true };
}
