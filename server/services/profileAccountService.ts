/* eslint-disable @typescript-eslint/no-explicit-any -- Existing profile and business records use flexible JSON. */
import {
  buildProfileAccountReturnPath,
  resolveProfileAccountPolicy,
  type ProfileAccountPolicy,
} from "@shared/profileAccount";
import { pool } from "../db";

const PROFILE_ACCOUNT_DDL = `
CREATE TABLE IF NOT EXISTS profile_business_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_profile_id TEXT NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  verification_status TEXT NOT NULL DEFAULT 'pending',
  source_path TEXT,
  resume_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_profile_id, target_profile_id),
  CHECK (status IN ('active', 'suspended', 'closed')),
  CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  CHECK (source_path IS NULL OR (source_path ~ '^/u/' AND source_path NOT LIKE '%\\%')),
  CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'))
);

CREATE INDEX IF NOT EXISTS idx_profile_business_accounts_target
  ON profile_business_accounts(target_profile_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_business_accounts_owner
  ON profile_business_accounts(owner_user_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION enforce_profile_business_account_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_owner_user_id TEXT;
  profile_intent TEXT;
BEGIN
  SELECT user_id, user_intent::text
    INTO profile_owner_user_id, profile_intent
    FROM user_profiles
   WHERE id = NEW.business_profile_id;

  IF NOT FOUND OR profile_intent <> 'business' THEN
    RAISE EXCEPTION 'Profile accounts require a TradeScout business profile';
  END IF;

  IF profile_owner_user_id <> NEW.owner_user_id THEN
    RAISE EXCEPTION 'Profile account business ownership does not match the signed-in user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_business_accounts_identity_trigger
  ON profile_business_accounts;

CREATE TRIGGER profile_business_accounts_identity_trigger
BEFORE INSERT OR UPDATE OF business_profile_id, owner_user_id
ON profile_business_accounts
FOR EACH ROW
EXECUTE FUNCTION enforce_profile_business_account_identity();
`;

let ensurePromise: Promise<void> | null = null;

