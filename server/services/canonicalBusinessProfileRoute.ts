import { and, asc, eq, sql } from "drizzle-orm";
import { businesses, profiles, users } from "@shared/schema";
import { db } from "../db";

export type CanonicalBusinessProfileRoute = {
  slug: string;
  path: string;
};

/**
 * Resolves the single public profile that owns a claimed business presence.
 * Both SSR requests and SPA API responses use this authority so /business and
 * /u cannot disagree about the canonical destination.
 */
export async function resolveCanonicalBusinessProfileRoute(
  businessSlugValue: unknown
): Promise<CanonicalBusinessProfileRoute | null> {
  const businessSlug = String(businessSlugValue || "").trim();
  if (!businessSlug) return null;

  const [linkedProfile] = await db
    .select({ slug: profiles.slug })
    .from(profiles)
    .innerJoin(businesses, eq(businesses.id, profiles.businessId))
    .innerJoin(users, eq(users.id, profiles.ownerUserId))
    .where(
      and(
        eq(businesses.slug, businessSlug),
        eq(profiles.status, "published" as any),
        sql`COALESCE((${users.preferences} ->> 'profileVisibility'), 'private') = 'public'`
      )
    )
    .orderBy(
      sql`${profiles.updatedAt} DESC NULLS LAST`,
      sql`${profiles.createdAt} DESC NULLS LAST`,
      asc(profiles.slug)
    )
    .limit(1);

  const profileSlug = String(linkedProfile?.slug || "").trim();
  if (!profileSlug) return null;

  return {
    slug: profileSlug,
    path: `/u/${encodeURIComponent(profileSlug)}`,
  };
}
