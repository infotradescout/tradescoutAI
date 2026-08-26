/**
 * Canonical JW Stone public inventory.
 *
 * Profile discovery, share metadata, and the marketplace catalog all read this
 * reconciled projection (158 selections / full source photo set). Do not ship a
 * divergent “profile-only” list alongside marketplace.
 */
import generatedInventory from "./jwStoneInventory.generated.json";
import imageFinishByDriveId from "./jwStoneImageFinishes.generated.json";
import {
  reconcileJwStoneGeneratedInventory,
  type GeneratedJwStoneRecord,
} from "./reconcileJwStoneInventory";
import {
  resolveJwStoneInventoryNamePresentation,
  type JwStoneInventoryNameStatus,
} from "@shared/jwStonePresentation";

export type JwStoneMaterialStatus =
  | "user_confirmed"
  | "published_source"
  | "source_folder"
  | "filename"
  | "historical_assignment"
  | "unconfirmed";

export type JwStoneInventoryStone = {
  name: string;
  displayName: string | null;
  nameStatus: JwStoneInventoryNameStatus;
  slug: string;
  images: string[];
  /** Stable share ordinal -> presentation image index. */
  shareImageOrder?: number[];
  // Parallel to images: the finish stated in that specific photo's source
  // filename, when explicit (e.g. a stone shot in both polished and
  // leathered side by side). Undefined per-photo when no photo-specific
  // evidence exists -- falls back to the stone-level `finishes` in the UI.
  imageFinishes?: Array<string[] | undefined>;
  slabCounts?: number[];
  materialStatus: JwStoneMaterialStatus;
  finishes?: string[];
  finishStatus: "explicit" | "unconfirmed";
  sourceNote: string;
};

export type JwStoneInventoryCategory = {
  category: string;
  categorySlug: string;
  stones: JwStoneInventoryStone[];
};

const CATEGORY_LABELS: Record<string, string> = {
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

const USER_CONFIRMED = new Set([
  "blue-dunes",
  "cristallo",
  "gold-macaubas",
  "rhino-white",
  "taj-mahal",
  "titanium",
]);

const FILENAME_CONFIRMED = new Set(["calacatta-vaguili"]);

type PublishedMaterialEvidence = Readonly<{
  categorySlug: Exclude<(typeof CATEGORY_ORDER)[number], "unconfirmed">;
  source: string;
}>;

/** Exact commercial-name matches from independent stone suppliers. */
const PUBLISHED_MATERIAL_BY_SLUG: Readonly<Record<string, PublishedMaterialEvidence>> = {
  apollonis: {
    categorySlug: "quartzite",
    source: "https://ssstonedesign.com/inventory",
  },
  artemis: {
    categorySlug: "quartzite",
    source: "https://www.arizonatile.com/products/slab/quartzite/artemis/",
  },
  "calacatta-corchia": {
    categorySlug: "marble",
    source: "https://www.ssccountertops.com/calacatta-corchia",
  },
  "calacatta-cremo": {
    categorySlug: "marble",
    source: "https://arcsurfaces.com/live-inventory/calacatta-cremo/19215/",
  },
  "emerald-pearl": {
    categorySlug: "granite",
    source: "https://www.greatlakesgm.com/products/emerald-pearl-granite/",
  },
  "new-caledonia": {
    categorySlug: "granite",
    source: "https://www.arizonatile.com/products/slab/granite/new-caledonia/",
  },
  "steel-gray": {
    categorySlug: "granite",
    source:
      "https://www.regattagranitesindia.com/steel-grey-granite-a-low-variation-durable-granite/",
  },
};

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

function materialStatus(generated: GeneratedJwStoneRecord): JwStoneMaterialStatus {
  if (USER_CONFIRMED.has(generated.slug)) return "user_confirmed";
  if (FILENAME_CONFIRMED.has(generated.slug)) return "filename";
  if (PUBLISHED_MATERIAL_BY_SLUG[generated.slug]) return "published_source";
  if (generated.categorySlug === "unconfirmed") return "unconfirmed";
  return "source_folder";
}

function projectStone(generated: GeneratedJwStoneRecord): JwStoneInventoryStone & {
  categorySlug: string;
} {
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
  const status = materialStatus(generated);
  const publishedMaterial = PUBLISHED_MATERIAL_BY_SLUG[generated.slug];
  const categorySlug = publishedMaterial?.categorySlug ?? generated.categorySlug;

  return {
    categorySlug,
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
      status === "user_confirmed"
        ? "Material confirmed during JW Stone reconciliation."
        : status === "published_source"
          ? `Material stated by an independent stone supplier: ${publishedMaterial!.source}`
          : status === "filename"
            ? "Material stated in the source filename."
            : status === "source_folder"
              ? "Material follows the JW Stone source folder; finish remains separate evidence."
              : "Source material is conflicting or absent; confirmation required.",
  };
}

const reconciled = reconcileJwStoneGeneratedInventory(
  generatedInventory as GeneratedJwStoneRecord[]
).map(projectStone);

export const JW_STONE_INVENTORY_CATEGORIES: JwStoneInventoryCategory[] = CATEGORY_ORDER.map(
  (categorySlug) => ({
    category: CATEGORY_LABELS[categorySlug],
    categorySlug,
    stones: reconciled
      .filter((stone) => stone.categorySlug === categorySlug)
      .map(({ categorySlug: _categorySlug, ...stone }) => stone)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })
).filter((category) => category.stones.length > 0);

export const JW_STONE_INVENTORY_SUMMARY = Object.freeze({
  stoneCount: reconciled.length,
  imageCount: reconciled.reduce((total, stone) => total + stone.images.length, 0),
  needsMaterialConfirmation: reconciled.filter((stone) => stone.materialStatus === "unconfirmed")
    .length,
  needsFinishConfirmation: reconciled.filter((stone) => stone.finishStatus === "unconfirmed")
    .length,
});
