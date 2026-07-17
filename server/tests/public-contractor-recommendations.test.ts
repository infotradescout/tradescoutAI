import { describe, expect, it } from "vitest";
import type { Recommendation } from "@shared/schema";
import { toPublicContractorRecommendations } from "../publicContractorRecommendations";

function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: "recommendation-1",
    contractorId: "contractor-1",
    userId: "private-user-1",
    recommendationType: "positive",
    comment: "Careful, clean work.",
    projectType: "Masonry",
    projectValue: "4200.00",
    workQuality: "excellent",
    timeliness: "on_time",
    communication: "excellent",
    wouldHireAgain: true,
    photoUrl: "/uploads/recommendations/patio.webp",
    customerName: "Local homeowner",
    customerEmail: "private@example.com",
    customerPhone: "555-0100",
    ipAddress: "127.0.0.1",
    userAgent: "private-agent",
    isVerified: true,
    verificationMethod: "email",
    verifiedAt: new Date("2026-06-01T00:00:00Z"),
    isPublic: true,
    moderationStatus: "approved",
    moderatedAt: new Date("2026-06-02T00:00:00Z"),
    moderatedBy: "private-admin-id",
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-02T00:00:00Z"),
    ...overrides,
  };
}

describe("public contractor recommendations", () => {
  it("publishes only approved recommendations explicitly marked public", () => {
    const result = toPublicContractorRecommendations([
      recommendation(),
      recommendation({ id: "pending", moderationStatus: "pending" }),
      recommendation({ id: "private", isPublic: false }),
      recommendation({ id: "rejected", moderationStatus: "rejected" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "recommendation-1",
      comment: "Careful, clean work.",
      customerName: "Local homeowner",
      isVerified: true,
    });
  });

  it("removes contact, identity, financial, request, and moderation internals", () => {
    const [result] = toPublicContractorRecommendations([recommendation()]);
    const keys = Object.keys(result);

    expect(keys).not.toEqual(
      expect.arrayContaining([
        "userId",
        "customerEmail",
        "customerPhone",
        "projectValue",
        "ipAddress",
        "userAgent",
        "verificationMethod",
        "isPublic",
        "moderationStatus",
        "moderatedAt",
        "moderatedBy",
      ])
    );
  });
});
