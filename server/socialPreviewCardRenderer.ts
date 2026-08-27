import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveJwStonePublicMediaObjectKey } from "@shared/jwStonePublicMedia";
import { resolveRedGranitiPublicMediaObjectKey } from "@shared/redGranitiPublicMedia";
import { readPublicObjectBuffer } from "./publicMediaStorage";

export const SOCIAL_PREVIEW_WIDTH = 1200;
export const SOCIAL_PREVIEW_HEIGHT = 630;

const IMAGE_PANEL_WIDTH = 760;
const COPY_PANEL_X = IMAGE_PANEL_WIDTH;
const COPY_PANEL_WIDTH = SOCIAL_PREVIEW_WIDTH - IMAGE_PANEL_WIDTH;
const MAX_SOURCE_ASSET_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_ASSET_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_INPUT_PIXELS = 20_000_000;
const MAX_LOGO_INPUT_PIXELS = 4_000_000;
const SUPPORTED_PUBLIC_ASSET = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
const SUPPORTED_RASTER_PUBLIC_ASSET = /\.(?:avif|gif|jpe?g|png|webp)$/i;

export const SOCIAL_PREVIEW_RENDER_CONCURRENCY = 2;
export const SOCIAL_PREVIEW_RENDER_QUEUE_LIMIT = 8;
export const SOCIAL_PREVIEW_RENDER_CAPACITY_ERROR_CODE = "SOCIAL_PREVIEW_RENDER_CAPACITY_EXCEEDED";

export class SocialPreviewRenderCapacityError extends Error {
  readonly code = SOCIAL_PREVIEW_RENDER_CAPACITY_ERROR_CODE;

  constructor() {
    super("Social preview renderer is at capacity");
    this.name = "SocialPreviewRenderCapacityError";
  }
}

export type SocialPreviewCardContext = {
  kind:
    | "profile"
    | "inventory"
    | "gallery"
    | "category"
    | "business"
    | "helper"
    | "portfolio"
    | "community_post"
    | "group"
    | "listing"
    | "product"
    | "property"
    | "offer"
    | "directory"
    | "page";
  title: string;
  brandName: string;
  eyebrow?: string | null;
  supportingText?: string | null;
  locationLabel?: string | null;
  ctaLabel: string;
  sourceImageUrl?: string | null;
  logoUrl?: string | null;
  accentColor?: string | null;
  layout?: "split" | "brand-hero";
};

type ServerPublicAssetReader = (key: string, maxBytes: number) => Promise<Buffer | null>;

type RenderSocialPreviewOptions = {
  publicRoots?: string[];
  serverPublicAssetReader?: ServerPublicAssetReader;
};

export type RenderedSocialPreviewCard = {
  png: Buffer;
  sourceImageRequested: boolean;
  sourceImageLoaded: boolean;
};

let sharpPromise: Promise<typeof import("sharp").default> | null = null;
let activeRenderCount = 0;
const pendingRenderQueue: Array<() => void> = [];

function createRenderSlotRelease(): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = pendingRenderQueue.shift();
    if (next) {
      next();
      return;
    }
    activeRenderCount = Math.max(0, activeRenderCount - 1);
  };
}

