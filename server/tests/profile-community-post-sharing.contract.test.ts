import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("profile community post sharing contract", () => {
  it("turns profile activity into viewable and shareable image cards", () => {
    const profile = read("client/src/pages/PublicProfileView.tsx");

    expect(profile).toContain("listCommunityPostImageUrls(p.imageUrls)");
    expect(profile).toContain("buildCommunityPostPath(post.id)");
    expect(profile).toContain("postImage");
    expect(profile).toContain("<ShareButton");
    expect(profile).toContain("View");
  });

  it("uses one durable post detail route for profile and feed shares", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const detail = read("client/src/pages/community-post-detail.tsx");
    const feed = read("client/src/pages/community-feed.tsx");
    const card = read("client/src/components/community/CommunityPostCard.tsx");

    expect(routes).toContain('<Route path="/community/posts/:postId">');
    expect(detail).toContain("buildCommunityPostPath(post.id)");
    expect(detail).toContain("createCommunityPostShareMetadata({ post, origin: PUBLIC_ORIGIN })");
    expect(feed).toContain("buildCommunityPostPath(post.id)");
    expect(card).toContain("buildCommunityPostPath(post.id)");
    expect(feed).not.toContain("/community-feed?post=");
    expect(card).not.toContain("/community-feed?post=");
  });

  it("renders exact crawler metadata and blocks hidden post output", () => {
    const serverIndex = read("server/index.ts");
    const publicHtml = read("server/publicCommunityPostHtml.ts");
    const routes = read("server/routes.ts");

    expect(serverIndex).toContain('app.get("/community/posts/:postId"');
    expect(serverIndex).toContain("buildPublicCommunityPostHtml({");
    expect(publicHtml).toContain("createCommunityPostShareMetadata({ post: publicPost, origin })");
    expect(publicHtml).toContain('"@type": "SocialMediaPosting"');
    expect(routes).toContain("post.isPublished !== true || post.isHidden === true");
    expect(routes).toContain("sanitizePublicCommunityFeedPost");
    expect(routes).toContain("toPublicCommunityPost(");
  });

  it("keeps shared details read-only and preserves protected local actions", () => {
    const detail = read("client/src/pages/community-post-detail.tsx");
    const feedCard = read("client/src/components/community/CommunityPostCard.tsx");

    expect(detail).toContain("Anyone can read this public post.");
    expect(detail).toContain("Community actions remain tied to local context");
    expect(detail).not.toContain("Send Message");
    expect(detail).not.toContain("Start a Request");
    expect(feedCard).toContain("ContactOutcomeModal");
    expect(feedCard).toContain("decisionScope: `community_post:${post.id}`");
  });
});
