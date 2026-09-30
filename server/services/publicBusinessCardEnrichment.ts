import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import {
  normalizePublicBusinessPreviewImage,
  type PublicBusinessProfilePreview,
  type PublicDirectoryBusiness,
} from "@shared/publicBusinessCard";
import { sanitizePublicProfileText } from "@shared/publicListingSafety";
import { resolveProfileSocialPresentation } from "@shared/profileSocialPreview";
import { createProfileGalleryItemShareMetadata, listProfileGalleryItems } from "@shared/profileGalleryShare";
import { shouldIndexPublicProfileSlug } from "@shared/publicProfileIndexing";
import { buildProfileSitemapUrls } from "../profileSitemapDiscovery";
import { db } from "../db";
import { canUseLinkedProfileAsCanonicalBusinessRoute } from "./canonicalBusinessProfileRoute";
import { durableProfessionalProfileApprovalSql } from "./profileTargetAuthority";

const ORIGIN = "https://www.thetradescout.com";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type ProfileRow = Record<string, unknown>;

/** Rows must come from the published-profile query below, ordered newest first within each business. */
export function buildPublicBusinessProfilePreviews(
  items: readonly PublicDirectoryBusiness[],
  rows: readonly ProfileRow[]
): Map<string, PublicBusinessProfilePreview> {
  const requested = new Map(items.map((item) => [item.id, item.slug]));
  const previews = new Map<string, PublicBusinessProfilePreview>();
  for (const row of rows) {
    const businessId = typeof row.businessId === "string" ? row.businessId : "";
    const profileSlug = typeof row.slug === "string" ? row.slug : "";
    if (
      !requested.has(businessId) || requested.get(businessId) !== row.businessSlug ||
      previews.has(businessId) || row.profileStatus !== "published" ||
      profileSlug.length > 120 || !SLUG.test(profileSlug) ||
      !shouldIndexPublicProfileSlug(profileSlug) ||
      !canUseLinkedProfileAsCanonicalBusinessRoute(row)
    ) continue;

    const seo = row.profileSeoMeta && typeof row.profileSeoMeta === "object" && !Array.isArray(row.profileSeoMeta)
      ? row.profileSeoMeta as Record<string, unknown> : {};
    const profileName = sanitizePublicProfileText(row.profileDisplayName, 200) || "Business profile";
    const social = resolveProfileSocialPresentation({
      brandName: profileName,
      logoUrl: seo.faviconUrl,
      profileImageUrl: seo.imageUrl,
      contentBlocks: row.profileContentBlocks,
    });
    const profileUrl = `${ORIGIN}/u/${encodeURIComponent(profileSlug)}`;
    const governedUrls = new Set(buildProfileSitemapUrls({
      profileSlug, profileUrl, contentBlocks: row.profileContentBlocks,
    }));
    const gallery: PublicBusinessProfilePreview["gallery"] = [];
    const seen = new Set<string>();
    for (const item of listProfileGalleryItems(row.profileContentBlocks)) {
      const imageUrl = normalizePublicBusinessPreviewImage(item.imageUrl);
      if (!imageUrl || seen.has(imageUrl)) continue;
      const metadata = createProfileGalleryItemShareMetadata({
        profileName, profileUrl, assetOrigin: ORIGIN,
        contentBlocks: row.profileContentBlocks, itemSlug: item.slug,
      });
      if (!metadata || !governedUrls.has(metadata.canonical)) continue;
      const destination = new URL(metadata.canonical);
      if (destination.origin !== ORIGIN || !destination.pathname.startsWith(`/u/${profileSlug}/`)) continue;
      seen.add(imageUrl);
      gallery.push({
        imageUrl,
        title: sanitizePublicProfileText(item.title, 120) || "Profile photo",
        path: destination.pathname,
      });
      if (gallery.length === 3) break;
    }
    previews.set(businessId, {
      businessId, profileSlug,
      headline: sanitizePublicProfileText(row.profileHeadline, 180),
      logoUrl: normalizePublicBusinessPreviewImage(social.logoUrl),
      coverImageUrl: normalizePublicBusinessPreviewImage(social.profileImageUrl) || gallery[0]?.imageUrl || null,
      gallery,
    });
  }
  return previews;
}

/** One bounded batch per page, not a public-profile request for every card. No writes or provider calls. */
export async function enrichPublicBusinessCards(items: PublicDirectoryBusiness[]): Promise<PublicDirectoryBusiness[]> {
  if (!items.length) return items;
  const ids = [...new Set(items.map((item) => item.id))];
  if (ids.length > 50) throw new Error("Public business-card page exceeds its existing limit");
  const rows = await db.select({
    profileId: profiles.id,
    profileStatus: profiles.status,
    profilePubliclyReleased: profiles.publiclyReleased,
    slug: profiles.slug,
    profileDisplayName: profiles.displayName,
    profileSeoMeta: profiles.seoMeta,
    profileRoleContext: profiles.roleContext,
    profileHeadline: profiles.headline,
    profileContentBlocks: profiles.contentBlocks,
    businessId: profiles.businessId,
    businessSlug: businesses.slug,
    profileOwnerUserId: profiles.ownerUserId,
    ownerRole: users.role,
    ownerRoles: users.roles,
    ownerVerifiedBadge: users.verifiedBadge,
    ownerVerificationStatus: users.verificationStatus,
    ownerProvider: users.provider,
    ownerPreferences: users.preferences,
    businessStatus: businesses.status,
    businessOwnerUserId: businesses.ownerUserId,
    publicDiscoveryEnabled: businesses.publicDiscoveryEnabled,
    businessSources: businesses.sources,
    businessClaimStatus: businesses.claimStatus,
    professionalRoleApproved: durableProfessionalProfileApprovalSql,
  }).from(profiles)
    .innerJoin(businesses, eq(businesses.id, profiles.businessId))
    .innerJoin(users, eq(users.id, profiles.ownerUserId))
    .where(and(inArray(profiles.businessId, ids), eq(profiles.status, "published")))
    .orderBy(asc(profiles.businessId), sql`${profiles.updatedAt} DESC NULLS LAST`, sql`${profiles.createdAt} DESC NULLS LAST`, asc(profiles.slug));
  const previews = buildPublicBusinessProfilePreviews(items, rows);
  return items.map((item) => ({ ...item, profilePreview: previews.get(item.id) || null }));
}
