import generatedInventory from "@/data/jwStoneInventory.generated.json";
import imageFinishByDriveId from "@/data/jwStoneImageFinishes.generated.json";
import {
  JW_STONE_INVENTORY_CATEGORIES,
  type JwStoneInventoryCategory,
  type JwStoneInventoryStone,
  type JwStoneMaterialStatus,
} from "@/data/jwStoneInventory";
import {
  reconcileJwStoneGeneratedInventory,
  type GeneratedJwStoneRecord,
} from "@/data/reconcileJwStoneInventory";
import { resolveJwStoneInventoryNamePresentation } from "@shared/jwStonePresentation";

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

const CATEGORY_LABEL_BY_SLUG = new Map(
  JW_STONE_INVENTORY_CATEGORIES.map((category) => [category.categorySlug, category.category])
);
const BASE_STONE_BY_SLUG = new Map(
  JW_STONE_INVENTORY_CATEGORIES.flatMap((category) =>
    category.stones.map((stone) => [stone.slug, stone] as const)
  )
);

/** Source-title spellings that the generated finish parser did not normalize. */
const MARKETPLACE_FINISH_BY_SOURCE_ID: Readonly<Record<string, readonly string[]>> = {
  "1Xa7SrSqU8QkEQ2loN5e0MJAiBwqh5d7d": ["Leathered"],
  "16W501McWkRTtvt5qSQmpHbM-gPWFBIbh": ["Leathered"],
  "1-1U8FEyCh3N2_DOxRhNKT_lUW72Jh_RQ": ["Leathered"],
  "191RN3EiWViOSo-i0c9qxcZgXtfIW4joY": ["Leathered", "Polished"],
  "1S8hBqFND6VJriBUY_D8suZlq-4RKnyAU": ["Leathered"],
  "1AKtf_qUIAsbuv8v_jHrtZUyQY0Q0DkU7": ["Leathered"],
  "1-vv4LRby_0SLHClkFAl5O7PgMDycjQEq": ["Polished"],
  "1c0fyGhU4W_0M4bHFlHjdJ2PYHSsMTF29": ["Polished", "Leathered"],
};

function sourceTitleFinishes(sourceFileId: string): readonly string[] | undefined {
  return (
    MARKETPLACE_FINISH_BY_SOURCE_ID[sourceFileId] ??
    (imageFinishByDriveId as Record<string, string[]>)[sourceFileId]
  );
}

function materialStatus(
  generated: GeneratedJwStoneRecord,
  base: JwStoneInventoryStone | undefined
): JwStoneMaterialStatus {
  if (base) return base.materialStatus;
  return generated.categorySlug === "unconfirmed" ? "unconfirmed" : "source_folder";
}

function projectMarketplaceStone(generated: GeneratedJwStoneRecord): JwStoneInventoryStone {
  const base = BASE_STONE_BY_SLUG.get(generated.slug);
  const namePresentation = resolveJwStoneInventoryNamePresentation({
    name: generated.name,
    slug: generated.slug,
  });
  const imageFinishes = generated.sourceFileIds.map((sourceFileId) =>
    sourceTitleFinishes(sourceFileId)
  );
  const finishes = [
    ...new Set(
      [...imageFinishes.flatMap((values) => values ?? []), ...(generated.finishes ?? [])]
        .map((finish) => finish.trim())
        .filter((finish) => finish && finish.toLocaleLowerCase() !== "dual finish")
    ),
  ];
  const status = materialStatus(generated, base);

  return {
    name: generated.name,
    ...namePresentation,
    slug: generated.slug,
    images: generated.images,
    shareImageOrder: generated.shareImageOrder,
    imageFinishes: imageFinishes.some((values) => values?.length)
      ? imageFinishes.map((values) => (values ? [...values] : undefined))
      : undefined,
    slabCounts: generated.slabCounts,
    materialStatus: status,
    finishes: finishes.length ? finishes : undefined,
    finishStatus: finishes.length ? "explicit" : "unconfirmed",
    sourceNote:
      base?.sourceNote ??
      (status === "source_folder"
        ? "Material follows the JW Stone source folder; finish remains separate evidence."
        : "Source material is conflicting or absent; confirmation required."),
  };
}

const reconciled = reconcileJwStoneGeneratedInventory(
  generatedInventory as GeneratedJwStoneRecord[]
);

export const JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES: JwStoneInventoryCategory[] =
  CATEGORY_ORDER.map((categorySlug) => ({
    category: CATEGORY_LABEL_BY_SLUG.get(categorySlug) ?? "Material to Confirm",
    categorySlug,
    stones: reconciled
      .filter((stone) => stone.categorySlug === categorySlug)
      .map(projectMarketplaceStone)
      .sort((left, right) => left.name.localeCompare(right.name)),
  })).filter((category) => category.stones.length > 0);

const marketplaceStones = JW_STONE_MARKETPLACE_INVENTORY_CATEGORIES.flatMap(
  (category) => category.stones
);

export const JW_STONE_MARKETPLACE_INVENTORY_SUMMARY = Object.freeze({
  stoneCount: marketplaceStones.length,
  imageCount: marketplaceStones.reduce((total, stone) => total + stone.images.length, 0),
});
