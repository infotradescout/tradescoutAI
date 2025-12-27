import { useAuth } from "@/hooks/useAuth";
import { getUserLocationLabel } from "@/lib/copyHelpers";
import { safeStorage } from "@/utils/safeStorage";

export type LocationLayer = "project" | "hoa" | "county" | "global";

export type LocationSource =
  | "profile"
  | "geo_preference"
  | "override"
  | "session";

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

export function useLocationContext(
  overrides?: Partial<LocationContext>
): LocationContext {
  const { user } = useAuth() as any;

  const profileStateCode: string | undefined =
    user?.stateCode ?? user?.state ?? undefined;
  const profileCountyFips: string | undefined =
    (user as any)?.countyFips ?? undefined;
  const profileCountyId: string | undefined =
    (user as any)?.countyId ?? undefined;
  const profileCountyName: string | undefined =
    (user as any)?.countyName ?? (user?.county ? String(user.county) : undefined);
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
        if (
          parsed &&
          (parsed.stateCode || parsed.countyFips || parsed.countyName)
        ) {
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
  if (profileStateCode || profileCountyFips || profileCountyName) {
    const label = getUserLocationLabel(user as any);

    resolved = {
      ...resolved,
      layer: "county",
      source: "profile",
      stateCode: profileStateCode,
      countyFips: profileCountyFips,
      countyId: profileCountyId,
      countyName: profileCountyName,
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
      lat:
        typeof homeLocation.lat === "number" ? homeLocation.lat : resolved.lat,
      lng:
        typeof homeLocation.lng === "number" ? homeLocation.lng : resolved.lng,
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