async function acquireRenderSlot(): Promise<() => void> {
  if (activeRenderCount < SOCIAL_PREVIEW_RENDER_CONCURRENCY) {
    activeRenderCount += 1;
    return createRenderSlotRelease();
  }
  if (pendingRenderQueue.length >= SOCIAL_PREVIEW_RENDER_QUEUE_LIMIT) {
    throw new SocialPreviewRenderCapacityError();
  }
  await new Promise<void>((resolve) => pendingRenderQueue.push(resolve));
  return createRenderSlotRelease();
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeAccentColor(value: unknown): string {
  const candidate = cleanText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : "#f97316";
}

function defaultPublicRoots(): string[] {
  const builtRoot = path.resolve(process.cwd(), "dist/public");
  return process.env.NODE_ENV === "production"
    ? [builtRoot]
    : [builtRoot, path.resolve(process.cwd(), "client/public")];
}

async function getSharp(): Promise<typeof import("sharp").default> {
  if (!sharpPromise) {
    const cacheRoot = path.join(os.tmpdir(), "tradescout-runtime-cache");
    await fs.mkdir(cacheRoot, { recursive: true });
    if (!process.env.XDG_CACHE_HOME) process.env.XDG_CACHE_HOME = cacheRoot;
    sharpPromise = import("sharp").then((module) => module.default);
  }
  return sharpPromise;
}

function pathnameFromPublicAsset(value: unknown, allowSvg: boolean): string | null {
  const candidate = cleanText(value, 2048);
  if (!candidate || /[\r\n\\\0]/.test(candidate)) return null;

  try {
    const parsed = new URL(candidate, "https://www.thetradescout.com");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    const decodedPath = decodeURIComponent(parsed.pathname);
    const supportedPattern = allowSvg ? SUPPORTED_PUBLIC_ASSET : SUPPORTED_RASTER_PUBLIC_ASSET;
    if (!decodedPath.startsWith("/") || !supportedPattern.test(decodedPath)) return null;
    return decodedPath;
  } catch {
    return null;
  }
}

async function readLocalPublicAsset(
  value: unknown,
  publicRoots: string[],
  allowSvg: boolean,
  maxBytes: number
): Promise<Buffer | null> {
  const publicPath = pathnameFromPublicAsset(value, allowSvg);
  if (!publicPath) return null;

  for (const configuredRoot of publicRoots) {
    const root = path.resolve(configuredRoot);
    const candidate = path.resolve(root, `.${publicPath}`);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) continue;

    try {
      const [realRoot, realCandidate] = await Promise.all([
        fs.realpath(root),
        fs.realpath(candidate),
      ]);
      if (realCandidate !== realRoot && !realCandidate.startsWith(`${realRoot}${path.sep}`)) {
        continue;
      }
      const stat = await fs.stat(realCandidate);
      if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) continue;
      const asset = await fs.readFile(realCandidate);
      if (asset.length <= 0 || asset.length > maxBytes) continue;
      return asset;
    } catch {
      // Try the next public root. Missing assets get a branded text fallback.
    }
  }

  return null;
}

function serverPublicMediaObjectKey(value: unknown): string | null {
  const candidate = cleanText(value, 2048);
  if (!candidate || candidate.startsWith("//") || /[\r\n\\\0]/.test(candidate)) return null;

  try {
    const parsed = new URL(candidate, "https://www.thetradescout.com");
    const isRelative = candidate.startsWith("/") && !candidate.startsWith("//");
    const host = parsed.hostname.toLowerCase();
    if (
      !isRelative &&
      host !== "thetradescout.com" &&
      host !== "www.thetradescout.com" &&
      !host.endsWith(".thetradescout.com")
    ) {
      return null;
    }
    const publicPath = pathnameFromPublicAsset(parsed.pathname, true);
    if (!publicPath) return null;
    return (
      resolveJwStonePublicMediaObjectKey(publicPath) ||
      resolveRedGranitiPublicMediaObjectKey(publicPath)
    );
  } catch {
    return null;
  }
}

function configuredRemoteAssetHosts(): Set<string> {
  const hosts = new Set([
    "thetradescout.com",
    "www.thetradescout.com",
    "assets.thetradescout.com",
    "storage.googleapis.com",
  ]);
  for (const value of [
    process.env.PUBLIC_WEB_URL,
    process.env.APP_URL,
    process.env.APP_BASE_URL,
    process.env.R2_PUBLIC_URL,
  ]) {
    try {
      if (value) hosts.add(new URL(value).hostname.toLowerCase());
    } catch {
      // Ignore malformed optional environment values.
    }
  }
  for (const value of String(process.env.SOCIAL_PREVIEW_ASSET_HOSTS || "").split(",")) {
    const host = value.trim().toLowerCase();
    if (/^[a-z0-9.-]+$/.test(host)) hosts.add(host);
  }
  if (process.env.NODE_ENV !== "production") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
  }
  return hosts;
}

function remotePublicAssetUrl(value: unknown): URL | null {
  const candidate = cleanText(value, 2048);
  if (!candidate || /[\r\n\\\0]/.test(candidate)) return null;

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isLocalDevelopmentHost =
      process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1");
    if (parsed.protocol !== "https:" && !(isLocalDevelopmentHost && parsed.protocol === "http:")) {
      return null;
    }
    if (parsed.username || parsed.password) return null;
    if (!configuredRemoteAssetHosts().has(host) && !host.endsWith(".thetradescout.com")) {
      return null;
    }
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (
      decodedPath.startsWith("/images/social/") ||
      (!SUPPORTED_PUBLIC_ASSET.test(decodedPath) &&
        !decodedPath.startsWith("/objects/") &&
        !decodedPath.startsWith("/uploads/"))
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function responseImageBuffer(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.ok || !response.body) return null;
  const contentType = String(response.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") return null;
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return totalBytes > 0 ? Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))) : null;
}

