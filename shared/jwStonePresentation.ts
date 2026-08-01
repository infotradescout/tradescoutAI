export const JW_STONE_PROFILE_SLUG = "jw-stone";
export const JW_STONE_PROFILE_SOCIAL_LOGO_URL =
  "/images/businesses/jw-stone/logo-social.svg";

export type JwStoneInventoryNameStatus = "source" | "placeholder";

export type JwStoneInventoryNamePresentation = {
  displayName: string;
  nameStatus: JwStoneInventoryNameStatus;
};

/**
 * Material classification and product-name confidence are separate evidence.
 * A JW Stone item can belong in the unconfirmed material bucket while still
 * carrying a real source name. Only synthetic reconciliation groups are
 * intentionally presented as unnamed slabs.
 */
export function resolveJwStoneInventoryNamePresentation(stone: {
  name?: unknown;
  slug?: unknown;
}): JwStoneInventoryNamePresentation {
  const name = typeof stone.name === "string" ? stone.name.trim() : "";
  const slug = typeof stone.slug === "string" ? stone.slug.trim() : "";
  const placeholderMatch =
    slug.match(/^trending-selection-(\d+)$/i) || name.match(/^trending\s+selection\s+(\d+)$/i);

  if (placeholderMatch) {
    return {
      displayName: `Unnamed slab #${placeholderMatch[1]}`,
      nameStatus: "placeholder",
    };
  }

  return {
    displayName: name || "Unnamed slab",
    nameStatus: name ? "source" : "placeholder",
  };
}

export const JW_STONE_SOCIAL_PRESENTATION = {
  brandName: "JW Stone Logistics",
  logoUrl: "/images/businesses/jw-stone/logo.svg",
  profileImageUrl: "/images/businesses/jw-stone/video/hero-poster.jpg",
  accentColor: "#81904a",
  profileCta: "Explore inventory",
  inventoryCta: "View photos · Request pricing",
  galleryCta: "View project",
  cardLayout: "brand-hero",
} as const;
