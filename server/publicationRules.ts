import { db } from "./db";
import { tsPublicationRules } from "@shared/schema";
import { normalizePublicationRules, type PublicationRules } from "@shared/publication";
import { eq } from "drizzle-orm";

let cache: { expiresAt: number; rules: PublicationRules } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getPublicationRules(): Promise<PublicationRules> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.rules;

  try {
    const rows = await db
      .select({
        listingStaleDaysUnclaimed: tsPublicationRules.listingStaleDaysUnclaimed,
        listingStaleDaysClaimedUnverified: tsPublicationRules.listingStaleDaysClaimedUnverified,
        listingStaleDaysVerified: tsPublicationRules.listingStaleDaysVerified,
        requestPublicSummaryTtlHours: tsPublicationRules.requestPublicSummaryTtlHours,
        categoryPageRecencyWindowDays: tsPublicationRules.categoryPageRecencyWindowDays,
        proofMediaTtlDays: tsPublicationRules.proofMediaTtlDays,
      })
      .from(tsPublicationRules)
      .where(eq(tsPublicationRules.id, "default"))
      .limit(1);

    const row = rows[0] as any;
    const rules = normalizePublicationRules(row || null);
    cache = { expiresAt: now + CACHE_TTL_MS, rules };
    return rules;
  } catch (error: any) {
    const rules = normalizePublicationRules(null);
    cache = { expiresAt: now + CACHE_TTL_MS, rules };
    return rules;
  }
}

export function invalidatePublicationRulesCache() {
  cache = null;
}