async function readRemotePublicAsset(value: unknown, maxBytes: number): Promise<Buffer | null> {
  const assetUrl = remotePublicAssetUrl(value);
  if (!assetUrl) return null;

  try {
    const response = await fetch(assetUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(4_000),
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/svg+xml",
        "User-Agent": "TradeScout-Social-Preview/1.0",
      },
    });
    return await responseImageBuffer(response, maxBytes);
  } catch {
    return null;
  }
}

function wrapText(value: string, maxCharacters: number, maxLines = 2): string[] {
  const words = cleanText(value, 120).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxCharacters || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }
  if (lines.length < maxLines && current) {
    const remainingWords = words.slice(lines.join(" ").split(/\s+/).filter(Boolean).length);
    const remainder = remainingWords.join(" ") || current;
    lines.push(
      remainder.length <= maxCharacters
        ? remainder
        : `${remainder.slice(0, Math.max(1, maxCharacters - 1)).trimEnd()}…`
    );
  }
  return lines.slice(0, maxLines);
}

function titleTypography(value: string): {
  fontSize: number;
  lineHeight: number;
  lines: string[];
} {
  const title = cleanText(value, 100);
  const fontSize = title.length <= 13 ? 54 : title.length <= 28 ? 44 : 36;
  const maxCharacters = Math.max(10, Math.floor(350 / (fontSize * 0.58)));
  return {
    fontSize,
    lineHeight: Math.round(fontSize * 1.12),
    lines: wrapText(title, maxCharacters, 2),
  };
}

function svgTextLines(args: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  weight: number;
  letterSpacing?: number;
}): string {
  return args.lines
    .map(
      (line, index) =>
        `<text x="${args.x}" y="${args.y + index * args.lineHeight}" fill="${args.color}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${args.fontSize}" font-weight="${args.weight}"${
          args.letterSpacing ? ` letter-spacing="${args.letterSpacing}"` : ""
        }>${escapeXml(line)}</text>`
    )
    .join("");
}

