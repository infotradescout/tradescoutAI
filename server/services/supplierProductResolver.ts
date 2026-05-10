type ResolvedSupplierProduct = {
  sourceUrl: string;
  host: string;
  title?: string;
  brand?: string;
  sku?: string;
  imageUrl?: string;
  priceCents?: number;
  currency?: string;
  availability?: string;
  status: "resolved" | "partial" | "unavailable";
  message?: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .trim();
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) return value.map(firstString).find(Boolean);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstString(record.name || record.url || record.content);
  }
  return undefined;
}

function toPriceCents(value: unknown): number | undefined {
  const raw = typeof value === "number" ? String(value) : firstString(value);
  if (!raw) return undefined;
  const normalized = raw.replace(/[^0-9.]/g, "");
  if (!normalized) return undefined;
  const dollars = Number(normalized);
  if (!Number.isFinite(dollars) || dollars < 0) return undefined;
  return Math.round(dollars * 100);
}

function safeJsonParse(value: string): unknown | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function htmlMeta(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern)?.[1];
    if (match) return decodeHtml(match);
  }
  return undefined;
}

function htmlTitle(html: string): string | undefined {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? decodeHtml(title.replace(/\s+/g, " ")) : undefined;
}

function flattenJsonLd(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = Array.isArray(record["@graph"]) ? flattenJsonLd(record["@graph"]) : [];
  return [record, ...graph];
}

function isProductNode(node: any): boolean {
  const type = node?.["@type"];
  if (typeof type === "string") return type.toLowerCase().includes("product");
  if (Array.isArray(type)) return type.some((entry) => String(entry).toLowerCase() === "product");
  return false;
}

function productFromJsonLd(html: string) {
  const scripts = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  for (const script of scripts) {
    const parsed = safeJsonParse(decodeHtml(script[1] || ""));
    const product = flattenJsonLd(parsed).find(isProductNode);
    if (!product) continue;
    const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
    return {
      title: firstString(product.name),
      brand: firstString(product.brand),
      sku: firstString(product.sku || product.mpn || product.productID),
      imageUrl: firstString(product.image),
      priceCents: toPriceCents(offers?.price || offers?.lowPrice || offers?.highPrice),
      currency: firstString(offers?.priceCurrency),
      availability: firstString(offers?.availability),
    };
  }
  return {};
}

function assertSafeProductUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Use an http or https URL.");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("Unsupported product URL port.");

  const host = url.hostname.toLowerCase();
  const blockedHosts = new Set(["localhost", "metadata.google.internal"]);
  if (blockedHosts.has(host) || host.endsWith(".local"))
    throw new Error("Unsupported product URL host.");
  if (
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd")
  ) {
    throw new Error("Unsupported product URL host.");
  }
  return url;
}

export async function resolveSupplierProduct(rawUrl: string): Promise<ResolvedSupplierProduct> {
  const url = assertSafeProductUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.8,*/*;q=0.5",
        "User-Agent": "TradeScoutSupplyRun/1.0 (+https://tradescout.app)",
      },
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      return {
        sourceUrl: url.toString(),
        host: url.hostname,
        status: "unavailable",
        message: `Supplier page returned ${response.status}.`,
      };
    }
    if (!contentType.includes("html") && !contentType.includes("json")) {
      return {
        sourceUrl: url.toString(),
        host: url.hostname,
        status: "unavailable",
        message: "Supplier page did not return product-readable content.",
      };
    }

    const html = (await response.text()).slice(0, 1_500_000);
    const jsonLd = productFromJsonLd(html);
    const title = jsonLd.title || htmlMeta(html, "og:title") || htmlTitle(html);
    const imageUrl = jsonLd.imageUrl || htmlMeta(html, "og:image");
    const priceCents = jsonLd.priceCents || toPriceCents(htmlMeta(html, "product:price:amount"));
    const currency = jsonLd.currency || htmlMeta(html, "product:price:currency") || "USD";
    const status =
      title || priceCents || imageUrl
        ? title && priceCents
          ? "resolved"
          : "partial"
        : "unavailable";

    return {
      sourceUrl: url.toString(),
      host: url.hostname,
      title,
      brand: jsonLd.brand,
      sku: jsonLd.sku,
      imageUrl,
      priceCents,
      currency,
      availability: jsonLd.availability,
      status,
      message:
        status === "unavailable"
          ? "Could not read structured product details from this supplier page."
          : undefined,
    };
  } catch (error) {
    return {
      sourceUrl: url.toString(),
      host: url.hostname,
      status: "unavailable",
      message: error instanceof Error ? error.message : "Could not resolve supplier product.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
