/**
 * publicExchangeHtml.ts
 *
 * Server-side OG / meta tag injection for Exchange pages.
 * Runs before the SPA boots so social crawlers (Facebook, Twitter, iMessage,
 * Slack, etc.) see the correct og:url, og:title, and og:description for every
 * shared Exchange link instead of the generic root-domain fallback.
 *
 * Handles:
 *   /exchange                           → hub page
 *   /exchange/:category                 → per-category page
 *   /exchange?item=<id>                 → single listing (best-effort title from DB)
 *   /exchange?tab=promotions&promo=<s>  → promo deep-link
 *   /exchange?tab=sales&companyPromo=<s>→ company promo deep-link
 */

import { formatTradeScoutTitle } from "@shared/brand";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";
import type { ExchangeCategorySlug } from "@shared/exchangeListingRules";
import { storage } from "./storage";

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

// ─── category metadata ────────────────────────────────────────────────────────

const CATEGORY_DESCRIPTIONS: Partial<Record<ExchangeCategorySlug, string>> = {
  business: "Buy or sell complete businesses, franchises, and brand assets on TradeScout Exchange.",
  vehicles: "Browse cars, trucks, motorcycles, boats, and more on TradeScout Exchange.",
  construction:
    "Find heavy machinery, excavators, lifts, and construction equipment on TradeScout Exchange.",
  "building-materials":
    "Browse profile-linked stone, onyx, and building-material catalogs. Confirm project fit, availability, and pricing through a managed TradeScout request.",
  tools: "Shop professional tools, hand tools, and hardware on TradeScout Exchange.",
  furniture: "Discover quality furniture, home décor, and household goods on TradeScout Exchange.",
  farm: "Buy and sell tractors, farm equipment, and livestock on TradeScout Exchange.",
  "business-equipment":
    "Find office equipment, commercial appliances, and business assets on TradeScout Exchange.",
  electronics:
    "Browse laptops, phones, audio gear, and high-end electronics on TradeScout Exchange.",
  sports:
    "Shop premium sports equipment, fitness gear, and outdoor recreation on TradeScout Exchange.",
  collectibles:
    "Find artwork, antiques, coins, and authenticated collectibles on TradeScout Exchange.",
  jewelry: "Browse fine jewelry, luxury watches, and certified gems on TradeScout Exchange.",
  metals: "Buy and sell physical gold, silver, platinum, and palladium on TradeScout Exchange.",
  "local-food":
    "Discover local foods, artisan goods, and handmade products on TradeScout Exchange.",
  other: "Browse premium and high-value items across all categories on TradeScout Exchange.",
};

const CATEGORY_KEYWORDS: Partial<Record<ExchangeCategorySlug, string>> = {
  business: "buy a business, sell a business, franchise for sale, business acquisition",
  vehicles: "cars for sale, trucks, motorcycles, boats, used vehicles",
  construction: "construction equipment, excavators, heavy machinery, lifts for sale",
  "building-materials": "building materials, natural stone, onyx, surfaces, material catalogs",
  tools: "tools for sale, professional tools, hardware, power tools",
  furniture: "furniture for sale, used furniture, home goods, décor",
  farm: "farm equipment, tractors, agricultural machinery, livestock",
  "business-equipment": "office equipment, commercial equipment, business assets",
  electronics: "electronics for sale, laptops, phones, audio equipment",
  sports: "sports equipment, fitness gear, outdoor recreation, golf clubs",
  collectibles: "collectibles, antiques, art for sale, coins, authenticated items",
  jewelry: "jewelry for sale, fine jewelry, luxury watches, diamonds",
  metals: "gold for sale, silver, precious metals, bullion",
  "local-food": "local food, artisan goods, handmade products, farmers market",
  other: "high-value items, premium listings, miscellaneous for sale",
};

// ─── main builder ─────────────────────────────────────────────────────────────

export type ExchangeHtmlOptions = {
  origin: string;
  templateHtml: string;
  /** The full request path including query string, e.g. /exchange?item=abc */
  requestUrl: string;
  /** Category slug from URL path, e.g. "vehicles" from /exchange/vehicles */
  categorySlug?: string | null;
};

