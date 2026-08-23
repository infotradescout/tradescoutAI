import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeBySlug, PRIMARY_TRADE_SLUGS, slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "./publicationRules";
import {
  isPublicAndCrawlableBusiness,
  isPublicAndCrawlableBusinessDetail,
} from "@shared/publication";
import {
  buildPublicBusinessSignals,
  canServePublicBusinessDetail,
  derivePublicationTier,
  deriveTradeSlugFromProfileData,
  publicBusinessDetailExposureSqlPredicate,
} from "./publicationBusiness";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  buildPublicDirectoryProfile,
  hasPublicDirectoryOfferingFacts,
  sanitizePublicDirectoryDisplayName,
} from "./services/publicDirectoryBusinessPresentation";

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

  const rules = await getPublicationRules();
  const now = new Date();
  const recencyCutoff = new Date(
    now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
  );

  // Pull a recency-bounded slice of businesses in this county and derive trade presence in JS.
  const runCountyQuery = () =>
    db
      .select({
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        claimStatus: businesses.claimStatus,
        ownerUserId: businesses.ownerUserId,
        updatedAt: businesses.updatedAt,
        publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
        profileData: businesses.profileData,
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
      })
      .from(businesses)
      .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
      .innerJoin(counties, eq(counties.id, businessCounties.countyId))
      .leftJoin(users, eq(users.id, businesses.ownerUserId))
      .where(
        and(
          eq(businesses.status, "active" as any),
          publicBusinessDetailExposureSqlPredicate(),
          eq(businesses.publicDiscoveryEnabled, true as any),
          eq(counties.fips, String((county as any).fipsCode || "")),
          sql`${businesses.updatedAt} >= ${recencyCutoff}`
        )
      )
      .orderBy(desc(businesses.updatedAt), asc(businesses.slug))
      .limit(5000);

  let rows: any[] = [];
  try {
    rows = await runCountyQuery();
  } catch (error) {
    throw error;
  }

  const tradeCounts = new Map<string, number>();
  const tradeLastmod = new Map<string, Date>();
  const sampleBusinesses: Array<{ slug: string; name: string; updatedAt: Date }> = [];

  for (const r of rows) {
    const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
    if (!updatedAt) continue;
    const profileData = buildPublicDirectoryProfile((r as any).profileData || {});
    const tradeSlug = deriveTradeSlugFromProfileData(profileData);
    const businessSlug = String((r as any).slug || "").trim();
    const businessName = sanitizePublicDirectoryDisplayName((r as any).name);
    if (!businessSlug || !businessName) continue;

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

    const signals = buildPublicBusinessSignals({
      id: String((r as any).id),
      name: businessName,
      slug: businessSlug,
      updatedAt,
      publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
      stateCode,
      countyName: String((county as any).name || ""),
      city: profileData.city || null,
      tradeSlug,
      hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(profileData),
      tier,
    });
    const detailPublication = isPublicAndCrawlableBusinessDetail(signals, rules, now);
    if (!canServePublicBusinessDetail({ publication: detailPublication, tier })) continue;

    if (sampleBusinesses.length < 50) {
      sampleBusinesses.push({ slug: businessSlug, name: businessName, updatedAt });
    }

    if (!tradeSlug) continue;
    const tradePublication = isPublicAndCrawlableBusiness(signals, rules, now);
    if (!tradePublication.ok) continue;
    tradeCounts.set(tradeSlug, (tradeCounts.get(tradeSlug) || 0) + 1);
    const prev = tradeLastmod.get(tradeSlug);
    if (!prev || updatedAt > prev) tradeLastmod.set(tradeSlug, updatedAt);
  }

  const topTrades = Array.from(tradeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([slug, count]) => {
      const trade = getTradeBySlug(slug);
      return {
        slug,
        name: trade ? String((trade as any).name || slug) : slug,
        count,
        lastmod: tradeLastmod.get(slug) || null,
      };
    });

  // Ensure primary trades appear (if present) to support deterministic internal linking.
  const primaryPresent = PRIMARY_TRADE_SLUGS.filter((slug) => tradeCounts.has(slug)).slice(0, 24);
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
