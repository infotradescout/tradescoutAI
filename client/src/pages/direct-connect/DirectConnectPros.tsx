import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProviderCard, type ProviderCardProvider } from "@/components/contractor-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLocationContext,
  hasLocalContext,
  setSessionLocationOverride,
} from "@/hooks/useLocationContext";
import { StateCountySelector } from "@/components/state-county-selector";
import { formatCountyLabel } from "@/utils/countyFipsToName";
import { DirectoryListingLink } from "./DirectoryListingLink";
import { DISCOVERY_INTERNAL_SEARCH_EVENT } from "@shared/discoveryObservatory";
import { useAuth } from "@/hooks/useAuth";
import {
  buildCanonicalBusinessesWorkspaceHref,
  clearBusinessesWorkspaceState,
  resolveBusinessesWorkspaceCountyChange,
  resolveBusinessesWorkspaceEffectiveArea,
  resolveBusinessesWorkspaceState,
  resolveBusinessesWorkspaceViewerCoordinates,
  resolveSelectedWorkspaceProvider,
  writeBusinessesWorkspaceState,
  type BusinessesWorkspaceState,
} from "./businessesWorkspaceState";

const BUSINESS_AVATAR_PALETTE = [
  "bg-sky-500/20 text-sky-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-amber-500/20 text-amber-200",
  "bg-violet-500/20 text-violet-200",
  "bg-rose-500/20 text-rose-200",
  "bg-teal-500/20 text-teal-200",
];

function getBusinessInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getBusinessAvatarClass(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  }
  return BUSINESS_AVATAR_PALETTE[hash % BUSINESS_AVATAR_PALETTE.length];
}

type TradeOption = {
  id: string;
  name: string;
  slug: string;
};

type DirectoryBusinessFallback = {
  id: string;
  name: string;
  slug: string;
  claimStatus?: string;
  counties?: Array<{ fips: string; stateCode: string; name: string }>;
};

