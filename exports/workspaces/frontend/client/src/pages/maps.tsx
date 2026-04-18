import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { apiRequest } from "@/lib/queryClient";
import { useLocationContext } from "@/hooks/useLocationContext";
import { SEOHelmet } from "@/components/SEOHelmet";
import { COMPREHENSIVE_TRADES } from "@shared/trades-data";

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

type SortMode = "priority" | "alpha" | "verified";

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
const GOOGLE_MAPS_MAP_ID = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "").trim();

const SCRIPT_ID = "ts-google-maps-v1-script";
const GOOGLE_MAPS_AUTH_FAILURE_EVENT = "ts:google-maps-auth-failure";
const GOOGLE_MAPS_BILLING_FAILURE_EVENT = "ts:google-maps-billing-failure";

const LAYER_META: Record<
  MapEntityType,
  {
    label: string;
    subtitle: string;
    colorClass: string;
    badgeClass: string;
  }
> = {
  provider: {
    label: "Provider",
    subtitle: "Operational businesses",
    colorClass: "bg-orange-400",
    badgeClass: "border-orange-400/30 bg-orange-500/15 text-orange-100",
  },
  public_profile: {
    label: "Public Profile",
    subtitle: "Opt-in profile pages",
    colorClass: "bg-sky-400",
    badgeClass: "border-sky-400/30 bg-sky-500/15 text-sky-100",
  },
  business: {
    label: "Business",
    subtitle: "Directory businesses",
    colorClass: "bg-fuchsia-400",
    badgeClass: "border-fuchsia-400/30 bg-fuchsia-500/15 text-fuchsia-100",
  },
  trade_deal: {
    label: "Trade Deal",
    subtitle: "Market deal signals",
    colorClass: "bg-emerald-400",
    badgeClass: "border-emerald-400/30 bg-emerald-500/15 text-emerald-100",
  },
  food_truck: {
    label: "Food Truck",
    subtitle: "Local mobility listings",
    colorClass: "bg-rose-400",
    badgeClass: "border-rose-400/30 bg-rose-500/15 text-rose-100",
  },
  parking_pass: {
    label: "Parking Pass",
    subtitle: "Permit availability",
    colorClass: "bg-amber-300",
    badgeClass: "border-amber-400/30 bg-amber-500/15 text-amber-100",
  },
};

function isGoogleMapsBillingErrorMessage(message: string): boolean {
  const value = String(message || "").toLowerCase();
  return (
    value.includes("billingnotenabledmaperror") ||
    (value.includes("google maps javascript api") && value.includes("billing"))
  );
}

function buildNormalizedBbox(bounds: any): string | null {
  if (!bounds) return null;

  const sw = bounds.getSouthWest?.();
  const ne = bounds.getNorthEast?.();
  if (!sw || !ne) return null;

  const swLng = Number(sw.lng?.());
  const swLat = Number(sw.lat?.());
  const neLng = Number(ne.lng?.());
  const neLat = Number(ne.lat?.());

  if (![swLng, swLat, neLng, neLat].every(Number.isFinite)) return null;
  if (swLat < -90 || neLat > 90 || swLat >= neLat) return null;

  let minLng = swLng;
  let maxLng = neLng;

  if (minLng >= maxLng) {
    minLng = -180;
    maxLng = 180;
  }

  if (minLng < -180 || maxLng > 180 || minLng >= maxLng) return null;

  return [minLng, swLat, maxLng, neLat].map((value) => value.toFixed(6)).join(",");
}

function inferVerificationState(
  point: MapEntityPoint
): "verified" | "unverified" | "directory" | "unknown" {
  const status = String((point.meta as any)?.verifiedStatus || "")
    .trim()
    .toLowerCase();
  if (status === "verified") return "verified";
  if (status === "unverified") return "unverified";
  if (status === "directory") return "directory";
  return "unknown";
}

