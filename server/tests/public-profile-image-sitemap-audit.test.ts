import { describe, expect, it } from "vitest";
import { buildProfileImageSitemapXml } from "../profileImageSitemap";
import {
  evaluatePublicProfileImageFeed,
  evaluatePublicProfileImageReference,
  fingerprintPublicProfileImageExpectedGraph,
  runPublicProfileImageSitemapAudit,
  type PublicProfileImageExpectedGraph,
} from "../services/publicProfileImageSitemapAudit";

const platformEntries = [
  {
    pageUrl: "https://www.thetradescout.com/u/property-blessings/projects/land-clearing",
    imageUrls: ["https://www.thetradescout.com/images/property-blessings/land-clearing.jpg"],
    lastmod: "2026-08-25",
  },
  {
    pageUrl: "https://jwstonelogistics.com/stones/taj-mahal",
    imageUrls: [
      "https://www.thetradescout.com/images/businesses/jw-stone/taj-mahal-1.jpg",
      "https://www.thetradescout.com/images/businesses/jw-stone/taj-mahal-2.jpg",
    ],
    lastmod: "2026-08-25",
  },
];

const customEntries = [platformEntries[1]];

const graph: PublicProfileImageExpectedGraph = {
  platformFeed: {
    kind: "platform_feed",
    url: "https://www.thetradescout.com/sitemap-profile-images.xml",
    profileSlugs: ["jw-stone", "property-blessings"],
    expectedEntries: platformEntries,
    allowedPageHosts: ["www.thetradescout.com", "jwstonelogistics.com"],
  },
  customFeeds: [
    {
      kind: "custom_domain_feed",
      url: "https://jwstonelogistics.com/landing/profile-images.xml",
      profileSlugs: ["jw-stone"],
      expectedEntries: customEntries,
      allowedPageHosts: ["jwstonelogistics.com"],
    },
  ],
  sitemapUrl: "https://www.thetradescout.com/sitemap.xml",
  robotsUrl: "https://www.thetradescout.com/robots.txt",
};

function response(args: {
  url: string;
  status?: number;
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
    status: args.status ?? 200,
    url: args.url,
    headers: { get: (name: string) => values.get(name.toLowerCase()) || null },
    text: async () => "",
  };
}

