import { buildProfilePublicItemUrl } from "./profilePublicItemRoute";

const PROFILE_GALLERY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_GALLERY_SLUG_LENGTH = 120;
const MAX_PROFILE_GALLERY_ITEMS = 60;
const MAX_SHARE_DESCRIPTION_LENGTH = 160;

type RawProfileContentBlock = {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  imageUrl?: unknown;
  data?: unknown;
};

type RawGalleryImage = {
  id?: unknown;
  url?: unknown;
  src?: unknown;
  imageUrl?: unknown;
  title?: unknown;
  name?: unknown;
  caption?: unknown;
  alt?: unknown;
  description?: unknown;
};

export type ResolvedProfileGalleryItem = {
  itemType: "gallery";
  title: string;
  /** A supplied image title/caption, rather than a generated section-label fallback. */
  hasPublicTitle: boolean;
  description: string;
  imageUrl: string;
  imageAlt: string;
  slug: string;
  blockIndex: number;
  imageIndex: number;
};

export type ProfileGalleryItemShareMetadata = {
  itemType: "gallery";
  itemTitle: string;
  itemSlug: string;
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  canonical: string;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePublicImageReference(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function stableGalleryToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
}

function titleSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const candidate = cleanString(value);
    if (candidate) return candidate;
  }
  return "";
}

function capForShare(value: string, limit: number): string {
  if (value.length <= limit) return value;
  if (limit <= 1) return "";
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function galleryImageValue(value: unknown): {
  imageUrl: string | null;
  title: string;
  description: string;
  id: string;
} {
  if (typeof value === "string") {
    return {
      imageUrl: normalizePublicImageReference(value),
      title: "",
      description: "",
      id: "",
    };
  }
  if (!value || typeof value !== "object") {
    return { imageUrl: null, title: "", description: "", id: "" };
  }

  const image = value as RawGalleryImage;
  return {
    imageUrl: normalizePublicImageReference(firstString(image.imageUrl, image.url, image.src)),
    title: firstString(image.title, image.name, image.caption, image.alt),
    description: firstString(image.description, image.caption),
    id: cleanString(image.id),
  };
}

export function normalizeProfileGalleryItemSlug(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = cleanString(raw).toLowerCase();
  if (
    !normalized ||
    normalized.length > MAX_PROFILE_GALLERY_SLUG_LENGTH ||
    !PROFILE_GALLERY_SLUG_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function listProfileGalleryItems(contentBlocks: unknown): ResolvedProfileGalleryItem[] {
  if (!Array.isArray(contentBlocks)) return [];

  const items: ResolvedProfileGalleryItem[] = [];
  for (let blockIndex = 0; blockIndex < contentBlocks.length; blockIndex += 1) {
    const block = contentBlocks[blockIndex] as RawProfileContentBlock;
    if (
      !block ||
      typeof block !== "object" ||
      cleanString(block.type).toLowerCase() !== "gallery"
    ) {
      continue;
    }

    const data =
      block.data && typeof block.data === "object" ? (block.data as Record<string, unknown>) : {};
    const blockTitle = firstString(data.title, block.title) || "Gallery";
    const blockDescription = firstString(data.description, data.body, data.text, block.body);
    const rawImages = Array.isArray(data.images)
      ? data.images
      : normalizePublicImageReference(block.imageUrl)
        ? [block.imageUrl]
        : [];

    for (let imageIndex = 0; imageIndex < rawImages.length; imageIndex += 1) {
      const image = galleryImageValue(rawImages[imageIndex]);
      if (!image.imageUrl) continue;

      const fallbackTitle =
        blockTitle.toLowerCase() === "gallery"
          ? `Gallery photo ${items.length + 1}`
          : `${blockTitle} photo ${imageIndex + 1}`;
      const title = image.title || fallbackTitle;
      const base = titleSlug(title) || "gallery-photo";
      const fingerprint = [image.imageUrl, title, cleanString(block.id), image.id].join("|");
      const candidateSlug = `${base}-${stableGalleryToken(fingerprint)}`;
      const slug = items.some((item) => item.slug === candidateSlug)
        ? `${base}-${stableGalleryToken(`${fingerprint}|${blockIndex}|${imageIndex}`)}`
        : candidateSlug;

      items.push({
        itemType: "gallery",
        title,
        hasPublicTitle: Boolean(image.title),
        description: image.description || blockDescription,
        imageUrl: image.imageUrl,
        imageAlt: firstString(
          typeof rawImages[imageIndex] === "object"
            ? (rawImages[imageIndex] as RawGalleryImage).alt
            : "",
          `${title} profile gallery image`
        ),
        slug,
        blockIndex,
        imageIndex,
      });

      if (items.length >= MAX_PROFILE_GALLERY_ITEMS) return items;
    }
  }

  return items;
}

export function resolveProfileGalleryItem(
  contentBlocks: unknown,
  itemSlugValue: unknown
): ResolvedProfileGalleryItem | null {
  const requestedSlug = normalizeProfileGalleryItemSlug(itemSlugValue);
  if (!requestedSlug) return null;
  return listProfileGalleryItems(contentBlocks).find((item) => item.slug === requestedSlug) || null;
}

export function buildProfileGalleryShareSearch(itemSlug: string): string {
  const slug = normalizeProfileGalleryItemSlug(itemSlug);
  if (!slug) return "";
  const params = new URLSearchParams();
  params.set("gallery", slug);
  return `?${params.toString()}`;
}

export function createProfileGalleryItemShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  contentBlocks: unknown;
  itemSlug: unknown;
}): ProfileGalleryItemShareMetadata | null {
  const profileName = cleanString(args.profileName);
  const item = resolveProfileGalleryItem(args.contentBlocks, args.itemSlug);
  if (!profileName || !item) return null;

  try {
    const imageUrl = new URL(item.imageUrl, args.assetOrigin).toString();
    const canonical = buildProfilePublicItemUrl({
      profileUrl: args.profileUrl,
      itemType: "gallery",
      itemSlug: item.slug,
      contentBlocks: args.contentBlocks,
    });
    if (!canonical) return null;

    const lead = capForShare(
      `View ${item.title} from ${profileName}.`,
      MAX_SHARE_DESCRIPTION_LENGTH
    );
    const detailBudget = Math.max(0, MAX_SHARE_DESCRIPTION_LENGTH - lead.length - 1);
    const detail = capForShare(item.description, detailBudget);

    return {
      itemType: "gallery",
      itemTitle: item.title,
      itemSlug: item.slug,
      title: `${item.title} | ${profileName}`,
      description: [lead, detail].filter(Boolean).join(" "),
      imageUrl,
      imageAlt: item.imageAlt,
      canonical,
    };
  } catch {
    return null;
  }
}
