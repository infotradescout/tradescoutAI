import { describe, it, expect } from "vitest";
import { isUserVerifiedFor } from "../utils/explainAndOfferVerification";

const requirementsMap = {
  MESSAGE_USER: ["address"],
  REQUEST_CONTRACTOR_QUOTE: ["address"],
  APPLY_AS_CONTRACTOR: ["license", "insurance", "identity"],
  ACCEPT_CONTRACTOR_PAYMENT: ["identity", "tax_id", "bank_account"],
};

describe("Verification Bypass Logic", () => {
  it("should gate regular users for all requirements", () => {
    const user = { role: "homeowner", verificationStatus: "pending" };
    expect(isUserVerifiedFor(user, "MESSAGE_USER", requirementsMap)).toBe(false);
    expect(isUserVerifiedFor(user, "APPLY_AS_CONTRACTOR", requirementsMap)).toBe(false);
  });

  it("should bypass all gates for admin", () => {
    const user = { role: "super_admin", verificationStatus: "pending" };
    expect(isUserVerifiedFor(user, "MESSAGE_USER", requirementsMap)).toBe(true);
    expect(isUserVerifiedFor(user, "APPLY_AS_CONTRACTOR", requirementsMap)).toBe(true);
  });

  it("should bypass all gates for staff", () => {
    const user = { role: "support_agent", verificationStatus: "pending" };
    expect(isUserVerifiedFor(user, "MESSAGE_USER", requirementsMap)).toBe(true);
    expect(isUserVerifiedFor(user, "APPLY_AS_CONTRACTOR", requirementsMap)).toBe(true);
  });

  it("should bypass all gates for admin-verified user", () => {
    const user = {
      verificationStatus: "approved",
      addressVerified: true,
      licenseVerified: true,
      insuranceVerified: true,
      identityVerified: true,
      taxIdVerified: true,
      bankAccountVerified: true,
    };
    expect(isUserVerifiedFor(user, "MESSAGE_USER", requirementsMap)).toBe(true);
    expect(isUserVerifiedFor(user, "APPLY_AS_CONTRACTOR", requirementsMap)).toBe(true);
    expect(isUserVerifiedFor(user, "ACCEPT_CONTRACTOR_PAYMENT", requirementsMap)).toBe(true);
  });
});
