import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { formatTradeScoutTitle } from "@shared/brand";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import {
  buildProfileServiceAreaUrl,
  isProfileServiceAreaPath,
  resolveProfileServiceAreaHub,
  resolveProfileServiceAreaRoute,
} from "@shared/profileServiceAreaShare";
import {
  buildProfileServiceUrl,
  listFactBearingProfileServices,
} from "@shared/profileServiceShare";
import { buildProfileSocialPreviewImageUrl } from "@shared/profileSocialPreview";
import { storage } from "./storage";
import { stripPublicSeoBootPlaceholders } from "./publicSeoHtml";
import { resolvePublicOrigin } from "./utils/publicOrigin";
import { sendPublicPageNotFound, sendPublicPageRenderFailure } from "./utils/publicPageResponse";

const CLIENT_MODULE_SCRIPT_PATTERN =
  /\s*<script\b[^>]*\btype\s*=\s*(["'])module\1[^>]*\bsrc\s*=\s*(["'])[^"']+\2[^>]*><\/script>\s*/gi;
const MAPPED_PROFILE_DOMAIN_SLUG_KEY = "mappedProfileDomainSlug";
const CANONICAL_TRADESCOUT_ORIGIN = "https://www.thetradescout.com";
let templateCache: string | null | undefined;

function cleanPublicText(value: unknown, maxLength: number): string {
  return sanitizePublicDiscoveryText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function upsertTag(html: string, pattern: RegExp, tag: string): string {
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace("</head>", `${tag}\n</head>`);
}

function safeAccentColor(value: unknown): string {
  const candidate = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "#f97316";
}

function absolutePublicUrl(value: unknown, origin: string): string | null {
  const candidate = String(value || "").trim();
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  try {
    const url = new URL(candidate, origin);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function readTemplate(): string | null {
  if (templateCache !== undefined) return templateCache;
  const templatePath = path.join(process.cwd(), "dist/public/index.html");
  templateCache = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : null;
  return templateCache;
}

function directConnectUrl(args: {
  profileSlug: string;
  profileName: string;
  area?: string;
}): string {
  const url = new URL("/direct-connect", CANONICAL_TRADESCOUT_ORIGIN);
  url.searchParams.set("profile", args.profileSlug);
  url.searchParams.set("profileName", args.profileName);
  url.searchParams.set("subject", "service");
  url.searchParams.set("source", "profile_service_area_page");
  url.searchParams.set("intent", "fix_improve");
  url.searchParams.set(
    "title",
    args.area ? `Service request in ${args.area}` : `Service request for ${args.profileName}`
  );
  if (args.area) url.searchParams.set("location", args.area);
  return url.toString();
}

function injectJsonLd(html: string, structuredData: object): string {
  const json = JSON.stringify(structuredData).replace(/</g, "\\u003c");
  return html.replace("</head>", `<script type="application/ld+json">${json}</script>\n</head>`);
}

function injectFavicon(html: string, faviconUrl: string | null): string {
  if (!faviconUrl) return html;
  const withoutIcons = html
    .replace(/<link rel="icon"[^>]*>\s*/gi, "")
    .replace(/<link rel="apple-touch-icon"[^>]*>\s*/gi, "");
  return withoutIcons.replace(
    "</head>",
    `<link rel="icon" href="${escapeHtml(faviconUrl)}" />\n<link rel="apple-touch-icon" href="${escapeHtml(faviconUrl)}" />\n</head>`
  );
}

export function buildPublicProfileServiceAreaHtml(args: {
  templateHtml: string;
  origin: string;
  profile: {
    slug: string;
    displayName: string;
    headline?: string | null;
    contentBlocks?: unknown;
    seoMeta?: Record<string, any> | null;
  };
  business?: {
    name?: string | null;
    city?: string | null;
    stateCode?: string | null;
    brandColors?: Record<string, any> | null;
  } | null;
}): string | null {
  const hub = resolveProfileServiceAreaHub(args.profile.contentBlocks);
  const services = listFactBearingProfileServices(args.profile.contentBlocks);
  if (!hub || services.length === 0) return null;

  const profileName =
    cleanPublicText(args.business?.name || args.profile.displayName, 120) || "Public profile";
  const profileUrl = args.profile.seoMeta?.customDomain
    ? `https://${String(args.profile.seoMeta.customDomain).trim().toLowerCase()}/`
    : `${args.origin}/u/${encodeURIComponent(args.profile.slug)}`;
  const canonical = buildProfileServiceAreaUrl(profileUrl);
  if (!canonical) return null;

  const title = formatTradeScoutTitle(`${profileName} Service Areas`);
  const coverageLabel = hub.areas.join(" · ");
  const description = cleanPublicText(
    hub.description ||
      `${profileName} publishes service coverage for ${hub.areas.join(", ")}. Review available services and start a request with the project location.`,
    160
  );
  const accent = safeAccentColor(
    args.business?.brandColors?.accent || args.business?.brandColors?.primary
  );
  const profileImage =
    absolutePublicUrl(args.profile.seoMeta?.imageUrl, args.origin) ||
    buildProfileSocialPreviewImageUrl({
      pageOrigin: args.origin,
      profileSlug: args.profile.slug,
      versionSeed: `${profileName}|service-areas|${coverageLabel}`,
    }) ||
    `${CANONICAL_TRADESCOUT_ORIGIN}/tradescout-social-preview.png?v=12`;
  const favicon = absolutePublicUrl(
    args.profile.seoMeta?.faviconUrl || args.profile.seoMeta?.imageUrl,
    args.origin
  );

  const serviceLinks = services
    .map((service) => {
      const url = buildProfileServiceUrl({ profileUrl, serviceSlug: service.slug });
      if (!url) return "";
      return `<li style="padding:18px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.035);"><a href="${escapeHtml(url)}" style="color:#fff;font-size:17px;font-weight:800;text-decoration:none;">${escapeHtml(service.title)}</a><p style="margin:8px 0 0;color:rgba(255,255,255,.68);line-height:1.55;">${escapeHtml(service.description)}</p></li>`;
    })
    .filter(Boolean)
    .join("");
  const areaCards = hub.areas
    .map((area) => {
      const requestUrl = directConnectUrl({
        profileSlug: args.profile.slug,
        profileName,
        area,
      });
      return `<li style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border:1px solid rgba(255,255,255,.1);border-radius:18px;background:rgba(255,255,255,.035);"><strong>${escapeHtml(area)}</strong><a href="${escapeHtml(requestUrl)}" style="color:#fdba74;font-size:13px;font-weight:800;text-decoration:none;white-space:nowrap;">Start a Request</a></li>`;
    })
    .join("");
  const generalRequestUrl = directConnectUrl({
    profileSlug: args.profile.slug,
    profileName,
  });

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": args.business?.name ? "LocalBusiness" : "Organization",
        "@id": `${profileUrl}#identity`,
        name: profileName,
        url: profileUrl,
        areaServed: hub.areas,
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: `${profileName} services`,
          itemListElement: services.map((service, index) => ({
            "@type": "Offer",
            position: index + 1,
            itemOffered: {
              "@type": "Service",
              name: service.title,
              description: service.description,
              url: buildProfileServiceUrl({ profileUrl, serviceSlug: service.slug }) || undefined,
            },
          })),
        },
      },
      {
        "@type": "CollectionPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        about: { "@id": `${profileUrl}#identity` },
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: profileName,
            item: profileUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Service Areas",
            item: canonical,
          },
        ],
      },
    ],
  };

  const summary = `
<div data-seo-profile="true" hidden></div>
<main data-public-profile-service-area-page="true" style="--service-accent:${escapeHtml(accent)};min-height:100vh;background:linear-gradient(145deg,#061117,#0d2430 64%,#07151c);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;box-sizing:border-box;">
  <article style="max-width:1080px;margin:0 auto;">
    <nav aria-label="Breadcrumb" style="margin-bottom:24px;font-size:14px;"><a href="${escapeHtml(profileUrl)}" style="color:#fdba74;text-decoration:none;">${escapeHtml(profileName)}</a><span aria-hidden="true" style="margin:0 10px;color:rgba(255,255,255,.45);">/</span><span>Service Areas</span></nav>
    <header style="overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:30px;background:rgba(7,20,27,.94);box-shadow:0 30px 100px rgba(0,0,0,.42);padding:clamp(30px,6vw,64px);">
      <p style="margin:0 0 16px;color:#fdba74;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">Published coverage</p>
      <h1 style="margin:0;font-size:clamp(38px,7vw,68px);line-height:1.02;letter-spacing:-.04em;">${escapeHtml(profileName)} Service Areas</h1>
      <p style="max-width:820px;margin:24px 0 0;color:rgba(255,255,255,.76);font-size:18px;line-height:1.75;">${escapeHtml(hub.description || `These are the service areas currently published by ${profileName}.`)}</p>
      <p style="margin:20px 0 0;color:rgba(255,255,255,.58);font-size:14px;">${escapeHtml(coverageLabel)}</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:30px;"><a href="${escapeHtml(generalRequestUrl)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 24px;border-radius:999px;background:${escapeHtml(accent)};color:#fff;font-weight:800;text-decoration:none;">Start a Request</a><a href="${escapeHtml(profileUrl)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 24px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#fff;font-weight:750;text-decoration:none;">View full profile</a></div>
    </header>
    <section style="display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:22px;margin-top:24px;">
      <div style="padding:26px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(255,255,255,.035);"><h2 style="margin:0 0 16px;font-size:25px;">Where service is published</h2><ul style="display:grid;gap:10px;margin:0;padding:0;list-style:none;">${areaCards}</ul></div>
      <div style="padding:26px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(255,255,255,.035);"><h2 style="margin:0 0 16px;font-size:25px;">Available services</h2><ul style="display:grid;gap:12px;margin:0;padding:0;list-style:none;">${serviceLinks}</ul></div>
    </section>
    <footer style="padding:30px 0 12px;text-align:center;color:rgba(255,255,255,.42);font-size:12px;">Connection Without Compromise · Coverage is published by the profile and should be confirmed for the exact property before work begins.</footer>
  </article>
</main>
<style>@media(max-width:780px){main[data-public-profile-service-area-page] article>section{grid-template-columns:1fr!important}}</style>`;

  let html = stripPublicSeoBootPlaceholders(args.templateHtml).replace(
    CLIENT_MODULE_SCRIPT_PATTERN,
    ""
  );
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = upsertTag(
    html,
    /<meta name="description"[^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="robots"[^>]*>/i,
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />'
  );
  html = upsertTag(
    html,
    /<meta name="tradescout-business-slug"[^>]*>/i,
    `<meta name="tradescout-business-slug" content="${escapeHtml(args.profile.slug)}" />`
  );
  html = upsertTag(
    html,
    /<meta name="tradescout-business-entity-type"[^>]*>/i,
    '<meta name="tradescout-business-entity-type" content="business_profile" />'
  );
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  html = upsertTag(
    html,
    /<meta property="og:type"[^>]*>/i,
    '<meta property="og:type" content="website" />'
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
    `<meta property="og:image" content="${escapeHtml(profileImage)}" />`
  );
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
    `<meta name="twitter:image" content="${escapeHtml(profileImage)}" />`
  );
  html = injectJsonLd(html, structuredData);
  html = injectFavicon(html, favicon);
  return html.replace(/<div id="root"><\/div>/i, `<div id="root">${summary}</div>`);
}

