import { describe, expect, it, vi } from "vitest";
import {
  attachPublicProfileImageSitemapReferences,
  buildMappedCustomDomainImageSitemap,
  buildProfileImageSitemapXml,
  collectProfileImageSitemapEntries,
} from "../profileImageSitemap";

const PROFILE_SOCIAL_IMAGE = "/images/businesses/jrs-auto-glass/social-preview.jpg";
const PROFILE_HERO_IMAGE = "/images/businesses/jrs-auto-glass/cover.webp";
const PROFILE_LOGO_IMAGE = "/images/businesses/jrs-auto-glass/logo.webp";
const SERVICE_HERO_IMAGE = "/images/businesses/la-plumbing-solutions/hero.jpg";
const INVENTORY_IMAGE_ONE = "/images/businesses/honey-onyx/1.webp";
const INVENTORY_IMAGE_TWO = "/images/businesses/honey-onyx/2.jpg";
const PLACEHOLDER_IMAGE = "/images/businesses/honey-onyx/3.jpg";
const PROJECT_IMAGE = "/images/businesses/jrs-auto-glass/after.webp";
const GENERIC_GALLERY_IMAGE = "/images/businesses/jrs-auto-glass/before.webp";
const SERVICE_IMAGE = "/images/businesses/la-plumbing-solutions/bathroom.jpg";

