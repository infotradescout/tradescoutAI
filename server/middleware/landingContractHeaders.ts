import type { NextFunction, Request, Response } from "express";
import { getLandingIntentContractForPath } from "../services/crawlerTelemetryService";
import {
  attachPublicProfileServiceLinks,
  handlePublicProfileServiceRequest,
  isPublicProfileServicePath,
} from "../publicProfileServiceHtml";
import {
  handlePublicProfileServiceAreaRequest,
  isPublicProfileServiceAreaPath,
} from "../publicProfileServiceAreaHtml";
import { attachPublicProfileServiceAreaLink } from "../publicProfileServiceAreaLinks";
import { attachPublicDirectoryProfileServiceLinks } from "../publicDirectoryProfileServiceLinks";
import {
  attachPublicProfileImageSitemapReferences,
  handlePublicProfileImageSitemapRequest,
} from "../profileImageSitemap";
import { handlePublicFaviconFallback } from "../publicFaviconFallback";

const LEGACY_COMMERCE_PATH_PATTERN = /^\/(?:collections|products)(?:\/|$)/i;
const PROFILE_IMAGE_SITEMAP_PATHS = new Set([
  "/sitemap-profile-images.xml",
  "/landing/profile-images.xml",
]);
const LEGACY_QUERY_KEYS = [
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  return typeof value === "string" ? value.trim().slice(0, 200) : "";
}

function legacyCommerceRedirectTarget(req: Request): string {
  const params = new URLSearchParams();
  for (const key of LEGACY_QUERY_KEYS) {
    const value = firstQueryValue(req.query?.[key]);
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/trade-deals?${query}` : "/trade-deals";
}

export async function landingContractHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const method = String(req.method || "").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return next();
  }

  const requestPath = String(req.path || "").trim();
  if (!requestPath || requestPath.startsWith("/api/")) {
    return next();
  }

  const contract = getLandingIntentContractForPath(requestPath);
  res.setHeader("X-TradeScout-Intent-Stage", contract.intentStage);
  res.setHeader("X-TradeScout-Audience-Hint", contract.audienceHint);
  res.setHeader("X-TradeScout-Knowledge-Hint", contract.knowledgeHint);
  res.setHeader("X-TradeScout-Action-Hint", contract.actionHint);

  // Keep the conventional icon URL healthy on TradeScout and mapped profile
  // domains even when a browser ignores the page-declared profile favicon.
  if (handlePublicFaviconFallback(req, res)) return;

  // Image discovery uses the same governed child-page graph as public routes,
  // sitemaps, IndexNow, and production audits. Platform and verified profile
  // custom-domain feeds are served without creating another application.
  try {
    if (await handlePublicProfileImageSitemapRequest(req, res)) return;
    attachPublicProfileImageSitemapReferences(req, res);
  } catch (error) {
    console.warn("[ProfileImageSitemap] Failed building public image sitemap:", error);
    if (PROFILE_IMAGE_SITEMAP_PATHS.has(requestPath.replace(/\/+$/, "") || "/")) {
      res
        .status(503)
        .type("text/plain")
        .send("Public profile image sitemap is temporarily unavailable.\n");
      return;
    }
  }

  // One substantial service-area hub is resolved before the SPA catch-all.
  // It uses only profile-published service areas and fact-bearing services,
  // never manufactured service-by-city combinations.
  if (isPublicProfileServiceAreaPath(requestPath)) {
    const handled = await handlePublicProfileServiceAreaRequest(req, res);
    if (handled) return;
  }

  // Fact-bearing profile service pages are resolved before the profile SPA
  // route and before the generic landing-page namespace. This also covers a
  // verified profile custom domain through its reserved /landing/service path.
  if (isPublicProfileServicePath(requestPath)) {
    const handled = await handlePublicProfileServiceRequest(req, res);
    if (handled) return;
  }

  // The browser router has always treated old storefront collection and
  // product URLs as aliases for TradeDeals. Resolve that compatibility rule
  // before the SPA catch-all so crawlers and link unfurlers receive one durable
  // permanent redirect instead of indexing every obsolete storefront path as
  // a separate successful TradeScout page.
  if (LEGACY_COMMERCE_PATH_PATTERN.test(requestPath)) {
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.redirect(301, legacyCommerceRedirectTarget(req));
  }

  // Profile roots and local directory pages advertise the exact governed
  // public graph. Directory business links resolve to canonical profiles and
  // their fact-bearing services instead of stopping at a generic alias route.
  try {
    await attachPublicDirectoryProfileServiceLinks(req, res);
    await attachPublicProfileServiceLinks(req, res);
    await attachPublicProfileServiceAreaLink(req, res);
  } catch (error) {
    console.warn("[ProfileDiscovery] Failed attaching profile discovery links:", error);
  }

  return next();
}
