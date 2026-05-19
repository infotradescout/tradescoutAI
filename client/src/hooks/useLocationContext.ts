import { useAuth } from "@/hooks/useAuth";
import { getUserLocationLabel } from "@/lib/copyHelpers";
import { safeStorage } from "@/utils/safeStorage";

export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationSource = "profile" | "geo_preference" | "override" | "session";

// Canonical user location shape used for all county-gated experiences.
// This intentionally matches the server-side contract (stateCode + countyFips
// + optional countyName) and is the only authoritative model for location.
export type UserLocation = {
  stateCode: string;
  countyFips: string;
  countyName?: string;
};

export type LocationContext = {
  layer: LocationLayer;
  /** Canonical machine fields used for all locality-aware APIs */
  stateCode?: string;
  countyFips?: string;
  countyId?: string;
  /** Optional precise geo, when available */
  lat?: number;
  lng?: number;
  /** Human-readable label; must follow getUserLocationLabel semantics */
  label?: string;
  /** Display-only county name when known (e.g. "Travis County") */
  countyName?: string;
  /** Provenance for how this context was resolved */
  source: LocationSource;
  /** Scoped layer identifiers */
  hoaId?: string;
  projectId?: string;
};

const SESSION_LOCATION_KEY = "ts:location:session";

type SessionLocationPayload = Pick<
  LocationContext,
  "stateCode" | "countyFips" | "countyId" | "countyName" | "lat" | "lng" | "label"
>;

export function setSessionLocationOverride(payload: SessionLocationPayload) {
  const toStore: SessionLocationPayload = {
    stateCode: payload.stateCode,
    countyFips: payload.countyFips,
    countyId: payload.countyId,
    countyName: payload.countyName,
    lat: payload.lat,
    lng: payload.lng,
    label: payload.label,
  };

  safeStorage.set(SESSION_LOCATION_KEY, JSON.stringify(toStore));
}

export function clearSessionLocationOverride() {
  safeStorage.remove(SESSION_LOCATION_KEY);
}

/**
 * Canonical check for whether the user has "committed" a home county.
 *
 * This should be used anywhere we gate truly local experiences (community
 * feed, HOA tools, Exchange, Scout hero action grid, etc.). It encodes the
 * rule that a user is "county committed" only when we have both a
 * two-letter state code and a 5-digit county FIPS in the active
 * LocationContext.
 */
export function hasCountyContext(ctx: LocationContext | undefined | null): boolean {
  if (!ctx) return false;

  // A user is "county committed" only when both canonical
  // fields are present in the active LocationContext.
  // No alternates, no heuristics.
  const { stateCode, countyFips } = ctx;
  if (typeof stateCode !== "string" || typeof countyFips !== "string") {
    return false;
  }

  return stateCode.length === 2 && countyFips.length === 5;
}

/**
 * Hyperlocal-ready check used for local-first experiences.
 *
 * A user is considered local-ready when any of the following are true:
 * - canonical county commitment exists (legacy compatibility),
 * - precise geo coordinates are available,
 * - a non-empty local label is available,
 * - state context exists (weakest fallback).
 */
export function hasLocalContext(ctx: LocationContext | undefined | null): boolean {
  if (!ctx) return false;
  if (hasCountyContext(ctx)) return true;

  if (typeof ctx.lat === "number" && Number.isFinite(ctx.lat)) return true;
  if (typeof ctx.lng === "number" && Number.isFinite(ctx.lng)) return true;

  if (typeof ctx.label === "string" && ctx.label.trim().length > 0) return true;

  const stateCode = typeof ctx.stateCode === "string" ? ctx.stateCode.trim().toUpperCase() : "";
  return stateCode.length === 2;
}

export function hasPendingCountyResolution(ctx: LocationContext | undefined | null): boolean {
  if (!ctx) return false;

  const stateCode = typeof ctx.stateCode === "string" ? ctx.stateCode.trim().toUpperCase() : "";
  const countyFips = typeof ctx.countyFips === "string" ? ctx.countyFips.trim() : "";
  const countyName =
    typeof ctx.countyName === "string"
      ? ctx.countyName.trim()
      : typeof (ctx as any).county === "string"
        ? String((ctx as any).county).trim()
        : "";

  return stateCode.length === 2 && countyFips.length !== 5 && countyName.length > 0;
}