function buildOverlaySvg(context: SocialPreviewCardContext, hasLogo: boolean): Buffer {
  const accent = normalizeAccentColor(context.accentColor);
  const eyebrow = cleanText(context.eyebrow, 50).toUpperCase();
  const brandName = cleanText(context.brandName, 100);
  const supportingText = cleanText(context.supportingText, 100);
  const locationLabel = cleanText(context.locationLabel, 80);
  const ctaLabel = cleanText(context.ctaLabel, 48).toUpperCase();
  const typography = titleTypography(context.title);
  const copyX = COPY_PANEL_X + 48;
  const titleY = hasLogo ? 230 : 205;
  const titleBottom = titleY + Math.max(0, typography.lines.length - 1) * typography.lineHeight;
  const detailY = titleBottom + 62;
  const locationY = detailY + (supportingText ? 38 : 0);
  const ctaY = Math.max(400, locationY + (locationLabel ? 46 : 28));
  const ctaFontSize = ctaLabel.length > 31 ? 15 : 17;
  const logoPanel = hasLogo
    ? `<rect x="${copyX}" y="42" width="344" height="88" rx="14" fill="#f4f1e9" />`
    : svgTextLines({
        lines: wrapText(brandName, 28, 1),
        x: copyX,
        y: 82,
        fontSize: 22,
        lineHeight: 26,
        color: "#cbd5c0",
        weight: 700,
      });
  const eyebrowMarkup = eyebrow
    ? svgTextLines({
        lines: [eyebrow],
        x: copyX,
        y: hasLogo ? 177 : 139,
        fontSize: 17,
        lineHeight: 20,
        color: "#dbe5c3",
        weight: 700,
        letterSpacing: 3,
      })
    : "";
  const supportingMarkup =
    supportingText && supportingText.toLowerCase() !== cleanText(context.title, 100).toLowerCase()
      ? svgTextLines({
          lines: wrapText(supportingText, 29, 1),
          x: copyX,
          y: detailY,
          fontSize: 22,
          lineHeight: 28,
          color: "#c5cabf",
          weight: 500,
        })
      : "";
  const locationMarkup = locationLabel
    ? svgTextLines({
        lines: wrapText(locationLabel, 35, 1),
        x: copyX,
        y: locationY,
        fontSize: 17,
        lineHeight: 22,
        color: "#8f978d",
        weight: 500,
      })
    : "";

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_PREVIEW_WIDTH}" height="${SOCIAL_PREVIEW_HEIGHT}" viewBox="0 0 ${SOCIAL_PREVIEW_WIDTH} ${SOCIAL_PREVIEW_HEIGHT}">
    <rect x="${COPY_PANEL_X}" y="0" width="${COPY_PANEL_WIDTH}" height="${SOCIAL_PREVIEW_HEIGHT}" fill="#0b0f0d" />
    <rect x="${COPY_PANEL_X}" y="0" width="6" height="${SOCIAL_PREVIEW_HEIGHT}" fill="${accent}" />
    ${logoPanel}
    ${eyebrowMarkup}
    ${svgTextLines({
      lines: typography.lines,
      x: copyX,
      y: titleY,
      fontSize: typography.fontSize,
      lineHeight: typography.lineHeight,
      color: "#ffffff",
      weight: 750,
    })}
    ${supportingMarkup}
    ${locationMarkup}
    <rect x="${copyX}" y="${ctaY}" width="344" height="60" rx="30" fill="${accent}" />
    <text x="${copyX + 172}" y="${ctaY + 38}" text-anchor="middle" fill="#ffffff" font-family="DejaVu Sans, Arial, sans-serif" font-size="${ctaFontSize}" font-weight="750">${escapeXml(ctaLabel)}</text>
    <text x="${copyX}" y="568" fill="#8f978d" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="500">TradeScout · Direct Connect</text>
    <text x="${copyX}" y="594" fill="#667067" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" font-weight="600" letter-spacing="1.5">CONNECTION WITHOUT COMPROMISE</text>
  </svg>`);
}

function brandHeroOverlaySvg(context: SocialPreviewCardContext, hasLogo: boolean): Buffer {
  const accent = normalizeAccentColor(context.accentColor);
  const brandName = cleanText(context.brandName, 100);
  const fallbackBrand = hasLogo
    ? ""
    : svgTextLines({
        lines: wrapText(brandName, 24, 2),
        x: 96,
        y: 484,
        fontSize: 44,
        lineHeight: 50,
        color: "#171717",
        weight: 750,
      });

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_PREVIEW_WIDTH}" height="${SOCIAL_PREVIEW_HEIGHT}" viewBox="0 0 ${SOCIAL_PREVIEW_WIDTH} ${SOCIAL_PREVIEW_HEIGHT}">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#07100c" stop-opacity=".08" />
        <stop offset="58%" stop-color="#07100c" stop-opacity=".12" />
        <stop offset="100%" stop-color="#07100c" stop-opacity=".58" />
      </linearGradient>
    </defs>
    <rect width="${SOCIAL_PREVIEW_WIDTH}" height="${SOCIAL_PREVIEW_HEIGHT}" fill="url(#shade)" />
    <rect x="56" y="414" width="680" height="160" rx="24" fill="#f4f1e9" fill-opacity=".97" />
    <rect x="56" y="414" width="9" height="160" rx="4.5" fill="${accent}" />
    ${fallbackBrand}
  </svg>`);
}

