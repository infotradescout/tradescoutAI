import type { CommunityPostCardAuthor, CommunityPostCardData } from "./CommunityPostCard";

type RawCommunityPost = Record<string, unknown>;

const isRecord = (value: unknown): value is RawCommunityPost =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const numberValue = (...values: unknown[]): number => {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

export function toCommunityPostCardData(
  raw: RawCommunityPost,
  options: { canonicalProfileUrl?: string } = {}
): CommunityPostCardData {
  const rawAuthor = isRecord(raw.author) ? raw.author : {};
  const category = stringValue(raw.category) || "general";
  const systemPost = category.toLowerCase() === "system";
  const authorName = systemPost
    ? "TradeScout"
    : stringValue(
        rawAuthor.name,
        [rawAuthor.firstName, rawAuthor.lastName].filter(Boolean).join(" "),
        rawAuthor.username
      ) || "Community member";

  const author: CommunityPostCardAuthor = {
    id: systemPost ? undefined : stringValue(rawAuthor.id),
    name: authorName,
    avatar: stringValue(rawAuthor.avatar, rawAuthor.profileImageUrl, rawAuthor.photoUrl),
    role: systemPost ? "Platform" : stringValue(rawAuthor.role),
    verified: systemPost
      ? true
      : typeof rawAuthor.verified === "boolean"
        ? rawAuthor.verified
        : undefined,
    cvsScore:
      typeof rawAuthor.cvsScore === "number" || typeof rawAuthor.cvsScore === "string"
        ? rawAuthor.cvsScore
        : null,
    verificationStatus: stringValue(rawAuthor.verificationStatus),
    badges: Array.isArray(rawAuthor.badges) ? rawAuthor.badges : undefined,
  };

  return {
    id: String(raw.id),
    title: stringValue(raw.title),
    content: String(raw.content || ""),
    author,
    category,
    postType: stringValue(raw.postType, raw.type),
    pinned: raw.pinned === true || raw.isPinned === true,
    trending: raw.trending === true,
    location: stringValue(raw.location, rawAuthor.location),
    county: stringValue(raw.county),
    state: stringValue(raw.state),
    audienceScope: ["neighborhood", "county", "area", "global"].includes(String(raw.audienceScope))
      ? (raw.audienceScope as CommunityPostCardData["audienceScope"])
      : undefined,
    distanceMiles:
      raw.distanceMiles === null || raw.distanceMiles === undefined
        ? undefined
        : numberValue(raw.distanceMiles),
    createdAt: stringValue(raw.createdAt, raw.timestamp) || new Date(0).toISOString(),
    upvotes: numberValue(raw.likeCount, raw.likes, raw.upvotes),
    comments: numberValue(raw.commentCount, raw.comments),
    shareCount: numberValue(raw.shareCount, raw.shares),
    liked: raw.liked === true,
    saved: raw.saved === true,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    imageUrls: Array.isArray(raw.imageUrls)
      ? raw.imageUrls.map(String).slice(0, 8)
      : Array.isArray(raw.images)
        ? raw.images.map(String).slice(0, 8)
        : [],
    hasWorkRequest: raw.hasWorkRequest === true,
    workRequestId: raw.workRequestId ? String(raw.workRequestId) : null,
    authorityLabel: stringValue(raw.authorityLabel),
    relatedBusinesses: Array.isArray(raw.relatedBusinesses)
      ? raw.relatedBusinesses.filter(isRecord).map((business) => ({
          id: String(business.id || ""),
          name: String(business.name || "Local business"),
          category: stringValue(business.category) || null,
          profileUrl: String(business.profileUrl || "#"),
        }))
      : undefined,
    canonicalProfileUrl: options.canonicalProfileUrl,
    systemPost,
  };
}