type DirectoryResponse = {
  items: DirectoryBusinessFallback[];
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getProviderDistance(provider: any): number | null {
  return toFiniteNumber(provider?.distanceMiles);
}

function getProviderCvs(provider: any): number {
  return (
    toFiniteNumber(provider?.trustScore) ??
    toFiniteNumber(provider?.cvsScore) ??
    toFiniteNumber(provider?.recommendationScore) ??
    0
  );
}

function compareByDistanceThenCvs(a: any, b: any): number {
  const aDistance = getProviderDistance(a);
  const bDistance = getProviderDistance(b);
  if (aDistance !== null && bDistance !== null && aDistance !== bDistance) {
    return aDistance - bDistance;
  }
  if (aDistance !== null) return -1;
  if (bDistance !== null) return 1;
  return getProviderCvs(b) - getProviderCvs(a);
}

function getProviderName(provider: ProviderCardProvider): string {
  return String(provider.companyName || provider.name || "Business").trim() || "Business";
}

function getProviderCategory(provider: ProviderCardProvider): string {
  return String(
    provider.category ||
      provider.roleContext ||
      (provider.isGeneralContractor ? "General contractor" : "")
  )
    .replace(/_/g, " ")
    .trim();
}

function getProviderLocation(provider: ProviderCardProvider): string {
  const serviceAreas = Array.isArray(provider.serviceAreas) ? provider.serviceAreas : [];
  if (serviceAreas.length > 0) return serviceAreas.slice(0, 2).join(", ");
  const city = String(provider.city || "").trim();
  const state = String(provider.state || provider.stateCode || "").trim();
  return (
    [city, state].filter(Boolean).join(", ") ||
    String(provider.county || provider.countyName || "").trim()
  );
}

function formatProviderDistance(provider: ProviderCardProvider): string {
  const distance = getProviderDistance(provider);
  if (distance === null) return "Local service area";
  if (distance < 0.1) return "Less than 0.1 miles away";
  return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} miles away`;
}

function ProviderResultRow({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderCardProvider;
  selected: boolean;
  onSelect: () => void;
}) {
  const name = getProviderName(provider);
  const category = getProviderCategory(provider);
  const location = getProviderLocation(provider);
  const hasTrustEvidence = Boolean(
    provider.verifiedLicensed ||
    provider.verifiedInsured ||
    (provider.totalRecommendations || 0) > 0
  );

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-controls="business-workspace-inspector"
      onClick={onSelect}
      className={`group flex min-h-16 w-full min-w-0 items-center gap-3 px-3 py-3 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--theme-accent-primary)] ${
        selected
          ? "bg-[color:var(--surface-elevated)]"
          : "bg-transparent hover:bg-[color:var(--surface-intermediate)]"
      }`}
      data-testid={`business-result-${provider.id}`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
          selected
            ? "border-[color:var(--theme-accent-primary)] bg-[color:var(--theme-accent-primary)]/15 text-[color:var(--theme-accent-primary)]"
            : "border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-[color:var(--text-secondary)]"
        }`}
        aria-hidden="true"
      >
        {getBusinessInitials(name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[color:var(--text-primary)]">
          {name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[color:var(--text-secondary)]">
          {[category, location].filter(Boolean).join(" · ") || formatProviderDistance(provider)}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[color:var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-[color:var(--theme-accent-primary)]" />
            {formatProviderDistance(provider)}
          </span>
          {hasTrustEvidence && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-[color:var(--theme-accent-primary)]" />
              Trust evidence available
            </span>
          )}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 transition ${
          selected
            ? "text-[color:var(--theme-accent-primary)]"
            : "text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}

function BusinessesWorkspace({
  title,
  subtitle,
  providers,
  selectedProvider,
  selectedProviderId,
  onSelect,
}: {
  title: string;
  subtitle: string;
  providers: ProviderCardProvider[];
  selectedProvider: ProviderCardProvider | null;
  selectedProviderId: string;
  onSelect: (providerId: string) => void;
}) {
  if (providers.length === 0) return null;

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
      aria-labelledby="business-workspace-results-title"
      data-testid="businesses-results-workspace"
    >
      <div className="flex min-w-0 items-end justify-between gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <h3
            id="business-workspace-results-title"
            className="text-sm font-semibold text-[color:var(--text-primary)]"
          >
            {title}
          </h3>
          <p className="text-xs text-[color:var(--text-secondary)]">{subtitle}</p>
        </div>
        <Badge variant="outline" className="shrink-0 border-[color:var(--border-subtle)]">
          {providers.length} {providers.length === 1 ? "result" : "results"}
        </Badge>
      </div>
      <div className="grid min-w-0 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(20rem,1.1fr)]">
        <ul
          aria-label="Business results"
          className={`max-h-[22rem] min-w-0 overflow-y-auto border-b border-[color:var(--border-subtle)] lg:order-1 lg:max-h-[38rem] lg:border-b-0 lg:border-r ${
            selectedProvider ? "order-2" : "order-1"
          }`}
          data-testid="business-results-list"
        >
          {providers.map((provider) => (
            <li
              key={String(provider.id)}
              className="border-b border-[color:var(--border-subtle)]/70 last:border-b-0"
            >
              <ProviderResultRow
                provider={provider}
                selected={String(provider.id) === selectedProviderId}
                onSelect={() => onSelect(String(provider.id))}
              />
            </li>
          ))}
        </ul>
        <div
          id="business-workspace-inspector"
          role="region"
          aria-label="Selected business details"
          aria-live="polite"
          className={`min-w-0 bg-[color:var(--surface-base)] px-3 py-2.5 sm:p-4 lg:order-2 ${
            selectedProvider
              ? "order-1 border-b border-[color:var(--border-subtle)] lg:border-b-0"
              : "order-2"
          }`}
          data-testid="business-workspace-inspector"
        >
          {selectedProvider ? (
            <div className="mx-auto max-w-xl">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--text-secondary)] sm:mb-3">
                <CheckCircle2 className="h-4 w-4 text-[color:var(--theme-accent-primary)]" />
                Selected business
              </div>
              <ProviderCard contractor={selectedProvider} compact action="connect" />
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
              <Building2 className="h-8 w-8 text-[color:var(--theme-accent-primary)]" />
              <p className="mt-3 text-sm font-semibold text-[color:var(--text-primary)]">
                Choose a business to inspect
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-[color:var(--text-secondary)]">
                Selection shows public profile details here. Contact still continues through Direct
                Connect.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function DirectConnectPros() {
  const location = useLocationContext();
  const { user, isLoading: authLoading } = useAuth();
  const [stateCode, setStateCode] = useState("");
  const [countyFips, setCountyFips] = useState("");
  const [tradeSlug, setTradeSlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const currentWorkspaceScope = `${user?.id || "guest"}:${
    typeof window === "undefined" ? "/contractors" : window.location.pathname
  }`;
  const [hydratedWorkspaceScope, setHydratedWorkspaceScope] = useState("");
  const workspaceHydrated = hydratedWorkspaceScope === currentWorkspaceScope;
  const [showOutsideArea, setShowOutsideArea] = useState(false);
  const recordedSearches = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === "undefined" || authLoading) return;

    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }

    const restored = resolveBusinessesWorkspaceState({
      search: window.location.search || "",
      storage,
      authenticatedUserId: user?.id,
      pathname: window.location.pathname,
    });
    setStateCode(restored.stateCode);
    setCountyFips(restored.countyFips);
    setTradeSlug(restored.tradeSlug);
    setSearchQuery(restored.searchQuery);
    setSelectedProviderId(restored.selectedProviderId);
    setHydratedWorkspaceScope(currentWorkspaceScope);
  }, [authLoading, currentWorkspaceScope, user?.id]);

  useEffect(() => {
    if (!workspaceHydrated || typeof window === "undefined") return;

    const state: BusinessesWorkspaceState = {
      stateCode,
      countyFips,
      tradeSlug,
      searchQuery,
      selectedProviderId,
    };
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    writeBusinessesWorkspaceState({
      storage,
      authenticatedUserId: user?.id,
      pathname: window.location.pathname,
      state,
    });

    const href = buildCanonicalBusinessesWorkspaceHref({
      pathname: window.location.pathname,
      currentSearch: window.location.search,
      hash: window.location.hash,
      state,
    });
    const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (href !== currentHref) {
      window.history.replaceState(window.history.state, "", href);
    }
  }, [
    countyFips,
    searchQuery,
    selectedProviderId,
    stateCode,
    tradeSlug,
    user?.id,
    workspaceHydrated,
  ]);

  const effectiveArea = resolveBusinessesWorkspaceEffectiveArea({
    workspaceStateCode: stateCode,
    workspaceCountyFips: countyFips,
    locationStateCode: location.stateCode,
    locationCountyFips: location.countyFips,
  });
  const effectiveStateCode = effectiveArea.stateCode;
  const effectiveCountyFips = effectiveArea.countyFips;
  const viewerCoordinates = resolveBusinessesWorkspaceViewerCoordinates({
    workspaceStateCode: stateCode,
    workspaceCountyFips: countyFips,
    locationStateCode: location.stateCode,
    locationCountyFips: location.countyFips,
    locationLat: location.lat,
    locationLng: location.lng,
  });
  const viewerLat = viewerCoordinates.lat;
  const viewerLng = viewerCoordinates.lng;

  const localCommitted = hasLocalContext(location) || Boolean(effectiveCountyFips);
  const hasStateContext = /^[A-Z]{2}$/.test(effectiveStateCode);

  const { data: trades = [] } = useQuery<TradeOption[]>({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const inferredTradeSlug = useMemo(() => {
    if (tradeSlug) return "";
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) return "";

    const exact = trades.find(
      (trade) => trade.slug.toLowerCase() === raw || trade.name.toLowerCase() === raw
    );
    if (exact) return exact.slug;

    const partial = trades.find(
      (trade) => trade.slug.toLowerCase().includes(raw) || trade.name.toLowerCase().includes(raw)
    );
    return partial?.slug || "";
  }, [tradeSlug, searchQuery, trades]);

  const effectiveTradeSlug = tradeSlug || inferredTradeSlug;
  const hasDirectoryIntent = Boolean((effectiveTradeSlug || "").trim() || searchQuery.trim());
  const canQueryDirectory =
    workspaceHydrated && (localCommitted || (hasStateContext && hasDirectoryIntent));

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: [
      "/api/business-providers/search",
      effectiveCountyFips,
      effectiveStateCode,
      effectiveTradeSlug,
      searchQuery,
      viewerLat,
      viewerLng,
    ],
    enabled: canQueryDirectory,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveCountyFips) params.set("county", effectiveCountyFips);
      if (!effectiveCountyFips && hasStateContext) params.set("state", effectiveStateCode);
      if (effectiveTradeSlug) params.set("trade", effectiveTradeSlug);
      if (searchQuery) params.set("query", searchQuery.trim());
      params.set("sort", "distance");
      if (typeof viewerLat === "number" && typeof viewerLng === "number") {
        params.set("lat", String(viewerLat));
        params.set("lng", String(viewerLng));
      }
      params.set("limit", "40");
      return apiRequest("GET", `/api/business-providers/search?${params.toString()}`);
    },
  });

  const hasResults = (contractors as any[])?.length > 0;
  const showEmptyState = canQueryDirectory && !isLoading && !hasResults;
  const areaLabel = effectiveCountyFips
    ? formatCountyLabel(effectiveCountyFips, effectiveStateCode)
    : effectiveStateCode || "your area";
  const searchActive = Boolean(searchQuery.trim() || effectiveTradeSlug);
  const distanceFirstProviders = useMemo(
    () =>
      [...((contractors as ProviderCardProvider[]) || [])].sort(
        compareByDistanceThenCvs
      ) as ProviderCardProvider[],
    [contractors]
  );
  const selectedProvider = useMemo(
    () => resolveSelectedWorkspaceProvider(distanceFirstProviders, selectedProviderId),
    [distanceFirstProviders, selectedProviderId]
  );

  useEffect(() => {
    if (!workspaceHydrated || isLoading) return;
    if (selectedProviderId && !selectedProvider) setSelectedProviderId("");
  }, [isLoading, selectedProvider, selectedProviderId, workspaceHydrated]);

  const { data: directoryFallback = [], isLoading: directoryFallbackLoading } = useQuery<
    DirectoryBusinessFallback[]
  >({
    queryKey: [
      "/api/businesses",
      "public-directory-fallback",
      effectiveCountyFips,
      effectiveStateCode,
      effectiveTradeSlug,
      searchQuery,
    ],
    enabled: showEmptyState && (Boolean(effectiveCountyFips) || hasStateContext),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("public", "1");
      params.set("claimed", "any");
      params.set("limit", "12");
      params.set("offset", "0");
      if (effectiveCountyFips) params.set("countyFips", effectiveCountyFips);
      if (hasStateContext) params.set("stateCode", effectiveStateCode);
      if (effectiveTradeSlug) params.set("trade", effectiveTradeSlug);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const payload = (await apiRequest(
        "GET",
        `/api/businesses?${params.toString()}`
      )) as DirectoryResponse;
      return Array.isArray(payload?.items) ? payload.items : [];
    },
  });

  const showStateDirectoryFallback =
    showEmptyState &&
    !directoryFallbackLoading &&
    directoryFallback.length === 0 &&
    hasStateContext;

  const { data: stateDirectoryFallback = [], isLoading: stateDirectoryFallbackLoading } = useQuery<
    DirectoryBusinessFallback[]
  >({
    queryKey: [
      "/api/businesses",
      "public-directory-state-fallback",
      effectiveStateCode,
      effectiveTradeSlug,
    ],
    enabled: showStateDirectoryFallback,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("public", "1");
      params.set("claimed", "any");
      params.set("limit", "12");
      params.set("offset", "0");
      params.set("stateCode", effectiveStateCode);
      if (effectiveTradeSlug) params.set("trade", effectiveTradeSlug);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const payload = (await apiRequest(
        "GET",
        `/api/businesses?${params.toString()}`
      )) as DirectoryResponse;
      return Array.isArray(payload?.items) ? payload.items : [];
    },
  });

  useEffect(() => {
    const query = searchQuery.trim() || effectiveTradeSlug;
    if (!query || !canQueryDirectory || isLoading) return;
    if (showEmptyState && (directoryFallbackLoading || stateDirectoryFallbackLoading)) return;

    const resultCount =
      ((contractors as any[]) || []).length +
      directoryFallback.length +
      stateDirectoryFallback.length;
    const key = JSON.stringify([
      query.toLowerCase(),
      effectiveStateCode,
      effectiveCountyFips,
      effectiveTradeSlug,
      resultCount,
    ]);
    if (recordedSearches.current.has(key)) return;
    recordedSearches.current.add(key);

    void fetch("/api/analytics/shell", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        type: DISCOVERY_INTERNAL_SEARCH_EVENT,
        query,
        resultCount,
        observedAt: new Date().toISOString(),
        stateCode: effectiveStateCode || undefined,
        countyFips: effectiveCountyFips || undefined,
        tradeSlug: effectiveTradeSlug || undefined,
      }),
    }).catch(() => undefined);
  }, [
    canQueryDirectory,
    contractors,
    directoryFallback,
    directoryFallbackLoading,
    effectiveCountyFips,
    effectiveStateCode,
    effectiveTradeSlug,
    isLoading,
    searchQuery,
    showEmptyState,
    stateDirectoryFallback,
    stateDirectoryFallbackLoading,
  ]);

  const handleStateChange = (value: string) => {
    setStateCode(value);
    setCountyFips("");
    setSelectedProviderId("");
  };

  const handleCountyChange = (value: string) => {
    if (!value) {
      setCountyFips("");
      setSelectedProviderId("");
      return;
    }
    const next = resolveBusinessesWorkspaceCountyChange({
      countyFips: value,
      workspaceStateCode: stateCode,
      locationStateCode: location.stateCode,
    });
    setStateCode(next.stateCode);
    setCountyFips(next.countyFips);
    setSelectedProviderId(next.selectedProviderId);
    if (next.countyFips && next.stateCode) {
      setSessionLocationOverride({
        stateCode: next.stateCode,
        countyFips: next.countyFips,
        countyName: undefined,
        countyId: undefined,
        lat: undefined,
        lng: undefined,
        label: undefined,
      });
    }
  };

  const handleTradeChange = (value: string) => {
    setTradeSlug(value);
    setSelectedProviderId("");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedProviderId("");
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProviderId(providerId);
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById("business-workspace-inspector")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleClearWorkspace = () => {
    if (typeof window !== "undefined") {
      let storage: Storage | null = null;
      try {
        storage = window.sessionStorage;
      } catch {
        storage = null;
      }
      clearBusinessesWorkspaceState({
        storage,
        authenticatedUserId: user?.id,
        pathname: window.location.pathname,
      });
      const href = buildCanonicalBusinessesWorkspaceHref({
        pathname: window.location.pathname,
        currentSearch: window.location.search,
        hash: window.location.hash,
        state: {
          stateCode: "",
          countyFips: "",
          tradeSlug: "",
          searchQuery: "",
          selectedProviderId: "",
        },
      });
      window.history.replaceState(window.history.state, "", href);
    }
    setStateCode("");
    setCountyFips("");
    setTradeSlug("");
    setSearchQuery("");
    setSelectedProviderId("");
    setShowOutsideArea(false);
  };

  const hasWorkspaceState = Boolean(
    stateCode || countyFips || tradeSlug || searchQuery.trim() || selectedProviderId
  );

  return (
    <div className="min-w-0 space-y-3" data-testid="businesses-workspace">
      <section
        className="min-w-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]"
        aria-labelledby="businesses-workspace-heading"
      >
        <div className="flex min-w-0 flex-col gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--theme-accent-primary)]">
              Local workspace
            </p>
            <h2
              id="businesses-workspace-heading"
              className="mt-1 text-base font-semibold text-[color:var(--text-primary)]"
            >
              Find and inspect businesses
            </h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--text-secondary)]">
              {localCommitted
                ? `${distanceFirstProviders.length} local profile(s), ordered by location fit and available trust evidence.`
                : "Set an area once, then TradeScout keeps this workspace local by default."}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {localCommitted && (
              <Badge
                variant="outline"
                className="min-h-9 max-w-full gap-1 border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-primary)]"
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[color:var(--theme-accent-primary)]" />
                <span className="truncate">{areaLabel}</span>
              </Badge>
            )}
            {hasWorkspaceState && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11 px-3 text-[color:var(--text-secondary)]"
                onClick={handleClearWorkspace}
                data-testid="businesses-workspace-clear"
              >
                Clear
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-2 border-[color:var(--border-subtle)]"
              onClick={() => setShowOutsideArea((value) => !value)}
              aria-expanded={showOutsideArea || !localCommitted}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {showOutsideArea || !localCommitted ? "Hide area" : "Change area"}
            </Button>
          </div>
        </div>
        <div className="min-w-0 space-y-3 p-3 sm:p-4">
          {(showOutsideArea || !localCommitted) && (
            <StateCountySelector
              selectedState={effectiveStateCode}
              selectedCounty={effectiveCountyFips}
              onStateChange={handleStateChange}
              onCountyChange={handleCountyChange}
              className="min-w-0"
              stateTestId="businesses-state-select"
              countyTestId="businesses-county-select"
            />
          )}

          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Select value={tradeSlug} onValueChange={handleTradeChange}>
              <SelectTrigger className="min-h-11 min-w-0">
                <SelectValue placeholder="Filter by trade" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {trades.map((trade) => (
                  <SelectItem key={trade.slug} value={trade.slug}>
                    {trade.name || trade.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="min-h-11 min-w-0 pl-10 pr-10"
                placeholder="Search by name, trade, or keyword"
                data-testid="businesses-workspace-search"
              />
              {searchQuery.trim().length > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-0.5 top-1/2 h-10 w-10 -translate-y-1/2"
                  aria-label="Clear search"
                  onClick={() => handleSearchChange("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {!tradeSlug && inferredTradeSlug && (
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              Inferred trade from search: <span className="text-white">{inferredTradeSlug}</span>
            </p>
          )}
          {!localCommitted && (
            <p className="text-[11px] text-[color:var(--text-secondary)]">
              TradeScout will use your saved local area when available. Pick a county only when you
              want to browse somewhere else.
            </p>
          )}
        </div>
      </section>

      {(!workspaceHydrated || isLoading) && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-40 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-24 rounded bg-[color:var(--surface-intermediate)]" />
          </CardContent>
        </Card>
      )}

      {showEmptyState && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-6 text-center text-sm text-[color:var(--text-secondary)]">
            No local businesses found for that search yet.
          </CardContent>
        </Card>
      )}

      {showEmptyState && directoryFallbackLoading && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-56 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-20 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-20 rounded bg-[color:var(--surface-intermediate)]" />
          </CardContent>
        </Card>
      )}

      {showEmptyState && directoryFallback.length > 0 && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="text-sm">More local businesses</CardTitle>
            <p className="text-xs text-[color:var(--text-secondary)]">
              These businesses appear in the local directory, but they have not finished TradeScout
              verification yet.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {directoryFallback.map((business) => {
              const county = business.counties?.[0];
              return (
                <div
                  key={business.id}
                  className="border-b border-[color:var(--border-subtle)]/60 py-3 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <Avatar className="h-9 w-9 shrink-0 border border-[color:var(--border-subtle)]">
                        <AvatarFallback
                          className={`text-[11px] font-semibold ${getBusinessAvatarClass(business.name)}`}
                        >
                          {getBusinessInitials(business.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {business.name}
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                          {county
                            ? formatCountyLabel(county.fips, county.stateCode)
                            : "Local area not specified"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="secondary">Not verified</Badge>
                          <Badge variant="outline">Local directory</Badge>
                          {String(business.claimStatus || "").toLowerCase() === "claimed" ? (
                            <Badge variant="outline">Claimed profile</Badge>
                          ) : (
                            <Badge variant="outline">Unclaimed listing</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <DirectoryListingLink slug={business.slug} businessName={business.name} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {showStateDirectoryFallback && stateDirectoryFallbackLoading && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-56 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-20 rounded bg-[color:var(--surface-intermediate)]" />
            <div className="h-20 rounded bg-[color:var(--surface-intermediate)]" />
          </CardContent>
        </Card>
      )}

      {showStateDirectoryFallback && stateDirectoryFallback.length > 0 && (
        <Card className="border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardHeader>
            <CardTitle className="text-sm">More businesses in {stateCode.toUpperCase()}</CardTitle>
            <p className="text-xs text-[color:var(--text-secondary)]">
              These listings are active in your state. Some may still need local assignment before
              they appear in local-first routing.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {stateDirectoryFallback.map((business) => {
              const county = business.counties?.[0];
              return (
                <div
                  key={business.id}
                  className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {business.name}
                      </div>
                      <div className="mt-1 text-xs text-[color:var(--text-secondary)]">
                        {county
                          ? formatCountyLabel(county.fips, county.stateCode)
                          : "Local assignment pending"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">Not verified</Badge>
                        <Badge variant="outline">State directory</Badge>
                        {String(business.claimStatus || "").toLowerCase() === "claimed" ? (
                          <Badge variant="outline">Claimed profile</Badge>
                        ) : (
                          <Badge variant="outline">Unclaimed listing</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <DirectoryListingLink slug={business.slug} businessName={business.name} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {hasResults && (
        <BusinessesWorkspace
          title={searchActive ? "Best nearby matches" : "Businesses near you"}
          subtitle="Select a row to inspect one public profile without losing your place."
          providers={distanceFirstProviders}
          selectedProvider={selectedProvider}
          selectedProviderId={selectedProviderId}
          onSelect={handleProviderSelect}
        />
      )}
    </div>
  );
}