function fallbackImageSvg(accentColor: string, width = IMAGE_PANEL_WIDTH): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${SOCIAL_PREVIEW_HEIGHT}">
    <defs>
      <radialGradient id="a" cx="28%" cy="30%" r="72%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity=".62" />
        <stop offset="55%" stop-color="#1c2a24" />
        <stop offset="100%" stop-color="#07100c" />
      </radialGradient>
    </defs>
    <rect width="${width}" height="${SOCIAL_PREVIEW_HEIGHT}" fill="url(#a)" />
    <circle cx="152" cy="136" r="220" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="2" />
    <circle cx="550" cy="510" r="300" fill="none" stroke="#ffffff" stroke-opacity=".06" stroke-width="2" />
  </svg>`);
}

async function renderSocialPreviewCardWithinSlot(
  context: SocialPreviewCardContext,
  options: RenderSocialPreviewOptions = {}
): Promise<RenderedSocialPreviewCard> {
  const sharp = await getSharp();
  const publicRoots = options.publicRoots || defaultPublicRoots();
  const serverPublicAssetReader =
    options.serverPublicAssetReader ||
    ((key: string, maxBytes: number) => readPublicObjectBuffer({ key, maxBytes }));
  const accent = normalizeAccentColor(context.accentColor);
  const isBrandHero = context.layout === "brand-hero";
  const imageWidth = isBrandHero ? SOCIAL_PREVIEW_WIDTH : IMAGE_PANEL_WIDTH;
  const sourceImageRequested = Boolean(cleanText(context.sourceImageUrl, 2048));
  const sourceObjectKey = serverPublicMediaObjectKey(context.sourceImageUrl);
  const logoObjectKey = serverPublicMediaObjectKey(context.logoUrl);
  const [serverSourceAsset, serverLogoAsset] = await Promise.all([
    sourceObjectKey ? serverPublicAssetReader(sourceObjectKey, MAX_SOURCE_ASSET_BYTES) : null,
    logoObjectKey ? serverPublicAssetReader(logoObjectKey, MAX_LOGO_ASSET_BYTES) : null,
  ]);
  const [localSourceAsset, localLogoAsset] = await Promise.all([
    sourceObjectKey
      ? null
      : readLocalPublicAsset(context.sourceImageUrl, publicRoots, false, MAX_SOURCE_ASSET_BYTES),
    logoObjectKey
      ? null
      : readLocalPublicAsset(context.logoUrl, publicRoots, true, MAX_LOGO_ASSET_BYTES),
  ]);
  const [sourceAsset, logoAsset] = await Promise.all([
    sourceObjectKey
      ? serverSourceAsset
      : localSourceAsset || readRemotePublicAsset(context.sourceImageUrl, MAX_SOURCE_ASSET_BYTES),
    logoObjectKey
      ? serverLogoAsset
      : localLogoAsset || readRemotePublicAsset(context.logoUrl, MAX_LOGO_ASSET_BYTES),
  ]);

  let imagePanel: Buffer;
  let sourceImageLoaded = false;
  if (sourceAsset) {
    try {
      imagePanel = await sharp(sourceAsset, {
        failOn: "warning",
        limitInputPixels: MAX_SOURCE_INPUT_PIXELS,
        sequentialRead: true,
      })
        .rotate()
        .resize(imageWidth, SOCIAL_PREVIEW_HEIGHT, {
          fit: context.kind === "inventory" || context.kind === "product" ? "contain" : "cover",
          position: "attention",
          background:
            context.kind === "inventory" || context.kind === "product" ? "#e9e5dc" : "#101914",
        })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      sourceImageLoaded = true;
    } catch {
      imagePanel = await sharp(fallbackImageSvg(accent, imageWidth)).png().toBuffer();
    }
  } else {
    imagePanel = await sharp(fallbackImageSvg(accent, imageWidth)).png().toBuffer();
  }

  let preparedLogo: Buffer | null = null;
  if (logoAsset) {
    try {
      preparedLogo = await sharp(logoAsset, {
        failOn: "warning",
        limitInputPixels: MAX_LOGO_INPUT_PIXELS,
      })
        .resize(isBrandHero ? 570 : 304, isBrandHero ? 120 : 64, {
          fit: "contain",
          background: { r: 244, g: 241, b: 233, alpha: 0 },
        })
        .png()
        .toBuffer();
    } catch {
      preparedLogo = null;
    }
  }

  const composites: Array<{ input: Buffer; left: number; top: number }> = [
    { input: imagePanel, left: 0, top: 0 },
    {
      input: isBrandHero
        ? brandHeroOverlaySvg(context, Boolean(preparedLogo))
        : buildOverlaySvg(context, Boolean(preparedLogo)),
      left: 0,
      top: 0,
    },
  ];
  if (preparedLogo) {
    composites.push(
      isBrandHero
        ? { input: preparedLogo, left: 106, top: 434 }
        : { input: preparedLogo, left: COPY_PANEL_X + 68, top: 54 }
    );
  }

  const png = await sharp({
    create: {
      width: SOCIAL_PREVIEW_WIDTH,
      height: SOCIAL_PREVIEW_HEIGHT,
      channels: 4,
      background: "#0b0f0d",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return {
    png,
    sourceImageRequested,
    sourceImageLoaded,
  };
}

export async function renderSocialPreviewCard(
  context: SocialPreviewCardContext,
  options: RenderSocialPreviewOptions = {}
): Promise<RenderedSocialPreviewCard> {
  const releaseRenderSlot = await acquireRenderSlot();
  try {
    return await renderSocialPreviewCardWithinSlot(context, options);
  } finally {
    releaseRenderSlot();
  }
}

export async function renderSocialPreviewCardPng(
  context: SocialPreviewCardContext,
  options: RenderSocialPreviewOptions = {}
): Promise<Buffer> {
  return (await renderSocialPreviewCard(context, options)).png;
}
