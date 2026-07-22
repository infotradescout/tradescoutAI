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
  profileBooking: null as any,
  contentBlocks: [] as any[],
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
    profileRecord.contentBlocks = [];
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
    expect(html).toContain("No private account details are exposed here.");
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
      'property="og:image" content="https://jwstonelogistics.com/images/businesses/jw-stone/inventory-source/1h8REgL6CYv6b3NMAuFzt4mBXvItfAl7c.webp"'
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
    expect(html).toContain('"brand":{"@id":"https://jwstonelogistics.com/#identity"}');
    expect(html).not.toContain('"brand":{"@type":"Organization"');
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
    expect(html).not.toContain('"@type":"Organization"');
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
    expect(html).toContain('"creator":{"@id":"https://jwstonelogistics.com/#identity"}');
    expect(html).not.toContain('"creator":{"@type":"Organization"');
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
    expect(html).toContain('"@type":"Person"');
    expect(html).toContain(
      '"creator":{"@id":"https://www.thetradescout.com/u/jrs-auto-glass#identity"}'
    );
    expect(html).not.toContain('"@type":"Organization"');
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

  it("builds a host-local sitemap with real update time and public item URLs", async () => {
    profileRecord.contentBlocks = [
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

    const sitemap = await buildPublicProfileSitemapXml({
      slug: "jw-stone",
      origin: "https://jwstonelogistics.com",
    });

    expect(sitemap).toContain("<loc>https://jwstonelogistics.com/</loc>");
    expect(sitemap).toContain("<loc>https://jwstonelogistics.com/?stone=blue-dunes</loc>");
    expect(sitemap).toContain(
      `<loc>https://jwstonelogistics.com/?gallery=${galleryItem.slug}</loc>`
    );
    expect(sitemap).toContain("<lastmod>2026-06-15</lastmod>");
  });
});
