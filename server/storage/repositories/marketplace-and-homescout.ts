/* eslint-disable @typescript-eslint/no-explicit-any -- Preserves legacy marketplace and HomeScout storage contracts during repository extraction. */
import {
  users,
  trades,
  events,
  siteSettings,
  marketplaceCategories,
  marketplaceListings,
  marketplaceInquiries,
  marketplaceFavorites,
  marketplaceReports,
  vendorVerifications,
  buyerVerifications,
  addressVerifications,
  homeScoutListings,
  homeScoutSources,
  homeScoutIngestRuns,
  homeScoutListingEvents,
  homeScoutMarketBuckets,
  homeScoutListingReports,
  homeScoutInspectionRequests,
  homeScoutInspectionReports,
  homeScoutInspectionServiceRequests,
  countyEntities,
  type HomeScoutListing,
  type InsertHomeScoutListing,
  type HomeScoutSource,
  type InsertHomeScoutSource,
  type HomeScoutIngestRun,
  type InsertHomeScoutIngestRun,
  type HomeScoutListingEvent,
  type InsertHomeScoutListingEvent,
  type HomeScoutMarketBucket,
  type InsertHomeScoutMarketBucket,
  type HomeScoutListingReport,
  type InsertHomeScoutListingReport,
  type HomeScoutInspectionRequest,
  type InsertHomeScoutInspectionRequest,
  type HomeScoutInspectionReport,
  type InsertHomeScoutInspectionReport,
  type HomeScoutInspectionServiceRequest,
  type InsertHomeScoutInspectionServiceRequest,
  type User,
  type Contractor,
  type County,
  type MarketplaceCategory,
  type InsertMarketplaceCategory,
  type MarketplaceListing,
  type InsertMarketplaceListing,
  type MarketplaceInquiry,
  type InsertMarketplaceInquiry,
  type MarketplaceFavorite,
  type InsertMarketplaceFavorite,
  type MarketplaceReport,
  type InsertMarketplaceReport,
  type VendorVerification,
  type InsertVendorVerification,
  type BuyerVerification,
  type InsertBuyerVerification,
  type AddressVerification,
  type InsertAddressVerification,
} from "@shared/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import { db, pool as neonPool } from "../../db";
import type { IStorage } from "../contracts";

// Production hardening: HomeScout search should never 500 just because an optional
// inspection reports table hasn't been migrated yet. Cache existence checks to
// avoid per-request overhead.
const TABLE_EXISTENCE_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedHomeScoutInspectionReportsTable: { ok: boolean; checkedAt: number } | null = null;
async function hasHomeScoutInspectionReportsTable(): Promise<boolean> {
  const now = Date.now();
  if (
    cachedHomeScoutInspectionReportsTable &&
    now - cachedHomeScoutInspectionReportsTable.checkedAt <= TABLE_EXISTENCE_CACHE_TTL_MS
  ) {
    return cachedHomeScoutInspectionReportsTable.ok;
  }

  try {
    const result = await neonPool.query<{ reg: string | null }>(
      `SELECT to_regclass('public.home_scout_inspection_reports') as reg`
    );
    const ok = Boolean(result.rows?.[0]?.reg);
    cachedHomeScoutInspectionReportsTable = { ok, checkedAt: now };
    return ok;
  } catch {
    cachedHomeScoutInspectionReportsTable = { ok: false, checkedAt: now };
    return false;
  }
}

