/* eslint-disable @typescript-eslint/no-explicit-any -- Existing profile and business records use flexible JSON. */
import {
  PROFILE_ACCOUNT_ROLE_LABELS,
  buildProfileAccountReturnPath,
  isProfileAccountBusinessRole,
  isProfileAccountRole,
  profileAccountRoleIncludesBidRock,
  resolveProfileAccountPolicy,
  type ProfileAccountPolicy,
  type ProfileAccountRole,
} from "@shared/profileAccount";
import { pool } from "../db";

const PROFILE_ACCOUNT_DDL = `
CREATE TABLE IF NOT EXISTS profile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  business_profile_id TEXT REFERENCES user_profiles(id) ON DELETE SET NULL,
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  verification_status TEXT NOT NULL DEFAULT 'not_required',
  source_path TEXT,
  resume_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, profile_id),
  CHECK (cardinality(roles) > 0),
  CHECK (status IN ('active', 'suspended', 'closed')),
  CHECK (verification_status IN ('not_required', 'pending', 'approved', 'rejected')),
  CHECK (source_path IS NULL OR (source_path ~ '^/u/' AND source_path NOT LIKE '%\\%')),
  CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'))
);

CREATE INDEX IF NOT EXISTS idx_profile_accounts_profile_status
  ON profile_accounts(profile_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_accounts_user_status
  ON profile_accounts(user_id, status, updated_at DESC);
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureProfileAccountTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool.query(PROFILE_ACCOUNT_DDL).then(() => undefined).catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

type ProfileAccountTarget = {
  profileId: string;
  profileSlug: string;
  profileName: string;
  businessId: string | null;
  contentBlocks: unknown;
};

export type ProfileAccountRecord = Readonly<{
  id: string;
  profileSlug: string;
  profileName: string;
  roles: readonly ProfileAccountRole[];
  status: "active" | "suspended" | "closed";
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
  resumePath: string;
  lastSeenAt: string | null;
  bidRockEligible: boolean;
}>;

export type ProfileAccountState = Readonly<{
  policy: ProfileAccountPolicy;
  account: ProfileAccountRecord | null;
}>;

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function normalizeProfilePath(value: unknown, fallback: string): string {
  const path = String(value || "").trim();
  if (!path.startsWith("/u/") || path.startsWith("//") || path.includes("\\")) return fallback;
  return path.slice(0, 500);
}

function normalizeRoles(value: unknown): ProfileAccountRole[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isProfileAccountRole)));
}

async function loadProfileAccountTarget(
  profileSlug: string,
  client: Pick<typeof pool, "query"> = pool
): Promise<ProfileAccountTarget | null> {
  const normalized = normalizeSlug(profileSlug);
  if (!normalized) return null;
  const result = await client.query(
    `SELECT p.id AS profile_id,
            p.slug AS profile_slug,
            p.display_name AS profile_name,
            p.business_id,
            p.content_blocks
       FROM profiles p
      WHERE p.slug = $1
        AND p.status = 'published'
      LIMIT 1`,
    [normalized]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    profileId: String(row.profile_id),
    profileSlug: String(row.profile_slug),
    profileName: String(row.profile_name || row.profile_slug),
    businessId: row.business_id ? String(row.business_id) : null,
    contentBlocks: row.content_blocks,
  };
}

function policyForTarget(target: ProfileAccountTarget): ProfileAccountPolicy {
  return resolveProfileAccountPolicy({
    profileSlug: target.profileSlug,
    profileName: target.profileName,
    hasBusiness: Boolean(target.businessId),
    contentBlocks: target.contentBlocks,
  });
}

type BusinessProfilePlan = {
  profileBusinessType: "service_provider" | "seller";
  primaryRole: "contractor" | "designer" | "business_owner";
  roles: string[];
  serviceTags: string[];
  sellerTags: string[];
  sellerType: "physical" | "hybrid" | null;
};

function businessProfilePlan(role: ProfileAccountRole): BusinessProfilePlan {
  switch (role) {
    case "fabricator":
      return {
        profileBusinessType: "service_provider",
        primaryRole: "contractor",
        roles: ["contractor", "fabricator"],
        serviceTags: ["stone_fabrication", "countertop_installation"],
        sellerTags: [],
        sellerType: null,
      };
    case "builder_contractor":
      return {
        profileBusinessType: "service_provider",
        primaryRole: "contractor",
        roles: ["contractor", "builder"],
        serviceTags: ["general_contractor", "construction_manager"],
        sellerTags: [],
        sellerType: null,
      };
    case "designer":
      return {
        profileBusinessType: "service_provider",
        primaryRole: "designer",
        roles: ["designer"],
        serviceTags: ["interior_design", "stone_specification"],
        sellerTags: [],
        sellerType: null,
      };
    case "stone_yard_dealer":
      return {
        profileBusinessType: "seller",
        primaryRole: "business_owner",
        roles: ["business_owner", "stone_yard_dealer"],
        serviceTags: [],
        sellerTags: ["stone", "slabs", "countertops"],
        sellerType: "physical",
      };
    case "supplier":
      return {
        profileBusinessType: "seller",
        primaryRole: "business_owner",
        roles: ["business_owner", "stone_supplier"],
        serviceTags: [],
        sellerTags: ["stone", "blocks", "bundles", "containers", "slabs"],
        sellerType: "hybrid",
      };
    default:
      return {
        profileBusinessType: "service_provider",
        primaryRole: "contractor",
        roles: ["contractor", "trade_professional"],
        serviceTags: ["trade_services"],
        sellerTags: [],
        sellerType: null,
      };
  }
}

async function ensurePrivateBusinessPersona(
  client: any,
  userId: string,
  role: ProfileAccountRole
): Promise<{ id: string; verificationStatus: string }> {
  const existing = await client.query(
    `SELECT id, verification_status
       FROM user_profiles
      WHERE user_id = $1
        AND user_intent = 'business'
      ORDER BY (verification_status = 'approved') DESC,
               is_primary DESC NULLS LAST,
               created_at ASC
      LIMIT 1
      FOR UPDATE`,
    [userId]
  );
  if (existing.rows[0]) {
    return {
      id: String(existing.rows[0].id),
      verificationStatus: String(existing.rows[0].verification_status || "pending"),
    };
  }

  const [userResult, profileCountResult] = await Promise.all([
    client.query(`SELECT first_name, last_name, email_verified FROM users WHERE id = $1 LIMIT 1`, [
      userId,
    ]),
    client.query(`SELECT COUNT(*)::int AS count FROM user_profiles WHERE user_id = $1`, [userId]),
  ]);
  const user = userResult.rows[0];
  if (!user) throw new Error("TradeScout identity not found");

  const plan = businessProfilePlan(role);
  const displayName =
    `${String(user.first_name || "").trim()} ${String(user.last_name || "").trim()}`.trim() ||
    `${PROFILE_ACCOUNT_ROLE_LABELS[role]} account`;
  const isPrimary = Number(profileCountResult.rows[0]?.count || 0) === 0;

  const created = await client.query(
    `INSERT INTO user_profiles (
       user_id,
       user_intent,
       profile_business_type,
       service_tags,
       seller_tags,
       seller_type,
       role,
       roles,
       profile_visibility,
       verified_badge,
       trust_score,
       verification_requirements,
       verification_status,
       email_verified,
       is_primary,
       display_name,
       created_at,
       updated_at
     ) VALUES (
       $1,
       'business',
       $2,
       $3::text[],
       $4::text[],
       $5,
       $6,
       $7::text[],
       'private',
       FALSE,
       10,
       '{"email":true,"business_registration":true}'::jsonb,
       'pending',
       $8,
       $9,
       $10,
       NOW(),
       NOW()
     )
     RETURNING id, verification_status`,
    [
      userId,
      plan.profileBusinessType,
      plan.serviceTags,
      plan.sellerTags,
      plan.sellerType,
      plan.primaryRole,
      plan.roles,
      user.email_verified === true,
      isPrimary,
      displayName,
    ]
  );

  return {
    id: String(created.rows[0].id),
    verificationStatus: String(created.rows[0].verification_status || "pending"),
  };
}

function toAccountRecord(
  target: ProfileAccountTarget,
  row: any
): ProfileAccountRecord {
  const roles = normalizeRoles(row.roles);
  return Object.freeze({
    id: String(row.id),
    profileSlug: target.profileSlug,
    profileName: target.profileName,
    roles: Object.freeze(roles),
    status: String(row.status || "active") as ProfileAccountRecord["status"],
    verificationStatus: String(
      row.verification_status || "not_required"
    ) as ProfileAccountRecord["verificationStatus"],
    resumePath:
      normalizeProfilePath(row.resume_path, buildProfileAccountReturnPath({ profileSlug: target.profileSlug })),
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
    bidRockEligible:
      policyForTarget(target).kind === "stone_business" &&
      roles.some((role) => profileAccountRoleIncludesBidRock(role)),
  });
}

export async function getProfileAccountState(args: {
  profileSlug: string;
  userId?: string | null;
}): Promise<ProfileAccountState | null> {
  await ensureProfileAccountTables();
  const target = await loadProfileAccountTarget(args.profileSlug);
  if (!target) return null;
  const policy = policyForTarget(target);
  const userId = String(args.userId || "").trim();
  if (!userId) return Object.freeze({ policy, account: null });

  const result = await pool.query(
    `UPDATE profile_accounts
        SET last_seen_at = NOW(),
            updated_at = NOW()
      WHERE user_id = $1
        AND profile_id = $2
      RETURNING id,
                roles,
                status,
                verification_status,
                resume_path,
                last_seen_at`,
    [userId, target.profileId]
  );

  return Object.freeze({
    policy,
    account: result.rows[0] ? toAccountRecord(target, result.rows[0]) : null,
  });
}

export async function ensureProfileAccount(args: {
  userId: string;
  profileSlug: string;
  role: ProfileAccountRole;
  sourcePath?: string | null;
}): Promise<{ policy: ProfileAccountPolicy; account: ProfileAccountRecord }> {
  await ensureProfileAccountTables();
  const userId = String(args.userId || "").trim();
  if (!userId) throw new Error("Authentication required");
  if (!isProfileAccountRole(args.role)) throw new Error("Choose a valid account type");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await loadProfileAccountTarget(args.profileSlug, client);
    if (!target) throw new Error("Profile account target not found");
    const policy = policyForTarget(target);
    if (!policy.enabled || !policy.roles.includes(args.role)) {
      throw new Error("That account type is not available for this profile");
    }

    const userResult = await client.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!userResult.rows[0]) throw new Error("TradeScout identity not found");

    const businessRole = isProfileAccountBusinessRole(args.role);
    const businessPersona = businessRole
      ? await ensurePrivateBusinessPersona(client, userId, args.role)
      : null;
    const verificationStatus = businessPersona
      ? businessPersona.verificationStatus === "approved"
        ? "approved"
        : businessPersona.verificationStatus === "rejected"
          ? "rejected"
          : "pending"
      : "not_required";
    const resumePath = buildProfileAccountReturnPath({
      profileSlug: target.profileSlug,
      role: args.role,
    });
    const sourcePath = normalizeProfilePath(args.sourcePath, `/u/${target.profileSlug}`);

    const result = await client.query(
      `INSERT INTO profile_accounts (
         user_id,
         profile_id,
         business_id,
         business_profile_id,
         roles,
         status,
         verification_status,
         source_path,
         resume_path,
         created_at,
         last_seen_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, ARRAY[$5]::text[], 'active', $6, $7, $8, NOW(), NOW(), NOW()
       )
       ON CONFLICT (user_id, profile_id) DO UPDATE SET
         business_id = COALESCE(profile_accounts.business_id, EXCLUDED.business_id),
         business_profile_id = COALESCE(
           profile_accounts.business_profile_id,
           EXCLUDED.business_profile_id
         ),
         roles = ARRAY(
           SELECT DISTINCT role
           FROM unnest(profile_accounts.roles || EXCLUDED.roles) AS merged(role)
           ORDER BY role
         ),
         status = CASE
           WHEN profile_accounts.status = 'suspended' THEN 'suspended'
           ELSE 'active'
         END,
         verification_status = CASE
           WHEN profile_accounts.verification_status = 'approved' THEN 'approved'
           WHEN EXCLUDED.verification_status = 'approved' THEN 'approved'
           WHEN EXCLUDED.verification_status = 'rejected' THEN 'rejected'
           WHEN EXCLUDED.verification_status = 'pending' THEN 'pending'
           ELSE profile_accounts.verification_status
         END,
         source_path = EXCLUDED.source_path,
         resume_path = EXCLUDED.resume_path,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id,
                 roles,
                 status,
                 verification_status,
                 resume_path,
                 last_seen_at`,
      [
        userId,
        target.profileId,
        target.businessId,
        businessPersona?.id || null,
        args.role,
        verificationStatus,
        sourcePath,
        resumePath,
      ]
    );

    await client.query("COMMIT");
    return {
      policy,
      account: toAccountRecord(target, result.rows[0]),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
