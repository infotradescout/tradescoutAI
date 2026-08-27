import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "../../client/src/features/jw-stone/catalog";
import { isJwStonePublicMediaPath } from "@shared/jwStonePublicMedia";

describe("JW Stone marketplace asset integrity", () => {
  it("keeps every referenced canonical gallery image in the R2 migration manifest", () => {
    const images = JW_STONE_CATALOG.flatMap((stone) => stone.images);
    expect(images.length).toBeGreaterThan(300);
    expect(images.filter((image) => !isJwStonePublicMediaPath(image))).toEqual([]);
  });

  it("serves the marketplace identity, hero, and social assets from public media", () => {
    expect(
      [
        "/images/businesses/jw-stone/logo.svg",
        "/images/businesses/jw-stone/video/hero-poster.jpg",
        "/images/businesses/jw-stone/logo-social-preview.png",
      ].filter((asset) => !isJwStonePublicMediaPath(asset))
    ).toEqual([]);
  });
});
