/**
 * Pricing Analytics Service
 * Tracks job quotes, price trends, and regional variations for admin insights
 * and automatic calculator updates
 */

import { db } from "./db";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  contractorTrades,
  counties,
  leads,
  pricingData,
  providerDeclarations,
  trades,
  userProfiles,
  users,
  workRequests,
} from "@shared/schema";

export interface PricingAnalytics {
  averageQuotes: {
    byTrade: Record<string, { average: number; count: number; trend: number }>;
    byRegion: Record<string, { average: number; count: number; trend: number }>;
    byProject: Record<string, { average: number; count: number; trend: number }>;
  };
  priceFluctuations: {
    trades: Array<{
      tradeId: string;
      tradeName: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
    regions: Array<{
      countyId: string;
      countyName: string;
      stateCode: string;
      currentAvg: number;
      previousAvg: number;
      percentChange: number;
      period: string;
    }>;
  };
  popularProjects: Array<{
    projectType: string;
    quoteCount: number;
    averageValue: number;
    growth: number;
  }>;
  marketInsights: {
    topPerformingRegions: Array<{
      county: string;
      state: string;
      averageQuote: number;
      volume: number;
    }>;
    emergingTrends: Array<{
      trend: string;
      growth: number;
      description: string;
    }>;
  };
}

export class PricingAnalyticsService {
  private getTimeWindow(timeframe: "7d" | "30d" | "90d") {
    const now = new Date();
    const days = timeframe === "7d" ? 7 : timeframe === "90d" ? 90 : 30;
    const currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(currentStart.getTime() - days * 24 * 60 * 60 * 1000);
    return { now, days, currentStart, previousStart };
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private percentChange(current: number, previous: number): number {
    if (previous <= 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private estimatePreviousFromTrend(current: number, trendPercent: number): number {
    if (!Number.isFinite(current) || current <= 0) return 0;
    if (!Number.isFinite(trendPercent)) return current;
    const denominator = 1 + trendPercent / 100;
    if (!Number.isFinite(denominator) || denominator <= 0) return current;
    return current / denominator;
  }

  /**
   * Get comprehensive pricing analytics for admin dashboard
   */
  async getPricingAnalytics(timeframe: "7d" | "30d" | "90d" = "30d"): Promise<PricingAnalytics> {
    const { now, currentStart, previousStart } = this.getTimeWindow(timeframe);

    const currentTradeRows = await db
      .select({
        tradeId: leads.tradeId,
        tradeName: trades.name,
        count: sql<number>`count(*)::int`,
        avgValue: sql<number>`coalesce(avg(cast(${leads.estimatedValue} as numeric)), 0)::float`,
      })
      .from(leads)
      .leftJoin(trades, eq(leads.tradeId, trades.id))
      .where(and(gte(leads.createdAt, currentStart), lt(leads.createdAt, now)))
      .groupBy(leads.tradeId, trades.name);

    const previousTradeRows = await db
      .select({
        tradeId: leads.tradeId,
        avgValue: sql<number>`coalesce(avg(cast(${leads.estimatedValue} as numeric)), 0)::float`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, previousStart), lt(leads.createdAt, currentStart)))
      .groupBy(leads.tradeId);

    const previousTradeMap = new Map<string, number>();
    for (const row of previousTradeRows) {
      if (row.tradeId) previousTradeMap.set(row.tradeId, this.toNumber(row.avgValue));
    }

    const byTrade: Record<string, { average: number; count: number; trend: number }> = {};
    const tradeFluctuations: PricingAnalytics["priceFluctuations"]["trades"] = [];

    for (const row of currentTradeRows) {
      const tradeId = row.tradeId || "unknown";
      const tradeName = row.tradeName || tradeId;
      const currentAvg = this.toNumber(row.avgValue);
      const previousAvg = previousTradeMap.get(tradeId) ?? 0;
      const trend = this.percentChange(currentAvg, previousAvg);

      byTrade[tradeName] = {
        average: Math.round(currentAvg),
        count: this.toNumber(row.count),
        trend,
      };

      tradeFluctuations.push({
        tradeId,
        tradeName,
        currentAvg: Math.round(currentAvg),
        previousAvg: Math.round(previousAvg),
        percentChange: trend,
        period: timeframe,
      });
    }

    // Fallback: derive trade pricing from real pricing catalog rows.
    if (Object.keys(byTrade).length === 0) {
      const midpointExpr = sql<number>`
        case
          when ${pricingData.baseLow} is not null and ${pricingData.baseHigh} is not null
            then (cast(${pricingData.baseLow} as numeric) + cast(${pricingData.baseHigh} as numeric)) / 2
          when ${pricingData.baseLow} is not null then cast(${pricingData.baseLow} as numeric)
          when ${pricingData.baseHigh} is not null then cast(${pricingData.baseHigh} as numeric)
          else null
        end
      `;

      const currentCatalogRows = await db
        .select({
          service: pricingData.service,
          count: sql<number>`count(*)::int`,
          avgValue: sql<number>`coalesce(avg(${midpointExpr}), 0)::float`,
        })
        .from(pricingData)
        .where(
          sql`coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) >= ${currentStart}
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) < ${now}`
        )
        .groupBy(pricingData.service);

      const previousCatalogRows = await db
        .select({
          service: pricingData.service,
          avgValue: sql<number>`coalesce(avg(${midpointExpr}), 0)::float`,
        })
        .from(pricingData)
        .where(
          sql`coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) >= ${previousStart}
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) < ${currentStart}`
        )
        .groupBy(pricingData.service);

      const previousCatalogMap = new Map<string, number>();
      for (const row of previousCatalogRows) {
        if (row.service) previousCatalogMap.set(String(row.service), this.toNumber(row.avgValue));
      }

      const services = currentCatalogRows
        .map((row) => String(row.service || "").trim())
        .filter(Boolean);
      const uniqueServices = Array.from(new Set(services));
      const tradeRows =
        uniqueServices.length > 0
          ? await db
              .select({ slug: trades.slug, name: trades.name })
              .from(trades)
              .where(inArray(trades.slug, uniqueServices))
          : [];
      const serviceNameMap = new Map(tradeRows.map((t) => [String(t.slug), String(t.name)]));

      for (const row of currentCatalogRows) {
        const service = String(row.service || "").trim();
        if (!service) continue;
        const tradeName = serviceNameMap.get(service) || service;
        const currentAvg = Math.round(this.toNumber(row.avgValue));
        const previousAvg = previousCatalogMap.get(service) ?? currentAvg;
        const trend = this.percentChange(currentAvg, previousAvg);

        byTrade[tradeName] = {
          average: currentAvg,
          count: this.toNumber(row.count),
          trend,
        };

        tradeFluctuations.push({
          tradeId: service,
          tradeName,
          currentAvg,
          previousAvg: Math.round(previousAvg),
          percentChange: trend,
          period: timeframe,
        });
      }
    }

    // Fallback: if no lead/catalog trade stats exist, use provider trade coverage so admins
    // still see tracked trades and onboarding signal.
    if (Object.keys(byTrade).length === 0) {
      const providerDeclarationRows = await db
        .select({ tradeIds: providerDeclarations.tradeIds })
        .from(providerDeclarations);

      const declarationTradeCounts = new Map<string, number>();
      for (const row of providerDeclarationRows) {
        const ids = Array.isArray(row.tradeIds) ? row.tradeIds : [];
        for (const tradeId of ids) {
          const key = String(tradeId || "").trim();
          if (!key) continue;
          declarationTradeCounts.set(key, (declarationTradeCounts.get(key) ?? 0) + 1);
        }
      }

      if (declarationTradeCounts.size > 0) {
        const tradeIds = [...declarationTradeCounts.keys()];
        const tradeRows = await db
          .select({ id: trades.id, name: trades.name })
          .from(trades)
          .where(inArray(trades.id, tradeIds));
        const tradeNameMap = new Map(tradeRows.map((t) => [t.id, t.name]));

        for (const [tradeId, count] of declarationTradeCounts.entries()) {
          const tradeName = tradeNameMap.get(tradeId) || tradeId;
          byTrade[tradeName] = {
            average: 0,
            count,
            trend: 0,
          };
        }
      }
    }

    // Secondary fallback: use contractor-trade coverage if declaration trades are unavailable.
    if (Object.keys(byTrade).length === 0) {
      const providerTradeRows = await db
        .select({
          tradeId: contractorTrades.tradeId,
          tradeName: trades.name,
          count: sql<number>`count(*)::int`,
        })
        .from(contractorTrades)
        .leftJoin(trades, eq(contractorTrades.tradeId, trades.id))
        .groupBy(contractorTrades.tradeId, trades.name);

      for (const row of providerTradeRows) {
        const tradeName = row.tradeName || row.tradeId || "unknown";
        byTrade[tradeName] = {
          average: 0,
          count: this.toNumber(row.count),
          trend: 0,
        };
      }
    }

    // Tertiary fallback: derive trade coverage from user profile service tags.
    if (Object.keys(byTrade).length === 0) {
      const profileTagRows = await db.select({ tags: userProfiles.serviceTags }).from(userProfiles);
      const tagCounts = new Map<string, number>();

      for (const row of profileTagRows) {
        const tags = Array.isArray(row.tags) ? row.tags : [];
        for (const tag of tags) {
          const key = String(tag || "").trim();
          if (!key) continue;
          tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
        }
      }

      for (const [tag, count] of tagCounts.entries()) {
        byTrade[tag] = {
          average: 0,
          count,
          trend: 0,
        };
      }
    }

    const currentRegionRows = await db
      .select({
        countyId: leads.countyId,
        countyName: counties.name,
        stateCode: counties.stateCode,
        count: sql<number>`count(*)::int`,
        avgValue: sql<number>`coalesce(avg(cast(${leads.estimatedValue} as numeric)), 0)::float`,
      })
      .from(leads)
      .leftJoin(counties, eq(leads.countyId, counties.id))
      .where(and(gte(leads.createdAt, currentStart), lt(leads.createdAt, now)))
      .groupBy(leads.countyId, counties.name, counties.stateCode);

    const previousRegionRows = await db
      .select({
        countyId: leads.countyId,
        avgValue: sql<number>`coalesce(avg(cast(${leads.estimatedValue} as numeric)), 0)::float`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, previousStart), lt(leads.createdAt, currentStart)))
      .groupBy(leads.countyId);

    const previousRegionMap = new Map<string, number>();
    for (const row of previousRegionRows) {
      if (row.countyId) previousRegionMap.set(row.countyId, this.toNumber(row.avgValue));
    }

    const byRegion: Record<string, { average: number; count: number; trend: number }> = {};
    const regionFluctuations: PricingAnalytics["priceFluctuations"]["regions"] = [];

    for (const row of currentRegionRows) {
      const countyId = row.countyId || "unknown";
      const countyName = row.countyName || countyId;
      const stateCode = row.stateCode || "NA";
      const key = `${countyName}, ${stateCode}`;
      const currentAvg = this.toNumber(row.avgValue);
      const previousAvg = previousRegionMap.get(countyId) ?? 0;
      const trend = this.percentChange(currentAvg, previousAvg);

      byRegion[key] = {
        average: Math.round(currentAvg),
        count: this.toNumber(row.count),
        trend,
      };

      regionFluctuations.push({
        countyId,
        countyName,
        stateCode,
        currentAvg: Math.round(currentAvg),
        previousAvg: Math.round(previousAvg),
        percentChange: trend,
        period: timeframe,
      });
    }

    if (Object.keys(byRegion).length === 0) {
      const midpointExpr = sql<number>`
        case
          when ${pricingData.baseLow} is not null and ${pricingData.baseHigh} is not null
            then (cast(${pricingData.baseLow} as numeric) + cast(${pricingData.baseHigh} as numeric)) / 2
          when ${pricingData.baseLow} is not null then cast(${pricingData.baseLow} as numeric)
          when ${pricingData.baseHigh} is not null then cast(${pricingData.baseHigh} as numeric)
          else null
        end
      `;

      const currentRegionCatalogRows = await db
        .select({
          fips: pricingData.fips,
          countyName: counties.name,
          stateCode: counties.stateCode,
          count: sql<number>`count(*)::int`,
          avgValue: sql<number>`coalesce(avg(${midpointExpr}), 0)::float`,
        })
        .from(pricingData)
        .leftJoin(counties, eq(pricingData.fips, counties.fips))
        .where(
          sql`${pricingData.fips} <> '00000'
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) >= ${currentStart}
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) < ${now}`
        )
        .groupBy(pricingData.fips, counties.name, counties.stateCode);

      const previousRegionCatalogRows = await db
        .select({
          fips: pricingData.fips,
          avgValue: sql<number>`coalesce(avg(${midpointExpr}), 0)::float`,
        })
        .from(pricingData)
        .where(
          sql`${pricingData.fips} <> '00000'
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) >= ${previousStart}
              and coalesce(${pricingData.updatedAt}, ${pricingData.createdAt}) < ${currentStart}`
        )
        .groupBy(pricingData.fips);

      const previousRegionCatalogMap = new Map<string, number>();
      for (const row of previousRegionCatalogRows) {
        const fips = String(row.fips || "").trim();
        if (!fips) continue;
        previousRegionCatalogMap.set(fips, this.toNumber(row.avgValue));
      }

      for (const row of currentRegionCatalogRows) {
        const fips = String(row.fips || "").trim();
        if (!fips) continue;
        const countyName = row.countyName || fips;
        const stateCode = row.stateCode || "NA";
        const key = `${countyName}, ${stateCode}`;
        const currentAvg = Math.round(this.toNumber(row.avgValue));
        const previousAvg = previousRegionCatalogMap.get(fips) ?? currentAvg;
        const trend = this.percentChange(currentAvg, previousAvg);

        byRegion[key] = {
          average: currentAvg,
          count: this.toNumber(row.count),
          trend,
        };

        regionFluctuations.push({
          countyId: fips,
          countyName,
          stateCode,
          currentAvg,
          previousAvg: Math.round(previousAvg),
          percentChange: trend,
          period: timeframe,
        });
      }
    }

    if (Object.keys(byRegion).length === 0) {
      const declarationRows = await db
        .select({ serviceAreas: providerDeclarations.serviceAreas })
        .from(providerDeclarations);

      const countyFipsCounts = new Map<string, number>();
      for (const row of declarationRows) {
        const areas = Array.isArray(row.serviceAreas) ? row.serviceAreas : [];
        for (const area of areas) {
          const fips = String((area as any)?.countyFips || "").trim();
          if (!fips) continue;
          countyFipsCounts.set(fips, (countyFipsCounts.get(fips) ?? 0) + 1);
        }
      }

      if (countyFipsCounts.size > 0) {
        const fipsValues = [...countyFipsCounts.keys()];
        const countyRows = await db
          .select({
            id: counties.id,
            fips: counties.fips,
            name: counties.name,
            stateCode: counties.stateCode,
          })
          .from(counties)
          .where(inArray(counties.fips, fipsValues));

        for (const county of countyRows) {
          const count = countyFipsCounts.get(county.fips) ?? 0;
          const key = `${county.name}, ${county.stateCode}`;
          byRegion[key] = {
            average: 0,
            count,
            trend: 0,
          };

          regionFluctuations.push({
            countyId: county.id,
            countyName: county.name,
            stateCode: county.stateCode,
            currentAvg: 0,
            previousAvg: 0,
            percentChange: 0,
            period: timeframe,
          });
        }
      }
    }

    // Final fallback: derive region coverage from users with county assignments.
    if (Object.keys(byRegion).length === 0) {
      const userRegionRows = await db
        .select({
          countyId: users.countyId,
          countyName: counties.name,
          stateCode: counties.stateCode,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .leftJoin(counties, eq(users.countyId, counties.id))
        .where(sql`${users.countyId} is not null`)
        .groupBy(users.countyId, counties.name, counties.stateCode);

      for (const row of userRegionRows) {
        const countyId = row.countyId || "unknown";
        const countyName = row.countyName || countyId;
        const stateCode = row.stateCode || "NA";
        const key = `${countyName}, ${stateCode}`;
        const count = this.toNumber(row.count);

        byRegion[key] = {
          average: 0,
          count,
          trend: 0,
        };

        regionFluctuations.push({
          countyId,
          countyName,
          stateCode,
          currentAvg: 0,
          previousAvg: 0,
          percentChange: 0,
          period: timeframe,
        });
      }
    }

    const currentProjectRows = await db
      .select({
        projectType: leads.projectType,
        count: sql<number>`count(*)::int`,
        avgValue: sql<number>`coalesce(avg(cast(${leads.estimatedValue} as numeric)), 0)::float`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, currentStart), lt(leads.createdAt, now)))
      .groupBy(leads.projectType);

    const previousProjectRows = await db
      .select({
        projectType: leads.projectType,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, previousStart), lt(leads.createdAt, currentStart)))
      .groupBy(leads.projectType);

    const previousProjectMap = new Map<string, number>();
    for (const row of previousProjectRows) {
      if (row.projectType) previousProjectMap.set(row.projectType, this.toNumber(row.count));
    }

    let popularProjects: PricingAnalytics["popularProjects"] = currentProjectRows
      .filter((row) => Boolean(row.projectType))
      .map((row) => {
        const projectType = row.projectType || "unknown";
        const quoteCount = this.toNumber(row.count);
        const previousCount = previousProjectMap.get(projectType) ?? 0;
        return {
          projectType,
          quoteCount,
          averageValue: Math.round(this.toNumber(row.avgValue)),
          growth: this.percentChange(quoteCount, previousCount),
        };
      })
      .sort((a, b) => b.quoteCount - a.quoteCount)
      .slice(0, 20);

    // Fallback: derive project demand from real Direct Connect / work request traffic.
    if (popularProjects.length === 0) {
      const projectKeyExpr = sql<string>`
        coalesce(
          nullif(${workRequests.category}, ''),
          nullif(${workRequests.tradeId}, ''),
          'general'
        )
      `;
      const budgetMidpointExpr = sql<number>`
        case
          when ${workRequests.budgetMin} is not null and ${workRequests.budgetMax} is not null
            then (cast(${workRequests.budgetMin} as numeric) + cast(${workRequests.budgetMax} as numeric)) / 2
          when ${workRequests.budgetMin} is not null then cast(${workRequests.budgetMin} as numeric)
          when ${workRequests.budgetMax} is not null then cast(${workRequests.budgetMax} as numeric)
          else null
        end
      `;

      const currentWorkRows = await db
        .select({
          projectType: projectKeyExpr,
          count: sql<number>`count(*)::int`,
          avgValue: sql<number>`coalesce(avg(${budgetMidpointExpr}), 0)::float`,
        })
        .from(workRequests)
        .where(and(gte(workRequests.createdAt, currentStart), lt(workRequests.createdAt, now)))
        .groupBy(projectKeyExpr);

      const previousWorkRows = await db
        .select({
          projectType: projectKeyExpr,
          count: sql<number>`count(*)::int`,
        })
        .from(workRequests)
        .where(
          and(gte(workRequests.createdAt, previousStart), lt(workRequests.createdAt, currentStart))
        )
        .groupBy(projectKeyExpr);

      const previousWorkMap = new Map<string, number>();
      for (const row of previousWorkRows) {
        const key = String(row.projectType || "").trim();
        if (!key) continue;
        previousWorkMap.set(key, this.toNumber(row.count));
      }

      popularProjects = currentWorkRows
        .map((row) => {
          const projectType = String(row.projectType || "general");
          const quoteCount = this.toNumber(row.count);
          const previousCount = previousWorkMap.get(projectType) ?? 0;
          return {
            projectType,
            quoteCount,
            averageValue: Math.round(this.toNumber(row.avgValue)),
            growth: this.percentChange(quoteCount, previousCount),
          };
        })
        .sort((a, b) => b.quoteCount - a.quoteCount)
        .slice(0, 20);
    }

    // Final fallback: use real trade activity as project proxy when project labels are sparse.
    if (popularProjects.length === 0) {
      popularProjects = Object.entries(byTrade)
        .map(([projectType, value]) => ({
          projectType,
          quoteCount: this.toNumber(value.count),
          averageValue: this.toNumber(value.average),
          growth: this.toNumber(value.trend),
        }))
        .sort((a, b) => b.quoteCount - a.quoteCount)
        .slice(0, 20);
    }

    const byProject: Record<string, { average: number; count: number; trend: number }> = {};
    for (const row of popularProjects) {
      byProject[row.projectType] = {
        average: row.averageValue,
        count: row.quoteCount,
        trend: row.growth,
      };
    }

    if (tradeFluctuations.length === 0) {
      for (const [tradeName, value] of Object.entries(byTrade)) {
        const currentAvg = this.toNumber(value.average);
        const trend = this.toNumber(value.trend);
        const previousAvg = Math.round(this.estimatePreviousFromTrend(currentAvg, trend));
        tradeFluctuations.push({
          tradeId: tradeName.toLowerCase().replace(/\s+/g, "-"),
          tradeName,
          currentAvg: Math.round(currentAvg),
          previousAvg,
          percentChange: trend,
          period: timeframe,
        });
      }
    }

    if (regionFluctuations.length === 0) {
      for (const [regionKey, value] of Object.entries(byRegion)) {
        const [countyName, stateCodeRaw] = regionKey.split(",");
        const stateCode = String(stateCodeRaw || "NA").trim();
        const currentAvg = this.toNumber(value.average);
        const trend = this.toNumber(value.trend);
        const previousAvg = Math.round(this.estimatePreviousFromTrend(currentAvg, trend));
        regionFluctuations.push({
          countyId: regionKey.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          countyName: String(countyName || regionKey).trim(),
          stateCode,
          currentAvg: Math.round(currentAvg),
          previousAvg,
          percentChange: trend,
          period: timeframe,
        });
      }
    }

    const topPerformingRegions = [...regionFluctuations]
      .sort((a, b) => b.currentAvg - a.currentAvg)
      .slice(0, 10)
      .map((r) => ({
        county: r.countyName,
        state: r.stateCode,
        averageQuote: r.currentAvg,
        volume: byRegion[`${r.countyName}, ${r.stateCode}`]?.count ?? 0,
      }));

    const emergingTrends = [...tradeFluctuations]
      .sort((a, b) => b.percentChange - a.percentChange)
      .slice(0, 10)
      .map((t) => ({
        trend: t.tradeName,
        growth: t.percentChange,
        description: `${t.tradeName} quote activity is ${t.percentChange >= 0 ? "up" : "down"} ${Math.abs(t.percentChange).toFixed(1)}% vs prior period.`,
      }));

    return {
      averageQuotes: {
        byTrade,
        byRegion,
        byProject,
      },
      priceFluctuations: {
        trades: tradeFluctuations.sort(
          (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
        ),
        regions: regionFluctuations.sort(
          (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
        ),
      },
      popularProjects,
      marketInsights: {
        topPerformingRegions,
        emergingTrends,
      },
    };
  }

  /**
   * Update calculator pricing based on collected data
   */
  async updateCalculatorPricing(threshold: number = 10) {
    const analytics = await this.getPricingAnalytics("30d");
    const updates = [];

    // Update pricing data for trades with significant data
    for (const [tradeId, data] of Object.entries(analytics.averageQuotes.byTrade)) {
      if (data.count >= threshold) {
        // Check if pricing data exists for this trade
        const existingPricing = await db
          .select()
          .from(pricingData)
          .where(eq(pricingData.service, tradeId))
          .limit(1);

        const newBaseLow = Math.round(data.average * 0.8);
        const newBaseHigh = Math.round(data.average * 1.2);

        if (existingPricing.length > 0) {
          // Update existing pricing
          await db
            .update(pricingData)
            .set({
              baseLow: newBaseLow.toString(),
              baseHigh: newBaseHigh.toString(),
              updatedAt: new Date(),
            })
            .where(eq(pricingData.service, tradeId));
        } else {
          // Create new pricing entry
          await db.insert(pricingData).values({
            service: tradeId,
            fips: "00000", // Default nationwide
            baseLow: newBaseLow.toString(),
            baseHigh: newBaseHigh.toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        updates.push({
          tradeId,
          oldLow: existingPricing[0]?.baseLow,
          oldHigh: existingPricing[0]?.baseHigh,
          newLow: newBaseLow,
          newHigh: newBaseHigh,
          sampleSize: data.count,
        });
      }
    }

    return {
      updatedCount: updates.length,
      updates,
    };
  }

  /**
   * Get pricing recommendations for specific regions
   */
  async getRegionalPricingRecommendations(stateCode?: string) {
    const analytics = await this.getPricingAnalytics("90d");
    const recommendations = [];

    for (const [regionKey, data] of Object.entries(analytics.averageQuotes.byRegion)) {
      if (stateCode && !regionKey.startsWith(stateCode)) continue;

      if (data.count >= 5) {
        // Minimum sample size
        const [state, countyId] = regionKey.split("-");

        recommendations.push({
          stateCode: state,
          countyId,
          recommendedLow: Math.round(data.average * 0.75),
          recommendedHigh: Math.round(data.average * 1.25),
          confidence: Math.min(data.count / 10, 1), // Confidence based on sample size
          sampleSize: data.count,
          currentAverage: data.average,
        });
      }
    }

    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }
}

export const pricingAnalyticsService = new PricingAnalyticsService();
