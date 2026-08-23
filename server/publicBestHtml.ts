import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import { db } from "./db";
import { businessCounties, businesses, counties, users } from "@shared/schema";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { getTradeSeoMatch, normalizeTradeSlug, slugifyCountyName } from "@shared/tradeSeo";
import { getPublicationRules } from "./publicationRules";
import { isPublicAndCrawlableBusiness } from "@shared/publication";
import {
  buildPublicBusinessSignals,
  deriveTradeSlugFromProfileData,
  derivePublicationTier,
  publicBusinessDetailExposureSqlPredicate,
  publicBusinessTradeSqlPredicate,
} from "./publicationBusiness";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  isCanonicalPublicCitySlug,
  normalizePublicCitySlug,
  publicBusinessCitySlugSql,
  publicBusinessStateCodeSql,
} from "./seoDirectoryCitySlug";
import {
  buildPublicDirectoryProfile,
  hasPublicDirectoryOfferingFacts,
  sanitizePublicDirectoryDisplayName,
} from "./services/publicDirectoryBusinessPresentation";

type PublicBestTradeCountyHtmlOptions = {
  origin: string;
  templateHtml: string;
  tradeSlug: string;
  stateCode: string;
  countySlug: string;
};

type PublicBestTradeCityHtmlOptions = {
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
      : `<meta name="robots" content="noindex,nofollow" />`
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

export async function buildPublicBestTradeCountyHtml(
  opts: PublicBestTradeCountyHtmlOptions
): Promise<string | null> {
  const match = getTradeSeoMatch(opts.tradeSlug);
  if (!match) return null;

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
  const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);
  const tradeClause = publicBusinessTradeSqlPredicate(canonicalTradeSlug);

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
        ownerVerificationStatus: users.verificationStatus,
        ownerAddressVerified: users.addressVerified,
        countyName: counties.name,
        profileData: businesses.profileData,
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
          sql`${businesses.updatedAt} >= ${recencyCutoff}`,
          tradeClause || sql`false`
        )
      )
      .orderBy(desc(businesses.updatedAt), asc(businesses.name))
      .limit(200);

  let rows: any[] = [];
  try {
    rows = await runCountyQuery();
  } catch (error) {
    console.error(
      "[SEO] Best trade county query failed; preserving prior crawl truth via 5xx",
      error
    );
    throw error;
  }

  const items = rows
    .map((r) => {
      const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
      if (!updatedAt) return null;
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
      if (tier !== "verified") return null;
      const publicProfile = buildPublicDirectoryProfile((r as any).profileData || {});
      if (deriveTradeSlugFromProfileData(publicProfile) !== canonicalTradeSlug) return null;
      const publicName = sanitizePublicDirectoryDisplayName((r as any).name);
      const pub = isPublicAndCrawlableBusiness(
        buildPublicBusinessSignals({
          id: String((r as any).id),
          name: publicName,
          slug: String((r as any).slug || ""),
          updatedAt,
          publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
          stateCode,
          countyName: String((county as any).name || ""),
          city: null,
          tradeSlug: canonicalTradeSlug,
          hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
          tier,
        }),
        rules,
        now
      );
      if (!pub.ok) return null;
      return { slug: String((r as any).slug || ""), name: publicName };
    })
    .filter((r): r is { slug: string; name: string } => Boolean(r));

  const canonicalPath = `/best/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/${encodeURIComponent(countySlug)}`;
  const title = `Best ${match.trade.name} in ${String((county as any).name || "")}, ${stateCode} | TradeScout`;
  const description = `Verified & active ${match.trade.name} listings in ${String(
    (county as any).name || ""
  )}, ${stateCode} updated in the last ${rules.categoryPageRecencyWindowDays} days. Not ranked by payment. Contact remains protected through Direct Connect.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: [
      "best",
      match.trade.name,
      String((county as any).name || ""),
      stateCode,
      "verified",
      "directory",
      "TradeScout",
    ],
    indexable: false,
  });

  const summary = `
<main data-seo-best="trade-county" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Best ${escapeHtml(match.trade.name)} in ${escapeHtml(String((county as any).name || ""))}, ${escapeHtml(
      stateCode
    )}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/${encodeURIComponent(countySlug)}">View all directory listings</a></p>
    <h2>Verified listings</h2>
    ${
      items.length
        ? `<ul>${items
            .map(
              (biz) =>
                `<li><a href="/business/${encodeURIComponent(biz.slug)}">${escapeHtml(biz.name)}</a></li>`
            )
            .join("\n")}</ul>`
        : `<p><em>No verified listings found in this scope.</em></p>`
    }
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: meta.description,
    url: meta.canonical,
    itemListElement: items.slice(0, 50).map((biz, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: biz.name,
      url: `${opts.origin}/business/${encodeURIComponent(biz.slug)}`,
    })),
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}

