import { pool } from "../db";

type SqlClient = {
  query(text: string, params?: unknown[]): Promise<{ rows: any[] }>;
  release?: () => void;
};
type SqlPool = SqlClient & { connect(): Promise<SqlClient> };

export type AffiliateCommissionStatus =
  | "legacy_unverified"
  | "pending"
  | "approved"
  | "paid";

export interface AffiliateCommissionRecord {
  id: string;
  affiliateProgramId: string;
  status: AffiliateCommissionStatus;
  commissionAmount: string;
  revenueAmount?: string;
  referralId?: string;
  transactionId?: string;
  description?: string;
  createdAt: Date;
  approvedAt?: Date | null;
  approvedBy?: string | null;
  approvalReason?: string | null;
  paidAt?: Date | null;
  created?: boolean;
}

export interface CreateAffiliateCommissionInput {
  affiliateProgramId: string;
  referralId?: string;
  transactionId?: string;
  revenueAmount?: string;
  commissionAmount?: string;
  description?: string;
  status?: string;
  createdAt?: Date;
}

export interface AffiliateCommissionApprovalResult {
  commission: AffiliateCommissionRecord;
  transitioned: boolean;
  credited: boolean;
}

export class AffiliateCommissionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = new.target.name;
  }
}

function databaseCode(error: unknown): string {
  return String((error as any)?.code || "");
}

function normalizeMoney(value: unknown, label: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AffiliateCommissionError(
      `${label} must be a positive amount`,
      400,
      "AFFILIATE_COMMISSION_INVALID_AMOUNT"
    );
  }
  return amount.toFixed(2);
}

function normalizeRequired(value: unknown, label: string, max = 255): string {
  const result = String(value || "").trim();
  if (!result || result.length > max) {
    throw new AffiliateCommissionError(
      `${label} is required`,
      400,
      "AFFILIATE_COMMISSION_INVALID_INPUT"
    );
  }
  return result;
}

function isUnavailable(error: unknown): boolean {
  return (
    ["42P01", "42703", "57P01", "08000", "08003", "08006"].includes(databaseCode(error)) ||
    /missing (test_)?database_url/i.test(String((error as any)?.message || ""))
  );
}

function mapRow(row: any, created?: boolean): AffiliateCommissionRecord {
  const rawStatus = String(row.commission_status || "legacy_unverified");
  const status: AffiliateCommissionStatus = [
    "legacy_unverified",
    "pending",
    "approved",
    "paid",
  ].includes(rawStatus)
    ? (rawStatus as AffiliateCommissionStatus)
    : "legacy_unverified";
  return {
    id: String(row.id),
    affiliateProgramId: String(row.affiliate_id),
    status,
    commissionAmount: String(row.commission_amount || "0"),
    revenueAmount:
      row.commission_revenue_amount == null
        ? undefined
        : String(row.commission_revenue_amount),
    referralId:
      row.commission_source_referral_id == null
        ? undefined
        : String(row.commission_source_referral_id),
    transactionId:
      row.commission_reference_id == null
        ? undefined
        : String(row.commission_reference_id),
    description:
      row.commission_description == null ? undefined : String(row.commission_description),
    createdAt: new Date(row.created_at),
    approvedAt: row.commission_approved_at
      ? new Date(row.commission_approved_at)
      : null,
    approvedBy:
      row.commission_approved_by == null ? null : String(row.commission_approved_by),
    approvalReason:
      row.commission_approval_reason == null
        ? null
        : String(row.commission_approval_reason),
    paidAt: row.commission_paid_at ? new Date(row.commission_paid_at) : null,
    ...(created === undefined ? {} : { created }),
  };
}

export class AffiliateCommissionApprovalService {
  constructor(private readonly database: SqlPool = pool as unknown as SqlPool) {}

  private async transaction<T>(run: (client: SqlClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const value = await run(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the original failure.
      }
      if (error instanceof AffiliateCommissionError) throw error;
      if (isUnavailable(error)) {
        throw new AffiliateCommissionError(
          "Affiliate commission approval storage is unavailable",
          503,
          "AFFILIATE_COMMISSION_STORAGE_UNAVAILABLE"
        );
      }
      throw error;
    } finally {
      client.release?.();
    }
  }

