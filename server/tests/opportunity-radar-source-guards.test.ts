import { describe, expect, it } from "vitest";
import { validateRadarEntityMetadata } from "../services/opportunityRadarSourceGuards";

describe("Opportunity Radar entity source guards", () => {
  it("allows ordinary county entity metadata that is not marked public for Radar", () => {
    expect(validateRadarEntityMetadata({ note: "admin-only assignment context" })).toEqual({
      ok: true,
      errors: [],
    });
  });

  it("requires source, freshness, CVS, and sensitivity proof before public Radar eligibility", () => {
    const result = validateRadarEntityMetadata({
      publicMoveEligible: true,
      sourceKind: "business_profile",
      sourceLabel: "Business profile",
      sourceRef: "business:123",
      sourceUpdatedAt: "2026-05-18T16:00:00.000Z",
      cvsExposureCheckedAt: "2026-05-18T16:01:00.000Z",
      cvsExposureOutcome: "eligible",
      sensitiveFieldsStripped: true,
    });

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("rejects public Radar metadata missing required proof", () => {
    const result = validateRadarEntityMetadata({
      publicMoveEligible: true,
      sourceKind: "business_profile",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("metadata.sourceLabel is required");
    expect(result.errors).toContain("metadata.sourceRef is required");
    expect(result.errors).toContain("metadata.sourceUpdatedAt must be an ISO timestamp");
    expect(result.errors).toContain("metadata.cvsExposureCheckedAt must be an ISO timestamp");
    expect(result.errors).toContain("metadata.cvsExposureOutcome must be eligible or limited");
    expect(result.errors).toContain("metadata.sensitiveFieldsStripped must be true");
  });

  it("rejects contact fields in public Radar metadata", () => {
    const result = validateRadarEntityMetadata({
      publicMoveEligible: true,
      sourceKind: "business_profile",
      sourceLabel: "Business profile",
      sourceRef: "business:123",
      sourceUpdatedAt: "2026-05-18T16:00:00.000Z",
      cvsExposureCheckedAt: "2026-05-18T16:01:00.000Z",
      cvsExposureOutcome: "eligible",
      sensitiveFieldsStripped: true,
      ownerEmail: "owner@example.test",
      nested: { contactPhone: "555-0100" },
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("ownerEmail");
    expect(result.errors.join(" ")).toContain("nested.contactPhone");
  });
});
