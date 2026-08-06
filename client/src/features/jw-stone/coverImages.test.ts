import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "./catalog";
import {
  JW_STONE_HAND_COVER_FILE_IDS,
  JW_STONE_PREFERRED_COVER_FILE_IDS,
  driveFileIdFromImagePath,
  isCloseUpSourceName,
  isFullSlabSourceName,
  isHandOnlyStone,
  isHandScaleCoverImage,
  isPhoneDumpSourceName,
  listHandOnlyStoneIds,
  listStonesWithoutFullSlabCover,
  orderImagesForCover,
  rankImagePathsForCover,
  scoreImageForCover,
  sourceNameForImagePath,
} from "./coverImages";

describe("JW Stone marketplace cover image ranking", () => {
  it("prefers full-slab context filenames over close-up / hand / sample names", () => {
    const images = [
      "/images/businesses/jw-stone/inventory-source/hand-detail.webp",
      "/images/businesses/jw-stone/inventory-source/yard-slabs.webp",
      "/images/businesses/jw-stone/inventory-source/texture-swatch.webp",
    ];

    // Bypass generated name map by scoring through explicit sourceName path helpers.
    expect(isCloseUpSourceName("stell gray close polished.jpg")).toBe(true);
    expect(isCloseUpSourceName("sample hand detail.jpg")).toBe(true);
    expect(isPhoneDumpSourceName("IMG_0017.JPG")).toBe(true);
    expect(isPhoneDumpSourceName("PHOTO-2026-05-19-04-37-09.jpg")).toBe(true);
    expect(isFullSlabSourceName("Avalanche 118x80 7 slabs full size.jpg")).toBe(true);
    expect(isFullSlabSourceName("stell gray close polished.jpg")).toBe(false);

    expect(
      scoreImageForCover({
        imagePath: images[1]!,
        sourceName: "Avalanche 118x80 7 slabs full size.jpg",
      })
    ).toBeGreaterThan(
      scoreImageForCover({
        imagePath: images[0]!,
        sourceName: "stell gray close polished.jpg",
      })
    );
  });

  it("moves a full-slab sibling ahead of a close-up lead without dropping photos", () => {
    const closeLead =
      "/images/businesses/jw-stone/inventory-source/1gyptGBJ6Qv_1fD7sNxvGr70r8mDLha91.webp";
    const fullSlab =
      "/images/businesses/jw-stone/inventory-source/1ZcGVAg76xGKbQ1l9v7kO64Qqf-Nt-U74.webp";
    const other =
      "/images/businesses/jw-stone/inventory-source/1HvAmqzaxLNyhz3N44nP_MnTa-Jx7sGv4.webp";

    // matrix-basalt source names: close LOOK vs 14 slabs
    expect(isCloseUpSourceName(sourceNameForImagePath(closeLead))).toBe(true);
    expect(isFullSlabSourceName(sourceNameForImagePath(fullSlab))).toBe(true);

    const ordered = orderImagesForCover([closeLead, fullSlab, other]);
    expect(ordered[0]).toBe(fullSlab);
    expect(new Set(ordered)).toEqual(new Set([closeLead, fullSlab, other]));
    expect(rankImagePathsForCover([closeLead, fullSlab, other])[0]).toBe(1);
  });

  it("promotes a full-slab sibling over a misnamed hand lead with slab dimensions", () => {
    const handLead =
      "/images/businesses/jw-stone/inventory-source/1BrnNoAJ7X3z5lXuKwKZCPX17Y7G7rg-p.webp";
    const handSibling =
      "/images/businesses/jw-stone/inventory-source/1lfVGyu3oVXcdaAb6amxkgSJBB_w1Rh36.webp";
    const fullSlab =
      "/images/businesses/jw-stone/inventory-source/1D9v9nEKAm5BCDuSlzYpdn9PwOi0nkjKs.webp";

    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(handLead))).toBe(true);
    expect(isHandScaleCoverImage(handLead)).toBe(true);
    expect(isHandScaleCoverImage(fullSlab)).toBe(false);

    const ordered = orderImagesForCover([handLead, handSibling, fullSlab], {
      stoneSlug: "juparana-blue",
    });
    expect(ordered[0]).toBe(fullSlab);
    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["juparana-blue"]).toBe(
      driveFileIdFromImagePath(fullSlab)
    );
  });

  it("promotes Aspen White full-slab over clamp-hand and hand-scale siblings", () => {
    const clampHand =
      "/images/businesses/jw-stone/inventory-source/1CtB0-MY_RP50AEdeSHvwHYJzSwGYs8Ae.webp";
    const handScale =
      "/images/businesses/jw-stone/inventory-source/1T9OTfK4VWe5j0wMuIof2BUdeo7RZ57_R.webp";
    const fullSlab =
      "/images/businesses/jw-stone/inventory-source/1PGDSTn70sheqEx3u39VgzuJNodBJW0xe.webp";

    expect(isHandScaleCoverImage(clampHand)).toBe(true);
    expect(isHandScaleCoverImage(handScale)).toBe(true);
    expect(isHandScaleCoverImage(fullSlab)).toBe(false);

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "aspen-white");
    expect(stone).toBeTruthy();
    expect(stone!.images[0]).toContain("1PGDSTn70sheqEx3u39VgzuJNodBJW0xe");
    expect(stone!.images.every((image) => !isHandScaleCoverImage(image))).toBe(true);
    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["aspen-white"]).toBe(
      driveFileIdFromImagePath(fullSlab)
    );
  });

  it("keeps AJ Quartz off hand-on-face siblings when a full-slab lead exists", () => {
    const handA =
      "/images/businesses/jw-stone/inventory-source/1ippYy4EpV8TV6C8orM8B_KWwMrNZI2NE.webp";
    const handB =
      "/images/businesses/jw-stone/inventory-source/1Fxc4jXM4YxGC1rPSVpCN-UD1hme2HKKK.webp";
    expect(isHandScaleCoverImage(handA)).toBe(true);
    expect(isHandScaleCoverImage(handB)).toBe(true);

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "aj-quartz");
    expect(stone).toBeTruthy();
    expect(isHandScaleCoverImage(stone!.images[0]!)).toBe(false);
    expect(stone!.images.some((image) => image.includes("1ippYy4EpV8TV6C8orM8B_KWwMrNZI2NE"))).toBe(
      false
    );
    expect(stone!.images.some((image) => image.includes("1Fxc4jXM4YxGC1rPSVpCN-UD1hme2HKKK"))).toBe(
      false
    );
  });

  it("keeps Shadow Storm off hand-on-face dimension leads", () => {
    const handFace =
      "/images/businesses/jw-stone/inventory-source/11_8FYGX-hKzb7MMljH8LGukCR6ofFcaz.webp";
    const preferred =
      "/images/businesses/jw-stone/inventory-source/1yuISE53-4yMFdH_4ElUlxi1y7QHmaCa8.webp";
    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(handFace))).toBe(true);
    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["shadow-storm"]).toBe(
      driveFileIdFromImagePath(preferred)
    );

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "shadow-storm");
    expect(stone).toBeTruthy();
    expect(stone!.images[0]).toContain("1yuISE53-4yMFdH_4ElUlxi1y7QHmaCa8");
    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(stone!.images[0]!))).toBe(
      false
    );
    // Public gallery drops denylisted hand siblings when a clean face exists.
    expect(stone!.images).toHaveLength(1);
    expect(stone!.images.every((image) => !isHandScaleCoverImage(image))).toBe(true);
  });

  it("keeps catalog covers off known hand-scale leads when a better sibling exists", () => {
    for (const stone of JW_STONE_CATALOG) {
      if (stone.images.length < 2) continue;
      const leadId = driveFileIdFromImagePath(stone.images[0]!);
      const hasNonHandSibling = stone.images.some((image) => !isHandScaleCoverImage(image));
      if (!hasNonHandSibling) continue;
      expect(isHandScaleCoverImage(stone.images[0]!)).toBe(false);
      expect(JW_STONE_HAND_COVER_FILE_IDS.has(leadId)).toBe(false);
      expect(isCloseUpSourceName(sourceNameForImagePath(stone.images[0]!))).toBe(false);
    }
  });

  it("reports stones that only have close-up or hand photography", () => {
    const onlyCloseOrHand = listStonesWithoutFullSlabCover(
      JW_STONE_CATALOG.map((stone) => ({ slug: stone.id, images: stone.images }))
    );
    const handOnly = listHandOnlyStoneIds(
      JW_STONE_CATALOG.map((stone) => ({ slug: stone.id, images: stone.images }))
    );

    expect(onlyCloseOrHand).toEqual(
      expect.arrayContaining([
        "blue-dream",
        "blue-goias",
        "dallas-white",
        "fusion-yellow",
        "namib-bianco-select",
        "steel-gray",
      ])
    );
    expect(handOnly).toEqual(
      expect.arrayContaining([
        "blue-dream",
        "blue-goias",
        "dallas-white",
        "fusion-yellow",
        "namib-bianco-select",
        "steel-gray",
      ])
    );
    expect(isHandOnlyStone(JW_STONE_CATALOG.find((s) => s.id === "steel-gray")!.images)).toBe(true);
    expect(isHandOnlyStone(JW_STONE_CATALOG.find((s) => s.id === "juparana-blue")!.images)).toBe(
      false
    );
  });
});
