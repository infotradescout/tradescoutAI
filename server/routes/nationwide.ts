import { Request, Response } from "express";
import { db } from "../db";
import { storage } from "../storage";
import {
  affiliateAccounts,
  affiliatePayouts,
  affiliateReferrals,
  counties,
  countyMetrics,
  users,
} from "../../shared/schema";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

// Get nationwide expansion metrics
export async function getNationwideMetrics(req: Request, res: Response) {
  try {
    const metrics = await storage.getNationwideMetrics();
    res.json(metrics);
  } catch (error) {
    console.error("Error fetching nationwide metrics:", error);
    res.status(500).json({ message: "Failed to fetch nationwide metrics" });
  }
}

// Get top performing counties
export async function getTopCounties(req: Request, res: Response) {
  try {
    const { limit = "10" } = req.query;
    const counties = await storage.getTopPerformingCounties(parseInt(limit as string));
    res.json(counties);
  } catch (error) {
    console.error("Error fetching top counties:", error);
    res.status(500).json({ message: "Failed to fetch top counties" });
  }
}

// Get expansion pipeline
export async function getExpansionPipeline(req: Request, res: Response) {
  try {
    const pipeline = await storage.getExpansionPipeline();
    res.json(pipeline);
  } catch (error) {
    console.error("Error fetching expansion pipeline:", error);
    res.status(503).json({ message: "Expansion pipeline data is temporarily unavailable" });
  }
}

// Get foundation impact metrics
export async function getFoundationImpact(req: Request, res: Response) {
  try {
    const stats = await storage.getFoundationStats();

    res.json({
      totalRaised: Number(stats?.totalRaised ?? 0),
      totalDonors: Number(stats?.totalDonors ?? 0),
      activeCauses: Number(stats?.activeCauses ?? 0),
      countiesSupported: Number(stats?.countiesSupported ?? 0),
    });
  } catch (error) {
    console.error("Error fetching foundation impact:", error);
    res.status(500).json({ message: "Failed to fetch foundation impact" });
  }
}

// Submit county activation request
export async function requestCountyActivation(req: Request, res: Response) {
  try {
    const userId = (req.user as any)?.id || (req.user as any)?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { countyFips, contactInfo, marketData, businessCase } = (req.body ?? {}) as any;

    if (!countyFips || typeof countyFips !== "string") {
      return res.status(400).json({ message: "countyFips is required" });
    }

    const payload = {
      requestedBy: String(userId),
      countyFips,
      contactInfo: contactInfo ?? null,
      marketData: marketData ?? null,
      businessCase: businessCase ?? null,
      requestedAt: new Date().toISOString(),
    };

    await storage.createCountyNote({
      countyFips,
      authorUserId: String(userId),
      category: "operations",
      content: `county_activation_request:${JSON.stringify(payload)}`,
    } as any);

    res.status(201).json({
      ok: true,
      countyFips,
      status: "pending_review",
      requestedAt: payload.requestedAt,
    });
  } catch (error) {
    console.error("Error submitting county activation request:", error);
    res.status(500).json({ message: "Failed to submit activation request" });
  }
}

