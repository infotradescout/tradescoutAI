import { useEffect } from "react";

interface PageHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export function PageHead({
  title = "TradeScout | Connection Without Compromise",
  description = "TradeScout is the authority-first operating system for local work. Connection without compromise.",
  keywords = "scout, local helper, contractors, home improvement, quotes, local contractors, verified contractors",
  ogImage = "/tradescout-logo.png?v=3",
  canonicalUrl,
}: PageHeadProps) {
  const currentUrl = normalizePublicUrl(window.location.href);
  const resolvedCanonical = normalizePublicUrl(canonicalUrl || currentUrl);
  const imageUrl = resolveAssetUrl(ogImage, resolvedCanonical);

  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    updateMetaTag("description", description);
    updateMetaTag("og:title", title, "property");
    updateMetaTag("og:description", description, "property");
    updateMetaTag("og:url", resolvedCanonical, "property");
    updateMetaTag("og:image", imageUrl, "property");
    updateMetaTag("twitter:title", title);
    updateMetaTag("twitter:description", description);
    updateMetaTag("twitter:image", imageUrl);

    updateLinkTag("canonical", resolvedCanonical);
  }, [title, description, keywords, resolvedCanonical, imageUrl]);

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

function resolveAssetUrl(assetPath: string, baseUrl: string) {
  try {
    return normalizePublicUrl(new URL(assetPath, baseUrl).toString());
  } catch {
    return assetPath;
  }
}
