import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeBySlug, PRIMARY_TRADE_SLUGS, slugifyCountyName } from "@shared/tradeSeo";
import { formatTradeScoutTitle } from "@shared/brand";
import { loadSnapshotCountyDirectory } from "./services/publicDirectorySnapshotReadService";

type PublicCountyHtmlOptions = {
  origin: string;
  templateHtml: string;
  stateCode: string;
  countySlug: string;
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
    title: args.title.slice(0, 60),
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

export async function buildPublicCountyHtml(opts: PublicCountyHtmlOptions): Promise<string | null> {
  const stateCode = String(opts.stateCode || "").toUpperCase();
  const countySlug = String(opts.countySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(countySlug)) return null;

  const state = US_STATES_COUNTIES.find(
    (s) => String((s as any).code || "").toUpperCase() === stateCode
  );
  if (!state) return null;
  const county =
    (state as any).counties?.find(
      (c: any) =>
        slugifyCountyName(
          String(c?.name || "")
            .replace(/\s+County$/i, "")
            .trim() || String(c?.name || "")
        ) === countySlug
    ) || null;
  if (!county) return null;

  const directory = await loadSnapshotCountyDirectory({
    countyFips: String((county as any).fipsCode || ""),
    businessLimit: 50,
    tradeLimit: 30,
  });
  const sampleBusinesses = directory.businesses.map((business) => ({
    slug: business.slug,
    name: business.name,
    updatedAt: business.updatedAt,
  }));
  const topTrades = directory.trades.map(({ tradeSlug: slug, businessCount: count, updatedAt }) => {
    const trade = getTradeBySlug(slug);
    return {
      slug,
      name: trade ? String((trade as any).name || slug) : slug,
      count,
      lastmod: updatedAt,
    };
  });

  // Ensure primary trades appear (if present) to support deterministic internal linking.
  const presentTradeSlugs = new Set(directory.trades.map((scope) => scope.tradeSlug));
  const primaryPresent = PRIMARY_TRADE_SLUGS.filter((slug) => presentTradeSlugs.has(slug)).slice(
    0,
    24
  );
  const primaryLinks = primaryPresent.map((slug) => {
    const trade = getTradeBySlug(slug);
    return { slug, name: trade ? String((trade as any).name || slug) : slug };
  });

  const canonicalPath = `/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(countySlug)}`;
  const title = formatTradeScoutTitle(
    `Find Contractors in ${String((county as any).name || "County")}, ${stateCode}`
  );
  const description = `Find local contractors and service businesses in ${String(
    (county as any).name || ""
  )}, ${stateCode}. Browse trade categories and county activity, then connect through TradeScout Direct Connect.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: [
      String((county as any).name || ""),
      stateCode,
      "contractors",
      "directory",
      "trades",
      "TradeScout",
    ],
    indexable: sampleBusinesses.length > 0,
  });

  const summary = `
<main data-seo-county="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(String((county as any).name || ""))}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/trade">Browse all trades</a> &nbsp;•&nbsp; <a href="/datasets/cities">Browse cities</a></p>
    ${
      primaryLinks.length
        ? `<h2>Popular trades in this county</h2>
    <ul>
      ${primaryLinks
        .map((t) => {
          const href = `/trade/${encodeURIComponent(t.slug)}/${encodeURIComponent(
            stateCode.toLowerCase()
          )}/${encodeURIComponent(countySlug)}`;
          return `<li><a href="${href}">${escapeHtml(t.name)}</a></li>`;
        })
        .join("\n")}
    </ul>`
        : ""
    }
    ${
      topTrades.length
        ? `<h2>Trades with recent listings</h2>
    <ul>
      ${topTrades
        .map((t) => {
          const href = `/trade/${encodeURIComponent(t.slug)}/${encodeURIComponent(
            stateCode.toLowerCase()
          )}/${encodeURIComponent(countySlug)}`;
          return `<li><a href="${href}">${escapeHtml(t.name)}</a> <small>(${Number(
            t.count || 0
          ).toLocaleString()})</small></li>`;
        })
        .join("\n")}
    </ul>`
        : `<p><em>No recent public directory listings found in this county.</em></p>`
    }
    ${
      sampleBusinesses.length
        ? `<h2>Recent directory listings</h2>
    <ul>
      ${sampleBusinesses
        .slice(0, 25)
        .map((b) => {
          const href = `/business/${encodeURIComponent(b.slug)}`;
          return `<li><a href="${href}">${escapeHtml(b.name)}</a></li>`;
        })
        .join("\n")}
    </ul>`
        : ""
    }
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
      "@type": "AdministrativeArea",
      name: `${String((county as any).name || "")}, ${stateCode}`,
      address: { "@type": "PostalAddress", addressRegion: stateCode, addressCountry: "US" },
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: sampleBusinesses.slice(0, 25).map((b, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: b.name,
        url: `${opts.origin}/business/${encodeURIComponent(b.slug)}`,
      })),
    },
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
