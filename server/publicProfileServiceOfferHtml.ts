import { formatTradeScoutTitle } from "@shared/brand";
import { createProfileServiceOfferShareMetadata } from "@shared/profileOfferShare";
import { pool } from "./db";
import { getPublicProfileServiceOffer } from "./publicProfileOffer";

export type PublicProfileServiceOfferHtmlOptions = {
  origin: string;
  templateHtml: string;
  offerId: string;
};

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

export async function buildPublicProfileServiceOfferHtml(
  options: PublicProfileServiceOfferHtmlOptions
): Promise<string | null> {
  const offer = await getPublicProfileServiceOffer(pool, options.offerId);
  if (!offer) return null;

  const origin = options.origin.replace(/\/$/, "");
  const metadata = createProfileServiceOfferShareMetadata({ offer, origin });
  if (!metadata) return null;

  const title = formatTradeScoutTitle(`${metadata.title} | Service`);
  const imageUrl = metadata.imageUrl || `${origin}/tradescout-social-preview.png?v=12`;
  const usesDefaultImage = !metadata.imageUrl;
  const price = Number(offer.price);
  const serviceJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: metadata.title,
    description: metadata.description,
    image: metadata.imageUrl ? [metadata.imageUrl] : undefined,
    serviceType: offer.serviceCategory || undefined,
    url: metadata.canonical,
  };
  if (Number.isFinite(price) && price >= 0) {
    serviceJsonLd.offers = {
      "@type": "Offer",
      price: price.toFixed(2),
      priceCurrency: offer.currency || "USD",
      availability: "https://schema.org/InStock",
      url: metadata.canonical,
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
        name: metadata.title,
        item: metadata.canonical,
      },
    ],
  };

  let html = options.templateHtml.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );
  const tags: Array<[RegExp, string]> = [
    [
      /<meta name="description"[^>]*>/i,
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`,
    ],
    [
      /<link rel="canonical"[^>]*>/i,
      `<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`,
    ],
    [/<meta property="og:type"[^>]*>/i, '<meta property="og:type" content="product" />'],
    [
      /<meta property="og:title"[^>]*>/i,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
    ],
    [
      /<meta property="og:description"[^>]*>/i,
      `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    ],
    [
      /<meta property="og:url"[^>]*>/i,
      `<meta property="og:url" content="${escapeHtml(metadata.canonical)}" />`,
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
      `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
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
      `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    ],
    [
      /<meta name="twitter:image"[^>]*>/i,
      `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    ],
    [
      /<meta name="twitter:image:alt"[^>]*>/i,
      `<meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
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

  html = injectJsonLd(html, breadcrumbJsonLd);
  html = injectJsonLd(html, serviceJsonLd);
  html = html.replace(
    "</head>",
    '<meta name="tradescout:contact-access" content="protected-request-only" />\n</head>'
  );
  const publicPrice =
    Number.isFinite(price) && price >= 0
      ? `${price.toFixed(2)} ${String(offer.currency || "USD").toUpperCase()}`
      : "";
  html = html.replace(
    /<div id="root">\s*<\/div>/i,
    `<div id="root"><main data-seo-profile-service="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
      <article>
        <h1>${escapeHtml(metadata.title)}</h1>
        <p>${escapeHtml(metadata.description)}</p>
        ${publicPrice ? `<p>${escapeHtml(publicPrice)}</p>` : ""}
        ${metadata.imageUrl ? `<img src="${escapeHtml(metadata.imageUrl)}" alt="${escapeHtml(metadata.imageAlt)}" loading="eager" />` : ""}
        <p>Continue through TradeScout to send a protected service request.</p>
      </article>
    </main></div>`
  );
  return html;
}
