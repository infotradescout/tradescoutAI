import { formatTradeScoutTitle } from "@shared/brand";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
  normalizeHandmadeProductId,
} from "@shared/handmadeProductShare";
import { storage } from "./storage";
import { hasExposureAuthority } from "./services/exposureAuthority";
import { toPublicHandmadeProduct } from "./publicHandmadeProduct";

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

function absoluteImageUrl(origin: string, value: string): string | null {
  try {
    const parsed = new URL(value, `${origin}/`);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function cleanDescription(value: unknown, fallback: string): string {
  const description = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return (description || fallback).slice(0, 160);
}

export type PublicHandmadeProductHtmlOptions = {
  origin: string;
  templateHtml: string;
  productId: string;
};

export async function buildPublicHandmadeProductHtml(
  options: PublicHandmadeProductHtmlOptions
): Promise<string | null> {
  const productId = normalizeHandmadeProductId(options.productId);
  if (!productId) return null;

  let product: any;
  try {
    product = await storage.getHandmadeProduct(productId);
  } catch {
    return null;
  }
  product = toPublicHandmadeProduct(product);
  if (!product || !(await hasExposureAuthority(String(product.sellerId || "")))) return null;

  const productPath = buildHandmadeProductPath(product.id);
  if (!productPath) return null;

  const origin = options.origin.replace(/\/$/, "");
  const canonical = `${origin}${productPath}`;
  const itemTitle = String(product.title || "Handmade product")
    .trim()
    .slice(0, 100);
  const title = formatTradeScoutTitle(`${itemTitle} | Handmade`);
  const description = cleanDescription(
    product.description,
    `${itemTitle}, offered by a local maker on TradeScout Handmade.`
  );
  const imageUrl =
    listHandmadeProductImageUrls(product)
      .map((image) => absoluteImageUrl(origin, image))
      .find(Boolean) || `${origin}/tradescout-social-preview.png?v=11`;
  const price = Number(product.price);
  const currency = String(product.currency || "USD")
    .toUpperCase()
    .slice(0, 3);
  const availability = product.inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: itemTitle,
    description,
    image: imageUrl,
    url: canonical,
  };
  if (Array.isArray(product.materials) && product.materials.length > 0) {
    productJsonLd.material = product.materials.slice(0, 12);
  }
  if (Array.isArray(product.colors) && product.colors.length > 0) {
    productJsonLd.color = product.colors.slice(0, 12).join(", ");
  }
  if (Number.isFinite(price) && price >= 0) {
    productJsonLd.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: currency || "USD",
      availability,
      url: canonical,
    };
  }

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      {
        "@type": "ListItem",
        position: 2,
        name: "Handmade Marketplace",
        item: `${origin}/handmade-marketplace`,
      },
      { "@type": "ListItem", position: 3, name: itemTitle, item: canonical },
    ],
  };

  let html = options.templateHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );
  const tags: Array<[RegExp, string]> = [
    [
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeHtml(description)}" />`,
    ],
    [/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(canonical)}" />`],
    [/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="product" />'],
    [
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
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
      /<meta property="og:image:alt"[^>]*>/i,
      `<meta property="og:image:alt" content="${escapeHtml(itemTitle)}" />`,
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
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    ],
    [
      /<meta name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ],
  ];
  for (const [pattern, tag] of tags) html = upsertTag(html, pattern, tag);

  html = injectJsonLd(html, breadcrumbJsonLd);
  html = injectJsonLd(html, productJsonLd);
  return html;
}