// Get county coverage map data
export async function getCoverageMapData(req: Request, res: Response) {
  try {
    const metricRows = await db
      .select({
        countyFips: countyMetrics.countyFips,
        metricKey: countyMetrics.metricKey,
        metricValue: countyMetrics.metricValue,
      })
      .from(countyMetrics)
      .where(
        inArray(countyMetrics.metricKey, [
          "active_users",
          "verified_contractors",
          "active_projects",
        ])
      );

    const userCounts = await db
      .select({
        countyFips: users.countyFips,
        totalUsers: sql<number>`count(*)`,
      })
      .from(users)
      .where(isNotNull(users.countyFips))
      .groupBy(users.countyFips);

    const countyLookup = await db
      .select({
        fips: counties.fips,
        name: counties.name,
        stateCode: counties.stateCode,
      })
      .from(counties);

    const nameByFips = new Map<
      string,
      { fips: string; name: string | null; stateCode: string | null }
    >(countyLookup.map((c) => [String(c.fips), c]));
    const metricsByCounty = new Map<string, Record<string, number>>();
    for (const row of metricRows) {
      const bucket = metricsByCounty.get(row.countyFips) || {};
      bucket[row.metricKey] = Number(row.metricValue ?? 0);
      metricsByCounty.set(row.countyFips, bucket);
    }
    for (const row of userCounts) {
      const countyFips = String(row.countyFips || "");
      if (!countyFips) continue;
      const bucket = metricsByCounty.get(countyFips) || {};
      if (!bucket.active_users) bucket.active_users = Number(row.totalUsers || 0);
      metricsByCounty.set(countyFips, bucket);
    }

    const countiesOut = Array.from(metricsByCounty.entries()).map(([countyFips, values]) => {
      const geo = nameByFips.get(countyFips);
      return {
        countyFips,
        countyName: geo?.name || countyFips,
        stateCode: geo?.stateCode || null,
        activeUsers: Number(values.active_users || 0),
        verifiedContractors: Number(values.verified_contractors || 0),
        activeProjects: Number(values.active_projects || 0),
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      counties: countiesOut,
    });
  } catch (error) {
    console.error("Error fetching coverage map data:", error);
    res.status(500).json({ message: "Failed to fetch coverage map data" });
  }
}

// Get affiliate program performance
export async function getAffiliatePerformance(req: Request, res: Response) {
  try {
    const [accountsAgg] = await db
      .select({
        totalAffiliates: sql<number>`count(*)`,
        totalLifetimeEarned: sql<string>`coalesce(sum(${affiliateAccounts.lifetimeEarned}), 0)`,
        totalAvailable: sql<string>`coalesce(sum(${affiliateAccounts.available}), 0)`,
      })
      .from(affiliateAccounts);

    const [referralsAgg] = await db
      .select({
        trueReferrals: sql<number>`count(distinct ${affiliateReferrals.referredUserId})`,
        attributedPageViews: sql<number>`count(*) filter (where ${affiliateReferrals.referredUserId} is null)`,
      })
      .from(affiliateReferrals);

    const [payoutsAgg] = await db
      .select({
        totalPayouts: sql<number>`count(*)`,
        paidPayouts: sql<number>`count(*) filter (where ${affiliatePayouts.status} = 'completed')`,
        totalPayoutAmount: sql<string>`coalesce(sum(${affiliatePayouts.payoutAmount}), 0)`,
      })
      .from(affiliatePayouts);

    const recentPayouts = await db
      .select({
        id: affiliatePayouts.id,
        affiliateId: affiliatePayouts.affiliateId,
        payoutAmount: affiliatePayouts.payoutAmount,
        status: affiliatePayouts.status,
        createdAt: affiliatePayouts.createdAt,
      })
      .from(affiliatePayouts)
      .orderBy(desc(affiliatePayouts.createdAt))
      .limit(20);

    const trueReferrals = Number(referralsAgg?.trueReferrals || 0);
    const attributedPageViews = Number(referralsAgg?.attributedPageViews || 0);

    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        affiliates: Number(accountsAgg?.totalAffiliates || 0),
        referrals: trueReferrals,
        attributedPageViews,
        convertedReferrals: trueReferrals,
        // Repeated page-view rows are not unique visitors, so a trustworthy
        // visitor conversion rate is not available from this legacy table.
        conversionRate: 0,
        conversionRateAvailable: false,
        lifetimeEarned: String(accountsAgg?.totalLifetimeEarned || "0"),
        availableBalance: String(accountsAgg?.totalAvailable || "0"),
        payouts: Number(payoutsAgg?.totalPayouts || 0),
        paidPayouts: Number(payoutsAgg?.paidPayouts || 0),
        payoutAmount: String(payoutsAgg?.totalPayoutAmount || "0"),
      },
      recentPayouts,
    });
  } catch (error) {
    console.error("Error fetching affiliate performance:", error);
    res.status(500).json({ message: "Failed to fetch affiliate performance" });
  }
}
