/**
 * useScoutLocation
 *
 * Reads the canonical app location model for Scout home context.
 *
 * Scout does not collect standalone page-level location. Account/session
 * location can silently inform local context; missing location should be
 * requested conversationally inside Scout only when a task actually needs it.
 */

import { hasCountyContext, useLocationContext } from "@/hooks/useLocationContext";

export type LocationSource = "profile" | "session" | "default";
export type LocationStatus = "idle" | "resolved";

export interface ScoutLocation {
  county: string;
  state: string;
  city: string;
  fips: string | null;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  status: LocationStatus;
  error: string | null;
}

const DEFAULT_LOCATION: ScoutLocation = {
  county: "",
  state: "",
  city: "",
  fips: null,
  lat: null,
  lng: null,
  source: "default",
  status: "idle",
  error: null,
};

export function useScoutLocation() {
  const locationCtx = useLocationContext();

  const canonicalCounty = locationCtx.countyName ?? "";
  const canonicalState = locationCtx.stateCode ?? "";
  const canonicalFips = locationCtx.countyFips ?? null;

  const hasCanonical = hasCountyContext(locationCtx) || Boolean(canonicalCounty);
  const canonicalSource: LocationSource =
    locationCtx.source === "session" ? "session" : hasCanonical ? "profile" : "default";

  const location: ScoutLocation = hasCanonical
    ? {
        county: canonicalCounty,
        state: canonicalState,
        city: "",
        fips: canonicalFips,
        lat: locationCtx.lat ?? null,
        lng: locationCtx.lng ?? null,
        source: canonicalSource,
        status: "resolved",
        error: null,
      }
    : DEFAULT_LOCATION;

  return { location };
}
