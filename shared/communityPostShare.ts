const COMMUNITY_POST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const MAX_COMMUNITY_POST_ID_LENGTH = 128;
const MAX_SHARE_DESCRIPTION_LENGTH = 160;
const MAX_SHARE_TITLE_LENGTH = 90;
const MAX_PUBLIC_IMAGES = 8;

type CommunityPostShareInput = {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  imageUrls?: unknown;
};

export type CommunityPostShareMetadata = {
  postId: string;
  title: string;
  description: string;
  canonical: string;
  imageUrl: string | null;
  imageAlt: string;
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

function capText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  if (limit <= 1) return "";
  return `${normalized.slice(0, limit - 1).trimEnd()}…`;
}

export function normalizeCommunityPostId(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = cleanString(raw);
  if (
    !normalized ||
    normalized.length > MAX_COMMUNITY_POST_ID_LENGTH ||
    !COMMUNITY_POST_ID_PATTERN.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

export function listCommunityPostImageUrls(imageUrls: unknown): string[] {
  if (!Array.isArray(imageUrls)) return [];
  const images: string[] = [];
  for (const value of imageUrls) {
    const image = normalizePublicImageReference(value);
    if (!image || images.includes(image)) continue;
    images.push(image);
    if (images.length >= MAX_PUBLIC_IMAGES) break;
  }
  return images;
}

export function buildCommunityPostPath(postIdValue: unknown): string {
  const postId = normalizeCommunityPostId(postIdValue);
  return postId ? `/community/posts/${encodeURIComponent(postId)}` : "";
}

export function createCommunityPostShareMetadata(args: {
  post: CommunityPostShareInput;
  origin: string;
}): CommunityPostShareMetadata | null {
  const postId = normalizeCommunityPostId(args.post?.id);
  const path = buildCommunityPostPath(postId);
  if (!postId || !path) return null;

  try {
    const content = cleanString(args.post.content);
    const rawTitle = cleanString(args.post.title) || capText(content, 72) || "Community post";
    const title = capText(rawTitle, MAX_SHARE_TITLE_LENGTH);
    const protection = "Community actions stay local and protected on TradeScout.";
    const lead = capText(
      content || `Read ${title} on TradeScout.`,
      MAX_SHARE_DESCRIPTION_LENGTH - protection.length - 1
    );
    const imageReference = listCommunityPostImageUrls(args.post.imageUrls)[0] || null;
    const imageUrl = imageReference ? new URL(imageReference, args.origin).toString() : null;

    return {
      postId,
      title,
      description: `${lead} ${protection}`,
      canonical: new URL(path, args.origin).toString(),
      imageUrl,
      imageAlt: `${title} community post image`,
    };
  } catch {
    return null;
  }
}
