import { storage } from "../storage";
import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/** Query-time counterpart of the canonical sale-exposure gate, before LIMIT. */
export function exposureAuthoritySqlPredicate(userId: SQLWrapper): SQL {
  return sql`EXISTS (
    SELECT 1 FROM users exposure_user
    WHERE exposure_user.id = ${userId}
      AND exposure_user.email_verified = true
      AND (exposure_user.address_verified = true
        OR lower(COALESCE(exposure_user.verification_status, '')) IN ('approved', 'verified')
        OR EXISTS (SELECT 1 FROM business_verifications exposure_verification
          WHERE exposure_verification.provider_user_id = exposure_user.id
            AND exposure_verification.status = 'approved'
            AND exposure_verification.verification_type IN ('license', 'insurance', 'ein')
            AND (exposure_verification.expires_at IS NULL OR exposure_verification.expires_at > now())))
  )`;
}

/**
 * Canonical Trust/CVS-adjacent exposure decision shared by public catalogs.
 * This grants visibility only; contact remains separately gated.
 */
export async function buildExposureAuthorityMap(
  userIds: Array<string | null | undefined>
): Promise<Record<string, boolean>> {
  const uniqueUserIds = Array.from(
    new Set(userIds.map((value) => String(value || "").trim()).filter((value) => value.length > 0))
  );

  const authorityByUserId: Record<string, boolean> = {};
  if (!uniqueUserIds.length) return authorityByUserId;

  for (const userId of uniqueUserIds) authorityByUserId[userId] = false;

  const [users, verificationSummary] = await Promise.all([
    storage.getUsersByIds(uniqueUserIds),
    storage.getUserVerificationSummary(uniqueUserIds),
  ]);

  const userMap = new Map<string, any>();
  for (const user of users || []) {
    const userId = String((user as any)?.id || "").trim();
    if (userId) userMap.set(userId, user);
  }

  for (const userId of uniqueUserIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    const summary = verificationSummary?.[userId] ?? {
      hasLicense: false,
      hasInsurance: false,
      hasEin: false,
    };
    const verificationStatus = String((user as any)?.verificationStatus || "").toLowerCase();
    const hasIdentityGate = verificationStatus === "approved" || verificationStatus === "verified";
    const hasBusinessGate =
      summary.hasLicense === true || summary.hasInsurance === true || summary.hasEin === true;
    const hasAddressGate = (user as any)?.addressVerified === true;
    const hasEmailGate = (user as any)?.emailVerified === true;

    authorityByUserId[userId] = Boolean(
      hasEmailGate && (hasAddressGate || hasIdentityGate || hasBusinessGate)
    );
  }

  return authorityByUserId;
}

export async function hasExposureAuthority(userId: string): Promise<boolean> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;
  const authorityByUserId = await buildExposureAuthorityMap([normalizedUserId]);
  return authorityByUserId[normalizedUserId] === true;
}
