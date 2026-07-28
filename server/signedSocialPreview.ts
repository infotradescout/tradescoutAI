import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import {
  renderSocialPreviewCard,
  type SocialPreviewCardContext,
} from "./socialPreviewCardRenderer";

const SIGNED_SOCIAL_PREVIEW_VERSION = 3;
const CANONICAL_SOCIAL_PREVIEW_ORIGIN = "https://www.thetradescout.com";
// PNG cards are commonly 0.5–1 MB. Keep only the hottest signed cards in
// process; CDN/browser caching carries the long-lived load.
const MAX_SIGNED_PREVIEW_CACHE_ENTRIES = 16;
const MAX_TOKEN_LENGTH = 8_000;
const SIGNED_PREVIEW_TTL_SECONDS = 5 * 60;
const SIGNED_PREVIEW_TIME_BUCKET_SECONDS = 5 * 60;
const DEFAULT_DEVELOPMENT_SECRET = "tradescout-social-preview-development-only";
const SIGNING_PURPOSE = "tradescout:social-preview:v3";
const ENCRYPTION_PURPOSE = "tradescout:social-preview:encrypted-context:v1";
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_TAG_BYTES = 16;
const ENCRYPTION_DIGEST_BYTES = 32;

const SOCIAL_PREVIEW_KINDS = new Set<SocialPreviewCardContext["kind"]>([
  "profile",
  "inventory",
  "gallery",
  "business",
  "helper",
  "portfolio",
  "community_post",
  "group",
  "listing",
  "product",
  "property",
  "offer",
  "directory",
  "page",
]);

type SignedSocialPreviewPayload = {
  v: typeof SIGNED_SOCIAL_PREVIEW_VERSION;
  k: SocialPreviewCardContext["kind"];
  t: string;
  b: string;
  e?: string;
  s?: string;
  l?: string;
  c: string;
  i?: string;
  o?: string;
  a?: string;
  r?: string;
  x: number;
};

export type RenderedSignedSocialPreview = {
  context: SocialPreviewCardContext;
  png: Buffer;
  etag: string;
  sourceImageRequested: boolean;
  sourceImageLoaded: boolean;
  expiresAt: number;
};

const signedPreviewCache = new Map<string, Promise<RenderedSignedSocialPreview>>();

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanAssetUrl(value: unknown): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 2_048);
}

function cleanAccentColor(value: unknown): string {
  const color = cleanText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "";
}

function signingSecret(): string {
  const configured = String(
    process.env.SOCIAL_PREVIEW_SIGNING_SECRET || process.env.SESSION_SECRET || ""
  ).trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SOCIAL_PREVIEW_SIGNING_SECRET or SESSION_SECRET is required for signed social previews."
    );
  }
  return DEFAULT_DEVELOPMENT_SECRET;
}

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(ENCRYPTION_PURPOSE)
    .update("\0")
    .update(signingSecret())
    .digest();
}

function signatureFor(payload: string): string {
  return createHmac("sha256", signingSecret())
    .update(SIGNING_PURPOSE)
    .update("\0")
    .update(payload)
    .digest("base64url");
}

function encryptPayload(payload: SignedSocialPreviewPayload): string {
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const masterKey = encryptionKey();
  const digest = createHmac("sha256", masterKey)
    .update("payload\0")
    .update(plaintext)
    .digest();
  const key = createHmac("sha256", masterKey).update("key\0").update(digest).digest();
  const iv = createHmac("sha256", masterKey)
    .update("iv\0")
    .update(digest)
    .digest()
    .subarray(0, ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.concat([Buffer.from(SIGNING_PURPOSE, "utf8"), digest]));
  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);
  return Buffer.concat([digest, cipher.getAuthTag(), encrypted]).toString("base64url");
}

