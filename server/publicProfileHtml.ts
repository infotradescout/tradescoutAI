import { storage } from "./storage";

type PublicProfileHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
};

type PublicProfileData = {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    headline?: string | null;
    roleContext?: string | null;
    seoMeta?: { title?: string; description?: string; imageUrl?: string; customDomain?: string };
  };
  business?: {
    name?: string;
    categories?: string[];
    serviceAreas?: string[];
  } | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string) {
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `${tag}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function buildJsonLd(profile: PublicProfileData, origin: string) {
  const profileUrl = `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const description =
    profile.profile.seoMeta?.description ||
    profile.profile.headline ||
    profile.profile.roleContext ||
    "TradeScout public profile";

  if (profile.business?.name) {
    return {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: displayName,
      description,
      url: profileUrl,
      areaServed: profile.business.serviceAreas?.slice(0, 10) || undefined,
      category: profile.business.categories?.slice(0, 5) || undefined,
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    description,
    jobTitle: profile.profile.roleContext || undefined,
    url: profileUrl,
  };
}

function buildMeta(profile: PublicProfileData, origin: string) {
  const displayName = profile.business?.name?.trim() || profile.profile.displayName;
  const title = profile.profile.seoMeta?.title || `${displayName} · TradeScout`;
  const description =
    profile.profile.seoMeta?.description ||
    profile.profile.headline ||
    profile.profile.roleContext ||
    "TradeScout public profile";
  const imageUrl = profile.profile.seoMeta?.imageUrl || `${origin}/tradescout-logo.png?v=3`;
  const canonical = `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;

  return {
    title,
    description,
    imageUrl,
    canonical,
  };
}

export async function buildPublicProfileHtml({
  slug,
  origin,
  templateHtml,
}: PublicProfileHtmlOptions): Promise<string | null> {
  const profileRecord = await storage.getProfileBySlugPublic(slug);
  if (!profileRecord) return null;

  const businessRecord = profileRecord.businessId
    ? await storage.getBusinessPublicById(profileRecord.businessId)
    : null;

  const data: PublicProfileData = {
    profile: {
      id: profileRecord.id,
      slug: profileRecord.slug,
      displayName: profileRecord.displayName,
      headline: profileRecord.headline,
      roleContext: profileRecord.roleContext,
      seoMeta: profileRecord.seoMeta || undefined,
    },
    business: businessRecord
      ? {
          name: businessRecord.name,
          categories: businessRecord.categories || [],
          serviceAreas: businessRecord.serviceAreas || [],
        }
      : null,
  };

  const meta = buildMeta(data, origin);
  const jsonLd = buildJsonLd(data, origin);

  let html = templateHtml;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`
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

  html = injectJsonLd(html, jsonLd);
  return html;
}
