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

const ASSET_SPECS = `
granite/arizona-gold|2
granite/avalanche|2
granite/black-pearl|1
granite/blue-bahia|5
granite/blue-dunes|4
granite/blue-fantasy|1
granite/blue-flower|1
granite/blue-goias|1
granite/ceara-white|3
granite/dallas-white|1
granite/fantasy-black|2
granite/galaxy-white|7
granite/giallo-ornamental|1
granite/jaguar-leather|1
granite/juparana-blue|3
granite/matrix-basalt|2
granite/nilo-river|7
granite/picasso|2
granite/preto-sao-gabriel|2
granite/titanium|5
granite/titanium-black-leathered|2
granite/tyfoon|1
granite/valle-nevada-luna-pearl|2
granite/viscount-white|3
granite/white-ice|2
granite/white-persa|1
granite/white-springs|1
marble/alabama-rose|8
marble/alabama-white|8
marble/aspen-white|4
marble/bianco-palomino|4
marble/calacatta|7
marble/calacatta-amala|3
marble/calacatta-andromeda|1
marble/calacatta-corchia|2
marble/calacatta-cremo|2
marble/calacatta-dor|1
marble/calacatta-fumo|1
marble/calacatta-gold|2
marble/calacatta-macchia-vecchia|1
marble/calacatta-vaguili|1
marble/carrara-white-brazil|6
marble/cherokee-marble|2
marble/chocolate-brown|3
marble/cristalita-blue|3
marble/emerald-pearl|2
marble/emperor-brown|2
marble/fantasy-brown|8
marble/grigio-fantasy|2
marble/itaoca|1
marble/kolkata-vegi-marble|3
marble/matarazzo|5
marble/mexican-brown|2
marble/montana-bianco|4
marble/mugla|1
marble/namib-bianco-select|4
marble/namib-carrera|1
marble/namib-fantasy|8
marble/oyster-white|1
marble/palassandro|4
marble/panda|3
marble/perlatus|2
marble/pinta-verde|1
marble/shadow-storm|8
marble/silver-shadow|1
marble/venta-black|1
marble/versace|5
marble/white-fantasy|3
marble/white-silk|2
marble/zucci-marble|3
onyx/honey-onyx|6
quartz/aj-quartz|8
quartz/sparkling-white|2
quartzite/amazonic-green|1
quartzite/apollonis|1
quartzite/artemis|1
quartzite/atlantic|3
quartzite/beverly-blue|5
quartzite/beverly-blue-antigo|2
quartzite/bianco-superiory|5
quartzite/black-dunes|3
quartzite/blue-deep|1
quartzite/blue-dream|2
quartzite/blue-mare|1
quartzite/bronzonite|2
quartzite/casa-blanca|1
quartzite/cristal-2cm-united|1
quartzite/cristallo|8
quartzite/dueto|2
quartzite/frost|8
quartzite/fusion-blue|1
quartzite/fusion-brown|1
quartzite/fusion-yellow|2
quartzite/gabanna|3
quartzite/gold-macaubas|3
quartzite/grand-constantine|1
quartzite/macaubas-fantasy|2
quartzite/marbella-green|2
quartzite/mont-blanc|4
quartzite/mystic-spring|2
quartzite/new-caledonia|2
quartzite/porto-fino|2
quartzite/rhino-white|7
quartzite/river-white|1
quartzite/steel-gray|4
quartzite/super-white|2
quartzite/taj-mahal|8
quartzite/toulon-white|1
quartzite/white-santorini|3
soapstone/soapstone|3
`.trim();

const CATEGORY_LABELS: Record<string, string> = {
  granite: "Granite",
  marble: "Marble",
  quartzite: "Quartzite",
  quartz: "Engineered Quartz",
  onyx: "Onyx",
  soapstone: "Soapstone",
  basalt: "Basalt",
  unconfirmed: "Material to Confirm",
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

const TARGET_CATEGORY: Record<string, string> = {
  "matrix-basalt": "basalt",
  "calacatta-amala": "quartzite",
  "calacatta-andromeda": "quartz",
  "calacatta-dor": "quartz",
  "calacatta-fumo": "quartz",
  "calacatta-gold": "quartz",
  "calacatta-vaguili": "quartzite",
  "emerald-pearl": "unconfirmed",
  perlatus: "unconfirmed",
  "valle-nevada-luna-pearl": "unconfirmed",
  "amazonic-green": "unconfirmed",
  apollonis: "unconfirmed",
  artemis: "unconfirmed",
  "black-dunes": "unconfirmed",
  "fusion-blue": "unconfirmed",
  "grand-constantine": "unconfirmed",
  "mystic-spring": "unconfirmed",
  "new-caledonia": "unconfirmed",
  "porto-fino": "unconfirmed",
  "river-white": "unconfirmed",
  "steel-gray": "unconfirmed",
  "super-white": "unconfirmed",
  "toulon-white": "unconfirmed",
  "white-silk": "unconfirmed",
  versace: "unconfirmed",
};

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

const DISPLAY_NAME: Record<string, string> = {
  "aj-quartz": "AJ Quartz",
  "bianco-superiory": "Bianco Superiory",
  "calacatta-dor": "Calacatta D'Or",
  "cristal-2cm-united": "Cristal 2cm United",
  "giallo-ornamental": "Giallo Ornamental",
  "kolkata-vegi-marble": "Kolkata Vegi Marble",
  "matrix-basalt": "Matrix Basalt",
  "nilo-river": "Nilo River",
  "preto-sao-gabriel": "Preto Sao Gabriel",
  "soapstone": "Marina Black Soapstone",
  "titanium-black-leathered": "Titanium Black",
  "valle-nevada-luna-pearl": "Valle Nevada (Luna Pearl)",
};

function inventoryImageExtension(sourcePath: string, index: number): "webp" | "jpg" {
  // The first Honey Onyx image was optimized during the initial import. Five companion
  // photos in the same source folder had generic WhatsApp names and are preserved as JPEGs.
  return sourcePath === "onyx/honey-onyx" && index > 0 ? "jpg" : "webp";
}

function titleFromSlug(slug: string): string {
  return (
    DISPLAY_NAME[slug] ||
    slug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function materialStatus(slug: string, category: string): JwStoneMaterialStatus {
  if (USER_CONFIRMED.has(slug)) return "user_confirmed";
  if (FILENAME_CONFIRMED.has(slug)) return "filename";
  if (category === "unconfirmed") return "unconfirmed";
  return "source_folder";
}

const stones = ASSET_SPECS.split("\n").map((line): JwStoneInventoryStone & {
  categorySlug: string;
} => {
  const [sourcePath, imageCountText] = line.split("|");
  const [assetCategory, slug] = sourcePath.split("/");
  const categorySlug = TARGET_CATEGORY[slug] || assetCategory;
  const status = materialStatus(slug, categorySlug);
  const finishes = EXPLICIT_FINISHES[slug];
  return {
    categorySlug,
    name: titleFromSlug(slug),
    slug,
    images: Array.from(
      { length: Number(imageCountText) },
      (_, index) =>
        `/images/businesses/jw-stone/inventory/${sourcePath}/${index + 1}.${inventoryImageExtension(sourcePath, index)}`
    ),
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
