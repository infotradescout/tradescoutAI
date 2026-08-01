export const JW_STONE_PROFILE_SLUG = "jw-stone";
export const JW_STONE_PROFILE_SOCIAL_LOGO_URL = "/images/businesses/jw-stone/logo-social.svg";

export type JwStoneInventoryNameStatus = "source" | "placeholder";

export type JwStoneInventoryNamePresentation = {
  displayName: string | null;
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
  const hasSyntheticIdentity =
    /^trending-selection-\d+$/i.test(slug) ||
    /^trending\s+selection\s+\d+$/i.test(name) ||
    /^unnamed\s+slab(?:\s*#\d+)?$/i.test(name);

  if (hasSyntheticIdentity) {
    return {
      displayName: null,
      nameStatus: "placeholder",
    };
  }

  return {
    displayName: name || null,
    nameStatus: name ? "source" : "placeholder",
  };
}

export function resolveJwStonePublicRequestName(args: {
  profileSlug?: unknown;
  itemId?: unknown;
  stoneName?: unknown;
}): string | null {
  const stoneName = typeof args.stoneName === "string" ? args.stoneName.trim() : "";
  if (
    String(args.profileSlug || "")
      .trim()
      .toLowerCase() !== JW_STONE_PROFILE_SLUG
  ) {
    return stoneName || null;
  }

  const presentation = resolveJwStoneInventoryNamePresentation({
    name: stoneName,
    slug: args.itemId,
  });
  return presentation.nameStatus === "source" ? presentation.displayName : null;
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
