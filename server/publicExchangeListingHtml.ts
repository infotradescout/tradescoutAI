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
import { getPublicProfileCatalogExchangeItem } from "./profileCatalogExchange";

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

function formatPrice(price: number | string | null | undefined, currency: string = "USD"): string {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }
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
      currency: offer.currency,
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
      itemSku: offer.itemSku,
      itemStockQuantity: offer.itemStockQuantity,
      inStock: offer.itemStockQuantity === null ? undefined : offer.itemStockQuantity > 0,
      fulfillmentMode: offer.fulfillmentMode,
      localPickupOnly: offer.fulfillmentMode === "pickup",
      willShip: offer.fulfillmentMode === "shipping",
      shippingCost: offer.shippingCost,
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

// ─── persisted category → slug resolution ────────────────────────────────────

function categorySlugFromValue(value: unknown): ExchangeCategorySlug | null {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  if (normalized in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME) {
    return normalized as ExchangeCategorySlug;
  }
  return getExchangeCategorySlugFromMarketplaceCategoryName(String(value || ""));
}

export function resolvePersistedExchangeCategorySlug(
  listing: any,
  persistedCategoryName?: unknown
): ExchangeCategorySlug {
  const specs = asRecord(listing?.specifications);
  const candidates = [
    specs.exchangeCategorySlug,
    listing?.category,
    persistedCategoryName,
    specs.itemCategory,
  ];
  for (const candidate of candidates) {
    const slug = categorySlugFromValue(candidate);
    if (slug) return slug;
  }
  return "other";
}

async function resolveListingCategorySlug(listing: any): Promise<ExchangeCategorySlug> {
  let persistedCategoryName: unknown;
  const categoryId = String(listing?.categoryId || "").trim();
  if (
    categoryId &&
    listing?.sourceType !== "profile_offer" &&
    listing?.sourceType !== "profile_catalog"
  ) {
    try {
      const result = await pool.query(
        "SELECT name FROM marketplace_categories WHERE id = $1 LIMIT 1",
        [categoryId]
      );
      persistedCategoryName = result.rows[0]?.name;
    } catch {
      // The listing can still carry a persisted category label in legacy data.
    }
  }
  return resolvePersistedExchangeCategorySlug(listing, persistedCategoryName);
}

// ─── JSON-LD builders ─────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function firstNonNegativeNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function resolveListingCurrency(listing: any): string {
  const specs = asRecord(listing?.specifications);
  const candidate = String(listing?.currency || specs.currency || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : "USD";
}

function resolveListingAvailability(listing: any): string {
  const specs = asRecord(listing?.specifications);
  const rawAvailability = String(
    listing?.availability ||
      listing?.inventoryStatus ||
      specs.availability ||
      specs.inventoryStatus ||
      ""
  )
    .trim()
    .split("/")
    .pop()
    ?.replace(/[^a-z]/gi, "")
    .toLowerCase();
  const availabilityMap: Record<string, string> = {
    available: "InStock",
    instock: "InStock",
    limited: "LimitedAvailability",
    limitedavailability: "LimitedAvailability",
    outofstock: "OutOfStock",
    sold: "OutOfStock",
    soldout: "OutOfStock",
    unavailable: "OutOfStock",
    preorder: "PreOrder",
    backorder: "BackOrder",
    discontinued: "Discontinued",
  };
  if (rawAvailability && availabilityMap[rawAvailability]) {
    return `https://schema.org/${availabilityMap[rawAvailability]}`;
  }

  const explicitInStock =
    typeof listing?.inStock === "boolean"
      ? listing.inStock
      : typeof specs.inStock === "boolean"
        ? specs.inStock
        : null;
  if (explicitInStock !== null) {
    return explicitInStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  }

  const stockQuantity = firstNonNegativeNumber(
    listing?.itemStockQuantity,
    listing?.stockQuantity,
    listing?.quantityAvailable,
    specs.itemStockQuantity,
    specs.stockQuantity,
    specs.quantityAvailable
  );
  if (stockQuantity !== null) {
    return stockQuantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  }

  // Public Exchange schemas are only emitted for active listings. When an
  // active listing has no inventory tracker, availability remains the legacy
  // safe fallback rather than inventing a quantity.
  return "https://schema.org/InStock";
}

function resolveListingSku(listing: any): string {
  const specs = asRecord(listing?.specifications);
  return sanitizePublicListingText(
    listing?.itemSku || listing?.sku || specs.itemSku || specs.sku,
    160
  );
}

