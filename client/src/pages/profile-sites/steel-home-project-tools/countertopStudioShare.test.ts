import { describe, expect, it } from "vitest";
import { getCatalogItemById, JW_STONE_CATALOG } from "@/features/jw-stone/catalog";
import { createEmptySteelHomeProjectDraft } from "./projectModel";
import {
  COUNTERTOP_STUDIO_SHARE_PARAM,
  buildCountertopStudioSnapshot,
  buildCountertopStudioShareUrl,
  parseCountertopStudioShareUrl,
  parseCountertopStoneSelectionUrl,
} from "./countertopStudioShare";
import { buildStoneDesignerPhotoKey } from "./stoneDesignerImages";
import { getStoneProjectionDecision } from "./stoneProjectionSafety";

describe("catalog stone navigation", () => {
  const stone = getCatalogItemById("arizona-gold")!;
  const selectionUrl = (slug: string, image: string) =>
    `https://example.com/u/steel-home-packages/builders/countertops?stone=${slug}&photo=${buildStoneDesignerPhotoKey(image)}`;

  it("returns only exact stone and photo selection, including an unprepared reference photo", () => {
    const index = stone.images.findIndex((image) => !getStoneProjectionDecision(image).allowed);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(
      parseCountertopStoneSelectionUrl(selectionUrl(stone.shareSlug!, stone.images[index]!))
    ).toEqual({
      stoneId: stone.id,
      textureImageIndex: index,
      texturePhotoKey: buildStoneDesignerPhotoKey(stone.images[index]!),
    });
  });

  it("rejects unknown, anonymous, malformed, missing, duplicate, and foreign photo selections", () => {
    const anonymous = JW_STONE_CATALOG.find((entry) => entry.anonymous)!;
    const valid = selectionUrl(stone.shareSlug!, stone.images[0]!);
    for (const url of [
      selectionUrl("unknown-stone", stone.images[0]!),
      selectionUrl(anonymous.shareSlug || anonymous.id, anonymous.images[0]!),
      selectionUrl(stone.shareSlug!, getCatalogItemById("taj-mahal")!.images[0]!),
      valid.replace(/photo=.*/, "photo=ph_invalid"),
      valid.replace(/&photo=.*/, ""),
      `${valid}&stone=${stone.shareSlug}`,
      `${valid}&photo=${buildStoneDesignerPhotoKey(stone.images[0]!)}`,
      "not a URL",
    ])
      expect(parseCountertopStoneSelectionUrl(url)).toBeNull();
  });

  it("leaves every shared snapshot to the explicit Open shared plan flow", () => {
    const valid = selectionUrl(stone.shareSlug!, stone.images[0]!);
    expect(parseCountertopStoneSelectionUrl(`${valid}&studio=`)).toBeNull();
    const full = new URL(
      buildCountertopStudioShareUrl(
        {
          ...createEmptySteelHomeProjectDraft().countertops,
          stoneId: "taj-mahal",
        },
        valid
      )!
    );
    full.searchParams.set("stone", stone.shareSlug!);
    full.searchParams.set("photo", buildStoneDesignerPhotoKey(stone.images[0]!)!);
    expect(parseCountertopStoneSelectionUrl(full.href)).toBeNull();
    expect(parseCountertopStudioShareUrl(full.href)?.stoneId).toBe("taj-mahal");
  });
});

function decodeShareSnapshot(url: string): Record<string, unknown> {
  const encoded = new URL(url).searchParams.get(COUNTERTOP_STUDIO_SHARE_PARAM)!;
  const padded = encoded
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as Record<string, unknown>;
}

function replaceShareSnapshot(urlValue: string, snapshot: Record<string, unknown>): string {
  const url = new URL(urlValue);
  const encoded = btoa(JSON.stringify(snapshot))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  url.searchParams.set(COUNTERTOP_STUDIO_SHARE_PARAM, encoded);
  return url.toString();
}

