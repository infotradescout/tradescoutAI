import { JW_STONE_MEMBER_PRICING_PRODUCT_KEY } from "@shared/jwStoneMemberPricing";
import { pool } from "../db";
import { collectAuthorityRoles, isAdminTierRole } from "../utils/authorityPolicy";
import {
  getStoneInventoryProfileTarget,
  hasStoneInventoryCapability,
  type StoneInventoryProfileTarget,
} from "./stoneInventoryService";

export type JwStonePricingAccessResolution = "internal" | "member" | "none";

type Queryable = Pick<typeof pool, "query">;

export function hasTradeScoutPricingAuthority(user: unknown): boolean {
  const viewer = user as Record<string, unknown> | null;
  if (!viewer) return false;
  return (
    viewer.isAdmin === true ||
    viewer.isSuperAdmin === true ||
    collectAuthorityRoles(viewer).some((role) => isAdminTierRole(role))
  );
}

export async function hasActiveJwStoneBusinessMembership(
  userId: string,
  queryable: Queryable = pool
): Promise<boolean> {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return false;
  // The active JW business membership unlocks pricing. General business
  // verification is a separate product gate, not another pricing prerequisite.
  // Honor legacy pending pricing entitlements, while explicit rejection,
  // suspension and revocation remain blocked.
  const result = await queryable.query(
    `SELECT 1
       FROM profile_account_entitlements entitlement
       INNER JOIN profile_accounts account
         ON account.id = entitlement.profile_account_id
       INNER JOIN profiles target_profile
         ON target_profile.id = account.target_profile_id
       INNER JOIN user_profiles member_business
         ON member_business.id = account.business_profile_id
      WHERE account.owner_user_id = $1
        AND target_profile.slug = 'jw-stone'
        AND account.target_business_id = target_profile.business_id
        AND account.identity_kind = 'business'
        AND account.status = 'active'
        AND member_business.user_id = account.owner_user_id
        AND member_business.user_intent::text = 'business'
        AND member_business.verification_status::text IN ('pending', 'approved')
        AND entitlement.product_key = $2
        AND (entitlement.status = 'active' OR entitlement.status = 'pending_verification')
      LIMIT 1`,
    [normalizedUserId, JW_STONE_MEMBER_PRICING_PRODUCT_KEY]
  );
  return Boolean(result.rows[0]);
}

export async function resolveJwStonePricingAccess(args: {
  userId: string;
  user: unknown;
  target?: StoneInventoryProfileTarget | null;
}): Promise<JwStonePricingAccessResolution> {
  const userId = String(args.userId || "").trim();
  if (!userId) return "none";
  if (hasTradeScoutPricingAuthority(args.user)) return "internal";

  const target =
    args.target === undefined ? await getStoneInventoryProfileTarget("jw-stone") : args.target;
  if (!target) return "none";
  if (
    userId === target.ownerUserId ||
    (await hasStoneInventoryCapability({
      userId,
      target,
      capability: "inventory_read",
    }))
  ) {
    return "internal";
  }

  return (await hasActiveJwStoneBusinessMembership(userId)) ? "member" : "none";
}
