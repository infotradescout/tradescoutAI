import { describe, expect, it } from "vitest";
import { sanitizePublicCommunityFeedPost, toPublicCommunityPost } from "../publicCommunityPost";

const post = {
  id: "post-123",
  authorId: "author-1",
  title: "Local update",
  content: "A public community update.",
  imageUrls: ["/uploads/community/update.jpg", "javascript:alert(1)"],
  attachmentUrls: ["/private/evidence.pdf"],
  scope: "county",
  stateCode: "TN",
  countyFips: "47065",
  cityName: "Chattanooga",
  regionName: null,
  category: "general",
  tags: ["local"],
  viewCount: 10,
  likeCount: 3,
  commentCount: 2,
  shareCount: 1,
  isPublished: true,
  isPinned: false,
  isHidden: false,
  moderatorNotes: "private moderation context",
  moderatedBy: "private-admin-id",
  moderatedAt: new Date("2026-07-01T00:00:00Z"),
  createdAt: new Date("2026-07-01T00:00:00Z"),
  updatedAt: new Date("2026-07-02T00:00:00Z"),
} as any;

const author = {
  id: "author-1",
  firstName: "Taylor",
  lastName: "Neighbor",
  email: "private@example.com",
  phone: "555-0100",
  profileImageUrl: "/uploads/profiles/taylor.webp",
  role: "homeowner",
  addressVerified: true,
  badges: ["Helpful Neighbor"],
} as any;

describe("public community post boundary", () => {
  it("returns only published, visible post and safe author fields", () => {
    const result = toPublicCommunityPost(post, author);

    expect(result).toMatchObject({
      id: "post-123",
      title: "Local update",
      imageUrls: ["/uploads/community/update.jpg"],
      author: {
        id: "author-1",
        name: "Taylor Neighbor",
        avatar: "/uploads/profiles/taylor.webp",
        verified: true,
      },
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("555-0100");
    expect(JSON.stringify(result)).not.toContain("private moderation context");
    expect(JSON.stringify(result)).not.toContain("private-admin-id");
    expect(JSON.stringify(result)).not.toContain("/private/evidence.pdf");
  });

  it("rejects hidden and unpublished posts", () => {
    expect(toPublicCommunityPost({ ...post, isHidden: true }, author)).toBeNull();
    expect(toPublicCommunityPost({ ...post, isPublished: false }, author)).toBeNull();
  });

  it("strips moderation and author contact fields from feed-shaped rows", () => {
    const result = sanitizePublicCommunityFeedPost({
      ...post,
      author: {
        id: "author-1",
        name: "Taylor Neighbor",
        avatar: "/uploads/profiles/taylor.webp",
        email: "private@example.com",
        phone: "555-0100",
        role: "homeowner",
        verified: true,
      },
    });

    expect(result).not.toHaveProperty("moderatorNotes");
    expect(result).not.toHaveProperty("moderatedBy");
    expect(result).not.toHaveProperty("moderatedAt");
    expect(result.author).not.toHaveProperty("email");
    expect(result.author).not.toHaveProperty("phone");
  });
});
