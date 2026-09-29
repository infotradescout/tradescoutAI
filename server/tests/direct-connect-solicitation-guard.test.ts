import { describe, expect, it } from "vitest";
import { classifyDirectConnectSolicitation } from "../services/directConnectSolicitationGuard";

describe("Direct Connect solicitation guard", () => {
  it("blocks the JW Stone cleaning-sales failure case", () => {
    const result = classifyDirectConnectSolicitation({
      name: "Rachel Grant",
      email: "rachel@skylinefacilitycleaners.com",
      requestType: "other",
      message:
        "Hi, I work in Pensacola, and help many local companies. I was hoping I could come by and offer a complimentary cleaning bid? Thank you in advance for your response. All the best, Rachel Grant Business Development Rep Skyline Facility Cleaners. Respond with stop to optout.",
    });

    expect(result.action).toBe("block");
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.reasons).toContain("bulk_marketing_opt_out_language");
  });

  it("allows a normal homeowner quote request", () => {
    expect(
      classifyDirectConnectSolicitation({
        message:
          "I am remodeling my kitchen and need a quote for two slabs of Taj Mahal plus fabrication. Can someone call me this week?",
      }).action
    ).toBe("allow");
  });

  it("allows a genuine request that asks for a free estimate", () => {
    expect(
      classifyDirectConnectSolicitation({
        message:
          "My shower is leaking and I need someone to look at it. Do you offer free estimates for repair work?",
      }).action
    ).toBe("allow");
  });

  it("allows weak or ambiguous business language rather than risking a false positive", () => {
    expect(
      classifyDirectConnectSolicitation({
        message:
          "I work with a local company and need stone for our front desk remodel. Please send pricing and availability.",
      }).action
    ).toBe("allow");
  });

  it("does not block based on a signature or business email alone", () => {
    expect(
      classifyDirectConnectSolicitation({
        name: "Jordan Lee",
        email: "jordan@acmebuilders.com",
        message: "We need 4 slabs for a customer project. Please send lead time and pricing.",
      }).action
    ).toBe("allow");
  });
});
