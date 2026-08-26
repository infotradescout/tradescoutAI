import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AffiliateCommissionApprovalService,
} from "../services/affiliateCommissionApproval";

class ScriptedPool {
  readonly queries: string[] = [];
  constructor(
    private readonly responder: (sql: string, params: unknown[]) => Promise<any[]> | any[]
  ) {}

  async query(sql: string, params: unknown[] = []) {
    this.queries.push(sql.replace(/\s+/g, " ").trim());
    return { rows: await this.responder(sql, params) };
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release: () => undefined,
    };
  }
}

function commissionRow(status: string | null = "pending") {
  return {
    id: "commission-1",
    affiliate_id: "affiliate-account-1",
    commission_status: status,
    commission_amount: "5.00",
    commission_revenue_amount: "100.00",
    commission_reference_id: "payment-1",
    commission_source_referral_id: "referral-1",
    commission_description: "Affiliate share",
    commission_approved_at: null,
    commission_approved_by: null,
    commission_approval_reason: null,
    commission_paid_at: null,
    created_at: new Date("2026-08-26T12:00:00.000Z"),
  };
}

describe("affiliate pending commission creation", () => {
  it("increments only pending and never credits a wallet before approval", async () => {
    const database = new ScriptedPool((sql) => {
      if (/SELECT id FROM affiliate_accounts/.test(sql)) return [{ id: "affiliate-account-1" }];
      if (/SELECT id\s+FROM affiliate_referrals/.test(sql)) return [{ id: "referral-1" }];
      if (/INSERT INTO affiliate_referrals/.test(sql)) return [commissionRow("pending")];
      return [];
    });
    const service = new AffiliateCommissionApprovalService(database as any);

    const result = await service.createPendingCommission({
      affiliateProgramId: "affiliate-account-1",
      referralId: "referral-1",
      transactionId: "payment-1",
      revenueAmount: "100",
      commissionAmount: "5",
      description: "Affiliate share",
    });

    expect(result.created).toBe(true);
    expect(result.status).toBe("pending");
    expect(database.queries.some((query) => query.includes("SET pending ="))).toBe(true);
    expect(database.queries.some((query) => query.includes("wallet_transactions"))).toBe(false);
    expect(database.queries.some((query) => query.includes("wallet_accounts"))).toBe(false);
  });

  it("is idempotent for the same transaction reference", async () => {
    const database = new ScriptedPool((sql) => {
      if (/SELECT id FROM affiliate_accounts/.test(sql)) return [{ id: "affiliate-account-1" }];
      if (/SELECT id\s+FROM affiliate_referrals/.test(sql)) return [{ id: "referral-1" }];
      if (/INSERT INTO affiliate_referrals/.test(sql)) return [];
      if (/SELECT \*\s+FROM affiliate_referrals/.test(sql)) return [commissionRow("pending")];
      return [];
    });
    const service = new AffiliateCommissionApprovalService(database as any);
    const result = await service.createPendingCommission({
      affiliateProgramId: "affiliate-account-1",
      referralId: "referral-1",
      transactionId: "payment-1",
      revenueAmount: "100",
      commissionAmount: "5",
    });

    expect(result.created).toBe(false);
    expect(database.queries.some((query) => query.includes("SET pending ="))).toBe(false);
  });
});

describe("affiliate approval transaction", () => {
  it("credits once, records actor/reason, and is idempotent on retry", async () => {
    let status = "pending";
    let ledgerWrites = 0;
    let auditWrites = 0;
    const database = new ScriptedPool((sql) => {
      if (/SELECT ar\.\*/.test(sql)) {
        return [
          {
            ...commissionRow(status),
            affiliate_user_id: "affiliate-user-1",
            affiliate_pending: "5.00",
          },
        ];
      }
      if (/INSERT INTO wallet_accounts/.test(sql)) return [{ id: "wallet-1" }];
      if (/INSERT INTO wallet_transactions/.test(sql)) {
        ledgerWrites += 1;
        return [{ id: "ledger-1" }];
      }
      if (/UPDATE affiliate_referrals/.test(sql)) {
        status = "approved";
        return [
          {
            ...commissionRow("approved"),
            commission_approved_at: new Date(),
            commission_approved_by: "admin-1",
            commission_approval_reason: "Verified against payment evidence",
          },
        ];
      }
      if (/INSERT INTO admin_audit_log/.test(sql)) {
        auditWrites += 1;
        return [];
      }
      return [];
    });
    const service = new AffiliateCommissionApprovalService(database as any);

    const first = await service.approveCommission({
      commissionId: "commission-1",
      approvedByUserId: "admin-1",
      reason: "Verified against payment evidence",
    });
    const retry = await service.approveCommission({
      commissionId: "commission-1",
      approvedByUserId: "admin-1",
      reason: "Verified against payment evidence",
    });

    expect(first).toMatchObject({ transitioned: true, credited: true });
    expect(retry).toMatchObject({ transitioned: false, credited: false });
    expect(ledgerWrites).toBe(1);
    expect(auditWrites).toBe(1);
    expect(database.queries.some((query) => query.includes("FOR UPDATE OF ar, aa"))).toBe(true);
  });

  it("fails closed for unverifiable legacy rows", async () => {
    const database = new ScriptedPool((sql) => {
      if (/SELECT ar\.\*/.test(sql)) {
        return [
          {
            ...commissionRow(null),
            affiliate_user_id: "affiliate-user-1",
            affiliate_pending: "5.00",
          },
        ];
      }
      return [];
    });
    const service = new AffiliateCommissionApprovalService(database as any);

    await expect(
      service.approveCommission({
        commissionId: "commission-1",
        approvedByUserId: "admin-1",
        reason: "Verified against payment evidence",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "AFFILIATE_COMMISSION_LEGACY_UNVERIFIED",
    });
    expect(database.queries.some((query) => query.includes("wallet_transactions"))).toBe(false);
  });
});


describe("affiliate route authorization contract", () => {
  it("requires privileged roles and an approval reason", () => {
    const source = readFileSync("server/routes.ts", "utf8");
    const creation = source.slice(
      source.indexOf('"/api/affiliate/commission"') - 120,
      source.indexOf("// Get referrals for affiliate")
    );
    const approval = source.slice(
      source.indexOf("// Admin: Approve and atomically credit a commission"),
      source.indexOf("// Admin: Create payout")
    );
    expect(creation).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(creation).toContain("transactionId");
    expect(approval).toContain('requireRole(["ops_admin", "super_admin"])');
    expect(approval).toContain("normalizePrivilegedReason");
    expect(approval).toContain("approvedByUserId");
  });
});
