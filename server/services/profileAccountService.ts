/* eslint-disable @typescript-eslint/no-explicit-any -- Existing profile and business records use flexible JSON. */
import {
  buildProfileAccountReturnPath,
  resolveProfileAccountPolicy,
  type ProfileAccountPolicy,
} from "@shared/profileAccount";
import { pool } from "../db";

const PROFILE_ACCOUNT_DDL = `
CREATE TABLE IF NOT EXISTS profile_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_profile_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_business_id TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  identity_kind TEXT NOT NULL,
  priority_key TEXT NOT NULL DEFAULT 'profile_account',
  status TEXT NOT NULL DEFAULT 'active',
  verification_status TEXT NOT NULL DEFAULT 'not_required',
  source_path TEXT,
  resume_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, target_profile_id),
  CHECK (identity_kind IN ('user', 'business')),
  CHECK (priority_key ~ '^[a-z0-9_]{2,80}$'),
  CHECK (status IN ('active', 'suspended', 'closed')),
  CHECK (verification_status IN ('not_required', 'pending', 'approved', 'rejected')),
  CHECK (
    (identity_kind = 'user' AND business_profile_id IS NULL AND verification_status = 'not_required')
    OR
    (identity_kind = 'business' AND business_profile_id IS NOT NULL AND verification_status <> 'not_required')
  ),
  CHECK (source_path IS NULL OR (source_path ~ '^/u/' AND source_path NOT LIKE '%\\%')),
  CHECK (resume_path IS NULL OR (resume_path ~ '^/u/' AND resume_path NOT LIKE '%\\%'))
);

CREATE INDEX IF NOT EXISTS idx_profile_accounts_target
  ON profile_accounts(target_profile_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_accounts_owner
  ON profile_accounts(owner_user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_profile_accounts_business
  ON profile_accounts(business_profile_id, status, updated_at DESC)
  WHERE business_profile_id IS NOT NULL;

CREATE OR REPLACE FUNCTION enforce_profile_account_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  profile_owner_user_id TEXT;
  profile_intent TEXT;
BEGIN
  IF NEW.identity_kind = 'user' THEN
    IF NEW.business_profile_id IS NOT NULL OR NEW.verification_status <> 'not_required' THEN
      RAISE EXCEPTION 'User profile accounts cannot carry a business identity';
    END IF;
    RETURN NEW;
  END IF;

  SELECT user_id, user_intent::text
    INTO profile_owner_user_id, profile_intent
    FROM user_profiles
   WHERE id = NEW.business_profile_id;

  IF NOT FOUND OR profile_intent <> 'business' THEN
    RAISE EXCEPTION 'This profile account requires a TradeScout business profile';
  END IF;

  IF profile_owner_user_id <> NEW.owner_user_id THEN
    RAISE EXCEPTION 'Profile account business ownership does not match the signed-in user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_accounts_identity_trigger
  ON profile_accounts;

CREATE TRIGGER profile_accounts_identity_trigger
BEFORE INSERT OR UPDATE OF identity_kind, business_profile_id, owner_user_id, verification_status
ON profile_accounts
FOR EACH ROW
EXECUTE FUNCTION enforce_profile_account_identity();
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
  profilePriorityConfig: unknown;
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
  identityKind: "user" | "business";
  businessProfileId: string | null;
  businessName: string | null;
  priorityKey: string;
  status: "active" | "suspended" | "closed";
  verificationStatus: "not_required" | "pending" | "approved" | "rejected";
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

function normalizeBusinessVerificationStatus(
  value: unknown
): ViewerBusinessProfile["verificationStatus"] {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  return "pending";
}

function normalizeAccountVerificationStatus(
  value: unknown
): ProfileAccountRecord["verificationStatus"] {
  const status = String(value || "")
    .trim()
    .toLowerCase();
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "pending") return "pending";
  return "not_required";
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
            p.content_blocks,
            p.seo_meta -> 'profileAccount' AS profile_priority_config
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
    profilePriorityConfig: row.profile_priority_config,
  };
}

function policyForTarget(target: ProfileAccountTarget): ProfileAccountPolicy {
  return resolveProfileAccountPolicy({
    profileSlug: target.profileSlug,
    profileName: target.profileName,
    contentBlocks: target.contentBlocks,
    profilePriorityConfig: target.profilePriorityConfig,
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
    verificationStatus: normalizeBusinessVerificationStatus(row.verification_status),
  });
}

function toAccountRecord(args: {
  target: ProfileAccountTarget;
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  row: any;
}): ProfileAccountRecord {
  const identityKind = String(args.row.identity_kind || "user") === "business" ? "business" : "user";
  const businessProfileId = args.row.business_profile_id
    ? String(args.row.business_profile_id)
    : null;
  const businessName =
    identityKind === "business" && args.viewerBusiness?.id === businessProfileId
      ? args.viewerBusiness.name
      : args.row.business_name
        ? String(args.row.business_name)
        : null;
  return Object.freeze({
    id: String(args.row.id),
    profileSlug: args.target.profileSlug,
    profileName: args.target.profileName,
    identityKind,
    businessProfileId,
    businessName,
    priorityKey: String(args.row.priority_key || args.policy.priorityKey),
    status: String(args.row.status || "active") as ProfileAccountRecord["status"],
    verificationStatus: normalizeAccountVerificationStatus(args.row.verification_status),
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
      requiresBusinessSetup: policy.requiredIdentity === "business",
      account: null,
    });
  }

  const viewerBusiness =
    policy.requiredIdentity === "business" ? await loadViewerBusinessProfile(userId) : null;
  const result = await pool.query(
    `UPDATE profile_accounts
        SET verification_status = CASE
              WHEN identity_kind = 'business' THEN $1
              ELSE 'not_required'
            END,
            last_seen_at = NOW(),
            updated_at = NOW()
      WHERE owner_user_id = $2
        AND target_profile_id = $3
        AND identity_kind = $4
      RETURNING id,
                identity_kind,
                business_profile_id,
                priority_key,
                status,
                verification_status,
                resume_path,
                last_seen_at`,
    [
      viewerBusiness?.verificationStatus || "pending",
      userId,
      target.profileId,
      policy.requiredIdentity,
    ]
  );

  return Object.freeze({
    policy,
    viewerBusiness,
    requiresBusinessSetup: policy.requiredIdentity === "business" && !viewerBusiness,
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
  viewerBusiness: ViewerBusinessProfile | null;
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
    if (!policy.enabled) throw new Error("Accounts are not available for this profile");

    const userResult = await client.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!userResult.rows[0]) throw new Error("TradeScout identity not found");

    const viewerBusiness =
      policy.requiredIdentity === "business"
        ? await loadViewerBusinessProfile(userId, client, true)
        : null;
    if (policy.requiredIdentity === "business" && !viewerBusiness) {
      throw new Error("A TradeScout business profile is required to create this account");
    }

    const identityKind = policy.requiredIdentity;
    const verificationStatus = viewerBusiness?.verificationStatus || "not_required";
    const resumePath = buildProfileAccountReturnPath(target.profileSlug);
    const sourcePath = normalizeProfilePath(args.sourcePath, `/u/${target.profileSlug}`);

    const result = await client.query(
      `INSERT INTO profile_accounts (
         owner_user_id,
         business_profile_id,
         target_profile_id,
         target_business_id,
         identity_kind,
         priority_key,
         status,
         verification_status,
         source_path,
         resume_path,
         created_at,
         last_seen_at,
         updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, NOW(), NOW(), NOW()
       )
       ON CONFLICT (owner_user_id, target_profile_id) DO UPDATE SET
         business_profile_id = EXCLUDED.business_profile_id,
         target_business_id = COALESCE(
           profile_accounts.target_business_id,
           EXCLUDED.target_business_id
         ),
         identity_kind = EXCLUDED.identity_kind,
         priority_key = EXCLUDED.priority_key,
         status = CASE
           WHEN profile_accounts.status = 'suspended' THEN 'suspended'
           ELSE 'active'
         END,
         verification_status = EXCLUDED.verification_status,
         source_path = EXCLUDED.source_path,
         resume_path = EXCLUDED.resume_path,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING id,
                 identity_kind,
                 business_profile_id,
                 priority_key,
                 status,
                 verification_status,
                 resume_path,
                 last_seen_at`,
      [
        userId,
        viewerBusiness?.id || null,
        target.profileId,
        target.businessId,
        identityKind,
        policy.priorityKey,
        verificationStatus,
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
