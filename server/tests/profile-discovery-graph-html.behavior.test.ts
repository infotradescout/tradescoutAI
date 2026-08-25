import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";

const mocks = vi.hoisted(() => ({
  getProfileBySlugPublic: vi.fn(),
  getBusinessPublicById: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: (...args: unknown[]) => mocks.getProfileBySlugPublic(...args),
    getBusinessPublicById: (...args: unknown[]) => mocks.getBusinessPublicById(...args),
  },
}));

import {
  buildPublicProfileHtml,
  buildPublicProfileLlmsText,
  buildPublicProfileSitemapXml,
} from "../publicProfileHtml";

const contentBlocks = [
  {
    type: "inventoryCatalog",
    data: {
      categories: [
        {
          category: "Stone",
          categorySlug: "stone",
          stones: [
            {
              name: "Named Stone",
              slug: "named-stone",
              images: ["/images/future/named-stone.jpg"],
              publicSummary: "A named material published by the public profile owner.",
            },
            {
              name: "Internal placeholder",
              nameStatus: "placeholder",
              slug: "trending-selection-04",
              images: ["/images/future/trending-selection-04.jpg"],
            },
          ],
        },
      ],
    },
  },
  {
    type: "gallery",
    data: {
      title: "Completed work",
      description: "Work records published by the public profile owner.",
      images: [
        "/images/future/generic-gallery-photo.jpg",
        {
          id: "completed-stone-installation",
          imageUrl: "/images/future/completed-stone-installation.jpg",
          title: "Completed stone installation",
          description:
            "A source-backed completed project record published by the public profile owner.",
        },
      ],
    },
  },
] as const;

const profileRecord = {
  id: "profile-future",
  slug: "future-profile",
  displayName: "Future Profile",
  headline: "Published materials and completed work.",
  roleContext: "business_owner",
  servicesDescription: "Named materials and source-backed completed project records.",
  businessId: null,
  updatedAt: "2026-08-25T00:00:00.000Z",
  seoMeta: {
    title: "Future Profile",
    description: "Named materials and completed work from Future Profile.",
    customDomain: "profile.example",
  },
  ctaConfig: {
    primary: { label: "Start a Request" },
  },
  profileBooking: null,
  contentBlocks: [...contentBlocks],
};

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

function publicGalleryItems() {
  return listProfileGalleryItems(contentBlocks);
}

describe("automatic public profile discovery graph", () => {
  beforeEach(() => {
    mocks.getProfileBySlugPublic.mockReset();
    mocks.getBusinessPublicById.mockReset();
    mocks.getProfileBySlugPublic.mockResolvedValue(profileRecord);
    mocks.getBusinessPublicById.mockResolvedValue(null);
  });

  it("uses the shared child graph for a custom-domain sitemap", async () => {
    const gallery = publicGalleryItems();
    const genericPhoto = gallery[0];
    const completedProject = gallery[1];
    const xml = await buildPublicProfileSitemapXml({
      slug: "future-profile",
      origin: "https://profile.example",
    });

    expect(xml).toContain("<loc>https://profile.example/</loc>");
    expect(xml).toContain("<loc>https://profile.example/categories/stone</loc>");
    expect(xml).toContain("<loc>https://profile.example/inventory/named-stone</loc>");
    expect(xml).toContain(
      `<loc>https://profile.example/gallery/${completedProject.slug}</loc>`
    );
    expect(xml).not.toContain("trending-selection-04");
    expect(xml).not.toContain(genericPhoto.slug);
  });

  it("lists the same public child pages in host-local discovery guidance", async () => {
    const gallery = publicGalleryItems();
    const genericPhoto = gallery[0];
    const completedProject = gallery[1];
    const text = await buildPublicProfileLlmsText({
      slug: "future-profile",
      origin: "https://profile.example",
    });

    expect(text).toContain("## Published profile pages");
    expect(text).toContain("- https://profile.example/categories/stone");
    expect(text).toContain("- https://profile.example/inventory/named-stone");
    expect(text).toContain(`- https://profile.example/gallery/${completedProject.slug}`);
    expect(text).not.toContain("trending-selection-04");
    expect(text).not.toContain(genericPhoto.slug);
  });

  it("links every public category, inventory, and project page from initial profile HTML", async () => {
    const gallery = publicGalleryItems();
    const genericPhoto = gallery[0];
    const completedProject = gallery[1];
    const html = await buildPublicProfileHtml({
      slug: "future-profile",
      origin: "https://profile.example",
      templateHtml,
    });

    expect(html).toContain('href="https://profile.example/categories/stone"');
    expect(html).toContain('href="https://profile.example/inventory/named-stone"');
    expect(html).toContain(
      `href="https://profile.example/gallery/${completedProject.slug}"`
    );
    expect(html).toContain('data-seo-profile-gallery-links="true"');
    expect(html).not.toContain("trending-selection-04");
    expect(html).not.toContain(genericPhoto.slug);
  });

  it("links every public inventory child from its category page", async () => {
    const html = await buildPublicProfileHtml({
      slug: "future-profile",
      origin: "https://profile.example",
      templateHtml,
      categorySlug: "stone",
    });

    expect(html).toContain('data-seo-profile-category="stone"');
    expect(html).toContain('data-seo-profile-category-items="true"');
    expect(html).toContain('href="https://profile.example/inventory/named-stone"');
    expect(html).toContain("1 current selection");
    expect(html).not.toContain("trending-selection-04");
  });

  it("links a public project page back to the parent profile", async () => {
    const completedProject = publicGalleryItems()[1];
    const html = await buildPublicProfileHtml({
      slug: "future-profile",
      origin: "https://profile.example",
      templateHtml,
      gallerySlug: completedProject.slug,
    });

    expect(html).toContain(`data-seo-profile-item="gallery"`);
    expect(html).toContain('data-seo-profile-home="true"');
    expect(html).toContain('href="https://profile.example/"');
    expect(html).toContain("Back to Future Profile");
  });
});
