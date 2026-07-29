import { and, eq, sql } from "drizzle-orm";
import { trustLedgerEvents } from "@shared/schema";
import { pool } from "../db";

export const CVS_BOOST_ENTITY_TYPE = "user_cvs";
export const CVS_BOOST_GRANTED_EVENT = "cvs_boost_granted";
export const CVS_BOOST_REVOKED_EVENT = "cvs_boost_revoked";

/**
 * CVS boosts are policy-governed trust modifiers, never purchased promotion.
 * The performance score remains capped at 100; this separate audited layer is
 * the only mechanism allowed to take the displayed CVS total above 100.
 */
export const CVS_BOOST_POLICIES = {
  verified_profile_launch: {
    key: "verified_profile_launch",
    points: 10,
    durationDays: 90,
    label: "Verified profile launch",
    rationale:
      "Temporary launch support for a fully verified, claimed, source-documented local profile.",
  },
  operator_firsthand_attestation: {
    key: "operator_firsthand_attestation",
    points: 5,
    durationDays: 180,
    label: "Firsthand operator attestation",
    rationale:
      "A named TradeScout operator attests to firsthand knowledge of the business, with the relationship disclosed for audit.",
  },
  verified_portfolio_evidence: {
    key: "verified_portfolio_evidence",
    points: 5,
    durationDays: 180,
    label: "Verified portfolio evidence",
    rationale:
      "Five or more attributable completed-work examples were sourced from the business and classified as proof of work.",
  },
} as const;

export type CvsBoostPolicyKey = keyof typeof CVS_BOOST_POLICIES;

export type ActiveCvsBoost = {
  policyKey: string;
  label: string;
  points: number;
  expiresAt: string | null;
};

export const CVS_BOOST_POINTS_CAP = 100;

export async function ensureCvsPolicyBoost(
  tx: any,
  input: {
    userId: string;
    adminActorId?: string | null;
    policyKey: CvsBoostPolicyKey;
    profileSlug: string;
    businessId: string;
    grantedAt?: Date;
    evidence?: Record<string, unknown>;
  }
): Promise<boolean> {
  const policy = CVS_BOOST_POLICIES[input.policyKey];
  const grantKey = `${input.policyKey}:${input.userId}`;
  const [existingGrant] = await tx
    .select({ id: trustLedgerEvents.id })
    .from(trustLedgerEvents)
    .where(
      and(
        eq(trustLedgerEvents.entityType, CVS_BOOST_ENTITY_TYPE),
        eq(trustLedgerEvents.entityId, input.userId),
        eq(trustLedgerEvents.eventType, CVS_BOOST_GRANTED_EVENT),
        sql`${trustLedgerEvents.metadata} ->> 'grantKey' = ${grantKey}`
      )
    )
    .limit(1);
  if (existingGrant) return false;

  const grantedAt = input.grantedAt || new Date();
  const expiresAt = new Date(grantedAt.getTime() + policy.durationDays * 24 * 60 * 60 * 1000);
  await tx.insert(trustLedgerEvents).values({
    actorUserId: input.adminActorId || null,
    entityType: CVS_BOOST_ENTITY_TYPE,
    entityId: input.userId,
    eventType: CVS_BOOST_GRANTED_EVENT,
    sourceSurface: "admin_cvs",
    verificationLevel: "system_verified",
    confidence: "1.000",
    metadata: {
      grantKey,
      policyKey: policy.key,
      policyLabel: policy.label,
      points: policy.points,
      rationale: policy.rationale,
      grantedAt: grantedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      profileSlug: input.profileSlug,
      businessId: input.businessId,
      purchased: false,
      affectsPerformanceScore: false,
      evidence: input.evidence || {},
    },
  });
  return true;
}

export async function getActiveCvsBoosts(
  userId: string,
  asOf: Date = new Date()
): Promise<ActiveCvsBoost[]> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return [];

  if (Number.isNaN(asOf.getTime())) return [];

  const publicPolicyKeys = Object.keys(CVS_BOOST_POLICIES) as CvsBoostPolicyKey[];

  const result: any = await pool.query(
    `
      WITH ranked_grants AS (
        SELECT
          g.entity_id,
          g.metadata ->> 'grantKey' AS grant_key,
          g.metadata ->> 'policyKey' AS policy_key,
          NULLIF(g.metadata ->> 'expiresAt', '') AS expires_at,
          g.created_at,
          g.id,
          ROW_NUMBER() OVER (
            PARTITION BY g.entity_id, g.metadata ->> 'grantKey'
            ORDER BY g.created_at ASC, g.id ASC
          ) AS grant_rank
        FROM trust_ledger_events g
        WHERE g.entity_type = $1
          AND g.entity_id = $2
          AND g.event_type = $3
          AND g.verification_level = 'system_verified'
          AND (g.created_at AT TIME ZONE 'UTC') <= $6::timestamptz
          AND COALESCE(g.metadata ->> 'grantKey', '') <> ''
      )
      SELECT policy_key, expires_at
      FROM ranked_grants g
      WHERE g.grant_rank = 1
        AND g.policy_key = ANY($5::text[])
        AND (
          COALESCE(g.expires_at, '') = ''
          OR (
            g.expires_at ~ '^\\d{4}-\\d{2}-\\d{2}T'
            AND g.expires_at::timestamptz > $6
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM trust_ledger_events r
          WHERE r.entity_type = $1
            AND r.entity_id = g.entity_id
            AND r.event_type = $4
            AND (r.created_at AT TIME ZONE 'UTC') <= $6::timestamptz
            AND r.metadata ->> 'grantKey' = g.grant_key
        )
      ORDER BY created_at ASC, id ASC
    `,
    [
      CVS_BOOST_ENTITY_TYPE,
      normalizedUserId,
      CVS_BOOST_GRANTED_EVENT,
      CVS_BOOST_REVOKED_EVENT,
      publicPolicyKeys,
      asOf,
    ]
  );

  const registryGovernedBoosts = (result.rows || []).flatMap((row: any): ActiveCvsBoost[] => {
    const policyKey = String(row.policy_key || "") as CvsBoostPolicyKey;
    const policy = CVS_BOOST_POLICIES[policyKey];
    if (!policy || policy.points <= 0) return [];

    const rawExpiresAt = String(row.expires_at || "").trim();
    const parsedExpiresAt = rawExpiresAt ? new Date(rawExpiresAt) : null;
    const expiresAt =
      parsedExpiresAt && !Number.isNaN(parsedExpiresAt.getTime())
        ? parsedExpiresAt.toISOString()
        : null;

    // Labels come from the audited policy registry, never free-form ledger
    // metadata. Evidence and operator-only rationale stay private.
    return [{ policyKey, label: policy.label, points: policy.points, expiresAt }];
  });

  // The score SQL caps the audited boost layer at the same boundary. Truncate
  // only the final visible item when necessary so the itemized breakdown and
  // the number included in the score can never disagree.
  let remainingPoints = CVS_BOOST_POINTS_CAP;
  return registryGovernedBoosts.flatMap((boost): ActiveCvsBoost[] => {
    if (remainingPoints <= 0) return [];
    const points = Math.min(boost.points, remainingPoints);
    remainingPoints -= points;
    return [{ ...boost, points }];
  });
}

export async function getActiveCvsBoostPoints(
  userId: string,
  asOf: Date = new Date()
): Promise<number> {
  const boosts = await getActiveCvsBoosts(userId, asOf);
  return boosts.reduce((sum, boost) => sum + boost.points, 0);
}
