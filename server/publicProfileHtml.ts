import { storage } from "./storage";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  inventoryCategoriesForProfile,
  resolveProfileItemShareMetadata,
} from "./profileItemShareMetadata";
import {
  createProfileGalleryItemShareMetadata,
  listProfileGalleryItems,
} from "@shared/profileGalleryShare";
import type { ProfileInventoryItemShareMetadata } from "@shared/profileItemShare";
import { listProfileInventoryItems } from "@shared/profileItemShare";
import type { ProfileGalleryItemShareMetadata } from "@shared/profileGalleryShare";
import {
  buildProfilePublicCategoryUrl,
  buildProfilePublicItemUrl,
} from "@shared/profilePublicItemRoute";
import {
  createProfileInventoryCategoryShareMetadata,
  listProfileInventoryCategories,
  type ProfileInventoryCategoryShareMetadata,
} from "@shared/profileCategoryShare";
import { sanitizePublicProfileText as sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  buildProfileSocialDescription,
  buildProfileSocialPreviewImageUrl,
  buildProfileSocialTitle,
  resolveProfileSocialPresentation,
} from "@shared/profileSocialPreview";
import {
  JW_STONE_PROFILE_SLUG,
  JW_STONE_PROFILE_SOCIAL_LOGO_URL,
  JW_STONE_SOCIAL_PRESENTATION,
} from "@shared/jwStonePresentation";
import { withTradeScoutPublishingProvenance } from "@shared/profilePublishingProvenance";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";

// Google typically truncates meta description snippets around ~155-160
// characters -- cap so descriptions never get cut off mid-word.
const MAX_DESCRIPTION_LENGTH = 160;

function capDescriptionLength(description: string): string {
  if (description.length <= MAX_DESCRIPTION_LENGTH) return description;
  const truncated = description.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd();
  return `${truncated}…`;
}

export type PublicProfileHtmlPageMetadata = {
  documentTitle?: string;
  socialTitle?: string;
  description?: string;
  canonical?: string;
  ogType?: "profile" | "website" | "article" | "product";
  robots?: "noindex, follow" | "noindex, nofollow";
};

type PublicProfileHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
  itemSlug?: unknown;
  itemPhoto?: unknown;
  gallerySlug?: unknown;
  categorySlug?: unknown;
  pageMetadata?: PublicProfileHtmlPageMetadata;
};

type PublicProfileEarlyHtmlOptions = {
  slug: string;
  origin: string;
  templateHtml: string;
};

type PublicProfileLlmsTextOptions = {
  slug: string;
  origin: string;
};

type PublicProfileSitemapOptions = {
  slug: string;
  origin: string;
};

type PublicProfileItemShareMetadata =
  | ProfileInventoryItemShareMetadata
  | ProfileGalleryItemShareMetadata;

