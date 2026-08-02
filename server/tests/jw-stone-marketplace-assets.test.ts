import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { JW_STONE_CATALOG } from "../../client/src/features/jw-stone/catalog";

const publicRoot = path.resolve(process.cwd(), "client/public");

function publicAssetExists(assetPath: string): boolean {
  return fs.existsSync(path.join(publicRoot, assetPath.replace(/^\/+/, "")));
}

describe("JW Stone marketplace asset integrity", () => {
  it("keeps every referenced canonical gallery image on disk", () => {
    const images = JW_STONE_CATALOG.flatMap((stone) => stone.images);
    expect(images).toHaveLength(433);
    expect(images.filter((image) => !publicAssetExists(image))).toEqual([]);
  });

  it("ships the marketplace identity, hero, and social assets", () => {
    expect(
      [
        "/images/businesses/jw-stone/logo.svg",
        "/images/businesses/jw-stone/video/hero-poster.jpg",
        "/images/businesses/jw-stone/logo-social-preview.png",
      ].filter((asset) => !publicAssetExists(asset))
    ).toEqual([]);
  });
});
