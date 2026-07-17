import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";

const profileRecord = {
  id: "profile-jw",
  slug: "jw-stone",
  displayName: "JW Stone LLC",
  headline: "Natural stone inventory",
  roleContext: "wholesaler",
  servicesDescription: "Browse current stone inventory.",
  businessId: "business-jw",
  seoMeta: {
    title: "JW Stone LLC",
    description: "JW Stone inventory in Chattanooga.",
    imageUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
    imageWidth: 1200,
    imageHeight: 630,
    faviconUrl: "https://www.thetradescout.com/images/businesses/jw-stone/favicon.png",
    customDomain: "jwstonelogistics.com",
  },
  profileBooking: null,
  contentBlocks: [] as any[],
};

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async () => profileRecord),
    getBusinessPublicById: vi.fn(async () => ({
      id: "business-jw",
      name: "JW Stone LLC",
      categories: ["Stone wholesaler"],
      serviceAreas: ["Hamilton County"],
      tradePartner: true,
    })),
  },
}));

import { buildPublicProfileHtml } from "../publicProfileHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("public profile item HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileRecord.slug = "jw-stone";
    profileRecord.displayName = "JW Stone LLC";
    profileRecord.businessId = "business-jw";
    profileRecord.seoMeta.customDomain = "jwstonelogistics.com";
    profileRecord.contentBlocks = [];
  });

  it("renders product-specific social metadata for the exact shared JW stone photo", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "blue-dunes",
      itemPhoto: "2",
    });

    expect(html).toContain('property="og:title" content="Blue Dunes at JW Stone LLC | TradeScout"');
    expect(html).toContain(
      'property="og:image" content="https://jwstonelogistics.com/images/businesses/jw-stone/inventory-source/1Hu2IWdWPGlItZtAxdAQFgnK3stA7DWE9.webp"'
    );
    expect(html).toContain(
      'property="og:url" content="https://jwstonelogistics.com/?stone=blue-dunes&amp;photo=2"'
    );
    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain(
      'link rel="canonical" href="https://jwstonelogistics.com/?stone=blue-dunes&amp;photo=2"'
    );
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain('property="og:image:height"');
    expect(html).toContain('data-seo-profile-item="inventory"');
    expect(html).toContain('"@type":"Product"');
  });

  it("uses the normal profile metadata for an unknown item", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "not-a-real-stone",
    });

    expect(html).toContain('property="og:title" content="JW Stone LLC | TradeScout"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png"'
    );
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).not.toContain('data-seo-profile-item="inventory"');
  });

  it("renders image-specific social metadata for an exact shared gallery item", async () => {
    profileRecord.contentBlocks = [
      {
        id: "recent-work",
        type: "gallery",
        data: {
          title: "Recent Work",
          images: [
            {
              id: "blue-stone-patio",
              url: "/uploads/profiles/blue-stone-patio.jpg",
              title: "Blue Stone Patio",
              caption: "A finished local patio installation.",
              alt: "Finished blue stone patio",
            },
          ],
        },
      },
    ];
    const galleryItem = listProfileGalleryItems(profileRecord.contentBlocks)[0];

    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      gallerySlug: galleryItem.slug,
    });

    expect(html).toContain(
      'property="og:title" content="Blue Stone Patio | JW Stone LLC | TradeScout"'
    );
    expect(html).toContain(
      'property="og:image" content="https://jwstonelogistics.com/uploads/profiles/blue-stone-patio.jpg"'
    );
    expect(html).toContain(
      `property="og:url" content="https://jwstonelogistics.com/?gallery=${galleryItem.slug}"`
    );
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(
      `link rel="canonical" href="https://jwstonelogistics.com/?gallery=${galleryItem.slug}"`
    );
    expect(html).toContain("Your contact details stay private until you choose to connect.");
    expect(html).toContain('data-seo-profile-item="gallery"');
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain('property="og:image:height"');
  });

  it("renders JR's exact before-photo preview from its paid profile share link", async () => {
    profileRecord.slug = "jrs-auto-glass";
    profileRecord.displayName = "JR's Auto Glass";
    profileRecord.businessId = "";
    profileRecord.seoMeta.customDomain = "";
    profileRecord.contentBlocks = [...JRS_AUTO_GLASS_GALLERY_BLOCKS] as any[];
    const beforeItem = listProfileGalleryItems(profileRecord.contentBlocks)[0];

    const html = await buildPublicProfileHtml({
      slug: "jrs-auto-glass",
      origin: "https://www.thetradescout.com",
      templateHtml,
      gallerySlug: beforeItem.slug,
    });

    expect(html).toContain(
      'property="og:title" content="Windshield before replacement | JR&#39;s Auto Glass | TradeScout"'
    );
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/images/businesses/jrs-auto-glass/before.webp"'
    );
    expect(html).toContain(
      `property="og:url" content="https://www.thetradescout.com/u/jrs-auto-glass?gallery=${beforeItem.slug}"`
    );
    expect(html).toContain('data-seo-profile-item="gallery"');
    expect(html).toContain('"@type":"ImageObject"');
  });
});
