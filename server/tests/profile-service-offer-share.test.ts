import { describe, expect, it } from "vitest";
import {
  buildProfileServiceOfferDecisionScope,
  buildProfileServiceOfferPath,
  createProfileServiceOfferShareMetadata,
  normalizeProfileOfferId,
} from "@shared/profileOfferShare";

describe("profile service offer sharing", () => {
  it("creates a durable path with the service's exact first image", () => {
    const metadata = createProfileServiceOfferShareMetadata({
      origin: "https://www.thetradescout.com",
      offer: {
        id: "service-123",
        title: "Natural stone consultation",
        description: "Review stone options and measurements before the project starts.",
        metadata: {
          imageUrls: [
            "/uploads/services/stone-consultation.webp",
            "https://images.example.com/second.jpg",
          ],
        },
      },
    });

    expect(metadata).toMatchObject({
      offerId: "service-123",
      title: "Natural stone consultation",
      canonical: "https://www.thetradescout.com/services/service-123",
      imageUrl: "https://www.thetradescout.com/uploads/services/stone-consultation.webp",
    });
    expect(metadata?.description).toContain("protected request flow");
    expect(metadata?.description.length).toBeLessThanOrEqual(160);
    expect(buildProfileServiceOfferPath("service-123")).toBe("/services/service-123");
    expect(buildProfileServiceOfferDecisionScope("service-123")).toBe(
      "profile_service_offer:service-123"
    );
  });

  it("rejects malformed service identifiers", () => {
    expect(normalizeProfileOfferId("service_abc-123")).toBe("service_abc-123");
    expect(normalizeProfileOfferId("../private")).toBeNull();
    expect(buildProfileServiceOfferPath("offer/123")).toBeNull();
    expect(buildProfileServiceOfferDecisionScope("offer/123")).toBeNull();
    expect(
      createProfileServiceOfferShareMetadata({
        origin: "https://www.thetradescout.com",
        offer: { id: "../private", title: "Private" },
      })
    ).toBeNull();
  });
});
