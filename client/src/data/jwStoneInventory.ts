export type JwStoneMaterialStatus =
  | "user_confirmed"
  | "source_folder"
  | "filename"
  | "historical_assignment"
  | "unconfirmed";

export type JwStoneInventoryStone = {
  name: string;
  slug: string;
  images: string[];
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

const stones = generatedInventory.map((generated): JwStoneInventoryStone & {
  categorySlug: string;
} => {
  const { categorySlug, slug, name, images, slabCounts } = generated;
  const status = materialStatus(slug, categorySlug);
  const finishes = EXPLICIT_FINISHES[slug];
  return {
    categorySlug,
    name,
    slug,
    images,
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
});

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
