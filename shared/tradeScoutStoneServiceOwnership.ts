/**
 * Commercial ownership boundary for the JW Stone supplier integration.
 *
 * JW Stone owns its supplier profile, inventory/pricing data and private
 * fabricator-discount access. TradeScout owns the optional tools that operate
 * across/above supplier profiles. JW Stone may link into those tools without
 * transferring ownership of the tool itself.
 */
export const JW_STONE_OWNED_CAPABILITIES = Object.freeze([
  "public_profile",
  "inventory_catalog",
  "supplier_pricing",
  "fabricator_discount_access",
] as const);

export const TRADESCOUT_OWNED_STONE_SERVICES = Object.freeze([
  "stonebid",
  "project_planners",
  "room_visualizer",
  "bundle_builder",
  "make_an_offer",
  "exchange_retail",
  "advanced_checkout",
] as const);

export const JW_STONE_TRADESCOUT_INTEGRATION = Object.freeze({
  supplierSlug: "jw-stone",
  supplierOwnsCoreProfile: true,
  supplierOwnsPricingData: true,
  supplierOwnsFabricatorDiscount: true,
  tradeScoutOwnsExtendedTools: true,
  integrationMode: "linked_supplier_adapter",
} as const);
