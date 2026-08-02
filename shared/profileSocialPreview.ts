import { sanitizePublicDiscoveryText } from "./publicListingSafety";

const CANONICAL_SOCIAL_PREVIEW_ORIGIN = "https://www.thetradescout.com";
const PROFILE_SOCIAL_PREVIEW_TEMPLATE_VERSION = "4";
const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ITEM_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIRECT_CONTACT_CTA_PATTERN =
  /\b(?:call|phone|email|e-mail|text|sms|whats\s*app|visit (?:our )?website)\b/i;

export type ProfileSocialPreviewItemType = "inventory" | "gallery" | "category";

export type ResolvedProfileSocialPresentation = {
  brandName: string;
  logoUrl: string | null;
  profileImageUrl: string | null;
  accentColor: string;
  ctaLabel: string;
  cardLayout: "split" | "brand-hero";
};

export type ProfileSocialPresentationConfig = {
  brandName?: unknown;
  logoUrl?: unknown;
  profileImageUrl?: unknown;
  accentColor?: unknown;
  profileCta?: unknown;
  inventoryCta?: unknown;
  galleryCta?: unknown;
  categoryCta?: unknown;
  cardLayout?: unknown;
};

type ProfilePresentationBlock = {
  type?: unknown;
  data?: unknown;
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanPublicText(value: unknown, maxLength: number): string {
  return cleanText(sanitizePublicDiscoveryText(value, maxLength), maxLength);
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
  const category = cleanPublicText(value, 80);
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

function normalizeSocialAssetUrl(value: unknown): string | null {
  const candidate = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 2048);
  if (!candidate || /[\r\n\\\0]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function fallbackCta(itemType?: ProfileSocialPreviewItemType | null): string {
  if (itemType === "inventory") return "View item · Direct Connect";
  if (itemType === "gallery") return "View work · Direct Connect";
  if (itemType === "category") return "Browse collection · Direct Connect";
  return "View profile · Direct Connect";
}

function configuredCtaLabel(value: unknown): string {
  const raw = cleanText(value, 80);
  if (!raw) return "";
  const sanitized = cleanPublicText(raw, 80);
  if (
    !sanitized ||
    sanitized !== raw ||
    sanitized.includes("Continue through TradeScout") ||
    DIRECT_CONTACT_CTA_PATTERN.test(sanitized)
  ) {
    return "";
  }
  return sanitized.slice(0, 48);
}

export function readProfileSocialPresentationConfig(
  contentBlocks: unknown
): ProfileSocialPresentationConfig {
  if (!Array.isArray(contentBlocks)) return {};
  const presentationBlock = (contentBlocks as ProfilePresentationBlock[]).find(
    (block) => cleanText(block?.type, 64) === "profilePresentation"
  );
  if (
    !presentationBlock?.data ||
    typeof presentationBlock.data !== "object" ||
    Array.isArray(presentationBlock.data)
  ) {
    return {};
  }
  const social = (presentationBlock.data as Record<string, unknown>).social;
  return social && typeof social === "object" && !Array.isArray(social)
    ? (social as ProfileSocialPresentationConfig)
    : {};
}

export function resolveProfileSocialPresentation(args: {
  brandName: unknown;
  fallbackBrandName?: unknown;
  logoUrl?: unknown;
  profileImageUrl?: unknown;
  accentColor?: unknown;
  configuredCtaLabel?: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  contentBlocks?: unknown;
  defaultConfig?: ProfileSocialPresentationConfig;
}): ResolvedProfileSocialPresentation {
  const owned = readProfileSocialPresentationConfig(args.contentBlocks);
  const defaults = args.defaultConfig || {};
  const accentColor = cleanText(owned.accentColor || defaults.accentColor || args.accentColor, 16);
  const ownedCta =
    args.itemType === "inventory"
      ? owned.inventoryCta || owned.profileCta
      : args.itemType === "gallery"
        ? owned.galleryCta || owned.profileCta
        : args.itemType === "category"
          ? owned.categoryCta || owned.inventoryCta || owned.profileCta
          : owned.profileCta;
  const defaultCta =
    args.itemType === "inventory"
      ? defaults.inventoryCta || defaults.profileCta
      : args.itemType === "gallery"
        ? defaults.galleryCta || defaults.profileCta
        : args.itemType === "category"
          ? defaults.categoryCta || defaults.inventoryCta || defaults.profileCta
          : defaults.profileCta;
  const requestedLayout = cleanText(owned.cardLayout || defaults.cardLayout, 32);
  return {
    brandName:
      cleanPublicText(owned.brandName, 100) ||
      cleanPublicText(defaults.brandName, 100) ||
      cleanPublicText(args.brandName, 100) ||
      cleanPublicText(args.fallbackBrandName, 100) ||
      "TradeScout profile",
    logoUrl:
      normalizeSocialAssetUrl(owned.logoUrl) ||
      normalizeSocialAssetUrl(defaults.logoUrl) ||
      normalizeSocialAssetUrl(args.logoUrl),
    profileImageUrl:
      normalizeSocialAssetUrl(owned.profileImageUrl) ||
      normalizeSocialAssetUrl(defaults.profileImageUrl) ||
      normalizeSocialAssetUrl(args.profileImageUrl),
    accentColor: /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#f97316",
    ctaLabel:
      configuredCtaLabel(ownedCta) ||
      configuredCtaLabel(defaultCta) ||
      configuredCtaLabel(args.configuredCtaLabel) ||
      fallbackCta(args.itemType),
    cardLayout: requestedLayout === "brand-hero" ? "brand-hero" : "split",
  };
}

export function buildProfileSocialTitle(args: {
  brandName: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  itemName?: unknown;
  category?: unknown;
}): string {
  const brandName = cleanPublicText(args.brandName, 100) || "TradeScout profile";
  const itemName = cleanPublicText(args.itemName, 100);
  if (!itemName) return brandName;

  const category = args.itemType === "inventory" ? normalizedCategory(args.category) : "";
  const itemLabel = [itemName, category].filter(Boolean).join(" ");
  return `${itemLabel} | ${brandName}`.slice(0, 160);
}

export function buildProfileSocialDescription(args: {
  brandName: unknown;
  itemType?: ProfileSocialPreviewItemType | null;
  itemName?: unknown;
  category?: unknown;
  fallbackDescription?: unknown;
}): string {
  const brandName = cleanPublicText(args.brandName, 100) || "TradeScout profile";
  const itemName = cleanPublicText(args.itemName, 100);
  const category = args.itemType === "inventory" ? normalizedCategory(args.category) : "";

  if (itemName && args.itemType === "inventory") {
    const subject = [itemName, category].filter(Boolean).join(" ");
    return cleanText(
      `View ${subject} photos and request current pricing or availability from ${brandName} through TradeScout Direct Connect.`,
      160
    );
  }
  if (itemName && args.itemType === "gallery") {
    return cleanText(`View ${itemName} from ${brandName}.`, 160);
  }
  if (itemName && args.itemType === "category") {
    return cleanText(
      `Browse current ${itemName} selections from ${brandName}, then request pricing or availability through TradeScout Direct Connect.`,
      160
    );
  }
  return cleanPublicText(args.fallbackDescription, 160);
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
        : itemType === "category"
          ? `/images/social/profile/${encodedProfileSlug}/category/${encodedItemSlug}.png`
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