  async createPendingCommission(
    input: CreateAffiliateCommissionInput
  ): Promise<AffiliateCommissionRecord> {
    const affiliateProgramId = normalizeRequired(
      input.affiliateProgramId,
      "affiliateProgramId"
    );
    const transactionId = normalizeRequired(input.transactionId, "transactionId");
    const commissionAmount = normalizeMoney(input.commissionAmount, "commissionAmount");
    const revenueAmount =
      input.revenueAmount == null
        ? null
        : normalizeMoney(input.revenueAmount, "revenueAmount");
    const sourceReferralId = input.referralId
      ? normalizeRequired(input.referralId, "referralId")
      : null;
    const description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim().slice(0, 4000)
        : null;

    return this.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
        [`affiliate-commission:${affiliateProgramId}:${transactionId}`]
      );
      const accountResult = await client.query(
        "SELECT id FROM affiliate_accounts WHERE id = $1 FOR UPDATE",
        [affiliateProgramId]
      );
      if (!accountResult.rows[0]) {
        throw new AffiliateCommissionError(
          "Affiliate account not found",
          404,
          "AFFILIATE_ACCOUNT_NOT_FOUND"
        );
      }
      if (sourceReferralId) {
        const source = await client.query(
          `SELECT id
             FROM affiliate_referrals
            WHERE id = $1 AND affiliate_id = $2
            LIMIT 1`,
          [sourceReferralId, affiliateProgramId]
        );
        if (!source.rows[0]) {
          throw new AffiliateCommissionError(
            "Source referral not found for this affiliate",
            404,
            "AFFILIATE_REFERRAL_NOT_FOUND"
          );
        }
      }

      const inserted = await client.query(
        `INSERT INTO affiliate_referrals
           (affiliate_id, referred_user_id, share_link_id, custom_link,
            commission_amount, discount_amount, conversion_source, conversion_type,
            coupon_code, commission_status, commission_reference_id,
            commission_source_referral_id, commission_revenue_amount,
            commission_description)
         VALUES ($1, NULL, NULL, $2, $3, '0', 'commission', 'commission',
                 NULL, 'pending', $2, $4, $5, $6)
         ON CONFLICT (affiliate_id, commission_reference_id)
           WHERE commission_reference_id IS NOT NULL
         DO NOTHING
         RETURNING *`,
        [
          affiliateProgramId,
          transactionId,
          commissionAmount,
          sourceReferralId,
          revenueAmount,
          description,
        ]
      );

      if (!inserted.rows[0]) {
        const existingResult = await client.query(
          `SELECT *
             FROM affiliate_referrals
            WHERE affiliate_id = $1 AND commission_reference_id = $2
            LIMIT 1`,
          [affiliateProgramId, transactionId]
        );
        const existing = existingResult.rows[0];
        if (!existing) {
          throw new AffiliateCommissionError(
            "Commission idempotency conflict",
            409,
            "AFFILIATE_COMMISSION_IDEMPOTENCY_CONFLICT"
          );
        }
        if (
          Number(existing.commission_amount) !== Number(commissionAmount) ||
          String(existing.commission_source_referral_id || "") !==
            String(sourceReferralId || "")
        ) {
          throw new AffiliateCommissionError(
            "The transaction reference is already used by a different commission",
            409,
            "AFFILIATE_COMMISSION_IDEMPOTENCY_MISMATCH"
          );
        }
        return mapRow(existing, false);
      }

