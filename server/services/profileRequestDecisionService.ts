import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "../db";

export const PROFILE_REQUEST_AUTHORITY_GATE = "decision_card" as const;
export const PROFILE_REQUEST_SOURCE = "tradepartner_profile" as const;

type QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> = {
  rows: Row[];
  rowCount?: number | null;
};

export type ProfileRequestDecisionQueryClient = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ): Promise<QueryResult<Row>>;
  release(): void;
};

export type ProfileRequestDecisionDatabase = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ): Promise<QueryResult<Row>>;
  connect(): Promise<ProfileRequestDecisionQueryClient>;
};

export type ProfileRequestDecisionTarget = {
  profileId: string;
  profileSlug: string;
  businessId: string;
  ownerUserId: string;
};

export type LockedProfileRequestDecision = {
  decisionId: string;
  requestPayload: Record<string, unknown>;
  decisionScope: string;
  target: {
    profileId: string;
    profileSlug: string;
    profileStatus: string | null;
    profileRoleContext: string | null;
    profileOwnerUserId: string;
    businessId: string;
    businessName: string;
    businessStatus: string | null;
    businessOwnerUserId: string | null;
    businessClaimStatus: string | null;
    businessSources: unknown;
    publicDiscoveryEnabled: boolean | null;
    profileData: Record<string, unknown>;
    ownerUserId: string;
    ownerProvider: string | null;
    ownerPreferences: Record<string, unknown> | null;
    ownerVerifiedBadge: boolean | null;
    ownerVerificationStatus: string | null;
    ownerPhone: string | null;
    ownerEmail: string;
  };
};

type LockedDecisionRow = {
  decision_id: string;
  session_binding_hash: string;
  authority_gate: string;
  source: string;
  target_profile_id: string;
  target_profile_slug: string;
  target_business_id: string;
  target_owner_user_id: string;
  decision_scope: string;
  request_payload: Record<string, unknown>;
  status: string;
  consumed_at: Date | null;
  is_fresh: boolean;
  profile_id: string;
  profile_slug: string;
  profile_status: string | null;
  profile_role_context: string | null;
  profile_owner_user_id: string;
  business_id: string;
  business_name: string;
  business_status: string | null;
  business_owner_user_id: string | null;
  business_claim_status: string | null;
  business_sources: unknown;
  public_discovery_enabled: boolean | null;
  profile_data: Record<string, unknown> | null;
  owner_user_id: string;
  owner_provider: string | null;
  owner_preferences: Record<string, unknown> | null;
  owner_verified_badge: boolean | null;
  owner_verification_status: string | null;
  owner_phone: string | null;
  owner_email: string;
};

export type ProfileRequestDecisionErrorCode =
  | "INVALID_PROOF"
  | "PROOF_EXPIRED"
  | "PROOF_ALREADY_USED"
  | "SESSION_MISMATCH"
  | "SOURCE_MISMATCH"
  | "TARGET_MISMATCH"
  | "AUTHORITY_CHANGED";

export class ProfileRequestDecisionError extends Error {
  constructor(readonly code: ProfileRequestDecisionErrorCode) {
    super("This request decision is no longer valid. Start the request again.");
    this.name = "ProfileRequestDecisionError";
  }
}

function configuredPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeSlug(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hashProof(proof: string): string {
  return createHash("sha256").update(proof).digest("hex");
}

function secureHexEqual(left: unknown, right: unknown): boolean {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createProfileRequestSessionNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashProfileRequestSessionBinding(
  nonce: string,
  secret = process.env.SESSION_SECRET || "dev-insecure-session-secret"
): string {
  if (!String(nonce || "").trim()) {
    throw new Error("Profile request session nonce is required");
  }
  return createHmac("sha256", secret).update(`profile-request-decision\0${nonce}`).digest("hex");
}

export class ProfileRequestDecisionService {
  private readonly ttlMs: number;
  private readonly confirmedRetentionMs: number;

  constructor(
    private readonly database: ProfileRequestDecisionDatabase = pool as unknown as ProfileRequestDecisionDatabase,
    options?: { ttlMs?: number; confirmedRetentionMs?: number }
  ) {
    this.ttlMs = configuredPositiveInteger(
      options?.ttlMs ?? process.env.PROFILE_REQUEST_DECISION_TTL_MS,
      15 * 60 * 1000
    );
    this.confirmedRetentionMs = configuredPositiveInteger(
      options?.confirmedRetentionMs ?? process.env.PROFILE_REQUEST_DECISION_RETENTION_MS,
      24 * 60 * 60 * 1000
    );
  }

  async stage(args: {
    sessionBindingHash: string;
    target: ProfileRequestDecisionTarget;
    requestPayload: Record<string, unknown>;
  }): Promise<{ decisionProof: string; expiresAt: Date }> {
    const decisionProof = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + this.ttlMs);
    const targetSlug = normalizeSlug(args.target.profileSlug);
    if (!targetSlug) throw new Error("Profile request target slug is required");

    await this.database.query(
      `INSERT INTO public.profile_request_decision_proofs (
         proof_hash,
         session_binding_hash,
         authority_gate,
         source,
         target_profile_id,
         target_profile_slug,
         target_business_id,
         target_owner_user_id,
         decision_scope,
         request_payload,
         status,
         expires_at,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, 'pending', $11, NOW(), NOW())`,
      [
        hashProof(decisionProof),
        args.sessionBindingHash,
        PROFILE_REQUEST_AUTHORITY_GATE,
        PROFILE_REQUEST_SOURCE,
        args.target.profileId,
        targetSlug,
        args.target.businessId,
        args.target.ownerUserId,
        `profile:${args.target.profileId}:request`,
        JSON.stringify(args.requestPayload),
        expiresAt,
      ]
    );

    return { decisionProof, expiresAt };
  }

  async confirm<Result extends { workRequestId: string }>(
    args: {
      decisionProof: string;
      sessionBindingHash: string;
      source: typeof PROFILE_REQUEST_SOURCE;
      targetProfileSlug: string;
    },
    finalize: (
      client: ProfileRequestDecisionQueryClient,
      decision: LockedProfileRequestDecision
    ) => Promise<Result>
  ): Promise<Result> {
    const proof = String(args.decisionProof || "").trim();
    if (!proof) throw new ProfileRequestDecisionError("INVALID_PROOF");

    const client = await this.database.connect();
    let transactionOpen = false;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const lockedResult = await client.query<LockedDecisionRow>(
        `SELECT
           decision.id AS decision_id,
           decision.session_binding_hash,
           decision.authority_gate,
           decision.source,
           decision.target_profile_id,
           decision.target_profile_slug,
           decision.target_business_id,
           decision.target_owner_user_id,
           decision.decision_scope,
           decision.request_payload,
           decision.status,
           decision.consumed_at,
           decision.expires_at > NOW() AS is_fresh,
           profile.id AS profile_id,
           profile.slug AS profile_slug,
           profile.status AS profile_status,
           profile.role_context AS profile_role_context,
           profile.owner_user_id AS profile_owner_user_id,
           business.id AS business_id,
           business.name AS business_name,
           business.status AS business_status,
           business.owner_user_id AS business_owner_user_id,
           business.claim_status AS business_claim_status,
           business.sources AS business_sources,
           business.public_discovery_enabled,
           business.profile_data,
           owner_account.id AS owner_user_id,
           owner_account.provider AS owner_provider,
           owner_account.preferences AS owner_preferences,
           owner_account.verified_badge AS owner_verified_badge,
           owner_account.verification_status AS owner_verification_status,
           owner_account.phone AS owner_phone,
           owner_account.email AS owner_email
         FROM public.profile_request_decision_proofs decision
         JOIN public.profiles profile
           ON profile.id = decision.target_profile_id
         JOIN public.businesses business
           ON business.id = decision.target_business_id
          AND business.id = profile.business_id
         JOIN public.users owner_account
           ON owner_account.id = decision.target_owner_user_id
          AND owner_account.id = profile.owner_user_id
          AND owner_account.id = business.owner_user_id
         WHERE decision.proof_hash = $1
         LIMIT 1
         FOR UPDATE OF decision, profile, business, owner_account`,
        [hashProof(proof)]
      );
      const row = lockedResult.rows[0];
      if (!row) throw new ProfileRequestDecisionError("INVALID_PROOF");

      if (row.status !== "pending" || row.consumed_at) {
        throw new ProfileRequestDecisionError("PROOF_ALREADY_USED");
      }
      if (!row.is_fresh) {
        await client.query("DELETE FROM public.profile_request_decision_proofs WHERE id = $1", [
          row.decision_id,
        ]);
        await client.query("COMMIT");
        transactionOpen = false;
        throw new ProfileRequestDecisionError("PROOF_EXPIRED");
      }
      if (!secureHexEqual(row.session_binding_hash, args.sessionBindingHash)) {
        throw new ProfileRequestDecisionError("SESSION_MISMATCH");
      }
      if (
        row.authority_gate !== PROFILE_REQUEST_AUTHORITY_GATE ||
        row.source !== PROFILE_REQUEST_SOURCE ||
        args.source !== PROFILE_REQUEST_SOURCE
      ) {
        throw new ProfileRequestDecisionError("SOURCE_MISMATCH");
      }

      const expectedSlug = normalizeSlug(args.targetProfileSlug);
      if (
        !expectedSlug ||
        normalizeSlug(row.target_profile_slug) !== expectedSlug ||
        normalizeSlug(row.profile_slug) !== expectedSlug ||
        row.target_profile_id !== row.profile_id ||
        row.target_business_id !== row.business_id ||
        row.target_owner_user_id !== row.owner_user_id ||
        row.profile_owner_user_id !== row.owner_user_id ||
        row.business_owner_user_id !== row.owner_user_id
      ) {
        throw new ProfileRequestDecisionError("TARGET_MISMATCH");
      }

      const result = await finalize(client, {
        decisionId: row.decision_id,
        requestPayload: row.request_payload,
        decisionScope: row.decision_scope,
        target: {
          profileId: row.profile_id,
          profileSlug: row.profile_slug,
          profileStatus: row.profile_status,
          profileRoleContext: row.profile_role_context,
          profileOwnerUserId: row.profile_owner_user_id,
          businessId: row.business_id,
          businessName: row.business_name,
          businessStatus: row.business_status,
          businessOwnerUserId: row.business_owner_user_id,
          businessClaimStatus: row.business_claim_status,
          businessSources: row.business_sources,
          publicDiscoveryEnabled: row.public_discovery_enabled,
          profileData: row.profile_data || {},
          ownerUserId: row.owner_user_id,
          ownerProvider: row.owner_provider,
          ownerPreferences: row.owner_preferences,
          ownerVerifiedBadge: row.owner_verified_badge,
          ownerVerificationStatus: row.owner_verification_status,
          ownerPhone: row.owner_phone,
          ownerEmail: row.owner_email,
        },
      });

      const consumed = await client.query<{ id: string }>(
        `UPDATE public.profile_request_decision_proofs
            SET status = 'confirmed',
                consumed_at = NOW(),
                work_request_id = $2,
                request_payload = '{}'::jsonb,
                updated_at = NOW()
          WHERE id = $1
            AND status = 'pending'
            AND consumed_at IS NULL
        RETURNING id`,
        [row.decision_id, result.workRequestId]
      );
      if (consumed.rows.length !== 1) {
        throw new ProfileRequestDecisionError("PROOF_ALREADY_USED");
      }

      await client.query("COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("[profile-request-decision] rollback failed", rollbackError);
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteExpiredBatch(batchSize = 200): Promise<number> {
    const safeBatchSize = Math.min(configuredPositiveInteger(batchSize, 200), 1_000);
    const result = await this.database.query<{ id: string }>(
      `WITH expired AS (
         SELECT id
           FROM public.profile_request_decision_proofs
          WHERE (status = 'pending' AND expires_at <= NOW())
             OR (
               status = 'confirmed'
               AND consumed_at <= NOW() - ($2::bigint * INTERVAL '1 millisecond')
             )
          ORDER BY COALESCE(consumed_at, expires_at), id
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       DELETE FROM public.profile_request_decision_proofs decision
       USING expired
       WHERE decision.id = expired.id
       RETURNING decision.id`,
      [safeBatchSize, this.confirmedRetentionMs]
    );
    return result.rowCount ?? result.rows.length;
  }

  async drainExpired(options?: { batchSize?: number; maxBatches?: number }): Promise<number> {
    const batchSize = Math.min(configuredPositiveInteger(options?.batchSize, 200), 1_000);
    const maxBatches = Math.min(configuredPositiveInteger(options?.maxBatches, 100), 10_000);
    let deleted = 0;
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const count = await this.deleteExpiredBatch(batchSize);
      deleted += count;
      if (count < batchSize) break;
    }
    return deleted;
  }
}

export const profileRequestDecisionService = new ProfileRequestDecisionService();
