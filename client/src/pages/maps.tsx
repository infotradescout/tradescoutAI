import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { apiRequest } from "@/lib/queryClient";
import { useLocationContext } from "@/hooks/useLocationContext";

type MapEntityType =
  | "provider"
  | "public_profile"
  | "business"
  | "trade_deal"
  | "food_truck"
  | "parking_pass";

type MapEntityPoint = {
  id: string;
  type: MapEntityType;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: Record<string, unknown>;
};

type TradeOption = {
  id: string;
  name: string;
  slug: string;
};

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const MAPS_V1_ENABLED =
  String(import.meta.env.VITE_FEATURE_MAPS_V1 ?? "true")
    .trim()
    .toLowerCase() !== "false";

const SCRIPT_ID = "ts-google-maps-v1-script";

async function fetchPublicConfigWithFallback(): Promise<{ googleMapsApiKey: string } | null> {
  try {
    // Cache-bust to avoid a 304 from a stale SW/browser cache.
    const url = `/api/public-config?_=${Date.now()}`;
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (!res.ok) return null;

    const text = await res.text();
    const payload = text ? (JSON.parse(text) as any) : null;
    const key = String(payload?.googleMapsApiKey || "").trim();
    if (!key) return null;

    return { googleMapsApiKey: key };
  } catch {
    return null;
  }
}

