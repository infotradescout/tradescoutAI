import { detectActorFromUserAgent } from "./utils/requestActor";
import { upgradePublicSocialPreviewHtml } from "./publicSocialPreviewHtml";
import { issueDiscoveryAttributionToken } from "./utils/discoveryAttribution";
import { normalizeDiscoveryRouteForBusiness } from "../shared/discoveryLanding";

const SEO_ROOT_SUMMARY_PATTERN = /<div id="root">\s*<main data-seo-[\s\S]*?<\/main>\s*<\/div>/i;
const BOOT_FALLBACK_PATTERN = /\s*<div id="ts-boot-fallback"[\s\S]*?<\/section>\s*<\/div>\s*/i;
const LANDING_FALLBACK_PATTERN = /\s*<div id="ts-landing-fallback"[\s\S]*?<\/div>\s*/i;
const NOSCRIPT_FALLBACK_PATTERN =
  /\s*<noscript>\s*<div id="ts-boot-fallback-noscript"[\s\S]*?<\/noscript>\s*/i;
const CLIENT_MODULE_SCRIPT_PATTERN =
  /\s*<script\b[^>]*\btype\s*=\s*(["'])module\1[^>]*\bsrc\s*=\s*(["'])[^"']+\2[^>]*><\/script>\s*/gi;
const SIGNED_SOCIAL_CARD_PATTERN = /\/images\/social\/card\//i;
const JW_STONE_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-jw-stone-marketplace\b/i;
const FACT_BEARING_PUBLIC_DISCOVERY_MARKER = /\bdata-seo-(?:profile|business)\s*=\s*(["'])true\1/i;
const PUBLIC_PROFILE_SERVICE_PAGE_MARKER = /\bdata-public-profile-service-page\s*=\s*(["'])true\1/i;
const PUBLIC_PROFILE_SERVICE_JOURNEY_MARKER = /\bdata-ts-profile-service-journey\s*=\s*(["'])true\1/i;
const DISCOVERY_ATTRIBUTION_META_PATTERN =
  /<meta\b[^>]*\bname\s*=\s*(['"])tradescout-discovery-attribution\1[^>]*>/i;
const HTML_META_CONTENT_PATTERN = (name: string) =>
  new RegExp(
    `<meta\\b(?=[^>]*\\bname\\s*=\\s*(["'])${name}\\1)(?=[^>]*\\bcontent\\s*=\\s*(["'])([^"']*)\\2)[^>]*>`,
    "i"
  );
const CANONICAL_LINK_PATTERN =
  /<link\b(?=[^>]*\brel\s*=\s*(['"])canonical\1)(?=[^>]*\bhref\s*=\s*(['"])([^"']*)\2)[^>]*>/i;
/** Clip SEO chrome for human clients so createRoot can replace #root without a crawler-style flash. */
const JW_STONE_SEO_CLIENT_SUPPRESS =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

export function isJwStonePublicDiscoveryHtml(html: string): boolean {
  return JW_STONE_PUBLIC_DISCOVERY_MARKER.test(String(html || ""));
}

export function isFactBearingPublicDiscoveryHtml(html: string): boolean {
  const source = String(html || "");
  return isJwStonePublicDiscoveryHtml(source) || FACT_BEARING_PUBLIC_DISCOVERY_MARKER.test(source);
}

function mergeSeoSummaryPaintSuppression(attrs: string): string {
  if (/\bstyle\s*=/i.test(attrs)) {
    return attrs.replace(
      /\bstyle\s*=\s*(["'])([\s\S]*?)\1/i,
      (_styleMatch, quote: string, styleValue: string) => {
        const trimmed = String(styleValue || "")
          .trim()
          .replace(/;?\s*$/, "");
        const merged = trimmed
          ? `${trimmed};${JW_STONE_SEO_CLIENT_SUPPRESS}`
          : JW_STONE_SEO_CLIENT_SUPPRESS;
        return `style=${quote}${merged}${quote}`;
      }
    );
  }
  return `${attrs} style="${JW_STONE_SEO_CLIENT_SUPPRESS}"`;
}

function suppressSeoSummaryPaint(html: string, marker: RegExp): string {
  return String(html || "").replace(/<main\b([^>]*)>/i, (match, attrs: string) => {
    if (!marker.test(attrs)) return match;
    return `<main${mergeSeoSummaryPaintSuppression(attrs)}>`;
  });
}

/**
 * Keep JW public facts in the initial HTML for browser UAs while preventing a
 * visible system-ui SEO document from flashing before the luxury SPA mounts.
 * Facts remain in the document; presentation is suppressed only for client paint.
 */
export function suppressJwStoneSeoSummaryPaint(html: string): string {
  return suppressSeoSummaryPaint(html, JW_STONE_PUBLIC_DISCOVERY_MARKER);
}

export function suppressPublicSeoSummaryPaint(html: string): string {
  return suppressSeoSummaryPaint(html, FACT_BEARING_PUBLIC_DISCOVERY_MARKER);
}

export function publicSocialMetadataCacheControl(html: string): string | null {
  return SIGNED_SOCIAL_CARD_PATTERN.test(String(html || ""))
    ? "public, max-age=60, must-revalidate"
    : null;
}

export function stripPublicSeoBootPlaceholders(html: string): string {
  return html
    .replace(BOOT_FALLBACK_PATTERN, "")
    .replace(LANDING_FALLBACK_PATTERN, "")
    .replace(NOSCRIPT_FALLBACK_PATTERN, "");
}

function readHtmlMetaContent(html: string, name: string): string | null {
  const match = String(html || "").match(HTML_META_CONTENT_PATTERN(name));
  return match?.[3] ? String(match[3]).trim() : null;
}

function readCanonicalRoute(html: string): string | null {
  const match = String(html || "").match(CANONICAL_LINK_PATTERN);
  const raw = match?.[3] ? String(match[3]).trim() : "";
  if (!raw) return null;
  try {
    return new URL(raw, "https://www.thetradescout.com").pathname || "/";
  } catch {
    return null;
  }
}

export function attachDiscoveryAttributionMeta(html: string): string {
  const source = String(html || "");
  if (
    !isFactBearingPublicDiscoveryHtml(source) ||
    DISCOVERY_ATTRIBUTION_META_PATTERN.test(source)
  ) {
    return source;
  }

  const businessSlug = readHtmlMetaContent(source, "tradescout-business-slug") || "";
  const canonicalRoute = normalizeDiscoveryRouteForBusiness(
    businessSlug,
    readCanonicalRoute(source) || ""
  );
  if (!canonicalRoute) return source;

  const token = issueDiscoveryAttributionToken({
    businessSlug,
    entityType: readHtmlMetaContent(source, "tradescout-business-entity-type") as
      | "business_marketplace"
      | "business_profile",
    canonicalRoute,
  });
  if (!token) return source;

  const tag = `<meta name="tradescout-discovery-attribution" content="${token}" />`;
  return source.replace(/<\/head>/i, `${tag}\n</head>`);
}

/**
 * Server-rendered service pages intentionally ship without the application
 * module graph. This tiny progressive-enhancement bridge gives those pages the
 * same signed discovery-entry and tab-scoped Direct Connect intent evidence as
 * interactive profile themes, without collecting contact data or fingerprinting.
 */
export function attachPublicProfileServiceJourneyScript(html: string): string {
  const source = String(html || "");
  if (
    !PUBLIC_PROFILE_SERVICE_PAGE_MARKER.test(source) ||
    PUBLIC_PROFILE_SERVICE_JOURNEY_MARKER.test(source)
  ) {
    return source;
  }

  const script = `<script data-ts-profile-service-journey="true">
(function () {
  var SESSION_KEY = "tradescout:discovery-session:v1";
  var LANDING_KEY_PREFIX = "tradescout:profile-service-landing:v1:";
  var memorySessionId = "";

  function validSessionId(value) {
    return typeof value === "string" && value.length > 0 && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value);
  }

  function createSessionId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return "discovery-" + window.crypto.randomUUID();
      }
    } catch (_) {}
    return "discovery-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
  }

  function getSessionId() {
    if (validSessionId(memorySessionId)) return memorySessionId;
    try {
      var stored = String(window.sessionStorage.getItem(SESSION_KEY) || "").trim();
      if (validSessionId(stored)) {
        memorySessionId = stored;
        return stored;
      }
      memorySessionId = createSessionId();
      window.sessionStorage.setItem(SESSION_KEY, memorySessionId);
      return memorySessionId;
    } catch (_) {
      memorySessionId = createSessionId();
      return memorySessionId;
    }
  }

  function meta(name) {
    var element = document.querySelector('meta[name="' + name + '"]');
    return element ? String(element.getAttribute("content") || "").trim() : "";
  }

  function canonicalPath() {
    try {
      var link = document.querySelector('link[rel="canonical"]');
      var href = link ? String(link.getAttribute("href") || "") : window.location.href;
      return new URL(href, window.location.href).pathname.replace(/\/{2,}/g, "/") || "/";
    } catch (_) {
      return window.location.pathname || "/";
    }
  }

  function discoveryRoute(profileSlug, path) {
    var profileRoot = "/u/" + profileSlug;
    if (path === profileRoot || path.indexOf(profileRoot + "/") === 0) return path;
    return path === "/" ? profileRoot : profileRoot + path;
  }

  function safeSourceHint() {
    try {
      var value = String(new URLSearchParams(window.location.search).get("utm_source") || "").trim().toLowerCase();
      return /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(value) ? value : undefined;
    } catch (_) {
      return undefined;
    }
  }

  function safeReferrerHost() {
    try {
      return document.referrer ? new URL(document.referrer).hostname.toLowerCase() : undefined;
    } catch (_) {
      return undefined;
    }
  }

  function send(payload, sessionId) {
    try {
      return fetch("/api/analytics/shell", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          "X-Anonymous-Session-Id": sessionId
        },
        body: JSON.stringify(payload)
      }).catch(function () {});
    } catch (_) {}
  }

  var profileSlug = meta("tradescout-business-slug").toLowerCase();
  var entityType = meta("tradescout-business-entity-type");
  var token = meta("tradescout-discovery-attribution");
  var sessionId = getSessionId();
  var route = discoveryRoute(profileSlug, canonicalPath());
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(profileSlug) || entityType !== "business_profile" || !token || !validSessionId(sessionId)) return;

  var landingKey = LANDING_KEY_PREFIX + profileSlug + ":" + route;
  var shouldSendLanding = true;
  try {
    shouldSendLanding = window.sessionStorage.getItem(landingKey) !== "1";
    if (shouldSendLanding) window.sessionStorage.setItem(landingKey, "1");
  } catch (_) {}

  if (shouldSendLanding) {
    send({
      type: "discovery_landing",
      canonicalRoute: route,
      entityType: entityType,
      businessSlug: profileSlug,
      discoveryAttributionToken: token,
      ts: new Date().toISOString(),
      sourceHint: safeSourceHint(),
      referrerHost: safeReferrerHost(),
      anonymousSessionId: sessionId
    }, sessionId);
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || typeof target.closest !== "function") return;
    var link = target.closest('a[href*="/direct-connect"]');
    if (!link) return;
    try {
      var destination = new URL(link.href, window.location.href);
      if (destination.pathname !== "/direct-connect" || destination.searchParams.get("source") !== "profile_service_page") return;
    } catch (_) {
      return;
    }
    send({
      type: "public_profile_direct_connect_opened",
      profileSlug: profileSlug,
      surface: "profile_service_page_cta",
      route: route,
      deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
      anonymousSessionId: sessionId,
      linkageVersion: 1,
      ts: new Date().toISOString()
    }, sessionId);
  }, true);
})();
</script>`;

  return /<\/body>/i.test(source)
    ? source.replace(/<\/body>/i, `${script}\n</body>`)
    : `${source}${script}`;
}

export function preparePublicSeoHtmlForResponse(
  html: string,
  options: { retainSeoSummary: boolean }
): string {
  const upgradedHtml = upgradePublicSocialPreviewHtml(html);
  if (options.retainSeoSummary) {
    return stripPublicSeoBootPlaceholders(upgradedHtml).replace(CLIENT_MODULE_SCRIPT_PATTERN, "");
  }

  return upgradedHtml.replace(SEO_ROOT_SUMMARY_PATTERN, '<div id="root"></div>');
}

export function preparePublicSeoHtmlForUserAgent(html: string, userAgent?: string | null): string {
  const htmlWithDiscoveryAttribution = attachDiscoveryAttributionMeta(html);
  const actor = detectActorFromUserAgent(userAgent);
  const isBot = actor.actorType === "bot";
  const htmlWithJourney = isBot
    ? htmlWithDiscoveryAttribution
    : attachPublicProfileServiceJourneyScript(htmlWithDiscoveryAttribution);
  const upgradedHtml = upgradePublicSocialPreviewHtml(htmlWithJourney);

  // Public facts must not depend on crawler UA retention. Bots keep crawlable
  // visible SSR without client modules; browsers keep the same facts in the
  // initial document while suppressing the SEO chrome until React mounts.
  if (isFactBearingPublicDiscoveryHtml(htmlWithJourney)) {
    if (isBot) {
      return stripPublicSeoBootPlaceholders(upgradedHtml).replace(CLIENT_MODULE_SCRIPT_PATTERN, "");
    }
    return isJwStonePublicDiscoveryHtml(htmlWithJourney)
      ? suppressJwStoneSeoSummaryPaint(upgradedHtml)
      : suppressPublicSeoSummaryPaint(upgradedHtml);
  }

  return preparePublicSeoHtmlForResponse(htmlWithJourney, {
    retainSeoSummary: isBot,
  });
}