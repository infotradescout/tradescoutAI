import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";

const mocks = vi.hoisted(() => ({
  getBusinessProfileBySlug: vi.fn(),
  getBusinessBySlugPublic: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getBusinessProfileBySlug: mocks.getBusinessProfileBySlug,
    getBusinessBySlugPublic: mocks.getBusinessBySlugPublic,
  },
}));

vi.mock("../db", () => ({
  db: {},
}));

import { buildPublicBusinessHtml } from "../publicBusinessHtml";

const templateHtml = `<!doctype html>
<html>
  <head>
    <title>TradeScout</title>
    <meta name="description" content="TradeScout" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="TradeScout" />
    <meta property="og:description" content="TradeScout" />
    <meta property="og:url" content="https://www.thetradescout.com" />
    <meta property="og:image" content="/tradescout-social-preview.png" />
    <meta property="og:image:secure_url" content="/tradescout-social-preview.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="TradeScout" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="TradeScout" />
    <meta name="twitter:description" content="TradeScout" />
    <meta name="twitter:image" content="/tradescout-social-preview.png" />
    <meta name="twitter:image:alt" content="TradeScout" />
    <link rel="canonical" href="https://www.thetradescout.com" />
  </head>
  <body><div id="root"></div></body>
</html>`;

const galleryBlock = {
  id: "recent-patios",
  type: "gallery",
  title: "Recent Patios",
  body: "Selected natural stone patio work.",
  imageUrl: "/uploads/business/blue-stone-patio.jpg",
};

const publicProfile = {
  id: "business-profile-1",
  userId: "private-owner-id",
  slug: "river-city-masonry",
  name: "River City Masonry",
  headline: "Natural stone craftsmanship",
  description: "Local masonry services.",
  services: ["Patios", "Stonework"],
  countyFips: "47065",
  countyName: "Hamilton County",
  city: "Chattanooga",
  stateCode: "TN",
  serviceAreas: ["47065"],
  website: null,
  seoMeta: null,
  contentBlocks: [galleryBlock],
  bookingConfig: null,
  customDomainVerification: null,
  verificationStatus: "approved",
  addressVerified: true,
  visibility: "public",
};

describe("public business gallery HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBusinessProfileBySlug.mockResolvedValue(publicProfile);
    mocks.getBusinessBySlugPublic.mockResolvedValue(undefined);
  });

  it("uses the exact gallery picture and selector in social metadata", async () => {
    const galleryItem = listProfileGalleryItems([galleryBlock])[0];
    const html = await buildPublicBusinessHtml({
      slug: "river-city-masonry",
      origin: "https://www.thetradescout.com",
      templateHtml,
      gallerySlug: galleryItem.slug,
    });

    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/business/blue-stone-patio.jpg"'
    );
    expect(html).toContain(
      `property="og:url" content="https://www.thetradescout.com/business/river-city-masonry?gallery=${galleryItem.slug}"`
    );
    expect(html).toContain(
      `link rel="canonical" href="https://www.thetradescout.com/business/river-city-masonry?gallery=${galleryItem.slug}"`
    );
    expect(html).toContain(`data-seo-business-gallery="${galleryItem.slug}"`);
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).not.toContain('property="og:image:width"');
    expect(html).not.toContain('property="og:image:height"');
    expect(html).not.toContain("private-owner-id");
  });

  it("does not render a private business profile into public HTML", async () => {
    mocks.getBusinessProfileBySlug.mockResolvedValueOnce({
      ...publicProfile,
      visibility: "private",
    });

    await expect(
      buildPublicBusinessHtml({
        slug: "river-city-masonry",
        origin: "https://www.thetradescout.com",
        templateHtml,
        gallerySlug: "recent-patios-private",
      })
    ).resolves.toBeNull();
  });
});