export async function buildPublicBestTradeCityHtml(
  opts: PublicBestTradeCityHtmlOptions
): Promise<string | null> {
  const match = getTradeSeoMatch(opts.tradeSlug);
  if (!match) return null;

  const stateCode = String(opts.stateCode || "").toUpperCase();
  const citySlug = normalizePublicCitySlug(opts.citySlug);
  if (!/^[A-Z]{2}$/.test(stateCode)) return null;
  if (!isCanonicalPublicCitySlug(opts.citySlug)) return null;

  const rules = await getPublicationRules();
  const now = new Date();
  const recencyCutoff = new Date(
    now.getTime() - rules.categoryPageRecencyWindowDays * 24 * 60 * 60 * 1000
  );
  const canonicalTradeSlug = normalizeTradeSlug(match.canonicalSlug);

  const tradeClause = publicBusinessTradeSqlPredicate(canonicalTradeSlug);

  const rows = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      claimStatus: businesses.claimStatus,
      ownerUserId: businesses.ownerUserId,
      updatedAt: businesses.updatedAt,
      publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
      ownerVerificationStatus: users.verificationStatus,
      ownerAddressVerified: users.addressVerified,
      countyName: counties.name,
      profileData: businesses.profileData,
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
        eq(counties.stateCode, stateCode),
        sql`${publicBusinessStateCodeSql()} = ${stateCode}`,
        sql`${publicBusinessCitySlugSql()} = ${citySlug}`,
        sql`${businesses.updatedAt} >= ${recencyCutoff}`,
        tradeClause || sql`false`
      )
    )
    .orderBy(desc(businesses.updatedAt), asc(businesses.name))
    .limit(200);

  const items = rows
    .map((r) => {
      const updatedAt = (r as any).updatedAt instanceof Date ? (r as any).updatedAt : null;
      if (!updatedAt) return null;
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
      if (tier !== "verified") return null;
      const publicProfile = buildPublicDirectoryProfile((r as any).profileData || {});
      if (deriveTradeSlugFromProfileData(publicProfile) !== canonicalTradeSlug) return null;
      const publicName = sanitizePublicDirectoryDisplayName((r as any).name);
      const pub = isPublicAndCrawlableBusiness(
        buildPublicBusinessSignals({
          id: String((r as any).id),
          name: publicName,
          slug: String((r as any).slug || ""),
          updatedAt,
          publicDiscoveryEnabled: Boolean((r as any).publicDiscoveryEnabled),
          stateCode,
          countyName: String((r as any).countyName || ""),
          city: null,
          tradeSlug: canonicalTradeSlug,
          hasPublicOfferingFacts: hasPublicDirectoryOfferingFacts(publicProfile),
          tier,
        }),
        rules,
        now
      );
      if (!pub.ok) return null;
      return { slug: String((r as any).slug || ""), name: publicName };
    })
    .filter((r): r is { slug: string; name: string } => Boolean(r));

  const canonicalPath = `/best/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
    stateCode.toLowerCase()
  )}/city/${encodeURIComponent(citySlug)}`;
  const displayCity = citySlug.replace(/-+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const title = `Best ${match.trade.name} in ${displayCity}, ${stateCode} | TradeScout`;
  const description = `Verified & active ${match.trade.name} listings in ${displayCity}, ${stateCode} updated in the last ${rules.categoryPageRecencyWindowDays} days. Not ranked by payment. Contact remains protected through Direct Connect.`;

  const meta = buildMeta({
    origin: opts.origin,
    canonicalPath,
    title,
    description,
    keywords: [
      "best",
      match.trade.name,
      displayCity,
      stateCode,
      "verified",
      "directory",
      "TradeScout",
    ],
    indexable: false,
  });

  const summary = `
<main data-seo-best="trade-city" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>Best ${escapeHtml(match.trade.name)} in ${escapeHtml(displayCity)}, ${escapeHtml(stateCode)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="/trade/${encodeURIComponent(canonicalTradeSlug)}/${encodeURIComponent(
      stateCode.toLowerCase()
    )}/city/${encodeURIComponent(citySlug)}">View directory scope</a></p>
    <h2>Verified listings</h2>
    ${
      items.length
        ? `<ul>${items
            .map(
              (biz) =>
                `<li><a href="/business/${encodeURIComponent(biz.slug)}">${escapeHtml(biz.name)}</a></li>`
            )
            .join("\n")}</ul>`
        : `<p><em>No verified listings found in this scope.</em></p>`
    }
    <p>Contact is protected through TradeScout Direct Connect.</p>
  </article>
</main>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: meta.description,
    url: meta.canonical,
    itemListElement: items.slice(0, 50).map((biz, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: biz.name,
      url: `${opts.origin}/business/${encodeURIComponent(biz.slug)}`,
    })),
  };

  let html = applyMeta(opts.templateHtml, meta);
  html = injectSummary(html, summary);
  html = injectJsonLd(html, jsonLd);
  return html;
}