function pointPriorityScore(point: MapEntityPoint): number {
  const verification = inferVerificationState(point);
  const verificationScore =
    verification === "verified"
      ? 100
      : verification === "unverified"
        ? 60
        : verification === "directory"
          ? 40
          : 10;
  const typeScore: Record<MapEntityType, number> = {
    provider: 50,
    business: 35,
    public_profile: 30,
    trade_deal: 25,
    food_truck: 20,
    parking_pass: 15,
  };
  return verificationScore + (typeScore[point.type] || 0);
}

function formatTypeLabel(type: MapEntityType): string {
  return LAYER_META[type]?.label || type.replace(/_/g, " ");
}

function normalizeTradeOptions(payload: unknown): TradeOption[] {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.trades)
      ? (payload as any).trades
      : [];

  return candidates
    .map((item: any) => ({
      id: String(item?.id ?? item?.slug ?? "").trim(),
      name: String(item?.name ?? item?.slug ?? "").trim(),
      slug: String(item?.slug ?? item?.id ?? "").trim(),
    }))
    .filter((item) => item.slug.length > 0 && item.name.length > 0);
}

const FALLBACK_TRADE_OPTIONS: TradeOption[] = COMPREHENSIVE_TRADES.filter(
  (trade) => !trade.parentId
)
  .map((trade) => ({
    id: String(trade.id || trade.slug),
    name: String(trade.name || trade.slug),
    slug: String(trade.slug || trade.id),
  }))
  .filter((trade) => trade.slug.length > 0 && trade.name.length > 0)
  .sort((a, b) => a.name.localeCompare(b.name));

function buildPublicConfigCandidates(): string[] {
  const cacheBust = `?_=${Date.now()}`;
  const candidates = [`/api/public-config${cacheBust}`];

  if (typeof window !== "undefined") {
    const hostname = String(window.location.hostname || "")
      .trim()
      .toLowerCase();
    if (hostname !== "www.thetradescout.com") {
      candidates.push(`https://www.thetradescout.com/api/public-config${cacheBust}`);
    }
  }

  return candidates;
}

