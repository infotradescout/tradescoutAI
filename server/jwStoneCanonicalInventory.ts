/**
 * Server-side JW Stone discovery projection. The reconciled inventory owner
 * stays in client/src/data/jwStoneInventory.ts; SEO must not maintain a second
 * interpretation of names, material evidence, finishes, or source photos.
 */
import {
  JW_STONE_INVENTORY_CATEGORIES,
  JW_STONE_INVENTORY_SUMMARY,
} from "../client/src/data/jwStoneInventory";
import { IRANIAN_ONYX_STOCK, JW_STONE_ONYX_ORIGINS } from "@shared/onyxOrigins";

type JwStoneShareStone = {
  categorySlug: string;
  name: string;
  displayName: string | null;
  nameStatus: "source" | "placeholder";
  slug: string;
  images: string[];
  shareImageOrder?: number[];
  publicSummary?: string;
  publicKind?: "offering";
  countryOfOrigin?: string;
  thicknessCm?: number;
};

function buildPublicStoneSummary(args: {
  name: string;
  category: string;
  photoCount: number;
}): string {
  const categorySuffix =
    args.category === "Trending at JW Stone" ||
    args.name.toLowerCase().endsWith(args.category.toLowerCase())
      ? ""
      : ` ${args.category}`;
  const photoLabel = args.photoCount === 1 ? "photo" : "photos";
  return `${args.name}${categorySuffix}: ${args.photoCount} ${photoLabel}, part of JW Stone's material library. Ask JW Stone to confirm current pricing and availability.`;
}

export const JW_STONE_CANONICAL_INVENTORY_CATEGORIES = JW_STONE_INVENTORY_CATEGORIES.map(
  (category) => ({
    category: category.category,
    categorySlug: category.categorySlug,
    stones: category.stones.map(
      (stone): JwStoneShareStone => ({
        categorySlug: category.categorySlug,
        name: stone.name,
        displayName: stone.displayName,
        nameStatus: stone.nameStatus,
        slug: stone.slug,
        images: [...stone.images],
        shareImageOrder: stone.shareImageOrder ? [...stone.shareImageOrder] : undefined,
        ...(stone.slug in JW_STONE_ONYX_ORIGINS
          ? {
              countryOfOrigin:
                JW_STONE_ONYX_ORIGINS[stone.slug as keyof typeof JW_STONE_ONYX_ORIGINS].country,
              thicknessCm: IRANIAN_ONYX_STOCK.thicknessCm,
            }
          : {}),
        ...(stone.displayName
          ? {
              publicSummary:
                (stone.slug in JW_STONE_ONYX_ORIGINS
                  ? `${IRANIAN_ONYX_STOCK.specification} `
                  : "") +
                buildPublicStoneSummary({
                  name: stone.displayName,
                  category: category.category,
                  photoCount: stone.images.length,
                }),
              publicKind: "offering" as const,
            }
          : {}),
      })
    ),
  })
);

export const JW_STONE_CANONICAL_INVENTORY_SUMMARY = Object.freeze({
  stoneCount: JW_STONE_INVENTORY_SUMMARY.stoneCount,
  imageCount: JW_STONE_INVENTORY_SUMMARY.imageCount,
});
