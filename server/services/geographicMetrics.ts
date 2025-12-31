import { db } from "../db";
import {
  users,
  counties,
  businesses,
  businessCounties,
  affiliateAccounts,
  countyMetrics,
  type InsertCountyMetric,
} from "../../shared/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";

export type CountyMetricsRefreshResult = {
  activeCountyCount: number;
  metricsWritten: number;
};

export async function refreshCountyMetrics(): Promise<CountyMetricsRefreshResult> {
  const startedAt = Date.now();
  console.log("[geo-metrics] Refreshing county_metrics...");

  const userRows = await db
    .select({
      countyFips: users.countyFips,
      usersTotal: sql<number>`COUNT(*)`,
      contractorsTotal: sql<number>`SUM(CASE WHEN ${users.role} IN ('contractor','handyman','service_provider','specialty_tradesperson','inspector','realtor','mortgage_broker','insurance_agent','car_dealer','auto_service') THEN 1 ELSE 0 END)` ,
      homeownersTotal: sql<number>`SUM(CASE WHEN ${users.role} IN ('homeowner','renter','landlord','hoa_member','property_manager') THEN 1 ELSE 0 END)`,
      verifiedTotal: sql<number>`SUM(CASE WHEN ${users.emailVerified} = true OR ${users.verificationStatus} = 'approved' THEN 1 ELSE 0 END)`,
    })
    .from(users)
    .where(isNotNull(users.countyFips))
    .groupBy(users.countyFips);

  const activeCountyFips = new Set<string>();
  const metrics: InsertCountyMetric[] = [];

  for (const row of userRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips) continue;

    const usersTotal = Number(row.usersTotal || 0);
    if (!Number.isFinite(usersTotal) || usersTotal <= 0) continue;

    activeCountyFips.add(countyFips);

    const verifiedTotal = Number(row.verifiedTotal || 0);
    const contractorsTotal = Number(row.contractorsTotal || 0);
    const homeownersTotal = Number(row.homeownersTotal || 0);

    metrics.push(
      {
        countyFips,
        metricKey: "users",
        metricValue: String(usersTotal),
        updatedAt: new Date(),
      },
      {
        countyFips,
        metricKey: "users_total",
        metricValue: String(usersTotal),
        updatedAt: new Date(),
      },
    );

    if (verifiedTotal > 0) {
      metrics.push({
        countyFips,
        metricKey: "users_verified",
        metricValue: String(verifiedTotal),
        updatedAt: new Date(),
      });
    }

    if (contractorsTotal > 0) {
      metrics.push({
        countyFips,
        metricKey: "contractors",
        metricValue: String(contractorsTotal),
        updatedAt: new Date(),
      });
    }

    if (homeownersTotal > 0) {
      metrics.push({
        countyFips,
        metricKey: "homeowners_total",
        metricValue: String(homeownersTotal),
        updatedAt: new Date(),
      });
    }
  }

  // Businesses per county (active businesses only)
  const businessRows = await db
    .select({
      countyFips: counties.fips,
      businessCount: sql<number>`COUNT(DISTINCT ${businessCounties.businessId})::int`,
    })
    .from(businessCounties)
    .innerJoin(businesses, eq(businessCounties.businessId, businesses.id))
    .innerJoin(counties, eq(businessCounties.countyId, counties.id))
    .where(eq(businesses.status, "active" as any))
    .groupBy(counties.fips);

  for (const row of businessRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips || !activeCountyFips.has(countyFips)) continue;

    const count = Number(row.businessCount || 0);
    if (!Number.isFinite(count) || count <= 0) continue;

    metrics.push({
      countyFips,
      metricKey: "businesses_total",
      metricValue: String(count),
      updatedAt: new Date(),
    });
  }

  // Affiliates per county (active affiliate accounts only)
  const affiliateRows = await db
    .select({
      countyFips: users.countyFips,
      affiliateCount: sql<number>`COUNT(DISTINCT ${affiliateAccounts.affiliateId})::int`,
    })
    .from(affiliateAccounts)
    .innerJoin(users, eq(affiliateAccounts.affiliateId, users.id))
    .where(and(isNotNull(users.countyFips), eq(affiliateAccounts.status, "active")))
    .groupBy(users.countyFips);

  for (const row of affiliateRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips || !activeCountyFips.has(countyFips)) continue;

    const count = Number(row.affiliateCount || 0);
    if (!Number.isFinite(count) || count <= 0) continue;

    metrics.push({
      countyFips,
      metricKey: "affiliates_count",
      metricValue: String(count),
      updatedAt: new Date(),
    });
  }

  if (metrics.length === 0) {
    console.log("[geo-metrics] No metrics to upsert.");
    return {
      activeCountyCount: activeCountyFips.size,
      metricsWritten: 0,
    };
  }

  console.log(`[geo-metrics] Upserting ${metrics.length} county_metrics rows across ${activeCountyFips.size} active counties...`);

  const batchSize = 500;
  for (let i = 0; i < metrics.length; i += batchSize) {
    const batch = metrics.slice(i, i + batchSize);
    await db
      .insert(countyMetrics)
      .values(batch)
      .onConflictDoUpdate({
        target: [countyMetrics.countyFips, countyMetrics.metricKey],
        set: {
          metricValue: sql`excluded.metric_value`,
          updatedAt: new Date(),
        },
      });
  }

  const durationMs = Date.now() - startedAt;
  console.log(
    `[geo-metrics] county_metrics refresh complete in ${durationMs}ms; activeCounties=${activeCountyFips.size}, metricsWritten=${metrics.length}`,
  );

  return {
    activeCountyCount: activeCountyFips.size,
    metricsWritten: metrics.length,
  };
}
