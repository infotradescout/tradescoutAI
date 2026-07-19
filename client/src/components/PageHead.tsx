import { useEffect } from "react";
import { formatTradeScoutTitle, TRADESCOUT_BRAND_NAME } from "@shared/brand";

interface PageHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export function PageHead({
  title = "TradeScout | Connection Without Compromise",
  description = "TradeScout helps people find trusted local help, make decisions, and move work forward. Connection without compromise.",
  keywords = "scout, local helper, local businesses, direct connect, exchange, local services, local products, business profiles",
  ogImage = "/tradescout-social-preview.png?v=12",
  canonicalUrl,
}: PageHeadProps) {
  const currentUrl = normalizePublicUrl(stripUrlVariantsForCanonical(window.location.href));
  const resolvedCanonical = normalizePublicUrl(
    stripUrlVariantsForCanonical(canonicalUrl || currentUrl)
  );
  const imageUrl = resolveAssetUrl(ogImage, resolvedCanonical);
  const formattedTitle = formatTradeScoutTitle(title);

  useEffect(() => {
    // Update document title
    document.title = formattedTitle;

    // Update meta tags
    updateMetaTag("description", description);
    updateMetaTag("keywords", keywords);
    updateMetaTag("og:title", formattedTitle, "property");
    updateMetaTag("og:description", description, "property");
    updateMetaTag("og:url", resolvedCanonical, "property");
    updateMetaTag("og:image", imageUrl, "property");
    updateMetaTag("og:site_name", TRADESCOUT_BRAND_NAME, "property");
    updateMetaTag("twitter:title", formattedTitle);
    updateMetaTag("twitter:description", description);
    updateMetaTag("twitter:image", imageUrl);

    updateLinkTag("canonical", resolvedCanonical);
  }, [formattedTitle, description, keywords, resolvedCanonical, imageUrl]);

  return null;
}

function updateMetaTag(name: string, content: string, attribute: string = "name") {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function updateLinkTag(rel: string, href: string) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

function normalizePublicUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (isLocal) return parsed.toString();

    const isTradeScoutHost =
      host === "thetradescout.com" ||
      host === "www.thetradescout.com" ||
      host === "tradescoutai.onrender.com";

    if (isTradeScoutHost) {
      parsed.protocol = "https:";
      parsed.hostname = "www.thetradescout.com";
      parsed.port = "";
      return parsed.toString();
    }

    if (parsed.protocol === "http:") parsed.protocol = "https:";
    return parsed.toString();
  } catch {
    return url;
  }
}

function stripUrlVariantsForCanonical(url: string) {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function resolveAssetUrl(assetPath: string, baseUrl: string) {
  try {
    return normalizePublicUrl(new URL(assetPath, baseUrl).toString());
  } catch {
    return assetPath;
  }
}