export async function buildPublicExchangeHtml(opts: ExchangeHtmlOptions): Promise<string> {
  const { origin, templateHtml, requestUrl, categorySlug } = opts;

  // Parse query params
  let qs = "";
  try {
    const qIdx = requestUrl.indexOf("?");
    if (qIdx !== -1) qs = requestUrl.slice(qIdx + 1);
  } catch {
    // ignore
  }
  const params = new URLSearchParams(qs);
  const itemId = params.get("item") || "";
  const promoSlug = params.get("promo") || "";
  const companyPromoSlug = params.get("companyPromo") || "";

  // ── Resolve metadata ──────────────────────────────────────────────────────

  let title = formatTradeScoutTitle("TradeScout Exchange | Buy, Sell & Discover Local Listings");
  let description =
    "Buy, sell, and discover local listings across categories on TradeScout Exchange. Browse items, post what you want to sell, and explore hyperlocal marketplace activity.";
  let canonical = `${origin}/exchange`;
  let keywords =
    "tradescout exchange, buy and sell locally, local marketplace, local listings, sell items locally";

  // Per-category page (/exchange/:category)
  const slug = (categorySlug || "").trim().toLowerCase() as ExchangeCategorySlug;
  if (slug && slug in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME) {
    const catName = EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[slug];
    title = formatTradeScoutTitle(`${catName} | TradeScout Exchange`);
    description =
      CATEGORY_DESCRIPTIONS[slug] ||
      `Browse ${catName} listings on TradeScout Exchange. Find what you need locally.`;
    canonical = `${origin}/exchange/${encodeURIComponent(slug)}`;
    keywords = [
      CATEGORY_KEYWORDS[slug] || `${catName} for sale`,
      "tradescout exchange",
      "local marketplace",
    ].join(", ");
  }

  // Single item deep-link (/exchange?item=<id>)
  if (itemId && !slug) {
    try {
      const listings = await storage.getMarketplaceListings({ limit: 1 } as any);
      // Try to find the specific listing by id
      const allListings = await storage.getMarketplaceListings({} as any);
      const found = (allListings || []).find((l: any) => String(l?.id || "") === itemId);
      if (found) {
        const itemTitle = String(found.title || "Exchange listing").slice(0, 80);
        const itemDesc = String(found.description || "").slice(0, 160);
        const price = Number(found.price);
        const priceStr = Number.isFinite(price) && price > 0 ? ` — $${price.toLocaleString()}` : "";
        title = formatTradeScoutTitle(`${itemTitle}${priceStr} | TradeScout Exchange`);
        description = itemDesc || `${itemTitle} listed for sale on TradeScout Exchange.`;
        canonical = `${origin}/exchange?item=${encodeURIComponent(itemId)}`;
        keywords = `${itemTitle}, buy locally, tradescout exchange`;
      }
    } catch {
      // Fall through to generic exchange meta
    }
  }

  // Promo deep-link
  if (promoSlug && !slug) {
    canonical = `${origin}/exchange?tab=promotions&promo=${encodeURIComponent(promoSlug)}`;
    title = formatTradeScoutTitle("Exchange Promotion | TradeScout");
    description = "Check out this exclusive promotion on TradeScout Exchange.";
  }

  // Company promo deep-link
  if (companyPromoSlug && !slug) {
    canonical = `${origin}/exchange?tab=sales&companyPromo=${encodeURIComponent(companyPromoSlug)}`;
    title = formatTradeScoutTitle("Exchange Sale | TradeScout");
    description = "Check out this sale on TradeScout Exchange.";
  }

  const imageUrl = `${origin}/tradescout-social-preview.png?v=12`;

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
    /<meta name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml(keywords)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
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
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="website" />`
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

  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "TradeScout",
      url: origin,
    },
  });

  // BreadcrumbList JSON-LD for per-category pages
  if (slug && slug in EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME) {
    const catName = EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[slug];
    html = injectJsonLd(html, {
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
          name: catName,
          item: canonical,
        },
      ],
    });
  }

  return html;
}
