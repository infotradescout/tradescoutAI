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
