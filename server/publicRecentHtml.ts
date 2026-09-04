import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { counties, tsPublicActivity } from "@shared/schema";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeSeoMatch, normalizeTradeSlug, slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "./publicationRules";
import { isPublicAndCrawlableActivity } from "@shared/publication";
import { formatTradeScoutTitle } from "@shared/brand";

type BaseOpts = { origin: string; templateHtml: string };

type CountyRecentOpts = BaseOpts & { stateCode: string; countySlug: string };
type CityRecentOpts = BaseOpts & { stateCode: string; citySlug: string };
type TradeCountyRecentOpts = BaseOpts & {
  tradeSlug: string;
  stateCode: string;
  countySlug: string;
};
type TradeCityRecentOpts = BaseOpts & { tradeSlug: string; stateCode: string; citySlug: string };

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

function applyMeta(
  templateHtml: string,
  meta: ReturnType<typeof buildMeta>,
  indexable: boolean
) {
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
    indexable
      ? `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
      : `<meta name="robots" content="noindex,follow" />`
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

function formatDate(d: Date) {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

async function loadCountyId(
  stateCode: string,
  countySlug: string
): Promise<{ countyId: string; countyName: string } | null> {
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
  const fips = String((county as any).fipsCode || "").trim();
  if (!/^[0-9]{5}$/.test(fips)) return null;
  const rows = await db
    .select({ id: counties.id, name: counties.name })
    .from(counties)
    .where(and(eq(counties.fips, fips), eq(counties.stateCode, stateCode)))
    .limit(1);
  const found = rows[0];
  if (!found?.id) return null;
  return { countyId: String(found.id), countyName: String(found.name || "") };
}

async function loadRecentActivities(where: any[]) {
  const rules = await getPublicationRules();
  const now = new Date();

  let rows: Array<{
    id: string;
    activityType: string | null;
    occurredAt: Date | null;
    expiresAt: Date | null;
    publicText: string | null;
    activeStatus: boolean | null;
  }> = [];
  try {
    rows = await db
      .select({
        id: tsPublicActivity.id,
        activityType: tsPublicActivity.activityType,
        occurredAt: tsPublicActivity.occurredAt,
        expiresAt: tsPublicActivity.expiresAt,
        publicText: tsPublicActivity.publicText,
        activeStatus: tsPublicActivity.activeStatus,
      })
      .from(tsPublicActivity)
      .where(and(...where))
      .orderBy(desc(tsPublicActivity.occurredAt))
      .limit(80);
  } catch (error) {
    console.error("[SEO] Recent activity query failed; serving fallback page without items", error);
    rows = [];
  }

  const items = rows
    .map((r) => {
      const ok = isPublicAndCrawlableActivity(
        {
          id: String(r.id),
          activeStatus: Boolean(r.activeStatus),
          occurredAt: r.occurredAt as any,
          expiresAt: r.expiresAt as any,
        },
        rules,
        now
      );
      if (!ok.ok) return null;
      const occurredAt = r.occurredAt instanceof Date ? r.occurredAt : null;
      return {
        id: String(r.id),
        activityType: String(r.activityType || ""),
        occurredAt,
        text: typeof r.publicText === "string" ? r.publicText.trim() : "",
      };
    })
    .filter((x): x is { id: string; activityType: string; occurredAt: Date | null; text: string } =>
      Boolean(x)
    );

  return { items, rules };
}

export async function buildPublicCountyRecentHtml(opts: CountyRecentOpts): Promise<string | null> {
  const stateCode = String(opts.stateCode || "").toUpperCase();
  const countySlug = String(opts.countySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(countySlug)) return null;

  const county = await loadCountyId(stateCode, countySlug);
  if (!county) return null;

  const { items, rules } = await loadRecentActivities([
    eq(tsPublicActivity.activeStatus, true as any),
    eq(tsPublicActivity.countyId, county.countyId),
    sql`${tsPublicActivity.expiresAt} > now()`,
  ]);

  const canonicalPath = `/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(countySlug)}/recent`;
  const title = `Recent activity in ${county.countyName}, ${stateCode} | TradeScout`;
  const description = `Public recent activity summaries for ${county.countyName}, ${stateCode} (no contact info). Items expire after ${rules.requestPublicSummaryTtlHours} hours.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: ["recent", "activity", county.countyName, stateCode, "TradeScout"],
  });

  const summary = `
<main data-seo-recent="county" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Recent activity in ${escapeHtml(county.countyName)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(countySlug)}">County page</a></p>
    ${
      items.length
        ? `<ul>${items
            .map((it) => {
              const label = it.text ? it.text : it.activityType.replace(/_/g, " ");
              const date = it.occurredAt ? formatDate(it.occurredAt) : "";
              return `<li>${escapeHtml(label)}${date ? ` <small>(${escapeHtml(date)})</small>` : ""}</li>`;
            })
            .join("\n")}</ul>`
        : `<p><em>No recent public activity is available for this scope.</em></p>`
    }
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
  };

  let html = applyMeta(opts.templateHtml, meta, items.length > 0);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicCityRecentHtml(opts: CityRecentOpts): Promise<string | null> {
  const stateCode = String(opts.stateCode || "").toUpperCase();
  const citySlug = String(opts.citySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(citySlug)) return null;

  const { items, rules } = await loadRecentActivities([
    eq(tsPublicActivity.activeStatus, true as any),
    eq(tsPublicActivity.stateCode, stateCode),
    eq(tsPublicActivity.citySlug, citySlug),
    sql`${tsPublicActivity.expiresAt} > now()`,
  ]);

  const displayCity = citySlug.replace(/-+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const canonicalPath = `/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(citySlug)}/recent`;
  const title = `Recent activity in ${displayCity}, ${stateCode} | TradeScout`;
  const description = `Public recent activity summaries for ${displayCity}, ${stateCode} (no contact info). Items expire after ${rules.requestPublicSummaryTtlHours} hours.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: ["recent", "activity", displayCity, stateCode, "TradeScout"],
  });

  const summary = `
<main data-seo-recent="city" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Recent activity in ${escapeHtml(displayCity)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/city/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(citySlug)}">City page</a></p>
    ${
      items.length
        ? `<ul>${items
            .map((it) => {
              const label = it.text ? it.text : it.activityType.replace(/_/g, " ");
              const date = it.occurredAt ? formatDate(it.occurredAt) : "";
              return `<li>${escapeHtml(label)}${date ? ` <small>(${escapeHtml(date)})</small>` : ""}</li>`;
            })
            .join("\n")}</ul>`
        : `<p><em>No recent public activity is available for this scope.</em></p>`
    }
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
  };

  let html = applyMeta(opts.templateHtml, meta, items.length > 0);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicTradeCountyRecentHtml(
  opts: TradeCountyRecentOpts
): Promise<string | null> {
  const match = getTradeSeoMatch(opts.tradeSlug);
  if (!match) return null;
  const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);

  const stateCode = String(opts.stateCode || "").toUpperCase();
  const countySlug = String(opts.countySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(countySlug)) return null;

  const county = await loadCountyId(stateCode, countySlug);
  if (!county) return null;

  const { items, rules } = await loadRecentActivities([
    eq(tsPublicActivity.activeStatus, true as any),
    eq(tsPublicActivity.countyId, county.countyId),
    eq(tsPublicActivity.tradeSlug, canonicalTradeSlug),
    sql`${tsPublicActivity.expiresAt} > now()`,
  ]);

  const canonicalPath = `/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/${encodeURIComponent(countySlug)}/recent`;
  const title = `Recent ${match.trade.name} activity in ${county.countyName}, ${stateCode} | TradeScout`;
  const description = `Public recent activity summaries for ${match.trade.name} in ${county.countyName}, ${stateCode} (no contact info). Items expire after ${rules.requestPublicSummaryTtlHours} hours.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: ["recent", match.trade.name, county.countyName, stateCode, "TradeScout"],
  });

  const summary = `
<main data-seo-recent="trade-county" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Recent ${escapeHtml(match.trade.name)} activity in ${escapeHtml(county.countyName)}, ${escapeHtml(
      stateCode
    )}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/${encodeURIComponent(countySlug)}">Directory scope</a></p>
    ${
      items.length
        ? `<ul>${items
            .map((it) => {
              const label = it.text ? it.text : it.activityType.replace(/_/g, " ");
              const date = it.occurredAt ? formatDate(it.occurredAt) : "";
              return `<li>${escapeHtml(label)}${date ? ` <small>(${escapeHtml(date)})</small>` : ""}</li>`;
            })
            .join("\n")}</ul>`
        : `<p><em>No recent public activity is available for this scope.</em></p>`
    }
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
  };

  let html = applyMeta(opts.templateHtml, meta, items.length > 0);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicTradeCityRecentHtml(
  opts: TradeCityRecentOpts
): Promise<string | null> {
  const match = getTradeSeoMatch(opts.tradeSlug);
  if (!match) return null;
  const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);

  const stateCode = String(opts.stateCode || "").toUpperCase();
  const citySlug = String(opts.citySlug || "")
    .trim()
    .toLowerCase();
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!/^[a-z0-9-]+$/.test(citySlug)) return null;

  const { items, rules } = await loadRecentActivities([
    eq(tsPublicActivity.activeStatus, true as any),
    eq(tsPublicActivity.stateCode, stateCode),
    eq(tsPublicActivity.citySlug, citySlug),
    eq(tsPublicActivity.tradeSlug, canonicalTradeSlug),
    sql`${tsPublicActivity.expiresAt} > now()`,
  ]);

  const displayCity = citySlug.replace(/-+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const canonicalPath = `/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/city/${encodeURIComponent(citySlug)}/recent`;
  const title = `Recent ${match.trade.name} activity in ${displayCity}, ${stateCode} | TradeScout`;
  const description = `Public recent activity summaries for ${match.trade.name} in ${displayCity}, ${stateCode} (no contact info). Items expire after ${rules.requestPublicSummaryTtlHours} hours.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: ["recent", match.trade.name, displayCity, stateCode, "TradeScout"],
  });

  const summary = `
<main data-seo-recent="trade-city" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Recent ${escapeHtml(match.trade.name)} activity in ${escapeHtml(displayCity)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/city/${encodeURIComponent(citySlug)}">Directory scope</a></p>
    ${
      items.length
        ? `<ul>${items
            .map((it) => {
              const label = it.text ? it.text : it.activityType.replace(/_/g, " ");
              const date = it.occurredAt ? formatDate(it.occurredAt) : "";
              return `<li>${escapeHtml(label)}${date ? ` <small>(${escapeHtml(date)})</small>` : ""}</li>`;
            })
            .join("\n")}</ul>`
        : `<p><em>No recent public activity is available for this scope.</em></p>`
    }
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
  };

  let html = applyMeta(opts.templateHtml, meta, items.length > 0);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
