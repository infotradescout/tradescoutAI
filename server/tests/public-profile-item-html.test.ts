import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProfileGalleryItems } from "@shared/profileGalleryShare";
import { listProfileInventoryCategories } from "@shared/profileCategoryShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import { JRS_AUTO_GLASS_GALLERY_BLOCKS } from "@shared/jrsAutoGlassProfile";
import { JW_STONE_SOCIAL_PRESENTATION } from "@shared/jwStonePresentation";
import { ISSA_BUILD_PROFILE_CONTENT_BLOCKS } from "@shared/issaBuildProfile";
import { JW_STONE_PUBLIC_DISCOVERY_BLOCK } from "../../client/src/data/jwStoneProfilePresentation";
import { inventoryCategoriesForProfile } from "../profileItemShareMetadata";

const jwSocialPresentationBlock = {
  type: "profilePresentation",
  data: {
    social: {
      ...JW_STONE_SOCIAL_PRESENTATION,
    },
  },
};
const jwPublicDiscoveryBlock = JW_STONE_PUBLIC_DISCOVERY_BLOCK;

const profileRecord = {
  id: "profile-jw",
  slug: "jw-stone",
  displayName: "JW Stone LLC",
  headline: "Natural stone inventory",
  roleContext: "wholesaler",
  servicesDescription: "Browse current stone inventory.",
  businessId: "business-jw",
  updatedAt: "2026-06-15T14:30:00.000Z",
  seoMeta: {
    title: "JW Stone LLC",
    description: "JW Stone inventory in Chattanooga.",
    imageUrl: "https://www.thetradescout.com/images/businesses/jw-stone/logo-social-preview.png",
    imageWidth: 1200,
    imageHeight: 630,
    faviconUrl: "https://www.thetradescout.com/images/businesses/jw-stone/favicon.png",
    customDomain: "jwstonelogistics.com",
  },
  ctaConfig: {},
  profileBooking: null as any,
  contentBlocks: [jwSocialPresentationBlock, jwPublicDiscoveryBlock] as any[],
};

const businessRecord = {
  id: "business-jw",
  name: "JW Stone LLC",
  categories: ["Stone wholesaler"],
  serviceAreas: ["Hamilton County"],
  tradePartner: true,
};

vi.mock("../storage", () => ({
  storage: {
    getProfileBySlugPublic: vi.fn(async () => profileRecord),
    getBusinessPublicById: vi.fn(async () => businessRecord),
  },
}));

