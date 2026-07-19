import { formatTradeScoutTitle } from "@shared/brand";
import {
  createContractorPromoShareMetadata,
  isContractorPromoPubliclyAvailable,
  normalizeContractorPromoSlug,
} from "@shared/contractorPromoShare";
import { storage } from "./storage";
import { hasExposureAuthority } from "./services/exposureAuthority";

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

export type PublicContractorPromoHtmlOptions = {
  origin: string;
  templateHtml: string;
  slug: string;
};

export async function buildPublicContractorPromoHtml(
  options: PublicContractorPromoHtmlOptions
): Promise<string | null> {
  const slug = normalizeContractorPromoSlug(options.slug);
  if (!slug) return null;

  let promo: any;
  let contractor: any;
  try {
    promo = await storage.getContractorPromoBySlug(slug);
    if (!promo || !isContractorPromoPubliclyAvailable(promo)) return null;
    contractor = await storage.getContractor(promo.contractorId);
  } catch {
    return null;
  }

  const authorityUserId = String(contractor?.userId || "").trim();
  if (!contractor || !authorityUserId || !(await hasExposureAuthority(authorityUserId)))
    return null;

  const origin = options.origin.replace(/\/$/, "");
  const meta = createContractorPromoShareMetadata({ promo, provider: contractor, origin });
  if (!meta) return null;

  const title = formatTradeScoutTitle(`${meta.title} | Local promotion`);
  const imageUrl = meta.imageUrl || `${origin}/tradescout-social-preview.png?v=12`;
  const usesDefaultImage = !meta.imageUrl;
  const offer: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: meta.title,
    description: meta.description,
    url: meta.canonical,
    image: imageUrl,
    availability: "https://schema.org/InStock",
    seller: {
      "@type": "LocalBusiness",
      name: String(contractor.companyName || "Local provider"),
      url: `${origin}/contractors/${encodeURIComponent(String(contractor.slug || ""))}`,
    },
  };
  if (promo.expiresAt) offer.validThrough = new Date(promo.expiresAt).toISOString();

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: origin },
      {
        "@type": "ListItem",
        position: 2,
        name: String(contractor.companyName || "Provider"),
        item: `${origin}/contractors/${encodeURIComponent(String(contractor.slug || ""))}`,
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
  html = injectJsonLd(html, offer);
  return html;
}
