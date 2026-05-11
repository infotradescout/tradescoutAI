/**
 * useScoutLocation
 *
 * Bridges the canonical app location model (useLocationContext) with a
 * browser/IP geolocation fallback chain for the Scout OS home surface.
 *
 * Priority order:
 *   1. useLocationContext — profile, session override, or geo preference (canonical)
 *   2. Browser Geolocation API (reverse geocode via Nominatim)
 *   3. IP Geolocation (ipapi.co)
 *   4. Manual entry (user types city or zip)
 *
 * When the canonical context already has a county, we use it directly and
 * skip the browser/IP chain entirely. The manual override writes back to
 * the session location store so the rest of the app stays in sync.
 */

import { useState, useEffect, useCallback } from "react";
import {
  useLocationContext,
  hasCountyContext,
  setSessionLocationOverride,
  clearSessionLocationOverride,
} from "@/hooks/useLocationContext";

export type LocationSource = "profile" | "session" | "browser" | "ip" | "manual" | "default";
export type LocationStatus = "idle" | "resolving" | "resolved" | "error";

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

// ── Reverse geocode lat/lng → county/state via Nominatim ──────────────────
async function reverseGeocode(lat: number, lng: number): Promise<Partial<ScoutLocation> | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "TradeScout/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};
    const county = addr.county?.replace(/ County$/, "") ?? addr.city_district ?? addr.suburb ?? "";
    const state = addr["ISO3166-2-lvl4"]?.split("-")[1] ?? addr.state_code ?? addr.state ?? "";
    const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    return { county, state, city, lat, lng };
  } catch {
    return null;
  }
}

// ── IP geolocation fallback ────────────────────────────────────────────────
async function resolveFromIP(): Promise<Partial<ScoutLocation> | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    const county = data.county ?? data.city ?? "";
    const state = data.region_code ?? "";
    const city = data.city ?? "";
    const lat = data.latitude ?? null;
    const lng = data.longitude ?? null;
    return { county, state, city, lat, lng };
  } catch {
    return null;
  }
}

// ── Resolve FIPS from county + state via Trade Scout API ──────────────────
async function resolveFips(county: string, state: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ county, state });
    const res = await fetch(`/api/scout/home-snapshot?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.snapshot?.fips ?? null;
  } catch {
    return null;
  }
}

// ── Main hook ──────────────────────────────────────────────────────────────
export function useScoutLocation() {
  const locationCtx = useLocationContext();
  const [geoLocation, setGeoLocation] = useState<ScoutLocation>(DEFAULT_LOCATION);

  // Derive from canonical context if available
  const canonicalCounty = locationCtx.countyName ?? (locationCtx as any).county ?? "";
  const canonicalState = locationCtx.stateCode ?? "";
  const canonicalFips = locationCtx.countyFips ?? null;
  const canonicalSource: LocationSource =
    locationCtx.source === "profile"
      ? "profile"
      : locationCtx.source === "session"
        ? "session"
        : "default";

  const hasCanonical = hasCountyContext(locationCtx) || Boolean(canonicalCounty);

  // If we have canonical data, return it directly — no geo chain needed
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
    : geoLocation;

  // Manual override — user types their city/zip
  const setManualLocation = useCallback(async (input: string) => {
    setGeoLocation((prev) => ({ ...prev, status: "resolving", source: "manual" }));
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        input
      )}&addressdetails=1&limit=1&countrycodes=us`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en", "User-Agent": "TradeScout/1.0" },
      });
      if (res.ok) {
        const results = await res.json();
        if (results[0]) {
          const addr = results[0].address ?? {};
          const county =
            addr.county?.replace(/ County$/, "") ?? addr.city_district ?? addr.suburb ?? input;
          const state =
            addr["ISO3166-2-lvl4"]?.split("-")[1] ?? addr.state_code ?? addr.state ?? "";
          const city = addr.city ?? addr.town ?? addr.village ?? input;
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          const fips = await resolveFips(county, state);

          // Write back to session store so the rest of the app picks it up
          setSessionLocationOverride({
            stateCode: state,
            countyFips: fips ?? undefined,
            countyName: county,
            lat,
            lng,
            label: `${county}${state ? `, ${state}` : ""}`,
          });

          const newLoc: ScoutLocation = {
            county,
            state,
            city,
            fips,
            lat,
            lng,
            source: "manual",
            status: "resolved",
            error: null,
          };
          setGeoLocation(newLoc);
          return;
        }
      }
    } catch {}
    setGeoLocation((prev) => ({
      ...prev,
      county: input,
      city: input,
      status: "resolved",
      source: "manual",
      error: null,
    }));
  }, []);

  // Clear manual override and reset
  const clearLocation = useCallback(() => {
    clearSessionLocationOverride();
    setGeoLocation({ ...DEFAULT_LOCATION, status: "idle" });
  }, []);

  // Auto-resolve via browser/IP only when no canonical context exists
  useEffect(() => {
    if (hasCanonical) return; // canonical context is sufficient
    if (geoLocation.status !== "idle") return;

    let cancelled = false;

    const resolve = async () => {
      setGeoLocation((prev) => ({ ...prev, status: "resolving" }));

      // ── Tier 1: Browser Geolocation ──────────────────────────────────
      const browserResult = await new Promise<Partial<ScoutLocation> | null>((res) => {
        if (!navigator.geolocation) {
          res(null);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const geo = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
            res(geo);
          },
          () => res(null),
          { timeout: 5000, maximumAge: 60000 }
        );
      });

      if (cancelled) return;

      if (browserResult?.county) {
        const fips = await resolveFips(browserResult.county, browserResult.state ?? "");
        if (!cancelled) {
          const newLoc: ScoutLocation = {
            county: browserResult.county ?? "",
            state: browserResult.state ?? "",
            city: browserResult.city ?? "",
            fips,
            lat: browserResult.lat ?? null,
            lng: browserResult.lng ?? null,
            source: "browser",
            status: "resolved",
            error: null,
          };
          setGeoLocation(newLoc);
        }
        return;
      }

      // ── Tier 2: IP Geolocation ────────────────────────────────────────
      const ipResult = await resolveFromIP();
      if (cancelled) return;

      if (ipResult?.county || ipResult?.city) {
        const county = ipResult.county || ipResult.city || "";
        const state = ipResult.state ?? "";
        const fips = await resolveFips(county, state);
        if (!cancelled) {
          const newLoc: ScoutLocation = {
            county,
            state,
            city: ipResult.city ?? "",
            fips,
            lat: ipResult.lat ?? null,
            lng: ipResult.lng ?? null,
            source: "ip",
            status: "resolved",
            error: null,
          };
          setGeoLocation(newLoc);
        }
        return;
      }

      // ── Tier 3: Prompt manual entry ───────────────────────────────────
      if (!cancelled) {
        setGeoLocation((prev) => ({
          ...prev,
          status: "error",
          source: "default",
          error: "We couldn't detect your location automatically.",
        }));
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [hasCanonical, geoLocation.status]);

  return { location, setManualLocation, clearLocation };
}
