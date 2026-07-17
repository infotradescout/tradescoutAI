const PROFILE_PORTFOLIO_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_PROFILE_PORTFOLIO_SLUG_LENGTH = 120;
const MAX_SHARE_DESCRIPTION_LENGTH = 160;

type RawProfilePortfolioItem = {
  title?: unknown;
  description?: unknown;
  imageUrl?: unknown;
  completionDate?: unknown;
  skills?: unknown;
  fromPlatform?: unknown;
  taskId?: unknown;
};

export type ResolvedProfilePortfolioItem = {
  title: string;
  description: string;
  imageUrl: string;
  completionDate: string | null;
  skills: string[];
  fromPlatform: boolean;
  slug: string;
  index: number;
};

export type ProfilePortfolioItemShareMetadata = {
  itemType: "portfolio";
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

function stablePortfolioToken(value: string): string {
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

function portfolioItemFingerprint(item: RawProfilePortfolioItem): string {
  return [
    cleanString(item.title),
    cleanString(item.description),
    cleanString(item.imageUrl),
    cleanString(item.completionDate),
    cleanString(item.taskId),
  ].join("|");
}

function capForShare(value: string, limit: number): string {
  if (value.length <= limit) return value;
  if (limit <= 1) return "";
  return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function composeShareDescription(item: ResolvedProfilePortfolioItem, profileName: string): string {
  const lead = `View ${item.title} by ${profileName}.`;
  const protection = "Contact stays protected through TradeScout Direct Connect.";
  const availableDetailLength = Math.max(
    0,
    MAX_SHARE_DESCRIPTION_LENGTH - lead.length - protection.length - 2
  );
  const detail = capForShare(item.description, availableDetailLength);
  return [lead, detail, protection].filter(Boolean).join(" ");
}

export function normalizeProfilePortfolioItemSlug(value: unknown): string | null {
  const normalized = cleanString(Array.isArray(value) ? value[0] : value).toLowerCase();
  if (
    !normalized ||
    normalized.length > MAX_PROFILE_PORTFOLIO_SLUG_LENGTH ||
    !PROFILE_PORTFOLIO_SLUG_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function buildProfilePortfolioItemSlug(item: RawProfilePortfolioItem): string | null {
  const title = cleanString(item?.title);
  const imageUrl = normalizePublicImageReference(item?.imageUrl);
  const base = titleSlug(title);
  if (!base || !imageUrl) return null;
  return `${base}-${stablePortfolioToken(portfolioItemFingerprint(item))}`;
}

export function buildProfilePortfolioShareSearch(item: RawProfilePortfolioItem): string {
  const slug = buildProfilePortfolioItemSlug(item);
  if (!slug) return "";
  const params = new URLSearchParams();
  params.set("portfolio", slug);
  return `?${params.toString()}`;
}

export function resolveProfilePortfolioItem(
  items: unknown,
  itemSlugValue: unknown
): ResolvedProfilePortfolioItem | null {
  const requestedSlug = normalizeProfilePortfolioItemSlug(itemSlugValue);
  if (!requestedSlug || !Array.isArray(items)) return null;

  for (let index = 0; index < items.length; index += 1) {
    const rawItem = items[index] as RawProfilePortfolioItem;
    if (!rawItem || typeof rawItem !== "object") continue;
    const slug = buildProfilePortfolioItemSlug(rawItem);
    if (slug !== requestedSlug) continue;

    const title = cleanString(rawItem.title);
    const imageUrl = normalizePublicImageReference(rawItem.imageUrl);
    if (!title || !imageUrl) return null;

    return {
      title,
      description: cleanString(rawItem.description),
      imageUrl,
      completionDate: cleanString(rawItem.completionDate) || null,
      skills: Array.isArray(rawItem.skills)
        ? rawItem.skills.map(cleanString).filter(Boolean).slice(0, 12)
        : [],
      fromPlatform: rawItem.fromPlatform === true,
      slug,
      index,
    };
  }

  return null;
}

export function createProfilePortfolioItemShareMetadata(args: {
  profileName: string;
  profileUrl: string;
  assetOrigin: string;
  portfolioItems: unknown;
  itemSlug: unknown;
}): ProfilePortfolioItemShareMetadata | null {
  const profileName = cleanString(args.profileName);
  const item = resolveProfilePortfolioItem(args.portfolioItems, args.itemSlug);
  if (!profileName || !item) return null;

  try {
    const imageUrl = new URL(item.imageUrl, args.assetOrigin).toString();
    const canonicalUrl = new URL(args.profileUrl);
    const params = new URLSearchParams();
    params.set("portfolio", item.slug);
    canonicalUrl.search = `?${params.toString()}`;
    canonicalUrl.hash = "";

    return {
      itemType: "portfolio",
      itemTitle: item.title,
      itemSlug: item.slug,
      title: `${item.title} by ${profileName}`,
      description: composeShareDescription(item, profileName),
      imageUrl,
      imageAlt: `${item.title} — ${profileName} portfolio image`,
      canonical: canonicalUrl.toString(),
    };
  } catch {
    return null;
  }
}
