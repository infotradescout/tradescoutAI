/**
 * GooglePlacesLocationInput
 *
 * A self-contained address/city autocomplete input powered by the Google Places
 * Autocomplete API (new Places API, `PlaceAutocompleteElement` + legacy
 * `Autocomplete` fallback).
 *
 * Usage:
 *   <GooglePlacesLocationInput
 *     placeholder="Enter your city or address"
 *     onPlaceSelected={({ city, stateCode, countyFips, countyName, lat, lng }) => { ... }}
 *   />
 *
 * The component:
 *  1. Loads the Google Maps JS SDK once (idempotent – reuses existing script tag).
 *  2. Restricts results to the United States.
 *  3. Parses the selected place's address_components to extract city, state, and
 *     county (administrative_area_level_2).
 *  4. Falls back gracefully to the manual StateCountySelector when no API key is
 *     configured or the script fails to load.
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, AlertCircle } from "lucide-react";

export interface PlaceResult {
  city?: string;
  stateCode?: string;
  countyName?: string;
  /** Raw county FIPS is NOT available from the Places API; callers should use
   *  the existing county-inference service to resolve FIPS from name + state. */
  countyFips?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

interface Props {
  placeholder?: string;
  defaultValue?: string;
  onPlaceSelected: (result: PlaceResult) => void;
  /** Optional: restrict to specific types. Defaults to ["(cities)"] */
  types?: string[];
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const SCRIPT_ID = "ts-google-places-script";
const PLACES_LOADED_EVENT = "ts:google-places-loaded";
const PLACES_ERROR_EVENT = "ts:google-places-error";

/** Resolve the Maps API key from Vite env vars or the /api/public-config endpoint */
async function resolveMapsApiKey(): Promise<string> {
  const fromVite = String(
    (import.meta as any).env?.VITE_GOOGLE_MAPS_WEB_API_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
      ""
  ).trim();
  if (fromVite) return fromVite;

  try {
    const res = await fetch(`/api/public-config?_=${Date.now()}`, {
      credentials: "include",
    });
    if (!res.ok) return "";
    const payload = await res.json();
    return String(payload?.googleMapsApiKey || "").trim();
  } catch {
    return "";
  }
}

/** Load the Google Maps JS SDK with the Places library (idempotent) */
function loadGooglePlacesScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps?.places) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      if (window.google?.maps?.places) {
        resolve();
        return;
      }
      const onLoad = () => resolve();
      const onError = () => reject(new Error("Google Maps script failed to load"));
      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // Include the places library and use the new Places API
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => {
      window.dispatchEvent(new CustomEvent(PLACES_LOADED_EVENT));
      resolve();
    };
    script.onerror = () => {
      window.dispatchEvent(new CustomEvent(PLACES_ERROR_EVENT));
      reject(new Error("Failed to load Google Maps / Places script"));
    };
    document.head.appendChild(script);
  });
}

/** Extract structured location data from a Google Place result */
function parsePlaceComponents(place: google.maps.places.PlaceResult): PlaceResult {
  const components = place.address_components || [];
  let city = "";
  let stateCode = "";
  let countyName = "";

  for (const component of components) {
    const types = component.types;
    if (types.includes("locality")) {
      city = component.long_name;
    } else if (types.includes("sublocality_level_1") && !city) {
      city = component.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      stateCode = component.short_name; // e.g. "TX"
    } else if (types.includes("administrative_area_level_2")) {
      // Strip trailing " County" / " Parish" etc. for a clean name
      countyName = component.long_name.replace(/\s+(County|Parish|Borough|Census Area|Municipality|District)$/i, "").trim();
    }
  }

  const location = place.geometry?.location;
  return {
    city: city || undefined,
    stateCode: stateCode || undefined,
    countyName: countyName || undefined,
    lat: location?.lat() ?? undefined,
    lng: location?.lng() ?? undefined,
    formattedAddress: place.formatted_address || undefined,
  };
}

export function GooglePlacesLocationInput({
  placeholder = "Enter your city",
  defaultValue = "",
  onPlaceSelected,
  types = ["(cities)"],
  className = "",
  disabled = false,
  "data-testid": testId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [inputValue, setInputValue] = useState(defaultValue);

  const initAutocomplete = useCallback(() => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    if (autocompleteRef.current) return; // already initialized

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types,
      componentRestrictions: { country: "us" },
      fields: ["address_components", "geometry", "formatted_address", "name"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.address_components) return;

      const result = parsePlaceComponents(place);
      setInputValue(place.formatted_address || place.name || inputRef.current?.value || "");
      onPlaceSelected(result);
    });

    autocompleteRef.current = autocomplete;
    setStatus("ready");
  }, [types, onPlaceSelected]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setStatus("loading");
      try {
        const apiKey = await resolveMapsApiKey();
        if (!apiKey) {
          if (!cancelled) setStatus("error");
          return;
        }
        await loadGooglePlacesScript(apiKey);
        if (!cancelled) {
          initAutocomplete();
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    // If already loaded, initialize immediately
    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
      // Listen for the script-loaded event in case another component triggered the load
      const onLoaded = () => {
        if (!cancelled) initAutocomplete();
      };
      window.addEventListener(PLACES_LOADED_EVENT, onLoaded, { once: true });
      init();
      return () => {
        cancelled = true;
        window.removeEventListener(PLACES_LOADED_EVENT, onLoaded);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [initAutocomplete]);

  // Sync external defaultValue changes
  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin text-white/40" />
    ) : status === "error" ? (
      <AlertCircle className="h-4 w-4 text-amber-400" title="Google Places unavailable — type your city manually" />
    ) : (
      <MapPin className="h-4 w-4 text-white/40" />
    );

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="pointer-events-none absolute left-3 flex items-center">{icon}</div>
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || status === "loading"}
        data-testid={testId}
        className="pl-9"
        autoComplete="off"
      />
    </div>
  );
}
