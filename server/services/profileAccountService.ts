/* eslint-disable @typescript-eslint/no-explicit-any -- Existing profile and business records use flexible JSON. */
import {
  buildProfileAccountReturnPath,
  resolveProfileAccountPolicy,
  type ProfileAccountPolicy,
} from "@shared/profileAccount";
import { pool } from "../db";

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

function normalizeSourcePath(value: unknown, fallback: string): string {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  try {
    const parsed = new URL(path, "https://profile-account.local");
    if (parsed.origin !== "https://profile-account.local") return fallback;
    if (decodeURIComponent(parsed.pathname).split("/").includes("..")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`.slice(0, 500);
  } catch {
    return fallback;
  }
}

function normalizeResumePath(value: unknown, fallback: string): string {
  const path = String(value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }
  return path.slice(0, 500);
}

function normalizeBusinessName(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 160);
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
            COALESCE(NULLIF(trim(display_name), ''), 'Your business') AS display_name,
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
    name: String(row.display_name || "Your business"),
    verificationStatus: normalizeBusinessVerificationStatus(row.verification_status),
  });
}

async function queueBusinessVerificationReview(
  businessProfileId: string,
  client: Pick<typeof pool, "query">
): Promise<void> {
  await client.query(
    `UPDATE user_profiles
        SET verification_requirements = COALESCE(verification_requirements, '{}'::jsonb)
              || '{"business_registration": true}'::jsonb,
            verification_submissions = COALESCE(verification_submissions, '{}'::jsonb)
              || jsonb_build_object(
                   'businessRegistrationReviewRequestedAt',
                   COALESCE(
                     verification_submissions ->> 'businessRegistrationReviewRequestedAt',
                     NOW()::text
                   ),
                   'businessRegistrationReviewSource',
                   'profile_account'
                 ),
            updated_at = NOW()
      WHERE id = $1
        AND user_intent = 'business'
        AND verification_status = 'pending'`,
    [businessProfileId]
  );
}

async function createPrivateBusinessProfile(
  userId: string,
  businessName: unknown,
  client: Pick<typeof pool, "query">
): Promise<ViewerBusinessProfile> {
  const name = normalizeBusinessName(businessName);
  if (name.length < 2) {
    throw new Error("Business name is required to create this account");
  }

  const result = await client.query(
    `INSERT INTO user_profiles (
       user_id,
       user_intent,
       role,
       roles,
       profile_visibility,
       verification_status,
       verification_requirements,
       verification_submissions,
       is_primary,
       display_name,
       created_at,
       updated_at
     )
     SELECT
       $1::varchar,
       'business',
       'business_owner',
       ARRAY['business_owner']::text[],
       'private',
       'pending',
       '{"business_registration": true}'::jsonb,
       jsonb_build_object(
         'businessRegistrationReviewRequestedAt', NOW()::text,
         'businessRegistrationReviewSource', 'profile_account'
       ),
       NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = $1::varchar),
       $2,
       NOW(),
       NOW()
     RETURNING id, display_name, verification_status`,
    [userId, name]
  );
  const row = result.rows[0];
  if (!row) throw new Error("Private business identity could not be created");
  return Object.freeze({
    id: String(row.id),
    name: String(row.display_name || name),
    verificationStatus: normalizeBusinessVerificationStatus(row.verification_status),
  });
}

function toAccountRecord(args: {
  target: ProfileAccountTarget;
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  row: any;
}): ProfileAccountRecord {
  const identityKind =
    String(args.row.identity_kind || "user") === "business" ? "business" : "user";
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
    resumePath: normalizeResumePath(
      args.row.resume_path,
      buildProfileAccountReturnPath(args.target.profileSlug)
    ),
    lastSeenAt: args.row.last_seen_at ? new Date(args.row.last_seen_at).toISOString() : null,
    bidRockIncluded: args.policy.includesBidRock,
  });
}

export async function getProfileAccountState(args: {
  profileSlug: string;
  userId?: string | null;
}): Promise<ProfileAccountState | null> {
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
    `SELECT pa.id,
            pa.identity_kind,
            pa.business_profile_id,
            pa.priority_key,
            pa.status,
            CASE
              WHEN pa.identity_kind = 'business' THEN
                COALESCE(account_business.verification_status::text, 'pending')
              ELSE 'not_required'
            END AS verification_status,
            pa.resume_path,
            pa.last_seen_at,
            account_business.display_name AS business_name
       FROM profile_accounts pa
       LEFT JOIN user_profiles account_business
         ON account_business.id = pa.business_profile_id
      WHERE pa.owner_user_id = $1
        AND pa.target_profile_id = $2
        AND pa.identity_kind = $3
      LIMIT 1`,
    [userId, target.profileId, policy.requiredIdentity]
  );

  return Object.freeze({
    policy,
    viewerBusiness,
    requiresBusinessSetup: policy.requiredIdentity === "business" && !viewerBusiness,
    account: result.rows[0]
      ? toAccountRecord({ target, policy, viewerBusiness, row: result.rows[0] })
      : null,
  });
}

export async function ensureProfileAccount(args: {
  userId: string;
  profileSlug: string;
  businessName?: string | null;
  sourcePath?: string | null;
}): Promise<{
  policy: ProfileAccountPolicy;
  viewerBusiness: ViewerBusinessProfile | null;
  requiresBusinessSetup: false;
  account: ProfileAccountRecord;
}> {
  const userId = String(args.userId || "").trim();
  if (!userId) throw new Error("Authentication required");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const target = await loadProfileAccountTarget(args.profileSlug, client);
    if (!target) throw new Error("Profile account target not found");
    const policy = policyForTarget(target);
    if (!policy.enabled) throw new Error("Accounts are not available for this profile");

    const userResult = await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [
      userId,
    ]);
    if (!userResult.rows[0]) throw new Error("Private identity not found");

    let viewerBusiness =
      policy.requiredIdentity === "business"
        ? await loadViewerBusinessProfile(userId, client, true)
        : null;
    if (policy.requiredIdentity === "business" && !viewerBusiness) {
      viewerBusiness = await createPrivateBusinessProfile(userId, args.businessName, client);
    }
    if (viewerBusiness?.verificationStatus === "pending") {
      await queueBusinessVerificationReview(viewerBusiness.id, client);
    }

    const identityKind = policy.requiredIdentity;
    const verificationStatus = viewerBusiness?.verificationStatus || "not_required";
    const resumePath = buildProfileAccountReturnPath(target.profileSlug);
    const sourcePath = normalizeSourcePath(args.sourcePath, `/u/${target.profileSlug}`);

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
      account: toAccountRecord({ target, policy, viewerBusiness, row: result.rows[0] }),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
