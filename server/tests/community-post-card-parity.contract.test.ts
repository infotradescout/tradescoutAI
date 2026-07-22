import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical Community post card parity", () => {
  const feed = read("client/src/pages/community-feed.tsx");
  const card = read("client/src/components/community/CommunityPostCard.tsx");
  const adapter = read("client/src/components/community/communityPostCardAdapter.ts");
  const avatar = read("client/src/components/ui/avatar.tsx");

  it("owns routed feed post presentation through CommunityPostCard", () => {
    expect(feed).toContain(
      'import { CommunityPostCard } from "@/components/community/CommunityPostCard"'
    );
    expect(feed).toContain("<CommunityPostCard");
    expect(feed).toContain("toCommunityPostCardData(post");
    expect(feed).not.toMatch(/tabSortedPosts\.map[\s\S]{0,1200}<Card/);
  });

  it("preserves local actions and enforces global read-only behavior", () => {
    expect(feed).toContain("readOnly={isGlobalView}");
    expect(feed).toContain("onLike={handleLikePost}");
    expect(feed).toContain("onSave={handleToggleSavePost}");
    expect(feed).toContain("onComment={handleTogglePostComments}");
    expect(feed).toContain("<CommunityComments postId={cardPost.id}");

    expect(card).toContain("if (readOnly) return;");
    expect(card).toContain("readOnly ? (");
    expect(card).toContain("View comments");
    expect(card).toContain("commentsOpen && commentsSlot");
    expect(card).not.toContain("disabled={readOnly}");
    expect(card).toContain("!readOnly && (");
  });

  it("keeps stable post, action, topic, media, and moderation contracts", () => {
    for (const selector of [
      'data-testid="community-post-card"',
      "card-post-${post.id}",
      "button-like-${post.id}",
      "button-comment-${post.id}",
      "button-share-${post.id}",
      "button-save-${post.id}",
    ]) {
      expect(card).toContain(selector);
    }

    expect(card).toContain("post.imageUrls.slice(0, 8)");
    expect(card).toContain('"Read more"');
    expect(card).toContain(".slice(0, 5)");
    expect(card).toContain("onTagSelect(tag.key)");
    expect(card).toContain("Pin post");
    expect(card).toContain("Hide from feed");
    expect(card).toContain("Remove from feed");
    expect(card).toContain("Report post");
    expect(card).toContain('contentType="community_post"');
  });

  it("normalizes routed response aliases without changing APIs", () => {
    expect(adapter).toContain("numberValue(raw.likeCount, raw.likes, raw.upvotes)");
    expect(adapter).toContain("numberValue(raw.commentCount, raw.comments)");
    expect(adapter).toContain("numberValue(raw.shareCount, raw.shares)");
    expect(adapter).toContain("raw.saved === true");
    expect(adapter).toContain("raw.liked === true");
  });

  it("uses each surface's intentional avatar fallback instead of a share-preview image", () => {
    expect(card).toContain('<TradeScoutLogo size="sm"');
    expect(avatar).toContain('"/tradescout-social-preview.png"');
    expect(avatar).toContain("return undefined;");
    expect(avatar).not.toContain("CANONICAL_DEFAULT_AVATAR_SRC");
  });
});