import {
  buildPublicProfileEarlyHtml,
  buildPublicProfileHtml,
  buildPublicProfileLlmsText,
  buildPublicProfileSitemapXml,
} from "../publicProfileHtml";

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
    profileRecord.headline = "Natural stone inventory";
    profileRecord.roleContext = "wholesaler";
    profileRecord.servicesDescription = "Browse current stone inventory.";
    profileRecord.businessId = "business-jw";
    profileRecord.seoMeta.title = "JW Stone LLC";
    profileRecord.seoMeta.description = "JW Stone inventory in Chattanooga.";
    profileRecord.seoMeta.customDomain = "jwstonelogistics.com";
    profileRecord.profileBooking = null;
    profileRecord.contentBlocks = [jwSocialPresentationBlock, jwPublicDiscoveryBlock];
    businessRecord.name = "JW Stone LLC";
    businessRecord.categories = ["Stone wholesaler"];
    businessRecord.serviceAreas = ["Hamilton County"];
    businessRecord.tradePartner = true;
  });

  it("renders a privacy-safe unavailable page when a public profile link is not public", () => {
    const html = buildPublicProfileEarlyHtml({
      slug: "new-local-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain("This public profile is not available.");
    expect(html).not.toContain("No private account details are exposed here.");
    expect(html).not.toContain("Private account details stay protected");
    expect(html).not.toContain("private account exists");
    expect(html).toContain("Browse the Community");
    expect(html).toContain("Open Scout");
    expect(html).toContain("Report this link");
    expect(html).toContain('href="https://www.thetradescout.com/community-feed"');
    expect(html).toContain('data-public-profile-state="unavailable"');
    expect(html).toContain('content="noindex,follow"');
    expect(html).toContain('href="https://www.thetradescout.com/u/new-local-business"');
    expect(html).not.toContain("Profile not found");
    expect(html).not.toMatch(/opening soon|opening day|finishing touches|finished profile/i);
  });

  it("renders a context-aware social card while retaining the exact shared JW stone photo", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "blue-dunes",
      itemPhoto: "2",
    });
    const sourceImageUrl =
      "https://jwstonelogistics.com/images/businesses/jw-stone/inventory-source/1Hu2IWdWPGlItZtAxdAQFgnK3stA7DWE9.webp";

    expect(html).toContain('property="og:title" content="Blue Dunes Granite | JW Stone Logistics"');
    expect(html).toContain(
      'property="og:description" content="View Blue Dunes (Granite) in JW Stone LLC&#39;s material library. See this photo."'
    );
    expect(html).toMatch(
      /property="og:image" content="https:\/\/www\.thetradescout\.com\/images\/social\/profile\/jw-stone\/inventory\/blue-dunes\.png\?photo=2&amp;v=4-[a-z0-9]+"/
    );
    expect(html).toContain(
      'property="og:url" content="https://jwstonelogistics.com/stones/blue-dunes?photo=2"'
    );
    expect(html).toContain('property="og:type" content="product"');
    expect(html).toContain(
      'link rel="canonical" href="https://jwstonelogistics.com/stones/blue-dunes?photo=2"'
    );
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).not.toContain(`property="og:image" content="${sourceImageUrl}"`);
    expect(html).toContain('data-seo-profile-item="inventory"');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain(`"image":["${sourceImageUrl}"]`);
    expect(html).toContain(`<img src="${sourceImageUrl}"`);
    expect(html).toContain('"brand":{"@id":"https://jwstonelogistics.com/#identity"}');
    expect(html).not.toContain('"brand":{"@type":"Organization"');
  });

  it("renders ISSA Build materials as permanent offerings with owned search language", async () => {
    profileRecord.slug = "issa-build";
    profileRecord.displayName = "ISSA Build";
    profileRecord.headline = "Crafted for light.";
    profileRecord.roleContext = "business_owner";
    profileRecord.servicesDescription = "Custom translucent onyx for interiors.";
    profileRecord.seoMeta.title = "ISSA Build | Luxury Translucent Onyx";
    profileRecord.seoMeta.description =
      "Honey Onyx and Multi Green Onyx for residential and commercial interiors.";
    profileRecord.seoMeta.customDomain = "";
    profileRecord.contentBlocks = [...ISSA_BUILD_PROFILE_CONTENT_BLOCKS] as any[];
    businessRecord.name = "ISSA Build";
    businessRecord.categories = ["Natural Onyx"];
    businessRecord.serviceAreas = [];

    const itemHtml = await buildPublicProfileHtml({
      slug: "issa-build",
      origin: "https://www.thetradescout.com",
      templateHtml,
      itemSlug: "honey-onyx",
    });
    const categoryHtml = await buildPublicProfileHtml({
      slug: "issa-build",
      origin: "https://www.thetradescout.com",
      templateHtml,
      categorySlug: "onyx",
    });

    expect(itemHtml).toContain('property="og:title" content="Honey Onyx | ISSA Build"');
    expect(itemHtml).toContain(
      'property="og:description" content="Warm amber, translucent Honey Onyx from ISSA Build for custom backlit counters, walls, floors, stairs, and residential or commercial interiors."'
    );
    expect(itemHtml).toContain('"@type":"Product"');
    expect(itemHtml).toContain("Featured materials");
    expect(itemHtml).toContain("Explore materials");
    expect(itemHtml).not.toMatch(/Honey Onyx Onyx|current inventory|pricing or availability/i);

    expect(categoryHtml).toContain('property="og:title" content="Translucent Onyx | ISSA Build"');
    expect(categoryHtml).toContain(
      "Explore ISSA Build&#39;s Honey Onyx and Multi Green Onyx as distinct translucent materials"
    );
    expect(categoryHtml).toContain("2 published materials");
    expect(categoryHtml).not.toMatch(/current inventory|pricing or availability/i);
    expect(`${itemHtml}\n${categoryHtml}`).not.toMatch(
      /@thetradescout\.com|\b\d{3}[-.)\s]+\d{3}[-.\s]+\d{4}\b/i
    );
  });

  it("keeps a synthetic JW stone route public without inventing a public item name", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "trending-selection-05",
    });

    expect(html).toContain(
      'link rel="canonical" href="https://jwstonelogistics.com/stones/trending-selection-05"'
    );
    expect(html).toContain('property="og:title" content="JW Stone Logistics"');
    expect(html).toContain('property="og:type" content="website"');
    expect(html).toContain('data-seo-profile-item="inventory"');
    expect(html).toContain("See this photo.");
    expect(html).not.toContain("request current availability");
    expect(html).toContain("Stone selection — JW Stone LLC inventory photo");
    expect(html).not.toContain("Trending Selection 05");
    expect(html).not.toContain("Unnamed slab");
    expect(html).not.toContain('"@type":"Product"');
    expect(html).not.toContain("<h2></h2>");
    expect(html).toContain('"mainEntity":{"@id":"https://jwstonelogistics.com/#identity"}');
  });

  it("does not turn a person's shared product into an Organization", async () => {
    profileRecord.businessId = "";
    profileRecord.seoMeta.customDomain = "";

    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://www.thetradescout.com",
      templateHtml,
      itemSlug: "blue-dunes",
    });

    expect(html).toContain('"@type":"Person"');
    expect(html).toContain('"@id":"https://www.thetradescout.com/u/jw-stone#identity"');
    expect(html).toContain('"@type":"Product"');
    expect(html).not.toContain('"brand"');
    expect(html).toContain(
      '"@type":"Organization","@id":"https://www.thetradescout.com/#organization","name":"TradeScout"'
    );
    expect(html).toContain(
      '"mainEntity":{"@id":"https://www.thetradescout.com/u/jw-stone/stones/blue-dunes#product"}'
    );
    expect(html).toContain('"publisher":{"@id":"https://www.thetradescout.com/#organization"}');
    expect(html).toContain('"provider":{"@id":"https://www.thetradescout.com/#organization"}');
  });

  it("falls back to the context-aware profile card for an unknown item", async () => {
    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "not-a-real-stone",
    });

    expect(html).toContain('property="og:title" content="JW Stone Logistics"');
    expect(html).toMatch(
      /property="og:image" content="https:\/\/www\.thetradescout\.com\/images\/social\/profile\/jw-stone\.png\?v=4-[a-z0-9]+"/
    );
    expect(html).toContain('property="og:url" content="https://jwstonelogistics.com/"');
    expect(html).toContain('link rel="canonical" href="https://jwstonelogistics.com/"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).not.toContain('data-seo-profile-item="inventory"');
  });

  it("gives a legacy JW root row a new brand-hero cache key without changing other profiles", async () => {
    const readOgImage = (html: string) =>
      html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "";

    profileRecord.contentBlocks = [jwPublicDiscoveryBlock];
    const brandHeroHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });

    profileRecord.contentBlocks = [
      {
        type: "profilePresentation",
        data: {
          social: {
            ...JW_STONE_SOCIAL_PRESENTATION,
            cardLayout: "split",
          },
        },
      },
      jwPublicDiscoveryBlock,
    ];
    const splitHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });

    expect(brandHeroHtml).toContain('property="og:title" content="JW Stone Logistics"');
    expect(readOgImage(brandHeroHtml!)).not.toBe(readOgImage(splitHtml!));

    profileRecord.slug = "other-business";
    profileRecord.displayName = "Other Business";
    profileRecord.seoMeta.title = "Other Business";
    profileRecord.seoMeta.customDomain = "";
    profileRecord.contentBlocks = [];
    businessRecord.name = "Other Business";
    const otherHtml = await buildPublicProfileHtml({
      slug: "other-business",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(otherHtml).toContain('property="og:title" content="Other Business"');
    expect(otherHtml).not.toContain('property="og:title" content="JW Stone Logistics"');
    expect(readOgImage(otherHtml!)).toContain("/images/social/profile/other-business.png");
  });

  it("versions profile cards by the profile-owned image without changing item cards", async () => {
    const withProfileImage = (profileImageUrl: string) => [
      {
        type: "profilePresentation",
        data: {
          social: {
            ...jwSocialPresentationBlock.data.social,
            profileImageUrl,
          },
        },
      },
    ];
    const readOgImage = (html: string) =>
      html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || "";

    profileRecord.contentBlocks = withProfileImage(
      "/images/businesses/jw-stone/video/hero-poster.jpg"
    );
    const firstProfileHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });
    const firstItemHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "blue-dunes",
      itemPhoto: "2",
    });

    profileRecord.contentBlocks = withProfileImage(
      "/images/businesses/jw-stone/video/alternate-hero-poster.jpg"
    );
    const secondProfileHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });
    const secondItemHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
      itemSlug: "blue-dunes",
      itemPhoto: "2",
    });

    expect(readOgImage(firstProfileHtml!)).not.toBe(readOgImage(secondProfileHtml!));
    expect(readOgImage(firstItemHtml!)).toBe(readOgImage(secondItemHtml!));
  });

  it("keeps visible and structured profile identity aligned to the canonical business", async () => {
    profileRecord.displayName = "Owner account name";

    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://www.thetradescout.com",
      templateHtml,
    });

    expect(html).toContain("<h1>JW Stone LLC</h1>");
    expect(html).not.toContain("<h1>Owner account name</h1>");
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain('"@id":"https://jwstonelogistics.com/#identity"');
    expect(html).toContain('"name":"JW Stone LLC"');
  });

  it("removes contact, exact-address, and URL text from indexed profile HTML", async () => {
    businessRecord.name = "JW Stone LLC 423-555-0188";
    profileRecord.seoMeta.title = "Call JW Stone at 423-555-0199";
    profileRecord.seoMeta.description =
      "Email owner@example.com or visit https://private.example at 123 Main Street.";
    profileRecord.headline = "Call (423) 555-0102 for stone planning";
    profileRecord.servicesDescription =
      "Installations at 456 Market Ave. Details at www.vendor.example.";
    businessRecord.categories = ["Stone wholesaler", "Email category@example.com"];
    businessRecord.serviceAreas = ["Hamilton County, TN"];
    profileRecord.contentBlocks = [
      jwSocialPresentationBlock,
      {
        type: "faq",
        data: {
          faqs: [
            {
              question: "Can I call 423-555-0144?",
              answer: "Email estimator@example.com or visit 789 Broad Street.",
            },
          ],
        },
      },
    ];

    const html = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });

    expect(html).toContain("JW Stone");
    expect(html).toContain("Stone wholesaler");
    expect(html).toContain("Hamilton County, TN");
    expect(html).toContain("Continue through TradeScout");
    expect(html).not.toMatch(
      /423-555-0188|423-555-0199|423\) 555-0102|423-555-0144|owner@example|estimator@example|category@example/
    );
    expect(html).not.toMatch(
      /123 Main Street|456 Market Ave|789 Broad Street|private\.example|vendor\.example/
    );
  });

  it("sanitizes indexed gallery descriptions without removing the real item", async () => {
    profileRecord.contentBlocks = [
      jwPublicDiscoveryBlock,
      {
        id: "recent-work",
        type: "gallery",
        data: {
          title: "Recent Work",
          images: [
            {
              id: "finished-patio",
              url: "/uploads/profiles/finished-patio.jpg",
              title: "Finished Patio",
              caption: "Email patio@example.com or visit 42 River Road.",
              alt: "Call 423-555-0177 about this patio",
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

    expect(html).toContain("Finished Patio");
    expect(html).toContain("Continue through TradeScout");
    expect(html).not.toMatch(/patio@example|42 River Road|423-555-0177/);
  });

  it("omits unsupported booking claims and never invents a zero-dollar deposit", async () => {
    const disabledHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });
    expect(disabledHtml).not.toContain("Appointments are coming soon");
    expect(disabledHtml).not.toContain("Appointments are available");

    profileRecord.profileBooking = {
      enabled: true,
      paidBookings: true,
      bookingPriceUsd: 0,
      pricingTableEnabled: false,
      pricingRows: [],
    };
    const missingPriceHtml = await buildPublicProfileHtml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
      templateHtml,
    });
    expect(missingPriceHtml).toContain("Appointments are available.");
    expect(missingPriceHtml).not.toContain("Booking deposit");
    expect(missingPriceHtml).not.toContain("$0.00");
  });

  it("renders a context-aware gallery card while retaining the exact source image", async () => {
    profileRecord.contentBlocks = [
      jwSocialPresentationBlock,
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
    const sourceImageUrl = "https://jwstonelogistics.com/uploads/profiles/blue-stone-patio.jpg";

    expect(html).toContain('property="og:title" content="Blue Stone Patio | JW Stone Logistics"');
    expect(html).toContain(
      'property="og:description" content="View Blue Stone Patio from JW Stone Logistics."'
    );
    expect(html).toMatch(
      new RegExp(
        `property="og:image" content="https://www\\.thetradescout\\.com/images/social/profile/jw-stone/gallery/${galleryItem.slug}\\.png\\?v=4-[a-z0-9]+"`
      )
    );
    expect(html).toContain(
      `property="og:url" content="https://jwstonelogistics.com/gallery/${galleryItem.slug}"`
    );
    expect(html).toContain('property="og:type" content="article"');
    expect(html).toContain(
      `link rel="canonical" href="https://jwstonelogistics.com/gallery/${galleryItem.slug}"`
    );
    expect(html).not.toContain(`property="og:image" content="${sourceImageUrl}"`);
    expect(html).toContain('data-seo-profile-item="gallery"');
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).toContain(`"contentUrl":"${sourceImageUrl}"`);
    expect(html).toContain(`<img src="${sourceImageUrl}"`);
    expect(html).toContain('"creator":{"@id":"https://jwstonelogistics.com/#identity"}');
    expect(html).not.toContain('"creator":{"@type":"Organization"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
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
    const sourceImageUrl =
      "https://www.thetradescout.com/images/businesses/jrs-auto-glass/before.webp";

    expect(html).toContain(
      'property="og:title" content="Windshield before replacement | JR&#39;s Auto Glass"'
    );
    expect(html).toMatch(
      new RegExp(
        `property="og:image" content="https://www\\.thetradescout\\.com/images/social/profile/jrs-auto-glass/gallery/${beforeItem.slug}\\.png\\?v=4-[a-z0-9]+"`
      )
    );
    expect(html).toContain(
      `property="og:url" content="https://www.thetradescout.com/u/jrs-auto-glass/gallery/${beforeItem.slug}"`
    );
    expect(html).toContain(
      `link rel="canonical" href="https://www.thetradescout.com/u/jrs-auto-glass/gallery/${beforeItem.slug}"`
    );
    expect(html).not.toContain(`property="og:image" content="${sourceImageUrl}"`);
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('data-seo-profile-item="gallery"');
    expect(html).toContain('"@type":"ImageObject"');
    expect(html).toContain(`"contentUrl":"${sourceImageUrl}"`);
    expect(html).toContain(`<img src="${sourceImageUrl}"`);
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain(
      '"creator":{"@id":"https://www.thetradescout.com/u/jrs-auto-glass#identity"}'
    );
    expect(html).toContain(
      '"@type":"Organization","@id":"https://www.thetradescout.com/#organization","name":"TradeScout"'
    );
    expect(html).toContain(
      `"mainEntity":{"@id":"https://www.thetradescout.com/u/jrs-auto-glass/gallery/${beforeItem.slug}#image"}`
    );
    expect(html).toContain('"publisher":{"@id":"https://www.thetradescout.com/#organization"}');
  });

  it("builds profile-specific LLM guidance without direct contact or exact-address text", async () => {
    businessRecord.name = "JW Stone LLC 423-555-0188";
    businessRecord.categories = [
      "Stone wholesaler",
      "Email category@example.com or visit jwstone.example",
    ];
    businessRecord.serviceAreas = ["Hamilton County", "123 Main Street"];
    profileRecord.seoMeta.description =
      "Call 423-555-0199, email owner@example.com, visit https://private.example or 123 Main Street.";
    profileRecord.servicesDescription = "Installations at 456 Market Ave. See www.vendor.example.";
    profileRecord.contentBlocks = [
      jwPublicDiscoveryBlock,
      {
        type: "services",
        data: {
          items: [
            {
              title: "Stone planning",
              description: "Write estimator@example.com or call (423) 555-0102.",
            },
          ],
        },
      },
    ];

    const guidance = await buildPublicProfileLlmsText({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
    });

    expect(guidance).toContain("# JW Stone LLC Continue through TradeScout");
    expect(guidance).toContain("- Stone wholesaler");
    expect(guidance).toContain("- Hamilton County");
    expect(guidance).toContain("Canonical: https://jwstonelogistics.com/");
    expect(guidance).toContain("Robots: https://jwstonelogistics.com/robots.txt");
    expect(guidance).toContain("Sitemap: https://jwstonelogistics.com/sitemap.xml");
    expect(guidance).toContain("Continue through TradeScout");
    expect(guidance).not.toMatch(
      /423-555-0199|423-555-0188|423\) 555-0102|owner@example|estimator@example|category@example/
    );
    expect(guidance).not.toContain("jwstone.example");
    expect(guidance).not.toMatch(/123 Main Street|456 Market Ave|private\.example|vendor\.example/);
    expect(guidance).not.toContain("/api/");
  });

  it("keeps SSR metadata, schema, and preview context aligned for all seven JW material pages", async () => {
    const inventoryCategories = inventoryCategoriesForProfile(
      profileRecord.slug,
      profileRecord.contentBlocks
    );
    const categories = listProfileInventoryCategories(
      inventoryCategories,
      profileRecord.contentBlocks
    );

    expect(categories).toHaveLength(7);

    for (const category of categories) {
      const canonical = `https://jwstonelogistics.com/materials/${category.slug}`;
      const html = await buildPublicProfileHtml({
        slug: "jw-stone",
        origin: "https://jwstonelogistics.com",
        templateHtml,
        categorySlug: category.slug,
      });

      expect(html).not.toBeNull();
      expect(html).toContain(`property="og:title" content="${category.name} | JW Stone Logistics"`);
      expect(html).toContain(
        `property="og:description" content="${category.summary.replace(/'/g, "&#39;")}"`
      );
      expect(html).toContain(`property="og:url" content="${canonical}"`);
      expect(html).toContain(`link rel="canonical" href="${canonical}"`);
      expect(html).toMatch(
        new RegExp(
          `property="og:image" content="https://www\\.thetradescout\\.com/images/social/profile/jw-stone/category/${category.slug}\\.png\\?v=4-[a-z0-9]+"`
        )
      );
      expect(html).toContain('property="og:type" content="website"');
      expect(html).toContain(
        'meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"'
      );
      expect(html).toContain(`data-seo-profile-category="${category.slug}"`);
      expect(html).toContain(`<h2>${category.name}</h2>`);
      expect(html).toContain(
        `${category.itemCount} published ${category.itemCount === 1 ? "material" : "materials"}`
      );
      expect(html).toContain('"@type":"CollectionPage"');
      expect(html).toContain(`"@id":"${canonical}#collection"`);
      expect(html).toContain(`"url":"${canonical}"`);
      expect(html).toContain(`"numberOfItems":${category.itemCount}`);
      expect(html).not.toContain('data-seo-profile-item="inventory"');

      for (const itemSlug of category.itemSlugs) {
        expect(html).toContain(`"url":"https://jwstonelogistics.com/stones/${itemSlug}"`);
      }
    }
  });

  it("builds the exact host-local sitemap set for 158 stones, seven materials, and gallery", async () => {
    profileRecord.contentBlocks = [
      jwPublicDiscoveryBlock,
      {
        id: "recent-work",
        type: "gallery",
        data: {
          title: "Recent Work",
          images: [
            {
              url: "/uploads/profiles/patio.jpg",
              title: "Finished Patio",
            },
          ],
        },
      },
    ];
    const galleryItem = listProfileGalleryItems(profileRecord.contentBlocks)[0];
    const inventoryCategories = inventoryCategoriesForProfile(
      profileRecord.slug,
      profileRecord.contentBlocks
    );
    const inventoryItems = listProfileInventoryItems(inventoryCategories);
    const materialCategories = listProfileInventoryCategories(
      inventoryCategories,
      profileRecord.contentBlocks
    );

    const sitemap = await buildPublicProfileSitemapXml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
    });
    const locations = Array.from(
      sitemap?.matchAll(/<loc>([^<]+)<\/loc>/g) || [],
      (match) => match[1]
    );
    const expectedLocations = [
      "https://jwstonelogistics.com/",
      ...materialCategories.map(
        (category) => `https://jwstonelogistics.com/materials/${category.slug}`
      ),
      ...inventoryItems.map((item) => `https://jwstonelogistics.com/stones/${item.slug}`),
      `https://jwstonelogistics.com/gallery/${galleryItem.slug}`,
    ];

    expect(inventoryItems).toHaveLength(158);
    expect(materialCategories).toHaveLength(7);
    expect(locations).toEqual(expectedLocations);
    expect(locations).toHaveLength(1 + 158 + 7 + 1);
    expect(new Set(locations).size).toBe(locations.length);
    expect(sitemap).not.toContain("https://www.thetradescout.com/");
    expect(sitemap).not.toContain("?stone=");
    expect(sitemap).not.toContain("/inventory/");
    expect(sitemap).toContain("<lastmod>2026-06-15</lastmod>");
  });
});
