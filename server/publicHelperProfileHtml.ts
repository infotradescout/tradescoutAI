import { and, eq } from "drizzle-orm";
import { formatTradeScoutTitle } from "@shared/brand";
import { workers } from "@shared/schema";
import {
  createProfilePortfolioItemShareMetadata,
  type ProfilePortfolioItemShareMetadata,
} from "@shared/profilePortfolioShare";
import { db } from "./db";

type PublicHelperProfileHtmlOptions = {
  workerId: string;
  origin: string;
  templateHtml: string;
  portfolioSlug?: unknown;
};

export type PublicHelperProfileRecord = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
  bio: string | null;
  skills: string[] | null;
  portfolioItems: unknown;
  isActive: boolean | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, regex: RegExp, tag: string): string {
  if (regex.test(html)) return html.replace(regex, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function resolvePublicImageUrl(value: unknown, origin: string): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  try {
    const resolved = new URL(candidate, origin);
    return resolved.protocol === "https:" || resolved.protocol === "http:"
      ? resolved.toString()
      : null;
  } catch {
    return null;
  }
}

function composeProfileDescription(worker: PublicHelperProfileRecord, fullName: string): string {
  const protection = "Contact stays protected through TradeScout Direct Connect.";
  const source =
    String(worker.bio || "").trim() ||
    `View ${fullName}'s skills, experience, availability, and portfolio.`;
  const availableLength = Math.max(0, 160 - protection.length - 1);
  const lead =
    source.length <= availableLength
      ? source
      : `${source.slice(0, Math.max(0, availableLength - 1)).trimEnd()}…`;
  return `${lead} ${protection}`;
}

function injectJsonLd(html: string, jsonLd: object): string {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function buildStructuredData(args: {
  worker: PublicHelperProfileRecord;
  fullName: string;
  canonical: string;
  description: string;
  profileImageUrl: string | null;
  itemShare: ProfilePortfolioItemShareMetadata | null;
}) {
  const person = {
    "@type": "Person",
    name: args.fullName,
    description: args.description,
    url: args.itemShare ? args.canonical.split("?")[0] : args.canonical,
    image: args.profileImageUrl || undefined,
    knowsAbout: Array.isArray(args.worker.skills) ? args.worker.skills.slice(0, 12) : undefined,
  };

  if (!args.itemShare) return { "@context": "https://schema.org", ...person };

  return {
    "@context": "https://schema.org",
    "@graph": [
      person,
      {
        "@type": "CreativeWork",
        "@id": `${args.itemShare.canonical}#portfolio-item`,
        name: args.itemShare.itemTitle,
        description: args.itemShare.description,
        image: [args.itemShare.imageUrl],
        url: args.itemShare.canonical,
        creator: { "@type": "Person", name: args.fullName },
      },
    ],
  };
}

export function renderPublicHelperProfileHtml(args: {
  worker: PublicHelperProfileRecord;
  origin: string;
  templateHtml: string;
  portfolioSlug?: unknown;
}): string {
  const fullName = `${args.worker.firstName} ${args.worker.lastName}`.trim();
  const profileCanonical = `${args.origin}/helpers/${encodeURIComponent(args.worker.id)}`;
  const itemShare = createProfilePortfolioItemShareMetadata({
    profileName: fullName,
    profileUrl: profileCanonical,
    assetOrigin: args.origin,
    portfolioItems: args.worker.portfolioItems,
    itemSlug: args.portfolioSlug,
  });
  const profileImageUrl = resolvePublicImageUrl(args.worker.profileImageUrl, args.origin);
  const description = itemShare?.description || composeProfileDescription(args.worker, fullName);
  const title = formatTradeScoutTitle(itemShare?.title || `${fullName} | TradeScout`);
  const canonical = itemShare?.canonical || profileCanonical;
  const imageUrl =
    itemShare?.imageUrl || profileImageUrl || `${args.origin}/tradescout-social-preview.png?v=12`;
  const imageAlt = itemShare?.imageAlt || `${fullName} profile preview`;
  const ogType = itemShare ? "article" : "profile";
  const usesDefaultImage = !itemShare && !profileImageUrl;
  const structuredData = buildStructuredData({
    worker: args.worker,
    fullName,
    canonical,
    description,
    profileImageUrl,
    itemShare,
  });

  let html = args.templateHtml;
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-image-preview:large" />'
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${ogType}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    `<meta property="og:image:type" content="${imageMimeType(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
  );
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
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    '<meta name="twitter:card" content="summary_large_image" />'
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  html = injectJsonLd(html, structuredData);
  if (itemShare) {
    html = html.replace(
      "</head>",
      `<meta name="tradescout:profile-item" content="portfolio" />\n</head>`
    );
  }
  return html;
}

export async function buildPublicHelperProfileHtml({
  workerId,
  origin,
  templateHtml,
  portfolioSlug,
}: PublicHelperProfileHtmlOptions): Promise<string | null> {
  const safeWorkerId = String(workerId || "").trim();
  if (!safeWorkerId || safeWorkerId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(safeWorkerId)) {
    return null;
  }

  const [worker] = await db
    .select({
      id: workers.id,
      firstName: workers.firstName,
      lastName: workers.lastName,
      profileImageUrl: workers.profileImageUrl,
      bio: workers.bio,
      skills: workers.skills,
      portfolioItems: workers.portfolioItems,
      isActive: workers.isActive,
    })
    .from(workers)
    .where(and(eq(workers.id, safeWorkerId), eq(workers.isActive, true)))
    .limit(1);

  if (!worker) return null;
  return renderPublicHelperProfileHtml({
    worker,
    origin,
    templateHtml,
    portfolioSlug,
  });
}