function decryptPayload(value: string): SignedSocialPreviewPayload | null {
  try {
    const encrypted = Buffer.from(value, "base64url");
    if (encrypted.length <= ENCRYPTION_DIGEST_BYTES + ENCRYPTION_TAG_BYTES) return null;
    const digest = encrypted.subarray(0, ENCRYPTION_DIGEST_BYTES);
    const tag = encrypted.subarray(
      ENCRYPTION_DIGEST_BYTES,
      ENCRYPTION_DIGEST_BYTES + ENCRYPTION_TAG_BYTES
    );
    const ciphertext = encrypted.subarray(ENCRYPTION_DIGEST_BYTES + ENCRYPTION_TAG_BYTES);
    const masterKey = encryptionKey();
    const key = createHmac("sha256", masterKey).update("key\0").update(digest).digest();
    const iv = createHmac("sha256", masterKey)
      .update("iv\0")
      .update(digest)
      .digest()
      .subarray(0, ENCRYPTION_IV_BYTES);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.concat([Buffer.from(SIGNING_PURPOSE, "utf8"), digest]));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const expectedDigest = createHmac("sha256", masterKey)
      .update("payload\0")
      .update(plaintext)
      .digest();
    if (!timingSafeEqual(digest, expectedDigest)) return null;
    return JSON.parse(plaintext.toString("utf8")) as SignedSocialPreviewPayload;
  } catch {
    return null;
  }
}

function socialPreviewOrigin(pageOrigin: string): string {
  try {
    const parsed = new URL(pageOrigin);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return parsed.origin;
  } catch {
    // Production cards always use the canonical image host.
  }
  return CANONICAL_SOCIAL_PREVIEW_ORIGIN;
}

function normalizeContext(context: SocialPreviewCardContext): SocialPreviewCardContext | null {
  if (!SOCIAL_PREVIEW_KINDS.has(context.kind)) return null;
  const title = cleanText(context.title, 100);
  const brandName = cleanText(context.brandName, 100);
  const ctaLabel = cleanText(context.ctaLabel, 48);
  if (!title || !brandName || !ctaLabel) return null;

  return {
    kind: context.kind,
    title,
    brandName,
    eyebrow: cleanText(context.eyebrow, 50) || null,
    supportingText: cleanText(context.supportingText, 100) || null,
    locationLabel: cleanText(context.locationLabel, 80) || null,
    ctaLabel,
    sourceImageUrl: cleanAssetUrl(context.sourceImageUrl) || null,
    logoUrl: cleanAssetUrl(context.logoUrl) || null,
    accentColor: cleanAccentColor(context.accentColor) || null,
  };
}

function payloadFor(
  context: SocialPreviewCardContext,
  versionSeed: unknown
): SignedSocialPreviewPayload | null {
  const normalized = normalizeContext(context);
  if (!normalized) return null;
  const currentBucket = Math.floor(
    Math.floor(Date.now() / 1_000) / SIGNED_PREVIEW_TIME_BUCKET_SECONDS
  );
  const expiresAt =
    (currentBucket + SIGNED_PREVIEW_TTL_SECONDS / SIGNED_PREVIEW_TIME_BUCKET_SECONDS + 1) *
    SIGNED_PREVIEW_TIME_BUCKET_SECONDS;
  const rawVersionSeed = String(versionSeed || "").slice(0, 4_096);
  const versionDigest = rawVersionSeed
    ? createHash("sha256").update(rawVersionSeed).digest("base64url").slice(0, 22)
    : "";

  return {
    v: SIGNED_SOCIAL_PREVIEW_VERSION,
    k: normalized.kind,
    t: normalized.title,
    b: normalized.brandName,
    ...(normalized.eyebrow ? { e: normalized.eyebrow } : {}),
    ...(normalized.supportingText ? { s: normalized.supportingText } : {}),
    ...(normalized.locationLabel ? { l: normalized.locationLabel } : {}),
    c: normalized.ctaLabel,
    ...(normalized.sourceImageUrl ? { i: normalized.sourceImageUrl } : {}),
    ...(normalized.logoUrl ? { o: normalized.logoUrl } : {}),
    ...(normalized.accentColor ? { a: normalized.accentColor } : {}),
    ...(versionDigest ? { r: versionDigest } : {}),
    x: expiresAt,
  };
}

