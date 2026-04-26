/**
 * GooglePlacesBusinessInput
 *
 * A self-contained business name autocomplete powered by the Google Places
 * Autocomplete API restricted to the "establishment" type.
 *
 * When the user selects a business from the dropdown, the component extracts:
 *   - businessName  (place.name)
 *   - city          (locality)
 *   - stateCode     (administrative_area_level_1 short_name)
 *   - countyName    (administrative_area_level_2 long_name, stripped)
 *   - phone         (place.formatted_phone_number)
 *   - website       (place.website)
 *   - address       (place.formatted_address)
 *   - placeId       (place.place_id)
 *   - lat / lng     (place.geometry.location)
 *
 * Falls back gracefully to a plain text input when no API key is configured.
 *
 * Usage:
 *   <GooglePlacesBusinessInput
 *     defaultValue={businessName}
 *     onBusinessSelected={({ businessName, city, stateCode, ... }) => { ... }}
 *   />
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Building2, Loader2, AlertCircle } from "lucide-react";

export interface BusinessPlaceResult {
  businessName?: string;
  city?: string;
  stateCode?: string;
  countyName?: string;
  phone?: string;
  website?: string;
  address?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

interface Props {
  placeholder?: string;
  defaultValue?: string;
  onBusinessSelected: (result: BusinessPlaceResult) => void;
  className?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

const SCRIPT_ID = "ts-google-places-script";
const PLACES_LOADED_EVENT = "ts:google-places-loaded";

/** Resolve the Maps API key from the /api/public-config endpoint */
async function resolveMapsApiKey(): Promise<string> {
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

/** Load the Google Maps JS SDK (idempotent) */
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
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Script failed")), { once: true });
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
    script.onload = () => {
      window.dispatchEvent(new CustomEvent(PLACES_LOADED_EVENT));
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

/** Extract structured data from a Google Place result */
function parsePlaceResult(place: google.maps.places.PlaceResult): BusinessPlaceResult {
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
      stateCode = component.short_name;
    } else if (types.includes("administrative_area_level_2")) {
      countyName = component.long_name
        .replace(/\s+(County|Parish|Borough|Census Area|Municipality|District)$/i, "")
        .trim();
    }
  }

  const location = place.geometry?.location;
  return {
    businessName: place.name || undefined,
    city: city || undefined,
    stateCode: stateCode || undefined,
    countyName: countyName || undefined,
    phone: place.formatted_phone_number || undefined,
    website: place.website || undefined,
    address: place.formatted_address || undefined,
    placeId: place.place_id || undefined,
    lat: location?.lat() ?? undefined,
    lng: location?.lng() ?? undefined,
  };
}

export function GooglePlacesBusinessInput({
  placeholder = "Search for your business",
  defaultValue = "",
  onBusinessSelected,
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
    if (autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["establishment"],
      componentRestrictions: { country: "us" },
      fields: [
        "address_components",
        "geometry",
        "formatted_address",
        "name",
        "place_id",
        "formatted_phone_number",
        "website",
      ],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place || !place.name) return;

      const result = parsePlaceResult(place);
      setInputValue(place.name || "");
      onBusinessSelected(result);
    });

    autocompleteRef.current = autocomplete;
    setStatus("ready");
  }, [onBusinessSelected]);

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
        if (!cancelled) initAutocomplete();
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    if (window.google?.maps?.places) {
      initAutocomplete();
    } else {
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

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const icon =
    status === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin text-white/40" />
    ) : status === "error" ? (
      <AlertCircle
        className="h-4 w-4 text-amber-400"
        title="Google Places unavailable — type your business name manually"
      />
    ) : (
      <Building2 className="h-4 w-4 text-white/40" />
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
