import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOneLevelCommentThreads } from "../../client/src/lib/communityComments";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const exists = (relativePath: string) => fs.existsSync(path.resolve(process.cwd(), relativePath));

describe("community neighborhood feed foundation", () => {
  it("applies selected categories to GET /api/community/posts", () => {
    const source = read("client/src/pages/community-feed.tsx");

    expect(source).toContain("activeCategoryFilter");
    expect(source).toContain('params.set("category", activeCategoryFilter)');
    expect(source).toContain('data-testid="community-category-filter-bar"');
    expect(source).toContain("data-testid={`community-category-filter-${key}`}");
  });

  it("attaches comments to the live community post model", () => {
    const schema = read("shared/schema.ts");
    const migration = read("migrations/0000_wild_saracen.sql");
    const routes = read("server/routes.ts");

    expect(schema).toContain(".references(() => communityPosts.id");
    expect(schema).toContain("one(communityPosts");
    expect(migration.toLowerCase()).toContain(
      'post_comments" add constraint "post_comments_post_id_community_posts_id_fk"'
    );
    expect(routes).toContain("const post = await storage.getCommunityPost(postId)");
  });

  it("creates replies with parentCommentId and verifies the parent belongs to the same post", () => {
    const routes = read("server/routes.ts");

    expect(routes).toContain("const { content, parentCommentId } = req.body");
    expect(routes).toContain("normalizedParentCommentId");
    expect(routes).toContain("Parent comment does not belong to this post");
    expect(routes).toContain("parentCommentId: normalizedParentCommentId");
  });

  it("threads parent comments with one visual level of replies", () => {
    const threads = buildOneLevelCommentThreads([
      { id: "parent", content: "Parent", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "reply",
        content: "Reply",
        parentCommentId: "parent",
        createdAt: "2026-01-01T00:01:00.000Z",
      },
      {
        id: "nested",
        content: "Nested",
        parentCommentId: "reply",
        createdAt: "2026-01-01T00:02:00.000Z",
      },
    ]);

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe("parent");
    expect(threads[0].replies?.map((reply) => reply.id)).toEqual(["reply"]);

    const source = read("client/src/pages/community-feed.tsx");
    expect(source).toContain('data-testid="comment-thread"');
    expect(source).toContain('data-testid="comment-reply"');
  });

  it("uses CommunityShell from the live route wrapper", () => {
    const shell = read("client/src/shells/CommunityPageShell.tsx");
    const routes = read("client/src/AppRoutes.tsx");

    expect(routes).toContain('import("./shells/CommunityPageShell")');
    expect(routes).toContain('<Route path="/community-feed">');
    expect(shell).toContain('from "@/components/layout/CommunityShell"');
    expect(shell).toContain('<CommunityShell sectionLabel="Community Feed">');
  });

  it("keeps orphaned community files deleted after confirming the canonical route", () => {
    const routes = read("client/src/AppRoutes.tsx");

    expect(routes).toContain(
      'const CommunityFeed = React.lazy(() => import("./pages/community-feed"))'
    );
    expect(routes).toContain('<RedirectTo to="/community-feed" />');
    expect(exists("client/src/pages/community.tsx")).toBe(false);
    expect(exists("client/src/pages/CommunityFeed.tsx")).toBe(false);
    expect(exists("client/src/components/community/CommunityFeed.tsx")).toBe(false);
  });

  it("renders live feed posts only through CommunityPostCard", () => {
    const feed = read("client/src/pages/community-feed.tsx");

    expect(feed).toContain("<CommunityPostCard");
    expect(feed).not.toContain("{/* Post Header */}");
    expect(feed).not.toContain("{/* Post Actions */}");
  });
});