type PublicProfileData = {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    headline?: string | null;
    roleContext?: string | null;
    servicesDescription?: string | null;
    seoMeta?: {
      title?: string;
      description?: string;
      imageUrl?: string;
      imageWidth?: number;
      imageHeight?: number;
      // Separate from imageUrl (the OG/share banner) -- browser tab icons
      // need a square mark, not a wide 1200x630 crop. Falls back to imageUrl
      // when unset so existing profiles keep working.
      faviconUrl?: string;
      customDomain?: string;
    };
    ctaConfig?: {
      primary?: {
        label?: string;
      };
    };
    profileBooking?: {
      enabled?: boolean;
      paidBookings?: boolean;
      bookingPriceUsd?: number;
      pricingTableEnabled?: boolean;
      pricingRows?: Array<{ name?: string; priceLabel?: string }>;
    } | null;
    contentBlocks?: Array<{ type: string; data?: Record<string, any> }> | null;
  };
  business?: {
    name?: string;
    categories?: string[];
    serviceAreas?: string[];
    tradePartner?: boolean;
    website?: string;
    address?: string;
    city?: string;
    stateCode?: string;
    zipCode?: string;
    brandColors?: {
      primary?: string;
      accent?: string;
    };
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

function cleanPublicProfileText(value: unknown, maxLength = 300): string {
  return sanitizePublicDiscoveryText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanLlmsText(value: unknown, maxLength = 300): string {
  return cleanPublicProfileText(value, maxLength);
}

function cleanLlmsLabel(value: unknown, maxLength = 120): string {
  return cleanPublicProfileText(value, maxLength);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizePublicOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function normalizePageMetadataCanonical(value: unknown, origin: string): string {
  if (!value) return "";
  try {
    const parsed = new URL(String(value), origin);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function listPublishedProfileServiceItems(contentBlocks: unknown): string[] {
  if (!Array.isArray(contentBlocks)) return [];
  const services = contentBlocks.find(
    (block) =>
      block &&
      typeof block === "object" &&
      String((block as any).type || "").toLowerCase() === "services"
  ) as any;
  const items = Array.isArray(services?.data?.items) ? services.data.items : [];
  return items
    .map((item: unknown) => {
      if (typeof item === "string") return cleanLlmsText(item, 180);
      if (!item || typeof item !== "object") return "";
      const source = item as Record<string, unknown>;
      const title = cleanLlmsText(source.title || source.name || source.label, 100);
      const detail = cleanLlmsText(source.body || source.description || source.text, 180);
      return [title, detail].filter(Boolean).join(": ");
    })
    .filter((item: string) => item.length > 0)
    .slice(0, 12);
}

/**
 * Host-local, public-only guidance for LLM readers of a configured profile
 * domain. It intentionally excludes contact details, addresses, account data,
 * API paths, and unpublished workflow state.
 */
export async function buildPublicProfileLlmsText({
  slug,
  origin,
}: PublicProfileLlmsTextOptions): Promise<string | null> {
  if (!shouldIndexPublicProfileSlug(slug)) return null;
  const profileRecord = await storage.getProfileBySlugPublic(slug);
  if (!profileRecord) return null;

  const publicOrigin = normalizePublicOrigin(origin);
  if (!publicOrigin) return null;

  const businessRecord = profileRecord.businessId
    ? await storage.getBusinessPublicById(profileRecord.businessId)
    : null;
  const displayName = cleanLlmsLabel(
    businessRecord?.name || profileRecord.displayName || "Public profile",
    120
  );
  const summary = cleanLlmsText(
    profileRecord.seoMeta?.description ||
      profileRecord.headline ||
      profileRecord.servicesDescription ||
      profileRecord.roleContext,
    500
  );
  const servicesDescription = cleanLlmsText(profileRecord.servicesDescription, 500);
  const categories = (businessRecord?.categories || [])
    .map((value) => cleanLlmsLabel(value, 80))
    .filter(Boolean)
    .slice(0, 12);
  const serviceAreas = (businessRecord?.serviceAreas || [])
    .map((value) => cleanLlmsLabel(value, 100))
    .filter(Boolean)
    .slice(0, 12);
  const publicServiceItems = listPublishedProfileServiceItems(profileRecord.contentBlocks);

  const lines = [
    `# ${displayName}`,
    "",
    `Canonical: ${publicOrigin}/`,
    `Robots: ${publicOrigin}/robots.txt`,
    `Sitemap: ${publicOrigin}/sitemap.xml`,
    "",
    "## Public profile",
    summary || "This is a published TradeScout public profile.",
  ];

  if (servicesDescription && servicesDescription !== summary) {
    lines.push("", "## Services", servicesDescription);
  }
  if (categories.length > 0) {
    lines.push("", "## Categories", ...categories.map((value) => `- ${value}`));
  }
  if (publicServiceItems.length > 0) {
    lines.push(
      "",
      "## Published service items",
      ...publicServiceItems.map((value) => `- ${value}`)
    );
  }
  if (serviceAreas.length > 0) {
    lines.push("", "## Service areas", ...serviceAreas.map((value) => `- ${value}`));
  }

  return `${lines.join("\n")}\n`;
}

/** Builds the verified host's sitemap from the same published profile source. */
export async function buildPublicProfileSitemapXml({
  slug,
  origin,
}: PublicProfileSitemapOptions): Promise<string | null> {
  const publicOrigin = normalizePublicOrigin(origin);
  if (!publicOrigin) return null;
  if (!shouldIndexPublicProfileSlug(slug)) return null;
  const profileRecord = await storage.getProfileBySlugPublic(slug);
  if (!profileRecord) return null;

  const inventory = listProfileInventoryItems(
    inventoryCategoriesForProfile(profileRecord.slug, profileRecord.contentBlocks)
  );
  const categories = listProfileInventoryCategories(
    inventoryCategoriesForProfile(profileRecord.slug, profileRecord.contentBlocks),
    profileRecord.contentBlocks
  ).filter((category) => category.indexable);
  const gallery = listProfileGalleryItems(profileRecord.contentBlocks);
  const urls = [
    `${publicOrigin}/`,
    ...categories.map((category) =>
      buildProfilePublicCategoryUrl({
        profileUrl: `${publicOrigin}/`,
        categorySlug: category.slug,
        contentBlocks: profileRecord.contentBlocks,
      })
    ),
    ...inventory.map((item) =>
      buildProfilePublicItemUrl({
        profileUrl: `${publicOrigin}/`,
        itemType: "inventory",
        itemSlug: item.slug,
        contentBlocks: profileRecord.contentBlocks,
      })
    ),
    ...gallery.map((item) =>
      buildProfilePublicItemUrl({
        profileUrl: `${publicOrigin}/`,
        itemType: "gallery",
        itemSlug: item.slug,
        contentBlocks: profileRecord.contentBlocks,
      })
    ),
  ]
    .filter((url): url is string => Boolean(url))
    .slice(0, 50_000);

  const updatedAt = new Date(profileRecord.updatedAt || "");
  const lastmod = Number.isNaN(updatedAt.getTime())
    ? ""
    : `\n    <lastmod>${updatedAt.toISOString().slice(0, 10)}</lastmod>`;
  const entries = urls
    .map((url) => `  <url>\n    <loc>${escapeXml(url)}</loc>${lastmod}\n  </url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function upsertTag(html: string, regex: RegExp, tag: string) {
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace("</head>", `${tag}\n</head>`);
}

function imageMimeType(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

// Business/profile pages should show their own icon in the browser tab
// instead of the generic TradeScout icon -- only when they actually have a
// custom share image set, so we never blank out the real TradeScout icon.
function injectFaviconOverride(html: string, imageUrl: string): string {
  const withoutIcons = html
    .replace(/<link rel="icon"[^>]*>\s*/gi, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/gi, "");
  const tag = `<link rel="icon" href="${escapeHtml(imageUrl)}" />\n    <link rel="apple-touch-icon" href="${escapeHtml(imageUrl)}" />`;
  return withoutIcons.replace("</head>", `${tag}\n</head>`);
}

// The client-side router only recognizes profile pages by URL path
// (/u/:slug), so when this profile is served at its own custom domain's
// root -- no /u/:slug in the path at all -- React has no way to know which
// profile to render post-hydration and falls through to the generic
// landing page. This tells it directly.
function injectCustomDomainProfileSlug(html: string, slug: string): string {
  const script = `<script>window.__TS_CUSTOM_DOMAIN_PROFILE_SLUG__=${JSON.stringify(slug)};</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectJsonLd(html: string, jsonLd: object) {
  const json = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const script = `<script type="application/ld+json">${json}</script>`;
  return html.replace("</head>", `${script}\n</head>`);
}

function injectProfileSummary(html: string, summaryHtml: string) {
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summaryHtml}</div>`);
}

export function buildPublicProfileEarlyHtml({
  slug,
  origin,
  templateHtml,
}: PublicProfileEarlyHtmlOptions): string {
  const title = formatTradeScoutTitle("Public profile unavailable");
  const description = "This public TradeScout profile is not available.";
  const canonical = `${origin}/u/${encodeURIComponent(slug)}`;
  const tradeScoutHome = `${origin}/`;
  const scoutUrl = `${origin}/scout`;
  const communityUrl = `${origin}/community-feed`;
  const logoUrl = `${origin}/tradescout-logo.png`;
  const reportPayload = JSON.stringify({
    title: "Unavailable public profile link reported",
    description: `A visitor reported the unavailable public-profile fallback at /u/${slug}.`,
    errorType: "ui_issue",
    browserInfo: { profileSlug: slug, arrivalMode: "unavailable" },
  }).replace(/</g, "\\u003c");
  let html = templateHtml.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    `<meta name="robots" content="noindex,follow" />`
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
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );

  const earlySummary = `
<style>
  .ts-early{min-height:100vh;box-sizing:border-box;overflow:hidden;position:relative;padding:24px 22px;background:radial-gradient(circle at 16% 16%,rgba(249,115,22,.2),transparent 34%),radial-gradient(circle at 84% 26%,rgba(14,165,233,.17),transparent 36%),linear-gradient(145deg,#071016 0%,#0b1921 58%,#071016 100%);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}.ts-early *{box-sizing:border-box}.ts-early-shell{position:relative;z-index:1;max-width:1180px;min-height:calc(100vh - 48px);margin:0 auto;display:flex;flex-direction:column}.ts-early-top{display:flex;align-items:center;justify-content:space-between;padding:4px 0 18px}.ts-early-logo{display:block;height:38px;width:auto}.ts-early-close{display:grid;place-items:center;width:44px;height:44px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.75);text-decoration:none;font-size:25px;line-height:1}.ts-early-card{margin:auto 0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:32px;background:rgba(12,23,30,.96);box-shadow:0 36px 110px rgba(0,0,0,.45)}.ts-early-copy{display:flex;flex-direction:column;justify-content:center;padding:56px}.ts-early-badge{display:inline-flex;align-items:center;gap:8px;width:max-content;margin:0 0 28px;padding:8px 12px;border:1px solid rgba(249,115,22,.32);border-radius:999px;background:rgba(249,115,22,.1);color:#fdba74;font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}.ts-early-name{margin:0 0 12px;color:rgba(125,211,252,.82);font-size:14px;font-weight:750;letter-spacing:.16em;text-transform:uppercase}.ts-early h1{max-width:760px;margin:0;font-size:clamp(42px,6vw,76px);line-height:1.01;letter-spacing:-.045em}.ts-early-lede{max-width:690px;margin:24px 0 0;color:rgba(255,255,255,.68);font-size:18px;line-height:1.7}.ts-early-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}.ts-early-button{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border:0;border-radius:999px;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:15px;font-weight:800;text-decoration:none}.ts-early-button.primary{background:#f97316;color:#fff;box-shadow:0 12px 34px rgba(124,45,18,.3)}.ts-early-button.secondary{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);color:#fff}.ts-early-button.quiet{padding:0 12px;color:rgba(255,255,255,.62)}.ts-early-button:disabled{cursor:default;color:#86efac}.ts-early-visual{position:relative;display:flex;align-items:center;justify-content:center;min-height:570px;padding:42px;border-left:1px solid rgba(255,255,255,.1);background:radial-gradient(circle at center,rgba(14,165,233,.19),transparent 58%),#0a222d}.ts-early-status{position:relative;width:100%;max-width:370px;padding:30px;border:1px solid rgba(255,255,255,.12);border-radius:28px;background:rgba(7,20,27,.92);box-shadow:0 24px 70px rgba(0,0,0,.4)}.ts-early-status-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:26px}.ts-early-kicker{margin:0;color:rgba(255,255,255,.42);font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase}.ts-early-path{max-width:240px;margin:7px 0 0;overflow:hidden;color:rgba(255,255,255,.92);font-weight:700;text-overflow:ellipsis;white-space:nowrap}.ts-early-spark{display:grid;place-items:center;width:44px;height:44px;border-radius:16px;background:#f97316;color:#fff;font-size:20px;box-shadow:0 12px 28px rgba(124,45,18,.42)}.ts-early-step{display:flex;align-items:center;gap:12px;margin-top:11px;padding:15px 16px;border:1px solid rgba(255,255,255,.08);border-radius:17px;background:rgba(255,255,255,.035);color:rgba(255,255,255,.76);font-size:14px;font-weight:700}.ts-early-step.next{border-color:rgba(249,115,22,.26);background:rgba(249,115,22,.08)}.ts-early-dot{width:10px;height:10px;border-radius:50%;background:#34d399}.ts-early-step.next .ts-early-dot{background:#f97316;box-shadow:0 0 18px rgba(249,115,22,.8)}.ts-early-note{margin:24px 0 0;color:rgba(255,255,255,.5);font-size:14px;line-height:1.65}.ts-early-footer{padding:18px 0 2px;text-align:center;color:rgba(255,255,255,.35);font-size:11px;font-weight:750;letter-spacing:.18em;text-transform:uppercase}@media(max-width:840px){.ts-early{padding:16px}.ts-early-shell{min-height:calc(100vh - 32px)}.ts-early-card{grid-template-columns:1fr}.ts-early-copy{padding:38px 28px}.ts-early-visual{min-height:340px;padding:28px;border-top:1px solid rgba(255,255,255,.1);border-left:0}.ts-early h1{font-size:clamp(40px,12vw,60px)}}@media(max-width:520px){.ts-early-actions{flex-direction:column}.ts-early-button{width:100%}.ts-early-copy{padding:32px 22px}.ts-early-visual{padding:22px}.ts-early-status{padding:24px}}
</style>
<main data-public-profile-state="unavailable" class="ts-early">
  <div class="ts-early-shell">
    <header class="ts-early-top">
      <a href="${escapeHtml(tradeScoutHome)}" aria-label="Return to TradeScout"><img class="ts-early-logo" src="${escapeHtml(logoUrl)}" alt="TradeScout" /></a>
      <a class="ts-early-close" href="${escapeHtml(tradeScoutHome)}" aria-label="Close this profile and return to TradeScout">&times;</a>
    </header>
    <section class="ts-early-card">
      <div class="ts-early-copy">
        <p class="ts-early-badge"><span aria-hidden="true">&#10022;</span> Profile unavailable</p>
        <p class="ts-early-name">TradeScout public profile</p>
        <h1>This public profile is not available.</h1>
        <div class="ts-early-actions">
          <a class="ts-early-button primary" href="${escapeHtml(communityUrl)}">Browse the Community &rarr;</a>
          <a class="ts-early-button secondary" href="${escapeHtml(scoutUrl)}">Open Scout</a>
          <a class="ts-early-button quiet" href="${escapeHtml(canonical)}">&#8635;&nbsp; Check again</a>
          <button class="ts-early-button quiet" id="ts-report-link" type="button">&#9873;&nbsp; Report this link</button>
        </div>
      </div>
      <div class="ts-early-visual">
        <div class="ts-early-status">
          <div class="ts-early-status-head">
            <div><p class="ts-early-kicker">This address</p><p class="ts-early-path">/u/${escapeHtml(slug)}</p></div>
            <span class="ts-early-spark" aria-hidden="true">&#10022;</span>
          </div>
          <div class="ts-early-step"><span class="ts-early-dot"></span>No public profile at this address</div>
          <div class="ts-early-step next"><span class="ts-early-dot"></span>Browse available public spaces</div>
        </div>
      </div>
    </section>
  </div>
</main>
<script>
  (() => {
    const button = document.getElementById("ts-report-link");
    if (!button) return;
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.textContent = "Reporting…";
      try {
        const response = await fetch("/api/error-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...${reportPayload},
            currentUrl: window.location.href,
            userAgent: navigator.userAgent
          })
        });
        if (!response.ok) throw new Error("Report failed");
        button.textContent = "Reported — thank you";
      } catch {
        button.disabled = false;
        button.textContent = "Try reporting again";
      }
    });
  })();
</script>`;

  return injectProfileSummary(html, earlySummary);
}

function buildFaqJsonLd(profile: PublicProfileData) {
  const faqBlock = (profile.profile.contentBlocks || []).find((block) => block?.type === "faq");
  const faqs: Array<{ question?: string; answer?: string }> = Array.isArray(faqBlock?.data?.faqs)
    ? faqBlock!.data!.faqs
    : [];
  const validFaqs = faqs
    .map((faq) => ({
      question: cleanPublicProfileText(faq?.question, 300),
      answer: cleanPublicProfileText(faq?.answer, 1200),
    }))
    .filter((faq) => faq.question.length > 0 && faq.answer.length > 0)
    .slice(0, 20);
  if (validFaqs.length === 0) return null;

  return {
    "@type": "FAQPage",
    mainEntity: validFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

// A profile with an active custom-domain mapping is canonically served there, not
// under /u/:slug -- Google and structured-data consumers should be pointed
// at the business's own domain regardless of which host the request came in on.
function resolveProfileUrl(profile: PublicProfileData, origin: string): string {
  const customDomain = profile.profile.seoMeta?.customDomain?.trim().toLowerCase();
  if (customDomain) return `https://${customDomain}/`;
  return `${origin}/u/${encodeURIComponent(profile.profile.slug)}`;
}

function withProfileItemJsonLd(
  baseJsonLd: Record<string, any>,
  itemShare: PublicProfileItemShareMetadata | null,
  profileUrl: string,
  isBusinessProfile: boolean
) {
  if (!itemShare) return baseJsonLd;
  if (itemShare.itemType === "inventory" && !itemShare.hasPublicName) return baseJsonLd;

  const baseGraph = Array.isArray(baseJsonLd["@graph"])
    ? baseJsonLd["@graph"]
    : [Object.fromEntries(Object.entries(baseJsonLd).filter(([key]) => key !== "@context"))];

  const itemJsonLd =
    itemShare.itemType === "inventory"
      ? {
          "@type": "Product",
          "@id": `${itemShare.canonical}#product`,
          name: cleanPublicProfileText(itemShare.itemName, 200),
          description: cleanPublicProfileText(itemShare.description, 500),
          image: [itemShare.imageUrl],
          category: cleanPublicProfileText(itemShare.category, 120) || undefined,
          url: itemShare.canonical,
          ...(isBusinessProfile
            ? {
                brand: {
                  "@id": `${profileUrl}#identity`,
                },
              }
            : {}),
        }
      : {
          "@type": "ImageObject",
          "@id": `${itemShare.canonical}#image`,
          name: cleanPublicProfileText(itemShare.itemTitle, 200),
          description: cleanPublicProfileText(itemShare.description, 500),
          contentUrl: itemShare.imageUrl,
          url: itemShare.canonical,
          creator: {
            "@id": `${profileUrl}#identity`,
          },
        };

  return {
    "@context": "https://schema.org",
    "@graph": [...baseGraph, itemJsonLd],
  };
}

function withProfileCategoryJsonLd(
  baseJsonLd: Record<string, any>,
  categoryShare: ProfileInventoryCategoryShareMetadata | null,
  profileUrl: string,
  contentBlocks: unknown
) {
  if (!categoryShare) return baseJsonLd;
  const baseGraph = Array.isArray(baseJsonLd["@graph"])
    ? baseJsonLd["@graph"]
    : [Object.fromEntries(Object.entries(baseJsonLd).filter(([key]) => key !== "@context"))];
  const itemList = categoryShare.itemSlugs
    .map((itemSlug, index) => {
      const url = buildProfilePublicItemUrl({
        profileUrl,
        itemType: "inventory",
        itemSlug,
        contentBlocks,
      });
      return url
        ? {
            "@type": "ListItem",
            position: index + 1,
            url,
          }
        : null;
    })
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@graph": [
      ...baseGraph,
      {
        "@type": "CollectionPage",
        "@id": `${categoryShare.canonical}#collection`,
        name: cleanPublicProfileText(categoryShare.title, 240),
        description: cleanPublicProfileText(categoryShare.description, 500),
        url: categoryShare.canonical,
        isPartOf: {
          "@id": `${profileUrl}#identity`,
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: itemList.length,
          itemListElement: itemList,
        },
      },
    ],
  };
}

function withProfilePublishingProvenance(
  structuredData: Record<string, any>,
  profileUrl: string,
  itemShare: PublicProfileItemShareMetadata | null,
  categoryShare: ProfileInventoryCategoryShareMetadata | null,
  pageCanonical = ""
) {
  const pageUrl = itemShare?.canonical || categoryShare?.canonical || pageCanonical || profileUrl;
  const mainEntityId =
    itemShare?.itemType === "inventory" && itemShare.hasPublicName
      ? `${itemShare.canonical}#product`
      : itemShare?.itemType === "gallery"
        ? `${itemShare.canonical}#image`
        : categoryShare
          ? `${categoryShare.canonical}#collection`
          : `${profileUrl}#identity`;

  return withTradeScoutPublishingProvenance({
    structuredData,
    pageUrl,
    mainEntityId,
    ownerIdentityId: `${profileUrl}#identity`,
    pageType: itemShare || categoryShare || pageCanonical ? "WebPage" : "ProfilePage",
  });
}

function buildJsonLd(
  profile: PublicProfileData,
  origin: string,
  itemShare: PublicProfileItemShareMetadata | null,
  categoryShare: ProfileInventoryCategoryShareMetadata | null,
  pageMetadata?: PublicProfileHtmlPageMetadata
) {
  const profileUrl = resolveProfileUrl(profile, origin);
  const pageCanonical = normalizePageMetadataCanonical(pageMetadata?.canonical, origin);
  const displayName =
    cleanPublicProfileText(profile.business?.name?.trim() || profile.profile.displayName, 200) ||
    "TradeScout public profile";
  const description = cleanPublicProfileText(
    profile.profile.seoMeta?.description ||
      profile.profile.headline ||
      profile.profile.servicesDescription ||
      profile.profile.roleContext ||
      "TradeScout public profile",
    1000
  );
  const publicCategories = (profile.business?.categories || [])
    .map((value) => cleanPublicProfileText(value, 120))
    .filter(Boolean)
    .slice(0, 5);
  const configuredServiceAreas =
    profile.profile.slug === "jw-stone" && profile.business?.city
      ? [[profile.business.city, profile.business.stateCode].filter(Boolean).join(", ")]
      : profile.business?.serviceAreas || [];
  const publicServiceAreas = configuredServiceAreas
    .map((value) => cleanPublicProfileText(value, 160))
    .filter(Boolean)
    .slice(0, 10);

  const faqJsonLd = buildFaqJsonLd(profile);

  if (profile.business?.name) {
    const isTradePartner = profile.business.tradePartner === true;
    const localBusiness: Record<string, any> = {
      "@type": "LocalBusiness",
      "@id": `${profileUrl}#identity`,
      name: displayName,
      description,
      url: profileUrl,
      areaServed: publicServiceAreas.length > 0 ? publicServiceAreas : undefined,
      category: publicCategories.length > 0 ? publicCategories : undefined,
    };

    // Website and location may remain crawlable, but phone is deliberately
    // excluded. Express Direct Connect reveals it only after an explicit CTA
    // click and Call decision, preventing passive scraping from page source.
    if (isTradePartner) {
      if (profile.business.website) {
        localBusiness.sameAs = [profile.business.website];
      }
      if (profile.business.address || profile.business.city || profile.business.stateCode) {
        localBusiness.address = {
          "@type": "PostalAddress",
          streetAddress: profile.business.address || undefined,
          addressLocality: profile.business.city || undefined,
          addressRegion: profile.business.stateCode || undefined,
          postalCode: profile.business.zipCode || undefined,
          addressCountry: "US",
        };
      }
    }

    const baseJsonLd = !faqJsonLd
      ? { "@context": "https://schema.org", ...localBusiness }
      : {
          "@context": "https://schema.org",
          "@graph": [localBusiness, faqJsonLd],
        };
    return withProfilePublishingProvenance(
      withProfileCategoryJsonLd(
        withProfileItemJsonLd(baseJsonLd, itemShare, profileUrl, true),
        categoryShare,
        profileUrl,
        profile.profile.contentBlocks
      ),
      profileUrl,
      itemShare,
      categoryShare,
      pageCanonical
    );
  }

  return withProfilePublishingProvenance(
    withProfileCategoryJsonLd(
      withProfileItemJsonLd(
        {
          "@context": "https://schema.org",
          "@type": "Person",
          "@id": `${profileUrl}#identity`,
          name: displayName,
          description,
          jobTitle: cleanPublicProfileText(profile.profile.roleContext, 160) || undefined,
          url: profileUrl,
        },
        itemShare,
        profileUrl,
        false
      ),
      categoryShare,
      profileUrl,
      profile.profile.contentBlocks
    ),
    profileUrl,
    itemShare,
    categoryShare,
    pageCanonical
  );
}

function buildMeta(
  profile: PublicProfileData,
  origin: string,
  itemShare: PublicProfileItemShareMetadata | null,
  categoryShare: ProfileInventoryCategoryShareMetadata | null,
  pageMetadata?: PublicProfileHtmlPageMetadata
) {
  const displayName =
    cleanPublicProfileText(profile.business?.name?.trim() || profile.profile.displayName, 200) ||
    "TradeScout public profile";
  const titleSource = cleanPublicProfileText(
    itemShare?.title ||
      categoryShare?.title ||
      profile.profile.seoMeta?.title ||
      `${displayName} | TradeScout`,
    240
  );
  const requestedDocumentTitle = cleanPublicProfileText(pageMetadata?.documentTitle, 240);
  const documentTitle = formatTradeScoutTitle(
    requestedDocumentTitle || titleSource || "TradeScout public profile"
  );
  const itemName =
    itemShare?.itemType === "inventory"
      ? cleanPublicProfileText(itemShare.itemName, 200)
      : itemShare?.itemType === "gallery"
        ? cleanPublicProfileText(itemShare.itemTitle, 200)
        : "";
  const presentation = resolveProfileSocialPresentation({
    brandName: displayName,
    fallbackBrandName: profile.profile.displayName,
    logoUrl: profile.profile.seoMeta?.faviconUrl,
    profileImageUrl: profile.profile.seoMeta?.imageUrl,
    accentColor: profile.business?.brandColors?.accent || profile.business?.brandColors?.primary,
    configuredCtaLabel: profile.profile.ctaConfig?.primary?.label,
    itemType: itemShare?.itemType || (categoryShare ? "category" : null),
    contentBlocks: profile.profile.contentBlocks,
    defaultConfig:
      !itemShare && !categoryShare && profile.profile.slug === JW_STONE_PROFILE_SLUG
        ? JW_STONE_SOCIAL_PRESENTATION
        : undefined,
  });
  const publicBrandName = presentation.brandName;
  const socialTitle =
    cleanPublicProfileText(pageMetadata?.socialTitle, 240) ||
    buildProfileSocialTitle({
      brandName: publicBrandName,
      itemType: itemShare?.itemType || (categoryShare ? "category" : null),
      itemName: itemName || categoryShare?.categoryName,
      category: itemShare?.itemType === "inventory" ? itemShare.category : null,
    });
  const fallbackDescription = cleanPublicProfileText(
    itemShare?.description ||
      categoryShare?.description ||
      pageMetadata?.description ||
      profile.profile.seoMeta?.description ||
      profile.profile.headline ||
      profile.profile.servicesDescription ||
      profile.profile.roleContext ||
      "TradeScout public profile",
    1000
  );
  const description = capDescriptionLength(
    cleanPublicProfileText(
      (itemShare?.itemType === "inventory" &&
        (itemShare.hasPublicSummary === true || itemShare.publicKind === "offering")) ||
        categoryShare?.collectionKind === "offerings"
        ? fallbackDescription
        : itemShare || categoryShare
          ? buildProfileSocialDescription({
              brandName: publicBrandName,
              itemType: itemShare?.itemType || "category",
              itemName: itemName || categoryShare?.categoryName,
              category: itemShare?.itemType === "inventory" ? itemShare.category : null,
              fallbackDescription,
            })
          : fallbackDescription,
      1000
    )
  );
  const legacyProfileImageUrl = profile.profile.seoMeta?.imageUrl || null;
  const sourceImageUrl =
    itemShare || categoryShare
      ? itemShare?.imageUrl || categoryShare?.imageUrl || ""
      : presentation.profileImageUrl ||
        legacyProfileImageUrl ||
        `${origin}/tradescout-social-preview.png?v=12`;
  const itemPhoto = itemShare
    ? (() => {
        try {
          return new URL(itemShare.canonical).searchParams.get("photo");
        } catch {
          return null;
        }
      })()
    : null;
  const imageUrl =
    buildProfileSocialPreviewImageUrl({
      pageOrigin: origin,
      profileSlug: profile.profile.slug,
      itemType: itemShare?.itemType || (categoryShare ? "category" : null),
      itemSlug: itemShare?.itemSlug || categoryShare?.categorySlug,
      photo: itemPhoto,
      versionSeed: [
        publicBrandName,
        socialTitle,
        description,
        sourceImageUrl,
        presentation.logoUrl || "",
        itemShare ? "" : presentation.profileImageUrl || "",
        presentation.accentColor,
        presentation.ctaLabel,
        !itemShare &&
        !categoryShare &&
        profile.profile.slug === JW_STONE_PROFILE_SLUG &&
        presentation.cardLayout === "brand-hero"
          ? `${presentation.cardLayout}|${JW_STONE_PROFILE_SOCIAL_LOGO_URL}`
          : "",
      ].join("|"),
    }) || sourceImageUrl;
  const faviconUrl = profile.profile.seoMeta?.faviconUrl || legacyProfileImageUrl;
  const requestedCanonical = normalizePageMetadataCanonical(pageMetadata?.canonical, origin);
  const canonical =
    requestedCanonical ||
    itemShare?.canonical ||
    categoryShare?.canonical ||
    resolveProfileUrl(profile, origin);
  const keywords = [
    itemName,
    itemShare?.itemType === "inventory" ? itemShare.category || "" : "",
    categoryShare?.categoryName || "",
    displayName,
    profile.profile.roleContext || "",
    ...(profile.business?.categories || []),
    "TradeScout profile",
    "local services",
  ]
    .map((value) => cleanPublicProfileText(value, 160))
    .filter((value) => value.length > 0)
    .slice(0, 12)
    .join(", ");

  return {
    documentTitle,
    socialTitle,
    description,
    imageUrl,
    imageType: imageMimeType(imageUrl),
    imageAlt:
      cleanPublicProfileText(`${socialTitle} preview`, 240) || "TradeScout public profile preview",
    imageWidth: 1200,
    imageHeight: 630,
    sourceImageUrl,
    faviconUrl,
    canonical,
    keywords,
    ogType:
      pageMetadata?.ogType ||
      (itemShare?.itemType === "inventory" && itemShare.hasPublicName
        ? "product"
        : itemShare?.itemType === "gallery"
          ? "article"
          : itemShare?.itemType === "inventory" || categoryShare
            ? "website"
            : "profile"),
  };
}

export async function buildPublicProfileHtml({
  slug,
  origin,
  templateHtml,
  itemSlug,
  itemPhoto,
  gallerySlug,
  categorySlug,
  pageMetadata,
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
      servicesDescription: profileRecord.servicesDescription || undefined,
      seoMeta: profileRecord.seoMeta || undefined,
      ctaConfig: profileRecord.ctaConfig || undefined,
      profileBooking: profileRecord.profileBooking || undefined,
      contentBlocks: Array.isArray(profileRecord.contentBlocks)
        ? profileRecord.contentBlocks
        : undefined,
    },
    business: businessRecord
      ? {
          name: businessRecord.name,
          categories: businessRecord.categories || [],
          serviceAreas: businessRecord.serviceAreas || [],
          tradePartner: businessRecord.tradePartner === true,
          website: businessRecord.website,
          address: businessRecord.address,
          city: businessRecord.city,
          stateCode: businessRecord.stateCode,
          zipCode: businessRecord.zipCode,
          brandColors: businessRecord.brandColors,
        }
      : null,
  };

  const displayName =
    cleanPublicProfileText(data.business?.name?.trim() || data.profile.displayName, 200) ||
    "TradeScout public profile";
  const profileUrl = resolveProfileUrl(data, origin);
  const profileInventoryCategories = inventoryCategoriesForProfile(
    data.profile.slug,
    data.profile.contentBlocks
  );
  const inventoryItemShare = resolveProfileItemShareMetadata({
    profileSlug: data.profile.slug,
    profileName: displayName,
    profileUrl,
    assetOrigin: origin,
    contentBlocks: data.profile.contentBlocks,
    itemSlug,
    photo: itemPhoto,
  });
  const galleryItemShare = createProfileGalleryItemShareMetadata({
    profileName: displayName,
    profileUrl,
    assetOrigin: origin,
    contentBlocks: data.profile.contentBlocks,
    itemSlug: gallerySlug,
  });
  const categoryShare = createProfileInventoryCategoryShareMetadata({
    profileName: displayName,
    profileUrl,
    assetOrigin: origin,
    categories: profileInventoryCategories,
    categorySlug,
    publicRouteContentBlocks: data.profile.contentBlocks,
  });
  // Existing inventory links win if conflicting query parameters are supplied.
  // Normal profile links carry only one item selector.
  const itemShare = inventoryItemShare || galleryItemShare;
  const pageCategoryShare = itemShare ? null : categoryShare;
  const meta = buildMeta(data, origin, itemShare, pageCategoryShare, pageMetadata);
  const jsonLd = buildJsonLd(data, origin, itemShare, pageCategoryShare, pageMetadata);
  const shouldIndexProfile = shouldIndexPublicProfileSlug(profileRecord.slug);

  let html = templateHtml;

  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(meta.documentTitle)}</title>`);
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
    `<meta name="robots" content="${
      pageMetadata?.robots ||
      (!shouldIndexProfile || (pageCategoryShare && !pageCategoryShare.indexable)
        ? "noindex, follow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1")
    }" />`
  );
  if (shouldIndexProfile && (!pageCategoryShare || pageCategoryShare.indexable)) {
    html = upsertTag(
      html,
      /<meta name="tradescout-business-slug"[^>]*>/i,
      `<meta name="tradescout-business-slug" content="${escapeHtml(profileRecord.slug)}" />`
    );
    html = upsertTag(
      html,
      /<meta name="tradescout-business-entity-type"[^>]*>/i,
      '<meta name="tradescout-business-entity-type" content="business_profile" />'
    );
  }
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    `<meta property="og:type" content="${escapeHtml(meta.ogType)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(meta.socialTitle)}" />`
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
    /<meta property="og:image:secure_url"[^>]*>/i,
    `<meta property="og:image:secure_url" content="${escapeHtml(meta.imageUrl)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:type"[^>]*>/i,
    `<meta property="og:image:type" content="${escapeHtml(meta.imageType)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:image:alt"[^>]*>/i,
    `<meta property="og:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  );
  if (Number.isFinite(meta.imageWidth) && Number.isFinite(meta.imageHeight)) {
    html = upsertTag(
      html,
      /<meta property="og:image:width"[^>]*>/i,
      `<meta property="og:image:width" content="${meta.imageWidth}" />`
    );
    html = upsertTag(
      html,
      /<meta property="og:image:height"[^>]*>/i,
      `<meta property="og:image:height" content="${meta.imageHeight}" />`
    );
  } else {
    html = html
      .replace(/<meta property="og:image:width"[^>]*>\s*/gi, "")
      .replace(/<meta property="og:image:height"[^>]*>\s*/gi, "");
  }
  html = upsertTag(
    html,
    /<meta property="og:locale"[^>]*>/i,
    `<meta property="og:locale" content="en_US" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:card"[^>]*>/i,
    `<meta name="twitter:card" content="summary_large_image" />`
  );
  html = upsertTag(
    html,
    /<meta name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(meta.socialTitle)}" />`
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
    /<meta name="twitter:image:alt"[^>]*>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.imageAlt)}" />`
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />`
  );
  const selectiveIntelligenceManifestUrl = `https://www.thetradescout.com/api/u/${encodeURIComponent(profileRecord.slug)}/selective-intelligence`;
  html = upsertTag(
    html,
    /<meta name="selective-intelligence-trigger"[^>]*>/i,
    '<meta name="selective-intelligence-trigger" content="profile-link" />'
  );
  html = upsertTag(
    html,
    /<meta name="selective-intelligence-product"[^>]*>/i,
    '<meta name="selective-intelligence-product" content="TradeScout" />'
  );
  html = upsertTag(
    html,
    /<link rel="alternate" type="application\/vnd\.selective-intelligence\+json"[^>]*>/i,
    `<link rel="alternate" type="application/vnd.selective-intelligence+json" title="Selective Intelligence" href="${escapeHtml(selectiveIntelligenceManifestUrl)}" />`
  );
  if (meta.faviconUrl) {
    html = injectFaviconOverride(html, meta.faviconUrl);
  }

  const requestHost = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const customDomain = profileRecord.seoMeta?.customDomain?.trim().toLowerCase();
  if (customDomain && requestHost === customDomain) {
    html = injectCustomDomainProfileSlug(html, profileRecord.slug);
  }

  const bookingRows =
    profileRecord.profileBooking?.pricingTableEnabled &&
    Array.isArray(profileRecord.profileBooking?.pricingRows)
      ? profileRecord.profileBooking.pricingRows
          .map((row: any) =>
            [cleanPublicProfileText(row?.name, 160), cleanPublicProfileText(row?.priceLabel, 80)]
              .filter((part) => part.length > 0)
              .join(": ")
          )
          .filter((line: string) => line.length > 0)
          .slice(0, 6)
      : [];
  const bookingPrice = Number(profileRecord.profileBooking?.bookingPriceUsd);
  const bookingSummary =
    profileRecord.profileBooking?.enabled === true
      ? profileRecord.profileBooking?.paidBookings &&
        Number.isFinite(bookingPrice) &&
        bookingPrice > 0
        ? `Appointments are available. Booking deposit: $${bookingPrice.toFixed(2)}.`
        : "Appointments are available."
      : "";
  const categoriesSummary = (businessRecord?.categories || [])
    .map((value) => cleanPublicProfileText(value, 120))
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
  const configuredAreas =
    data.profile.slug === "jw-stone" && businessRecord?.city
      ? [[businessRecord.city, businessRecord.stateCode].filter(Boolean).join(", ")]
      : businessRecord?.serviceAreas || [];
  const areasSummary = configuredAreas
    .map((value) => cleanPublicProfileText(value, 160))
    .filter(Boolean)
    .slice(0, 8)
    .join(", ");
  const inventoryCategories = listProfileInventoryCategories(
    profileInventoryCategories,
    data.profile.contentBlocks
  ).filter((category) => category.indexable);
  const inventoryItems = listProfileInventoryItems(profileInventoryCategories);
  const categoryLinks = inventoryCategories
    .map((category) => {
      const url = buildProfilePublicCategoryUrl({
        profileUrl,
        categorySlug: category.slug,
        contentBlocks: data.profile.contentBlocks,
      });
      return url
        ? category.collectionKind === "offerings"
          ? `<li><a href="${escapeHtml(url)}">${escapeHtml(category.name)} materials</a> — ${category.itemCount} ${category.itemCount === 1 ? "offering" : "offerings"}</li>`
          : `<li><a href="${escapeHtml(url)}">${escapeHtml(category.name)} inventory</a> — ${category.itemCount} current ${category.itemCount === 1 ? "selection" : "selections"}</li>`
        : "";
    })
    .filter(Boolean)
    .join("");
  const categorySectionHeading =
    inventoryCategories.length > 0 &&
    inventoryCategories.every((category) => category.collectionKind === "offerings")
      ? "Explore materials"
      : "Shop natural stone by material";
  const priorityItemSlugs =
    data.profile.slug === "jw-stone"
      ? ["taj-mahal", "cristallo", "blue-goias", "blue-dunes", "rhino-white", "titanium-leathered"]
      : [];
  const featuredInventoryItems = [
    ...priorityItemSlugs
      .map((slug) => inventoryItems.find((item) => item.slug === slug))
      .filter((item): item is (typeof inventoryItems)[number] => Boolean(item)),
    ...inventoryItems.filter((item) => !priorityItemSlugs.includes(item.slug)),
  ].slice(0, 12);
  const inventoryLinks = featuredInventoryItems
    .map((item) => {
      const url = buildProfilePublicItemUrl({
        profileUrl,
        itemType: "inventory",
        itemSlug: item.slug,
        contentBlocks: data.profile.contentBlocks,
      });
      const location = data.profile.slug === "jw-stone" ? " in Pensacola, FL" : "";
      const linkLabel = item.hasPublicName ? `${item.name}${location}` : "View stone selection";
      return url
        ? `<li><a href="${escapeHtml(url)}">${escapeHtml(linkLabel)}</a>${item.category ? ` — ${escapeHtml(item.category)}` : ""}</li>`
        : "";
    })
    .filter(Boolean)
    .join("");
  const inventorySectionHeading =
    featuredInventoryItems.length > 0 &&
    featuredInventoryItems.every((item) => item.publicKind === "offering")
      ? "Featured materials"
      : "Featured stone inventory";
  const servicesSummary = cleanPublicProfileText(profileRecord.servicesDescription, 1000);
  const itemSummary = itemShare
    ? `<section data-seo-profile-item="${itemShare.itemType}">
      ${
        itemShare.itemType === "inventory" && !itemShare.hasPublicName
          ? ""
          : `<h2>${escapeHtml(
              cleanPublicProfileText(
                itemShare.itemType === "inventory" ? itemShare.itemName : itemShare.itemTitle,
                200
              )
            )}</h2>`
      }
      <img src="${escapeHtml(itemShare.imageUrl)}" alt="${escapeHtml(cleanPublicProfileText(itemShare.imageAlt, 240))}" />
      <p>${escapeHtml(cleanPublicProfileText(itemShare.description, 500))}</p>
    </section>`
    : "";
  const categorySummary = pageCategoryShare
    ? `<section data-seo-profile-category="${escapeHtml(pageCategoryShare.categorySlug)}">
      <h2>${escapeHtml(cleanPublicProfileText(pageCategoryShare.categoryName, 200))}</h2>
      <img src="${escapeHtml(pageCategoryShare.imageUrl)}" alt="${escapeHtml(cleanPublicProfileText(pageCategoryShare.imageAlt, 240))}" />
      <p>${escapeHtml(cleanPublicProfileText(pageCategoryShare.description, 500))}</p>
      <p>${pageCategoryShare.itemCount} ${
        pageCategoryShare.collectionKind === "offerings"
          ? pageCategoryShare.itemCount === 1
            ? "published material"
            : "published materials"
          : pageCategoryShare.itemCount === 1
            ? "current selection"
            : "current selections"
      }</p>
    </section>`
    : "";
  const rootSummary = `
<main data-seo-profile="true" style="padding:1rem;max-width:960px;margin:0 auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <article>
    <h1>${escapeHtml(displayName)}</h1>
    <p>${escapeHtml(meta.description)}</p>
    ${itemSummary}
    ${categorySummary}
    ${categoriesSummary ? `<p><strong>Categories:</strong> ${escapeHtml(categoriesSummary)}</p>` : ""}
    ${areasSummary ? `<p><strong>Service areas:</strong> ${escapeHtml(areasSummary)}</p>` : ""}
    ${servicesSummary ? `<p>${escapeHtml(servicesSummary)}</p>` : ""}
    ${categoryLinks ? `<section><h2>${categorySectionHeading}</h2><ul>${categoryLinks}</ul></section>` : ""}
    ${inventoryLinks ? `<section><h2>${inventorySectionHeading}</h2><ul>${inventoryLinks}</ul></section>` : ""}
    ${bookingSummary ? `<p>${escapeHtml(bookingSummary)}</p>` : ""}
    ${bookingRows.length > 0 ? `<ul>${bookingRows.map((row: string) => `<li>${escapeHtml(row)}</li>`).join("")}</ul>` : ""}
  </article>
</main>`;

  html = injectProfileSummary(html, rootSummary);
  if (shouldIndexProfile) {
    html = injectJsonLd(html, jsonLd);
  }
  return html;
}
