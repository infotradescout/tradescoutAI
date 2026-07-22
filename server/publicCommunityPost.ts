import { listCommunityPostImageUrls } from "@shared/communityPostShare";
import type { CommunityPost, User } from "@shared/schema";

export type PublicCommunityPost = {
  id: string;
  title: string | null;
  content: string;
  imageUrls: string[];
  scope: CommunityPost["scope"];
  stateCode: string | null;
  countyFips: string | null;
  cityName: string | null;
  regionName: string | null;
  category: CommunityPost["category"];
  tags: string[];
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isPinned: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
  author: {
    id: string;
    name: string;
    avatar: string | null;
    verified?: true;
  };
};

export function isAutomaticCommunityWelcomePost(post: Record<string, any>): boolean {
  const category = String(post?.category ?? "")
    .trim()
    .toLowerCase();
  const title = String(post?.title ?? "").trim();
  const content = String(post?.content ?? "")
    .trim()
    .toLowerCase();
  const tags = Array.isArray(post?.tags)
    ? post.tags.map((tag: unknown) => String(tag).trim().toLowerCase())
    : [];

  return (
    category === "announcements" &&
    /^welcome\s+\S+/i.test(title) &&
    (tags.includes("new_neighbor") ||
      tags.includes("welcome") ||
      (content.startsWith("say hello to ") &&
        content.includes("share helpful tips, local recommendations, or groups worth following")))
  );
}

export function normalizeAutomaticCommunityWelcomePost<T extends Record<string, any>>(
  post: T,
  automaticWelcome: boolean = isAutomaticCommunityWelcomePost(post)
): T {
  if (!automaticWelcome) return post;

  const welcomeName = /^welcome\s+(.+)$/i.exec(String(post?.title || "").trim())?.[1];
  const welcomeArea =
    typeof post?.county === "string" && post.county.trim()
      ? `${post.county.trim().replace(/\s+(county|parish|borough|census area|municipality)$/i, "")}${post?.state ? `, ${post.state}` : ""}`
      : typeof post?.countyName === "string" && post.countyName.trim()
        ? `${post.countyName.trim().replace(/\s+(county|parish|borough|census area|municipality)$/i, "")}${post?.stateCode ? `, ${post.stateCode}` : ""}`
        : null;

  return {
    ...post,
    content: `${welcomeName || "A new neighbor"} recently joined${welcomeArea ? ` near ${welcomeArea}` : " TradeScout"}. Say hello and help them get started.`,
    tags: ["new_neighbor"],
    feedKind: "onboarding_welcome",
  };
}

/**
 * Global browse is TradeScout's public window, not an archive of every test,
 * stale event, or internal operating note. This is response-only: county
 * members still retain their posts and local conversations unchanged.
 */
export function isUsefulPublicCommunityBrowsePost(
  post: Record<string, any>,
  now: Date = new Date()
): boolean {
  if (isAutomaticCommunityWelcomePost(post)) return true;

  const title = String(post?.title || "").trim();
  const content = String(post?.content || "").trim();
  const text = `${title} ${content}`.trim();
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const category = String(post?.category || "general")
    .trim()
    .toLowerCase();
  const authorName = String(post?.author?.name || "")
    .trim()
    .toLowerCase();

  // Other product brands and internal launch notes are never Community filler.
  if (/\b(meal\s*scout|trader'?s corner)\b/i.test(normalized)) return false;
  if (/\b(playwright|e2e|test user|qa bot)\b/i.test(authorName)) return false;
  if (
    /\b(submit button|who can see this|how does this community work|bugs? and formatting|first day live)\b/i.test(
      normalized
    )
  ) {
    return false;
  }
  if (/\b(capital\s*\/\s*strategy|seller process|acquisition-style offer)\b/i.test(normalized)) {
    return false;
  }
  if (category === "general" && /\b(giveaway|giving away)\b/i.test(normalized)) return false;

  // Expired event recaps should not occupy today's public activity window.
  if (
    (category === "event" ||
      /signature events|farmers markets|live music events/i.test(normalized)) &&
    post?.createdAt
  ) {
    const createdAt = new Date(post.createdAt);
    if (!Number.isNaN(createdAt.getTime())) {
      const ageMs = now.getTime() - createdAt.getTime();
      if (ageMs > 45 * 24 * 60 * 60 * 1000) return false;
    }
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (normalized.length < 24 || wordCount < 5) return false;

  return true;
}

function authorName(author: User | null | undefined): string {
  if (!author) return "Community member";
  return `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Community member";
}

function publicProfilePhoto(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  try {
    const pathname = new URL(candidate, "https://www.thetradescout.com").pathname.toLowerCase();
    if (
      pathname === "/tradescout-social-preview.png" ||
      pathname === "/tradescout-logo.png" ||
      pathname === "/tradescout-logo.jpg" ||
      pathname === "/tradescout-brand.png" ||
      pathname === "/logo.png"
    ) {
      return null;
    }
  } catch {
    // Preserve valid relative object-storage identifiers.
  }
  return candidate;
}

export function toPublicCommunityPost(
  post: CommunityPost | null | undefined,
  author: User | null | undefined
): PublicCommunityPost | null {
  if (!post || post.isPublished !== true || post.isHidden === true) return null;

  return {
    id: post.id,
    title: post.title,
    content: post.content,
    imageUrls: listCommunityPostImageUrls(post.imageUrls),
    scope: post.scope,
    stateCode: post.stateCode,
    countyFips: post.countyFips,
    cityName: post.cityName,
    regionName: post.regionName,
    category: post.category,
    tags: Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => Boolean(tag)) : [],
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
    shareCount: Number(post.shareCount || 0),
    isPinned: post.isPinned === true,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: {
      id: post.authorId,
      name: authorName(author),
      avatar: publicProfilePhoto(author?.profileImageUrl),
      ...(author?.addressVerified === true ? { verified: true as const } : {}),
    },
  };
}

/** Strip moderation internals and contact identity from feed-shaped responses. */
export function sanitizePublicCommunityFeedPost<T extends Record<string, any>>(post: T): T {
  if (!post || typeof post !== "object") return post;
  const { moderatorNotes, moderatedBy, moderatedAt, author, location, ...safePost } = post as any;
  void moderatorNotes;
  void moderatedBy;
  void moderatedAt;

  const safeAuthor =
    author && typeof author === "object"
      ? {
          id: author.id,
          name: author.name,
          firstName: author.firstName,
          lastName: author.lastName,
          avatar: publicProfilePhoto(author.avatar),
          profileImageUrl: publicProfilePhoto(author.profileImageUrl),
          isPrivateProfile: author.isPrivateProfile,
          ...(author.verified === true ? { verified: true } : {}),
        }
      : author;

  const displayLocation =
    typeof location === "string" && !/^\d{5}$/.test(location.trim()) ? location : undefined;

  return {
    ...safePost,
    ...(displayLocation ? { location: displayLocation } : {}),
    author: safeAuthor,
  } as T;
}
