import { db } from "../db";
import { and, eq, gte, lte } from "drizzle-orm";
import {
  affiliateAccounts,
  affiliateReferrals,
  affiliatePayouts,
  affiliateTrafficEvents,
} from "@shared/schema";

export interface AffiliateStats {
  affiliateId: string;
  userId: string;
  totalReferrals: number;
  totalEarnings: number;
  conversionRate: number;
  pendingBalance: number;
  paidBalance: number;
  createdAt: Date;
}

export interface Referral {
  id: string;
  affiliateId: string;
  referredUserId: string;
  shareLinkId: string | null;
  couponCode: string | null;
  conversionSource: string | null;
  conversionType: string | null;
  createdAt: Date;
}

export interface Commission {
  id: string;
  affiliateId: string;
  payoutAmount: number;
  status: "pending" | "paid" | "failed";
  method: string | null;
  createdAt: Date;
}

// ============================================================================
// AFFILIATE STATISTICS
// ============================================================================

export async function getAffiliateStats(userId: string): Promise<AffiliateStats | null> {
  try {
    const [account] = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.affiliateId, userId))
      .limit(1);

    if (!account) {
      return null;
    }

    const [{ totalReferrals }] = await db
      .select({ totalReferrals: gte(affiliateReferrals.id, "0").count }) as any;

    return {
      affiliateId: account.id,
      userId,
      totalReferrals: Number(totalReferrals ?? 0),
      totalEarnings: Number(account.lifetimeEarned ?? 0),
      conversionRate: 0,
      pendingBalance: Number(account.pending ?? 0),
      paidBalance: Number(account.available ?? 0),
      createdAt: (account.createdAt as Date) ?? new Date(),
    };
  } catch (error) {
    console.error("Error getting affiliate stats:", error);
    return null;
  }
}

export async function getAffiliateReferrals(
  affiliateId: string,
  options?: { limit?: number; offset?: number }
): Promise<Referral[]> {
  try {
    const results = await db
      .select()
      .from(affiliateReferrals)
      .where(eq(affiliateReferrals.affiliateId, affiliateId))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return results.map(r => ({
      id: r.id,
      affiliateId: r.affiliateId,
      referredUserId: r.referredUserId ?? "",
      shareLinkId: r.shareLinkId ?? null,
      couponCode: r.couponCode ?? null,
      conversionSource: r.conversionSource ?? null,
      conversionType: r.conversionType ?? null,
      createdAt: r.createdAt as Date,
    }));
  } catch (error) {
    console.error("Error getting affiliate referrals:", error);
    return [];
  }
}

export async function trackReferral(
  affiliateId: string,
  referredUserId: string,
  options?: { shareLinkId?: string; couponCode?: string; conversionSource?: string; conversionType?: string }
): Promise<Referral | null> {
  try {
    const [result] = await db
      .insert(affiliateReferrals)
      .values({
        affiliateId,
        referredUserId,
        shareLinkId: options?.shareLinkId,
        couponCode: options?.couponCode,
        conversionSource: options?.conversionSource,
        conversionType: options?.conversionType ?? "lead",
      })
      .returning();

    if (!result) return null;

    return {
      id: result.id,
      affiliateId: result.affiliateId,
      referredUserId: result.referredUserId ?? "",
      shareLinkId: result.shareLinkId ?? null,
      couponCode: result.couponCode ?? null,
      conversionSource: result.conversionSource ?? null,
      conversionType: result.conversionType ?? null,
      createdAt: result.createdAt as Date,
    };
  } catch (error) {
    console.error("Error tracking referral:", error);
    return null;
  }
}

export async function convertReferral(referralId: string): Promise<boolean> {
  try {
    // For now, just log a traffic event for conversion
    await db
      .insert(affiliateTrafficEvents)
      .values({
        shareLinkId: referralId,
        conversionType: "conversion",
        conversionsCount: 1,
        computedConversion: true,
      });

    return true;
  } catch (error) {
    console.error("Error converting referral:", error);
    return false;
  }
}

