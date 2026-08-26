import type { VerifiedOrigin } from "./types";

/** Exact commercial-name matches backed by a published stone supplier page. */
export const JW_STONE_VERIFIED_ORIGIN_BY_SLUG: Readonly<Record<string, VerifiedOrigin>> =
  Object.freeze({
    artemis: Object.freeze({
      country: "Brazil",
      verified: true,
      source: "https://www.arizonatile.com/products/slab/quartzite/artemis/",
    }),
    "calacatta-corchia": Object.freeze({
      country: "Italy",
      verified: true,
      source: "https://www.ssccountertops.com/calacatta-corchia",
    }),
    "calacatta-cremo": Object.freeze({
      country: "Italy",
      verified: true,
      source: "https://arcsurfaces.com/live-inventory/calacatta-cremo/19215/",
    }),
    "emerald-pearl": Object.freeze({
      country: "Norway",
      verified: true,
      source: "https://www.greatlakesgm.com/products/emerald-pearl-granite/",
    }),
    "new-caledonia": Object.freeze({
      country: "Brazil",
      verified: true,
      source: "https://www.arizonatile.com/products/slab/granite/new-caledonia/",
    }),
    "steel-gray": Object.freeze({
      country: "India",
      verified: true,
      source:
        "https://www.regattagranitesindia.com/steel-grey-granite-a-low-variation-durable-granite/",
    }),
  });