export function useLocationContext(overrides?: Partial<LocationContext>): LocationContext {
  const { user } = useAuth() as any;

  // Canonical fields (preferred)
  const profileStateCode: string | undefined = user?.stateCode ?? undefined;
  const profileCountyFips: string | undefined = (user as any)?.countyFips ?? undefined;
  const profileCountyId: string | undefined = (user as any)?.countyId ?? undefined;
  const profileCountyName: string | undefined = (user as any)?.countyName ?? undefined;

  // Legacy fields (fallback for existing users who signed up before canonical fields)
  const legacyState: string | undefined = user?.state ?? undefined;
  const legacyCounty: string | undefined = user?.county ?? undefined;

  // Use canonical fields if available, otherwise fall back to legacy
  const resolvedStateCode = profileStateCode || legacyState;
  const resolvedCountyFips = profileCountyFips; // No direct legacy equivalent for FIPS
  const resolvedCountyName = profileCountyName || legacyCounty;

  const profileLat: number | undefined =
    typeof user?.latitude === "number" ? user.latitude : undefined;
  const profileLng: number | undefined =
    typeof user?.longitude === "number" ? user.longitude : undefined;

  const prefsGeo = (user as any)?.preferences?.geo;
  const homeLocation = prefsGeo?.homeLocation as
    | { lat?: number; lng?: number; label?: string }
    | undefined;

  // Start from global/session scope so callers never see an undefined layer.
  let resolved: LocationContext = {
    layer: "global",
    source: "session",
  };

  // 4) Anonymous/session-level overrides for location (e.g. public contractor search)
  if (!user) {
    const raw = safeStorage.get(SESSION_LOCATION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionLocationPayload;
        if (parsed && (parsed.stateCode || parsed.countyFips || parsed.countyName)) {
          resolved = {
            ...resolved,
            layer: "county",
            source: "session",
            stateCode: parsed.stateCode,
            countyFips: parsed.countyFips,
            countyId: parsed.countyId,
            countyName: parsed.countyName,
            lat: parsed.lat,
            lng: parsed.lng,
            label: parsed.label,
          };
        }
      } catch {
        // Ignore malformed payloads and fall back to global/session
      }
    }
  }

  // 3) Profile fields (default county-level context when available)
  // Support both canonical fields (stateCode, countyFips) and legacy fields (state, county)
  if (resolvedStateCode || resolvedCountyFips || resolvedCountyName) {
    const label = getUserLocationLabel(user as any);

    resolved = {
      ...resolved,
      layer: "county",
      source: "profile",
      stateCode: resolvedStateCode,
      countyFips: resolvedCountyFips,
      countyId: profileCountyId,
      countyName: resolvedCountyName,
      lat: profileLat,
      lng: profileLng,
      label,
    };
  }

  // 2) Hyper-local geo preference (homeLocation) overrides profile geo when present
  if (homeLocation) {
    const fallbackLabel = getUserLocationLabel(user as any);
    const label =
      typeof homeLocation.label === "string" && homeLocation.label.trim().length > 0
        ? homeLocation.label
        : fallbackLabel;

    resolved = {
      ...resolved,
      // Keep any existing machine identifiers (stateCode/countyFips) from profile,
      // but prefer precise lat/lng from geo preferences when available.
      layer: resolved.layer === "global" ? "county" : resolved.layer,
      source: "geo_preference",
      lat: typeof homeLocation.lat === "number" ? homeLocation.lat : resolved.lat,
      lng: typeof homeLocation.lng === "number" ? homeLocation.lng : resolved.lng,
      label,
    };
  }

  // 1) Explicit overrides are highest precedence and mark the context as override-derived.
  if (overrides && Object.keys(overrides).length > 0) {
    resolved = {
      ...resolved,
      ...overrides,
      source: "override",
    };
  }

  // Back-compat: several call sites still read a loose `county` field.
  const withCompat: any = { ...resolved };
  if (withCompat.county == null && resolved.countyName) {
    withCompat.county = resolved.countyName;
  }

  return withCompat as LocationContext;
}
