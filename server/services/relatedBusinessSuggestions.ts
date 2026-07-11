import { and, eq, or, sql } from "drizzle-orm";
import { db } from "../db";
import { businesses, businessCounties, counties } from "@shared/schema";

/**
 * Awareness-only, contact-gated business matching used to surface verified
 * on-platform businesses next to relevant content (community posts, Scout
 * knowledge). Never exposes phone/email -- only a canonical on-platform
 * profile link -- same contact policy as everywhere else this is used.
 */

const STONE_KEYWORDS = ["stone", "granite", "marble", "quartzite", "quartz", "countertop", "slab"];

const SUPPLIER_KEYWORDS = [
  ...STONE_KEYWORDS,
  "supplier",
  "supply",
  "materials",
  "hardware",
  "lumber",
];

export type RelatedBusinessSuggestion = {
  id: string;
  name: string;
  category: string | null;
  profileUrl: string;
};

function textMentionsSupplierNeed(text: string): boolean {
  const lower = text.toLowerCase();
  return SUPPLIER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Given free text (e.g. a community post's title + content), returns a small
 * list of verified, active, on-platform businesses whose category/services
 * match, scoped to the given county/state when available. Returns an empty
 * array if the text doesn't look like a supplier/materials need, or if no
 * business matches -- callers should treat this as purely additive.
 */
export async function getRelatedBusinessSuggestions(args: {
  text: string;
  countyFips?: string | null;
  stateCode?: string | null;
  limit?: number;
}): Promise<RelatedBusinessSuggestion[]> {
  const text = String(args.text || "");
  if (!textMentionsSupplierNeed(text)) return [];

  const limit = Math.min(5, Math.max(1, args.limit ?? 3));
  const countyFips = args.countyFips ? String(args.countyFips) : null;
  const stateCode = args.stateCode ? String(args.stateCode).toUpperCase() : null;

  try {
    const rows = countyFips
      ? await db
          .select({
            id: businesses.id,
            name: businesses.name,
            slug: businesses.slug,
            profileData: businesses.profileData,
          })
          .from(businesses)
          .innerJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
          .innerJoin(counties, eq(counties.id, businessCounties.countyId))
          .where(and(eq(businesses.status, "active" as any), eq(counties.fips, countyFips)))
          .limit(limit)
      : stateCode
        ? await db
            .select({
              id: businesses.id,
              name: businesses.name,
              slug: businesses.slug,
              profileData: businesses.profileData,
            })
            .from(businesses)
            .leftJoin(businessCounties, eq(businessCounties.businessId, businesses.id))
            .leftJoin(counties, eq(counties.id, businessCounties.countyId))
            .where(
              and(
                eq(businesses.status, "active" as any),
                or(
                  eq(counties.stateCode, stateCode),
                  sql`coalesce(${businesses.profileData} -> 'importExtras' ->> 'state_code', '') = ${stateCode}`
                )
              )
            )
            .limit(limit)
        : [];

    const seen = new Set<string>();
    const suggestions: RelatedBusinessSuggestion[] = [];
    for (const row of rows) {
      if (!row.slug || seen.has(row.id)) continue;
      seen.add(row.id);
      const profile: any = row.profileData || {};
      suggestions.push({
        id: row.id,
        name: row.name,
        category: typeof profile.category === "string" ? profile.category : null,
        profileUrl: `/u/${row.slug}`,
      });
      if (suggestions.length >= limit) break;
    }
    return suggestions;
  } catch (error) {
    console.warn("[relatedBusinessSuggestions] lookup failed", error);
    return [];
  }
}
