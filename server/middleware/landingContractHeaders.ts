import type { NextFunction, Request, Response } from "express";
import { getLandingIntentContractForPath } from "../services/crawlerTelemetryService";
import {
  attachPublicProfileServiceLinks,
  handlePublicProfileServiceRequest,
  isPublicProfileServicePath,
} from "../publicProfileServiceHtml";

const LEGACY_COMMERCE_PATH_PATTERN = /^\/(?:collections|products)(?:\/|$)/i;
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

  // Platform-host profile roots advertise the same fact-bearing service set
  // that their sitemap and service routes publish. Custom domains expose the
  // same set through their host-local sitemap and llms.txt because their root
  // response is intentionally served by the earlier domain-authority layer.
  try {
    await attachPublicProfileServiceLinks(req, res);
  } catch (error) {
    console.warn("[ProfileService] Failed attaching profile service links:", error);
  }

  return next();
}
