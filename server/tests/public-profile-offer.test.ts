import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasExposureAuthority: vi.fn(),
}));

vi.mock("../services/exposureAuthority", () => ({
  hasExposureAuthority: mocks.hasExposureAuthority,
}));

import {
  getPublicProfileServiceOffer,
  sanitizePublicProfileOfferText,
  toPublicProfileOffer,
} from "../publicProfileOffer";

const serviceRow = {
  id: "service-123",
  seller_user_id: "seller-1",
  title: "Stone consultation",
  description: "Call 423-555-0100 or visit https://private.example.com before booking.",
  offer_type: "service",
  price: "125.00",
  currency: "USD",
  service_category: "Stone planning",
  service_duration_minutes: 60,
  item_sku: null,
  item_stock_quantity: null,
  fulfillment_mode: "scheduled_service",
  shipping_cost: "0",
  is_active: true,
  metadata: {
    imageUrls: ["/uploads/services/stone.webp", "javascript:alert(1)"],
    privateContact: "private@example.com",
    fulfillmentPolicy: "Email private@example.com for details",
  },
  created_at: new Date("2026-07-01T00:00:00Z"),
  updated_at: new Date("2026-07-02T00:00:00Z"),
};

describe("public profile offer boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasExposureAuthority.mockResolvedValue(true);
  });

  it("whitelists public fields and removes contact paths and arbitrary metadata", () => {
    const offer = toPublicProfileOffer(serviceRow);

    expect(offer).toMatchObject({
      id: "service-123",
      offerType: "service",
      metadata: {
        imageUrls: ["/uploads/services/stone.webp"],
        images: ["/uploads/services/stone.webp"],
      },
    });
    expect(JSON.stringify(offer)).not.toContain("423-555-0100");
    expect(JSON.stringify(offer)).not.toContain("private.example.com");
    expect(JSON.stringify(offer)).not.toContain("private@example.com");
    expect(offer?.metadata).not.toHaveProperty("privateContact");
    expect(offer?.metadata.visibilityBoundary).toContain("does not grant contact");
  });

  it("rejects inactive, malformed, and unknown offer types", () => {
    expect(toPublicProfileOffer({ ...serviceRow, is_active: false })).toBeNull();
    expect(toPublicProfileOffer({ ...serviceRow, id: "../private" })).toBeNull();
    expect(toPublicProfileOffer({ ...serviceRow, offer_type: "lead" })).toBeNull();
  });

  it("redacts email, phone, and URL text", () => {
    const safe = sanitizePublicProfileOfferText(
      "Email test@example.com, call (423) 555-0100, or use www.example.com"
    );
    expect(safe).not.toContain("test@example.com");
    expect(safe).not.toContain("555-0100");
    expect(safe).not.toContain("www.example.com");
    expect(safe).toContain("Continue through TradeScout");
  });

  it("fails closed when the service provider lacks public exposure authority", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [serviceRow] });

    await expect(
      getPublicProfileServiceOffer({ query } as any, serviceRow.id)
    ).resolves.toMatchObject({
      id: serviceRow.id,
      sellerUserId: serviceRow.seller_user_id,
    });
    expect(mocks.hasExposureAuthority).toHaveBeenCalledWith(serviceRow.seller_user_id);

    mocks.hasExposureAuthority.mockResolvedValueOnce(false);
    await expect(getPublicProfileServiceOffer({ query } as any, serviceRow.id)).resolves.toBeNull();
  });
});