function resolveListingSeller(listing: any): Record<string, string> | null {
  const seller = asRecord(listing?.seller);
  const businessName = sanitizePublicListingText(
    listing?.businessName || listing?.sellerBusinessName || seller.businessName,
    160
  );
  const sellerName = sanitizePublicListingText(listing?.sellerName || seller.name, 160);
  const name = businessName || sellerName;
  if (!name || /^(?:tradescout seller|tradescout exchange)$/i.test(name)) return null;

  const sellerType = String(seller.type || listing?.sellerType || "").toLowerCase();
  const isOrganization =
    Boolean(businessName) || /business|company|contractor|organization|vendor/.test(sellerType);
  return {
    "@type": isOrganization ? "Organization" : "Person",
    name,
  };
}

function resolveShippingDetails(
  listing: any,
  currency: string
): {
  shippingDetails?: Record<string, any>;
  availableDeliveryMethod?: string | string[];
} {
  const specs = asRecord(listing?.specifications);
  const quote = asRecord(listing?.shippingQuote || specs.shippingQuote);
  const fulfillmentMode = String(listing?.fulfillmentMode || specs.fulfillmentMode || "")
    .trim()
    .toLowerCase();
  const willShip =
    listing?.willShip === true ||
    specs.willShip === true ||
    fulfillmentMode === "shipping" ||
    Object.keys(quote).length > 0;
  const pickupAvailable =
    listing?.localPickupOnly === true ||
    listing?.isLocalPickupOnly === true ||
    specs.localPickupOnly === true ||
    fulfillmentMode === "pickup";

  const deliveryMethods = [
    ...(willShip ? ["https://schema.org/ParcelService"] : []),
    ...(pickupAvailable ? ["https://schema.org/OnSitePickup"] : []),
  ];
  const result: {
    shippingDetails?: Record<string, any>;
    availableDeliveryMethod?: string | string[];
  } = {};
  if (deliveryMethods.length) {
    result.availableDeliveryMethod =
      deliveryMethods.length === 1 ? deliveryMethods[0] : deliveryMethods;
  }
  if (!willShip) return result;

  const shippingCost =
    quote.sellerAbsorbs === true
      ? 0
      : firstNonNegativeNumber(quote.estimatedCost, listing?.shippingCost, specs.shippingCost);
  const estimatedDaysMin = firstNonNegativeNumber(quote.estimatedDaysMin, specs.estimatedDaysMin);
  const estimatedDaysMax = firstNonNegativeNumber(quote.estimatedDaysMax, specs.estimatedDaysMax);
  const rawDestinationCountry = sanitizePublicListingText(
    quote.destinationCountry || listing?.shippingCountry || specs.shippingCountry,
    2
  ).toUpperCase();
  const destinationCountry = /^[A-Z]{2}$/.test(rawDestinationCountry) ? rawDestinationCountry : "";
  const rawShippingRegions = Array.isArray(listing?.shippingRegions || specs.shippingRegions)
    ? (listing?.shippingRegions || specs.shippingRegions)
        .map((region: unknown) => sanitizePublicListingText(region, 80))
        .filter(Boolean)
        .slice(0, 50)
    : [];
  const shippingRegions = rawShippingRegions.map((region: string) => region.toUpperCase());
  const supportedRegionalCountry = new Set(["US", "AU", "JP"]).has(destinationCountry);
  const regionsAreSupported =
    shippingRegions.length === 0 ||
    (supportedRegionalCountry && shippingRegions.every((region) => /^[A-Z0-9]{2,3}$/.test(region)));

  // A shipping method is still useful and truthful on its own. Only publish
  // Google's merchant shipping enhancement when every required, source-backed
  // field is present and any optional region codes are valid.
  if (
    shippingCost === null ||
    (estimatedDaysMin === null && estimatedDaysMax === null) ||
    !destinationCountry ||
    !regionsAreSupported
  ) {
    return result;
  }

  const firstEstimate = estimatedDaysMin ?? estimatedDaysMax ?? 0;
  const secondEstimate = estimatedDaysMax ?? estimatedDaysMin ?? firstEstimate;
  const minValue = Math.min(firstEstimate, secondEstimate);
  const maxValue = Math.max(firstEstimate, secondEstimate);
  const details: Record<string, any> = {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: shippingCost.toFixed(2),
      currency,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      transitTime: {
        "@type": "QuantitativeValue",
        minValue,
        maxValue,
        unitCode: "DAY",
      },
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: destinationCountry,
      ...(shippingRegions.length ? { addressRegion: shippingRegions } : {}),
    },
  };

  result.shippingDetails = details;
  return result;
}

