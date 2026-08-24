export const JW_STONE_PROFILE_SLUG = "jw-stone";
export const JW_STONE_PROFILE_SOCIAL_LOGO_URL = "/images/businesses/jw-stone/logo-social.svg";
export const JW_STONE_YOUTUBE_URL = "https://www.youtube.com/@JWStoneLogistics";

/**
 * Customer calls and messages for the TradeScout-managed JW Stone profile use
 * this contact. The owner account remains separate from the public response
 * destination and its private email is never published by this contract.
 */
export const JW_STONE_MANAGED_CONTACT = {
  label: "TradeScout managed contact",
  heading: "JW Stone inquiries",
  phone: "(850) 543-0748",
  tel: "+18505430748",
  email: "contact@thetradescout.com",
  description: "Calls and messages from this profile are handled through TradeScout.",
} as const;

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

/**
 * Canonical public company identity for the standalone JW Stone storefront.
 * Keep this aligned with JW Stone's production profile record; the React page,
 * crawler HTML, and structured data all consume this one contract.
 */
export const JW_STONE_PUBLIC_IDENTITY = {
  brandName: "JW Stone Logistics",
  foundingDate: "2017",
  about:
    "Founded in 2017 by Jared and Wagner, JW Stone gives customers direct access to hand-selected natural stone, with one expert overseeing the journey from quarry selection through processing and delivery. Based in Pensacola, FL, JW Stone works with fabricators, builders, architects, designers and homeowners across the Gulf South and beyond.",
  founderStory:
    "JW Stone was born from a shared vision between two lifelong friends, Jared and Wagner, who embarked on an extraordinary journey in 2017. Their adventure began with a visit to Brazil, where they were inspired by Wagner’s aunt, Sonia Scar, a seasoned expert in the natural stone industry. Captivated by the beauty and potential of granite, Jared and Wagner decided to bring these exquisite materials to the United States. With Sonia’s guidance and Wagner’s logistical expertise, they established JW Stone in Pensacola, FL. Today, JW Stone stands as a testament to their dedication, offering a vast array of stunning stone slabs to builders, designers, and homeowners across the Gulf Coast.",
  address: {
    streetAddress: "2103 W Herman Ave",
    addressLocality: "Pensacola",
    addressRegion: "FL",
    postalCode: "32505",
    addressCountry: "US",
    formatted: "2103 W Herman Ave, Pensacola, FL 32505",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=2103%20W%20Herman%20Ave%2C%20Pensacola%2C%20FL%2032505",
  },
  socials: [
    {
      id: "instagram",
      label: "Instagram",
      publicHandle: "@jwstonellc",
      href: "https://www.instagram.com/jwstonellc/",
    },
    {
      id: "facebook",
      label: "Facebook",
      publicHandle: "JW Stone Logistics",
      href: "https://www.facebook.com/people/JW-Stone-Logistics/100094713955142/",
    },
    {
      id: "youtube",
      label: "YouTube",
      publicHandle: "@JWStoneLogistics",
      href: JW_STONE_YOUTUBE_URL,
    },
  ],
} as const;

export const JW_STONE_SOCIAL_PRESENTATION = {
  brandName: JW_STONE_PUBLIC_IDENTITY.brandName,
  logoUrl: "/images/businesses/jw-stone/logo.svg",
  profileImageUrl: "/images/businesses/jw-stone/video/hero-poster.jpg",
  accentColor: "#81904a",
  profileCta: "Explore materials",
  inventoryCta: "View material photos",
  galleryCta: "View project",
  cardLayout: "brand-hero",
} as const;
