/** Country confirmed directly by the operator on 2026-09-06 for these exact onyx offerings. */
export const IRANIAN_ONYX_ORIGIN = Object.freeze({
  country: "Iran",
  verified: true as const,
  source: "Operator country-of-origin confirmation, 2026-09-06",
});

export const JW_STONE_ONYX_ORIGINS = Object.freeze({
  "honey-onyx": IRANIAN_ONYX_ORIGIN,
});

export const ISSA_BUILD_ONYX_ORIGINS = Object.freeze({
  "honey-onyx": IRANIAN_ONYX_ORIGIN,
  "multi-green-onyx": IRANIAN_ONYX_ORIGIN,
});

/** One operator-confirmed pool, shared across both businesses and onyx colors. */
export const IRANIAN_ONYX_STOCK = Object.freeze({
  thicknessCm: 2,
  totalSquareFeet: 10_000,
  confirmedAt: "2026-09-06",
  specification: "Country of origin: Iran. Thickness: 2 cm.",
  headline: "Iranian onyx · 2 cm",
  stockLabel: "10,000 sq ft in shared stock",
  stockNote:
    "One shared total across onyx colors and storefronts. Confirmed September 6, 2026; ask for current slab selection.",
});