async function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.google?.maps) return;

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")), {
        once: true,
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    // Google Maps calls `window.gm_authFailure()` when the key is blocked by restrictions
    // (commonly HTTP referrer restrictions / RefererNotAllowedMapError).
    window.gm_authFailure = () =>
      reject(new Error("Google Maps auth failed (check HTTP referrer restrictions)"));

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export default function MapsPage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  const location = useLocationContext();
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState<string>("");
  const [mapsApiKey, setMapsApiKey] = useState<string>("");
  const [bbox, setBbox] = useState<string>("");
  const [trade, setTrade] = useState<string>("");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [layers, setLayers] = useState<Record<MapEntityType, boolean>>({
    provider: true,
    public_profile: true,
    business: true,
    trade_deal: true,
    food_truck: true,
    parking_pass: true,
  });
  const [selectedPoint, setSelectedPoint] = useState<MapEntityPoint | null>(null);

  useEffect(() => {
    const fromVite = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
    if (fromVite) {
      setMapsApiKey(fromVite);
      return;
    }

    let cancelled = false;
    fetchPublicConfigWithFallback()
      .then((payload: any) => {
        if (cancelled) return;
        const key = String(payload?.googleMapsApiKey || "").trim();
        if (key) setMapsApiKey(key);
      })
      .catch(() => {
        // Ignore; scriptError will surface missing key below.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!MAPS_V1_ENABLED) return;
    if (!mapsApiKey) {
      setScriptError("Missing Google Maps API key");
      return;
    }

    // Key is available now; clear any earlier "missing key" error.
    setScriptError("");

    let cancelled = false;
    loadGoogleMapsScript(mapsApiKey)
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setScriptError(err instanceof Error ? err.message : "Failed to load map");
      });

    return () => {
      cancelled = true;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    if (!scriptReady || !mapContainerRef.current || mapRef.current) return;

    const center = {
      lat: typeof location.lat === "number" ? location.lat : 30.2672,
      lng: typeof location.lng === "number" ? location.lng : -97.7431,
    };

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
    });
    mapRef.current = map;

    const updateBbox = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const next = [sw.lng(), sw.lat(), ne.lng(), ne.lat()].map((v) => v.toFixed(6)).join(",");
      setBbox((prev) => (prev === next ? prev : next));
    };

    window.google.maps.event.addListenerOnce(map, "idle", updateBbox);
    map.addListener("idle", updateBbox);
  }, [location.lat, location.lng, scriptReady]);

  const { data: tradesData } = useQuery<TradeOption[]>({
    queryKey: ["/api/trades"],
    enabled: MAPS_V1_ENABLED,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/trades");
      return Array.isArray(response) ? response : [];
    },
  });

  const enabledTypes = useMemo(() => {
    const types = Object.entries(layers)
      .filter(([, enabled]) => enabled)
      .map(([type]) => type)
      .sort();
    return types.join(",");
  }, [layers]);

  const { data: entitiesData, isFetching } = useQuery<{
    points: MapEntityPoint[];
    meta: { count: number };
  }>({
    queryKey: ["/api/map/entities", bbox, trade || "all", verifiedOnly ? "1" : "0", enabledTypes],
    enabled: MAPS_V1_ENABLED && scriptReady && bbox.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("bbox", bbox);
      params.set("limit", "5000");
      if (trade) params.set("trade", trade);
      if (verifiedOnly) params.set("verified", "true");
      if (enabledTypes) params.set("types", enabledTypes);
      const path = `/api/map/entities?${params.toString()}`;
      return await apiRequest("GET", path);
    },
    staleTime: 30_000,
  });

  const points = useMemo(() => entitiesData?.points || [], [entitiesData?.points]);
  const trades = useMemo(
    () =>
      (Array.isArray(tradesData) ? tradesData : [])
        .filter((item) => typeof item?.slug === "string" && item.slug.trim().length > 0)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tradesData]
  );

  useEffect(() => {
    if (!scriptReady || !mapRef.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    const iconForPoint = (point: MapEntityPoint) => {
      const verifiedStatus = String((point.meta as any)?.verifiedStatus || "").toLowerCase();
      // Verified entities should stand out. Anything not verified (including directory shells) is grey.
      if (verifiedStatus === "verified") {
        return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
      }
      if (verifiedStatus === "unverified" || verifiedStatus === "directory") {
        return "https://maps.google.com/mapfiles/ms/icons/grey-dot.png";
      }

      const byType: Record<MapEntityType, string> = {
        provider: "orange",
        public_profile: "blue",
        business: "purple",
        trade_deal: "green",
        food_truck: "red",
        parking_pass: "yellow",
      };
      const color = byType[point.type] || "gray";
      return `https://maps.google.com/mapfiles/ms/icons/${color}-dot.png`;
    };

    const markers = points.map((point) => {
      const marker = new window.google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        title: point.title,
        icon: iconForPoint(point),
      });
      marker.addListener("click", () => {
        setSelectedPoint(point);
      });
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers,
    });
  }, [points, scriptReady]);

  if (!MAPS_V1_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-xl border border-white/10 bg-tsCard p-4">
          <h1 className="text-lg font-semibold text-white">Maps is temporarily disabled</h1>
          <p className="mt-1 text-sm text-white/60">This feature is disabled by configuration.</p>
        </div>
      </div>
    );
  }

  if (scriptError) {
    const lower = scriptError.toLowerCase();
    const isAuthFailure =
      lower.includes("auth failed") ||
      lower.includes("referrer") ||
      lower.includes("referer") ||
      lower.includes("notallowed") ||
      lower.includes("not allowed");

    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4">
          <h1 className="text-lg font-semibold text-white">Map unavailable</h1>
          <p className="mt-1 text-sm text-red-200">{scriptError}</p>
          {isAuthFailure && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/80">
              <div className="font-semibold text-white">Fix (Google Cloud Console)</div>
              <ol className="mt-2 list-decimal pl-5 space-y-1 text-white/70">
                <li>
                  Enable <span className="text-white">Maps JavaScript API</span> for the project.
                </li>
                <li>
                  In the API key&apos;s restrictions, allow these HTTP referrers:
                  <ul className="mt-1 list-disc pl-5">
                    <li>
                      <span className="text-white">https://www.thetradescout.com/*</span>
                    </li>
                    <li>
                      <span className="text-white">https://thetradescout.com/*</span>
                    </li>
                    <li>
                      <span className="text-white">http://localhost:*/*</span> (dev)
                    </li>
                  </ul>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-3 md:p-4 space-y-3">
      <header className="rounded-xl border border-white/10 bg-tsCard p-3 md:p-4">
        <h1 className="text-base md:text-lg font-semibold text-white">Local Map</h1>
        <p className="text-xs md:text-sm text-white/60 mt-1">
          Awareness map with opt-in profiles, deals, and external feeds.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
          <label className="text-xs text-white/60">
            Trade
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-tsBg px-2 py-2 text-sm text-white"
              value={trade}
              onChange={(event) => setTrade(event.target.value)}
            >
              <option value="">All trades</option>
              {trades.map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 rounded-md border border-white/10 bg-tsBg px-3 py-2">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
            />
            <span className="text-sm text-white">Verified only</span>
          </label>
          <div className="rounded-md border border-white/10 bg-tsBg px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-white/60">Layers</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(layers) as MapEntityType[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-xs text-white">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(event) =>
                      setLayers((prev) => ({ ...prev, [key]: event.target.checked }))
                    }
                  />
                  <span className="capitalize">{key.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-tsBg px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-white/60">Pins</div>
            <div className="text-sm text-white">{points.length}</div>
            <div className="text-xs text-white/60">
              {isFetching ? "Updating..." : "Live bounds"}
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
        <div ref={mapContainerRef} className="h-[62vh] min-h-[420px] w-full" />
      </section>

      {selectedPoint && (
        <section className="rounded-xl border border-white/10 bg-tsCard p-3 md:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{selectedPoint.title}</div>
              {selectedPoint.subtitle ? (
                <div className="mt-1 text-xs text-white/60">{selectedPoint.subtitle}</div>
              ) : (
                <div className="mt-1 text-xs text-white/60 capitalize">
                  {selectedPoint.type.replace(/_/g, " ")}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoint(null)}
              className="rounded-md border border-white/10 bg-tsBg px-2 py-1 text-xs text-white"
            >
              Close
            </button>
          </div>

          {selectedPoint.type === "provider" && (
            <div className="mt-3">
              <Link
                href={`/request-quote?providerId=${encodeURIComponent(selectedPoint.id)}`}
                className="inline-flex items-center rounded-md bg-ts-orange px-3 py-2 text-sm font-semibold text-black"
              >
                Request Quote
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