describe("countertop spatial studio sharing", () => {
  it("round-trips the bounded visual configuration without private project fields", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      room: "Living room" as const,
      layout: "u-shape" as const,
      island: true,
      stoneId: "taj-mahal",
      textureImageIndex: 2,
      textureOffsetX: 0.35,
      textureOffsetY: -0.2,
      textureScale: 1.7,
      veinRotation: 90 as const,
      cameraPreset: "Detail" as const,
      floorStone: true,
      showSeams: true,
      waterfall: "Both" as const,
      sink: "Single-bowl undermount" as const,
      sinkRun: "island" as const,
      sinkPositionIn: 42,
      sinkFrontPositionIn: 21,
      notes: "private gate code 1234",
      measurementsReviewed: true,
      roomWidthIn: 240,
      roomDepthIn: 192,
      roomWallHeightIn: 108,
      finishedTopHeightIn: 36,
      topThicknessIn: 1.25,
      islandLeftOffsetIn: 48,
      islandBackOffsetIn: 84,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
      cooktopTemplateWidthIn: 28.5,
      cooktopTemplateDepthIn: 19.75,
    };

    const shareUrl = buildCountertopStudioShareUrl(
      design,
      "https://example.com/u/steel-home-packages/builders/countertops?location=private#section"
    );
    expect(shareUrl).toBeTruthy();
    expect(shareUrl).not.toContain("location");
    expect(shareUrl).not.toContain("private");
    expect(shareUrl).not.toContain("1234");
    expect(new URL(shareUrl!).searchParams.has(COUNTERTOP_STUDIO_SHARE_PARAM)).toBe(true);
    const snapshot = decodeShareSnapshot(shareUrl!);
    const selectedStone = getCatalogItemById("taj-mahal");
    expect(snapshot).toMatchObject({
      v: 2,
      s: "taj-mahal",
      pk: buildStoneDesignerPhotoKey(selectedStone!.images[2]!),
    });
    expect(snapshot).not.toHaveProperty("im");

    const restored = parseCountertopStudioShareUrl(shareUrl!);
    expect(restored).toMatchObject({
      room: "Living room",
      layout: "u-shape",
      stoneId: "taj-mahal",
      textureImageIndex: 2,
      textureOffsetX: 0.35,
      textureOffsetY: -0.2,
      textureScale: 1.7,
      veinRotation: 90,
      cameraPreset: "Detail",
      floorStone: true,
      showSeams: true,
      waterfall: "Both",
      sink: "Single-bowl undermount",
      sinkRun: "island",
      sinkPositionIn: 42,
      sinkFrontPositionIn: 21,
      notes: "",
      measurementsReviewed: true,
      roomWidthIn: 240,
      roomDepthIn: 192,
      roomWallHeightIn: 108,
      finishedTopHeightIn: 36,
      topThicknessIn: 1.25,
      islandLeftOffsetIn: 48,
      islandBackOffsetIn: 84,
      sinkTemplateWidthIn: 30,
      sinkTemplateDepthIn: 18,
      cooktopTemplateWidthIn: 28.5,
      cooktopTemplateDepthIn: 19.75,
    });
  });

  it("fails closed for malformed, anonymous, or unknown snapshots", () => {
    expect(parseCountertopStudioShareUrl("https://example.com/?studio=not-json")).toBeNull();
    expect(parseCountertopStudioShareUrl("https://example.com/?studio=")).toBeNull();
    expect(parseCountertopStudioShareUrl("https://example.com/")).toBeNull();

    const anonymousDesign = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "trending-selection-01",
    };
    expect(buildCountertopStudioSnapshot(anonymousDesign)).toBeNull();
    expect(buildCountertopStudioShareUrl(anonymousDesign, "https://example.com/studio")).toBeNull();

    const namedUrl = buildCountertopStudioShareUrl(
      {
        ...createEmptySteelHomeProjectDraft().countertops,
        stoneId: "taj-mahal",
      },
      "https://example.com/studio"
    );
    const snapshot = decodeShareSnapshot(namedUrl!);
    snapshot.s = "invented-stone";
    expect(parseCountertopStudioShareUrl(replaceShareSnapshot(namedUrl!, snapshot))).toBeNull();

    const invalidPhotoSnapshot = decodeShareSnapshot(namedUrl!);
    invalidPhotoSnapshot.pk = "ph_0000000000000000";
    expect(
      parseCountertopStudioShareUrl(replaceShareSnapshot(namedUrl!, invalidPhotoSnapshot))
    ).toBeNull();

    const malformedPhotoSnapshot = decodeShareSnapshot(namedUrl!);
    malformedPhotoSnapshot.pk = "../../private";
    expect(
      parseCountertopStudioShareUrl(replaceShareSnapshot(namedUrl!, malformedPhotoSnapshot))
    ).toBeNull();
  });

  it("round-trips the last real photo of a large catalog set", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "alabama-white",
      textureImageIndex: 40,
    };
    const shareUrl = buildCountertopStudioShareUrl(design, "https://example.com/studio");
    expect(parseCountertopStudioShareUrl(shareUrl!)?.textureImageIndex).toBe(40);
  });

  it("round-trips a non-default Cristallo photo without the saved default key winning", () => {
    const stone = getCatalogItemById("cristallo")!;
    expect(stone.images.length).toBeGreaterThan(1);
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "cristallo",
      textureImageIndex: 1,
      texturePhotoKey: buildStoneDesignerPhotoKey(stone.images[1]!),
    };

    const shareUrl = buildCountertopStudioShareUrl(design, "https://example.com/studio");
    expect(parseCountertopStudioShareUrl(shareUrl!)).toMatchObject({
      textureImageIndex: 1,
      texturePhotoKey: buildStoneDesignerPhotoKey(stone.images[1]!),
    });
  });

  it("accepts a legacy v1 positional snapshot as a bounded fallback", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "taj-mahal",
      textureImageIndex: 2,
    };
    const v2Url = buildCountertopStudioShareUrl(design, "https://example.com/studio")!;
    const legacySnapshot = decodeShareSnapshot(v2Url);
    legacySnapshot.v = 1;
    legacySnapshot.im = 2;
    delete legacySnapshot.pk;

    expect(
      parseCountertopStudioShareUrl(replaceShareSnapshot(v2Url, legacySnapshot))?.textureImageIndex
    ).toBe(2);
  });

  it("keeps missing or malformed legacy measurements unresolved", () => {
    const design = {
      ...createEmptySteelHomeProjectDraft().countertops,
      stoneId: "taj-mahal",
      measurementsReviewed: true,
      roomWidthIn: 240,
    };
    const url = new URL(buildCountertopStudioShareUrl(design, "https://example.com/studio")!);
    for (const extension of [null, "not-json", JSON.stringify({ v: 7, mr: true, rw: 240 })]) {
      if (extension === null) url.searchParams.delete("measure");
      else url.searchParams.set("measure", extension);
      expect(parseCountertopStudioShareUrl(url.href)).toMatchObject({
        stoneId: "taj-mahal",
        measurementsReviewed: false,
        roomWidthIn: null,
        sinkTemplateWidthIn: null,
      });
    }
  });
});
