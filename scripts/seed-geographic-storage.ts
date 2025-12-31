import { db } from "../server/db";
import {
  users,
  counties,
  businesses,
  businessCounties,
  affiliateAccounts,
  countyMetrics,
  countyEntities,
  countyNotes,
  type InsertCountyMetric,
  type InsertCountyEntity,
  type InsertCountyNote,
} from "../shared/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

type MetricMap = Record<string, number>;

async function seedCountyMetrics() {
  console.log("[geo-seed] Seeding county_metrics...");

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
    console.log("[geo-seed] No metrics to upsert.");
    return;
  }

  console.log(`[geo-seed] Upserting ${metrics.length} county_metrics rows...`);

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

  console.log("[geo-seed] county_metrics seeding complete.");
}

async function upsertCountyEntity(
  countyFips: string,
  entityType: "affiliate" | "employee" | "territory_manager",
  entityId: string,
  label: string | null,
  metadata?: Record<string, any>,
) {
  if (!entityId) return;

  const [existing] = await db
    .select({ id: countyEntities.id })
    .from(countyEntities)
    .where(
      and(
        eq(countyEntities.countyFips, countyFips),
        eq(countyEntities.entityType, entityType),
        eq(countyEntities.entityId, entityId),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  const values: InsertCountyEntity = {
    countyFips,
    entityType,
    entityId,
    label: label || null,
    status: "active",
    metadata: metadata || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(countyEntities).values(values);
}

async function seedCountyEntities() {
  console.log("[geo-seed] Seeding county_entities...");

  // Affiliates: affiliate accounts mapped to user home county
  const affiliateRows = await db
    .select({
      affiliateAccountId: affiliateAccounts.id,
      affiliateUserId: affiliateAccounts.affiliateId,
      countyFips: users.countyFips,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(affiliateAccounts)
    .innerJoin(users, eq(affiliateAccounts.affiliateId, users.id))
    .where(and(isNotNull(users.countyFips), eq(affiliateAccounts.status, "active")));

  console.log(`[geo-seed] Found ${affiliateRows.length} affiliate rows for entity seeding.`);

  for (const row of affiliateRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips) continue;

    const nameParts = [row.firstName, row.lastName].filter(Boolean) as string[];
    const label = nameParts.length > 0 ? nameParts.join(" ") : row.email ?? null;

    await upsertCountyEntity(countyFips, "affiliate", row.affiliateUserId as string, label, {
      affiliateAccountId: row.affiliateAccountId,
    });
  }

  // Employees: internal staff roles mapped to their home county
  const employeeRoles = [
    "support_agent",
    "content_moderator",
    "territory_manager",
    "contractor_success",
    "content_seo",
    "analytics_specialist",
    "marketing_specialist",
    "moderator",
    "ops_admin",
    "super_admin",
    "head_admin",
  ] as const;

  const employeeRows = await db
    .select({
      userId: users.id,
      countyFips: users.countyFips,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(isNotNull(users.countyFips), inArray(users.role, employeeRoles as any)));

  console.log(`[geo-seed] Found ${employeeRows.length} employee rows for entity seeding.`);

  for (const row of employeeRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips) continue;

    const nameParts = [row.firstName, row.lastName].filter(Boolean) as string[];
    const label = nameParts.length > 0 ? nameParts.join(" ") : row.email ?? null;

    await upsertCountyEntity(countyFips, "employee", row.userId as string, label, {
      primaryRole: row.role,
    });
  }

  // Territory managers: explicit entity type for users with that primary role
  const territoryRows = await db
    .select({
      userId: users.id,
      countyFips: users.countyFips,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(and(isNotNull(users.countyFips), eq(users.role, "territory_manager" as any)));

  console.log(`[geo-seed] Found ${territoryRows.length} territory manager rows for entity seeding.`);

  for (const row of territoryRows) {
    const countyFips = row.countyFips as string | null;
    if (!countyFips) continue;

    const nameParts = [row.firstName, row.lastName].filter(Boolean) as string[];
    const label = nameParts.length > 0 ? nameParts.join(" ") : row.email ?? null;

    await upsertCountyEntity(countyFips, "territory_manager", row.userId as string, label, {
      primaryRole: "territory_manager",
    });
  }

  console.log("[geo-seed] county_entities seeding complete.");
}

async function seedCountyNotes() {
  const systemUserId = process.env.SYSTEM_USER_ID;

  if (!systemUserId) {
    console.warn(
      "[geo-seed] SYSTEM_USER_ID is not set; skipping county_notes seeding to avoid mis-attribution.",
    );
    return;
  }

  console.log("[geo-seed] Seeding county_notes (system operations notes)...");

  // Determine counties with presence based on existing users_total metric or user data
  const userRows = await db
    .select({
      countyFips: users.countyFips,
      usersTotal: sql<number>`COUNT(*)`,
    })
    .from(users)
    .where(isNotNull(users.countyFips))
    .groupBy(users.countyFips);

  const activeCountyFips = new Set<string>();
  for (const row of userRows) {
    const countyFips = row.countyFips as string | null;
    const count = Number(row.usersTotal || 0);
    if (!countyFips || !Number.isFinite(count) || count <= 0) continue;
    activeCountyFips.add(countyFips);
  }

  if (activeCountyFips.size === 0) {
    console.log("[geo-seed] No active counties found for notes.");
    return;
  }

  // Fetch counties that already have notes to keep this strictly idempotent
  const existingNoteRows = await db
    .select({ countyFips: countyNotes.countyFips })
    .from(countyNotes)
    .groupBy(countyNotes.countyFips);

  const countiesWithNotes = new Set<string>(
    existingNoteRows
      .map((row) => (row.countyFips ? String(row.countyFips) : null))
      .filter((v): v is string => !!v),
  );

  const notesToInsert: InsertCountyNote[] = [];

  for (const countyFips of activeCountyFips) {
    if (countiesWithNotes.has(countyFips)) continue;

    notesToInsert.push({
      countyFips,
      authorUserId: systemUserId,
      category: "operations",
      content:
        "System-seeded county record from existing TradeScout data (initialization).",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (notesToInsert.length === 0) {
    console.log("[geo-seed] No new county_notes to insert.");
    return;
  }

  console.log(`[geo-seed] Inserting ${notesToInsert.length} system county_notes...`);

  const batchSize = 500;
  for (let i = 0; i < notesToInsert.length; i += batchSize) {
    const batch = notesToInsert.slice(i, i + batchSize);
    await db.insert(countyNotes).values(batch);
  }

  console.log("[geo-seed] county_notes seeding complete.");
}

export async function seedGeographicStorage() {
  console.log("[geo-seed] Starting geographic storage seeding...");

  await seedCountyMetrics();
  await seedCountyEntities();
  await seedCountyNotes();

  console.log("[geo-seed] Geographic storage seeding completed.");
}

if (require.main === module) {
  seedGeographicStorage()
    .then(() => {
      console.log("[geo-seed] Done.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[geo-seed] Failed:", error);
      process.exit(1);
    });
}
