import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCommunityPost: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getCommunityPost: mocks.getCommunityPost,
    getUser: mocks.getUser,
  },
}));

import { buildPublicCommunityPostHtml } from "../publicCommunityPostHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const post = {
  id: "post-123",
  authorId: "author-1",
  title: "Stone delivery update",
  content: "The new natural stone delivery arrived this morning.",
  imageUrls: ["/uploads/community/stone-delivery.webp"],
  attachmentUrls: ["/private/evidence.pdf"],
  scope: "county",
  stateCode: "TN",
  countyFips: "47065",
  cityName: "Chattanooga",
  regionName: null,
  category: "projects",
  tags: ["stone", "project"],
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
};

const author = {
  id: "author-1",
  firstName: "Taylor",
  lastName: "Neighbor",
  email: "private@example.com",
  phone: "555-0100",
  profileImageUrl: "/uploads/profiles/taylor.webp",
  role: "homeowner",
  addressVerified: true,
};

describe("public community post HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCommunityPost.mockResolvedValue(post);
    mocks.getUser.mockResolvedValue(author);
  });

  it("uses the post's exact first image and durable URL in social metadata", async () => {
    const html = await buildPublicCommunityPostHtml({
      postId: "post-123",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/community/stone-delivery.webp"'
    );
    expect(html).toContain(
      'name="twitter:image" content="https://www.thetradescout.com/uploads/community/stone-delivery.webp"'
    );
    expect(html).toContain(
      'property="og:url" content="https://www.thetradescout.com/community/posts/post-123"'
    );
    expect(html).toContain(
      'link rel="canonical" href="https://www.thetradescout.com/community/posts/post-123"'
    );
    expect(html).toContain('"@type":"SocialMediaPosting"');
    expect(html).toContain('"interactionType":"https://schema.org/LikeAction"');
    expect(html).toContain('"mainEntityOfPage":{"@type":"WebPage"');
    expect(html).toContain('content="read-only-global"');
    expect(html).toContain('data-seo-community-post="post-123"');
    expect(html).toContain("<h1>Stone delivery update</h1>");
    expect(html).toContain("By Taylor Neighbor — verified member · Chattanooga, TN");
    expect(html).toContain("The new natural stone delivery arrived this morning.");
    expect(html).toContain("3 likes · 2 comments · 1 shares");
    expect(html).toContain(
      '<img src="https://www.thetradescout.com/uploads/community/stone-delivery.webp"'
    );
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain("private@example.com");
    expect(html).not.toContain("private moderation context");
    expect(html).not.toContain("/private/evidence.pdf");
  });

  it("does not publish hidden, unpublished, or malformed posts", async () => {
    mocks.getCommunityPost.mockResolvedValueOnce({ ...post, isHidden: true });
    await expect(
      buildPublicCommunityPostHtml({
        postId: "post-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    mocks.getCommunityPost.mockResolvedValueOnce({ ...post, isPublished: false });
    await expect(
      buildPublicCommunityPostHtml({
        postId: "post-123",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    await expect(
      buildPublicCommunityPostHtml({
        postId: "../private",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();
  });
});
