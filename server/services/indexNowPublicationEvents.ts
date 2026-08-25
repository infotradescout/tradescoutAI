import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { buildProfileServiceOfferPath } from "../../shared/profileOfferShare";

type ProfilePublicationRecord = {
  slug?: unknown;
  status?: unknown;
  contentBlocks?: unknown;
  seoMeta?: unknown;
};

type BusinessPublicationRecord = {
  slug?: unknown;
  visibility?: unknown;
};

type ProfileServiceOfferRecord = {
  id?: unknown;
  offerType?: unknown;
  offer_type?: unknown;
  isActive?: unknown;
  is_active?: unknown;
};

function cleanSlug(value: unknown): string {
  return String(value || "").trim();
}

function profileChildPaths(slug: string, contentBlocks: unknown): string[] {
  const canonicalOrigin = "https://www.thetradescout.com";
  const profilePath = `/u/${encodeURIComponent(slug)}`;
  const profileUrl = `${canonicalOrigin}${profilePath}`;

  return buildProfileSitemapUrls({
    profileSlug: slug,
    profileUrl,
    contentBlocks,
  })
    .map((value) => {
      try {
        const url = new URL(value);
        return url.origin === canonicalOrigin ? `${url.pathname}${url.search}` : "";
      } catch {
        return "";
      }
    })
    .filter((value): value is string => Boolean(value));
}

export function collectProfileIndexNowUrls(
  profile: ProfilePublicationRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const slug = cleanSlug(profile?.slug);
  if (!publicEligible || !slug || String(profile?.status || "") !== "published") return [];
  const seoMeta =
    profile?.seoMeta && typeof profile.seoMeta === "object"
      ? (profile.seoMeta as Record<string, unknown>)
      : {};
  if (cleanSlug(seoMeta.customDomain)) {
    // A custom-domain profile has a different canonical host. The platform
    // IndexNow key cannot claim authority for that host.
    return [];
  }

  const profilePath = `/u/${encodeURIComponent(slug)}`;
  return [...new Set([profilePath, ...profileChildPaths(slug, profile?.contentBlocks)])];
}

export function collectBusinessIndexNowUrls(
  profile: BusinessPublicationRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const slug = cleanSlug(profile?.slug);
  if (!publicEligible || !slug || String(profile?.visibility || "") !== "public") return [];
  return [`/business/${encodeURIComponent(slug)}`];
}

export function collectProfileServiceOfferIndexNowUrls(
  offer: ProfileServiceOfferRecord | null | undefined,
  publicEligible: boolean
): string[] {
  const offerType = String(offer?.offerType ?? offer?.offer_type ?? "").trim();
  const isActive = offer?.isActive ?? offer?.is_active;
  if (!publicEligible || offerType !== "service" || isActive !== true) return [];

  const path = buildProfileServiceOfferPath(offer?.id);
  return path ? [path] : [];
}

export function combineIndexNowChangeUrls(
  before: Iterable<string>,
  after: Iterable<string>
): string[] {
  return [...new Set([...before, ...after])];
}
