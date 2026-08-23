import { PRIMARY_TRADE_SLUGS, getTradeBySlug, slugifyCountyName } from "@shared/tradeSeo";
import { formatTradeScoutTitle } from "@shared/brand";
import { storage } from "./storage";

type PublicHtmlOptions = { origin: string; templateHtml: string };

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

function injectSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function buildMeta(args: {
  origin: string;
  canonicalPath: string;
  title: string;
  description: string;
  keywords: string[];
}) {
  const canonical = `${args.origin}${args.canonicalPath}`;
  const imageUrl = `${args.origin}/tradescout-social-preview.png?v=12`;
  return {
    title: formatTradeScoutTitle(args.title).slice(0, 60),
    description: args.description.replace(/\s+/g, " ").trim().slice(0, 160),
    canonical,
    imageUrl,
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
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
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
  return html;
}

export async function buildPublicDatasetsLandingHtml(opts: PublicHtmlOptions): Promise<string> {
  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath: "/datasets",
    title: "Open Datasets | TradeScout",
    description:
      "Public, read-only datasets for trades, counties, cities, and directory discovery. Contact remains protected through TradeScout Direct Connect.",
    keywords: [
      "datasets",
      "open data",
      "contractors",
      "trades",
      "counties",
      "cities",
      "TradeScout",
    ],
  });

  const summary = `
<main data-seo-datasets="landing" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Open Datasets</h1>
    <p>${escapeHtml(meta.description)}</p>
    <p>Each dataset is a public navigation view of TradeScout's governed directory graph. Trade categories lead to active market coverage; county and city rows appear only after a completed directory snapshot confirms crawlable local businesses.</p>
    <p>These pages publish business names, service categories, and coarse market geography for discovery. They do not publish private street addresses, direct contact details, trust internals, or permission to contact a business.</p>
    <ul>
      <li><a href="/datasets/trades">Trades dataset</a></li>
      <li><a href="/datasets/counties">Counties dataset</a></li>
      <li><a href="/datasets/cities">Cities dataset</a></li>
    </ul>
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: meta.title,
    description: meta.description,
    url: meta.canonical,
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicDatasetsTradesHtml(opts: PublicHtmlOptions): Promise<string> {
  const trades = PRIMARY_TRADE_SLUGS.map((slug) => {
    const t = getTradeBySlug(slug);
    return t ? { slug: t.slug, name: t.name } : null;
  }).filter(Boolean) as Array<{ slug: string; name: string }>;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath: "/datasets/trades",
    title: "Trades Dataset | TradeScout",
    description: "Public list of trade categories for directory discovery.",
    keywords: ["trades", "dataset", "contractors", "directory", "TradeScout"],
  });

  const summary = `
<main data-seo-datasets="trades" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Trades dataset</h1>
    <ul>
      ${trades
        .slice(0, 250)
        .map(
          (t) => `<li><a href="/trade/${encodeURIComponent(t.slug)}">${escapeHtml(t.name)}</a></li>`
        )
        .join("\n")}
    </ul>
  </article>
</main>`;

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: meta.title,
    url: meta.canonical,
  });
  return html;
}

export async function buildPublicDatasetsCountiesHtml(opts: PublicHtmlOptions): Promise<string> {
  const counties = await storage.listDirectoryCountiesForSitemap({ limit: 2000, offset: 0 });

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath: "/datasets/counties",
    title: "Counties Dataset | TradeScout",
    description: "Public list of counties with directory coverage (sampled).",
    keywords: ["counties", "dataset", "contractors", "directory", "TradeScout"],
  });

  const summary = `
<main data-seo-datasets="counties" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Counties dataset</h1>
    <p>Sample (first 2,000). Use JSON endpoint for full paging.</p>
    <ul>
      ${counties
        .slice(0, 2000)
        .map((c) => {
          const state = String(c.stateCode || "").toUpperCase();
          const countySlug = slugifyCountyName(
            String(c.name || "")
              .replace(/\s+County$/i, "")
              .trim()
          );
          return `<li><a href="/county/${encodeURIComponent(state.toLowerCase())}/${encodeURIComponent(
            countySlug
          )}">${escapeHtml(String(c.name || ""))}, ${escapeHtml(state)}</a></li>`;
        })
        .join("\n")}
    </ul>
  </article>
</main>`;

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: meta.title,
    url: meta.canonical,
  });
  return html;
}

export async function buildPublicDatasetsCitiesHtml(opts: PublicHtmlOptions): Promise<string> {
  const cities = await storage.listDirectoryCitiesForSitemap({ limit: 4000, offset: 0 });

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath: "/datasets/cities",
    title: "Cities Dataset | TradeScout",
    description: "Public list of city slugs with directory coverage (sampled).",
    keywords: ["cities", "dataset", "contractors", "directory", "TradeScout"],
  });

  const summary = `
<main data-seo-datasets="cities" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Cities dataset</h1>
    <p>Sample (first 4,000). Use JSON endpoint for full paging.</p>
    <ul>
      ${cities
        .slice(0, 4000)
        .map((c) => {
          const state = String(c.stateCode || "").toUpperCase();
          const citySlug = String(c.citySlug || "")
            .trim()
            .toLowerCase();
          return `<li><a href="/city/${encodeURIComponent(state.toLowerCase())}/${encodeURIComponent(
            citySlug
          )}">${escapeHtml(citySlug)}, ${escapeHtml(state)}</a></li>`;
        })
        .join("\n")}
    </ul>
  </article>
</main>`;

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: meta.title,
    url: meta.canonical,
  });
  return html;
}