// ============================================================================
// COMMISSION TRACKING
// ============================================================================

export async function getCommissions(
  affiliateId: string,
  options?: { status?: "pending" | "paid"; limit?: number; offset?: number }
): Promise<Commission[]> {
  try {
    let where = eq(affiliatePayouts.affiliateId, affiliateId);
    if (options?.status) {
      where = and(where, eq(affiliatePayouts.status, options.status));
    }

    const results = await db
      .select()
      .from(affiliatePayouts)
      .where(where)
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);

    return results.map(p => ({
      id: p.id,
      affiliateId: p.affiliateId,
      payoutAmount: Number(p.payoutAmount ?? 0),
      status: (p.status as Commission["status"]) ?? "pending",
      method: p.method ?? null,
      createdAt: p.createdAt as Date,
    }));
  } catch (error) {
    console.error("Error getting commissions:", error);
    return [];
  }
}

export async function createCommission(
  affiliateId: string,
  amount: number
): Promise<Commission | null> {
  try {
    const [result] = await db
      .insert(affiliatePayouts)
      .values({
        affiliateId,
        payoutAmount: amount,
        status: "pending",
        method: "manual",
      })
      .returning();

    if (!result) return null;

    return {
      id: result.id,
      affiliateId: result.affiliateId,
      payoutAmount: Number(result.payoutAmount ?? 0),
      status: (result.status as Commission["status"]) ?? "pending",
      method: result.method ?? null,
      createdAt: result.createdAt as Date,
    };
  } catch (error) {
    console.error("Error creating commission:", error);
    return null;
  }
}

export async function getPendingCommissions(affiliateId: string): Promise<{
  total: number;
  commissions: Commission[];
}> {
  try {
    const commissions = await getCommissions(affiliateId, { status: "pending" });
    const total = commissions.reduce((sum, c) => sum + c.amount, 0);

    return {
      total,
      commissions,
    };
  } catch (error) {
    console.error("Error getting pending commissions:", error);
    return { total: 0, commissions: [] };
  }
}

export async function getPaidCommissions(affiliateId: string): Promise<{
  total: number;
  commissions: Commission[];
}> {
  try {
    const commissions = await getCommissions(affiliateId, { status: "paid" });
    const total = commissions.reduce((sum, c) => sum + c.amount, 0);

    return {
      total,
      commissions,
    };
  } catch (error) {
    console.error("Error getting paid commissions:", error);
    return { total: 0, commissions: [] };
  }
}

export async function markCommissionAsPaid(
  commissionId: string,
  paidDate: Date = new Date()
): Promise<boolean> {
  try {
    await db
      .update(affiliatePayouts)
      .set({
        status: "paid",
        createdAt: paidDate,
      })
      .where(eq(affiliatePayouts.id, commissionId));

    return true;
  } catch (error) {
    console.error("Error marking commission as paid:", error);
    return false;
  }
}

export async function getMonthlyStats(affiliateId: string, month: number, year: number): Promise<{
  referrals: number;
  commissions: number;
  conversions: number;
}> {
  try {
    // Get date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const referrals = await db
      .select()
      .from(affiliateReferrals)
      .where(
        and(
          eq(affiliateReferrals.affiliateId, affiliateId),
          gte(affiliateReferrals.createdAt, startDate),
          lte(affiliateReferrals.createdAt, endDate)
        )
      );

    const payouts = await db
      .select()
      .from(affiliatePayouts)
      .where(
        and(
          eq(affiliatePayouts.affiliateId, affiliateId),
          gte(affiliatePayouts.createdAt, startDate),
          lte(affiliatePayouts.createdAt, endDate)
        )
      );

    return {
      referrals: referrals.length,
      commissions: payouts.reduce((sum, p) => sum + Number(p.payoutAmount ?? 0), 0),
      conversions: referrals.filter(r => r.conversionType === "conversion").length,
    };
  } catch (error) {
    console.error("Error getting monthly stats:", error);
    return { referrals: 0, commissions: 0, conversions: 0 };
  }
}