describe("public profile image sitemap production audit", () => {
  it("verifies the unified feed including canonical custom-domain pages", () => {
    const xml = buildProfileImageSitemapXml(platformEntries);
    const result = evaluatePublicProfileImageFeed({
      expected: graph.platformFeed,
      response: response({
        url: graph.platformFeed.url,
        contentType: "application/xml; charset=utf-8",
        pageCount: 2,
        imageCount: 3,
      }),
      xml,
    });

    expect(result.failedChecks).toEqual([]);
    expect(result.observedPageCount).toBe(2);
    expect(result.observedImageCount).toBe(3);
    expect(result.missingPageUrls).toEqual([]);
    expect(result.missingImageUrls).toEqual([]);
    expect(result.unexpectedPageHosts).toEqual([]);
  });

  it("verifies the host-local JW feed and rejects platform page URLs on that feed", () => {
    const validXml = buildProfileImageSitemapXml(customEntries);
    const valid = evaluatePublicProfileImageFeed({
      expected: graph.customFeeds[0],
      response: response({
        url: graph.customFeeds[0].url,
        contentType: "application/xml",
        pageCount: 1,
        imageCount: 2,
      }),
      xml: validXml,
    });
    expect(valid.failedChecks).toEqual([]);

    const invalid = evaluatePublicProfileImageFeed({
      expected: graph.customFeeds[0],
      response: response({
        url: graph.customFeeds[0].url,
        contentType: "application/xml",
        pageCount: 2,
        imageCount: 3,
      }),
      xml: buildProfileImageSitemapXml(platformEntries),
    });
    expect(invalid.checks.pageHostsAllowed).toBe(false);
    expect(invalid.unexpectedPageHosts).toEqual(["www.thetradescout.com"]);
  });

  it("fails deprecated tags, missing expected URLs, and direct-only leakage exactly", () => {
    const xml = buildProfileImageSitemapXml(platformEntries)
      .replace("<image:image>", "<image:image><image:title>Invented title</image:title>")
      .replace(platformEntries[0].pageUrl, "https://www.thetradescout.com/u/jrs-auto-glass")
      .replace(platformEntries[0].imageUrls[0], "https://www.thetradescout.com/images/unnamed-selection.jpg");
    const result = evaluatePublicProfileImageFeed({
      expected: graph.platformFeed,
      response: response({
        url: graph.platformFeed.url,
        contentType: "application/xml",
        pageCount: 2,
        imageCount: 3,
      }),
      xml,
    });

    expect(result.checks.deprecatedImageTagsAbsent).toBe(false);
    expect(result.checks.expectedPageUrlsPresent).toBe(false);
    expect(result.checks.expectedImageUrlsPresent).toBe(false);
    expect(result.checks.directOnlyProfileAbsent).toBe(false);
    expect(result.checks.placeholderTokensAbsent).toBe(false);
  });

  it("verifies sitemap-index and robots references separately", () => {
    const sitemap = evaluatePublicProfileImageReference({
      kind: "sitemap_reference",
      url: graph.sitemapUrl,
      response: response({ url: graph.sitemapUrl, contentType: "application/xml" }),
      body: `<sitemapindex><sitemap><loc>${graph.platformFeed.url}</loc></sitemap></sitemapindex>`,
    });
    const robots = evaluatePublicProfileImageReference({
      kind: "robots_reference",
      url: graph.robotsUrl,
      response: response({ url: graph.robotsUrl, contentType: "text/plain" }),
      body: `User-agent: *\nSitemap: ${graph.platformFeed.url}\n`,
    });

    expect(sitemap.failedChecks).toEqual([]);
    expect(robots.failedChecks).toEqual([]);
  });

  it("runs all four targets and preserves fetch failures as unavailable", async () => {
    const bodies = new Map<string, { contentType: string; body: string; pages?: number; images?: number }>([
      [
        graph.platformFeed.url,
        {
          contentType: "application/xml",
          body: buildProfileImageSitemapXml(platformEntries),
          pages: 2,
          images: 3,
        },
      ],
      [
        graph.customFeeds[0].url,
        {
          contentType: "application/xml",
          body: buildProfileImageSitemapXml(customEntries),
          pages: 1,
          images: 2,
        },
      ],
      [
        graph.sitemapUrl,
        {
          contentType: "application/xml",
          body: `<sitemapindex><sitemap><loc>${graph.platformFeed.url}</loc></sitemap></sitemapindex>`,
        },
      ],
      [
        graph.robotsUrl,
        {
          contentType: "text/plain",
          body: `User-agent: *\nSitemap: ${graph.platformFeed.url}\n`,
        },
      ],
    ]);
    const result = await runPublicProfileImageSitemapAudit({
      expectedGraph: graph,
      fetchImpl: async (url) => {
        const record = bodies.get(url);
        if (!record) throw new Error("missing fixture");
        const base = response({
          url,
          contentType: record.contentType,
          pageCount: record.pages,
          imageCount: record.images,
        });
        return { ...base, text: async () => record.body };
      },
      persist: false,
      now: () => new Date("2026-08-25T21:30:00.000Z"),
    });

    expect(result.targetCount).toBe(4);
    expect(result.verifiedCount).toBe(4);
    expect(result.failedCount).toBe(0);
    expect(result.unavailableCount).toBe(0);
    expect(result.expectedPageCount).toBe(2);
    expect(result.expectedImageCount).toBe(3);
    expect(fingerprintPublicProfileImageExpectedGraph(graph)).toMatch(/^[a-f0-9]{64}$/);

    const unavailable = await runPublicProfileImageSitemapAudit({
      expectedGraph: graph,
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
      persist: false,
    });
    expect(unavailable.failedCount).toBe(0);
    expect(unavailable.unavailableCount).toBe(4);
  });
});
