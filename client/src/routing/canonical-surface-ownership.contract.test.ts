import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

describe("canonical surface ownership", () => {
  it("routes all inbox aliases to the Messages workspace", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const routeConfig = read("client/src/lib/routes.ts");
    const redirects = read("client/src/routing/compatibilityRedirects.ts");

    expect(routes).toContain('renderCompatibilityRedirects("standard")');
    expect(routeConfig).toContain('CONVERSATIONS: "/messages"');
    expect(redirects).toContain('from: "/dashboard/messages", to: "/messages"');
    expect(redirects).toContain('from: "/conversations", to: "/messages"');
  });

  it("keeps one routed Community feed and quarantines competing clients", () => {
    const routes = read("client/src/AppRoutes.tsx");
    const routedFeed = read("client/src/pages/community-feed.tsx");
    const socialFeed = read("client/src/components/social/SocialFeed.tsx");

    expect(routes).toContain('import("./pages/community-feed")');
    expect(routedFeed).toContain("community-feed-page");
    expect(routedFeed).toContain("/api/community/posts");
    expect(routedFeed).toContain("<CommunityPostCard");
    expect(socialFeed).toContain("@deprecated Quarantined socialPosts client");
    // The old sample/mock feed (pages/CommunityFeed.tsx, playgrounds/CommunityFeedMock.tsx)
    // and the legacy pages/community.tsx were deleted outright as part of the
    // Community makeover's Lane A consolidation -- nothing should reintroduce them.
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/CommunityFeed.tsx"))).toBe(
      false
    );
    expect(fs.existsSync(path.resolve(process.cwd(), "client/src/pages/community.tsx"))).toBe(
      false
    );

    const clientFiles = fs
      .readdirSync(path.resolve(process.cwd(), "client/src"), { recursive: true })
      .filter((entry): entry is string => typeof entry === "string" && /\.(ts|tsx)$/.test(entry));
    const socialFeedImporters = clientFiles.filter((entry) => {
      const normalized = entry.replaceAll("\\", "/");
      if (
        normalized === "components/social/SocialFeed.tsx" ||
        normalized === "routing/canonical-surface-ownership.contract.test.ts"
      ) {
        return false;
      }
      const source = read(`client/src/${normalized}`);
      return /(?:from\s+["'][^"']*SocialFeed|import\(["'][^"']*SocialFeed)/.test(source);
    });

    expect(socialFeedImporters).toEqual([]);
  });
});
