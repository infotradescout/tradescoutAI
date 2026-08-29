import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { formatTradeScoutTitle } from "@shared/brand";
import {
  buildProfileServicePath,
  buildProfileServiceUrl,
  createProfileServiceShareMetadata,
  listFactBearingProfileServices,
  resolveProfileServiceItem,
  resolveProfileServiceRoute,
  type ResolvedProfileServiceItem,
} from "@shared/profileServiceShare";
import { sanitizePublicDiscoveryText } from "@shared/publicListingSafety";
import { buildProfileSocialPreviewImageUrl } from "@shared/profileSocialPreview";
import { storage } from "./storage";
import { resolvePublicOrigin } from "./utils/publicOrigin";
import { sendPublicPageNotFound, sendPublicPageRenderFailure } from "./utils/publicPageResponse";
import { stripPublicSeoBootPlaceholders } from "./publicSeoHtml";
import {
  absoluteCanonicalPublicProfileMediaUrl,
  buildCanonicalPublicProfileProjection,
  resolveCanonicalPublicProfileUrl,
} from "./publicProfileProjection";

const CLIENT_MODULE_SCRIPT_PATTERN =
  /\s*<script\b[^>]*\btype\s*=\s*(["'])module\1[^>]*\bsrc\s*=\s*(["'])[^"']+\2[^>]*><\/script>\s*/gi;
const PLATFORM_SERVICE_ROUTE_PATTERN = /^\/(u|p)\/([^/]+)\/services\/([^/]+)\/?$/i;
const CUSTOM_SERVICE_ROUTE_PATTERN = /^\/landing\/service\/([^/]+)\/?$/i;
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

function readTemplate(): string | null {
  if (templateCache !== undefined) return templateCache;
  const templatePath = path.join(process.cwd(), "dist/public/index.html");
  templateCache = fs.existsSync(templatePath) ? fs.readFileSync(templatePath, "utf8") : null;
  return templateCache;
}

function directConnectUrl(args: {
  profileSlug: string;
  profileName: string;
  service: ResolvedProfileServiceItem;
}): string {
  const url = new URL("/direct-connect", CANONICAL_TRADESCOUT_ORIGIN);
  url.searchParams.set("profile", args.profileSlug);
  url.searchParams.set("profileName", args.profileName);
  url.searchParams.set("item", args.service.title);
  url.searchParams.set("subject", "service");
  url.searchParams.set("source", "profile_service_page");
  url.searchParams.set("title", args.service.title);
  url.searchParams.set("intent", "fix_improve");
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

export function buildPublicProfileServiceHtml(args: {
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
    categories?: string[] | null;
    serviceAreas?: string[] | null;
    city?: string | null;
    stateCode?: string | null;
    brandColors?: Record<string, any> | null;
  } | null;
  service: ResolvedProfileServiceItem;
}): string | null {
  const projection = buildCanonicalPublicProfileProjection({
    profile: args.profile,
    business: args.business,
  });
  if (!projection) return null;
  const service = resolveProfileServiceItem(projection.profile.contentBlocks, args.service.slug);
  if (!service) return null;
  args = {
    ...args,
    profile: projection.profile,
    business: projection.business,
    service,
  };
  const profileName =
    cleanPublicText(args.business?.name || args.profile.displayName, 120) || "Public profile";
  const profileUrl = resolveCanonicalPublicProfileUrl({
    profileSlug: args.profile.slug,
    customDomain: args.profile.seoMeta?.customDomain,
    platformOrigin: args.origin,
  });
  if (!profileUrl) return null;
  const share = createProfileServiceShareMetadata({
    profileName,
    profileUrl,
    assetOrigin: args.origin,
    contentBlocks: args.profile.contentBlocks,
    serviceSlug: args.service.slug,
  });
  const canonical =
    share?.canonical ||
    buildProfileServiceUrl({ profileUrl, serviceSlug: args.service.slug }) ||
    profileUrl;
  const title = formatTradeScoutTitle(share?.title || `${args.service.title} | ${profileName}`);
  const description = cleanPublicText(share?.description || args.service.description, 160);
  const profileImage =
    absoluteCanonicalPublicProfileMediaUrl(args.profile.seoMeta?.imageUrl, args.origin) ||
    buildProfileSocialPreviewImageUrl({
      pageOrigin: args.origin,
      profileSlug: args.profile.slug,
      versionSeed: `${profileName}|${args.service.title}|${description}`,
    }) ||
    `${CANONICAL_TRADESCOUT_ORIGIN}/tradescout-social-preview.png?v=12`;
  const sourceImage = share?.imageUrl || profileImage;
  const favicon = absoluteCanonicalPublicProfileMediaUrl(
    args.profile.seoMeta?.faviconUrl || args.profile.seoMeta?.imageUrl,
    args.origin
  );
  const serviceAreas = (args.business?.serviceAreas || [])
    .map((value) => cleanPublicText(value, 120))
    .filter(Boolean)
    .slice(0, 12);
  const locationLabel = cleanPublicText(
    [args.business?.city, args.business?.stateCode]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(", "),
    120
  );
  const relatedServices = listFactBearingProfileServices(args.profile.contentBlocks).filter(
    (service) => service.slug !== args.service.slug
  );
  const accent = safeAccentColor(
    args.business?.brandColors?.accent || args.business?.brandColors?.primary
  );
  const requestUrl = directConnectUrl({
    profileSlug: args.profile.slug,
    profileName,
    service: args.service,
  });

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": args.business?.name ? "LocalBusiness" : "Organization",
        "@id": `${profileUrl}#identity`,
        name: profileName,
        url: profileUrl,
        ...(locationLabel
          ? {
              address: {
                "@type": "PostalAddress",
                addressLocality: cleanPublicText(args.business?.city, 80) || undefined,
                addressRegion: cleanPublicText(args.business?.stateCode, 20) || undefined,
                addressCountry: "US",
              },
            }
          : {}),
      },
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        name: args.service.title,
        description: args.service.description,
        serviceType: args.service.title,
        url: canonical,
        provider: { "@id": `${profileUrl}#identity` },
        areaServed: serviceAreas.length > 0 ? serviceAreas : undefined,
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        isPartOf: { "@id": `${profileUrl}#identity` },
        mainEntity: { "@id": `${canonical}#service` },
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
            name: args.service.title,
            item: canonical,
          },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${CANONICAL_TRADESCOUT_ORIGIN}/#organization`,
        name: "TradeScout",
        url: `${CANONICAL_TRADESCOUT_ORIGIN}/`,
      },
    ],
  };

  const relatedLinks = relatedServices
    .map((service) => {
      const url = buildProfileServiceUrl({ profileUrl, serviceSlug: service.slug });
      return url ? `<li><a href="${escapeHtml(url)}">${escapeHtml(service.title)}</a></li>` : "";
    })
    .filter(Boolean)
    .join("");
  const serviceAreaCopy = serviceAreas.length > 0 ? serviceAreas.join(" · ") : locationLabel;
  const summary = `
<div data-seo-profile="true" hidden></div>
<main data-public-profile-service-page="true" style="--service-accent:${escapeHtml(accent)};min-height:100vh;background:linear-gradient(145deg,#061117,#0d2430 64%,#07151c);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;box-sizing:border-box;">
  <article style="max-width:980px;margin:0 auto;">
    <nav aria-label="Breadcrumb" style="margin-bottom:24px;font-size:14px;"><a href="${escapeHtml(profileUrl)}" style="color:#fdba74;text-decoration:none;">${escapeHtml(profileName)}</a><span aria-hidden="true" style="margin:0 10px;color:rgba(255,255,255,.45);">/</span><span>${escapeHtml(args.service.title)}</span></nav>
    <section style="overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:30px;background:rgba(7,20,27,.94);box-shadow:0 30px 100px rgba(0,0,0,.42);">
      <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);">
        <div style="padding:clamp(30px,6vw,64px);">
          <p style="margin:0 0 16px;color:#fdba74;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;">Service from ${escapeHtml(profileName)}</p>
          <h1 style="margin:0;font-size:clamp(38px,7vw,68px);line-height:1.02;letter-spacing:-.04em;">${escapeHtml(args.service.title)}</h1>
          <p style="max-width:720px;margin:24px 0 0;color:rgba(255,255,255,.76);font-size:18px;line-height:1.75;">${escapeHtml(args.service.description)}</p>
          ${serviceAreaCopy ? `<p style="margin:22px 0 0;color:rgba(255,255,255,.58);font-size:14px;"><strong style="color:#fff;">Service area:</strong> ${escapeHtml(serviceAreaCopy)}</p>` : ""}
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:32px;">
            <a href="${escapeHtml(requestUrl)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 24px;border-radius:999px;background:${escapeHtml(accent)};color:#fff;font-weight:800;text-decoration:none;">Start a Request</a>
            <a href="${escapeHtml(profileUrl)}" style="display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 24px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:#fff;font-weight:750;text-decoration:none;">View full profile</a>
          </div>
        </div>
        <div style="min-height:360px;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;padding:28px;">
          <img src="${escapeHtml(sourceImage)}" alt="${escapeHtml(share?.imageAlt || `${profileName} service preview`)}" style="max-width:100%;max-height:520px;border-radius:22px;object-fit:contain;" />
        </div>
      </div>
    </section>
    ${relatedLinks ? `<section style="margin-top:26px;padding:26px;border:1px solid rgba(255,255,255,.1);border-radius:24px;background:rgba(255,255,255,.035);"><h2 style="margin:0 0 14px;font-size:24px;">Other services from ${escapeHtml(profileName)}</h2><ul style="display:grid;gap:10px;margin:0;padding-left:20px;">${relatedLinks}</ul></section>` : ""}
    <footer style="padding:30px 0 12px;text-align:center;color:rgba(255,255,255,.42);font-size:12px;">Connection Without Compromise · Requests stay inside TradeScout until both sides choose direct contact.</footer>
  </article>
</main>
<style>@media(max-width:760px){main[data-public-profile-service-page] article section>div{grid-template-columns:1fr!important}main[data-public-profile-service-page] article section>div>div:last-child{min-height:240px!important}}</style>`;

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
  html = upsertTag(
    html,
    /<link rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  );
  html = injectFavicon(html, favicon);
  html = injectJsonLd(html, serviceJsonLd);
  html = html.replace(/<div\b([^>]*\bid=["']root["'][^>]*)>\s*<\/div>/i, `<div$1>${summary}</div>`);
  return html;
}

type ServiceRequestResolution = {
  profileSlug: string;
  serviceSlug: string;
  source: "platform" | "legacy-platform" | "custom-domain";
  requestOrigin: string;
  requestHost: string;
};

function resolveServiceRequest(req: Request): ServiceRequestResolution | null {
  const requestPath = String(req.path || "").trim();
  const platform = requestPath.match(PLATFORM_SERVICE_ROUTE_PATTERN);
  if (platform) {
    try {
      return {
        profileSlug: decodeURIComponent(platform[2]).trim().toLowerCase(),
        serviceSlug: decodeURIComponent(platform[3]).trim().toLowerCase(),
        source: platform[1].toLowerCase() === "p" ? "legacy-platform" : "platform",
        requestOrigin: resolvePublicOrigin(req),
        requestHost: String(req.hostname || "")
          .trim()
          .toLowerCase(),
      };
    } catch {
      return null;
    }
  }

  const custom = requestPath.match(CUSTOM_SERVICE_ROUTE_PATTERN);
  if (!custom) return null;
  const mappedProfileSlug = String((req as any)[MAPPED_PROFILE_DOMAIN_SLUG_KEY] || "")
    .trim()
    .toLowerCase();
  if (!mappedProfileSlug) {
    return {
      profileSlug: "",
      serviceSlug: "",
      source: "custom-domain",
      requestOrigin: resolvePublicOrigin(req),
      requestHost: String(req.hostname || "")
        .trim()
        .toLowerCase(),
    };
  }
  try {
    return {
      profileSlug: mappedProfileSlug,
      serviceSlug: decodeURIComponent(custom[1]).trim().toLowerCase(),
      source: "custom-domain",
      requestOrigin: `https://${String(req.hostname || "")
        .trim()
        .toLowerCase()}`,
      requestHost: String(req.hostname || "")
        .trim()
        .toLowerCase(),
    };
  } catch {
    return null;
  }
}

/**
 * Handles profile service pages before the SPA catch-all. Returns true when
 * the request belonged to the service-page namespace, including honest 404s.
 */
export async function handlePublicProfileServiceRequest(
  req: Request,
  res: Response
): Promise<boolean> {
  const resolution = resolveServiceRequest(req);
  if (!resolution) return false;
  if (!resolution.profileSlug || !resolution.serviceSlug) {
    sendPublicPageNotFound(res, "Profile service not found");
    return true;
  }

  try {
    const storedProfile = await storage.getProfileBySlugPublic(resolution.profileSlug);
    if (!storedProfile) {
      sendPublicPageNotFound(res, "Profile service not found");
      return true;
    }
    const storedBusiness = storedProfile.businessId
      ? await storage.getBusinessPublicById(storedProfile.businessId)
      : null;
    const projection = buildCanonicalPublicProfileProjection({
      profile: storedProfile,
      business: storedBusiness,
    });
    if (!projection) {
      sendPublicPageNotFound(res, "Profile service not found");
      return true;
    }
    const { profile, business } = projection;
    const service = resolveProfileServiceItem(profile.contentBlocks, resolution.serviceSlug);
    if (!service) {
      sendPublicPageNotFound(res, "Profile service not found");
      return true;
    }

    const customDomain = String(profile.seoMeta?.customDomain || "")
      .trim()
      .toLowerCase();
    const platformProfilePath = `/u/${encodeURIComponent(profile.slug)}`;
    if (resolution.source === "legacy-platform") {
      const destination = customDomain
        ? new URL(
            buildProfileServicePath({ profileBasePath: "/", serviceSlug: service.slug }) || "/",
            `https://${customDomain}`
          ).toString()
        : new URL(
            buildProfileServicePath({
              profileBasePath: platformProfilePath,
              serviceSlug: service.slug,
            }) || platformProfilePath,
            resolution.requestOrigin
          ).toString();
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.redirect(301, destination);
      return true;
    }
    if (resolution.source === "platform" && customDomain) {
      const destinationPath = buildProfileServicePath({
        profileBasePath: "/",
        serviceSlug: service.slug,
      });
      if (!destinationPath) {
        sendPublicPageNotFound(res, "Profile service not found");
        return true;
      }
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.redirect(301, new URL(destinationPath, `https://${customDomain}`).toString());
      return true;
    }
    if (
      resolution.source === "custom-domain" &&
      (!customDomain || resolution.requestHost !== customDomain)
    ) {
      sendPublicPageNotFound(res, "Profile service not found");
      return true;
    }

    const templateHtml = readTemplate();
    if (!templateHtml) {
      sendPublicPageRenderFailure(res, "Application files not found");
      return true;
    }
    const html = buildPublicProfileServiceHtml({
      templateHtml,
      origin: resolution.requestOrigin,
      profile,
      business,
      service,
    });
    if (!html) {
      sendPublicPageNotFound(res, "Profile service not found");
      return true;
    }
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.type("html").send(html);
    return true;
  } catch (error) {
    console.error("[ProfileService] Failed rendering public service page:", error);
    sendPublicPageRenderFailure(res, "Failed to render profile service");
    return true;
  }
}

export async function attachPublicProfileServiceLinks(req: Request, res: Response): Promise<void> {
  const requestPath = String(req.path || "").replace(/\/+$/, "") || "/";
  const match = requestPath.match(/^\/u\/([^/]+)$/i);
  if (!match) return;

  let profileSlug = "";
  try {
    profileSlug = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return;
  }
  const storedProfile = await storage.getProfileBySlugPublic(profileSlug);
  if (!storedProfile) return;
  const projection = buildCanonicalPublicProfileProjection({ profile: storedProfile });
  if (!projection) return;
  const profile = projection.profile;
  if (profile.seoMeta?.customDomain) return;
  const services = listFactBearingProfileServices(profile.contentBlocks);
  if (services.length === 0) return;

  const profileUrl = `${resolvePublicOrigin(req)}/u/${encodeURIComponent(profile.slug)}`;
  const links = services
    .map((service) => {
      const serviceUrl = buildProfileServiceUrl({ profileUrl, serviceSlug: service.slug });
      return serviceUrl
        ? `<li><a href="${escapeHtml(serviceUrl)}">${escapeHtml(service.title)}</a> — ${escapeHtml(service.description)}</li>`
        : "";
    })
    .filter(Boolean)
    .join("");
  if (!links) return;

  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    if (
      typeof body === "string" &&
      /<html[\s>]/i.test(body) &&
      !body.includes('data-seo-profile-service-links="true"')
    ) {
      const section = `<section data-seo-profile-service-links="true"><h2>Published services</h2><ul>${links}</ul></section>`;
      const updated = /<\/article>/i.test(body)
        ? body.replace(/<\/article>/i, `${section}</article>`)
        : body.replace(/<\/main>/i, `${section}</main>`);
      return originalSend(updated);
    }
    return originalSend(body);
  }) as typeof res.send;
}

export function isPublicProfileServicePath(pathname: string): boolean {
  return (
    PLATFORM_SERVICE_ROUTE_PATTERN.test(pathname) || CUSTOM_SERVICE_ROUTE_PATTERN.test(pathname)
  );
}

export function validateProfileServiceRoute(args: {
  pathname: string;
  profileBasePath: string;
  contentBlocks: unknown;
}): boolean {
  const route = resolveProfileServiceRoute({
    pathname: args.pathname,
    profileBasePath: args.profileBasePath,
  });
  return Boolean(route && resolveProfileServiceItem(args.contentBlocks, route.serviceSlug));
}
