import { describe, expect, it } from "vitest";
import { hardrockApplySchema } from "../routes/hardrock";

describe("hardrockApplySchema", () => {
  it("splits specialties and trims/uniques values", () => {
    const parsed = hardrockApplySchema.parse({
      companyName: "ACME Electric",
      contactName: "Sam",
      email: "sam@example.com",
      phone: "5555555555",
      primaryState: "FL",
      primaryCounty: "Escambia",
      yearsInBusiness: "3",
      licenseNumber: "LIC-123",
      insuranceProvider: "InsureCo",
      primaryTrade: "Electrical",
      specialties: "TI,  tenant improvements,TI ,",
      about: "I have lots of commercial experience working on hotels.",
      preferredContact: "both",
      agreeToTerms: "on",
      agreeToVerification: "true",
      companyFax: "",
    });

    expect(parsed.specialties).toEqual(["TI", "tenant improvements"]);
  });

  it("requires agreeToTerms and agreeToVerification", () => {
    expect(() =>
      hardrockApplySchema.parse({
        companyName: "ACME",
        contactName: "Sam",
        email: "sam@example.com",
        phone: "5555555555",
        primaryState: "FL",
        primaryCounty: "Escambia",
        yearsInBusiness: 0,
        licenseNumber: "LIC",
        insuranceProvider: "Insure",
        primaryTrade: "Electrical",
        specialties: "a",
        about: "This is long enough to pass the about field check.",
        preferredContact: "email",
        agreeToTerms: false,
        agreeToVerification: false,
      })
    ).toThrow();
  });
});
