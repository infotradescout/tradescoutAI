import {
  EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME,
  SELL_CATEGORY_FIELDS,
} from "../shared/exchangeListingRules";
import {
  stoneSlabMaterialPrice,
  stoneReferencePriceCalculation,
} from "../shared/exchangeStoneBuyerFlow";
import { stonePublicReferenceSizes } from "../shared/exchangeStonePublicReference";
import { stonePublicSupplier } from "../shared/exchangeStoneSupplier";
import { EXCHANGE_STONE_LOCAL_SERVICES } from "../shared/exchangeStoneLocalServices";
import { isStoneRetailListing } from "../shared/exchangeStoneInquiryDraft";
import { sanitizePublicListingText } from "../shared/publicListingSafety";
import type {
  PublicExchangeRecord,
  PublicExchangeIndexEntry,
} from "./services/exchangePublicDiscovery";

export const EXCHANGE_PUBLIC_ORIGIN = "https://www.thetradescout.com";
export const EXCHANGE_PUBLIC_ROBOTS = "index, follow, max-image-preview:large";
const e = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!
  );
const clean = (value: unknown, limit = 4000) => sanitizePublicListingText(value, limit);
const json = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
const rootPattern = /<div\b([^>]*\bid\s*=\s*["']root["'][^>]*)>\s*<\/div>/i;
function absolute(path: string): string {
  return new URL(path, EXCHANGE_PUBLIC_ORIGIN).toString();
}
function categoryName(slug: string): string {
  return (
    EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[
      slug as keyof typeof EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME
    ] || "Other"
  );
}
export function publicExchangePrice(item: PublicExchangeRecord): {
  primary: string;
  secondary: string;
  note: string;
  amount?: number;
  currency: string;
} {
  const currency = /^[A-Z]{3}$/.test(String(item.currency || "")) ? item.currency : "USD";
  if (isStoneRetailListing(item)) {
    const s = item.specifications || {};
    const result = stoneSlabMaterialPrice(
      item.price,
      s.priceUnit,
      stonePublicReferenceSizes(item),
      s.exactSlab
    );
    if (!result)
      return {
        primary: "Confirm slab material price",
        secondary: "",
        note: "Availability and delivery require confirmation.",
        currency,
      };
    return {
      primary:
        result.kind === "size_required"
          ? "Slab total requires confirmed dimensions"
          : `${result.primaryLabel}: ${result.primaryPrice}`,
      secondary:
        result.kind === "size_required"
          ? `Material rate: ${result.primaryPrice}`
          : result.secondaryPrice || "",
      note: [
        result.explanation,
        stoneReferencePriceCalculation(item.price, s.priceUnit, stonePublicReferenceSizes(item)),
      ]
        .filter(Boolean)
        .join(" "),
      currency,
    };
  }
  if (
    item.pricingMode === "request_quote" ||
    item.price == null ||
    item.price === "" ||
    !Number.isFinite(Number(item.price)) ||
    Number(item.price) < 0
  ) {
    return {
      primary: "Request a price",
      secondary: "",
      note: "Confirm price and availability with the seller.",
      currency,
    };
  }
  const amount = Number(item.price);
  const primary =
    amount === 0
      ? "Free"
      : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  return {
    primary,
    secondary: item.priceType === "negotiable" ? "Seller accepts offers" : "",
    note: "Confirm availability and any delivery charges with the seller.",
    amount,
    currency,
  };
}
function itemFacts(item: PublicExchangeRecord): Array<[string, string]> {
  const facts: Array<[string, string]> = [];
  const supplier = stonePublicSupplier(item);
  if (supplier) facts.push(["Supplier", supplier.name]);
  for (const [label, value] of [
    ["Condition", item.condition],
    ["Brand", item.brand],
    ["Model", item.model],
    ["Year", item.year],
    ["Area", item.location || [item.city, item.state].filter(Boolean).join(", ")],
  ] as Array<[string, unknown]>) {
    const text = clean(value, 200);
    if (text) facts.push([label, text]);
  }
  if (item.mileage != null && Number.isFinite(Number(item.mileage)))
    facts.push(["Mileage", `${Number(item.mileage).toLocaleString("en-US")} mi`]);
  const fields =
    (SELL_CATEGORY_FIELDS as Record<string, readonly { key: string; label: string }[]>)[
      item.category
    ] || [];
  const seen = new Set(["year", "make", "model", "mileage", "brand", "condition"]);
  for (const field of fields) {
    if (seen.has(field.key)) continue;
    seen.add(field.key);
    const value = item.specifications?.[field.key];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
      continue;
    const text = clean(String(value), 500);
    if (text) facts.push([field.label, text]);
  }
  if (isStoneRetailListing(item)) {
    for (const [label, key] of [
      ["Material", "material"],
      ["Recorded reference dimensions (inches)", "referenceSizesInches"],
      ["Identified slab", "exactSlab"],
    ]) {
      const value = clean(
        key === "referenceSizesInches"
          ? stonePublicReferenceSizes(item)
          : item.specifications?.[key],
        1000
      );
      if (value) facts.push([label, value]);
    }
    facts.push([
      "Availability",
      "Confirm the selected slab and available quantity before purchase",
    ]);
  }
  return facts;
}
export function publicExchangeItemSchema(item: PublicExchangeRecord): Record<string, unknown> {
  const url = absolute(item.publicDetailPath);
  const price = publicExchangePrice(item);
  const images = (Array.isArray(item.images) ? item.images : []).slice(0, 16).map(absolute);
  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type":
      item.category === "vehicles"
        ? "Vehicle"
        : item.category === "real-estate"
          ? "RealEstateListing"
          : "Product",
    "@id": `${url}#listing`,
    name: clean(item.title, 200),
    description: clean(item.description),
    url,
    ...(images.length ? { image: images } : {}),
    ...(stonePublicSupplier(item) || item.brand
      ? { brand: { "@type": "Brand", name: stonePublicSupplier(item)?.name || clean(item.brand, 100) } }
      : {}),
    ...(item.model ? { model: clean(item.model, 100) } : {}),
  };
  // Presence on an active public page is not proof of stock, completed sale or a fixed slab offer.
  if (price.amount !== undefined && !isStoneRetailListing(item)) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      price: price.amount.toFixed(2),
      priceCurrency: price.currency,
      url,
    };
    if (typeof item.inStock === "boolean")
      offer.availability = `https://schema.org/${item.inStock ? "InStock" : "OutOfStock"}`;
    const seller = clean(item.businessName || item.sellerName || item.seller?.name, 160);
    if (seller && seller !== "TradeScout seller")
      offer.seller = { "@type": item.businessName ? "Organization" : "Person", name: seller };
    schema.offers = offer;
  }
  const facts = itemFacts(item);
  const calculation = isStoneRetailListing(item)
    ? stoneReferencePriceCalculation(
        item.price,
        item.specifications?.priceUnit,
        stonePublicReferenceSizes(item)
      )
    : null;
  if (calculation) facts.push(["Reference estimate calculation", calculation]);
  if (facts.length && item.category !== "real-estate")
    schema.additionalProperty = facts.map(([name, value]) => ({
      "@type": "PropertyValue",
      name,
      value,
    }));
  return schema;
}
function setTag(html: string, pattern: RegExp, value: string): string {
  return html.replace(pattern, "").replace(/<\/head>/i, `${value}\n</head>`);
}
function documentHtml(
  template: string,
  details: {
    path: string;
    title: string;
    description: string;
    image?: string;
    body: string;
    schemas: Record<string, unknown>[];
    robots?: string;
  }
): string {
  if (!rootPattern.test(template) || !/<\/head>/i.test(template))
    throw new Error("Public Exchange template must have an empty application root");
  const canonical = absolute(details.path);
  const robots = details.robots || EXCHANGE_PUBLIC_ROBOTS;
  let html = setTag(
    template,
    /<title\b[^>]*>[\s\S]*?<\/title>/gi,
    `<title>${e(details.title)}</title>`
  );
  html = setTag(
    html,
    /<link\b[^>]*\brel\s*=\s*["']canonical["'][^>]*>/gi,
    `<link rel="canonical" href="${e(canonical)}">`
  );
  for (const [attribute, name, value] of [
    ["name", "description", details.description],
    ["name", "robots", robots],
    ["property", "og:title", details.title],
    ["property", "og:description", details.description],
    ["property", "og:url", canonical],
    ["property", "og:type", "website"],
    ["property", "og:image", details.image || absolute("/tradescout-social-preview.png?v=12")],
    ["name", "twitter:card", "summary_large_image"],
    ["name", "twitter:title", details.title],
    ["name", "twitter:description", details.description],
    ["name", "twitter:image", details.image || absolute("/tradescout-social-preview.png?v=12")],
  ])
    html = setTag(
      html,
      new RegExp(`<meta\\b[^>]*\\b${attribute}\\s*=\\s*["']${name}["'][^>]*>`, "gi"),
      `<meta ${attribute}="${name}" content="${e(value)}">`
    );
  const style = `<style data-exchange-discovery-style>.exchange-public{max-width:1100px;margin:auto;padding:24px;font:1rem/1.6 system-ui,sans-serif}.exchange-public a{color:inherit;text-decoration:underline}.exchange-public nav{display:flex;flex-wrap:wrap;gap:16px}.exchange-public h1{font-size:clamp(1.8rem,4vw,2.8rem)}.exchange-public img{max-width:100%;height:auto;max-height:480px;object-fit:contain}.exchange-public dl{display:grid;grid-template-columns:minmax(100px,1fr) 2fr;gap:8px}.exchange-public dt{font-weight:700}.exchange-public dd{margin:0;overflow-wrap:anywhere}.exchange-public .listing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,270px),1fr));gap:20px}.exchange-public article{padding:16px;border:1px solid currentColor;border-radius:12px}.exchange-public .price{font-size:1.35rem;font-weight:700}.exchange-public .description{white-space:pre-line;overflow-wrap:anywhere}.exchange-public a:focus-visible{outline:3px solid currentColor;outline-offset:4px}</style>`;
  html = html.replace(
    rootPattern,
    (_match, attributes: string) => `<div${attributes}>${details.body}</div>`
  );
  html = html
    .replace(/\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i, "")
    .replace(/\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i, "")
    .replace(/\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i, "");
  return html.replace(
    /<\/head>/i,
    `${style}${details.schemas.map((schema) => `<script type="application/ld+json" data-exchange-discovery-schema>${json(schema)}</script>`).join("\n")}\n</head>`
  );
}
function nav(category?: string): string {
  return `<nav aria-label="Exchange navigation"><a href="/">TradeScout</a><a href="/exchange">Exchange</a>${category ? `<a href="/exchange/${e(category)}">${e(categoryName(category))}</a>` : ""}<a href="/exchange/llms.txt">Public listing index</a></nav>`;
}
export function renderPublicExchangeListing(template: string, item: PublicExchangeRecord): string {
  const price = publicExchangePrice(item);
  const listingTitle = clean(item.title, 140);
  const title = `${isStoneRetailListing(item) ? listingTitle.replace(/\s*\|\s*TradeScout(?: Stone)?\s*$/i, "") : listingTitle} | TradeScout Exchange`;
  const calculation = isStoneRetailListing(item)
    ? stoneReferencePriceCalculation(
        item.price,
        item.specifications?.priceUnit,
        stonePublicReferenceSizes(item)
      )
    : null;
  const description = clean(`${calculation || `${price.primary}.`} ${item.description || ""}`, 180);
  const images = (Array.isArray(item.images) ? item.images : []).slice(0, 16);
  const facts = itemFacts(item);
  const seller = clean(item.businessName || item.sellerName || item.seller?.name, 160);
  const supplier = stonePublicSupplier(item);
  const supplierAction = supplier
    ? `<section data-exchange-stone-supplier><p>From <a href="${e(supplier.productPath)}">${e(supplier.name)}</a></p><p><a href="${e(item.publicDetailPath)}?inquiry=availability&amp;pricing=fabricator">Request fabricator pricing</a></p><p>Review a pricing request through TradeScout. Pricing and eligibility are confirmed before purchase.</p></section>`
    : "";
  const schema = publicExchangeItemSchema(item);
  const localServices = isStoneRetailListing(item)
    ? `<section aria-label="${e(EXCHANGE_STONE_LOCAL_SERVICES.heading)}" data-exchange-stone-local-services><h2>${e(EXCHANGE_STONE_LOCAL_SERVICES.heading)}</h2><p>${e(EXCHANGE_STONE_LOCAL_SERVICES.description)}</p><p>${e(EXCHANGE_STONE_LOCAL_SERVICES.terms)}</p><p><a href="${e(EXCHANGE_STONE_LOCAL_SERVICES.href)}">${e(EXCHANGE_STONE_LOCAL_SERVICES.linkLabel)}</a></p></section>`
    : "";
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Exchange", item: absolute("/exchange") },
      {
        "@type": "ListItem",
        position: 2,
        name: categoryName(item.category),
        item: absolute(`/exchange/${item.category}`),
      },
      { "@type": "ListItem", position: 3, name: item.title, item: absolute(item.publicDetailPath) },
    ],
  };
  const body = `<main class="exchange-public" data-public-exchange-listing="${e(item.id)}">${nav(item.category)}<h1>${e(clean(item.title, 200))}</h1><p class="price">${e(price.primary)}</p>${price.secondary ? `<p>${e(price.secondary)}</p>` : ""}<p>${e(price.note)}</p>${images.length ? `<figure><img src="${e(images[0])}" alt="${e(clean(item.title, 200))}" width="960" height="640" decoding="async"></figure>` : ""}<p class="description">${e(clean(item.description))}</p>${seller ? `<p>Listed by ${e(seller)}</p>` : ""}${facts.length ? `<h2>Listing details</h2><dl>${facts.map(([label, value]) => `<dt>${e(label)}</dt><dd>${e(value)}</dd>`).join("")}</dl>` : ""}${item.isLocalPickupOnly ? "<p>Local pickup only. Public discovery does not mean nationwide shipping.</p>" : item.willShip ? "<p>Seller offers shipping. Confirm destination, availability and cost before purchase.</p>" : "<p>Confirm pickup or delivery arrangements before purchase.</p>"}${isStoneRetailListing(item) ? "<p>TradeScout stone purchasing is offered in eligible U.S. markets, excluding Pensacola, Florida. Confirm pickup or delivery options and charges with TradeScout before purchase. Photos are material references; confirm the selected slab's appearance, dimensions and finish. Viewing this public listing does not establish purchase eligibility.</p>" : ""}<p><a href="${e(item.publicDetailPath)}?inquiry=availability">Review listing and start a protected request</a></p><p>Contact and purchasing remain in TradeScout’s existing protected flow. Viewing this page does not share contact information or place an order.</p>${item.publicProfilePath ? `<p><a href="${e(item.publicProfilePath)}">Open the seller’s public catalog</a></p>` : ""}</main>`;
  return documentHtml(template, {
    path: item.publicDetailPath,
    title,
    description,
    image: images[0] ? absolute(images[0]) : undefined,
    body: (supplier ? body.replace(`<p>Listed by ${e(seller)}</p>`, "<p>Inquiries coordinated through TradeScout</p>") : body)
      .replace('<p class="price">', `${supplierAction}<p class="price">`)
      .replace("</main>", `${localServices}</main>`),
    schemas: [schema, breadcrumb],
  });
}
export function renderPublicExchangeDirectory(
  template: string,
  data: {
    items: PublicExchangeRecord[];
    page: number;
    pageSize: number;
    total: number;
    category?: string;
  }
): string {
  const path = data.category ? `/exchange/${data.category}` : "/exchange";
  const pagePath = data.page === 1 ? path : `${path}?page=${data.page}`;
  const heading = data.category ? categoryName(data.category) : "TradeScout Exchange";
  const cards = data.items
    .map((item) => {
      const price = publicExchangePrice(item);
      return `<article><h2><a href="${e(item.publicDetailPath)}">${e(item.title)}</a></h2><p class="price">${e(price.primary)}</p>${price.secondary ? `<p>${e(price.secondary)}</p>` : ""}${item.images?.[0] ? `<a href="${e(item.publicDetailPath)}"><img src="${e(item.images[0])}" alt="${e(item.title)}" width="480" height="320" loading="lazy"></a>` : ""}<p>${e(clean(item.description, 240))}</p></article>`;
    })
    .join("");
  const pageLink = (page: number) => (page === 1 ? path : `${path}?page=${page}`);
  const body = `<main class="exchange-public" data-public-exchange-directory="true">${nav()}<h1>${e(heading)}</h1><p>Browse public listings from people and businesses. No paid plan is required for a published listing to appear here.</p><nav aria-label="Listing categories">${Object.entries(
    EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME
  )
    .map(([slug, name]) => `<a href="/exchange/${e(slug)}">${e(name)}</a>`)
    .join(
      ""
    )}</nav><p>Page ${data.page}${data.total ? ` of ${Math.ceil(data.total / data.pageSize)}` : ""}.</p><section class="listing-grid" aria-label="Public listings">${cards || "<p>No public listings are available on this page.</p>"}</section><nav aria-label="Listing pages">${data.page > 1 ? `<a rel="prev" href="${e(pageLink(data.page - 1))}">Previous listings</a>` : ""}${data.page * data.pageSize < data.total ? `<a rel="next" href="${e(pageLink(data.page + 1))}">Next listings</a>` : ""}</nav></main>`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    url: absolute(pagePath),
    name: heading,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: data.items.map((item, i) => ({
        "@type": "ListItem",
        position: (data.page - 1) * data.pageSize + i + 1,
        name: item.title,
        url: absolute(item.publicDetailPath),
      })),
    },
  };
  return documentHtml(template, {
    path: pagePath,
    title: `${heading}${data.page > 1 ? ` — Page ${data.page}` : ""} | Buy and Sell on TradeScout`,
    description:
      "Find public marketplace listings across categories from TradeScout sellers. Review published photos, prices, descriptions and available fulfillment details before contacting a seller.",
    body,
    schemas: [schema],
  });
}
export function exchangeSitemapXml(entries: PublicExchangeIndexEntry[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((item) => `<url><loc>${e(absolute(item.publicDetailPath))}</loc>${item.updatedAt && Number.isFinite(Date.parse(item.updatedAt)) ? `<lastmod>${e(new Date(item.updatedAt).toISOString())}</lastmod>` : ""}</url>`).join("")}</urlset>`;
}
export function exchangeSitemapIndexXml(pages: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from({ length: Math.max(1, pages) }, (_, i) => `<sitemap><loc>${e(absolute(`/sitemap-exchange-listings.xml?page=${i + 1}`))}</loc></sitemap>`).join("")}</sitemapindex>`;
}
export function exchangeListingMarkdown(data: {
  items: PublicExchangeIndexEntry[];
  total: number;
  page: number;
  pageSize: number;
}): string {
  const lines = [
    "# TradeScout Exchange — public marketplace listings",
    "",
    "Public listings from all eligible sellers use the same discovery policy. These are published offers or catalog selections, not proof of inventory, completed sales, trust endorsements or nationwide fulfillment.",
    "",
    `Public HTML directory: ${absolute("/exchange")}`,
    `Listing sitemap: ${absolute("/sitemap-exchange-listings.xml")}`,
    "",
    ...data.items.map(
      (item) =>
        `- [${item.title.replace(/[\[\]\\\r\n]/g, " ")}](${absolute(item.publicDetailPath)}): ${categoryName(item.category)}`
    ),
  ];
  if (data.page * data.pageSize < data.total)
    lines.push("", `Next page: ${absolute(`/exchange/llms.txt?page=${data.page + 1}`)}`);
  return lines.join("\n") + "\n";
}
