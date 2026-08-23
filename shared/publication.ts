export type PublicationRules = {
  listingStaleDaysUnclaimed: number;
  listingStaleDaysClaimedUnverified: number;
  listingStaleDaysVerified: number;
  requestPublicSummaryTtlHours: number;
  categoryPageRecencyWindowDays: number;
  proofMediaTtlDays?: number | null;
};

export type BusinessPublicationTier = "unclaimed" | "claimed_unverified" | "verified";

export type PublicBusinessSignals = {
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
  publicDiscoveryEnabled: boolean;
  countyId?: string | null;
  countyName?: string | null;
  stateCode?: string | null;
  city?: string | null;
  tradeSlug?: string | null;
  hasPublicOfferingFacts: boolean;
  tier: BusinessPublicationTier;
};

export type PublicActivitySignals = {
  id: string;
  activeStatus: boolean;
  occurredAt: Date;
  expiresAt: Date;
};

export type PublicationCheck = { ok: boolean; reason?: string };

function clampDays(value: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(3650, Math.floor(n)));
}

export function normalizePublicationRules(
  rules: Partial<PublicationRules> | null | undefined
): PublicationRules {
  return {
    listingStaleDaysUnclaimed: clampDays(rules?.listingStaleDaysUnclaimed ?? 365, 365),
    listingStaleDaysClaimedUnverified: clampDays(
      rules?.listingStaleDaysClaimedUnverified ?? 180,
      180
    ),
    listingStaleDaysVerified: clampDays(rules?.listingStaleDaysVerified ?? 730, 730),
    requestPublicSummaryTtlHours:
      clampDays((rules?.requestPublicSummaryTtlHours ?? 72) / 24, 3) * 24,
    categoryPageRecencyWindowDays: clampDays(rules?.categoryPageRecencyWindowDays ?? 90, 90),
    proofMediaTtlDays: rules?.proofMediaTtlDays ?? null,
  };
}

function cutoffDate(now: Date, days: number): Date {
  const ms = clampDays(days, days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

export function isPublicAndCrawlableBusinessDetail(
  business: PublicBusinessSignals,
  rules: PublicationRules,
  now: Date
): PublicationCheck {
  if (!business.publicDiscoveryEnabled) return { ok: false, reason: "public_discovery_disabled" };
  if (!business.name || !business.slug) return { ok: false, reason: "missing_identity" };
  if (!business.hasPublicOfferingFacts) return { ok: false, reason: "missing_offering_facts" };
  if (!business.stateCode || !business.countyName)
    return { ok: false, reason: "missing_geography" };
  if (!(business.updatedAt instanceof Date) || Number.isNaN(business.updatedAt.getTime())) {
    return { ok: false, reason: "missing_updated_at" };
  }

  const tier = business.tier;
  const days =
    tier === "verified"
      ? rules.listingStaleDaysVerified
      : tier === "claimed_unverified"
        ? rules.listingStaleDaysClaimedUnverified
        : rules.listingStaleDaysUnclaimed;

  const cutoff = cutoffDate(now, days);
  if (business.updatedAt < cutoff) return { ok: false, reason: "stale" };
  return { ok: true };
}

export function isPublicAndCrawlableBusiness(
  business: PublicBusinessSignals,
  rules: PublicationRules,
  now: Date
): PublicationCheck {
  const detail = isPublicAndCrawlableBusinessDetail(business, rules, now);
  if (!detail.ok) return detail;
  if (!business.tradeSlug) return { ok: false, reason: "missing_trade" };
  return detail;
}

export function isPublicAndCrawlableActivity(
  activity: PublicActivitySignals,
  _rules: PublicationRules,
  now: Date
): PublicationCheck {
  if (!activity.activeStatus) return { ok: false, reason: "inactive" };
  if (!(activity.occurredAt instanceof Date) || Number.isNaN(activity.occurredAt.getTime())) {
    return { ok: false, reason: "missing_occurred_at" };
  }
  if (!(activity.expiresAt instanceof Date) || Number.isNaN(activity.expiresAt.getTime())) {
    return { ok: false, reason: "missing_expires_at" };
  }
  if (activity.expiresAt <= now) return { ok: false, reason: "expired" };
  return { ok: true };
}