function contextFromPayload(payload: SignedSocialPreviewPayload): SocialPreviewCardContext | null {
  if (
    payload?.v !== SIGNED_SOCIAL_PREVIEW_VERSION ||
    !SOCIAL_PREVIEW_KINDS.has(payload.k) ||
    !Number.isSafeInteger(payload.x) ||
    payload.x <= Math.floor(Date.now() / 1_000)
  ) {
    return null;
  }
  return normalizeContext({
    kind: payload.k,
    title: payload.t,
    brandName: payload.b,
    eyebrow: payload.e,
    supportingText: payload.s,
    locationLabel: payload.l,
    ctaLabel: payload.c,
    sourceImageUrl: payload.i,
    logoUrl: payload.o,
    accentColor: payload.a,
  });
}

export function buildSignedSocialPreviewImageUrl(args: {
  pageOrigin: string;
  context: SocialPreviewCardContext;
  versionSeed?: unknown;
}): string | null {
  const payload = payloadFor(args.context, args.versionSeed);
  if (!payload) return null;
  const encodedPayload = encryptPayload(payload);
  const token = `${encodedPayload}.${signatureFor(encodedPayload)}`;
  if (token.length > MAX_TOKEN_LENGTH) return null;
  return new URL(
    `/images/social/card/${token}.png`,
    socialPreviewOrigin(args.pageOrigin)
  ).toString();
}

export function resolveSignedSocialPreviewToken(tokenValue: unknown): {
  context: SocialPreviewCardContext;
  cacheKey: string;
  expiresAt: number;
} | null {
  const token = String(tokenValue || "").trim();
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) return null;
  const encodedPayload = token.slice(0, separatorIndex);
  const suppliedSignature = token.slice(separatorIndex + 1);
  const expectedSignature = signatureFor(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const parsed = decryptPayload(encodedPayload);
    if (!parsed) return null;
    const context = contextFromPayload(parsed);
    if (!context) return null;
    return {
      context,
      cacheKey: createHash("sha256").update(token).digest("hex"),
      expiresAt: parsed.x,
    };
  } catch {
    return null;
  }
}

export async function buildSignedSocialPreview(
  tokenValue: unknown
): Promise<RenderedSignedSocialPreview | null> {
  const resolved = resolveSignedSocialPreviewToken(tokenValue);
  if (!resolved) return null;
  const cached = signedPreviewCache.get(resolved.cacheKey);
  if (cached) return cached;

  const pending = (async () => {
    const rendered = await renderSocialPreviewCard(resolved.context);
    const png = rendered.png;
    return {
      context: resolved.context,
      png,
      etag: `"${createHash("sha256").update(png).digest("hex")}"`,
      sourceImageRequested: rendered.sourceImageRequested,
      sourceImageLoaded: rendered.sourceImageLoaded,
      expiresAt: resolved.expiresAt,
    };
  })()
    .then((preview) => {
      if (preview.sourceImageRequested && !preview.sourceImageLoaded) {
        signedPreviewCache.delete(resolved.cacheKey);
      }
      return preview;
    })
    .catch((error) => {
      signedPreviewCache.delete(resolved.cacheKey);
      throw error;
    });

  signedPreviewCache.set(resolved.cacheKey, pending);
  if (signedPreviewCache.size > MAX_SIGNED_PREVIEW_CACHE_ENTRIES) {
    const oldestKey = signedPreviewCache.keys().next().value;
    if (oldestKey && oldestKey !== resolved.cacheKey) signedPreviewCache.delete(oldestKey);
  }
  return pending;
}

export function clearSignedSocialPreviewCacheForTests(): void {
  signedPreviewCache.clear();
}
