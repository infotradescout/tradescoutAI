export type JwStoneMaterialStatus =
  | "user_confirmed"
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
];

const USER_CONFIRMED = new Set([
  "blue-dunes",
  "cristallo",
  "gold-macaubas",
  "rhino-white",
  "taj-mahal",
  "titanium",
]);

const FILENAME_CONFIRMED = new Set(["calacatta-vaguili"]);

const EXPLICIT_FINISHES: Record<string, string[]> = {
  "bianco-palomino": ["Polished"],
  "blue-dunes": ["Polished"],
  calacatta: ["Polished"],
  cristallo: ["Polished", "Honed"],
  "fantasy-black": ["Leathered", "Polished"],
  "gold-macaubas": ["Leathered", "Polished"],
  "jaguar-leather": ["Leathered"],
  "mont-blanc": ["Polished"],
  "namib-bianco-select": ["Polished"],
  "namib-fantasy": ["Polished"],
  "preto-sao-gabriel": ["Leathered"],
  "rhino-white": ["Polished"],
  "steel-gray": ["Brushed", "Polished"],
  "taj-mahal": ["Honed"],
  titanium: ["Leathered"],
  "titanium-black-leathered": ["Leathered"],
  versace: ["Honed"],
  "viscount-white": ["Leathered", "Polished"],
};

function materialStatus(slug: string, category: string): JwStoneMaterialStatus {
  if (USER_CONFIRMED.has(slug)) return "user_confirmed";
  if (FILENAME_CONFIRMED.has(slug)) return "filename";
  if (category === "unconfirmed") return "unconfirmed";
  return "source_folder";
}

const stones = generatedInventory.map(
  (
    generated
  ): JwStoneInventoryStone & {
    categorySlug: string;
  } => {
    const { categorySlug, slug, name, images, shareImageOrder, slabCounts, sourceFileIds } =
      generated;
    const namePresentation = resolveJwStoneInventoryNamePresentation({ name, slug });
    const status = materialStatus(slug, categorySlug);
    const finishes = EXPLICIT_FINISHES[slug];
    const imageFinishes = sourceFileIds?.map(
      (fileId: string) => (imageFinishByDriveId as Record<string, string[]>)[fileId]
    );
    return {
      categorySlug,
      name,
      ...namePresentation,
      slug,
      images,
      shareImageOrder,
      imageFinishes: imageFinishes?.some((f: string[] | undefined) => f?.length)
        ? imageFinishes
        : undefined,
      slabCounts,
      materialStatus: status,
      finishes,
      finishStatus: finishes?.length ? "explicit" : "unconfirmed",
      sourceNote:
        status === "user_confirmed"
          ? "Material confirmed during JW Stone reconciliation."
          : status === "filename"
            ? "Material stated in the source filename."
            : status === "source_folder"
              ? "Material follows the JW Stone source folder; finish remains separate evidence."
              : "Source material is conflicting or absent; confirmation required.",
    };
  }
);

export const JW_STONE_INVENTORY_CATEGORIES: JwStoneInventoryCategory[] = CATEGORY_ORDER.map(
  (categorySlug) => ({
    category: CATEGORY_LABELS[categorySlug],
    categorySlug,
    stones: stones
      .filter((stone) => stone.categorySlug === categorySlug)
      .map(({ categorySlug: _categorySlug, ...stone }) => stone)
      .sort((a, b) => a.name.localeCompare(b.name)),
  })
).filter((category) => category.stones.length > 0);

export const JW_STONE_INVENTORY_SUMMARY = {
  stoneCount: stones.length,
  imageCount: stones.reduce((total, stone) => total + stone.images.length, 0),
  needsMaterialConfirmation: stones.filter((stone) => stone.materialStatus === "unconfirmed")
    .length,
  needsFinishConfirmation: stones.filter((stone) => stone.finishStatus === "unconfirmed").length,
};
import generatedInventory from "./jwStoneInventory.generated.json";
import imageFinishByDriveId from "./jwStoneImageFinishes.generated.json";
import {
  resolveJwStoneInventoryNamePresentation,
  type JwStoneInventoryNameStatus,
} from "@shared/jwStonePresentation";
