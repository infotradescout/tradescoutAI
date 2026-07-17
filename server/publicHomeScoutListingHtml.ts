import { formatTradeScoutTitle } from "@shared/brand";
import {
  createHomeScoutListingShareMetadata,
  normalizeHomeScoutListingId,
} from "@shared/homeScoutListingShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { storage } from "./storage";
import { hasExposureAuthority } from "./services/exposureAuthority";
import { toPublicHomeScoutListing } from "./publicHomeScoutListing";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  return regex.test(html) ? html.replace(regex, tag) : html.replace("</head>", `${tag}\n</head>`);
}

function injectJsonLd(html: string, value: object): string {
  const json = JSON.stringify(value).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/png";
}

export type PublicHomeScoutListingHtmlOptions = {
  origin: string;
  templateHtml: string;
  listingId: string;
};

export async function buildPublicHomeScoutListingHtml(
  options: PublicHomeScoutListingHtmlOptions
): Promise<string | null> {
  const listingId = normalizeHomeScoutListingId(options.listingId);
  if (!listingId) return null;

  let listing: any;
  try {
    listing = await storage.getHomeScoutListing(listingId);
  } catch {
    return null;
  }
  if (!listing || String(listing.status || "") !== "active") return null;

  const authorityUserId = String(
    listing.contactUserId || listing.agentUserId || listing.sellerUserId || ""
  ).trim();
  if (!authorityUserId || !(await hasExposureAuthority(authorityUserId))) return null;

  const publicListing = toPublicHomeScoutListing(listing);
  if (!publicListing) return null;

  const meta = createHomeScoutListingShareMetadata({
    listing: publicListing,
    origin: options.origin.replace(/\/$/, ""),
  });
  if (!meta) return null;

  const title = formatTradeScoutTitle(`${meta.title} | HomeScout`);
  const imageUrl =
    meta.imageUrl || `${options.origin.replace(/\/$/, "")}/tradescout-social-preview.png?v=11`;
  const usesDefaultImage = !meta.imageUrl;
  const price = Number(publicListing.price);
  const propertyType = String(publicListing.propertyType || "house").toLowerCase();
  const schemaType =
    propertyType === "condo"
      ? "Apartment"
      : propertyType === "townhouse"
        ? "House"
        : "SingleFamilyResidence";
  const residence: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: meta.title,
    description: meta.description,
    url: meta.canonical,
    image: imageUrl,
    address: {
      "@type": "PostalAddress",
      addressLocality: sanitizePublicListingText(publicListing.city, 100),
      addressRegion: sanitizePublicListingText(publicListing.stateCode, 2).toUpperCase(),
      addressCountry: "US",
    },
  };
  if (publicListing.beds != null) residence.numberOfRooms = Number(publicListing.beds);
  if (publicListing.baths != null) {
    residence.numberOfBathroomsTotal = Number(publicListing.baths);
  }
  if (publicListing.sqft != null) {
    residence.floorSize = {
      "@type": "QuantitativeValue",
      value: Number(publicListing.sqft),
      unitCode: "FTK",
    };
  }
  if (Number.isFinite(price) && price >= 0) {
    residence.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: meta.canonical,
    };
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: options.origin },
      {
        "@type": "ListItem",
        position: 2,
        name: "HomeScout",
        item: `${options.origin.replace(/\/$/, "")}/exchange/real-estate`,
      },
      { "@type": "ListItem", position: 3, name: meta.title, item: meta.canonical },
    ],
  };

  let html = options.templateHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );
  const tags: Array<[RegExp, string]> = [
    [
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    ],
    [
      /<meta name="robots"[^>]*>/i,
      '<meta name="robots" content="index, follow, max-image-preview:large" />',
    ],
    [
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`,
    ],
    [/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="website" />'],
    [
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    ],
    [
      /<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`,
    ],
    [
      /<meta property="og:image"[^>]*>/i,
      `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:secure_url"[^>]*>/i,
      `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:type"[^>]*>/i,
      `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`,
    ],
    [
      /<meta property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`,
    ],
    [
      /<meta name="twitter:card"[^>]*>/i,
      '<meta name="twitter:card" content="summary_large_image" />',
    ],
    [
      /<meta name="twitter:title"[^>]*>/i,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta name="twitter:description"[^>]*>/i,
      `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    ],
    [
      /<meta name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta name="twitter:image:alt"[^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`,
    ],
  ];
  for (const [pattern, tag] of tags) html = upsertTag(html, pattern, tag);

  if (usesDefaultImage) {
    html = upsertTag(
      html,
      /<meta property="og:image:width"[^>]*>/i,
      '<meta property="og:image:width" content="1200" />'
    );
    html = upsertTag(
      html,
      /<meta property="og:image:height"[^>]*>/i,
      '<meta property="og:image:height" content="630" />'
    );
  } else {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  }

  html = injectJsonLd(html, breadcrumb);
  html = injectJsonLd(html, residence);
  return html;
}
