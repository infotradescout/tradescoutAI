/**
 * HomeScout Ingestion Job (P0)
 *
 * - Normalizes listings into home_scout_listings with source attribution
 * - Idempotent upsert by (source_key, source_listing_id)
 * - Writes timeline events (created/seen/price_changed/status_changed)
 * - Uses advisory locks in scheduler to avoid multi-instance duplication
 *
 * Note: This job does not "compute intelligence" for UI. It persists canonical facts.
 */

import fs from "fs/promises";
import path from "path";
import { storage } from "../storage";

type SourceConfigJsonFile = {
  path: string; // repo-relative path
  staleAfterDays?: number; // default 7
  autoActivate?: boolean; // default false
};

type SourceConfigJsonUrl = {
  url: string;
  staleAfterDays?: number; // default 7
  autoActivate?: boolean; // default false
  timeoutMs?: number; // default 15000
};

type NormalizedListing = {
  sourceListingId: string;
  title: string;
  description?: string | null;
  price: number;
  status?: string | null;
  listedAt?: string | Date | null;
  offMarketAt?: string | Date | null;
  propertyType?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  features?: any;
  photos?: string[] | null;

  countyFips: string;
  stateCode: string;
  city?: string | null;
  zipCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  addressVisibility?: "exact" | "approximate" | null;
  latitude?: number | null;
  longitude?: number | null;

  externalUrl?: string | null;
  sourceUpdatedAt?: string | Date | null;
};

class MissingJsonFileSourceError extends Error {
  code = "MISSING_JSON_FILE_SOURCE";
  filePath: string;

