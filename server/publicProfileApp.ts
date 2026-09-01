import { storage } from "./storage";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import {
  buildPublicProfileAppIconPath,
  normalizePublicProfileAppSlug,
} from "@shared/publicProfileApp";

export type PublicProfileAppIdentity = {
  slug: string;
  displayName: string;
  shortName: string;
  description: string;
  logoUrl: string | null;
  accentColor: string;
  customDomain: string | null;
};

export type PublicProfileWebAppManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  orientation: "portrait";
  theme_color: string;
  background_color: string;
  icons: Array<{
    src: string;
    sizes: "192x192" | "512x512";
    type: "image/png";
    purpose: "any maskable";
  }>;
  categories: string[];
  launch_handler: { client_mode: "focus-existing" };
};

function cleanText(value: unknown, maxLength: number): string {
  return sanitizePublicProfileText(value, maxLength)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function machineValue(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, maxLength);
  return /[\u0000-\u001f\u007f]/.test(candidate) ? "" : candidate;
}

function normalizePublicAssetReference(value: unknown): string | null {
  const candidate = machineValue(value, 2048);
  if (!candidate || /[\\\0]/.test(candidate)) return null;

  try {
    const parsed = new URL(candidate, "https://www.thetradescout.com");
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.pathname.startsWith("/") ? candidate : null;
  } catch {
    return null;
  }
}

function normalizeCustomDomain(value: unknown): string | null {
  const candidate = machineValue(value, 253).toLowerCase();
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(candidate)
    ? candidate
    : null;
}

function shortenName(value: string, maxLength = 30): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength).trimEnd();
  const wordBoundary = clipped.lastIndexOf(" ");
  return wordBoundary >= 12 ? clipped.slice(0, wordBoundary) : clipped;
}

function normalizeColor(value: unknown, fallback: string): string {
  const candidate = cleanText(value, 16);
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function normalizeOrigin(value: unknown): URL | null {
  try {
    const parsed = new URL(String(value || ""));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function resolvePublicProfileAppIdentity(
  requestedSlug: unknown
): Promise<PublicProfileAppIdentity | null> {
  const slug = normalizePublicProfileAppSlug(requestedSlug);
  if (!slug) return null;

  const profile = await storage.getProfileBySlugPublic(slug);
  if (!profile) return null;
  const business = profile.businessId
    ? await storage.getBusinessPublicById(profile.businessId)
    : null;
  const displayName = cleanText(business?.name || profile.displayName, 100) || "Public profile";
  const description =
    cleanText(
      profile.seoMeta?.description ||
        profile.headline ||
        profile.servicesDescription ||
        profile.roleContext,
      240
    ) || `Open ${displayName}'s public profile.`;
  const logoUrl = normalizePublicAssetReference(
    profile.seoMeta?.faviconUrl || profile.seoMeta?.imageUrl
  );
  const customDomain = normalizeCustomDomain(profile.seoMeta?.customDomain);

  return {
    slug,
    displayName,
    shortName: shortenName(displayName),
    description,
    logoUrl,
    accentColor: normalizeColor(
      business?.brandColors?.accent || business?.brandColors?.primary,
      "#f97316"
    ),
    customDomain,
  };
}

export function createPublicProfileWebAppManifest(args: {
  identity: PublicProfileAppIdentity;
  origin: string;
}): PublicProfileWebAppManifest | null {
  const origin = normalizeOrigin(args.origin);
  if (!origin) return null;
  const { identity } = args;
  const isCustomDomain =
    Boolean(identity.customDomain) && origin.hostname.toLowerCase() === identity.customDomain;
  const profilePath = isCustomDomain ? "/" : `/u/${encodeURIComponent(identity.slug)}`;
  const icon192 = buildPublicProfileAppIconPath(identity.slug, 192);
  const icon512 = buildPublicProfileAppIconPath(identity.slug, 512);
  if (!icon192 || !icon512) return null;

  return {
    id: `/profile-apps/${encodeURIComponent(identity.slug)}`,
    name: identity.displayName,
    short_name: identity.shortName,
    description: identity.description,
    start_url: `${profilePath}${profilePath.includes("?") ? "&" : "?"}entry=profile_app`,
    scope: profilePath,
    display: "standalone",
    orientation: "portrait",
    theme_color: identity.accentColor,
    background_color: "#07100c",
    icons: [
      {
        src: icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["business", "productivity"],
    launch_handler: { client_mode: "focus-existing" },
  };
}

export async function buildPublicProfileWebAppManifest(args: {
  slug: unknown;
  origin: string;
}): Promise<PublicProfileWebAppManifest | null> {
  const identity = await resolvePublicProfileAppIdentity(args.slug);
  if (!identity) return null;
  return createPublicProfileWebAppManifest({ identity, origin: args.origin });
}