export function isPublicProfileServiceAreaPath(pathname: unknown): boolean {
  return isProfileServiceAreaPath(pathname);
}

export async function handlePublicProfileServiceAreaRequest(
  req: Request,
  res: Response
): Promise<boolean> {
  const route = resolveProfileServiceAreaRoute(req.path);
  if (!route) return false;

  const mappedProfileSlug = String((req as any)[MAPPED_PROFILE_DOMAIN_SLUG_KEY] || "")
    .trim()
    .toLowerCase();
  const profileSlug = route.requestedProfileSlug || mappedProfileSlug;
  if (!profileSlug) {
    sendPublicPageNotFound(res, "Service areas not found");
    return true;
  }

  try {
    const profile = await storage.getProfileBySlugPublic(profileSlug);
    if (!profile) {
      sendPublicPageNotFound(res, "Service areas not found");
      return true;
    }
    const hub = resolveProfileServiceAreaHub(profile.contentBlocks);
    const services = listFactBearingProfileServices(profile.contentBlocks);
    if (!hub || services.length === 0) {
      sendPublicPageNotFound(res, "Service areas not found");
      return true;
    }

    const customDomain = String(profile.seoMeta?.customDomain || "")
      .trim()
      .toLowerCase();
    if (route.source === "platform" && customDomain) {
      const destination = buildProfileServiceAreaUrl(`https://${customDomain}/`);
      if (!destination) {
        sendPublicPageNotFound(res, "Service areas not found");
        return true;
      }
      res.redirect(301, destination);
      return true;
    }
    if (route.source === "custom_domain" && (!mappedProfileSlug || mappedProfileSlug !== profileSlug)) {
      sendPublicPageNotFound(res, "Service areas not found");
      return true;
    }
    if (req.path.toLowerCase().startsWith("/p/")) {
      res.redirect(301, `/u/${encodeURIComponent(profileSlug)}/service-areas`);
      return true;
    }

    const templateHtml = readTemplate();
    if (!templateHtml) {
      sendPublicPageRenderFailure(res, "Application temporarily unavailable");
      return true;
    }
    const business = profile.businessId
      ? await storage.getBusinessPublicById(profile.businessId)
      : null;
    const origin = route.source === "custom_domain" ? `https://${req.hostname}` : resolvePublicOrigin(req);
    const html = buildPublicProfileServiceAreaHtml({
      templateHtml,
      origin,
      profile,
      business,
    });
    if (!html) {
      sendPublicPageNotFound(res, "Service areas not found");
      return true;
    }

    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.type("html").send(html);
    return true;
  } catch (error) {
    console.error("[ProfileServiceArea] Failed rendering service-area hub:", error);
    sendPublicPageRenderFailure(res, "Unable to render service areas");
    return true;
  }
}