export async function ensureProfileAccountTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = pool
      .query(PROFILE_ACCOUNT_DDL)
      .then(() => undefined)
      .catch((error) => {
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

export type ViewerBusinessProfile = Readonly<{
  id: string;
  name: string;
  verificationStatus: "pending" | "approved" | "rejected";
}>;

export type ProfileAccountRecord = Readonly<{
  id: string;
  profileSlug: string;
  profileName: string;
  businessProfileId: string;
  businessName: string;
  status: "active" | "suspended" | "closed";
  verificationStatus: "pending" | "approved" | "rejected";
  resumePath: string;
  lastSeenAt: string | null;
  bidRockIncluded: boolean;
}>;

export type ProfileAccountState = Readonly<{
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  requiresBusinessSetup: boolean;
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
  if (!path.startsWith("/u/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  return path.slice(0, 500);
}

function normalizeVerificationStatus(
  value: unknown
): ViewerBusinessProfile["verificationStatus"] {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
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
    contentBlocks: target.contentBlocks,
  });
}

async function loadViewerBusinessProfile(
  userId: string,
  client: Pick<typeof pool, "query"> = pool,
  lock = false
): Promise<ViewerBusinessProfile | null> {
  const result = await client.query(
    `SELECT id,
            COALESCE(NULLIF(trim(display_name), ''), 'TradeScout business') AS display_name,
            verification_status
       FROM user_profiles
      WHERE user_id = $1
        AND user_intent = 'business'
      ORDER BY (verification_status = 'approved') DESC,
               is_primary DESC NULLS LAST,
               created_at ASC
      LIMIT 1
      ${lock ? "FOR UPDATE" : ""}`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return Object.freeze({
    id: String(row.id),
    name: String(row.display_name || "TradeScout business"),
    verificationStatus: normalizeVerificationStatus(row.verification_status),
  });
}

function toAccountRecord(args: {
  target: ProfileAccountTarget;
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile;
  row: any;
}): ProfileAccountRecord {
  return Object.freeze({
    id: String(args.row.id),
    profileSlug: args.target.profileSlug,
    profileName: args.target.profileName,
    businessProfileId: args.viewerBusiness.id,
    businessName: args.viewerBusiness.name,
    status: String(args.row.status || "active") as ProfileAccountRecord["status"],
    verificationStatus: normalizeVerificationStatus(args.row.verification_status),
    resumePath: normalizeProfilePath(
      args.row.resume_path,
      buildProfileAccountReturnPath(args.target.profileSlug)
    ),
    lastSeenAt: args.row.last_seen_at
      ? new Date(args.row.last_seen_at).toISOString()
      : null,
    bidRockIncluded: args.policy.includesBidRock,
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
  if (!userId) {
    return Object.freeze({
      policy,
      viewerBusiness: null,
      requiresBusinessSetup: true,
      account: null,
    });
  }

  const viewerBusiness = await loadViewerBusinessProfile(userId);
  if (!viewerBusiness) {
    return Object.freeze({
      policy,
      viewerBusiness: null,
      requiresBusinessSetup: true,
      account: null,
    });
  }

  const result = await pool.query(
    `UPDATE profile_business_accounts
        SET verification_status = $1,
            last_seen_at = NOW(),
            updated_at = NOW()
      WHERE business_profile_id = $2
        AND target_profile_id = $3
      RETURNING id,
                status,
                verification_status,
                resume_path,
                last_seen_at`,
    [viewerBusiness.verificationStatus, viewerBusiness.id, target.profileId]
  );

  return Object.freeze({
    policy,
    viewerBusiness,
    requiresBusinessSetup: false,
    account: result.rows[0]
      ? toAccountRecord({
          target,
          policy,
          viewerBusiness,
          row: result.rows[0],
        })
      : null,
  });
}

export async function ensureProfileAccount(args: {
  userId: string;
  profileSlug: string;
  sourcePath?: string | null;
}): Promise<{
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile;
  requiresBusinessSetup: false;
  account: ProfileAccountRecord;
}> {
  await ensureProfileAccountTables();
  const userId = String(args.userId || "").trim();
  if (!userId) throw new Error("Authentication required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await loadProfileAccountTarget(args.profileSlug, client);
    if (!target) throw new Error("Profile account target not found");
    const policy = policyForTarget(target);
    if (!policy.enabled || !policy.businessOnly) {
      throw new Error("Business accounts are not available for this profile");
    }

    const userResult = await client.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!userResult.rows[0]) throw new Error("TradeScout identity not found");

    const viewerBusiness = await loadViewerBusinessProfile(userId, client, true);
    if (!viewerBusiness) {
      throw new Error("A TradeScout business profile is required to create this account");
    }

    const resumePath = buildProfileAccountReturnPath(target.profileSlug);
    const sourcePath = normalizeProfilePath(args.sourcePath, `/u/${target.profileSlug}`);

    const result = await client.query(
      `INSERT INTO profile_business_accounts (
         business_profile_id,
         owner_user_id,
         target_profile_id,
         target_business_id,
         status,
         verification_status,
         source_path,
         resume_path,
         created_at,
         last_seen_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, 'active', $5, $6, $7, NOW(), NOW(), NOW()
       )
       ON CONFLICT (business_profile_id, target_profile_id) DO UPDATE SET
         owner_user_id = EXCLUDED.owner_user_id,
         target_business_id = COALESCE(
           profile_business_accounts.target_business_id,
           EXCLUDED.target_business_id
         ),
         status = CASE
           WHEN profile_business_accounts.status = 'suspended' THEN 'suspended'
           ELSE 'active'
         END,
         verification_status = EXCLUDED.verification_status,
         source_path = EXCLUDED.source_path,
         resume_path = EXCLUDED.resume_path,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id,
                 status,
                 verification_status,
                 resume_path,
                 last_seen_at`,
      [
        viewerBusiness.id,
        userId,
        target.profileId,
        target.businessId,
        viewerBusiness.verificationStatus,
        sourcePath,
        resumePath,
      ]
    );

    await client.query("COMMIT");
    return {
      policy,
      viewerBusiness,
      requiresBusinessSetup: false,
      account: toAccountRecord({
        target,
        policy,
        viewerBusiness,
        row: result.rows[0],
      }),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
