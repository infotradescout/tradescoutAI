import { afterEach, describe, expect, it, vi } from "vitest";
import dominantColors from "@/data/jwStoneDominantColors.generated.json";
import { getCatalogItemById } from "@/features/jw-stone/catalog";
import { resolveJwStonePublicMediaAsset } from "@shared/jwStonePublicMedia";
import { buildStoneDesignerPhotoKey } from "./stoneDesignerImages";
import { getStoneProjectionDecision } from "./stoneProjectionSafety";

describe("stone projection safety", () => {
  it("projects the exact named photo's pinned stone-face crop without inventing crop inches", () => {
    const entry = dominantColors.stones["arizona-gold"];
    const result = getStoneProjectionDecision(entry.cover);
    expect(result).toMatchObject({
      kind: "illustrative",
      allowed: true,
      sourceImageHref: entry.cover,
      sourcePhotoKey: buildStoneDesignerPhotoKey(entry.cover),
      sourceDimensions: { widthIn: 124, heightIn: 77 },
      projectionImageHref: entry.sliver,
      crop: entry.sample.box,
      dimensions: null,
    });
    expect(result.projectionImageHref).not.toBe(result.sourceImageHref);
    expect(result.reason).toContain("illustrative");
  });

  it("keeps a sibling photograph reference-only instead of substituting the stone's cover crop", () => {
    const entry = dominantColors.stones["arizona-gold"];
    const sibling = getCatalogItemById("arizona-gold")!.images.find(
      (image) => image !== entry.cover
    );
    expect(sibling).toBeTruthy();
    expect(getStoneProjectionDecision(sibling)).toMatchObject({
      kind: "reference-only",
      allowed: false,
      sourceImageHref: sibling,
      projectionImageHref: null,
      dimensions: null,
    });
  });

  it.each(["casa-blanca", "calacatta-macchia", "black-pearl"] as const)(
    "keeps the excluded %s source reference-only",
    (stoneId) => {
      const entry = dominantColors.stones[stoneId];
      expect(entry.sample).toBeNull();
      expect(getStoneProjectionDecision(entry.cover)).toMatchObject({
        kind: "reference-only",
        allowed: false,
        projectionImageHref: null,
        dimensions: null,
      });
    }
  );

  it("allows an evidenced illustrative crop even when its original photograph has no slab inches", () => {
    const entry = dominantColors.stones["honey-onyx"];
    expect(getStoneProjectionDecision(entry.cover)).toMatchObject({
      kind: "illustrative",
      projectionImageHref: entry.sliver,
      sourceDimensions: null,
      dimensions: null,
    });
  });

  it("does not treat a hand-scale photo, crop URL, or promising directory name as crop approval", () => {
    for (const image of [
      "/images/businesses/jw-stone/inventory-source/1UDe57h8Vq_IpmDKm9JvV-1jEdrc7TMKW.webp",
      dominantColors.stones["arizona-gold"].sliver,
      "/images/stone-textures/clean/inventory-source/1h5NJbfymmVL91l0TD7Q0hDZcZrfbdEJg.webp",
      "/images/projection-ready/inventory-source/1h5NJbfymmVL91l0TD7Q0hDZcZrfbdEJg.webp",
    ]) {
      expect(getStoneProjectionDecision(image)).toMatchObject({
        kind: "reference-only",
        projectionImageHref: null,
        dimensions: null,
      });
    }
  });

  it("returns no material or identity for an empty selection", () => {
    expect(getStoneProjectionDecision(null)).toMatchObject({
      kind: "reference-only",
      sourceImageHref: null,
      sourcePhotoKey: null,
      sourceDimensions: null,
      projectionImageHref: null,
      crop: null,
      dimensions: null,
    });
  });

  it("binds every available crop to its named catalog photograph and pinned derivative", () => {
    let illustrativeCount = 0;
    for (const [stoneId, entry] of Object.entries(dominantColors.stones)) {
      const result = getStoneProjectionDecision(entry.cover);
      expect(result.kind).not.toBe("physical");
      expect(result.dimensions).toBeNull();
      if (!result.allowed) continue;
      illustrativeCount += 1;
      const stone = getCatalogItemById(stoneId)!;
      expect(stone.anonymous).toBe(false);
      expect(stone.images).toContain(entry.cover);
      expect(result.projectionImageHref).toBe(entry.sliver);
      expect(resolveJwStonePublicMediaAsset(result.projectionImageHref)?.relativePath).toBe(
        `color-slivers/${stoneId}.webp`
      );
    }
    expect(illustrativeCount).toBeGreaterThan(50);
  });
});

