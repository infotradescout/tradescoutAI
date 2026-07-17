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
    role: string | null;
    verified: boolean;
    badges: string[];
  };
};

function authorName(author: User | null | undefined): string {
  if (!author) return "Community member";
  return `${author.firstName || ""} ${author.lastName || ""}`.trim() || "Community member";
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
      avatar: typeof author?.profileImageUrl === "string" ? author.profileImageUrl : null,
      role: typeof author?.role === "string" ? author.role : null,
      verified: author?.addressVerified === true,
      badges: Array.isArray((author as any)?.badges)
        ? (author as any).badges.filter(
            (badge: unknown): badge is string => typeof badge === "string"
          )
        : [],
    },
  };
}

/** Strip moderation internals and contact identity from feed-shaped responses. */
export function sanitizePublicCommunityFeedPost<T extends Record<string, any>>(post: T): T {
  if (!post || typeof post !== "object") return post;
  const { moderatorNotes, moderatedBy, moderatedAt, author, ...safePost } = post as any;
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
          avatar: author.avatar,
          profileImageUrl: author.profileImageUrl,
          role: author.role,
          verified: author.verified,
          isPrivateProfile: author.isPrivateProfile,
          badges: author.badges,
          cvsScore: author.cvsScore,
          verificationStatus: author.verificationStatus,
        }
      : author;

  return { ...safePost, author: safeAuthor } as T;
}
