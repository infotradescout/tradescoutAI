import { and, asc, eq, or, sql } from "drizzle-orm";
import { db, pool } from "./db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import {
  getTradeBySlug,
  getTradeSeoMatch,
  normalizeTradeSlug,
  slugifyCountyName,
} from "@shared/tradeSeo";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getPublicationRules } from "./publicationRules";
import { isPublicAndCrawlableBusiness } from "@shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  publicBusinessDetailExposureSqlPredicate,
} from "./publicationBusiness";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  listActiveTradeCountyScopes,
  listActiveTradeScopes,
  listActiveTradeStateScopes,
} from "./services/seoDirectoryNavigationService";

type PublicTradeHtmlOptions = {
  origin: string;
  templateHtml: string;
};

let cachedHasPublicDiscoveryEnabledColumn: boolean | null = null;
let loggedMissingPublicDiscoveryEnabledColumn = false;

async function hasPublicDiscoveryEnabledColumn(): Promise<boolean> {
  if (cachedHasPublicDiscoveryEnabledColumn !== null) return cachedHasPublicDiscoveryEnabledColumn;
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'businesses'
           AND column_name = 'public_discovery_enabled'
       ) as exists`
    );
    cachedHasPublicDiscoveryEnabledColumn = Boolean(result.rows?.[0]?.exists);
    return cachedHasPublicDiscoveryEnabledColumn;
  } catch (err) {
    cachedHasPublicDiscoveryEnabledColumn = false;
    return false;
  }
}

function isMissingColumnError(error: unknown, columnName: string): boolean {
  const err = error as any;
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return code === "42703" && message.toLowerCase().includes(String(columnName).toLowerCase());
}

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

function countyNameToSlug(name: string): string {
  const cleaned = String(name || "")
    .trim()
    .replace(/\s+County$/i, "")
    .trim();
  return slugifyCountyName(cleaned || name);
}

function buildTradeWhereClause(tradeRaw: unknown) {
  const match = getTradeSeoMatch(tradeRaw);
  if (!match) return null;
  const patterns = match.keywords
    .map((k) => String(k || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((k) => `%${k.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`);
  if (!patterns.length) return null;
  return or(...patterns.map((pattern) => sql`${businesses.profileData}::text ILIKE ${pattern}`));
}

function buildTradeMeta(args: {
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

function buildTradeDiscoveryNote(args: {
  tradeName: string;
  placeName: string;
  scope: "state" | "county" | "city" | "national";
}) {
  const place = args.scope === "national" ? "available counties and states" : args.placeName.trim();
  return [
    `TradeScout organizes ${args.tradeName} discovery around local operating areas, publication status, and crawlable public business information.`,
    `Use this page to compare ${args.tradeName} coverage for ${place}, then continue through Direct Connect when contact is appropriate.`,
    "Visibility never grants direct contact access; requests stay gated through intent, decision, and protected contact steps.",
  ].join(" ");
}

function applyMeta(templateHtml: string, meta: ReturnType<typeof buildTradeMeta>) {
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

export async function buildPublicTradeOverviewHtml(
  args: PublicTradeHtmlOptions & { tradeSlug: string }
): Promise<string | null> {
  const raw = String(args.tradeSlug || "").trim();
  const match = getTradeSeoMatch(raw);
  if (!match) return null;

  const canonicalSlug = normalizeTradeSlug(match.canonicalSlug);
  let stateScopes: Awaited<ReturnType<typeof listActiveTradeStateScopes>> = [];
  try {
    stateScopes = await listActiveTradeStateScopes(canonicalSlug);
  } catch (error) {
    console.warn("[SEO] Trade overview navigation degraded; omitting crawl links", {
      tradeSlug: canonicalSlug,
      error,
    });
  }
  const activeStates = stateScopes
    .map((scope) => {
      const state = US_STATES_COUNTIES.find(
        (item) => String(item.code || "").toUpperCase() === scope.stateCode
      );
      return state ? { ...state, businessCount: scope.businessCount } : null;
    })
    .filter(Boolean) as Array<(typeof US_STATES_COUNTIES)[number] & { businessCount: number }>;
  const title = formatTradeScoutTitle(`Find ${match.trade.name} Contractors by State`);
  const description = `Find ${match.trade.name} contractors by state and county on TradeScout. Compare local coverage, review crawlable public business information, and continue through Direct Connect when contact is appropriate.`;
  const meta = buildTradeMeta({
    origin: args.origin,
    canonicalPath: `/trade/${encodeURIComponent(canonicalSlug)}`,
    title,
    description,
    keywords: [
      match.trade.name,
      canonicalSlug,
      "contractors",
      "directory",
      "counties",
      "TradeScout",
    ],
    indexable: activeStates.length > 0,
  });

  const summary = `
<main data-seo-trade="overview" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(match.trade.name)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>${escapeHtml(
      buildTradeDiscoveryNote({
        tradeName: match.trade.name,
        placeName: "",
        scope: "national",
      })
    )}</p>
    <h2>Browse by state</h2>
    <ul>
      ${activeStates
        .map((s) => {
          const href = `/trade/${encodeURIComponent(canonicalSlug)}/${encodeURIComponent(
            String(s.code || "").toLowerCase()
          )}`;
          return `<li><a href="${href}">${escapeHtml(String(s.name || s.code))}</a> <small>(${s.businessCount.toLocaleString()})</small></li>`;
        })
        .join("\n")}
    </ul>
    ${activeStates.length ? "" : "<p><em>No recent public directory coverage is available for this trade yet.</em></p>"}
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
      "@type": "Thing",
      name: match.trade.name,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "TradeScout",
      url: `${args.origin}/`,
    },
  };

  let html = applyMeta(args.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicTradeDirectoryHtml(
  args: PublicTradeHtmlOptions
): Promise<string | null> {
  let tradeScopes: Awaited<ReturnType<typeof listActiveTradeScopes>> = [];
  try {
    tradeScopes = await listActiveTradeScopes();
  } catch (error) {
    console.warn("[SEO] Trade directory navigation degraded; omitting crawl links", error);
  }
  const items = tradeScopes
    .map((scope) => {
      const trade = getTradeBySlug(scope.tradeSlug);
      return trade
        ? { slug: trade.slug, name: trade.name, businessCount: scope.businessCount }
        : null;
    })
    .filter(Boolean) as Array<{ slug: string; name: string; businessCount: number }>;

  const title = formatTradeScoutTitle("Find Contractors by Trade");
  const description =
    "Browse contractor trades on TradeScout, then drill into states and counties to compare crawlable local business coverage before protected Direct Connect contact.";
  const meta = buildTradeMeta({
    origin: args.origin,
    canonicalPath: `/trade`,
    title,
    description,
    keywords: ["trades", "contractors", "directory", "counties", "TradeScout"],
    indexable: items.length > 0,
  });

  const summary = `
<main data-seo-trade="directory" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Trades Directory</h1>
    <p>${escapeHtml(description)}</p>
    <p>TradeScout keeps discovery separate from access: public visibility helps people compare local options, while contact still moves through intent, decision, and protected Direct Connect steps.</p>
    <ul>
      ${items
        .slice(0, 200)
        .map(
          (t) =>
            `<li><a href="/trade/${encodeURIComponent(t.slug)}">${escapeHtml(t.name)}</a> <small>(${t.businessCount.toLocaleString()})</small></li>`
        )
        .join("\n")}
    </ul>
    ${items.length ? "" : "<p><em>No recent public trade coverage is available yet.</em></p>"}
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description: meta.description,
    url: meta.canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "TradeScout",
      url: `${args.origin}/`,
    },
  };

  let html = applyMeta(args.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicTradeStateHtml(
  args: PublicTradeHtmlOptions & { tradeSlug: string; stateCode: string }
): Promise<string | null> {
  const match = getTradeSeoMatch(args.tradeSlug);
  if (!match) return null;
  const stateCode = String(args.stateCode || "").toUpperCase();
  const state =
    US_STATES_COUNTIES.find((s) => String(s.code || "").toUpperCase() === stateCode) || null;
  if (!state) return null;

  const canonicalSlug = normalizeTradeSlug(match.canonicalSlug);
  let countyScopes: Awaited<ReturnType<typeof listActiveTradeCountyScopes>> = [];
  try {
    countyScopes = await listActiveTradeCountyScopes(canonicalSlug, stateCode);
  } catch (error) {
    console.warn("[SEO] Trade state navigation degraded; omitting crawl links", {
      tradeSlug: canonicalSlug,
      stateCode,
      error,
    });
  }
  const activeCounties = countyScopes
    .map((scope) => {
      const county = state.counties.find(
        (item) => countyNameToSlug(String((item as any).name || "")) === scope.countySlug
      );
      return county ? { county, ...scope } : null;
    })
    .filter(Boolean) as Array<{
    county: (typeof state.counties)[number];
    countySlug: string;
    businessCount: number;
  }>;
  const title = formatTradeScoutTitle(`${match.trade.name} Contractors in ${state.name}`);
  const description = `Find ${match.trade.name} contractors in ${state.name} on TradeScout. Narrow by county to compare local coverage, public business signals, and protected Direct Connect paths.`;
  const meta = buildTradeMeta({
    origin: args.origin,
    canonicalPath: `/trade/${encodeURIComponent(canonicalSlug)}/${encodeURIComponent(stateCode.toLowerCase())}`,
    title,
    description,
    keywords: [match.trade.name, state.name, state.code, "counties", "directory", "TradeScout"],
    indexable: activeCounties.length > 0,
  });

  const summary = `
<main data-seo-trade="state" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(match.trade.name)} in ${escapeHtml(state.name)}</h1>
    <p>${escapeHtml(description)}</p>
    <p>${escapeHtml(
      buildTradeDiscoveryNote({
        tradeName: match.trade.name,
        placeName: state.name,
        scope: "state",
      })
    )}</p>
    <p><a href="/trade/${encodeURIComponent(canonicalSlug)}">All states</a></p>
    <h2>Counties</h2>
    <ul>
      ${activeCounties
        .map(({ county, countySlug, businessCount }) => {
          const href = `/trade/${encodeURIComponent(canonicalSlug)}/${encodeURIComponent(
            stateCode.toLowerCase()
          )}/${encodeURIComponent(countySlug)}`;
          return `<li><a href="${href}">${escapeHtml(String((county as any).name || ""))}</a> <small>(${businessCount.toLocaleString()})</small></li>`;
        })
        .join("\n")}
    </ul>
    ${activeCounties.length ? "" : "<p><em>No recent public directory coverage is available in this state for this trade yet.</em></p>"}
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
      "@type": "Thing",
      name: match.trade.name,
    },
    spatialCoverage: {
      "@type": "AdministrativeArea",
      name: state.name,
      addressCountry: "US",
    },
  };

  let html = applyMeta(args.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicTradeCountyHtml(
  args: PublicTradeHtmlOptions & { tradeSlug: string; stateCode: string; countySlug: string }
): Promise<string | null> {
  const match = getTradeSeoMatch(args.tradeSlug);
  if (!match) return null;

  const stateCode = String(args.stateCode || "").toUpperCase();
  const state =
    US_STATES_COUNTIES.find((s) => String(s.code || "").toUpperCase() === stateCode) || null;
  if (!state) return null;

  const countySlug = String(args.countySlug || "")
    .trim()
    .toLowerCase();
  const county =
    state.counties.find((c) => countyNameToSlug(String((c as any).name || "")) === countySlug) ||
    null;
  if (!county) return null;

  const canonicalSlug = normalizeTradeSlug(match.canonicalSlug);

  const canonicalPath = `/trade/${encodeURIComponent(canonicalSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/${encodeURIComponent(countySlug)}`;

  const title = formatTradeScoutTitle(`${match.trade.name} in ${county.name}, ${stateCode}`);
  const description = `Find ${match.trade.name} contractors serving ${county.name}, ${stateCode} on TradeScout. Review crawlable local business coverage, county context, and protected Direct Connect paths.`;
  const metaArgs = {
    origin: args.origin,
    canonicalPath,
    title,
    description,
    keywords: [match.trade.name, county.name, state.name, "directory", "contractors", "TradeScout"],
  };

  const tradeClause = buildTradeWhereClause(canonicalSlug);
  const whereClauses: any[] = [
    eq(counties.fips, String((county as any).fipsCode || "")),
    eq(businesses.status, "active" as any),
    publicBusinessDetailExposureSqlPredicate(),
  ];
  if (tradeClause) whereClauses.push(tradeClause);

  const includePublicDiscoveryEnabled = await hasPublicDiscoveryEnabledColumn();
  if (!includePublicDiscoveryEnabled && !loggedMissingPublicDiscoveryEnabledColumn) {
    loggedMissingPublicDiscoveryEnabledColumn = true;
    console.error(
      "[SEO] Missing businesses.public_discovery_enabled; treating discovery as disabled. Run migrations to restore full SEO listings."
    );
  }

  const runQuery = async (includeDiscovery: boolean) =>
    db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        claimStatus: businesses.claimStatus,
        ownerUserId: businesses.ownerUserId,
        updatedAt: businesses.updatedAt,
        publicDiscoveryEnabled: includeDiscovery
          ? businesses.publicDiscoveryEnabled
          : sql<boolean>`false`,
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(and(...whereClauses))
      .orderBy(asc(businesses.name))
      .limit(200);

  let rows: any[];
  try {
    rows = await runQuery(includePublicDiscoveryEnabled);
  } catch (error) {
    // Defensive: some environments have drift and will error even if our introspection cache is stale.
    if (includePublicDiscoveryEnabled && isMissingColumnError(error, "public_discovery_enabled")) {
      cachedHasPublicDiscoveryEnabledColumn = false;
      if (!loggedMissingPublicDiscoveryEnabledColumn) {
        loggedMissingPublicDiscoveryEnabledColumn = true;
        console.error(
          "[SEO] Missing businesses.public_discovery_enabled (runtime); retrying without discovery filter. Run migrations to restore full SEO listings."
        );
      }
      rows = await runQuery(false);
    } else {
      console.error(
        "[SEO] Trade county listing query failed; serving fallback page without listings",
        {
          tradeSlug: canonicalSlug,
          stateCode,
          countySlug,
          error,
        }
      );
      rows = [];
    }
  }

  const rules = await getPublicationRules();
  const now = new Date();
  const recencyCutoff = new Date(
    now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
  );

  const items = rows
    .map((r) => {
      const slug = String((r as any).slug || "").trim();
      const name = String((r as any).name || "").trim();
      if (!slug || !name) return null;

      const tier = derivePublicationTier({
        ownerUserId: (r as any).ownerUserId ? String((r as any).ownerUserId) : null,
        claimStatus: String((r as any).claimStatus || ""),
        ownerVerificationStatus: (r as any).ownerVerificationStatus
          ? String((r as any).ownerVerificationStatus)
          : null,
        ownerAddressVerified:
          typeof (r as any).ownerAddressVerified === "boolean"
            ? (r as any).ownerAddressVerified
            : null,
      });

      const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
      if (!updatedAt) return null;
      const pub = isPublicAndCrawlableBusiness(
        buildPublicBusinessSignals({
          id: String((r as any).id),
          name,
          slug,
          updatedAt,
          publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
          stateCode: stateCode || null,
          countyName: county.name,
          city: null,
          tradeSlug: canonicalSlug,
          tier,
        }),
        rules,
        now
      );
      if (!canServePublicBusinessDetail({ publication: pub, tier })) return null;
      if (updatedAt < recencyCutoff) return null;

      return {
        slug,
        name,
        claimStatus:
          String((r as any).claimStatus || "unclaimed").toLowerCase() === "claimed"
            ? "claimed"
            : "unclaimed",
      };
    })
    .filter((r): r is { slug: string; name: string; claimStatus: "claimed" | "unclaimed" } =>
      Boolean(r)
    );
  const meta = buildTradeMeta({ ...metaArgs, indexable: items.length > 0 });

  const summary = `
<main data-seo-trade="county" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(match.trade.name)} in ${escapeHtml(county.name)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <section aria-label="TradeScout local discovery context">
      <h2>Local discovery context</h2>
      <p>${escapeHtml(
        buildTradeDiscoveryNote({
          tradeName: match.trade.name,
          placeName: `${county.name}, ${stateCode}`,
          scope: "county",
        })
      )}</p>
      <ul>
        <li>County container: ${escapeHtml(county.name)}, ${escapeHtml(state.name)}</li>
        <li>Trade category: ${escapeHtml(match.trade.name)}</li>
        <li>Contact rule: Direct Connect protects intent, decision, and contact flow.</li>
      </ul>
    </section>
    <p>
      <a href="/trade/${encodeURIComponent(canonicalSlug)}">All states</a>
      &nbsp;•&nbsp;
      <a href="/trade/${encodeURIComponent(canonicalSlug)}/${encodeURIComponent(
        stateCode.toLowerCase()
      )}">${escapeHtml(state.name)} counties</a>
      &nbsp;•&nbsp;
      <a href="/county/${encodeURIComponent(stateCode.toLowerCase())}/${encodeURIComponent(
        countySlug
      )}">County page</a>
    </p>
    <h2>Directory listings</h2>
    <ul>
      ${items
        .slice(0, 200)
        .map((biz) => {
          const href = `/business/${encodeURIComponent(biz.slug)}`;
          const badge = biz.claimStatus === "claimed" ? "Claimed" : "Unclaimed";
          return `<li><a href="${href}">${escapeHtml(biz.name)}</a> <small>(${badge})</small></li>`;
        })
        .join("\n")}
    </ul>
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: meta.description,
    url: meta.canonical,
    itemListOrder: "http://schema.org/ItemListOrderAscending",
    itemListElement: items.slice(0, 50).map((biz, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: biz.name,
      url: `${args.origin}/business/${encodeURIComponent(biz.slug)}`,
    })),
  };

  let html = applyMeta(args.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
