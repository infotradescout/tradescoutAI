/**
 * publicExchangeListingHtml.ts
 *
 * Server-side OG / meta tag injection for Exchange listing detail pages.
 * Runs before the SPA boots so social crawlers (Facebook, Twitter, iMessage,
 * Slack, Google, etc.) see the correct og:url, og:title, og:description,
 * og:image, and full JSON-LD structured data for every shared listing URL.
 *
 * Route: /exchange/:category/:listingId
 *
 * JSON-LD schemas emitted:
 *   - BreadcrumbList (Home > Exchange > [Category] > [Listing Title])
 *   - Car (vehicles category)
 *   - SingleFamilyResidence / Apartment (real-estate category)
 *   - Product + Offer (all other categories)
 */

import { formatTradeScoutTitle } from "@shared/brand";
import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  getExchangeCategorySlugFromMarketplaceCategoryName,
} from "@shared/exchangeListingRules";
import type { ExchangeCategorySlug } from "@shared/exchangeListingRules";
import { listProfileOfferImageUrls } from "@shared/profileOfferShare";
import { sanitizePublicListingText } from "@shared/publicListingSafety";
import { pool } from "./db";
import { storage } from "./storage";
import { hasExposureAuthority } from "./services/exposureAuthority";
import { toPublicProfileOffer } from "./publicProfileOffer";
import { toPublicExchangeListing } from "./publicExchangeListing";

// ─── helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object): string {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function formatPrice(price: number | string | null | undefined): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const PROFILE_OFFER_EXCHANGE_ID_PREFIX = "profile-offer-";

function fromProfileOfferExchangeId(id: string): string {
  const value = String(id || "").trim();
  return value.startsWith(PROFILE_OFFER_EXCHANGE_ID_PREFIX)
    ? value.slice(PROFILE_OFFER_EXCHANGE_ID_PREFIX.length)
    : "";
}

