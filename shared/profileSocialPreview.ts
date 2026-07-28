const CANONICAL_SOCIAL_PREVIEW_ORIGIN = "https://www.thetradescout.com";
const PROFILE_SOCIAL_PREVIEW_TEMPLATE_VERSION = "3";
const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type ProfileSocialPreviewItemType = "inventory" | "gallery";

type ProfileSocialPresentation = {
  publicBrandName?: string;
  logoUrl?: string;
  accentColor?: string;
  inventoryCta?: string;
};

const PROFILE_SOCIAL_PRESENTATIONS: Record<string, ProfileSocialPresentation> = {
  "jw-stone": {
    publicBrandName: "JW Stone Logistics",
    logoUrl: "/images/businesses/jw-stone/logo.svg",
    accentColor: "#81904a",
    inventoryCta: "View photos · Request pricing",
  },
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeSlug(value: unknown, pattern: RegExp, maxLength: number): string | null {
  const slug = cleanText(value, maxLength).toLowerCase();
  return slug && pattern.test(slug) ? slug : null;
}

function stableToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function normalizedCategory(value: unknown): string {
  const category = cleanText(value, 80);
  return /^(?:unconfirmed|material to confirm|trending(?: at .*)?)$/i.test(category)
    ? ""
    : category;
}

function socialPreviewOrigin(pageOrigin: string): string {
  try {
    const parsed = new URL(pageOrigin);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return parsed.origin;
  } catch {
    // Production cards use the canonical image host when pageOrigin is malformed.
  }
  return CANONICAL_SOCIAL_PREVIEW_ORIGIN;
}

export function resolveProfileSocialBrandName(profileSlug: unknown, fallbackName: unknown): string {
  const slug = normalizeSlug(profileSlug, PROFILE_SLUG_PATTERN, 120) || "";
  return (
    cleanText(PROFILE_SOCIAL_PRESENTATIONS[slug]?.publicBrandName, 100) ||
    cleanText(fallbackName, 100) ||
    "TradeScout profile"
  );
}

export function profileSocialPreviewLogoUrl(profileSlug: unknown): string | null {
  const slug = normalizeSlug(profileSlug, PROFILE_SLUG_PATTERN, 120) || "";
  return cleanText(PROFILE_SOCIAL_PRESENTATIONS[slug]?.logoUrl, 500) || null;
}

export function profileSocialPreviewAccentColor(
  profileSlug: unknown,
  fallbackColor?: unknown
): string {
  const slug = normalizeSlug(profileSlug, PROFILE_SLUG_PATTERN, 120) || "";
  const preferred = cleanText(PROFILE_SOCIAL_PRESENTATIONS[slug]?.accentColor, 16);
  const fallback = cleanText(fallbackColor, 16);
  if (/^#[0-9a-f]{6}$/i.test(preferred)) return preferred;
  if (/^#[0-9a-f]{6}$/i.test(fallback)) return fallback;
  return "#f97316";
}

export function profileSocialPreviewCta(
  profileSlug: unknown,
  itemType?: ProfileSocialPreviewItemType | null
): string {
  const slug = normalizeSlug(profileSlug, PROFILE_SLUG_PATTERN, 120) || "";
  if (itemType === "inventory") {
    return (
      cleanText(PROFILE_SOCIAL_PRESENTATIONS[slug]?.inventoryCta, 48) ||
      "View item · Request details"
    );
  }
  if (itemType === "gallery") return "View work · Direct Connect";
  return "View profile · Direct Connect";
}

export function buildProfileSocialTitle(args: {
  profileSlug: unknown;
  fallbackBrandName: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  itemName?: unknown;
  category?: unknown;
}): string {
  const brandName = resolveProfileSocialBrandName(args.profileSlug, args.fallbackBrandName);
  const itemName = cleanText(args.itemName, 100);
  if (!itemName) return brandName;

  const category = args.itemType === "inventory" ? normalizedCategory(args.category) : "";
  const itemLabel = [itemName, category].filter(Boolean).join(" ");
  return `${itemLabel} | ${brandName}`.slice(0, 160);
}

export function buildProfileSocialDescription(args: {
  profileSlug: unknown;
  fallbackBrandName: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  itemName?: unknown;
  category?: unknown;
  fallbackDescription?: unknown;
}): string {
  const brandName = resolveProfileSocialBrandName(args.profileSlug, args.fallbackBrandName);
  const itemName = cleanText(args.itemName, 100);
  const category = args.itemType === "inventory" ? normalizedCategory(args.category) : "";

  if (itemName && args.itemType === "inventory") {
    const subject = [itemName, category].filter(Boolean).join(" ");
    return cleanText(
      `View ${subject} photos and request current pricing or availability from ${brandName} through TradeScout Direct Connect.`,
      160
    );
  }
  if (itemName && args.itemType === "gallery") {
    return cleanText(
      `View ${itemName} from ${brandName}, then send a private request through TradeScout Direct Connect.`,
      160
    );
  }
  return cleanText(args.fallbackDescription, 160);
}

export function buildProfileSocialPreviewImageUrl(args: {
  pageOrigin: string;
  profileSlug: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  itemSlug?: unknown;
  photo?: unknown;
  versionSeed?: unknown;
}): string | null {
  const profileSlug = normalizeSlug(args.profileSlug, PROFILE_SLUG_PATTERN, 120);
  if (!profileSlug) return null;

  const itemSlug = normalizeSlug(args.itemSlug, ITEM_SLUG_PATTERN, 120);
  const itemType = itemSlug ? args.itemType : null;
  const encodedProfileSlug = encodeURIComponent(profileSlug);
  const encodedItemSlug = itemSlug ? encodeURIComponent(itemSlug) : "";
  const path =
    itemType === "inventory"
      ? `/images/social/profile/${encodedProfileSlug}/inventory/${encodedItemSlug}.png`
      : itemType === "gallery"
        ? `/images/social/profile/${encodedProfileSlug}/gallery/${encodedItemSlug}.png`
        : `/images/social/profile/${encodedProfileSlug}.png`;

  const url = new URL(path, socialPreviewOrigin(args.pageOrigin));
  const photoValue = Array.isArray(args.photo) ? args.photo[0] : args.photo;
  const photo = String(photoValue || "").trim();
  if (itemType === "inventory" && /^\d+$/.test(photo)) {
    const oneBasedPhoto = Number.parseInt(photo, 10);
    if (oneBasedPhoto >= 1 && oneBasedPhoto <= 100) {
      url.searchParams.set("photo", String(oneBasedPhoto));
    }
  }

  const versionSeed = [
    PROFILE_SOCIAL_PREVIEW_TEMPLATE_VERSION,
    profileSlug,
    itemType || "profile",
    itemSlug || "",
    photo || "",
    cleanText(args.versionSeed, 1000),
  ].join("|");
  url.searchParams.set(
    "v",
    `${PROFILE_SOCIAL_PREVIEW_TEMPLATE_VERSION}-${stableToken(versionSeed)}`
  );
  return url.toString();
}
