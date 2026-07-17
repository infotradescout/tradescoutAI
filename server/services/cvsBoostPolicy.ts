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

export async function getActiveCvsBoostPoints(userId: string): Promise<number> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return 0;

  const result: any = await pool.query(
    `
      SELECT COALESCE(SUM((g.metadata ->> 'points')::numeric), 0)::numeric AS boost_points
      FROM trust_ledger_events g
      WHERE g.entity_type = $1
        AND g.entity_id = $2
        AND g.event_type = $3
        AND g.verification_level = 'system_verified'
        AND COALESCE(g.metadata ->> 'points', '') ~ '^[0-9]+(\\.[0-9]+)?$'
        AND (g.metadata ->> 'points')::numeric > 0
        AND (
          COALESCE(g.metadata ->> 'expiresAt', '') = ''
          OR (
            (g.metadata ->> 'expiresAt') ~ '^\\d{4}-\\d{2}-\\d{2}T'
            AND (g.metadata ->> 'expiresAt')::timestamptz > NOW()
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM trust_ledger_events r
          WHERE r.entity_type = g.entity_type
            AND r.entity_id = g.entity_id
            AND r.event_type = $4
            AND r.metadata ->> 'grantKey' = g.metadata ->> 'grantKey'
        )
    `,
    [CVS_BOOST_ENTITY_TYPE, normalizedUserId, CVS_BOOST_GRANTED_EVENT, CVS_BOOST_REVOKED_EVENT]
  );
  const points = Number(result.rows?.[0]?.boost_points ?? 0);
  return Number.isFinite(points) && points > 0 ? points : 0;
}
