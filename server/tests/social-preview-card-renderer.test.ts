import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  renderSocialPreviewCard,
  renderSocialPreviewCardPng,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
  type SocialPreviewCardContext,
} from "../socialPreviewCardRenderer";

const PUBLIC_ROOT = path.resolve(process.cwd(), "client/public");
const BLUE_MARE_IMAGE =
  "/images/businesses/jw-stone/inventory-source/1vGOdELy1LIE5i-A8lurdUMnRdjzotBMo.webp";
const JW_STONE_LOGO = "/images/businesses/jw-stone/logo.svg";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const blueMareContext: SocialPreviewCardContext = {
  kind: "inventory",
  title: "Blue Mare",
  brandName: "JW Stone Logistics",
  eyebrow: "Quartzite",
  supportingText: "Natural stone",
  locationLabel: "Pensacola, Florida",
  ctaLabel: "View Slab & Request Pricing",
  sourceImageUrl: BLUE_MARE_IMAGE,
  logoUrl: JW_STONE_LOGO,
  accentColor: "#81904a",
};

function expectSocialPreviewPng(png: Buffer): void {
  expect(Buffer.isBuffer(png)).toBe(true);
  expect(png.subarray(0, PNG_SIGNATURE.length)).toEqual(PNG_SIGNATURE);
  expect(png.readUInt32BE(16)).toBe(SOCIAL_PREVIEW_WIDTH);
  expect(png.readUInt32BE(20)).toBe(SOCIAL_PREVIEW_HEIGHT);
  expect(png.length).toBeGreaterThan(10_000);
}

describe.sequential("social preview card renderer", () => {
  it("renders the real Blue Mare WebP and JW Stone logo as a 1200x630 PNG", async () => {
    const png = await renderSocialPreviewCardPng(blueMareContext, {
      publicRoots: [PUBLIC_ROOT],
    });

    expectSocialPreviewPng(png);
  }, 30_000);

  it("rasterizes hostile public text safely instead of treating it as SVG markup", async () => {
    const hostileContext: SocialPreviewCardContext = {
      ...blueMareContext,
      title: 'Blue </text><script>alert("preview")</script> & "Mare"\u0000 ' + "X".repeat(300),
      brandName: "JW <Stone> & 'Logistics'",
      eyebrow: '"><image href="https://attacker.invalid/tracker.png">',
      supportingText: "<![CDATA[not markup]]> & still public text",
      locationLabel: "Pensacola < Florida >\u0007",
      ctaLabel: "View & Request <Pricing>",
      accentColor: "url(javascript:alert(1))",
    };

    const png = await renderSocialPreviewCardPng(hostileContext, {
      publicRoots: [PUBLIC_ROOT],
    });

    expectSocialPreviewPng(png);
  }, 30_000);

  it("uses the branded fallback for missing remote-style assets without fetching the network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network access is forbidden in this test"));

    try {
      const rendered = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: "https://assets.example.invalid/missing/blue-mare.webp",
          logoUrl: "https://assets.example.invalid/missing/jw-stone-logo.svg",
        },
        {
          publicRoots: [PUBLIC_ROOT],
        }
      );

      expectSocialPreviewPng(rendered.png);
      expect(rendered.sourceImageRequested).toBe(true);
      expect(rendered.sourceImageLoaded).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);
});