export function buildExchangeOfferJsonLd(listing: any, listingUrl: string) {
  const price = Number(listing?.price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const priceCurrency = resolveListingCurrency(listing);
  const offer: Record<string, any> = {
    "@type": "Offer",
    price: price.toFixed(2),
    priceCurrency,
    availability: resolveListingAvailability(listing),
    url: listingUrl,
    ...resolveShippingDetails(listing, priceCurrency),
  };
  const seller = resolveListingSeller(listing);
  if (seller) offer.seller = seller;
  return offer;
}

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
  const offer = buildExchangeOfferJsonLd(listing, listingUrl);
  if (offer) jsonLd.offers = offer;
  return jsonLd;
}

function buildRealEstateJsonLd(listing: any, origin: string, listingUrl: string, imageUrl: string) {
  const specs = listing.specifications || {};
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
  const offer = buildExchangeOfferJsonLd(listing, listingUrl);
  if (offer) jsonLd.offers = offer;
  return jsonLd;
}

export function buildProductJsonLd(
  listing: any,
  origin: string,
  listingUrl: string,
  imageUrl: string | null
) {
  if (!imageUrl) return null;
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
  const sku = resolveListingSku(listing);
  if (sku) jsonLd.sku = sku;
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
  const offer = buildExchangeOfferJsonLd(listing, listingUrl);
  if (offer) jsonLd.offers = offer;
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
  const { origin, templateHtml, listingId } = opts;

  if (!listingId) return null;

  // Fetch the listing from the database
  let listing: any;
  try {
    listing =
      (await getPublicProfileCatalogExchangeItem(listingId)) ||
      (await getProfileOfferExchangeListing(listingId)) ||
      (await storage.getMarketplaceListing(listingId));
  } catch {
    return null;
  }

  if (!listing) return null;

  if (listing.sourceType !== "profile_offer" && listing.sourceType !== "profile_catalog") {
    listing = toPublicExchangeListing(listing);
    if (!listing) return null;
  }
  if (listing.sourceType !== "profile_catalog") {
    const authorityUserId = String(listing.sellerId || listing.seller?.id || "").trim();
    if (!authorityUserId || !(await hasExposureAuthority(authorityUserId))) return null;
  }

  // Resolve category slug
  const categorySlug = await resolveListingCategorySlug(listing);
  const categoryName = EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[categorySlug];

  // Build canonical URL
  const canonicalCategory = categorySlug;
  const listingUrl = `${origin}/exchange/${encodeURIComponent(canonicalCategory)}/${encodeURIComponent(listingId)}`;

  // Build title and description
  const itemTitle = sanitizePublicListingText(listing.title || "Exchange Listing", 80);
  const price = Number(listing.price);
  const priceStr =
    Number.isFinite(price) && price > 0
      ? ` — ${formatPrice(price, resolveListingCurrency(listing))}`
      : "";
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
  const productImageUrl = primaryImage ? new URL(primaryImage, origin).toString() : null;
  const socialImageUrl = productImageUrl || `${origin}/tradescout-social-preview.png?v=12`;

  // ── Build JSON-LD ──────────────────────────────────────────────────────────

  const breadcrumb = buildBreadcrumbList(
    origin,
    canonicalCategory,
    categoryName,
    itemTitle,
    listingUrl
  );

  const itemJsonLd =
    listing.sourceType === "profile_catalog"
      ? null
      : productImageUrl
        ? categorySlug === "vehicles"
          ? buildVehicleJsonLd(listing, origin, listingUrl, productImageUrl)
          : categorySlug === "real-estate"
            ? buildRealEstateJsonLd(listing, origin, listingUrl, productImageUrl)
            : buildProductJsonLd(listing, origin, listingUrl, productImageUrl)
        : null;

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
    `<meta property="og:image" content="${escapeHtml(socialImageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${listing.sourceType === "profile_catalog" ? "website" : "product"}" />`
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
    `<meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />`
  );

  // Inject BreadcrumbList first, then item-specific schema
  html = injectJsonLd(html, breadcrumb);
  if (itemJsonLd) html = injectJsonLd(html, itemJsonLd);
  html = html.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root"><main data-seo-exchange-listing="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <article>
        <h1>${escapeHtml(itemTitle)}</h1>
        <p>${escapeHtml(description)}</p>
        ${priceStr ? `<p>${escapeHtml(priceStr.replace(/^\s*—\s*/, ""))}</p>` : ""}
        ${productImageUrl ? `<img src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(itemTitle)}" loading="eager" />` : ""}
        <p>${
          listing.sourceType === "profile_catalog"
            ? "Open the maintained business profile and submit a managed TradeScout request."
            : "Continue through TradeScout to review the listing and contact options."
        }</p>
      </article>
    </main></div>`
  );

  return html;
}
