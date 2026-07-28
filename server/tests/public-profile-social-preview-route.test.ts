import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPublicProfileSocialPreview: vi.fn(),
}));

vi.mock("../publicProfileSocialPreview", () => ({
  buildPublicProfileSocialPreview: mocks.buildPublicProfileSocialPreview,
}));

import { registerPublicProfileSocialPreviewRoutes } from "../routes/public-profile-social-preview";
import { buildSignedSocialPreviewImageUrl } from "../signedSocialPreview";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ETAG = '"blue-mare-preview"';

function app() {
  const instance = express();
  registerPublicProfileSocialPreviewRoutes(instance);
  return instance;
}

describe("public profile social preview routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "social-preview-route-test-secret";
    mocks.buildPublicProfileSocialPreview.mockResolvedValue({
      png: PNG,
      etag: ETAG,
      fingerprint: "blue-mare",
      previewImageUrl:
        "https://www.thetradescout.com/images/social/profile/jw-stone/inventory/blue-mare.png?v=3-test",
      sourceImageUrl:
        "https://www.thetradescout.com/images/businesses/jw-stone/inventory-source/blue-mare.webp",
      context: {
        kind: "inventory",
        title: "Blue Mare",
        brandName: "JW Stone Logistics",
        ctaLabel: "View photos · Request pricing",
      },
    });
  });

  it("serves a valid signed cross-surface card with immutable caching", async () => {
    const imageUrl = buildSignedSocialPreviewImageUrl({
      pageOrigin: "https://www.thetradescout.com",
      context: {
        kind: "community_post",
        title: "Need a local roofer",
        brandName: "TradeScout Community",
        eyebrow: "Community",
        ctaLabel: "View post · Join the conversation",
      },
    });

    const response = await request(app()).get(new URL(imageUrl!).pathname);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^image\/png/);
    expect(response.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(response.body).readUInt32BE(16)).toBe(1200);
    expect(Buffer.from(response.body).readUInt32BE(20)).toBe(630);
  });

  it("rejects a tampered signed cross-surface card", async () => {
    const response = await request(app()).get(
      "/images/social/card/not-a-valid-payload.not-a-valid-signature.png"
    );

    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("serves an exact inventory/photo preview as a cacheable PNG", async () => {
    const response = await request(app())
      .get("/images/social/profile/jw-stone/inventory/blue-mare.png?photo=2&v=3-test")
      .set("Host", "jwstonelogistics.com");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^image\/png/);
    expect(response.headers["content-length"]).toBe(String(PNG.length));
    expect(response.headers.etag).toBe(ETAG);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["cache-control"]).toBe(
      "public, max-age=86400, stale-while-revalidate=604800"
    );
    expect(Buffer.from(response.body)).toEqual(PNG);
    expect(mocks.buildPublicProfileSocialPreview).toHaveBeenCalledWith({
      profileSlug: "jw-stone",
      itemType: "inventory",
      itemSlug: "blue-mare",
      photo: "2",
      pageOrigin: "https://www.thetradescout.com",
    });
  });

  it("rejects malformed inventory photo selectors before rendering", async () => {
    const response = await request(app()).get(
      "/images/social/profile/jw-stone/inventory/blue-mare.png?photo=random-cache-buster"
    );

    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(mocks.buildPublicProfileSocialPreview).not.toHaveBeenCalled();
  });

  it("keeps a source-image fallback short-lived so the next crawl can retry", async () => {
    mocks.buildPublicProfileSocialPreview.mockResolvedValueOnce({
      png: PNG,
      etag: ETAG,
      sourceImageRequested: true,
      sourceImageLoaded: false,
    });

    const response = await request(app()).get(
      "/images/social/profile/jw-stone/inventory/blue-mare.png"
    );

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300, must-revalidate");
  });

  it("returns 304 for a matching entity tag", async () => {
    const response = await request(app())
      .get("/images/social/profile/jw-stone.png")
      .set("If-None-Match", ETAG);

    expect(response.status).toBe(304);
    expect(response.headers.etag).toBe(ETAG);
    expect(response.body).toEqual({});
  });

  it("returns a non-cacheable 404 for an unknown public item", async () => {
    mocks.buildPublicProfileSocialPreview.mockResolvedValueOnce(null);

    const response = await request(app()).get(
      "/images/social/profile/jw-stone/gallery/not-public.png"
    );

    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("falls back to the static platform image when rendering fails", async () => {
    mocks.buildPublicProfileSocialPreview.mockRejectedValueOnce(new Error("render failed"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await request(app()).get(
        "/images/social/profile/jw-stone/inventory/blue-mare.png"
      );

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("/tradescout-social-preview.png?v=12");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(errorSpy).toHaveBeenCalledOnce();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
