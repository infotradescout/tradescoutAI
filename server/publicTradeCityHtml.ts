import { getTradeSeoMatch, normalizeTradeSlug } from "@shared/tradeSeo";
import { formatTradeScoutTitle } from "@shared/brand";
import { isCanonicalPublicCitySlug, normalizePublicCitySlug } from "./seoDirectoryCitySlug";
import { loadExactTradeCityCountyScopes } from "./services/publicTradeCityScopeService";

type PublicTradeCityHtmlOptions = {
  origin: string;
  templateHtml: string;
  tradeSlug: string;
  stateCode: string;
  citySlug: string;
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string) {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function titleizeCitySlug(slug: string): string {
  const cleaned = String(slug || "")
    .trim()
    .replace(/-+/g, " ")
    .trim();
  return cleaned.replace(/\b\w/g, (m) => m.toUpperCase());
}

function buildMeta(args: {
  origin: string;
  canonicalPath: string;
  title: string;
  description: string;
  keywords: string[];
  indexable?: boolean;
}) {
  const canonical = `${args.origin}${args.canonicalPath}`;
  const imageUrl = `${args.origin}/tradescout-social-preview.png?v=12`;
  return {
    title: formatTradeScoutTitle(args.title).slice(0, 60),
    description: args.description.replace(/\s+/g, " ").trim().slice(0, 160),
    canonical,
    imageUrl,
    indexable: args.indexable !== false,
    keywords: args.keywords
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .slice(0, 18)
      .join(", "),
  };
}

function buildTradeCityDiscoveryNote(args: { tradeName: string; city: string; stateCode: string }) {
  return [
    `TradeScout organizes ${args.tradeName} discovery for ${args.city}, ${args.stateCode} around public business coverage, county routing, and protected contact rules.`,
    "The page is meant for comparing local availability before any Direct Connect request.",
    "Visibility does not grant contact access; contact still moves through intent, decision, and protected contact steps.",
  ].join(" ");
}

function applyMeta(templateHtml: string, meta: ReturnType<typeof buildMeta>) {
  let html = templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="keywords"[^>]*>/i,
    `<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    meta.indexable
      ? `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
      : `<meta name="robots" content="noindex, follow" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(meta.canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(meta.imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(meta.imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
  return html;
}

export async function buildPublicTradeCityHtml(
  opts: PublicTradeCityHtmlOptions
): Promise<string | null> {
  const match = getTradeSeoMatch(opts.tradeSlug);
  if (!match) return null;

  const stateCode = String(opts.stateCode || "").toUpperCase();
  const citySlug = normalizePublicCitySlug(opts.citySlug);
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!isCanonicalPublicCitySlug(opts.citySlug)) return null;

  const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);
  const rows = await loadExactTradeCityCountyScopes({
    tradeSlug: canonicalTradeSlug,
    stateCode,
    citySlug,
  });

  const displayCity = titleizeCitySlug(citySlug);
  const canonicalPath = `/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/city/${encodeURIComponent(citySlug)}`;
  const title = `${match.trade.name} in ${displayCity}, ${stateCode}`;
  const description = `Find ${match.trade.name} contractors in ${displayCity}, ${stateCode} on TradeScout. Compare county coverage, crawlable public business signals, and protected Direct Connect paths.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: [match.trade.name, displayCity, stateCode, "contractors", "directory", "TradeScout"],
    indexable: rows.length > 0,
  });

  const summary = `
<main data-seo-trade-city="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(match.trade.name)} in ${escapeHtml(displayCity)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <section aria-label="TradeScout city discovery context">
      <h2>Local discovery context</h2>
      <p>${escapeHtml(
        buildTradeCityDiscoveryNote({
          tradeName: match.trade.name,
          city: displayCity,
          stateCode,
        })
      )}</p>
    </section>
    <p><a href="/trade/${encodeURIComponent(canonicalTradeSlug)}">All states</a></p>
    <h2>Counties</h2>
    <ul>
      ${rows
        .map((r) => {
          const countySlug = String(r.countyName || "")
            .replace(/\s+County$/i, "")
            .trim()
            .toLowerCase()
            .replace(/[^\w-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-+|-+$/g, "");
          const href = `/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
            stateCode.toLowerCase()
          )}/${encodeURIComponent(countySlug)}?city=${encodeURIComponent(citySlug)}`;
          const count = Number(r.businessCount || 0);
          return `<li><a href="${href}">${escapeHtml(String(r.countyName || ""))}</a> <small>(${count.toLocaleString()})</small></li>`;
        })
        .join("\n")}
    </ul>
    ${rows.length ? "" : "<p><em>No recent public business coverage is available for this trade and city yet.</em></p>"}
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
    about: {
      "@type": "Service",
      name: match.trade.name,
      areaServed: { "@type": "Place", name: `${displayCity}, ${stateCode}` },
    },
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
