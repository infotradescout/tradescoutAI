import { describe, expect, it } from "vitest";
import { buildPublicBusinessPresentationFields } from "../repositories/businessRepository";
import fs from "node:fs";
import path from "node:path";

describe("public business presentation fields", () => {
  it.each([undefined, null, false])(
    "keeps location private unless it is explicitly enabled (%s)",
    (publicLocationEnabled) => {
      const result = buildPublicBusinessPresentationFields(
        {
          category: "Drone videographer",
          services: ["Real estate aerials", "Construction progress", "Real estate aerials", ""],
          city: " Pensacola ",
          stateCode: " FL ",
          address: "123 Private Street",
          zipCode: "32501",
          publicLocationEnabled: publicLocationEnabled as any,
        },
        false
      );

      expect(result).toEqual({
        categories: ["Drone videographer"],
        services: ["Real estate aerials", "Construction progress"],
      });
      expect(result).not.toHaveProperty("address");
      expect(result).not.toHaveProperty("zipCode");
    }
  );

  it("allows only coarse city/state for an explicitly enabled normal business", () => {
    const result = buildPublicBusinessPresentationFields(
      {
        city: "Pensacola",
        stateCode: "FL",
        address: "123 Private Street",
        zipCode: "32501",
        publicLocationEnabled: true,
      },
      false
    );

    expect(result).toMatchObject({ city: "Pensacola", stateCode: "FL" });
    expect(result).not.toHaveProperty("address");
    expect(result).not.toHaveProperty("zipCode");
  });

  it("withholds every location field when public location is disabled", () => {
    const result = buildPublicBusinessPresentationFields(
      {
        services: ["Roof inspections"],
        publicLocationEnabled: false,
        city: "Pensacola",
        stateCode: "FL",
        address: "123 Private Street",
        zipCode: "32501",
      },
      true
    );

    expect(result.services).toEqual(["Roof inspections"]);
    expect(result).not.toHaveProperty("city");
    expect(result).not.toHaveProperty("stateCode");
    expect(result).not.toHaveProperty("address");
    expect(result).not.toHaveProperty("zipCode");
  });

  it("keeps detailed public location fields restricted to TradePartners", () => {
    const result = buildPublicBusinessPresentationFields(
      {
        city: "Pensacola",
        stateCode: "FL",
        address: "123 Public Street",
        zipCode: "32501",
        publicLocationEnabled: true,
      },
      true
    );

    expect(result).toMatchObject({
      city: "Pensacola",
      stateCode: "FL",
      address: "123 Public Street",
      zipCode: "32501",
    });
  });

  it("rejects malformed service values and bounds public labels", () => {
    const result = buildPublicBusinessPresentationFields(
      {
        category: "x".repeat(240),
        services: ["A", 42 as unknown as string, "B", "A", "y".repeat(240)],
      },
      false
    );

    expect(result.categories).toEqual(["x".repeat(180)]);
    expect(result.services).toEqual(["A", "B", "y".repeat(180)]);
  });

  it("does not publish contact details smuggled into services or coarse location", () => {
    const result = buildPublicBusinessPresentationFields(
      {
        category: "Photography — call 850-555-0199",
        services: ["Real estate photos 850-555-0199", "owner@example.com"],
        city: "Pensacola 850-555-0199",
        stateCode: "FL 850-555-0199",
      },
      false
    );

    expect(JSON.stringify(result)).not.toMatch(/850-555-0199|owner@example\.com/);
    expect(result.categories).toEqual(["Photography — call Continue through TradeScout"]);
    expect(result.services).toEqual([
      "Real estate photos Continue through TradeScout",
      "Continue through TradeScout",
    ]);
    expect(result).not.toHaveProperty("city");
    expect(result).not.toHaveProperty("stateCode");
  });

  it("requires explicit presentation opt-ins and never returns raw contact from public records", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "server/repositories/businessRepository.ts"),
      "utf8"
    );
    const method = source.slice(
      source.indexOf("async getBusinessPublicById"),
      source.indexOf("async getBusinessCountyIds")
    );
    expect(method).toContain("publicLocationEnabled === true");
    expect(method).toContain("publicWebsiteEnabled === true");
    expect(method).not.toContain("publicContactEnabled");
    expect(method).not.toContain("profileData?.email");
    expect(method).not.toContain("profileData?.phone");
  });
});
