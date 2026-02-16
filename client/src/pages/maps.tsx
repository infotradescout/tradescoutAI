import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { apiRequest } from "@/lib/queryClient";
import { useLocationContext } from "@/hooks/useLocationContext";

type MapProvider = {
  id: string;
  displayName: string;
  lat: number;
  lng: number;
  countyId: string | null;
  countyFips: string | null;
  countyName: string | null;
  tradeCategories: string[];
  verifiedStatus: "verified" | "unverified";
  role: string | null;
};

type TradeOption = {
  id: string;
  name: string;
  slug: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

const MAPS_V1_ENABLED =
  String(import.meta.env.VITE_FEATURE_MAPS_V1 || "false").toLowerCase() === "true";
const GOOGLE_MAPS_API_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();

const SCRIPT_ID = "ts-google-maps-v1-script";

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
  const [bbox, setBbox] = useState<string>("");
  const [trade, setTrade] = useState<string>("");
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [selectedProvider, setSelectedProvider] = useState<MapProvider | null>(null);

  useEffect(() => {
    if (!MAPS_V1_ENABLED) return;
    if (!GOOGLE_MAPS_API_KEY) {
      setScriptError("Missing VITE_GOOGLE_MAPS_API_KEY");
      return;
    }

    let cancelled = false;
    loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
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
  }, []);

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

  const { data: providersData, isFetching } = useQuery<{
    providers: MapProvider[];
    meta: { count: number };
  }>({
    queryKey: ["/api/map/providers", bbox, trade || "all", verifiedOnly ? "1" : "0"],
    enabled: MAPS_V1_ENABLED && scriptReady && bbox.length > 0,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("bbox", bbox);
      params.set("limit", "2000");
      if (trade) params.set("trade", trade);
      if (verifiedOnly) params.set("verified", "true");
      return apiRequest("GET", `/api/map/providers?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const providers = useMemo(() => providersData?.providers || [], [providersData?.providers]);
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

    const markers = providers.map((provider) => {
      const marker = new window.google.maps.Marker({
        position: { lat: provider.lat, lng: provider.lng },
        title: provider.displayName,
      });
      marker.addListener("click", () => {
        setSelectedProvider(provider);
      });
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers,
    });
  }, [providers, scriptReady]);

  if (!MAPS_V1_ENABLED) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-xl border border-tsBorder bg-tsSurface p-4">
          <h1 className="text-lg font-semibold text-white">Maps v1 is off</h1>
          <p className="mt-1 text-sm text-tsTextMuted">
            Enable `VITE_FEATURE_MAPS_V1=true` and `FEATURE_MAPS_V1=true` to use this screen.
          </p>
        </div>
      </div>
    );
  }

  if (scriptError) {
    return (
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4">
          <h1 className="text-lg font-semibold text-white">Map unavailable</h1>
          <p className="mt-1 text-sm text-red-200">{scriptError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-3 md:p-4 space-y-3">
      <header className="rounded-xl border border-tsBorder bg-tsSurface p-3 md:p-4">
        <h1 className="text-base md:text-lg font-semibold text-white">Provider Map</h1>
        <p className="text-xs md:text-sm text-tsTextMuted mt-1">
          Awareness-only discovery. Contact stays request-gated.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs text-tsTextMuted">
            Trade
            <select
              className="mt-1 w-full rounded-md border border-tsBorder bg-tsBg px-2 py-2 text-sm text-white"
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
          <label className="flex items-end gap-2 rounded-md border border-tsBorder bg-tsBg px-3 py-2">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(event) => setVerifiedOnly(event.target.checked)}
            />
            <span className="text-sm text-white">Verified only</span>
          </label>
          <div className="rounded-md border border-tsBorder bg-tsBg px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-tsTextMuted">Pins</div>
            <div className="text-sm text-white">{providers.length}</div>
            <div className="text-xs text-tsTextMuted">
              {isFetching ? "Updating..." : "Live bounds"}
            </div>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden rounded-xl border border-tsBorder bg-black">
        <div ref={mapContainerRef} className="h-[62vh] min-h-[420px] w-full" />
      </section>

      {selectedProvider && (
        <section className="rounded-xl border border-tsBorder bg-tsSurface p-3 md:p-4">
          <div className="text-sm font-semibold text-white">{selectedProvider.displayName}</div>
          <div className="mt-1 text-xs text-tsTextMuted">
            {selectedProvider.countyName || "County unknown"} •{" "}
            {selectedProvider.verifiedStatus === "verified" ? "Verified" : "Unverified"}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(selectedProvider.tradeCategories || []).slice(0, 5).map((category) => (
              <span
                key={category}
                className="rounded-full border border-tsBorder bg-tsBg px-2 py-0.5 text-[11px] text-tsTextMuted"
              >
                {category}
              </span>
            ))}
          </div>
          <div className="mt-3">
            <Link
              href={`/request-quote?providerId=${encodeURIComponent(selectedProvider.id)}`}
              className="inline-flex items-center rounded-md bg-orange-500 px-3 py-2 text-sm font-semibold text-black"
            >
              Request Quote
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