describe("crop evidence integrity", () => {
  const source = "/images/businesses/jw-stone/inventory-source/fixture-photo.webp";
  const sliver = "/images/businesses/jw-stone/color-slivers/fixture-stone.webp";
  const crop = { left: 0.2, top: 0.3, width: 0.5, height: 0.4 };

  async function decide(options: {
    entry?: Record<string, unknown>;
    sample?: Record<string, unknown> | null;
    catalogImages?: string[];
    anonymous?: boolean;
    unpinned?: string;
    duplicate?: boolean;
  }) {
    vi.resetModules();
    const entry = {
      cover: source,
      sliver,
      sample:
        options.sample === null
          ? null
          : {
              source: "inner-slab-face-only",
              mode: "detected-slab-core",
              confidence: 1,
              box: crop,
              ...options.sample,
            },
      ...options.entry,
    };
    vi.doMock("@/data/jwStoneDominantColors.generated.json", () => ({
      default: {
        stones: {
          "fixture-stone": entry,
          ...(options.duplicate ? { "ambiguous-stone": entry } : {}),
        },
      },
    }));
    vi.doMock("@/features/jw-stone/catalog", () => ({
      getCatalogItemById: () => ({
        anonymous: options.anonymous ?? false,
        shareSlug: options.anonymous ? null : "fixture-stone",
        images: options.catalogImages ?? [source],
      }),
    }));
    vi.doMock("@shared/jwStonePublicMedia", () => ({
      resolveJwStonePublicMediaAsset: (image: string) =>
        image === options.unpinned || ![source, sliver].includes(image)
          ? null
          : { relativePath: image.slice("/images/businesses/jw-stone/".length) },
    }));
    const { getStoneProjectionDecision: decideFixture } = await import("./stoneProjectionSafety");
    return decideFixture(source);
  }

  afterEach(() => {
    vi.doUnmock("@/data/jwStoneDominantColors.generated.json");
    vi.doUnmock("@/features/jw-stone/catalog");
    vi.doUnmock("@shared/jwStonePublicMedia");
    vi.resetModules();
  });

  it("accepts a valid exact-photo sample as illustrative only", async () => {
    expect(await decide({})).toMatchObject({
      kind: "illustrative",
      projectionImageHref: sliver,
      crop,
      dimensions: null,
    });
  });

  it.each([
    { left: -0.01, top: 0, width: 0.5, height: 0.5 },
    { left: 0.6, top: 0, width: 0.5, height: 0.5 },
    { left: 0, top: 0.7, width: 0.5, height: 0.4 },
    { left: 0, top: 0, width: 0, height: 0.5 },
    { left: 0, top: 0, width: 0.5, height: Number.NaN },
    { left: "0", top: 0, width: 0.5, height: 0.5 },
  ])("rejects invalid crop coordinates %j", async (box) => {
    expect(await decide({ sample: { box } })).toMatchObject({
      kind: "reference-only",
      projectionImageHref: null,
    });
  });

  it.each([
    { source: "raw-photo" },
    { mode: "center-safe" },
    { confidence: 0.78 },
    { confidence: Number.NaN },
    { confidence: 1.1 },
  ])("rejects unreviewed sample metadata %j", async (sample) => {
    expect((await decide({ sample })).allowed).toBe(false);
  });

  it.each([
    { entry: { cover: `${source}?different-photo` } },
    { entry: { sliver: "/images/businesses/jw-stone/color-slivers/another-stone.webp" } },
    { catalogImages: ["/images/businesses/jw-stone/inventory-source/new-cover.webp"] },
    { anonymous: true },
    { unpinned: source },
    { unpinned: sliver },
    { duplicate: true },
    { sample: null },
  ])("denies a mismatched, excluded, or unpinned crop %j", async (options) => {
    expect(await decide(options)).toMatchObject({
      kind: "reference-only",
      projectionImageHref: null,
      dimensions: null,
    });
  });
});
