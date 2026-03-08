import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../../db";
import { homeScoutListings } from "@shared/schema";
import type {
  ObservationAdapter,
  ObservationAdapterContext,
  ObservationAdapterResult,
} from "../types";

function parseCursor(cursor?: Record<string, unknown> | null): Date | null {
  const raw = cursor?.lastUpdatedAt;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parsed = new Date(raw);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toActionType(status: string | null, listedAt: Date | null): string {
  const normalized = String(status || "").toLowerCase();
  if (
    normalized === "sold" ||
    normalized === "rented" ||
    normalized === "removed" ||
    normalized === "inactive"
  ) {
    return "closed";
  }
  if (listedAt) return "listed";
  return "updated";
}

export const homeScoutListingsObservationAdapter: ObservationAdapter = {
  sourceType: "listing",
  async run(ctx: ObservationAdapterContext): Promise<ObservationAdapterResult> {
    const limit = Math.max(1, Math.min(500, Number(ctx.limit ?? 200)));
    const since = parseCursor(ctx.cursor);

    const rows = await db
      .select({
        id: homeScoutListings.id,
        sourceKey: homeScoutListings.sourceKey,
        sourceListingId: homeScoutListings.sourceListingId,
        dedupeKey: homeScoutListings.dedupeKey,
        status: homeScoutListings.status,
        listedAt: homeScoutListings.listedAt,
        updatedAt: homeScoutListings.updatedAt,
        observedAt: homeScoutListings.observedAt,
        countyFips: homeScoutListings.countyFips,
        stateCode: homeScoutListings.stateCode,
        city: homeScoutListings.city,
        title: homeScoutListings.title,
        price: homeScoutListings.price,
        pricePrevious: homeScoutListings.pricePrevious,
        propertyType: homeScoutListings.propertyType,
        beds: homeScoutListings.beds,
        baths: homeScoutListings.baths,
        sqft: homeScoutListings.sqft,
        lotSqft: homeScoutListings.lotSqft,
        yearBuilt: homeScoutListings.yearBuilt,
        zipCode: homeScoutListings.zipCode,
        latitude: homeScoutListings.latitude,
        longitude: homeScoutListings.longitude,
      })
      .from(homeScoutListings)
      .where(
        and(
          eq(homeScoutListings.countyFips, ctx.countyFips),
          eq(homeScoutListings.stateCode, ctx.stateCode),
          since ? gt(homeScoutListings.updatedAt, since) : undefined
        )
      )
      .orderBy(desc(homeScoutListings.updatedAt))
      .limit(limit);

    const observations = rows.map((row) => {
      const occurredAt = row.observedAt ?? row.updatedAt ?? new Date();
      const sourceId = row.sourceListingId || row.id;
      const sourceRef = `${row.sourceKey}:${sourceId}:snapshot:${occurredAt.toISOString()}`;
      return {
        occurredAt,
        countyFips: row.countyFips,
        stateCode: row.stateCode,
        city: row.city,
        geoJson:
          row.latitude != null && row.longitude != null
            ? {
                type: "Point",
                coordinates: [Number(row.longitude), Number(row.latitude)],
              }
            : null,
        subjectType: "property" as const,
        subjectRef: row.dedupeKey || sourceId,
        actionType: toActionType(row.status, row.listedAt),
        sourceType: "listing" as const,
        sourceRef,
        attributesJson: {
          listingId: row.id,
          title: row.title,
          status: row.status,
          price: row.price,
          pricePrevious: row.pricePrevious,
          propertyType: row.propertyType,
          beds: row.beds,
          baths: row.baths,
          sqft: row.sqft,
          lotSqft: row.lotSqft,
          yearBuilt: row.yearBuilt,
          zipCode: row.zipCode,
          listedAt: row.listedAt ? row.listedAt.toISOString() : null,
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
        },
        confidence: "official" as const,
      };
    });

    const newest = rows[0]?.updatedAt;
    const nextCursor = newest
      ? {
          lastUpdatedAt: newest.toISOString(),
        }
      : (ctx.cursor ?? null);

    return { observations, nextCursor };
  },
};
