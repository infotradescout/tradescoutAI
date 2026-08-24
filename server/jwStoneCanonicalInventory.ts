/**
 * Server-side JW Stone discovery projection. The reconciled inventory owner
 * stays in client/src/data/jwStoneInventory.ts; SEO must not maintain a second
 * interpretation of names, material evidence, finishes, or source photos.
 */
import {
  JW_STONE_INVENTORY_CATEGORIES,
  JW_STONE_INVENTORY_SUMMARY,
} from "../client/src/data/jwStoneInventory";

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
};

function buildPublicStoneSummary(args: {
  name: string;
  category: string;
  photoCount: number;
  finishes: readonly string[];
}): string {
  const photoLabel = args.photoCount === 1 ? "material photo" : "material photos";
  const categoryDetail =
    args.category === "Trending at JW Stone" ? "" : `, a ${args.category} material`;
  const finishDetail = args.finishes.length
    ? ` Confirmed finish details: ${args.finishes.join(" / ")}.`
    : "";
  return `Explore ${args.name}${categoryDetail}, part of JW Stone's material library in Pensacola, Florida. Review ${args.photoCount} ${photoLabel}.${finishDetail} Ask JW Stone to confirm current pricing and availability for your project.`;
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
        ...(stone.displayName
          ? {
              publicSummary: buildPublicStoneSummary({
                name: stone.displayName,
                category: category.category,
                photoCount: stone.images.length,
                finishes: stone.finishStatus === "explicit" ? stone.finishes || [] : [],
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