  constructor(filePath: string, cause: unknown) {
    super(`HomeScout JSON source file is missing: ${filePath}`);
    this.name = "MissingJsonFileSourceError";
    this.filePath = filePath;
    this.cause = cause;
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function isLegacySeedSource(sourceKey: string, cfg: SourceConfigJsonFile): boolean {
  const sourceLooksLegacy = /^seed_\d{5}$/.test(sourceKey);
  const pathLooksLegacy = /^data[\\/]+homescout[\\/]+seed-\d{5}\.json$/i.test(cfg.path.trim());
  return sourceLooksLegacy && pathLooksLegacy;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

function clampInt(value: any, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function clampNumber(value: any, min: number, max: number): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function normalizeListing(raw: any): NormalizedListing | null {
  const sourceListingId =
    typeof raw?.sourceListingId === "string" ? raw.sourceListingId.trim() : "";
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  const countyFips = typeof raw?.countyFips === "string" ? raw.countyFips.trim() : "";
  const stateCode = typeof raw?.stateCode === "string" ? raw.stateCode.trim().toUpperCase() : "";
  const price = clampNumber(raw?.price, 0, 9_999_999_999);

  if (!sourceListingId || !title || !/^\d{5}$/.test(countyFips) || !/^[A-Z]{2}$/.test(stateCode)) {
    return null;
  }
  if (price == null) return null;

  const beds = clampInt(raw?.beds, 0, 50);
  const sqft = clampInt(raw?.sqft, 0, 200_000);
  const lotSqft = clampInt(raw?.lotSqft, 0, 50_000_000);
  const yearBuilt = clampInt(raw?.yearBuilt, 1600, 2200);
  const baths = clampNumber(raw?.baths, 0, 50);

  const photos = Array.isArray(raw?.photos)
    ? raw.photos
        .filter((x: any) => typeof x === "string" && x.trim().length > 0)
        .map((x: string) => x.trim())
    : null;

  const addressVisibility =
    raw?.addressVisibility === "approximate"
      ? "approximate"
      : raw?.addressVisibility === "exact"
        ? "exact"
        : null;

  return {
    sourceListingId,
    title,
    description: typeof raw?.description === "string" ? raw.description : null,
    price,
    status: typeof raw?.status === "string" ? raw.status : null,
    listedAt: raw?.listedAt ?? null,
    offMarketAt: raw?.offMarketAt ?? null,
    propertyType: typeof raw?.propertyType === "string" ? raw.propertyType : null,
    beds,
    baths,
    sqft,
    lotSqft,
    yearBuilt,
    features: raw?.features ?? null,
    photos,
    countyFips,
    stateCode,
    city: typeof raw?.city === "string" ? raw.city : null,
    zipCode: typeof raw?.zipCode === "string" ? raw.zipCode : null,
    address1: typeof raw?.address1 === "string" ? raw.address1 : null,
    address2: typeof raw?.address2 === "string" ? raw.address2 : null,
    addressVisibility,
    latitude: clampNumber(raw?.latitude, -90, 90),
    longitude: clampNumber(raw?.longitude, -180, 180),
    externalUrl: typeof raw?.externalUrl === "string" ? raw.externalUrl : null,
    sourceUpdatedAt: raw?.sourceUpdatedAt ?? null,
  };
}

async function loadJsonFileListings(cfg: SourceConfigJsonFile): Promise<NormalizedListing[]> {
  const rel = cfg.path.trim();
  const abs = path.resolve(process.cwd(), rel);
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new MissingJsonFileSourceError(rel, error);
    }
    throw error;
  }
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.listings)
      ? parsed.listings
      : [];
  const out: NormalizedListing[] = [];
  for (const item of arr) {
    const n = normalizeListing(item);
    if (n) out.push(n);
  }
  return out;
}

async function loadJsonUrlListings(cfg: SourceConfigJsonUrl): Promise<NormalizedListing[]> {
  const url = cfg.url.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, cfg.timeoutMs ?? 15000));
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const parsed = await res.json();
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.listings)
        ? parsed.listings
        : [];
    const out: NormalizedListing[] = [];
    for (const item of arr) {
      const n = normalizeListing(item);
      if (n) out.push(n);
    }
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHomeScoutIngestionJob(params?: { sourceId?: string }): Promise<{
  timestamp: Date;
  sourcesProcessed: number;
  listingsSeen: number;
  created: number;
  updated: number;
  priceChanged: number;
  statusChanged: number;
  staleInactivated: number;
  errors: Array<{ sourceKey: string; error: string }>;
}> {
  const ts = new Date();

  let sources = await storage.listHomeScoutSources({ enabled: true, limit: 500, offset: 0 });
  if (params?.sourceId) {
    const one = await storage.getHomeScoutSourceById(params.sourceId);
    sources = one ? [one] : [];
  }

  const errors: Array<{ sourceKey: string; error: string }> = [];
  let listingsSeen = 0;
  let created = 0;
  let updated = 0;
  let priceChanged = 0;
  let statusChanged = 0;
  let staleInactivated = 0;

  for (const source of sources) {
    if (!source?.enabled) continue;
    const sourceKey = String((source as any).sourceKey || "").trim();
    const sourceType = String((source as any).sourceType || "").trim();
    if (!sourceKey || !sourceType) continue;

    const run = await storage.createHomeScoutIngestRun({
      sourceId: source.id,
      status: "running" as any,
      stats: {},
      finishedAt: null,
      error: null,
    } as any);

    await storage.updateHomeScoutSource(source.id, { lastRunAt: new Date() } as any);

    try {
      const cfg = (source as any).config || {};
      const autoActivate = Boolean(cfg.autoActivate);
      const staleAfterDays = Math.max(1, Math.min(365, Number(cfg.staleAfterDays ?? 7)));

      let createdLocal = 0;
      let updatedLocal = 0;
      let priceChangedLocal = 0;
      let statusChangedLocal = 0;
      let staleInactivatedLocal = 0;

      let normalized: NormalizedListing[] = [];
      let skippedMissingLegacySeed = false;
      if (sourceType === "json_file") {
        try {
          normalized = await loadJsonFileListings(cfg as SourceConfigJsonFile);
        } catch (error) {
          if (
            error instanceof MissingJsonFileSourceError &&
            isLegacySeedSource(sourceKey, cfg as SourceConfigJsonFile)
          ) {
            skippedMissingLegacySeed = true;
            console.warn("[HomeScoutIngestion] Skipping missing legacy seed source", {
              sourceKey,
              path: error.filePath,
            });
          } else {
            throw error;
          }
        }
      } else if (sourceType === "json_url") {
        normalized = await loadJsonUrlListings(cfg as SourceConfigJsonUrl);
      } else {
        throw new Error(`Unsupported source_type "${sourceType}"`);
      }

      if (skippedMissingLegacySeed) {
        await storage.finishHomeScoutIngestRun({
          runId: run.id,
          status: "success",
          stats: {
            listings: 0,
            created: 0,
            updated: 0,
            priceChanged: 0,
            statusChanged: 0,
            staleInactivated: 0,
            skipped: true,
            skipReason: "missing_legacy_seed_file",
          },
          error: null,
        });

        await storage.updateHomeScoutSource(source.id, {
          lastSuccessAt: new Date(),
          lastError: null,
        } as any);
        continue;
      }

      const seenIds: string[] = [];
      for (const n of normalized) {
        listingsSeen++;
        seenIds.push(n.sourceListingId);

        const desiredStatus =
          typeof n.status === "string" && n.status.trim().length > 0 ? n.status.trim() : "active";

        const res = await storage.upsertHomeScoutListingFromSource({
          sourceKey,
          sourceListingId: n.sourceListingId,
          autoActivate,
          values: {
            // lifecycle
            status: desiredStatus as any,
            externalUrl: n.externalUrl ?? null,
            sourceUpdatedAt: toDate(n.sourceUpdatedAt),

            // core
            title: n.title,
            description: n.description ?? null,
            price: String(n.price) as any,
            listedAt: toDate(n.listedAt),
            offMarketAt: toDate(n.offMarketAt),

            // facts
            propertyType: (n.propertyType ?? "house") as any,
            beds: n.beds ?? null,
            baths: n.baths != null ? (String(n.baths) as any) : null,
            sqft: n.sqft ?? null,
            lotSqft: n.lotSqft ?? null,
            yearBuilt: n.yearBuilt ?? null,
            features: (n.features ?? null) as any,

            // location
            countyFips: n.countyFips,
            stateCode: n.stateCode,
            city: n.city ?? null,
            zipCode: n.zipCode ?? null,
            address1: n.address1 ?? null,
            address2: n.address2 ?? null,
            addressVisibility: (n.addressVisibility ?? "exact") as any,
            latitude: n.latitude != null ? (String(n.latitude) as any) : null,
            longitude: n.longitude != null ? (String(n.longitude) as any) : null,

            // media
            photos: (n.photos ?? []) as any,

            // contact mapping is handled elsewhere; keep null by default for ingested feeds
            sellerUserId: null,
            agentUserId: null,
            contactUserId: null,
          } as any,
        });

        if (res.created) createdLocal++;
        else updatedLocal++;
        if (res.priceChanged) priceChangedLocal++;
        if (res.statusChanged) statusChangedLocal++;
      }

      // Staleness: inactivate listings from this source not seen recently.
      // For json sources, we treat "seen" as inventory coverage signal.
      // Note: if the feed is partial, set staleAfterDays higher or disable staleness.
      const staleBefore = new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000);
      staleInactivatedLocal += await storage.inactivateStaleHomeScoutListingsFromSource({
        sourceKey,
        staleBefore,
      });

      await storage.finishHomeScoutIngestRun({
        runId: run.id,
        status: "success",
        stats: {
          listings: normalized.length,
          created: createdLocal,
          updated: updatedLocal,
          priceChanged: priceChangedLocal,
          statusChanged: statusChangedLocal,
          staleInactivated: staleInactivatedLocal,
        },
        error: null,
      });

      await storage.updateHomeScoutSource(source.id, {
        lastSuccessAt: new Date(),
        lastError: null,
      } as any);

      created += createdLocal;
      updated += updatedLocal;
      priceChanged += priceChangedLocal;
      statusChanged += statusChangedLocal;
      staleInactivated += staleInactivatedLocal;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ sourceKey: String((source as any).sourceKey || source.id), error: message });
      await storage.finishHomeScoutIngestRun({
        runId: run.id,
        status: "error",
        stats: {},
        error: message,
      });
      await storage.updateHomeScoutSource(source.id, { lastError: message } as any);
    }
  }

  return {
    timestamp: ts,
    sourcesProcessed: sources.length,
    listingsSeen,
    created,
    updated,
    priceChanged,
    statusChanged,
    staleInactivated,
    errors,
  };
}
