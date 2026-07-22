import { describe, expect, it } from "vitest";
import {
  isAutomaticCommunityWelcomePost,
  isUsefulPublicCommunityBrowsePost,
  sanitizePublicCommunityFeedPost,
  toPublicCommunityPost,
} from "../publicCommunityPost";

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
        verified: false,
        cvsScore: 82,
        verificationStatus: "pending",
      },
      location: "12033",
    });

    expect(result).not.toHaveProperty("moderatorNotes");
    expect(result).not.toHaveProperty("moderatedBy");
    expect(result).not.toHaveProperty("moderatedAt");
    expect(result.author).not.toHaveProperty("email");
    expect(result.author).not.toHaveProperty("phone");
    expect(result.author).not.toHaveProperty("role");
    expect(result.author).not.toHaveProperty("verified");
    expect(result.author).not.toHaveProperty("cvsScore");
    expect(result.author).not.toHaveProperty("verificationStatus");
    expect(result).not.toHaveProperty("location");
  });

  it("keeps branded share previews out of public member avatars", () => {
    const result = toPublicCommunityPost(post, {
      ...author,
      profileImageUrl: "https://www.thetradescout.com/tradescout-social-preview.png?v=12",
    });

    expect(result?.author.avatar).toBeNull();
    expect(
      sanitizePublicCommunityFeedPost({
        ...post,
        author: {
          id: "author-1",
          name: "Taylor Neighbor",
          avatar: "/tradescout-social-preview.png?v=12",
          profileImageUrl: "/uploads/profiles/taylor.webp",
        },
      }).author
    ).toMatchObject({
      avatar: null,
      profileImageUrl: "/uploads/profiles/taylor.webp",
    });
  });

  it("recognizes only generated onboarding welcome announcements", () => {
    expect(
      isAutomaticCommunityWelcomePost({
        category: "announcements",
        title: "Welcome Jacob",
        content:
          "Say hello to Jacob M. in your area. Share helpful tips, local recommendations, or groups worth following. They are here to connect.",
      })
    ).toBe(true);
    expect(
      isAutomaticCommunityWelcomePost({
        category: "announcements",
        title: "Welcome Taylor",
        content:
          "Taylor N. recently joined Hamilton County, TN. They joined to exchange recommendations, questions, and useful local knowledge.",
        tags: ["new_neighbor"],
      })
    ).toBe(true);
    expect(
      isAutomaticCommunityWelcomePost({
        category: "announcements",
        title: "Welcome to the summer market",
        content: "Market hours have changed this weekend.",
      })
    ).toBe(false);
  });

  it("keeps useful signals in public browse and removes test, cross-product, and stale filler", () => {
    const now = new Date("2026-07-22T12:00:00.000Z");
    expect(
      isUsefulPublicCommunityBrowsePost(
        {
          category: "question",
          content: "Can anyone recommend a licensed electrician for a panel inspection?",
          createdAt: "2026-07-20T12:00:00.000Z",
        },
        now
      )
    ).toBe(true);
    expect(
      isUsefulPublicCommunityBrowsePost(
        { category: "general", content: "How does this community work?" },
        now
      )
    ).toBe(false);
    expect(
      isUsefulPublicCommunityBrowsePost(
        { category: "general", content: "We are expanding MealScout host locations this week." },
        now
      )
    ).toBe(false);
    expect(
      isUsefulPublicCommunityBrowsePost(
        {
          category: "event",
          content: "Community market and neighborhood cleanup this Saturday morning.",
          createdAt: "2026-02-01T12:00:00.000Z",
        },
        now
      )
    ).toBe(false);
    expect(
      isUsefulPublicCommunityBrowsePost(
        {
          category: "general",
          content: "Good morning!",
          imageUrls: ["/uploads/community/sunrise.jpg"],
          createdAt: "2026-07-20T12:00:00.000Z",
        },
        now
      )
    ).toBe(false);
    expect(
      isUsefulPublicCommunityBrowsePost(
        {
          category: "question",
          content: "Can anyone recommend a dependable plumber for a leaking water heater?",
          author: { name: "Playwright E2E" },
          createdAt: "2026-07-20T12:00:00.000Z",
        },
        now
      )
    ).toBe(false);
    expect(
      isUsefulPublicCommunityBrowsePost(
        {
          category: "general",
          content: "SIGNATURE EVENTS - hockey, markets, live music events, and weekend listings.",
          createdAt: "2026-02-27T12:00:00.000Z",
        },
        now
      )
    ).toBe(false);
  });
});