async function getProfileOfferExchangeListing(listingId: string): Promise<any | null> {
  const profileOfferId = fromProfileOfferExchangeId(listingId);
  if (!profileOfferId) return null;

  try {
    const result = await pool.query(
      `SELECT po.*, u.first_name, u.last_name, u.city, u.state, u.state_code,
              u.county, u.county_name, u.county_fips
       FROM profile_offers po
       JOIN users u ON u.id = po.seller_user_id
       WHERE po.id = $1
         AND po.is_active = true
         AND po.offer_type = 'item'
       LIMIT 1`,
      [profileOfferId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const offer = toPublicProfileOffer(row);
    if (!offer || offer.offerType !== "item") return null;
    const metadata = offer.metadata;
    return {
      id: listingId,
      sellerId: offer.sellerUserId,
      title: offer.title,
      description: offer.description || "Fixed-price item available from this TradeScout profile.",
      price: offer.price,
      city: sanitizePublicListingText(row.city, 120),
      state: sanitizePublicListingText(row.state_code || row.state, 80),
      county: sanitizePublicListingText(row.county_name || row.county, 120),
      condition: metadata.condition || "new",
      images: listProfileOfferImageUrls(metadata),
      specifications: {
        source: "profile_offer",
        profileOfferId,
        fulfillmentMode: offer.fulfillmentMode,
        itemSku: offer.itemSku || undefined,
        itemCategory: metadata.itemCategory || metadata.exchangeCategorySlug || undefined,
        taxCategory: metadata.taxCategory || undefined,
        fulfillmentPolicy: metadata.fulfillmentPolicy || undefined,
        returnPolicy: metadata.returnPolicy || undefined,
        reviewRequired: true,
      },
      sellerName:
        `${sanitizePublicListingText(row.first_name, 80)} ${sanitizePublicListingText(row.last_name, 80)}`.trim(),
      sourceType: "profile_offer",
    };
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("profile_offers") || error?.code === "42P01") return null;
    throw error;
  }
}

// ─── category name → slug resolution ─────────────────────────────────────────

function resolveCategorySlug(urlCategoryParam: string, listing: any): ExchangeCategorySlug | null {
  // 1. Try the URL param directly (most reliable — set by the client router)
  const slug = String(urlCategoryParam || "")
    .trim()
    .toLowerCase() as ExchangeCategorySlug;
  if (slug && slug in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME) return slug;

  // 2. Try to derive from the listing's categoryId via the category name mapping
  if (listing?.categoryId) {
    // categoryId is a UUID — we'd need a DB join; skip for SSR performance
  }

  return null;
}

// ─── JSON-LD builders ─────────────────────────────────────────────────────────

function buildBreadcrumbList(
  origin: string,
  categorySlug: string,
  categoryName: string,
  listingTitle: string,
  listingUrl: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: origin,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Exchange",
        item: `${origin}/exchange`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryName,
        item: `${origin}/exchange/${encodeURIComponent(categorySlug)}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: listingTitle,
        item: listingUrl,
      },
    ],
  };
}

function buildVehicleJsonLd(listing: any, origin: string, listingUrl: string, imageUrl: string) {
  const specs = listing.specifications || {};
  const price = Number(listing.price);
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: listing.title,
    description: String(listing.description || "").slice(0, 500),
    url: listingUrl,
    image: imageUrl,
  };

  if (listing.brand || specs.make)
    jsonLd.brand = { "@type": "Brand", name: listing.brand || specs.make };
  if (listing.model) jsonLd.model = listing.model;
  if (listing.year) jsonLd.vehicleModelDate = String(listing.year);
  if (listing.mileage)
    jsonLd.mileageFromOdometer = {
      "@type": "QuantitativeValue",
      value: listing.mileage,
      unitCode: "SMI",
    };
  if (specs.vin) jsonLd.vehicleIdentificationNumber = specs.vin;
  if (specs.engine) jsonLd.vehicleEngine = { "@type": "EngineSpecification", name: specs.engine };
  if (specs.transmission) jsonLd.vehicleTransmission = specs.transmission;
  if (specs.fuelType) jsonLd.fuelType = specs.fuelType;
  if (listing.condition) {
    const condMap: Record<string, string> = {
      new: "https://schema.org/NewCondition",
      like_new: "https://schema.org/LikeNewCondition",
      excellent: "https://schema.org/UsedCondition",
      good: "https://schema.org/UsedCondition",
      fair: "https://schema.org/UsedCondition",
      poor: "https://schema.org/DamagedCondition",
      parts_only: "https://schema.org/DamagedCondition",
    };
    jsonLd.itemCondition = condMap[listing.condition] || "https://schema.org/UsedCondition";
  }
  if (Number.isFinite(price) && price > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: listingUrl,
    };
  }
  return jsonLd;
}

function buildRealEstateJsonLd(listing: any, origin: string, listingUrl: string, imageUrl: string) {
  const specs = listing.specifications || {};
  const price = Number(listing.price);
  const propertyType = String(specs.propertyType || "").toLowerCase();
  const schemaType =
    propertyType === "apartment" || propertyType === "condo"
      ? "Apartment"
      : propertyType === "townhouse"
        ? "Townhouse"
        : "SingleFamilyResidence";

  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: listing.title,
    description: String(listing.description || "").slice(0, 500),
    url: listingUrl,
    image: imageUrl,
  };

  if (listing.city || listing.county || listing.state) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: listing.city || listing.county || "",
      addressRegion: listing.state || "",
      addressCountry: "US",
    };
  }
  if (specs.bedrooms) jsonLd.numberOfRooms = specs.bedrooms;
  if (specs.bathrooms) jsonLd.numberOfBathroomsTotal = specs.bathrooms;
  if (specs.squareFeet)
    jsonLd.floorSize = { "@type": "QuantitativeValue", value: specs.squareFeet, unitCode: "FTK" };
  if (Number.isFinite(price) && price > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: listingUrl,
    };
  }
  return jsonLd;
}

function buildProductJsonLd(listing: any, origin: string, listingUrl: string, imageUrl: string) {
  const price = Number(listing.price);
  const jsonLd: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: String(listing.description || "").slice(0, 500),
    url: listingUrl,
    image: imageUrl,
  };

  if (listing.brand) jsonLd.brand = { "@type": "Brand", name: listing.brand };
  if (listing.model) jsonLd.model = listing.model;
  const specs = listing.specifications || {};
  const extraProperties = [
    specs.itemCategory
      ? { "@type": "PropertyValue", name: "Item category", value: specs.itemCategory }
      : null,
    specs.taxCategory
      ? { "@type": "PropertyValue", name: "Tax category", value: specs.taxCategory }
      : null,
    specs.fulfillmentPolicy
      ? { "@type": "PropertyValue", name: "Fulfillment policy", value: specs.fulfillmentPolicy }
      : null,
    specs.returnPolicy
      ? { "@type": "PropertyValue", name: "Return policy", value: specs.returnPolicy }
      : null,
  ].filter(Boolean);
  if (extraProperties.length) jsonLd.additionalProperty = extraProperties;
  if (listing.condition) {
    const condMap: Record<string, string> = {
      new: "https://schema.org/NewCondition",
      like_new: "https://schema.org/LikeNewCondition",
      excellent: "https://schema.org/UsedCondition",
      good: "https://schema.org/UsedCondition",
      fair: "https://schema.org/UsedCondition",
      poor: "https://schema.org/DamagedCondition",
      parts_only: "https://schema.org/DamagedCondition",
    };
    jsonLd.itemCondition = condMap[listing.condition] || "https://schema.org/UsedCondition";
  }
  if (Number.isFinite(price) && price > 0) {
    jsonLd.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: listingUrl,
      seller: {
        "@type": "Organization",
        name: "TradeScout Exchange",
      },
    };
  }
  return jsonLd;
}

// ─── main builder ─────────────────────────────────────────────────────────────

export type ExchangeListingHtmlOptions = {
  origin: string;
  templateHtml: string;
  categoryParam: string;
  listingId: string;
};

export async function buildPublicExchangeListingHtml(
  opts: ExchangeListingHtmlOptions
): Promise<string | null> {
  const { origin, templateHtml, categoryParam, listingId } = opts;

  if (!listingId) return null;

  // Fetch the listing from the database
  let listing: any;
  try {
    listing =
      (await getProfileOfferExchangeListing(listingId)) ||
      (await storage.getMarketplaceListing(listingId));
  } catch {
    return null;
  }

  if (!listing) return null;

  if (listing.sourceType !== "profile_offer") {
    listing = toPublicExchangeListing(listing);
    if (!listing) return null;
  }
  const authorityUserId = String(listing.sellerId || listing.seller?.id || "").trim();
  if (!authorityUserId || !(await hasExposureAuthority(authorityUserId))) return null;

  // Resolve category slug
  const categorySlug = resolveCategorySlug(categoryParam, listing);
  const categoryName =
    (categorySlug && EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[categorySlug]) ||
    sanitizePublicListingText(
      String(categoryParam || "Exchange")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      80
    );

  // Build canonical URL
  const canonicalCategory = categorySlug || "other";
  const listingUrl = `${origin}/exchange/${encodeURIComponent(canonicalCategory)}/${encodeURIComponent(listingId)}`;

  // Build title and description
  const itemTitle = sanitizePublicListingText(listing.title || "Exchange Listing", 80);
  const price = Number(listing.price);
  const priceStr = Number.isFinite(price) && price > 0 ? ` — ${formatPrice(price)}` : "";
  const locationParts = [listing.city, listing.county, listing.state]
    .map((value) => sanitizePublicListingText(value, 120))
    .filter(Boolean);
  const locationStr = locationParts.length > 0 ? ` in ${locationParts.slice(0, 2).join(", ")}` : "";

  const title = formatTradeScoutTitle(`${itemTitle}${priceStr} | TradeScout Exchange`);
  const rawDescription = sanitizePublicListingText(listing.description, 160);
  const description =
    rawDescription || `${itemTitle}${priceStr}${locationStr} — listed on TradeScout Exchange.`;

  // Primary image
  const images = Array.isArray(listing.images) ? listing.images : [];
  const primaryImageIndex = Math.max(
    0,
    Math.min(Number(listing.primaryImageIndex ?? 0), images.length - 1)
  );
  const primaryImage = images[primaryImageIndex] || images[0] || null;
  const imageUrl = primaryImage
    ? new URL(primaryImage, origin).toString()
    : `${origin}/tradescout-social-preview.png?v=11`;

  // ── Build JSON-LD ──────────────────────────────────────────────────────────

  const breadcrumb = buildBreadcrumbList(
    origin,
    canonicalCategory,
    categoryName,
    itemTitle,
    listingUrl
  );

  let itemJsonLd: object;
  if (categorySlug === "vehicles" || categoryParam === "vehicles") {
    itemJsonLd = buildVehicleJsonLd(listing, origin, listingUrl, imageUrl);
  } else if (categorySlug === "real-estate" || categoryParam === "real-estate") {
    itemJsonLd = buildRealEstateJsonLd(listing, origin, listingUrl, imageUrl);
  } else {
    itemJsonLd = buildProductJsonLd(listing, origin, listingUrl, imageUrl);
  }

  // ── Inject into HTML ──────────────────────────────────────────────────────

  let html = templateHtml;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(listingUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(listingUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="product" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );

  // Inject BreadcrumbList first, then item-specific schema
  html = injectJsonLd(html, breadcrumb);
  html = injectJsonLd(html, itemJsonLd);

  return html;
}
