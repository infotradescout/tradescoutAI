/**
 * Released JW Stone item identifiers that must keep resolving to the same
 * photographed stone after the source inventory was split into cleaner names.
 */
export const JW_STONE_LEGACY_ITEM_ALIASES = Object.freeze({
  soapstone: "marina-black-soapstone",
  "carrara-white-brazil": "bianco-carrara",
} as const);

export function resolveJwStoneLegacyItemSlug(value: string): string {
  const normalized = value.trim().toLowerCase();
  return JW_STONE_LEGACY_ITEM_ALIASES[
    normalized as keyof typeof JW_STONE_LEGACY_ITEM_ALIASES
  ] ?? normalized;
}