      await client.query(
        `UPDATE affiliate_accounts
            SET pending = coalesce(pending, '0')::numeric + $2::numeric
          WHERE id = $1`,
        [affiliateProgramId, commissionAmount]
      );
      return mapRow(inserted.rows[0], true);
    });
  }

  async approveCommission(input: {
    commissionId: string;
    approvedByUserId: string;
    reason: string;
  }): Promise<AffiliateCommissionApprovalResult> {
    const commissionId = normalizeRequired(input.commissionId, "commissionId");
    const approvedByUserId = normalizeRequired(
      input.approvedByUserId,
      "approvedByUserId"
    );
    const reason = String(input.reason || "").trim();
    if (reason.length < 12 || reason.length > 2000) {
      throw new AffiliateCommissionError(
        "Approval reason is required (12-2000 characters)",
        400,
        "AFFILIATE_COMMISSION_APPROVAL_REASON_REQUIRED"
      );
    }

    return this.transaction(async (client) => {
      const locked = await client.query(
        `SELECT ar.*, aa.affiliate_id AS affiliate_user_id,
                aa.pending AS affiliate_pending
           FROM affiliate_referrals ar
           JOIN affiliate_accounts aa ON aa.id = ar.affiliate_id
          WHERE ar.id = $1
            AND coalesce(ar.commission_amount, '0')::numeric > 0
          FOR UPDATE OF ar, aa`,
        [commissionId]
      );
      const row = locked.rows[0];
      if (!row) {
        throw new AffiliateCommissionError(
          "Commission not found",
          404,
          "AFFILIATE_COMMISSION_NOT_FOUND"
        );
      }

      const status = String(row.commission_status || "legacy_unverified");
      if (status === "legacy_unverified") {
        throw new AffiliateCommissionError(
          "Legacy commission cannot be approved without attribution evidence",
          409,
          "AFFILIATE_COMMISSION_LEGACY_UNVERIFIED"
        );
      }
      if (status === "approved" || status === "paid") {
        return { commission: mapRow(row), transitioned: false, credited: false };
      }
      if (status !== "pending") {
        throw new AffiliateCommissionError(
          "Commission is not eligible for approval",
          409,
          "AFFILIATE_COMMISSION_INELIGIBLE"
        );
      }

      const amount = normalizeMoney(row.commission_amount, "commissionAmount");
      if (Number(row.affiliate_pending || 0) < Number(amount)) {
        throw new AffiliateCommissionError(
          "Affiliate pending balance does not cover this commission",
          409,
          "AFFILIATE_COMMISSION_BALANCE_INVARIANT"
        );
      }

      const walletResult = await client.query(
        `INSERT INTO wallet_accounts (user_id, current_balance, status)
         VALUES ($1, '0', 'active')
         ON CONFLICT (user_id) DO UPDATE
           SET updated_at = wallet_accounts.updated_at
         RETURNING id`,
        [row.affiliate_user_id]
      );
      const walletId = String(walletResult.rows[0].id);

      const ledgerResult = await client.query(
        `INSERT INTO wallet_transactions
           (wallet_account_id, user_id, transaction_type, direction, amount,
            reference_type, reference_id, memo)
         VALUES ($1, $2, 'affiliate_commission', 'credit', $3,
                 'affiliate_commission', $4, $5)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [
          walletId,
          row.affiliate_user_id,
          amount,
          commissionId,
          `Approved affiliate commission ${commissionId}`,
        ]
      );
      if (!ledgerResult.rows[0]) {
        throw new AffiliateCommissionError(
          "Commission credit ledger already exists while approval is pending",
          409,
          "AFFILIATE_COMMISSION_LEDGER_INVARIANT"
        );
      }

      await client.query(
        `UPDATE wallet_accounts
            SET current_balance =
                  coalesce(current_balance, '0')::numeric + $2::numeric,
                updated_at = now()
          WHERE id = $1`,
        [walletId, amount]
      );
      await client.query(
        `UPDATE affiliate_accounts
            SET pending = coalesce(pending, '0')::numeric - $2::numeric,
                available = coalesce(available, '0')::numeric + $2::numeric,
                lifetime_earned =
                  coalesce(lifetime_earned, '0')::numeric + $2::numeric
          WHERE id = $1`,
        [row.affiliate_id, amount]
      );
      const approved = await client.query(
        `UPDATE affiliate_referrals
            SET commission_status = 'approved',
                commission_approved_at = now(),
                commission_approved_by = $2,
                commission_approval_reason = $3
          WHERE id = $1 AND commission_status = 'pending'
          RETURNING *`,
        [commissionId, approvedByUserId, reason]
      );
      if (!approved.rows[0]) {
        throw new AffiliateCommissionError(
          "Commission changed before approval completed",
          409,
          "AFFILIATE_COMMISSION_CONCURRENT_CHANGE"
        );
      }

      await client.query(
        `INSERT INTO admin_audit_log (type, admin_id, target_user_id, metadata)
         VALUES ('affiliate_commission_approved', $1, $2, $3::jsonb)`,
        [
          approvedByUserId,
          row.affiliate_user_id,
          JSON.stringify({
            commissionId,
            affiliateProgramId: row.affiliate_id,
            amount,
            reason,
            walletLedgerId: ledgerResult.rows[0].id,
          }),
        ]
      );
      return {
        commission: mapRow(approved.rows[0]),
        transitioned: true,
        credited: true,
      };
    });
  }

  async getCommissionsForAffiliate(
    affiliateProgramId: string,
    options?: { unpaidOnly?: boolean; limit?: number }
  ): Promise<AffiliateCommissionRecord[]> {
    const id = normalizeRequired(affiliateProgramId, "affiliateProgramId");
    const limit = Math.min(200, Math.max(1, Math.trunc(options?.limit || 200)));
    try {
      const result = await this.database.query(
        `SELECT *
           FROM affiliate_referrals
          WHERE affiliate_id = $1
            AND coalesce(commission_amount, '0')::numeric > 0
            AND (
              $2::boolean = false
              OR commission_status IN ('pending', 'approved')
            )
          ORDER BY created_at DESC, id
          LIMIT $3`,
        [id, options?.unpaidOnly === true, limit]
      );
      return result.rows.map((row) => mapRow(row));
    } catch (error) {
      if (isUnavailable(error)) {
        throw new AffiliateCommissionError(
          "Affiliate commission approval storage is unavailable",
          503,
          "AFFILIATE_COMMISSION_STORAGE_UNAVAILABLE"
        );
      }
      throw error;
    }
  }
}

export const affiliateCommissionApprovalService =
  new AffiliateCommissionApprovalService();
