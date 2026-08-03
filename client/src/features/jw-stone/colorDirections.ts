import { COLOR_DIRECTION_IDS, type ColorDirection, type ColorDirectionId } from "./types";

/**
 * Editorial visual navigation derived from the supplied slab photography.
 * These labels are not geological, origin, suitability, or material claims.
 */
export const COLOR_DIRECTIONS = [
  {
    id: "soft-light",
    label: "Soft & Light",
    description: "Airy whites, creams, and pale movement.",
  },
  {
    id: "warm-earthy",
    label: "Warm & Earthy",
    description: "Sand, gold, taupe, and grounded warmth.",
  },
  {
    id: "cool-serene",
    label: "Cool & Serene",
    description: "Blue, silver, and crisp gray direction.",
  },
  {
    id: "deep-dramatic",
    label: "Deep & Dramatic",
    description: "Charcoal, black, and espresso depth.",
  },
  {
    id: "bold-expressive",
    label: "Bold & Expressive",
    description: "High contrast, vivid color, and energetic movement.",
  },
] as const satisfies readonly ColorDirection[];

export const JW_STONE_SLUGS_BY_COLOR_DIRECTION = {
  "soft-light": [
    "avalanche",
    "dallas-white",
    "galaxy-white",
    "white-ice",
    "white-persa",
    "white-springs",
    "alabama-white",
    "aspen-white",
    "carrara-white-brazil",
    "cherokee-marble",
    "matarazzo",
    "mugla",
    "pinta-verde",
    "white-fantasy",
    "zucci-marble",
    "aj-quartz",
    "calacatta-dor",
    "calacatta-fumo",
    "sparkling-white",
    "bianco-superiory",
    "calacatta-amala",
    "casa-blanca",
    "cristal-2cm-united",
    "gabanna",
    "mont-blanc",
    "white-santorini",
    "calacatta",
    "calacatta-cremo",
    "calacatta-vaguili",
    "ceara-white",
    "kolkata-vegi-marble",
    "montana-bianco",
    "namib-bianco-select",
    "namib-fantasy",
    "perlatus",
    "porto-fino",
    "rhino-white",
    "river-white",
    "super-white",
    "toulon-white",
    "trending-selection-03",
    "trending-selection-07",
    "trending-selection-10",
    "valle-nevada-luna-pearl",
    "versace",
  ],
  "warm-earthy": [
    "arizona-gold",
    "giallo-ornamental",
    "jaguar-leather",
    "nilo-river",
    "tyfoon",
    "emperor-brown",
    "fantasy-brown",
    "palassandro",
    "calacatta-gold",
    "bronzonite",
    "cristallo",
    "fusion-brown",
    "fusion-yellow",
    "taj-mahal",
    "calacatta-macchia-vecchia",
    "gold-macaubas",
    "new-caledonia",
    "trending-selection-01",
    "trending-selection-02",
  ],
  "cool-serene": [
    "matrix-basalt",
    "blue-bahia",
    "blue-dunes",
    "blue-fantasy",
    "blue-flower",
    "viscount-white",
    "cristalita-blue",
    "grigio-fantasy",
    "itaoca",
    "mexican-brown",
    "namib-carrera",
    "oyster-white",
    "shadow-storm",
    "silver-shadow",
    "atlantic",
    "beverly-blue",
    "blue-mare",
    "frost",
    "macaubas-fantasy",
    "artemis",
    "beverly-blue-antigo",
    "bianco-palomino",
    "mystic-spring",
    "steel-gray",
    "trending-selection-04",
    "trending-selection-06",
    "trending-selection-08",
    "trending-selection-09",
    "white-silk",
    "calacatta-andromeda",
    "apollonis",
  ],
  "deep-dramatic": [
    "black-pearl",
    "fantasy-black",
    "preto-sao-gabriel",
    "titanium",
    "venta-black",
    "soapstone",
    "black-dunes",
    "chocolate-brown",
    "emerald-pearl",
    "titanium-black-leathered",
    "dueto",
  ],
  "bold-expressive": [
    "alabama-rose",
    "honey-onyx",
    "picasso",
    "blue-goias",
    "juparana-blue",
    "panda",
    "blue-deep",
    "blue-dream",
    "marbella-green",
    "amazonic-green",
    "calacatta-corchia",
    "grand-constantine",
    "trending-selection-05",
  ],
} as const satisfies Readonly<Record<ColorDirectionId, readonly string[]>>;

function buildColorMap(): Readonly<Record<string, ColorDirectionId>> {
  const entries: Array<readonly [string, ColorDirectionId]> = [];
  const seen = new Set<string>();

  for (const direction of COLOR_DIRECTION_IDS) {
    for (const slug of JW_STONE_SLUGS_BY_COLOR_DIRECTION[direction]) {
      if (seen.has(slug)) {
        throw new Error(`JW Stone color classification repeats canonical slug: ${slug}`);
      }
      seen.add(slug);
      entries.push([slug, direction]);
    }
  }

  return Object.freeze(Object.fromEntries(entries));
}

export const JW_STONE_COLOR_BY_SLUG = buildColorMap();

export function isColorDirectionId(value: unknown): value is ColorDirectionId {
  return typeof value === "string" && (COLOR_DIRECTION_IDS as readonly string[]).includes(value);
}

export function getColorDirectionForStone(slug: string): ColorDirectionId | null {
  return JW_STONE_COLOR_BY_SLUG[slug] ?? null;
}
