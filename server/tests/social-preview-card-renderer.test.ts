import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  renderSocialPreviewCard,
  renderSocialPreviewCardPng,
  SOCIAL_PREVIEW_RENDER_CAPACITY_ERROR_CODE,
  SOCIAL_PREVIEW_RENDER_CONCURRENCY,
  SOCIAL_PREVIEW_RENDER_QUEUE_LIMIT,
  SOCIAL_PREVIEW_HEIGHT,
  SOCIAL_PREVIEW_WIDTH,
  SocialPreviewRenderCapacityError,
  type SocialPreviewCardContext,
} from "../socialPreviewCardRenderer";

const PUBLIC_ROOT = path.resolve(process.cwd(), "client/public");
const SMALL_PUBLIC_IMAGE = path.join(PUBLIC_ROOT, "tradescout-logo-circle.png");
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

async function readPinnedServerAsset(): Promise<Buffer> {
  return fs.readFile(SMALL_PUBLIC_IMAGE);
}

describe.sequential("social preview card renderer", () => {
  it("renders server-owned JW Stone media as a 1200x630 PNG", async () => {
    const rendered = await renderSocialPreviewCard(blueMareContext, {
      publicRoots: [PUBLIC_ROOT],
      serverPublicAssetReader: readPinnedServerAsset,
    });

    expectSocialPreviewPng(rendered.png);
    expect(rendered.sourceImageLoaded).toBe(true);
  }, 30_000);

  it("renders the JW Stone profile as a full-bleed brand hero without changing item cards", async () => {
    const rendered = await renderSocialPreviewCard(
      {
        ...blueMareContext,
        kind: "profile",
        title: "JW Stone Logistics",
        sourceImageUrl: "/images/businesses/jw-stone/video/hero-poster.jpg",
        logoUrl: "/images/businesses/jw-stone/logo-social.svg",
        layout: "brand-hero",
      },
      {
        publicRoots: [PUBLIC_ROOT],
        serverPublicAssetReader: readPinnedServerAsset,
      }
    );
    const split = await renderSocialPreviewCardPng(blueMareContext, {
      publicRoots: [PUBLIC_ROOT],
      serverPublicAssetReader: readPinnedServerAsset,
    });

    expectSocialPreviewPng(rendered.png);
    expect(rendered.sourceImageLoaded).toBe(true);
    expect(rendered.png).not.toEqual(split);
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

  it("never falls back to local files or a self-fetch for pinned server media", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Pinned media must not self-fetch"));
    const serverPublicAssetReader = vi.fn(async () => null);

    try {
      const rendered = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: `https://www.thetradescout.com${BLUE_MARE_IMAGE}`,
          logoUrl: null,
        },
        {
          publicRoots: [PUBLIC_ROOT],
          serverPublicAssetReader,
        }
      );

      expectSocialPreviewPng(rendered.png);
      expect(rendered.sourceImageLoaded).toBe(false);
      expect(serverPublicAssetReader).toHaveBeenCalledWith(
        "public-media/images/businesses/jw-stone/inventory-source/1vGOdELy1LIE5i-A8lurdUMnRdjzotBMo.webp",
        5 * 1024 * 1024
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);

  it("reads allowlisted profile media from storage on arbitrary custom domains", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("must not self-fetch"));
    const serverPublicAssetReader = vi.fn(async () => null);
    try {
      const rendered = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl:
            "https://precision-aerial.example/images/profiles/precision-aerial/hero-reel-poster.jpg",
          logoUrl: null,
        },
        { publicRoots: [PUBLIC_ROOT], serverPublicAssetReader }
      );
      expectSocialPreviewPng(rendered.png);
      expect(rendered.sourceImageLoaded).toBe(false);
      expect(serverPublicAssetReader).toHaveBeenCalledWith(
        "public-media/images/profiles/precision-aerial/hero-reel-poster.jpg",
        5 * 1024 * 1024
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);

  it("bounds process-wide render concurrency and rejects immediately when the queue is full", async () => {
    let releaseFetches: (() => void) | null = null;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetches = resolve;
    });
    let activeFetches = 0;
    let maxActiveFetches = 0;
    let completedFetchCallCount = 0;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      activeFetches += 1;
      maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
      await fetchGate;
      activeFetches -= 1;
      return new Response(null, { status: 404 });
    });
    const acceptedCount = SOCIAL_PREVIEW_RENDER_CONCURRENCY + SOCIAL_PREVIEW_RENDER_QUEUE_LIMIT;
    const acceptedRenders = Array.from({ length: acceptedCount }, (_, index) =>
      renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: `http://127.0.0.1/social-preview-concurrency-${index}.webp`,
          logoUrl: null,
        },
        { publicRoots: [PUBLIC_ROOT] }
      )
    );

    try {
      await expect(
        renderSocialPreviewCard(
          {
            ...blueMareContext,
            sourceImageUrl: "http://127.0.0.1/social-preview-overflow.webp",
            logoUrl: null,
          },
          { publicRoots: [PUBLIC_ROOT] }
        )
      ).rejects.toMatchObject({
        name: "SocialPreviewRenderCapacityError",
        code: SOCIAL_PREVIEW_RENDER_CAPACITY_ERROR_CODE,
      });

      await vi.waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(SOCIAL_PREVIEW_RENDER_CONCURRENCY);
      });
    } finally {
      releaseFetches?.();
      try {
        await Promise.all(acceptedRenders);
        completedFetchCallCount = fetchSpy.mock.calls.length;
      } finally {
        fetchSpy.mockRestore();
      }
    }

    expect(maxActiveFetches).toBe(SOCIAL_PREVIEW_RENDER_CONCURRENCY);
    expect(completedFetchCallCount).toBe(acceptedCount);
    expect(new SocialPreviewRenderCapacityError()).toBeInstanceOf(Error);
  }, 60_000);

  it("rejects source assets over 5 MiB and logos over 2 MiB before reading their bodies", async () => {
    const sourceGetReader = vi.fn(() => {
      throw new Error("oversized source body must not be read");
    });
    const logoGetReader = vi.fn(() => {
      throw new Error("oversized logo body must not be read");
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const isLogo = String(input).includes("oversized-logo");
      return {
        ok: true,
        body: {
          getReader: isLogo ? logoGetReader : sourceGetReader,
        },
        headers: new Headers({
          "content-type": "image/png",
          "content-length": String(isLogo ? 2 * 1024 * 1024 + 1 : 5 * 1024 * 1024 + 1),
        }),
      } as unknown as Response;
    });

    try {
      const rendered = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: "http://127.0.0.1/oversized-source.png",
          logoUrl: "http://127.0.0.1/oversized-logo.png",
        },
        { publicRoots: [PUBLIC_ROOT] }
      );

      expectSocialPreviewPng(rendered.png);
      expect(rendered.sourceImageRequested).toBe(true);
      expect(rendered.sourceImageLoaded).toBe(false);
      expect(sourceGetReader).not.toHaveBeenCalled();
      expect(logoGetReader).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);

  it("stops an unbounded remote source stream after 5 MiB", async () => {
    const megabyte = new Uint8Array(1024 * 1024);
    let chunkCount = 0;
    const cancel = vi.fn(async () => undefined);
    const releaseLock = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn(async () => {
            chunkCount += 1;
            return { done: false, value: megabyte };
          }),
          cancel,
          releaseLock,
        }),
      },
      headers: new Headers({ "content-type": "image/png" }),
    } as unknown as Response);

    try {
      const rendered = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: "http://127.0.0.1/unbounded-source.png",
          logoUrl: null,
        },
        { publicRoots: [PUBLIC_ROOT] }
      );

      expectSocialPreviewPng(rendered.png);
      expect(rendered.sourceImageLoaded).toBe(false);
      expect(chunkCount).toBe(6);
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(releaseLock).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  }, 30_000);

  it("rejects valid source images over 20 MP and valid logos over 4 MP", async () => {
    const sharp = (await import("sharp")).default;
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "social-preview-limits-"));
    const sourcePath = path.join(temporaryRoot, "source-over-20mp.png");
    const logoPath = path.join(temporaryRoot, "logo-over-4mp.png");

    try {
      await Promise.all([
        sharp({
          create: {
            width: 4_473,
            height: 4_473,
            channels: 3,
            background: "#81904a",
          },
        })
          .png()
          .toFile(sourcePath),
        sharp({
          create: {
            width: 2_001,
            height: 2_000,
            channels: 3,
            background: "#ffffff",
          },
        })
          .png()
          .toFile(logoPath),
      ]);

      const oversized = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: `/${path.basename(sourcePath)}`,
          logoUrl: `/${path.basename(logoPath)}`,
        },
        { publicRoots: [temporaryRoot] }
      );
      const noAssets = await renderSocialPreviewCard(
        {
          ...blueMareContext,
          sourceImageUrl: null,
          logoUrl: null,
        },
        { publicRoots: [temporaryRoot] }
      );

      expectSocialPreviewPng(oversized.png);
      expect(oversized.sourceImageRequested).toBe(true);
      expect(oversized.sourceImageLoaded).toBe(false);
      expect(oversized.png).toEqual(noAssets.png);
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 60_000);
});
