import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import { getPublicationRules } from "./publicationRules";
import { formatTradeScoutTitle } from "@shared/brand";
import { publicBusinessDetailExposureSqlPredicate } from "./publicationBusiness";
import { sqlDirectoryCitySlugExpr } from "./seoDirectoryCitySlug";

type PublicCityHtmlOptions = {
  origin: string;
  templateHtml: string;
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

export async function buildPublicCityHtml(opts: PublicCityHtmlOptions): Promise<string | null> {
  const stateCode = String(opts.stateCode || "").toUpperCase();
  const citySlug = String(opts.citySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(citySlug)) return null;

  const rules = await getPublicationRules();
  const now = new Date();
  const recencyCutoff = new Date(
    now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
  );

  const rows = await db
    .select({
      countyFips: counties.fips,
      countyName: counties.name,
      stateCode: counties.stateCode,
      businessCount: sql<number>`count(*)`,
    })
    .from(businesses)
    .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
    .innerJoin(counties, eq(counties.id, businessCounties.countyId))
    .leftJoin(users, eq(users.id, businesses.ownerUserId))
    .where(
      and(
        eq(businesses.status, "active" as any),
        eq(businesses.publicDiscoveryEnabled, true as any),
        publicBusinessDetailExposureSqlPredicate(),
        eq(counties.stateCode, stateCode),
        sql`${sqlDirectoryCitySlugExpr()} = ${citySlug}`,
        sql`${businesses.updatedAt} >= ${recencyCutoff}`
      )
    )
    .groupBy(counties.fips, counties.name, counties.stateCode)
    .orderBy(asc(counties.name))
    .limit(80);

  if (rows.length === 0) return null;

  const displayCity = titleizeCitySlug(citySlug);
  const canonicalPath = `/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
    citySlug
  )}`;
  const title = formatTradeScoutTitle(
    `${displayCity}, ${stateCode} Contractors Directory | TradeScout`
  );
  const description = `Browse contractors and directory listings in ${displayCity}, ${stateCode}. Select a county to view county-contained directory pages. Contact remains protected through TradeScout Direct Connect.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: [displayCity, stateCode, "contractors", "directory", "counties", "TradeScout"],
    indexable: rows.length > 0,
  });

  const summary = `
<main data-seo-city="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(displayCity)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
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
          const href = `/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
            countySlug
          )}`;
          const count = Number(r.businessCount || 0);
          return `<li><a href="${href}">${escapeHtml(String(r.countyName || ""))}</a> <small>(${count.toLocaleString()})</small></li>`;
        })
        .join("\n")}
    </ul>
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
      "@type": "Place",
      name: `${displayCity}, ${stateCode}`,
      address: { "@type": "PostalAddress", addressLocality: displayCity, addressRegion: stateCode },
    },
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
