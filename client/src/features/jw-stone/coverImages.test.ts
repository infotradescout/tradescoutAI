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

  it("promotes Alabama White face-true white cover over yard blue-washed lead", () => {
    const blueWashed =
      "/images/businesses/jw-stone/inventory-source/10yweUjuZUXYPMdABEIM6kq7EC4N4Djyn.webp";
    const faceTrue =
      "/images/businesses/jw-stone/inventory-source/1pRla8GWSa3dSbWTtgTsrytcJMb8D0Qso.webp";

    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["alabama-white"]).toBe(
      driveFileIdFromImagePath(faceTrue)
    );

    const ordered = orderImagesForCover([blueWashed, faceTrue], {
      stoneSlug: "alabama-white",
    });
    expect(ordered[0]).toBe(faceTrue);

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "alabama-white");
    expect(stone).toBeTruthy();
    expect(stone!.images[0]).toContain("1pRla8GWSa3dSbWTtgTsrytcJMb8D0Qso");
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
    expect(isHandScaleCoverImage(stone!.images[0]!)).toBe(false);
    expect(stone!.images).toEqual(expect.arrayContaining([clampHand, handScale, fullSlab]));
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

    const baseStone = JW_STONE_CATALOG.find((entry) => entry.id === "aj-quartz");
    const ajFour = JW_STONE_CATALOG.find((entry) => entry.id === "aj-quartz-4");
    expect(baseStone).toBeTruthy();
    expect(ajFour).toBeTruthy();
    expect(isHandScaleCoverImage(baseStone!.images[0]!)).toBe(false);
    expect(isHandScaleCoverImage(ajFour!.images[0]!)).toBe(false);
    // Each numbered selection keeps its own hand detail as an extra, never the lead.
    expect(baseStone!.images).toContain(handA);
    expect(ajFour!.images).toContain(handB);
    expect(baseStone!.images[0]).not.toBe(handA);
    expect(ajFour!.images[0]).not.toBe(handB);
  });

  it("keeps Black Pearl off outdoor reflection clamp lead", () => {
    const reflectionLead =
      "/images/businesses/jw-stone/inventory-source/1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs.webp";
    const faceLead = "/images/businesses/jw-stone/inventory-source/black-pearl-slab-face.webp";
    const botchedFace =
      "/images/businesses/jw-stone/inventory-source/black-pearl-face-1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs.webp";

    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(reflectionLead))).toBe(true);
    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(botchedFace))).toBe(true);
    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["black-pearl"]).toBe(
      driveFileIdFromImagePath(faceLead)
    );

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "black-pearl");
    expect(stone).toBeTruthy();
    expect(stone!.images[0]).toContain("black-pearl-slab-face");
    expect(driveFileIdFromImagePath(stone!.images[0]!)).not.toBe(
      "1AehD2Gk37gaaQNfAUqoIA0X2nbeVBvNs"
    );
    expect(stone!.images.some((image) => image.includes(botchedFace.split("/").pop()!))).toBe(
      false
    );
  });

  it("keeps Taj Mahal off hand-on-stone yard leads", () => {
    const handLead =
      "/images/businesses/jw-stone/inventory-source/1wca7RSqaHX7QSKjERH3zQLUT9-dVr8rW.webp";
    const handSeriesLead =
      "/images/businesses/jw-stone/inventory-source/16683MPLP7Tbr_zWA29ito0eVct7ooffq.webp";
    const cleanFace =
      "/images/businesses/jw-stone/inventory-source/1gDJPWKTjG68NRvI4NXDW3pM3v-oqItXh.webp";

    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(handLead))).toBe(true);
    expect(JW_STONE_HAND_COVER_FILE_IDS.has(driveFileIdFromImagePath(handSeriesLead))).toBe(true);
    expect(JW_STONE_PREFERRED_COVER_FILE_IDS["taj-mahal"]).toBe(
      driveFileIdFromImagePath(cleanFace)
    );

    const stone = JW_STONE_CATALOG.find((entry) => entry.id === "taj-mahal");
    expect(stone).toBeTruthy();
    expect(stone!.images[0]).toContain("1gDJPWKTjG68NRvI4NXDW3pM3v-oqItXh");
    expect(stone!.images[0]).not.toContain("1wca7RSqaHX7QSKjERH3zQLUT9-dVr8rW");
    expect(stone!.images[0]).not.toContain("16683MPLP7Tbr_zWA29ito0eVct7ooffq");
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
    // Lead stays clean; hand siblings remain available as gallery extras.
    expect(stone!.images.length).toBeGreaterThan(1);
    expect(isHandScaleCoverImage(stone!.images[0]!)).toBe(false);
    expect(stone!.images.some((image) => isHandScaleCoverImage(image))).toBe(true);
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

  it("uses a hand photo first only when every supplied image is hand or close-up", () => {
    for (const stone of JW_STONE_CATALOG) {
      if (!stone.images.length || !isHandScaleCoverImage(stone.images[0]!)) continue;
      expect(stone.images.every((image) => isHandScaleCoverImage(image)), stone.id).toBe(true);
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
        "blue-goias",
        "dallas-white",
        "fusion-yellow",
        "namib-bianco-select",
        "steel-gray",
      ])
    );
    expect(handOnly).toEqual(
      expect.arrayContaining([
        "blue-goias",
        "dallas-white",
        "fusion-yellow",
        "namib-bianco-select",
        "steel-gray",
      ])
    );
    expect(isHandOnlyStone(JW_STONE_CATALOG.find((s) => s.id === "steel-gray")!.images)).toBe(true);
    expect(onlyCloseOrHand).not.toContain("blue-dream");
    expect(handOnly).not.toContain("blue-dream");
    expect(isHandOnlyStone(JW_STONE_CATALOG.find((s) => s.id === "juparana-blue")!.images)).toBe(
      false
    );
  });
});
