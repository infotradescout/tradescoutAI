const HANDMADE_PRODUCT_ID_PATTERN = /^[a-z0-9_-]{1,128}$/i;
const MAX_HANDMADE_PRODUCT_IMAGES = 12;

type HandmadeProductImageSource = {
  primaryImageUrl?: unknown;
  images?: unknown;
};

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePublicImageReference(value: unknown): string | null {
  const candidate = cleanString(value);
  if (!candidate || /[\r\n\\]/.test(candidate)) return null;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeHandmadeProductId(value: unknown): string | null {
  const productId = cleanString(value);
  return HANDMADE_PRODUCT_ID_PATTERN.test(productId) ? productId : null;
}

export function buildHandmadeProductPath(value: unknown): string | null {
  const productId = normalizeHandmadeProductId(value);
  return productId ? `/handmade/products/${encodeURIComponent(productId)}` : null;
}

export function listHandmadeProductImageUrls(source: HandmadeProductImageSource): string[] {
  const candidates = [
    source?.primaryImageUrl,
    ...(Array.isArray(source?.images) ? source.images : []),
  ];

  const images: string[] = [];
  for (const candidate of candidates) {
    const imageUrl = normalizePublicImageReference(candidate);
    if (!imageUrl || images.includes(imageUrl)) continue;
    images.push(imageUrl);
    if (images.length >= MAX_HANDMADE_PRODUCT_IMAGES) break;
  }
  return images;
}
