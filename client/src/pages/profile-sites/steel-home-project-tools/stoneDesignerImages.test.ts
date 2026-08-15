import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG, getCatalogItemById } from "@/features/jw-stone/catalog";
import {
  buildNamedStoneDesignerImageHref,
  buildStoneDesignerImageHref,
  buildStoneDesignerPhotoKey,
  isStoneDesignerPhotoKey,
  resolveStoneDesignerPhotoIndex,
} from "./stoneDesignerImages";

describe("stable stone-designer photo identities", () => {
  it("creates validated opaque keys that are unique across the supplied catalog", () => {
    const imageHrefs = JW_STONE_CATALOG.flatMap((stone) => stone.images);
    const keys = imageHrefs.map(buildStoneDesignerPhotoKey);

    expect(keys.every(isStoneDesignerPhotoKey)).toBe(true);
    expect(new Set(keys).size).toBe(imageHrefs.length);
    expect(buildStoneDesignerPhotoKey("../private.webp")).toBeNull();
    expect(buildStoneDesignerPhotoKey("https://example.com/photo.webp")).toBeNull();
    expect(isStoneDesignerPhotoKey("ph_not-a-real-key")).toBe(false);
  });

  it("resolves by immutable photo identity after gallery order changes", () => {
    const stone = getCatalogItemById("cristallo");
    if (!stone?.shareSlug || stone.images.length < 3) throw new Error("Expected Cristallo photos");
    const selectedImage = stone.images[2]!;
    const photoKey = buildStoneDesignerPhotoKey(selectedImage);
    const reordered = [selectedImage, stone.images[0]!, stone.images[1]!];

    expect(resolveStoneDesignerPhotoIndex(stone.images, photoKey)).toBe(2);
    expect(resolveStoneDesignerPhotoIndex(reordered, photoKey)).toBe(0);
    expect(buildNamedStoneDesignerImageHref(stone.shareSlug, selectedImage)).toMatch(
      /^\/images\/stone-designer\/named\/cristallo\/ph_[0-9a-f]{16}\.webp$/
    );
  });

  it("retains the positional route only as a legacy alias", () => {
    expect(buildStoneDesignerImageHref("cristallo", 2)).toBe(
      "/images/stone-designer/cristallo/3.webp"
    );
  });
});
