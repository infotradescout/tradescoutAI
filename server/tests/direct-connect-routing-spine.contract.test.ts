import { describe, expect, it } from "vitest";
import {
  evaluateContractorEligibility,
  evaluateRoutingReadiness,
} from "@shared/directConnectRoutingSpine";

describe("direct connect routing spine contracts", () => {
  it("separates routing readiness from completeness", () => {
    const readiness = evaluateRoutingReadiness({
      category: "service_request",
      answers: {
        what: "AC leaking water",
        where: "Hammond, LA",
        when: "today",
        details: "",
      },
      description: "Need help with AC leak today",
      completenessState: "ready_to_share",
    });
    expect(readiness).toBe("route_ready");
  });

  it("blocks routing when request is too vague", () => {
    const readiness = evaluateRoutingReadiness({
      category: "service_request",
      answers: {
        what: "",
        where: "",
        when: "",
        details: "",
      },
      description: "",
      completenessState: "too_vague",
    });
    expect(readiness).toBe("blocked");
  });

  it("evaluates contractor eligibility without ranking", () => {
    const result = evaluateContractorEligibility({
      isActive: true,
      isVerified: true,
      profileComplete: true,
      contactEligible: true,
      categoryMatch: true,
      territoryMatch: true,
      trustOrCvsEligible: true,
    });
    expect(result).toEqual({ status: "eligible", eligible: true });
  });

  it("routing eligibility does not consider payment, ads, featured placement, or subscriptions", () => {
    const base = evaluateContractorEligibility({
      isActive: true,
      isVerified: true,
      profileComplete: true,
      contactEligible: true,
      categoryMatch: true,
      territoryMatch: true,
      trustOrCvsEligible: true,
      paymentStatus: "unpaid",
      adStatus: "active",
      featuredPlacement: true,
      subscriptionLevel: "enterprise",
    });
    const changedMonetizationOnly = evaluateContractorEligibility({
      isActive: true,
      isVerified: true,
      profileComplete: true,
      contactEligible: true,
      categoryMatch: true,
      territoryMatch: true,
      trustOrCvsEligible: true,
      paymentStatus: "paid",
      adStatus: "inactive",
      featuredPlacement: false,
      subscriptionLevel: "free",
    });
    expect(base).toEqual(changedMonetizationOnly);
  });
});
