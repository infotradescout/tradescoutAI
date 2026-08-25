import { describe, expect, it } from "vitest";
import { buildProfileImageSitemapXml } from "../profileImageSitemap";
import type { PublicProfileImageExpectedGraph } from "../services/publicProfileImageSitemapAudit";
import { runPublicProfileImageSitemapAuditV2 } from "../services/publicProfileImageSitemapAuditV2";

const sharedImage = "https://www.thetradescout.com/images/shared-provider-photo.jpg";
const graph: PublicProfileImageExpectedGraph = {
  platformFeed: {
    kind: "platform_feed",
    url: "https://www.thetradescout.com/sitemap-profile-images.xml",
    profileSlugs: ["sample-provider"],
    expectedEntries: [
      {
        pageUrl: "https://www.thetradescout.com/u/sample-provider",
        imageUrls: [sharedImage],
      },
      {
        pageUrl: "https://www.thetradescout.com/u/sample-provider/services/installation",
        imageUrls: [sharedImage],
      },
    ],
    allowedPageHosts: ["www.thetradescout.com"],
  },
  customFeeds: [],
  sitemapUrl: "https://www.thetradescout.com/sitemap.xml",
  robotsUrl: "https://www.thetradescout.com/robots.txt",
};

function response(args: {
  url: string;
  body: string;
  contentType: string;
  pageCount?: number;
  imageCount?: number;
}) {
  const values = new Map<string, string>([
    ["content-type", args.contentType],
    ...(args.pageCount === undefined
      ? []
      : [["x-tradescout-image-page-count", String(args.pageCount)] as [string, string]]),
    ...(args.imageCount === undefined
      ? []
      : [["x-tradescout-image-count", String(args.imageCount)] as [string, string]]),
  ]);
  return {
    status: 200,
    url: args.url,
    headers: { get: (name: string) => values.get(name.toLowerCase()) || null },
    text: async () => args.body,
  };
}

describe("profile image sitemap reference counting", () => {
  it("keeps unique membership separate from repeated image:loc references", async () => {
    const feedXml = buildProfileImageSitemapXml(graph.platformFeed.expectedEntries);
    const fixtures = new Map([
      [
        graph.platformFeed.url,
        response({
          url: graph.platformFeed.url,
          body: feedXml,
          contentType: "application/xml",
          pageCount: 2,
          imageCount: 2,
        }),
      ],
      [
        graph.sitemapUrl,
        response({
          url: graph.sitemapUrl,
          body: `<sitemapindex><sitemap><loc>${graph.platformFeed.url}</loc></sitemap></sitemapindex>`,
          contentType: "application/xml",
        }),
      ],
      [
        graph.robotsUrl,
        response({
          url: graph.robotsUrl,
          body: `User-agent: *\nSitemap: ${graph.platformFeed.url}\n`,
          contentType: "text/plain",
        }),
      ],
    ]);

    const result = await runPublicProfileImageSitemapAuditV2({
      expectedGraph: graph,
      fetchImpl: async (url) => {
        const fixture = fixtures.get(url);
        if (!fixture) throw new Error(`Missing fixture for ${url}`);
        return fixture;
      },
      persist: false,
      now: () => new Date("2026-08-25T22:00:00.000Z"),
    });

    expect(result.targetCount).toBe(3);
    expect(result.verifiedCount).toBe(3);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(0);
    expect(result.expectedPageCount).toBe(2);
    expect(result.expectedImageCount).toBe(2);

    const feed = result.results.find((target) => target.kind === "platform_feed");
    expect(feed?.status).toBe("production_verified");
    expect(feed?.failedChecks).toEqual([]);
    expect(feed?.expectedPageCount).toBe(2);
    expect(feed?.observedPageCount).toBe(2);
    expect(feed?.expectedImageCount).toBe(2);
    expect(feed?.observedImageCount).toBe(2);
    expect(feed?.missingImageUrls).toEqual([]);
    expect(feed?.checks).toMatchObject({ countHeadersMatch: true });
  });

  it("still fails a header that does not match emitted image references", async () => {
    const feedXml = buildProfileImageSitemapXml(graph.platformFeed.expectedEntries);
    const result = await runPublicProfileImageSitemapAuditV2({
      expectedGraph: graph,
      fetchImpl: async (url) => {
        if (url === graph.platformFeed.url) {
          return response({
            url,
            body: feedXml,
            contentType: "application/xml",
            pageCount: 2,
            imageCount: 1,
          });
        }
        return response({
          url,
          body:
            url === graph.robotsUrl
              ? `Sitemap: ${graph.platformFeed.url}`
              : `<sitemapindex><sitemap><loc>${graph.platformFeed.url}</loc></sitemap></sitemapindex>`,
          contentType: url === graph.robotsUrl ? "text/plain" : "application/xml",
        });
      },
      persist: false,
    });

    const feed = result.results.find((target) => target.kind === "platform_feed");
    expect(feed?.status).toBe("production_failed");
    expect(feed?.failedChecks).toContain("countHeadersMatch");
  });
});