const contentBlocks = [
  {
    type: "hero",
    data: {
      imageUrl: PROFILE_HERO_IMAGE,
      logoUrl: PROFILE_LOGO_IMAGE,
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
              images: [INVENTORY_IMAGE_ONE, INVENTORY_IMAGE_TWO],
            },
            {
              name: "Internal placeholder",
              nameStatus: "placeholder",
              slug: "unnamed-selection",
              images: [PLACEHOLDER_IMAGE],
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
          imageUrl: PROJECT_IMAGE,
        },
        GENERIC_GALLERY_IMAGE,
      ],
    },
  },
  {
    type: "localServiceProfile",
    data: {
      heroImage: SERVICE_HERO_IMAGE,
      serviceAreas: ["Hammond"],
      serviceAreaDescription:
        "Published service coverage for residential and commercial projects in the local area.",
      services: [
        {
          title: "Countertop installation",
          description:
            "Measure, plan, fabricate, and install stone countertops with project details reviewed before work begins.",
          imageUrl: SERVICE_IMAGE,
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
        seoMeta: { imageUrl: PROFILE_SOCIAL_IMAGE },
        updatedAt: "2026-08-25T20:00:00.000Z",
      },
      profileUrl: "https://www.thetradescout.com/u/sample-provider",
    });

    const byPage = new Map(entries.map((entry) => [entry.pageUrl, entry]));
    expect(byPage.get("https://www.thetradescout.com/u/sample-provider")?.imageUrls).toEqual(
      expect.arrayContaining([
        `https://www.thetradescout.com${PROFILE_SOCIAL_IMAGE}`,
        `https://www.thetradescout.com${PROFILE_HERO_IMAGE}`,
        `https://www.thetradescout.com${PROFILE_LOGO_IMAGE}`,
        `https://www.thetradescout.com${SERVICE_HERO_IMAGE}`,
      ])
    );
    expect(
      byPage.get("https://www.thetradescout.com/u/sample-provider/inventory/taj-mahal")?.imageUrls
    ).toEqual([
      `https://www.thetradescout.com${INVENTORY_IMAGE_ONE}`,
      `https://www.thetradescout.com${INVENTORY_IMAGE_TWO}`,
    ]);
    expect(
      byPage.get("https://www.thetradescout.com/u/sample-provider/categories/quartzite")?.imageUrls
    ).toEqual([`https://www.thetradescout.com${INVENTORY_IMAGE_ONE}`]);
    expect(
      [...byPage.keys()].some((url) => url.includes("/gallery/completed-quartzite-kitchen-"))
    ).toBe(true);
    expect(
      byPage.get("https://www.thetradescout.com/u/sample-provider/services/countertop-installation")
        ?.imageUrls
    ).toEqual([`https://www.thetradescout.com${SERVICE_IMAGE}`]);
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
    expect(xml).not.toContain(PLACEHOLDER_IMAGE);
    expect(xml).not.toContain(GENERIC_GALLERY_IMAGE);
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
      entries.some((entry) => entry.pageUrl.includes("/landing/service/countertop-installation"))
    ).toBe(true);
  });

  it("keeps the platform feed on the TradeScout origin even when a profile has a custom domain", () => {
    const entries = collectProfileImageSitemapEntries({
      candidate: {
        slug: "sample-provider",
        contentBlocks,
        seoMeta: {
          customDomain: "provider.example.com",
          imageUrl: PROFILE_SOCIAL_IMAGE,
        },
      },
    });

    expect(entries.length).toBeGreaterThan(0);
    expect(
      entries.every((entry) => entry.pageUrl.startsWith("https://www.thetradescout.com/"))
    ).toBe(true);
    expect(JSON.stringify(entries)).not.toContain("provider.example.com");
  });

  it("rejects an invalid direct Host before loading mapped profile data", async () => {
    const loadPublicProfile = vi.fn();

    const build = await buildMappedCustomDomainImageSitemap(
      {
        headers: {
          host: "provider.example.com/path",
          "x-forwarded-host": "provider.example.com",
        },
        mappedProfileDomainHost: "provider.example.com",
        mappedProfileDomainSlug: "sample-provider",
      } as any,
      loadPublicProfile
    );

    expect(build).toBeNull();
    expect(loadPublicProfile).not.toHaveBeenCalled();
  });

  it("binds a mapped feed to direct Host, loaded slug, and stored customDomain", async () => {
    const loadPublicProfile = vi.fn(async () => ({
      slug: "sample-provider",
      contentBlocks,
      seoMeta: {
        customDomain: "provider.example.com",
        imageUrl: PROFILE_SOCIAL_IMAGE,
      },
      updatedAt: "2026-08-25T20:00:00.000Z",
    }));

    const build = await buildMappedCustomDomainImageSitemap(
      {
        headers: {
          host: "Provider.Example.com:443",
          "x-forwarded-host": "attacker.example.com",
        },
        hostname: "attacker.example.com",
        mappedProfileDomainHost: "provider.example.com",
        mappedProfileDomainSlug: "sample-provider",
      } as any,
      loadPublicProfile
    );

    expect(loadPublicProfile).toHaveBeenCalledWith("sample-provider");
    expect(build?.xml).toContain("https://provider.example.com/");
    expect(build?.xml).not.toContain("attacker.example.com");
  });

  it.each([
    {
      label: "loaded slug",
      profile: {
        slug: "another-provider",
        contentBlocks,
        seoMeta: { customDomain: "provider.example.com" },
      },
    },
    {
      label: "stored custom domain",
      profile: {
        slug: "sample-provider",
        contentBlocks,
        seoMeta: { customDomain: "another.example.com" },
      },
    },
  ])("fails closed when the $label does not match mapped authority", async ({ profile }) => {
    const build = await buildMappedCustomDomainImageSitemap(
      {
        headers: { host: "provider.example.com" },
        mappedProfileDomainHost: "provider.example.com",
        mappedProfileDomainSlug: "sample-provider",
      } as any,
      async () => profile
    );

    expect(build).toBeNull();
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

    const mapped = makeResponse();
    attachPublicProfileImageSitemapReferences(
      {
        path: "/sitemap.xml",
        protocol: "https",
        headers: { host: "provider.example.com" },
        mappedProfileDomainHost: "provider.example.com",
        mappedProfileDomainSlug: "sample-provider",
      } as any,
      mapped.response
    );
    mapped.response.send(
      '<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>'
    );
    expect(mapped.state.body).toContain("https://www.thetradescout.com/sitemap-profile-images.xml");
    expect(mapped.state.body).not.toContain(
      "https://provider.example.com/sitemap-profile-images.xml"
    );
  });
});