async function fetchPublicConfigWithFallback(): Promise<{ googleMapsApiKey: string } | null> {
  for (const url of buildPublicConfigCandidates()) {
    try {
      const res = await fetch(url, {
        method: "GET",
        credentials: "omit",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const text = await res.text();
      const payload = text ? (JSON.parse(text) as any) : null;
      const key = String(payload?.googleMapsApiKey || "").trim();
      if (!key) continue;

      return { googleMapsApiKey: key };
    } catch {
      // Try the next candidate.
    }
  }

  return null;
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
    window.gm_authFailure = () => {
      window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_AUTH_FAILURE_EVENT));
      reject(new Error("Google Maps auth failed (check HTTP referrer restrictions)"));
    };

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
  const markerByIdRef = useRef<Record<string, any>>({});
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);

  const location = useLocationContext();
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState<string>("");
  const [mapsApiKey, setMapsApiKey] = useState<string>("");
  const [mapsConfigResolved, setMapsConfigResolved] = useState(false);
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
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("priority");

  const clearMapArtifacts = () => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    markerByIdRef.current = {};
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    mapRef.current = null;
  };

  useEffect(() => {
    const fromVite = String(
      import.meta.env.VITE_GOOGLE_MAPS_WEB_API_KEY || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
    ).trim();
    if (fromVite) {
      setMapsApiKey(fromVite);
      setMapsConfigResolved(true);
      return;
    }

    let cancelled = false;
    fetchPublicConfigWithFallback()
      .then((payload: any) => {
        if (cancelled) return;
        const key = String(payload?.googleMapsApiKey || "").trim();
        if (key) setMapsApiKey(key);
        setMapsConfigResolved(true);
      })
      .catch(() => {
        if (!cancelled) setMapsConfigResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!MAPS_V1_ENABLED) return;
    if (!mapsConfigResolved) return;
    if (!mapsApiKey) {
      setScriptError("Missing Google Maps API key");
      return;
    }

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
  }, [mapsApiKey, mapsConfigResolved]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAuthFailure = () => {
      clearMapArtifacts();
      setSelectedPoint(null);
      setScriptReady(false);
      setScriptError("Google Maps auth failed (check HTTP referrer restrictions)");
    };
    const handleBillingFailure = () => {
      clearMapArtifacts();
      setSelectedPoint(null);
      setScriptReady(false);
      setScriptError("Google Maps billing is not enabled for this key/project");
    };

    const handleWindowError = (event: ErrorEvent) => {
      const message = String(event?.message || "");
      if (isGoogleMapsBillingErrorMessage(message)) {
        window.dispatchEvent(new CustomEvent(GOOGLE_MAPS_BILLING_FAILURE_EVENT));
      }
    };

    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handleAuthFailure);
    window.addEventListener(GOOGLE_MAPS_BILLING_FAILURE_EVENT, handleBillingFailure);
    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, handleAuthFailure);
      window.removeEventListener(GOOGLE_MAPS_BILLING_FAILURE_EVENT, handleBillingFailure);
      window.removeEventListener("error", handleWindowError);
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
      ...(GOOGLE_MAPS_MAP_ID ? { mapId: GOOGLE_MAPS_MAP_ID } : {}),
    });
    mapRef.current = map;

    const updateBbox = () => {
      const bounds = map.getBounds();
      const next = buildNormalizedBbox(bounds);
      if (!next) {
        setBbox("");
        return;
      }
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

  const pointCountsByType = useMemo(() => {
    const counts: Record<MapEntityType, number> = {
      provider: 0,
      public_profile: 0,
      business: 0,
      trade_deal: 0,
      food_truck: 0,
      parking_pass: 0,
    };
    for (const point of points) {
      counts[point.type] = (counts[point.type] || 0) + 1;
    }
    return counts;
  }, [points]);

  const verifiedCount = useMemo(
    () => points.filter((point) => inferVerificationState(point) === "verified").length,
    [points]
  );

  const searchablePoints = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    let next = points;

    if (query) {
      next = next.filter((point) => {
        const haystack =
          `${point.title || ""} ${point.subtitle || ""} ${formatTypeLabel(point.type)}`.toLowerCase();
        return haystack.includes(query);
      });
    }

    const sorted = [...next];
    if (sortMode === "alpha") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === "verified") {
      sorted.sort((a, b) => {
        const va = inferVerificationState(a) === "verified" ? 1 : 0;
        const vb = inferVerificationState(b) === "verified" ? 1 : 0;
        if (va !== vb) return vb - va;
        return a.title.localeCompare(b.title);
      });
    } else {
      sorted.sort((a, b) => {
        const score = pointPriorityScore(b) - pointPriorityScore(a);
        if (score !== 0) return score;
        return a.title.localeCompare(b.title);
      });
    }

    return sorted;
  }, [points, searchText, sortMode]);

  const trades = useMemo(() => {
    const normalized = normalizeTradeOptions(tradesData)
      .filter((item) => typeof item.slug === "string" && item.slug.trim().length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    return normalized.length > 0 ? normalized : FALLBACK_TRADE_OPTIONS;
  }, [tradesData]);

  useEffect(() => {
    if (!trade) return;
    if (trades.some((item) => item.slug === trade)) return;
    setTrade("");
  }, [trade, trades]);

  useEffect(() => {
    if (!scriptReady || !mapRef.current) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    markerByIdRef.current = {};
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    const iconForPoint = (point: MapEntityPoint) => {
      const verifiedStatus = String((point.meta as any)?.verifiedStatus || "").toLowerCase();
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

    const markers = searchablePoints.map((point) => {
      const marker = new window.google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        title: point.title,
        icon: iconForPoint(point),
      });
      marker.addListener("click", () => {
        setSelectedPoint(point);
      });
      markerByIdRef.current[point.id] = marker;
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({
      map: mapRef.current,
      markers,
    });
  }, [searchablePoints, scriptReady]);

  const focusPoint = (point: MapEntityPoint) => {
    setSelectedPoint(point);
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat: point.lat, lng: point.lng });
    if (typeof map.getZoom === "function" && map.getZoom() < 12) {
      map.setZoom(12);
    }
    const marker = markerByIdRef.current[point.id];
    if (marker && typeof window.google?.maps?.event?.trigger === "function") {
      window.google.maps.event.trigger(marker, "click");
    }
  };

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
    const isBillingFailure = lower.includes("billing");
    const isAuthFailure =
      lower.includes("auth failed") ||
      lower.includes("referrer") ||
      lower.includes("referer") ||
      lower.includes("notallowed") ||
      lower.includes("not allowed");

    return (
      <div className="mx-auto max-w-5xl p-4 md:p-6">
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
          {isBillingFailure && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/80">
              <div className="font-semibold text-white">Fix (Google Cloud Console)</div>
              <ol className="mt-2 list-decimal pl-5 space-y-1 text-white/70">
                <li>
                  Open the project tied to this API key and enable{" "}
                  <span className="text-white">Billing</span>.
                </li>
                <li>
                  Confirm <span className="text-white">Maps JavaScript API</span> is enabled.
                </li>
                <li>
                  Verify API key restrictions include:
                  <ul className="mt-1 list-disc pl-5">
                    <li>
                      <span className="text-white">https://www.thetradescout.com/*</span>
                    </li>
                    <li>
                      <span className="text-white">https://thetradescout.com/*</span>
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
    <div className="mx-auto max-w-[1400px] p-3 md:p-5 space-y-4">
      <SEOHelmet
        title="TradeScout Local Map | County-Aware Profiles, Deals, and Activity"
        description="Explore the TradeScout local awareness map with county-scoped profiles, trade deals, and public local activity overlays."
        canonical="https://www.thetradescout.com/maps"
      />

      <header className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-slate-950 via-[#08111f] to-[#091b13] p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ts-orange">
              TradeScout Associate Intelligence Surface
            </p>
            <h1 className="mt-2 text-xl md:text-2xl font-semibold text-white">
              Local Map, rebuilt for decision-grade routing and trust-first discovery
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/70">
              Use this awareness surface to audit local signal density, verified presence, and
              next-step readiness before Scout escalates toward intent and decision cards.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/directory"
              className="rounded-lg border border-ts-orange/50 bg-ts-orange/10 px-4 py-2 text-sm font-semibold text-ts-orange hover:bg-ts-orange/20"
            >
              View county directory
            </Link>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Active pins</div>
            <div className="mt-1 text-xl font-semibold text-white">{searchablePoints.length}</div>
            <div className="text-xs text-white/60">
              {isFetching ? "Refreshing bounds..." : "Live viewport"}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Verified share</div>
            <div className="mt-1 text-xl font-semibold text-white">
              {points.length > 0 ? Math.round((verifiedCount / points.length) * 100) : 0}%
            </div>
            <div className="text-xs text-white/60">{verifiedCount} verified points in view</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="text-[11px] uppercase tracking-wide text-white/60">Awareness state</div>
            <div className="mt-1 text-xl font-semibold text-white">
              {verifiedOnly ? "Verification-focused" : "Mixed visibility"}
            </div>
            <div className="text-xs text-white/60">Contact remains gated through Scout flow</div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/10 bg-tsCard/90 p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Control Deck</h2>
            <p className="mt-1 text-xs text-white/60">
              Tune surface evidence for associate routing and Scout handoff confidence.
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-xs text-white/70">
              Service focus
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-tsBg px-3 py-2 text-sm text-white"
                value={trade}
                onChange={(event) => setTrade(event.target.value)}
              >
                <option value="">All service domains</option>
                {trades.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-white/70">
              Search points
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Name, subtitle, or type"
                className="mt-1 w-full rounded-lg border border-white/10 bg-tsBg px-3 py-2 text-sm text-white placeholder:text-white/30"
              />
            </label>

            <label className="block text-xs text-white/70">
              Sort by
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-tsBg px-3 py-2 text-sm text-white"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="priority">Trust priority</option>
                <option value="verified">Verified first</option>
                <option value="alpha">Alphabetical</option>
              </select>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-tsBg px-3 py-2 text-sm text-white">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
              Verified only
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-white/60">
              Layer Visibility
            </div>
            {(Object.keys(layers) as MapEntityType[]).map((key) => (
              <label
                key={key}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-tsBg px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(event) =>
                      setLayers((prev) => ({ ...prev, [key]: event.target.checked }))
                    }
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm text-white">{LAYER_META[key].label}</div>
                    <div className="text-[11px] text-white/50">{LAYER_META[key].subtitle}</div>
                  </div>
                </div>
                <div className="text-xs text-white/70">{pointCountsByType[key] || 0}</div>
              </label>
            ))}
          </div>
        </aside>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-950/90 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(layers) as MapEntityType[])
                  .filter((type) => layers[type])
                  .map((type) => (
                    <span
                      key={type}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${LAYER_META[type].badgeClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${LAYER_META[type].colorClass}`} />
                      {LAYER_META[type].label}
                    </span>
                  ))}
              </div>
              <div className="text-xs text-white/60">
                {isFetching ? "Updating map..." : `Viewport pins: ${searchablePoints.length}`}
              </div>
            </div>
            <div ref={mapContainerRef} className="h-[64vh] min-h-[420px] w-full" />
          </section>

          {selectedPoint && (
            <section className="rounded-2xl border border-white/10 bg-tsCard p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{selectedPoint.title}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {selectedPoint.subtitle || formatTypeLabel(selectedPoint.type)}
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 text-xs">
                    <span className="text-white/50">Trust state:</span>
                    <span className="rounded-full border border-white/15 bg-tsBg px-2 py-0.5 text-white">
                      {inferVerificationState(selectedPoint)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPoint(null)}
                  className="rounded-md border border-white/10 bg-tsBg px-2 py-1 text-xs text-white"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {selectedPoint.href ? (
                  <a
                    href={selectedPoint.href}
                    className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white"
                  >
                    Open profile
                  </a>
                ) : null}
                {selectedPoint.type === "provider" ? (
                  <Link
                    href={`/request-quote?providerId=${encodeURIComponent(selectedPoint.id)}`}
                    className="inline-flex items-center rounded-md bg-ts-orange px-3 py-2 text-sm font-semibold text-black"
                  >
                    Start decision-ready quote
                  </Link>
                ) : null}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-tsCard p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-white">Signal Stream</h2>
                <p className="text-xs text-white/60">
                  Ranked points for associates to evaluate before escalation.
                </p>
              </div>
              <div className="text-xs text-white/60">
                Showing {Math.min(searchablePoints.length, 60)} entries
              </div>
            </div>

            <div className="mt-3 max-h-[340px] overflow-auto space-y-2 pr-1">
              {searchablePoints.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-tsBg px-3 py-4 text-sm text-white/60">
                  No points match this control set.
                </div>
              ) : (
                searchablePoints.slice(0, 60).map((point) => {
                  const selected = selectedPoint?.id === point.id;
                  return (
                    <button
                      key={`${point.type}-${point.id}`}
                      type="button"
                      onClick={() => focusPoint(point)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                        selected
                          ? "border-ts-orange/60 bg-ts-orange/10"
                          : "border-white/10 bg-tsBg hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">{point.title}</div>
                          <div className="mt-0.5 text-xs text-white/60">
                            {point.subtitle || LAYER_META[point.type].subtitle}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${LAYER_META[point.type].badgeClass}`}
                          >
                            {LAYER_META[point.type].label}
                          </span>
                          <span className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[11px] text-white/75">
                            {inferVerificationState(point)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
