import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSignedSocialPreview,
  buildSignedSocialPreviewImageUrl,
  clearSignedSocialPreviewCacheForTests,
  resolveSignedSocialPreviewToken,
} from "../signedSocialPreview";

function tokenFromUrl(url: string): string {
  return new URL(url).pathname.replace(/^\/images\/social\/card\//, "").replace(/\.png$/, "");
}

describe("signed social previews", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "signed-social-preview-test-secret";
    clearSignedSocialPreviewCacheForTests();
  });

  it("round-trips a sanitized public context and rejects tampering", () => {
    const url = buildSignedSocialPreviewImageUrl({
      pageOrigin: "https://custom-business.example",
      context: {
        kind: "listing",
        title: "Table saw",
        brandName: "TradeScout Exchange",
        eyebrow: "Tools",
        supportingText: "A public local listing.",
        ctaLabel: "View listing · Connect safely",
        sourceImageUrl: "/uploads/public/table-saw.webp",
        accentColor: "#f97316",
      },
      versionSeed: "updated-at-1",
    });

    expect(url).toMatch(
      /^https:\/\/www\.thetradescout\.com\/images\/social\/card\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.png$/
    );
    const token = tokenFromUrl(url!);
    const encodedPayload = token.slice(0, token.lastIndexOf("."));
    const decodedPayload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    expect(decodedPayload).not.toContain("updated-at-1");
    expect(decodedPayload).not.toContain("Table saw");
    expect(decodedPayload).not.toContain("/uploads/public/table-saw.webp");
    expect(token.length).toBeLessThan(2_000);
    expect(resolveSignedSocialPreviewToken(token)?.context).toMatchObject({
      kind: "listing",
      title: "Table saw",
      brandName: "TradeScout Exchange",
      sourceImageUrl: "/uploads/public/table-saw.webp",
    });

    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(resolveSignedSocialPreviewToken(tampered)).toBeNull();
  });

  it("expires signed context cards on a bounded schedule", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:00:00Z"));
    try {
      const url = buildSignedSocialPreviewImageUrl({
        pageOrigin: "https://www.thetradescout.com",
        context: {
          kind: "community_post",
          title: "Public neighborhood update",
          brandName: "TradeScout Community",
          ctaLabel: "View post · Join the conversation",
        },
      });
      const token = tokenFromUrl(url!);

      expect(resolveSignedSocialPreviewToken(token)).not.toBeNull();
      vi.advanceTimersByTime(11 * 60 * 1_000);
      expect(resolveSignedSocialPreviewToken(token)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an opaque card URL stable inside its metadata cache bucket", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T12:01:00Z"));
    try {
      const args = {
        pageOrigin: "https://www.thetradescout.com",
        context: {
          kind: "listing" as const,
          title: "Public table saw listing",
          brandName: "TradeScout Exchange",
          ctaLabel: "View listing · Connect safely",
        },
        versionSeed: "listing-revision-7",
      };
      const first = buildSignedSocialPreviewImageUrl(args);
      vi.advanceTimersByTime(2 * 60 * 1_000);
      const second = buildSignedSocialPreviewImageUrl(args);

      expect(second).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders a valid signed fallback card without a source image", async () => {
    const url = buildSignedSocialPreviewImageUrl({
      pageOrigin: "http://localhost:5000",
      context: {
        kind: "directory",
        title: "Roofers in Escambia County",
        brandName: "TradeScout Local",
        eyebrow: "Local intelligence",
        ctaLabel: "Explore local results",
      },
    });
    const preview = await buildSignedSocialPreview(tokenFromUrl(url!));

    expect(preview?.png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(preview?.png.readUInt32BE(16)).toBe(1200);
    expect(preview?.png.readUInt32BE(20)).toBe(630);
    expect(preview?.etag).toMatch(/^"[a-f0-9]{64}"$/);
  });

  it("does not retain a transient source-image fallback in the process cache", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("temporary source failure"));
    const url = buildSignedSocialPreviewImageUrl({
      pageOrigin: "https://www.thetradescout.com",
      context: {
        kind: "listing",
        title: "Table saw",
        brandName: "TradeScout Exchange",
        eyebrow: "Tools",
        ctaLabel: "View listing · Connect safely",
        sourceImageUrl: "https://assets.thetradescout.com/uploads/public/table-saw.webp",
      },
    });

    try {
      const token = tokenFromUrl(url!);
      const first = await buildSignedSocialPreview(token);
      const second = await buildSignedSocialPreview(token);

      expect(first?.sourceImageRequested).toBe(true);
      expect(first?.sourceImageLoaded).toBe(false);
      expect(second?.sourceImageLoaded).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