export class MarketplaceAndHomeScoutStorageRepository {
  protected coerceStringArray(value: any): string[] | null | undefined {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string");
    }
    return undefined;
  }

  // Marketplace operations
  // Categories
  async getMarketplaceCategories(): Promise<MarketplaceCategory[]> {
    return await db
      .select()
      .from(marketplaceCategories)
      .where(eq(marketplaceCategories.isActive, true))
      .orderBy(asc(marketplaceCategories.sortOrder), asc(marketplaceCategories.name));
  }

  async createMarketplaceCategory(
    categoryData: InsertMarketplaceCategory
  ): Promise<MarketplaceCategory> {
    const vr = (categoryData as any).verificationRequirements;
    const normalizedCategoryData: InsertMarketplaceCategory = {
      ...categoryData,
      verificationRequirements: vr
        ? {
            identityVerification:
              vr.identityVerification != null ? Boolean(vr.identityVerification) : undefined,
            businessLicense: vr.businessLicense != null ? Boolean(vr.businessLicense) : undefined,
            foodHandlersPermit:
              vr.foodHandlersPermit != null ? Boolean(vr.foodHandlersPermit) : undefined,
            kitchenInspection:
              vr.kitchenInspection != null ? Boolean(vr.kitchenInspection) : undefined,
            insuranceCertificate:
              vr.insuranceCertificate != null ? Boolean(vr.insuranceCertificate) : undefined,
            requiredDocuments: this.coerceStringArray(vr.requiredDocuments),
          }
        : vr,
    };

    const [category] = await db
      .insert(marketplaceCategories)
      .values(normalizedCategoryData as any)
      .returning();
    return category;
  }

  async updateMarketplaceCategory(
    id: string,
    updates: Partial<MarketplaceCategory>
  ): Promise<MarketplaceCategory> {
    const [category] = await db
      .update(marketplaceCategories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceCategories.id, id))
      .returning();
    return category;
  }

  async deleteMarketplaceCategory(id: string): Promise<void> {
    await db.delete(marketplaceCategories).where(eq(marketplaceCategories.id, id));
  }

  // Listings
  async getMarketplaceListings(
    filters: NonNullable<Parameters<IStorage["getMarketplaceListings"]>[0]> = {}
  ): Promise<MarketplaceListing[]> {
    const statusValues = marketplaceListings.status.enumValues ?? [];
    const conditionValues = marketplaceListings.condition.enumValues ?? [];

    const statusFilter =
      filters.status && statusValues.includes(filters.status as any)
        ? (filters.status as (typeof statusValues)[number])
        : statusValues.includes("active" as any)
          ? ("active" as (typeof statusValues)[number])
          : undefined;

    // Apply filters
    const conditions: SQL[] = [];

    if (statusFilter) {
      conditions.push(eq(marketplaceListings.status, statusFilter));
    }

    if (filters.categoryId) {
      conditions.push(eq(marketplaceListings.categoryId, filters.categoryId));
    }
    if (filters.sellerId) {
      conditions.push(eq(marketplaceListings.sellerId, filters.sellerId));
    }
    if (filters.county) {
      conditions.push(eq(marketplaceListings.county, filters.county));
    }
    if (filters.state) {
      conditions.push(eq(marketplaceListings.state, filters.state));
    }
    if (filters.condition && conditionValues.includes(filters.condition as any)) {
      conditions.push(
        eq(marketplaceListings.condition, filters.condition as (typeof conditionValues)[number])
      );
    }
    if (filters.priceMin !== undefined) {
      conditions.push(sql`${marketplaceListings.price} >= ${filters.priceMin}`);
    }
    if (filters.priceMax !== undefined) {
      conditions.push(sql`${marketplaceListings.price} <= ${filters.priceMax}`);
    }
    if (filters.searchQuery && String(filters.searchQuery).trim()) {
      const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
      const q = String(filters.searchQuery).trim();
      const pattern = `%${escapeLike(q)}%`;

      const searchCondition = or(
        ilike(marketplaceListings.title, pattern),
        ilike(marketplaceListings.description, pattern),
        ilike(marketplaceListings.brand, pattern),
        ilike(marketplaceListings.model, pattern)
      );

      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    // ── Category-specific spec filters ────────────────────────────────────
    if (filters.yearMin !== undefined) {
      conditions.push(sql`${marketplaceListings.year} >= ${filters.yearMin}`);
    }
    if (filters.yearMax !== undefined) {
      conditions.push(sql`${marketplaceListings.year} <= ${filters.yearMax}`);
    }
    if (filters.mileageMax !== undefined) {
      conditions.push(sql`${marketplaceListings.mileage} <= ${filters.mileageMax}`);
    }
    if (filters.titleStatus && String(filters.titleStatus).trim()) {
      conditions.push(
        sql`${marketplaceListings.specifications}->>'titleStatus' = ${filters.titleStatus}`
      );
    }
    if (filters.authenticated && String(filters.authenticated).trim()) {
      conditions.push(
        sql`${marketplaceListings.specifications}->>'authenticated' = ${filters.authenticated}`
      );
    }
    if (filters.graded && String(filters.graded).trim()) {
      conditions.push(sql`${marketplaceListings.specifications}->>'graded' = ${filters.graded}`);
    }
    // ── Additional JSONB spec filters (all categories) ────────────────────
    const jsonbSpecFilters: Array<[keyof typeof filters, string]> = [
      ["businessType", "businessType"],
      ["annualRevenueRange", "annualRevenueRange"],
      ["ownerFinancing", "ownerFinancing"],
      ["material", "material"],
      ["assemblyStatus", "assemblyStatus"],
      ["powerRequirements", "powerRequirements"],
      ["storage", "storage"],
      ["sport", "sport"],
      ["metal", "metal"],
      ["handoff", "handoff"],
      ["pickupOrDelivery", "pickupOrDelivery"],
      ["leadTime", "leadTime"],
      ["inspectionAvailable", "inspectionAvailable"],
      ["inspectionReady", "inspectionReady"],
      ["fieldReady", "fieldReady"],
      ["includesBatteries", "includesBatteries"],
      ["includesChargers", "includesChargers"],
      ["includesCase", "includesCase"],
      ["powersOn", "powersOn"],
      ["carrierStatus", "carrierStatus"],
      ["competitionReady", "competitionReady"],
      ["installRequired", "installRequired"],
    ];
    for (const [filterKey, specKey] of jsonbSpecFilters) {
      const val = filters[filterKey];
      if (val && String(val).trim()) {
        conditions.push(sql`${marketplaceListings.specifications}->>${specKey} = ${String(val)}`);
      }
    }
    // ── Hours filter (stored as top-level numeric column or in specs) ─────
    if (filters.hoursMax !== undefined) {
      conditions.push(
        sql`CAST(${marketplaceListings.specifications}->>'hours' AS NUMERIC) <= ${filters.hoursMax}`
      );
    }
    const whereClause: SQL = and(...conditions) ?? sql`true`;
    const orderByClause = (() => {
      switch (filters.sortBy) {
        case "price_asc":
          return asc(marketplaceListings.price);
        case "price_desc":
          return desc(marketplaceListings.price);
        case "date_asc":
          return asc(marketplaceListings.createdAt);
        case "date_desc":
        default:
          return desc(marketplaceListings.createdAt);
      }
    })();

    const preferredState = String(filters.preferredStateCode || "").trim();
    const preferredCountyFips = String(filters.preferredCountyFips || "").trim();
    const preferredCountyName = String(filters.preferredCountyName || "").trim();

    const countyRankClause =
      preferredCountyFips || preferredCountyName
        ? desc(
            sql<number>`CASE
              WHEN ${
                preferredCountyFips
                  ? sql`lower(${marketplaceListings.county}) = lower(${preferredCountyFips})`
                  : sql`false`
              } THEN 3
              WHEN ${
                preferredCountyName
                  ? sql`lower(${marketplaceListings.county}) = lower(${preferredCountyName})`
                  : sql`false`
              } THEN 3
              WHEN ${
                preferredCountyName
                  ? sql`lower(${marketplaceListings.county}) LIKE lower(${preferredCountyName}) || '%'`
                  : sql`false`
              } THEN 2
              ELSE 0
            END`
          )
        : undefined;

    const stateRankClause =
      preferredState && preferredState.length === 2
        ? desc(
            sql<number>`CASE
              WHEN lower(${marketplaceListings.state}) = lower(${preferredState}) THEN 1
              ELSE 0
            END`
          )
        : undefined;

    const offset = Math.max(0, Number(filters.offset ?? 0) || 0);
    const limitRequested = Number(filters.limit ?? 20) || 20;
    const limit = Math.min(100, Math.max(0, limitRequested));
    if (limit === 0) {
      return [];
    }

    return await db
      .select()
      .from(marketplaceListings)
      .where(whereClause)
      .orderBy(
        ...(countyRankClause ? [countyRankClause] : []),
        ...(stateRankClause ? [stateRankClause] : []),
        orderByClause
      )
      .limit(limit)
      .offset(offset);
  }

  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, id));
    return listing;
  }

  async getMarketplaceListingBySlug(slug: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.slug, slug));
    return listing;
  }

  // ---------------------------------------------------------------------------
  // HomeScout (Real Estate Portal)
  // ---------------------------------------------------------------------------

  async listHomeScoutSources(params?: {
    enabled?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutSource[]> {
    const limit = Math.max(1, Math.min(200, Number(params?.limit ?? 50)));
    const offset = Math.max(0, Number(params?.offset ?? 0));
    const enabled = params?.enabled;

    const predicates: (SQL | undefined)[] = [];
    if (enabled === true) predicates.push(eq(homeScoutSources.enabled, true));
    if (enabled === false) predicates.push(eq(homeScoutSources.enabled, false));

    const whereClause = predicates.length ? (and(...predicates) as any) : undefined;

    const q = db
      .select()
      .from(homeScoutSources)
      .where(whereClause as any)
      .orderBy(desc(homeScoutSources.updatedAt))
      .limit(limit)
      .offset(offset);

    return await q;
  }

  async getHomeScoutSourceById(sourceId: string): Promise<HomeScoutSource | undefined> {
    const [row] = await db.select().from(homeScoutSources).where(eq(homeScoutSources.id, sourceId));
    return row;
  }

  async getHomeScoutSourceByKey(sourceKey: string): Promise<HomeScoutSource | undefined> {
    const [row] = await db
      .select()
      .from(homeScoutSources)
      .where(eq(homeScoutSources.sourceKey, sourceKey));
    return row;
  }

  async createHomeScoutSource(
    input: Omit<InsertHomeScoutSource, "id" | "createdAt" | "updatedAt">
  ): Promise<HomeScoutSource> {
    const [row] = await db
      .insert(homeScoutSources)
      .values({ ...(input as any), updatedAt: new Date(), createdAt: new Date() } as any)
      .returning();
    return row;
  }

  async updateHomeScoutSource(
    sourceId: string,
    updates: Partial<Omit<HomeScoutSource, "id" | "createdAt">>
  ): Promise<HomeScoutSource | undefined> {
    const [row] = await db
      .update(homeScoutSources)
      .set({ ...(updates as any), updatedAt: new Date() })
      .where(eq(homeScoutSources.id, sourceId))
      .returning();
    return row;
  }

  async setHomeScoutSourceEnabled(params: {
    sourceId: string;
    enabled: boolean;
    lastError?: string | null;
  }): Promise<HomeScoutSource | undefined> {
    const [row] = await db
      .update(homeScoutSources)
      .set({
        enabled: params.enabled,
        lastError: params.lastError ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(homeScoutSources.id, params.sourceId))
      .returning();
    return row;
  }

  async createHomeScoutIngestRun(
    input: Omit<InsertHomeScoutIngestRun, "id" | "startedAt">
  ): Promise<HomeScoutIngestRun> {
    const [row] = await db
      .insert(homeScoutIngestRuns)
      .values({ ...(input as any), startedAt: new Date() } as any)
      .returning();
    return row;
  }

  async finishHomeScoutIngestRun(params: {
    runId: string;
    status: "success" | "error";
    stats?: Record<string, any>;
    error?: string | null;
  }): Promise<HomeScoutIngestRun | undefined> {
    const [row] = await db
      .update(homeScoutIngestRuns)
      .set({
        status: params.status as any,
        stats: (params.stats ?? {}) as any,
        finishedAt: new Date(),
        error: params.error ?? null,
      } as any)
      .where(eq(homeScoutIngestRuns.id, params.runId))
      .returning();
    return row;
  }

  async listHomeScoutIngestRuns(params: {
    sourceId: string;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutIngestRun[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));
    return await db
      .select()
      .from(homeScoutIngestRuns)
      .where(eq(homeScoutIngestRuns.sourceId, params.sourceId))
      .orderBy(desc(homeScoutIngestRuns.startedAt))
      .limit(limit)
      .offset(offset);
  }

  async createHomeScoutListingEvent(
    input: Omit<InsertHomeScoutListingEvent, "id" | "createdAt">
  ): Promise<HomeScoutListingEvent> {
    const [row] = await db
      .insert(homeScoutListingEvents)
      .values({ ...(input as any), createdAt: new Date() } as any)
      .returning();
    return row;
  }

  async listHomeScoutListingEvents(params: {
    listingId: string;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutListingEvent[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));

    return await db
      .select()
      .from(homeScoutListingEvents)
      .where(eq(homeScoutListingEvents.listingId, params.listingId))
      .orderBy(desc(homeScoutListingEvents.observedAt), desc(homeScoutListingEvents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getHomeScoutMarketBucket(params: {
    countyFips: string;
    stateCode: string;
    propertyType: string;
    bedsBucket?: number | null;
  }): Promise<HomeScoutMarketBucket | undefined> {
    const bedsBucket =
      params.bedsBucket == null || !Number.isFinite(Number(params.bedsBucket))
        ? null
        : Number(params.bedsBucket);

    const predicates: (SQL | undefined)[] = [
      eq(homeScoutMarketBuckets.countyFips, params.countyFips),
      eq(homeScoutMarketBuckets.stateCode, params.stateCode),
      eq(homeScoutMarketBuckets.propertyType, params.propertyType),
    ];
    if (bedsBucket == null) predicates.push(isNull(homeScoutMarketBuckets.bedsBucket));
    else predicates.push(eq(homeScoutMarketBuckets.bedsBucket, bedsBucket));

    const [row] = await db
      .select()
      .from(homeScoutMarketBuckets)
      .where(and(...predicates))
      .limit(1);
    return row;
  }

  async upsertHomeScoutMarketBucket(
    input: Omit<InsertHomeScoutMarketBucket, "id" | "updatedAt">
  ): Promise<HomeScoutMarketBucket> {
    const [row] = await db
      .insert(homeScoutMarketBuckets)
      .values({ ...(input as any), updatedAt: new Date() } as any)
      .onConflictDoUpdate({
        target: [
          homeScoutMarketBuckets.countyFips,
          homeScoutMarketBuckets.stateCode,
          homeScoutMarketBuckets.propertyType,
          homeScoutMarketBuckets.bedsBucket,
        ],
        set: {
          ...(input as any),
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getHomeScoutListingBySource(params: {
    sourceKey: string;
    sourceListingId: string;
  }): Promise<HomeScoutListing | undefined> {
    const [row] = await db
      .select()
      .from(homeScoutListings)
      .where(
        and(
          eq(homeScoutListings.sourceKey, params.sourceKey),
          eq(homeScoutListings.sourceListingId, params.sourceListingId)
        )
      )
      .limit(1);
    return row;
  }

  async upsertHomeScoutListingFromSource(params: {
    sourceKey: string;
    sourceListingId: string;
    autoActivate?: boolean;
    values: Omit<
      InsertHomeScoutListing,
      "id" | "createdAt" | "updatedAt" | "sourceKey" | "sourceListingId"
    >;
  }): Promise<{
    listing: HomeScoutListing;
    created: boolean;
    priceChanged: boolean;
    statusChanged: boolean;
  }> {
    const now = new Date();

    const existing = await this.getHomeScoutListingBySource({
      sourceKey: params.sourceKey,
      sourceListingId: params.sourceListingId,
    });

    const desiredStatus =
      (params.values as any).status ||
      (params.autoActivate ? ("active" as any) : ("pending_review" as any));

    const baseValues: any = {
      ...params.values,
      sourceKey: params.sourceKey,
      sourceListingId: params.sourceListingId,
      status: desiredStatus,
      observedAt: now,
      lastSeenAt: now,
      updatedAt: now,
    };

    if (!existing) {
      if (desiredStatus === "active") {
        baseValues.approvedAt = now;
        baseValues.listedAt = baseValues.listedAt ?? now;
      }

      const [row] = await db.insert(homeScoutListings).values(baseValues).returning();
      await this.createHomeScoutListingEvent({
        listingId: row.id,
        eventType: "created" as any,
        observedAt: now,
        payload: {
          sourceKey: params.sourceKey,
          sourceListingId: params.sourceListingId,
          status: row.status,
          price: row.price,
          listedAt: row.listedAt,
        },
      } as any);
      return { listing: row, created: true, priceChanged: false, statusChanged: false };
    }

    let priceChanged = false;
    let statusChanged = false;

    const updates: any = { ...baseValues };

    // Preserve manual moderation fields unless the listing becomes active via auto-activate.
    if (existing.status !== "active" && desiredStatus === "active" && params.autoActivate) {
      updates.approvedAt = existing.approvedAt ?? now;
      updates.listedAt = existing.listedAt ?? updates.listedAt ?? now;
    }

    const existingPrice = existing.price != null ? Number(String(existing.price)) : null;
    const nextPrice = updates.price != null ? Number(String(updates.price)) : null;
    if (existingPrice != null && nextPrice != null && existingPrice !== nextPrice) {
      priceChanged = true;
      updates.pricePrevious = existing.price;
      updates.priceChangedAt = now;
    }

    const existingStatus = String(existing.status || "");
    const nextStatus = String(updates.status || "");
    if (existingStatus && nextStatus && existingStatus !== nextStatus) {
      statusChanged = true;
    }

    const [row] = await db
      .update(homeScoutListings)
      .set(updates)
      .where(eq(homeScoutListings.id, existing.id))
      .returning();

    // Events
    await this.createHomeScoutListingEvent({
      listingId: row.id,
      eventType: "seen" as any,
      observedAt: now,
      payload: { sourceKey: params.sourceKey, sourceListingId: params.sourceListingId },
    } as any);

    if (priceChanged) {
      await this.createHomeScoutListingEvent({
        listingId: row.id,
        eventType: "price_changed" as any,
        observedAt: now,
        payload: {
          from: existing.price,
          to: row.price,
          previous: row.pricePrevious ?? null,
        },
      } as any);
    }
    if (statusChanged) {
      await this.createHomeScoutListingEvent({
        listingId: row.id,
        eventType: "status_changed" as any,
        observedAt: now,
        payload: { from: existing.status, to: row.status },
      } as any);
    }

    return { listing: row, created: false, priceChanged, statusChanged };
  }

  async inactivateStaleHomeScoutListingsFromSource(params: {
    sourceKey: string;
    staleBefore: Date;
  }): Promise<number> {
    const now = new Date();
    const rows = await db
      .update(homeScoutListings)
      .set({
        status: "inactive" as any,
        offMarketAt: sql`coalesce(${homeScoutListings.offMarketAt}, now())` as any,
        updatedAt: now,
      } as any)
      .where(
        and(
          eq(homeScoutListings.sourceKey, params.sourceKey),
          eq(homeScoutListings.status, "active" as any),
          isNotNull(homeScoutListings.lastSeenAt),
          lt(homeScoutListings.lastSeenAt, params.staleBefore)
        )
      )
      .returning({ id: homeScoutListings.id });

    if (!rows.length) return 0;

    for (const r of rows) {
      await this.createHomeScoutListingEvent({
        listingId: String((r as any).id),
        eventType: "status_changed" as any,
        observedAt: now,
        payload: { from: "active", to: "inactive", reason: "stale" },
      } as any);
    }

    return rows.length;
  }

  async getHomeScoutListing(id: string): Promise<HomeScoutListing | undefined> {
    const [row] = await db.select().from(homeScoutListings).where(eq(homeScoutListings.id, id));
    return row;
  }

  async listHomeScoutListings(params?: {
    status?: HomeScoutListing["status"] | string;
    countyFips?: string;
    stateCode?: string;
    limit?: number;
    offset?: number;
    orderBy?: "createdAt" | "listedAt";
  }): Promise<HomeScoutListing[]> {
    const status = (params?.status ?? "pending_review") as any;
    const limit = Math.max(1, Math.min(200, Number(params?.limit ?? 50)));
    const offset = Math.max(0, Number(params?.offset ?? 0));
    const orderBy = params?.orderBy ?? "createdAt";

    const predicates: (SQL | undefined)[] = [eq(homeScoutListings.status, status)];
    if (params?.countyFips) {
      predicates.push(eq(homeScoutListings.countyFips, params.countyFips));
    }
    if (params?.stateCode) {
      predicates.push(eq(homeScoutListings.stateCode, params.stateCode));
    }

    const whereClause = and(...predicates.filter(Boolean)) as any;

    let q = db
      .select()
      .from(homeScoutListings)
      .where(whereClause)
      .limit(limit)
      .offset(offset) as any;
    if (orderBy === "listedAt") {
      q = q.orderBy(desc(homeScoutListings.listedAt), desc(homeScoutListings.createdAt)) as any;
    } else {
      q = q.orderBy(desc(homeScoutListings.createdAt)) as any;
    }

    return await q;
  }

  async listHomeScoutListingsForSeller(params: {
    sellerUserId: string;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutListing[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));

    return await db
      .select()
      .from(homeScoutListings)
      .where(eq(homeScoutListings.sellerUserId, params.sellerUserId))
      .orderBy(desc(homeScoutListings.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async searchHomeScoutListings(filters?: {
    countyFips?: string;
    stateCode?: string;
    status?: "pending_review" | "active" | "sold" | "rented" | "removed" | "inactive";
    propertyType?: "house" | "condo" | "townhouse" | "land" | "commercial" | "multifamily";
    bedsMin?: number;
    bathsMin?: number;
    sqftMin?: number;
    yearBuiltMin?: number;
    maxDomDays?: number;
    priceDropsOnly?: boolean;
    priceMin?: number;
    priceMax?: number;
    query?: string;
    limit?: number;
    offset?: number;
    sortBy?: "newest" | "price_asc" | "price_desc";
  }): Promise<HomeScoutListing[]> {
    const offset = Math.max(0, Number(filters?.offset ?? 0) || 0);
    const limitRequested = Number(filters?.limit ?? 20) || 20;
    const limit = Math.min(100, Math.max(0, limitRequested));
    if (limit === 0) return [];

    const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

    const status = filters?.status || "active";
    const predicates: (SQL | undefined)[] = [eq(homeScoutListings.status, status as any)];

    if (filters?.countyFips) {
      predicates.push(eq(homeScoutListings.countyFips, filters.countyFips));
    }

    if (filters?.stateCode) {
      predicates.push(eq(homeScoutListings.stateCode, filters.stateCode));
    }

    if (filters?.propertyType) {
      predicates.push(eq(homeScoutListings.propertyType, filters.propertyType as any));
    }

    if (Number.isFinite(filters?.bedsMin as any)) {
      const bedsMin = Number(filters?.bedsMin);
      predicates.push(gte(homeScoutListings.beds, bedsMin));
    }

    if (Number.isFinite(filters?.bathsMin as any)) {
      const bathsMin = Number(filters?.bathsMin);
      predicates.push(gte(homeScoutListings.baths, String(bathsMin) as any));
    }

    if (Number.isFinite(filters?.sqftMin as any)) {
      const sqftMin = Number(filters?.sqftMin);
      predicates.push(gte(homeScoutListings.sqft, sqftMin));
    }

    if (Number.isFinite(filters?.yearBuiltMin as any)) {
      const yearBuiltMin = Number(filters?.yearBuiltMin);
      predicates.push(gte(homeScoutListings.yearBuilt, yearBuiltMin));
    }

    // Index-friendly DOM filter: translate to listed_at >= now() - interval
    if (Number.isFinite(filters?.maxDomDays as any) && Number(filters?.maxDomDays) > 0) {
      const days = Math.min(3650, Math.max(1, Number(filters?.maxDomDays)));
      predicates.push(
        sql`${homeScoutListings.listedAt} >= (now() - (${days}::int || ' days')::interval)` as any
      );
    }

    if (filters?.priceDropsOnly) {
      predicates.push(isNotNull(homeScoutListings.priceChangedAt));
      predicates.push(isNotNull(homeScoutListings.pricePrevious));
      predicates.push(sql`${homeScoutListings.pricePrevious} > ${homeScoutListings.price}` as any);
    }

    if (Number.isFinite(filters?.priceMin as any)) {
      predicates.push(gte(homeScoutListings.price, String(Number(filters?.priceMin)) as any));
    }

    if (Number.isFinite(filters?.priceMax as any)) {
      predicates.push(lte(homeScoutListings.price, String(Number(filters?.priceMax)) as any));
    }

    if (filters?.query && String(filters.query).trim()) {
      const q = String(filters.query).trim();
      const pattern = `%${escapeLike(q)}%`;
      predicates.push(
        or(ilike(homeScoutListings.title, pattern), ilike(homeScoutListings.city, pattern))
      );
    }

    let q = db
      .select()
      .from(homeScoutListings)
      .where(and(...predicates))
      .limit(limit)
      .offset(offset);

    // Boost listings that have published public inspection reports.
    // Keep this optional so missing migrations don't break search in production.
    const canBoostReports = await hasHomeScoutInspectionReportsTable();
    const publishedReportCountExpr = canBoostReports
      ? sql<number>`(
          select count(*)
          from home_scout_inspection_reports r
          where
            r.listing_id = ${homeScoutListings.id}
            and r.visibility = 'public'
            and r.status = 'published'
        )`
      : sql<number>`0`;

    switch (filters?.sortBy) {
      case "price_asc":
        // Keep price sort strict; only use report boost as a tie-breaker.
        q = q.orderBy(
          asc(homeScoutListings.price),
          desc(publishedReportCountExpr),
          desc(homeScoutListings.listedAt)
        ) as any;
        break;
      case "price_desc":
        q = q.orderBy(
          desc(homeScoutListings.price),
          desc(publishedReportCountExpr),
          desc(homeScoutListings.listedAt)
        ) as any;
        break;
      case "newest":
      default:
        // Default feed: show listings with reports first, then newest.
        q = q.orderBy(
          desc(publishedReportCountExpr),
          desc(homeScoutListings.listedAt),
          desc(homeScoutListings.createdAt)
        ) as any;
        break;
    }

    return await q;
  }

  async listHomeScoutPartnerRecommendations(params: {
    countyFips: string;
    stateCode?: string;
    limitPerCategory?: number;
  }): Promise<
    Array<{
      category: "realtor" | "lender" | "inspector" | "trades";
      userId: string | null;
      displayName: string;
      role: string | null;
      company: string | null;
      cvsScore: number | null;
      source: "county_entity" | "network_fallback";
      rankScore: number;
      countyEntityId: string | null;
      metadata: Record<string, any>;
    }>
  > {
    const countyFips = String(params.countyFips || "").trim();
    if (!/^\d{5}$/.test(countyFips)) return [];
    const limitPerCategory = Math.max(1, Math.min(6, Number(params.limitPerCategory ?? 3)));

    const ROLE_TO_CATEGORY = new Map<string, "realtor" | "lender" | "inspector" | "trades">([
      ["realtor", "realtor"],
      ["mortgage_broker", "lender"],
      ["inspector", "inspector"],
      ["home_inspector", "inspector"],
      ["contractor_user", "trades"],
      ["specialty_tradesperson", "trades"],
      ["vendor", "trades"],
      ["handyman", "trades"],
      ["maintenance_contractor", "trades"],
    ]);

    const parseCategory = (
      rawCategory: unknown,
      rawRole: unknown
    ): "realtor" | "lender" | "inspector" | "trades" | null => {
      const c = String(rawCategory || "")
        .toLowerCase()
        .trim();
      if (c === "realtor" || c === "agent" || c === "real_estate_agent") return "realtor";
      if (c === "lender" || c === "mortgage" || c === "loan_officer") return "lender";
      if (c === "inspector" || c === "home_inspector") return "inspector";
      if (c === "trades" || c === "contractor" || c === "service_pro") return "trades";
      return ROLE_TO_CATEGORY.get(String(rawRole || "").toLowerCase()) || null;
    };

    const asObj = (v: unknown): Record<string, any> =>
      v && typeof v === "object" && !Array.isArray(v) ? (v as any) : {};
    const toNum = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const toSettingNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
      }
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const obj = value as Record<string, unknown>;
        const preferredKeys = ["value", "amount", "number", "slope", "cap"];
        for (const key of preferredKeys) {
          const n = toNum(obj[key]);
          if (n !== null) return n;
        }
      }
      return null;
    };

    const TRADEPARTNER_BONUS_SLOPE_DEFAULT = 0.1;
    const TRADEPARTNER_BONUS_CAP_DEFAULT = 10;
    const TRADEPARTNER_BONUS_USAGE_CAP_DEFAULT = 100;

    const matchingSettings = await db
      .select({
        key: siteSettings.key,
        value: siteSettings.value,
      })
      .from(siteSettings)
      .where(
        and(
          eq(siteSettings.category, "matching"),
          eq(siteSettings.isActive, true),
          inArray(siteSettings.key, [
            "tradepartner_bonus_slope",
            "tradepartner_bonus_cap",
            "tradepartner_bonus_usage_cap",
          ])
        )
      );

    const settingsMap = new Map<string, unknown>(
      matchingSettings.map((row) => [String(row.key), row.value])
    );
    const tradePartnerBonusSlope = clamp(
      toSettingNumber(settingsMap.get("tradepartner_bonus_slope")) ??
        TRADEPARTNER_BONUS_SLOPE_DEFAULT,
      0,
      2
    );
    const tradePartnerBonusCap = clamp(
      toSettingNumber(settingsMap.get("tradepartner_bonus_cap")) ?? TRADEPARTNER_BONUS_CAP_DEFAULT,
      0,
      25
    );
    const tradePartnerUsageCap = clamp(
      toSettingNumber(settingsMap.get("tradepartner_bonus_usage_cap")) ??
        TRADEPARTNER_BONUS_USAGE_CAP_DEFAULT,
      1,
      500
    );

    const entityRows = await db
      .select()
      .from(countyEntities)
      .where(
        and(
          eq(countyEntities.countyFips, countyFips),
          eq(countyEntities.status, "active" as any),
          inArray(countyEntities.entityType, ["partner", "vendor", "affiliate"] as any)
        )
      )
      .orderBy(desc(countyEntities.updatedAt), desc(countyEntities.createdAt))
      .limit(300);

    const entityUserIds: string[] = Array.from(
      new Set(
        entityRows
          .map((r) => (typeof r.entityId === "string" ? r.entityId.trim() : ""))
          .filter((value): value is string => value.length > 0)
      )
    );

    const entityUsers = entityUserIds.length
      ? await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            role: users.role,
            verificationStatus: users.verificationStatus,
            countyFips: users.countyFips,
            stateCode: users.stateCode,
          })
          .from(users)
          .where(inArray(users.id, entityUserIds))
      : [];

    const latestEntityTrust = entityUserIds.length
      ? await db.execute(sql`
          SELECT DISTINCT ON (ts.user_id)
            ts.user_id::text AS user_id,
            ts.cvs_score::text AS cvs_score,
            ts.verification_status::text AS verification_status
          FROM trust_snapshots ts
          WHERE ts.county_fips = ${countyFips}
            AND ts.user_id IN (${sql.join(
              entityUserIds.map((userId) => sql`${userId}`),
              sql`, `
            )})
          ORDER BY ts.user_id, ts.computed_at DESC
        `)
      : { rows: [] as any[] };

    const entityUserMap = new Map<string, any>(entityUsers.map((u) => [String(u.id), u]));
    const entityTrustMap = new Map(
      (latestEntityTrust.rows as any[]).map((r) => [String(r.user_id), r])
    );

    const ranked: Array<{
      category: "realtor" | "lender" | "inspector" | "trades";
      userId: string | null;
      displayName: string;
      role: string | null;
      company: string | null;
      cvsScore: number | null;
      source: "county_entity" | "network_fallback";
      rankScore: number;
      countyEntityId: string | null;
      metadata: Record<string, any>;
    }> = [];

    for (const entity of entityRows) {
      const meta = asObj((entity as any).metadata);
      const userId =
        typeof entity.entityId === "string" && entity.entityId.trim() ? entity.entityId : null;
      const linkedUser = userId ? entityUserMap.get(String(userId)) : undefined;
      const trust = userId ? entityTrustMap.get(String(userId)) : undefined;
      const category = parseCategory(
        meta.partnerCategory ?? meta.category ?? meta.vertical ?? meta.serviceType,
        linkedUser?.role
      );
      if (!category) continue;

      const firstName = String(linkedUser?.firstName || "").trim();
      const lastName = String(linkedUser?.lastName || "").trim();
      const displayName =
        String(entity.label || "").trim() ||
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        "Local partner";
      const role = linkedUser?.role ? String(linkedUser.role) : null;
      const company =
        String(meta.company || meta.brokerage || meta.organization || "").trim() || null;
      const cvsScore = toNum((trust as any)?.cvs_score);
      const priority = clamp(toNum(meta.priority) ?? 0, 0, 5);
      const localDeals = clamp(toNum(meta.localClosedDeals) ?? 0, 0, 50);
      const tradePartnerUsageCount = clamp(
        toNum(meta.tradePartnerUsageCount) ?? 0,
        0,
        tradePartnerUsageCap
      );
      const tradePartnerBonus = Math.min(
        tradePartnerBonusCap,
        tradePartnerUsageCount * tradePartnerBonusSlope
      );
      const isFeatured = Boolean(meta.featured);
      const verified =
        String(
          (trust as any)?.verification_status || linkedUser?.verificationStatus || ""
        ).toLowerCase() === "approved";
      const rankScore =
        20 +
        priority * 9 +
        Math.min(45, (cvsScore ?? 0) * 0.45) +
        Math.min(15, localDeals * 0.6) +
        tradePartnerBonus +
        (isFeatured ? 7 : 0) +
        (verified ? 8 : 0);

      ranked.push({
        category,
        userId,
        displayName,
        role,
        company,
        cvsScore,
        source: "county_entity",
        rankScore,
        countyEntityId: entity.id,
        metadata: meta,
      });
    }

    // Keep legacy aliases for metadata parsing, but only query DB roles that exist in the canonical enum.
    const fallbackRoles = Array.from(ROLE_TO_CATEGORY.keys()).filter((role) =>
      (users.role.enumValues ?? []).includes(role as any)
    );
    const fallbackUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        verificationStatus: users.verificationStatus,
      })
      .from(users)
      .where(and(eq(users.countyFips, countyFips), inArray(users.role, fallbackRoles as any)))
      .limit(300);

    const fallbackUserIds = fallbackUsers.map((u) => String(u.id));
    const latestFallbackTrust = fallbackUserIds.length
      ? await db.execute(sql`
          SELECT DISTINCT ON (ts.user_id)
            ts.user_id::text AS user_id,
            ts.cvs_score::text AS cvs_score,
            ts.verification_status::text AS verification_status
          FROM trust_snapshots ts
          WHERE ts.county_fips = ${countyFips}
            AND ts.user_id IN (${sql.join(
              fallbackUserIds.map((userId) => sql`${userId}`),
              sql`, `
            )})
          ORDER BY ts.user_id, ts.computed_at DESC
        `)
      : { rows: [] as any[] };

    const fallbackTrustMap = new Map(
      (latestFallbackTrust.rows as any[]).map((r) => [String(r.user_id), r])
    );
    const seenUserIds = new Set(ranked.map((r) => r.userId).filter(Boolean) as string[]);

    for (const u of fallbackUsers) {
      const userId = String(u.id);
      if (seenUserIds.has(userId)) continue;
      const category = ROLE_TO_CATEGORY.get(String(u.role || "").toLowerCase());
      if (!category) continue;
      const trust = fallbackTrustMap.get(userId);
      const cvsScore = toNum((trust as any)?.cvs_score);
      const verified =
        String((trust as any)?.verification_status || u.verificationStatus || "").toLowerCase() ===
        "approved";
      const displayName =
        [String(u.firstName || "").trim(), String(u.lastName || "").trim()]
          .filter(Boolean)
          .join(" ") || "Local partner";
      const rankScore = 10 + Math.min(40, (cvsScore ?? 0) * 0.4) + (verified ? 8 : 0);
      ranked.push({
        category,
        userId,
        displayName,
        role: u.role ? String(u.role) : null,
        company: null,
        cvsScore,
        source: "network_fallback",
        rankScore,
        countyEntityId: null,
        metadata: {},
      });
      seenUserIds.add(userId);
    }

    const categories: Array<"realtor" | "lender" | "inspector" | "trades"> = [
      "realtor",
      "lender",
      "inspector",
      "trades",
    ];
    const out: typeof ranked = [];
    for (const category of categories) {
      const top = ranked
        .filter((r) => r.category === category)
        .sort((a, b) => b.rankScore - a.rankScore)
        .slice(0, limitPerCategory);
      out.push(...top);
    }
    return out;
  }

  async createHomeScoutListing(input: InsertHomeScoutListing): Promise<HomeScoutListing> {
    const [row] = await db
      .insert(homeScoutListings)
      .values({ ...input, updatedAt: new Date() })
      .returning();
    await this.createHomeScoutListingEvent({
      listingId: row.id,
      eventType: "created" as any,
      observedAt: new Date(),
      payload: { sourceKey: row.sourceKey, sourceListingId: row.sourceListingId ?? null },
    } as any);
    return row;
  }

  async approveHomeScoutListing(params: {
    listingId: string;
    approvedByUserId: string;
  }): Promise<HomeScoutListing | undefined> {
    const before = await this.getHomeScoutListing(params.listingId);
    const [row] = await db
      .update(homeScoutListings)
      .set({
        status: "active" as any,
        approvedAt: new Date(),
        approvedByUserId: params.approvedByUserId,
        updatedAt: new Date(),
        listedAt: sql`coalesce(${homeScoutListings.listedAt}, now())` as any,
      })
      .where(eq(homeScoutListings.id, params.listingId))
      .returning();
    if (row && before && String(before.status) !== String(row.status)) {
      await this.createHomeScoutListingEvent({
        listingId: row.id,
        eventType: "status_changed" as any,
        observedAt: new Date(),
        payload: { from: before.status, to: row.status },
      } as any);
    }
    return row;
  }

  async updateHomeScoutListing(params: {
    listingId: string;
    updates: Partial<InsertHomeScoutListing>;
  }): Promise<HomeScoutListing | undefined> {
    const [row] = await db
      .update(homeScoutListings)
      .set({ ...(params.updates as any), updatedAt: new Date() })
      .where(eq(homeScoutListings.id, params.listingId))
      .returning();
    return row;
  }

  async createHomeScoutListingReport(
    input: Omit<InsertHomeScoutListingReport, "id" | "createdAt">
  ): Promise<HomeScoutListingReport> {
    const [row] = await db
      .insert(homeScoutListingReports)
      .values({ ...input, createdAt: new Date() } as any)
      .returning();
    return row;
  }

  async listHomeScoutListingReports(params?: {
    status?: "open" | "closed";
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutListingReport[]> {
    const status = (params?.status ?? "open") as any;
    const limit = Math.max(1, Math.min(200, Number(params?.limit ?? 50)));
    const offset = Math.max(0, Number(params?.offset ?? 0));

    return await db
      .select()
      .from(homeScoutListingReports)
      .where(eq(homeScoutListingReports.status, status))
      .orderBy(desc(homeScoutListingReports.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async closeHomeScoutListingReport(params: {
    reportId: string;
    closedByUserId: string;
  }): Promise<HomeScoutListingReport | undefined> {
    const [row] = await db
      .update(homeScoutListingReports)
      .set({
        status: "closed" as any,
        closedAt: new Date(),
        closedByUserId: params.closedByUserId,
      } as any)
      .where(eq(homeScoutListingReports.id, params.reportId))
      .returning();
    return row;
  }

  async createHomeScoutInspectionRequest(
    input: Omit<InsertHomeScoutInspectionRequest, "id" | "createdAt" | "updatedAt">
  ): Promise<HomeScoutInspectionRequest> {
    const [row] = await db
      .insert(homeScoutInspectionRequests)
      .values({ ...(input as any), createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return row;
  }

  async listHomeScoutInspectionRequests(params: {
    listingId: string;
    status?: "open" | "fulfilled" | "cancelled";
    requesterUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutInspectionRequest[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));
    const status = params.status;

    const predicates: (SQL | undefined)[] = [
      eq(homeScoutInspectionRequests.listingId, params.listingId),
    ];
    if (status) predicates.push(eq(homeScoutInspectionRequests.status, status as any));
    if (params.requesterUserId) {
      predicates.push(eq(homeScoutInspectionRequests.requesterUserId, params.requesterUserId));
    }

    return await db
      .select()
      .from(homeScoutInspectionRequests)
      .where(and(...predicates))
      .orderBy(desc(homeScoutInspectionRequests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getHomeScoutInspectionRequest(
    requestId: string
  ): Promise<HomeScoutInspectionRequest | undefined> {
    const [row] = await db
      .select()
      .from(homeScoutInspectionRequests)
      .where(eq(homeScoutInspectionRequests.id, requestId))
      .limit(1);
    return row;
  }

  async markHomeScoutInspectionRequestFulfilled(params: {
    requestId: string;
  }): Promise<HomeScoutInspectionRequest | undefined> {
    const [row] = await db
      .update(homeScoutInspectionRequests)
      .set({
        status: "fulfilled" as any,
        fulfilledAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(homeScoutInspectionRequests.id, params.requestId))
      .returning();
    return row;
  }

  async createHomeScoutInspectionReport(
    input: Omit<InsertHomeScoutInspectionReport, "id" | "createdAt" | "updatedAt">
  ): Promise<HomeScoutInspectionReport> {
    const [row] = await db
      .insert(homeScoutInspectionReports)
      .values({ ...(input as any), createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return row;
  }

  async listHomeScoutInspectionReports(params: {
    listingId: string;
    visibility?: "public" | "private";
    status?: "published" | "pending_review" | "removed";
    submittedByUserId?: string;
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutInspectionReport[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));
    const predicates: (SQL | undefined)[] = [
      eq(homeScoutInspectionReports.listingId, params.listingId),
    ];
    if (params.visibility)
      predicates.push(eq(homeScoutInspectionReports.visibility, params.visibility as any));
    if (params.status) predicates.push(eq(homeScoutInspectionReports.status, params.status as any));
    if (params.submittedByUserId) {
      predicates.push(
        eq(homeScoutInspectionReports.submittedByUserId, params.submittedByUserId as any)
      );
    }

    return await db
      .select()
      .from(homeScoutInspectionReports)
      .where(and(...predicates))
      .orderBy(desc(homeScoutInspectionReports.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getHomeScoutInspectionReport(
    reportId: string
  ): Promise<HomeScoutInspectionReport | undefined> {
    const [row] = await db
      .select()
      .from(homeScoutInspectionReports)
      .where(eq(homeScoutInspectionReports.id, reportId))
      .limit(1);
    return row;
  }

  async updateHomeScoutInspectionReportStatus(params: {
    reportId: string;
    status: "published" | "pending_review" | "removed";
  }): Promise<HomeScoutInspectionReport | undefined> {
    const [row] = await db
      .update(homeScoutInspectionReports)
      .set({ status: params.status as any, updatedAt: new Date() } as any)
      .where(eq(homeScoutInspectionReports.id, params.reportId))
      .returning();
    return row;
  }

  async createHomeScoutInspectionServiceRequest(
    input: Omit<InsertHomeScoutInspectionServiceRequest, "id" | "createdAt" | "updatedAt">
  ): Promise<HomeScoutInspectionServiceRequest> {
    const [row] = await db
      .insert(homeScoutInspectionServiceRequests)
      .values({ ...(input as any), createdAt: new Date(), updatedAt: new Date() } as any)
      .returning();
    return row;
  }

  async listHomeScoutInspectionServiceRequests(params: {
    listingId?: string;
    reportId?: string;
    requesterUserId?: string;
    status?: "open" | "routed" | "in_progress" | "completed" | "cancelled";
    limit?: number;
    offset?: number;
  }): Promise<HomeScoutInspectionServiceRequest[]> {
    const limit = Math.max(1, Math.min(200, Number(params.limit ?? 50)));
    const offset = Math.max(0, Number(params.offset ?? 0));
    const predicates: (SQL | undefined)[] = [];
    if (params.listingId)
      predicates.push(eq(homeScoutInspectionServiceRequests.listingId, params.listingId));
    if (params.reportId)
      predicates.push(eq(homeScoutInspectionServiceRequests.reportId, params.reportId));
    if (params.requesterUserId) {
      predicates.push(
        eq(homeScoutInspectionServiceRequests.requesterUserId, params.requesterUserId)
      );
    }
    if (params.status) {
      predicates.push(eq(homeScoutInspectionServiceRequests.status, params.status as any));
    }

    const whereClause = predicates.length ? (and(...predicates) as any) : undefined;

    return await db
      .select()
      .from(homeScoutInspectionServiceRequests)
      .where(whereClause)
      .orderBy(desc(homeScoutInspectionServiceRequests.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createMarketplaceListing(
    listingData: InsertMarketplaceListing
  ): Promise<MarketplaceListing> {
    // Generate slug from title
    const slug = await this.generateListingSlug(listingData.title);

    const tags = Array.isArray((listingData as any).tags)
      ? (listingData as any).tags.filter((t: unknown): t is string => typeof t === "string")
      : (listingData as any).tags;

    const [listing] = await db
      .insert(marketplaceListings)
      .values({ ...(listingData as any), slug, tags })
      .returning();
    return listing;
  }

  async updateMarketplaceListing(
    id: string,
    updates: Partial<MarketplaceListing>
  ): Promise<MarketplaceListing> {
    const [listing] = await db
      .update(marketplaceListings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    return listing;
  }

  async deleteMarketplaceListing(id: string): Promise<void> {
    await db.delete(marketplaceListings).where(eq(marketplaceListings.id, id));
  }

  async getUserListings(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.sellerId, userId))
      .orderBy(desc(marketplaceListings.createdAt));
  }

  async incrementListingView(listingId: string): Promise<void> {
    await db
      .update(marketplaceListings)
      .set({
        viewCount: sql`${marketplaceListings.viewCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));
  }

  async generateListingSlug(title: string): Promise<string> {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60);

    let slug = baseSlug;
    let counter = 0;

    while (true) {
      const existing = await db
        .select()
        .from(marketplaceListings)
        .where(eq(marketplaceListings.slug, slug))
        .limit(1);

      if (existing.length === 0) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  // Inquiries
  async createMarketplaceInquiry(
    inquiryData: InsertMarketplaceInquiry
  ): Promise<MarketplaceInquiry> {
    const [inquiry] = await db.insert(marketplaceInquiries).values(inquiryData).returning();

    // Increment contact count for the listing
    await db
      .update(marketplaceListings)
      .set({
        contactCount: sql`${marketplaceListings.contactCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, inquiryData.listingId));

    return inquiry;
  }

  async getMarketplaceInquiry(id: string): Promise<MarketplaceInquiry | undefined> {
    const [inquiry] = await db
      .select()
      .from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.id, id));
    return inquiry;
  }

  async getListingInquiries(listingId: string): Promise<MarketplaceInquiry[]> {
    return await db
      .select()
      .from(marketplaceInquiries)
      .where(eq(marketplaceInquiries.listingId, listingId))
      .orderBy(desc(marketplaceInquiries.createdAt));
  }

  async getUserInquiries(userId: string, type: "sent" | "received"): Promise<MarketplaceInquiry[]> {
    const condition =
      type === "sent"
        ? eq(marketplaceInquiries.buyerId, userId)
        : eq(marketplaceInquiries.sellerId, userId);

    return await db
      .select()
      .from(marketplaceInquiries)
      .where(condition)
      .orderBy(desc(marketplaceInquiries.createdAt));
  }

  async updateMarketplaceInquiry(
    id: string,
    updates: Partial<MarketplaceInquiry>
  ): Promise<MarketplaceInquiry> {
    const [inquiry] = await db
      .update(marketplaceInquiries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(marketplaceInquiries.id, id))
      .returning();
    return inquiry;
  }

  // Favorites
  async createMarketplaceFavorite(
    favoriteData: InsertMarketplaceFavorite
  ): Promise<MarketplaceFavorite> {
    const [favorite] = await db.insert(marketplaceFavorites).values(favoriteData).returning();

    // Increment favorite count for the listing
    await db
      .update(marketplaceListings)
      .set({
        favoriteCount: sql`${marketplaceListings.favoriteCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, favoriteData.listingId));

    return favorite;
  }

  async removeMarketplaceFavorite(userId: string, listingId: string): Promise<void> {
    await db
      .delete(marketplaceFavorites)
      .where(
        and(eq(marketplaceFavorites.userId, userId), eq(marketplaceFavorites.listingId, listingId))
      );

    // Decrement favorite count for the listing
    await db
      .update(marketplaceListings)
      .set({
        favoriteCount: sql`${marketplaceListings.favoriteCount} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));
  }

  async getUserFavorites(userId: string): Promise<MarketplaceListing[]> {
    return await db
      .select({
        ...getTableColumns(marketplaceListings),
      })
      .from(marketplaceFavorites)
      .innerJoin(marketplaceListings, eq(marketplaceFavorites.listingId, marketplaceListings.id))
      .where(eq(marketplaceFavorites.userId, userId))
      .orderBy(desc(marketplaceFavorites.createdAt));
  }

  // Reports
  async createMarketplaceReport(reportData: InsertMarketplaceReport): Promise<MarketplaceReport> {
    const [report] = await db.insert(marketplaceReports).values(reportData).returning();
    return report;
  }

  async getMarketplaceReports(): Promise<MarketplaceReport[]> {
    return await db.select().from(marketplaceReports).orderBy(desc(marketplaceReports.createdAt));
  }

  async updateMarketplaceReport(
    id: string,
    updates: Partial<MarketplaceReport>
  ): Promise<MarketplaceReport> {
    const [report] = await db
      .update(marketplaceReports)
      .set(updates)
      .where(eq(marketplaceReports.id, id))
      .returning();
    return report;
  }

  // Marketplace Verification
  async createVendorVerification(
    verificationData: InsertVendorVerification
  ): Promise<VendorVerification> {
    const [verification] = await db
      .insert(vendorVerifications)
      .values(verificationData)
      .returning();
    return verification;
  }

  async createBuyerVerification(
    verificationData: InsertBuyerVerification
  ): Promise<BuyerVerification> {
    const [verification] = await db.insert(buyerVerifications).values(verificationData).returning();
    return verification;
  }

  async getVendorVerificationByUserId(userId: string): Promise<VendorVerification | undefined> {
    const [verification] = await db
      .select()
      .from(vendorVerifications)
      .where(eq(vendorVerifications.userId, userId))
      .orderBy(desc(vendorVerifications.createdAt));
    return verification;
  }

  async getBuyerVerificationByUserId(userId: string): Promise<BuyerVerification | undefined> {
    const [verification] = await db
      .select()
      .from(buyerVerifications)
      .where(eq(buyerVerifications.userId, userId))
      .orderBy(desc(buyerVerifications.createdAt));
    return verification;
  }

  async getVerifications(filters: {
    type: string;
    status: string;
  }): Promise<(VendorVerification | BuyerVerification)[]> {
    const results: (VendorVerification | BuyerVerification)[] = [];
    const vendorStatuses = vendorVerifications.status.enumValues ?? [];
    const buyerStatuses = buyerVerifications.status.enumValues ?? [];

    if (filters.type === "all" || filters.type === "vendor") {
      const vendorWhere: SQL =
        filters.status !== "all" && filters.status && vendorStatuses.includes(filters.status as any)
          ? eq(vendorVerifications.status, filters.status as (typeof vendorStatuses)[number])
          : sql`true`;

      const vendorResults = await db
        .select()
        .from(vendorVerifications)
        .where(vendorWhere)
        .orderBy(desc(vendorVerifications.createdAt));
      results.push(...vendorResults);
    }

    if (filters.type === "all" || filters.type === "buyer") {
      const buyerWhere: SQL =
        filters.status !== "all" && filters.status && buyerStatuses.includes(filters.status as any)
          ? eq(buyerVerifications.status, filters.status as (typeof buyerStatuses)[number])
          : sql`true`;

      const buyerResults = await db
        .select()
        .from(buyerVerifications)
        .where(buyerWhere)
        .orderBy(desc(buyerVerifications.createdAt));
      results.push(...buyerResults);
    }

    const getTime = (value: Date | null | undefined) => (value ? new Date(value).getTime() : 0);
    return results.sort((a, b) => getTime(b.createdAt) - getTime(a.createdAt));
  }

  async updateVerification(
    id: string,
    updates: any
  ): Promise<VendorVerification | BuyerVerification> {
    // Try vendor verification first
    try {
      const [vendorVerification] = await db
        .update(vendorVerifications)
        .set(updates)
        .where(eq(vendorVerifications.id, id))
        .returning();
      if (vendorVerification) return vendorVerification;
    } catch {
      // If vendor update fails, try buyer verification
    }

    const [buyerVerification] = await db
      .update(buyerVerifications)
      .set(updates)
      .where(eq(buyerVerifications.id, id))
      .returning();
    return buyerVerification;
  }

  // Address Verification
  async createAddressVerification(
    verificationData: InsertAddressVerification
  ): Promise<AddressVerification> {
    const [verification] = await db
      .insert(addressVerifications)
      .values(verificationData)
      .returning();
    return verification;
  }

  async getAddressVerificationByUserId(userId: string): Promise<AddressVerification | undefined> {
    const [verification] = await db
      .select()
      .from(addressVerifications)
      .where(eq(addressVerifications.userId, userId))
      .orderBy(desc(addressVerifications.createdAt));
    return verification;
  }

  async updateAddressVerification(
    id: string,
    updates: Partial<AddressVerification>
  ): Promise<AddressVerification> {
    const [verification] = await db
      .update(addressVerifications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(addressVerifications.id, id))
      .returning();
    return verification;
  }

  async getAddressVerificationsNeedingReminders(): Promise<AddressVerification[]> {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    return await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.status, "pending"),
          sql`${addressVerifications.deadline} <= ${threeDaysFromNow}`,
          or(
            isNull(addressVerifications.lastReminderSent),
            sql`${addressVerifications.lastReminderSent} < NOW() - INTERVAL '24 hours'`
          )
        )
      );
  }

  async getExpiredAddressVerifications(): Promise<AddressVerification[]> {
    return await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.status, "pending"),
          sql`${addressVerifications.deadline} < NOW()`
        )
      );
  }

  async sendAddressVerificationPostcard(userId: string, code: string): Promise<void> {
    await db
      .update(addressVerifications)
      .set({
        postcardCode: code,
        postcardSentAt: new Date(),
        verificationMethod: "postcard",
        updatedAt: new Date(),
      })
      .where(eq(addressVerifications.userId, userId));
  }

  async verifyAddressWithPostcard(userId: string, code: string): Promise<boolean> {
    const [verification] = await db
      .select()
      .from(addressVerifications)
      .where(
        and(
          eq(addressVerifications.userId, userId),
          eq(addressVerifications.postcardCode, code),
          isNotNull(addressVerifications.postcardSentAt)
        )
      );

    if (!verification) {
      return false;
    }

    // Update verification as approved
    await db
      .update(addressVerifications)
      .set({
        status: "approved",
        postcardVerifiedAt: new Date(),
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(addressVerifications.id, verification.id));

    // Update user's address verification status
    await db
      .update(users)
      .set({
        addressVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true;
  }
}
