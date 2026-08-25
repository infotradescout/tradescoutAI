import { describe, expect, it } from "vitest";
import {
  attachPublicProfileImageSitemapReferences,
  buildProfileImageSitemapXml,
  collectProfileImageSitemapEntries,
} from "../profileImageSitemap";

const contentBlocks = [
  {
    type: "hero",
    data: {
      imageUrl: "/images/provider/hero.jpg",
      logoUrl: "/images/provider/logo.png",
    },
  },
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Quartzite",
          categorySlug: "quartzite",
          stones: [
            {
              name: "Taj Mahal",
              slug: "taj-mahal",
              images: [
                "/images/provider/taj-mahal-1.jpg",
                "/images/provider/taj-mahal-2.jpg",
              ],
            },
            {
              name: "Internal placeholder",
              nameStatus: "placeholder",
              slug: "unnamed-selection",
              images: ["/images/provider/unnamed.jpg"],
            },
          ],
        },
      ],
    },
  },
  {
    type: "gallery",
    data: {
      description: "Completed work published by this provider.",
      images: [
        {
          id: "completed-kitchen",
          title: "Completed quartzite kitchen",
          description: "A completed kitchen installation using a named quartzite selection.",
          imageUrl: "/images/provider/completed-kitchen.jpg",
        },
        "/images/provider/generic-gallery-photo.jpg",
      ],
    },
  },
  {
    type: "localServiceProfile",
    data: {
      heroImage: "/images/provider/service-hero.jpg",
      serviceAreas: ["Hammond"],
      serviceAreaDescription:
        "Published service coverage for residential and commercial projects in the local area.",
      services: [
        {
          title: "Countertop installation",
          description:
            "Measure, plan, fabricate, and install stone countertops with project details reviewed before work begins.",
          imageUrl: "/images/provider/countertop-installation.jpg",
        },
      ],
    },
  },
] as const;

describe("governed public profile image sitemap", () => {
  it("publishes root, named inventory, category, fact-bearing project, and service images", () => {
    const entries = collectProfileImageSitemapEntries({
      candidate: {
        slug: "sample-provider",
        contentBlocks,
        seoMeta: { imageUrl: "/images/provider/social.jpg" },
        updatedAt: "2026-08-25T20:00:00.000Z",
      },
      profileUrl: "https://www.thetradescout.com/u/sample-provider",
    });

    const byPage = new Map(entries.map((entry) => [entry.pageUrl, entry]));
    expect(byPage.get("https://www.thetradescout.com/u/sample-provider")?.imageUrls).toEqual(
      expect.arrayContaining([
        "https://www.thetradescout.com/images/provider/social.jpg",
        "https://www.thetradescout.com/images/provider/hero.jpg",
        "https://www.thetradescout.com/images/provider/logo.png",
        "https://www.thetradescout.com/images/provider/service-hero.jpg",
      ])
    );
    expect(
      byPage.get(
        "https://www.thetradescout.com/u/sample-provider/inventory/taj-mahal"
      )?.imageUrls
    ).toEqual([
      "https://www.thetradescout.com/images/provider/taj-mahal-1.jpg",
      "https://www.thetradescout.com/images/provider/taj-mahal-2.jpg",
    ]);
    expect(
      byPage.get(
        "https://www.thetradescout.com/u/sample-provider/categories/quartzite"
      )?.imageUrls
    ).toEqual(["https://www.thetradescout.com/images/provider/taj-mahal-1.jpg"]);
    expect(
      [...byPage.keys()].some((url) => url.includes("/gallery/completed-quartzite-kitchen-"))
    ).toBe(true);
    expect(
      byPage.get(
        "https://www.thetradescout.com/u/sample-provider/services/countertop-installation"
      )?.imageUrls
    ).toEqual([
      "https://www.thetradescout.com/images/provider/countertop-installation.jpg",
    ]);
  });

  it("keeps placeholders and generic gallery photos out of the feed", () => {
    const xml = buildProfileImageSitemapXml(
      collectProfileImageSitemapEntries({
        candidate: {
          slug: "sample-provider",
          contentBlocks,
          seoMeta: {},
        },
        profileUrl: "https://www.thetradescout.com/u/sample-provider",
      })
    );

    expect(xml).not.toContain("unnamed-selection");
    expect(xml).not.toContain("unnamed.jpg");
    expect(xml).not.toContain("generic-gallery-photo.jpg");
  });

  it("uses the current image sitemap tags without deprecated caption or title tags", () => {
    const xml = buildProfileImageSitemapXml([
      {
        pageUrl: "https://www.thetradescout.com/u/sample-provider/inventory/taj-mahal",
        imageUrls: ["https://www.thetradescout.com/images/provider/taj-mahal-1.jpg"],
        lastmod: "2026-08-25",
      },
    ]);

    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(xml).toContain("<image:image>");
    expect(xml).toContain(
      "<image:loc>https://www.thetradescout.com/images/provider/taj-mahal-1.jpg</image:loc>"
    );
    expect(xml).not.toContain("<image:caption>");
    expect(xml).not.toContain("<image:title>");
    expect(xml).not.toContain("<image:geo_location>");
    expect(xml).not.toContain("<image:license>");
  });

  it("uses the profile custom domain for relative page and image URLs", () => {
    const entries = collectProfileImageSitemapEntries({
      candidate: {
        slug: "sample-provider",
        contentBlocks,
        seoMeta: { customDomain: "provider.example.com" },
      },
      profileUrl: "https://provider.example.com/",
    });

    expect(entries.some((entry) => entry.pageUrl.startsWith("https://provider.example.com/"))).toBe(
      true
    );
    expect(
      entries.flatMap((entry) => entry.imageUrls).every((url) => url.startsWith("https://"))
    ).toBe(true);
    expect(
      entries.some((entry) =>
        entry.pageUrl.includes("/landing/service/countertop-installation")
      )
    ).toBe(true);
  });

  it("adds the image sitemap to the platform sitemap index and robots response", () => {
    const makeResponse = () => {
      const state: { body?: string } = {};
      const response = {
        send(body: string) {
          state.body = body;
          return response;
        },
      } as any;
      return { response, state };
    };

    const sitemap = makeResponse();
    attachPublicProfileImageSitemapReferences(
      {
        path: "/sitemap.xml",
        protocol: "https",
        headers: { host: "www.thetradescout.com" },
        get: () => "www.thetradescout.com",
      } as any,
      sitemap.response
    );
    sitemap.response.send(
      '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>'
    );
    expect(sitemap.state.body).toContain(
      "https://www.thetradescout.com/sitemap-profile-images.xml"
    );

    const robots = makeResponse();
    attachPublicProfileImageSitemapReferences(
      {
        path: "/robots.txt",
        protocol: "https",
        headers: { host: "www.thetradescout.com" },
        get: () => "www.thetradescout.com",
      } as any,
      robots.response
    );
    robots.response.send("User-agent: *\nAllow: /\n");
    expect(robots.state.body).toContain(
      "Sitemap: https://www.thetradescout.com/sitemap-profile-images.xml"
    );
  });
});
