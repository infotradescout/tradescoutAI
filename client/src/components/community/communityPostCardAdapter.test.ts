import { describe, expect, it } from "vitest";
import { toCommunityPostCardData } from "./communityPostCardAdapter";

describe("community post card adapter", () => {
  it("normalizes routed feed aliases into the canonical card record", () => {
    const post = toCommunityPostCardData(
      {
        id: "post-1",
        title: "Need a roofer",
        content: "Who has done good work nearby?",
        type: "recommendation_request",
        category: "questions",
        timestamp: "2026-07-13T12:00:00.000Z",
        likeCount: 7,
        commentCount: 4,
        shareCount: 2,
        liked: true,
        saved: true,
        author: {
          id: "user-1",
          firstName: "Jordan",
          lastName: "Lee",
          profileImageUrl: "/avatar.jpg",
          verified: true,
        },
        tags: ["Roof Repair"],
        imageUrls: Array.from({ length: 10 }, (_, index) => `/image-${index}.jpg`),
      },
      { canonicalProfileUrl: "/business/jordan-roofing" }
    );

    expect(post).toMatchObject({
      id: "post-1",
      postType: "recommendation_request",
      upvotes: 7,
      comments: 4,
      shareCount: 2,
      liked: true,
      saved: true,
      canonicalProfileUrl: "/business/jordan-roofing",
      author: {
        id: "user-1",
        name: "Jordan Lee",
        avatar: "/avatar.jpg",
        verified: true,
      },
    });
    expect(post.imageUrls).toHaveLength(8);
  });

  it("presents system posts as TradeScout without a member contact target", () => {
    const post = toCommunityPostCardData({
      id: "system-1",
      content: "County services are back online.",
      category: "system",
      createdAt: "2026-07-13T12:00:00.000Z",
      author: { id: "internal-user", name: "Internal Admin" },
    });

    expect(post.systemPost).toBe(true);
    expect(post.author).toMatchObject({ name: "TradeScout", role: "Platform", verified: true });
    expect(post.author?.id).toBeUndefined();
  });
});
