import { beforeEach, describe, expect, it, vi } from "vitest";
import { listContractorProjectPhotos } from "@shared/contractorPhotoShare";

const mocks = vi.hoisted(() => ({
  getContractorBySlug: vi.fn(),
  getBusinessProfileByUserId: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getContractorBySlug: mocks.getContractorBySlug,
    getBusinessProfileByUserId: mocks.getBusinessProfileByUserId,
  },
}));

import { buildPublicContractorProfileHtml } from "../publicContractorProfileHtml";

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

const contractor = {
  id: "contractor-1",
  userId: "private-owner-id",
  businessId: "private-business-id",
  companyName: "River City Masonry",
  slug: "river-city-masonry",
  phone: "555-0100",
  email: "private@example.com",
  insuranceDocUrl: "/private/insurance.pdf",
  website: "https://rivercity.example",
  yearsInBusiness: 12,
  about: "Local natural-stone craftsmanship.",
  photos: ["/uploads/contractors/blue-stone-patio.webp"],
  verifiedLicensed: true,
  verifiedInsured: true,
  isActive: true,
};

function readJsonLd(html: string) {
  const match = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  expect(match).not.toBeNull();
  if (!match) throw new Error("Expected JSON-LD");
  return JSON.parse(match[1]);
}

describe("public contractor profile HTML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContractorBySlug.mockResolvedValue(contractor);
    mocks.getBusinessProfileByUserId.mockResolvedValue(null);
  });

  it("uses the exact selected project photo in crawler metadata", async () => {
    const item = listContractorProjectPhotos(contractor.photos)[0];
    const result = await buildPublicContractorProfileHtml({
      slug: contractor.slug,
      origin: "https://www.thetradescout.com",
      templateHtml,
      gallerySlug: item.slug,
    });

    expect(result?.kind).toBe("html");
    if (!result || result.kind !== "html") throw new Error("Expected rendered HTML");
    expect(result.html).toContain('property="og:type" content="article"');
    expect(result.html).toContain(
      'property="og:image" content="https://www.thetradescout.com/uploads/contractors/blue-stone-patio.webp"'
    );
    expect(result.html).toContain(
      `property="og:url" content="https://www.thetradescout.com/contractors/river-city-masonry?gallery=${item.slug}"`
    );
    expect(result.html).toContain(
      `link rel="canonical" href="https://www.thetradescout.com/contractors/river-city-masonry?gallery=${item.slug}"`
    );
    expect(result.html).toContain('name="twitter:card" content="summary_large_image"');
    expect(result.html).toContain('"@type":"ImageObject"');
    const jsonLd = readJsonLd(result.html);
    const localBusiness = jsonLd["@graph"][0];
    expect(localBusiness.address).toBeUndefined();
    expect(localBusiness.areaServed).toBeUndefined();
    expect(localBusiness.priceRange).toBeUndefined();
    expect(localBusiness.hasCredential).toBeUndefined();
    expect(result.html).toContain('content="contractor-photo"');
    expect(result.html).not.toContain('property="og:image:width"');
    expect(result.html).not.toContain("private-owner-id");
    expect(result.html).not.toContain("private@example.com");
    expect(result.html).not.toContain("/private/insurance.pdf");
  });

  it("uses only source-backed facts in base-profile crawler metadata", async () => {
    const result = await buildPublicContractorProfileHtml({
      slug: contractor.slug,
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(result?.kind).toBe("html");
    if (!result || result.kind !== "html") throw new Error("Expected rendered HTML");
    const jsonLd = readJsonLd(result.html);
    expect(jsonLd).toMatchObject({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "River City Masonry",
      url: "https://www.thetradescout.com/contractors/river-city-masonry",
      image: "https://www.thetradescout.com/uploads/contractors/blue-stone-patio.webp",
      sameAs: ["https://rivercity.example"],
    });
    expect(jsonLd.address).toBeUndefined();
    expect(jsonLd.areaServed).toBeUndefined();
    expect(jsonLd.priceRange).toBeUndefined();
    expect(jsonLd.hasCredential).toBeUndefined();
    expect(result.html).toContain("River City Masonry - Local Provider | TradeScout");
    expect(result.html).not.toContain("Verified Local Provider");
  });

  it("redirects only the base legacy profile to a richer public business profile", async () => {
    mocks.getBusinessProfileByUserId.mockResolvedValue({
      slug: "river-city-masonry-business",
      visibility: "public",
    });

    await expect(
      buildPublicContractorProfileHtml({
        slug: contractor.slug,
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toEqual({
      kind: "redirect",
      location: "/business/river-city-masonry-business",
    });
  });

  it("keeps an exact photo share intact even when a richer profile exists", async () => {
    mocks.getBusinessProfileByUserId.mockResolvedValue({
      slug: "river-city-masonry-business",
      visibility: "public",
    });
    const item = listContractorProjectPhotos(contractor.photos)[0];

    const result = await buildPublicContractorProfileHtml({
      slug: contractor.slug,
      origin: "https://www.thetradescout.com",
      templateHtml,
      gallerySlug: item.slug,
    });

    expect(result?.kind).toBe("html");
    expect(mocks.getBusinessProfileByUserId).not.toHaveBeenCalled();
  });

  it("does not render inactive, missing, or malformed contractor records", async () => {
    mocks.getContractorBySlug.mockResolvedValueOnce({ ...contractor, isActive: false });
    await expect(
      buildPublicContractorProfileHtml({
        slug: contractor.slug,
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();

    await expect(
      buildPublicContractorProfileHtml({
        slug: "../private",
        origin: "https://www.thetradescout.com",
        templateHtml,
      })
    ).resolves.toBeNull();
  });
});
