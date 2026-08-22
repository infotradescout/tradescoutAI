/**
 * Server-side JW Stone inventory — same reconciliation as the client catalog.
 * Used for share metadata, public discovery, and custom-domain SEO.
 */
import generatedJwStoneInventory from "../client/src/data/jwStoneInventory.generated.json";
import {
  reconcileJwStoneGeneratedInventory,
  type GeneratedJwStoneRecord,
} from "../client/src/data/reconcileJwStoneInventory";
import { resolveJwStoneInventoryNamePresentation } from "@shared/jwStonePresentation";

const JW_STONE_CATEGORY_LABELS: Record<string, string> = {
  granite: "Granite",
  marble: "Marble",
  quartzite: "Quartzite",
  quartz: "Engineered Quartz",
  onyx: "Onyx",
  soapstone: "Soapstone",
  basalt: "Basalt",
  unconfirmed: "Trending at JW Stone",
};

const CATEGORY_ORDER = [
  "granite",
  "marble",
  "quartzite",
  "quartz",
  "onyx",
  "soapstone",
  "basalt",
  "unconfirmed",
] as const;

type JwStoneShareStone = {
  categorySlug: string;
  name: string;
  displayName: string | null;
  nameStatus: "source" | "placeholder";
  slug: string;
  images: string[];
  shareImageOrder?: number[];
  publicSummary: string;
  publicKind: "offering";
};

const JW_STONE_MATERIAL_LIBRARY_SHARE_SUMMARY =
  "This material is part of JW Stone's material library, not a claim of current stock.";

const reconciledStones: JwStoneShareStone[] = reconcileJwStoneGeneratedInventory(
  generatedJwStoneInventory as GeneratedJwStoneRecord[]
).map((stone) => {
  const namePresentation = resolveJwStoneInventoryNamePresentation(stone);
  return {
    categorySlug: stone.categorySlug,
    name: stone.name,
    ...namePresentation,
    slug: stone.slug,
    images: stone.images,
    shareImageOrder: stone.shareImageOrder,
    publicSummary: JW_STONE_MATERIAL_LIBRARY_SHARE_SUMMARY,
    publicKind: "offering",
  };
});

export const JW_STONE_CANONICAL_INVENTORY_CATEGORIES = CATEGORY_ORDER.map((categorySlug) => ({
  category: JW_STONE_CATEGORY_LABELS[categorySlug] || categorySlug,
  categorySlug,
  stones: reconciledStones
    .filter((stone) => stone.categorySlug === categorySlug)
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name)),
})).filter((category) => category.stones.length > 0);

export const JW_STONE_CANONICAL_INVENTORY_SUMMARY = Object.freeze({
  stoneCount: reconciledStones.length,
  imageCount: reconciledStones.reduce((total, stone) => total + stone.images.length, 0),
});
