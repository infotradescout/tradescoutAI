import type { Express, RequestHandler } from "express";
import { inArray } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";
import { storage } from "../storage";
import { loadCanonicalPublicMapProfileUrls } from "../repositories/profileRepository";
import { parseProviderSearchScope } from "../services/providerSearchScope";

function toFiniteNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function haversineDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371e3;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (earthRadiusMeters * c) / 1609.34;
}

function sanitizeContractorPublic<T extends Record<string, any>>(
  contractor: T
): Omit<T, "phone" | "email" | "userId" | "businessId" | "insuranceDocUrl"> {
  if (!contractor || typeof contractor !== "object") return contractor as any;
  const { phone, email, userId, businessId, insuranceDocUrl, ...publicContractor } = contractor;
  void phone;
  void email;
  void userId;
  void businessId;
  void insuranceDocUrl;
  return publicContractor;
}

export function registerProviderSearchRoutes(
  app: Express,
  searchLimiter: RequestHandler,
  paths: string[]
): void {
  app.get(paths, searchLimiter, async (req: any, res: any) => {
    try {
      const { county, state, trade, query, sort, limit = 30, offset = 0 } = req.query;
      const rawLimit = Number.parseInt(String(limit), 10);
      const rawOffset = Number.parseInt(String(offset), 10);
      const parsedLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;
      const parsedOffset =
        Number.isFinite(rawOffset) && rawOffset > 0 ? Math.min(rawOffset, 5_000) : 0;

      const requestedScope = parseProviderSearchScope({ county, state });
      if (requestedScope.kind === "invalid") {
        return res.status(400).json({ message: requestedScope.message });
      }
      // This search can continue into Direct Connect. An absent jurisdiction
      // must never silently become a global action directory.
      if (requestedScope.kind === "none") {
        return res.json([]);
      }

      let viewerLat = toFiniteNumber(req.query?.lat ?? req.query?.latitude);
      let viewerLng = toFiniteNumber(req.query?.lng ?? req.query?.longitude);
      const viewerUserId =
        ((req.user as any)?.id || (req.user as any)?.claims?.sub || "").trim() || null;

      if ((viewerLat == null || viewerLng == null) && viewerUserId) {
        try {
          const viewer = await storage.getUser(viewerUserId);
          const profileLat = toFiniteNumber((viewer as any)?.latitude);
          const profileLng = toFiniteNumber((viewer as any)?.longitude);
          if (profileLat != null && profileLng != null) {
            viewerLat = profileLat;
            viewerLng = profileLng;
          }

          if (
            (viewerLat == null || viewerLng == null) &&
            (viewer as any)?.preferences?.geo?.homeLocation
          ) {
            const home = (viewer as any).preferences.geo.homeLocation;
            const homeLat = toFiniteNumber(home?.lat);
            const homeLng = toFiniteNumber(home?.lng);
            if (homeLat != null && homeLng != null) {
              viewerLat = homeLat;
              viewerLng = homeLng;
            }
          }
        } catch (error) {
          console.warn("Failed to load viewer location for provider search", error);
        }
      }

      let countyRecord: any = null;
      if (requestedScope.kind === "county") {
        countyRecord = await storage.findCountyByNameOrFips({
          query: requestedScope.countyQuery,
          stateCode: requestedScope.requestedStateCode || undefined,
        });
        if (!countyRecord) return res.json([]);
        if (
          requestedScope.requestedStateCode &&
          String(countyRecord.stateCode || "")
            .trim()
            .toUpperCase() !== requestedScope.requestedStateCode
        ) {
          return res.json([]);
        }
      }

      const requestedStateCode =
        requestedScope.kind === "state"
          ? requestedScope.stateCode
          : String(countyRecord?.stateCode || "")
              .trim()
              .toUpperCase();

      const contractorFilters: any = { limit: parsedLimit, offset: parsedOffset };
      if (countyRecord) contractorFilters.countyId = countyRecord.id;
      else contractorFilters.stateCode = requestedStateCode;
      let canonicalTradeSlug: string | undefined;
      if (trade !== undefined && trade !== null) {
        if (typeof trade !== "string" || !trade.trim()) {
          return res.status(400).json({ message: "trade must be a non-empty slug" });
        }
        const tradeRecord = await storage.getTradeBySlug(trade.trim());
        if (!tradeRecord) return res.json([]);
        contractorFilters.tradeIds = [tradeRecord.id];
        canonicalTradeSlug = String(tradeRecord.slug || trade).trim();
      }
      const normalizedQuery = typeof query === "string" ? query.trim() : "";
      if (normalizedQuery) contractorFilters.query = normalizedQuery;

      const contractors = await storage.getContractors(contractorFilters);
      const contractorUserIds = contractors
        .map((contractor: any) => (typeof contractor.userId === "string" ? contractor.userId : ""))
        .filter((id: string) => id.length > 0);
      const uniqueContractorUserIds = Array.from(new Set(contractorUserIds));
      const canonicalProfileUrlByUserId =
        await loadCanonicalPublicMapProfileUrls(uniqueContractorUserIds);
      const publiclyEligibleContractors = contractors.filter((contractor: any) =>
        canonicalProfileUrlByUserId.has(String(contractor.userId || "").trim())
      );
      const contractorLocationByUserId = new Map<string, { lat: number; lng: number }>();

      if (uniqueContractorUserIds.length > 0) {
        const contractorUsers = await db
          .select({ id: users.id, latitude: users.latitude, longitude: users.longitude })
          .from(users)
          .where(inArray(users.id, uniqueContractorUserIds));
        for (const userRow of contractorUsers as any[]) {
          const lat = toFiniteNumber(userRow.latitude);
          const lng = toFiniteNumber(userRow.longitude);
          if (lat != null && lng != null) {
            contractorLocationByUserId.set(String(userRow.id), { lat, lng });
          }
        }
      }

      const contractorResults = publiclyEligibleContractors.map((contractor: any) => {
        const sanitized = sanitizeContractorPublic(contractor) as any;
        const providerLocation =
          typeof contractor.userId === "string"
            ? contractorLocationByUserId.get(contractor.userId)
            : undefined;
        const distanceMiles =
          viewerLat != null && viewerLng != null && providerLocation
            ? haversineDistanceMiles(
                viewerLat,
                viewerLng,
                providerLocation.lat,
                providerLocation.lng
              )
            : null;
        return { ...sanitized, providerType: "contractor" as const, distanceMiles };
      });

      const countyId = String(countyRecord?.id || "").trim();
      const businesses = countyId
        ? await storage.getProvidersByCountyAndCategory({
            countyId,
            tradeSlug: canonicalTradeSlug,
            query: normalizedQuery || undefined,
            limit: parsedLimit,
            offset: parsedOffset,
          })
        : await storage.getProvidersByStateAndCategory({
            stateCode: requestedStateCode,
            tradeSlug: canonicalTradeSlug,
            query: normalizedQuery || undefined,
            limit: parsedLimit,
            offset: parsedOffset,
          });
      const ownerUserIds = Array.from(
        new Set(
          businesses
            .map((business: any) =>
              typeof business.ownerUserId === "string" ? business.ownerUserId : ""
            )
            .filter((id: string) => id.length > 0)
        )
      );
      const businessOwnerLocationByUserId = new Map<string, { lat: number; lng: number }>();

      if (ownerUserIds.length > 0) {
        const ownerUsers = await db
          .select({ id: users.id, latitude: users.latitude, longitude: users.longitude })
          .from(users)
          .where(inArray(users.id, ownerUserIds));
        for (const owner of ownerUsers as any[]) {
          const lat = toFiniteNumber(owner.latitude);
          const lng = toFiniteNumber(owner.longitude);
          if (lat != null && lng != null) {
            businessOwnerLocationByUserId.set(String(owner.id), { lat, lng });
          }
        }
      }

      const businessResults = businesses.map((business: any) => {
        const ownerLocation = business.ownerUserId
          ? businessOwnerLocationByUserId.get(String(business.ownerUserId))
          : undefined;
        return {
          id: business.businessId,
          businessId: business.businessId,
          companyName: business.name || null,
          name: business.name || null,
          roleContext: business.roleContext || null,
          slug: business.slug || null,
          category: business.profileData?.category || business.roleContext || null,
          description: business.profileData?.description || business.profileHeadline || null,
          services: Array.isArray(business.profileData?.services)
            ? business.profileData.services
            : [],
          contentBlocks: Array.isArray(business.profileContentBlocks)
            ? business.profileContentBlocks
            : [],
          seoMeta: business.profileSeoMeta || null,
          canonicalBusinessProfileUrl: business.canonicalProfileSlug
            ? `/u/${encodeURIComponent(business.canonicalProfileSlug)}`
            : `/business/${encodeURIComponent(business.slug)}`,
          providerType: "business" as const,
          distanceMiles:
            viewerLat != null && viewerLng != null && ownerLocation
              ? haversineDistanceMiles(viewerLat, viewerLng, ownerLocation.lat, ownerLocation.lng)
              : null,
        };
      });

      // Prefer the richer business profile when the same public identity exists
      // in both legacy contractor and first-class business storage.
      const providerIdentityKey = (provider: any): string => {
        const businessId = String(provider.businessId || "")
          .trim()
          .toLowerCase();
        if (businessId) return `business:${businessId}`;
        const slug = String(provider.slug || "")
          .trim()
          .toLowerCase();
        if (slug) return `slug:${slug}`;
        const name = String(provider.companyName || provider.name || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        return `name:${name}`;
      };

      const seen = new Set<string>();
      const merged: any[] = [];
      for (const provider of [...businessResults, ...contractorResults]) {
        const identityKey = providerIdentityKey(provider);
        if (identityKey && !seen.has(identityKey)) {
          seen.add(identityKey);
          merged.push(provider);
        }
      }

      const sortMode = typeof sort === "string" ? sort.trim().toLowerCase() : "";
      const sorted = [...merged].sort((left: any, right: any) => {
        const leftDistance = toFiniteNumber(left.distanceMiles);
        const rightDistance = toFiniteNumber(right.distanceMiles);
        const leftRecommendation = toFiniteNumber(left.recommendationScore) ?? 0;
        const rightRecommendation = toFiniteNumber(right.recommendationScore) ?? 0;

        if (sortMode === "distance") {
          if (leftDistance != null && rightDistance != null) return leftDistance - rightDistance;
          if (leftDistance != null) return -1;
          if (rightDistance != null) return 1;
          return rightRecommendation - leftRecommendation;
        }

        if (sortMode === "recommended") {
          if (rightRecommendation !== leftRecommendation) {
            return rightRecommendation - leftRecommendation;
          }
          if (leftDistance != null && rightDistance != null) return leftDistance - rightDistance;
          if (leftDistance != null) return -1;
          if (rightDistance != null) return 1;
          return 0;
        }

        if (leftDistance != null && rightDistance != null) return leftDistance - rightDistance;
        if (leftDistance != null) return -1;
        if (rightDistance != null) return 1;
        return rightRecommendation - leftRecommendation;
      });

      return res.json(sorted.slice(0, parsedLimit));
    } catch (error) {
      console.error("Error searching providers:", error);
      return res.status(500).json({ message: "Failed to search providers" });
    }
  });
}
