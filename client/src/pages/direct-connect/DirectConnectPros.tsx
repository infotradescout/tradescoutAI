import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, SlidersHorizontal, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ProviderCard } from "@/components/contractor-card";
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

function DirectoryRail({
  title,
  subtitle,
  providers,
}: {
  title: string;
  subtitle: string;
  providers: any[];
}) {
  if (providers.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{title}</h3>
          <p className="text-xs text-[color:var(--text-secondary)]">{subtitle}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((contractor) => (
          <div key={contractor.id}>
            <ProviderCard contractor={contractor} compact action="connect" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DirectConnectPros() {
  const location = useLocationContext();

  const routePrefill = useMemo(() => {
    if (typeof window === "undefined") {
      return { stateCode: "", countyFips: "", tradeSlug: "", searchQuery: "" };
    }
    const params = new URLSearchParams(window.location.search || "");
    const rawState = (params.get("state") || "").trim().toUpperCase();
    const stateCode = /^[A-Z]{2}$/.test(rawState) ? rawState : "";
    const countyFips = (params.get("county") || params.get("countyFips") || "").trim();
    const tradeSlug = (params.get("trade") || "").trim().toLowerCase();
    const searchQuery = (params.get("q") || params.get("query") || params.get("city") || "").trim();
    return { stateCode, countyFips, tradeSlug, searchQuery };
  }, []);

  const [stateCode, setStateCode] = useState(routePrefill.stateCode || location.stateCode || "");
  const [countyFips, setCountyFips] = useState(
    routePrefill.countyFips || location.countyFips || ""
  );
  const [tradeSlug, setTradeSlug] = useState(routePrefill.tradeSlug || "");
  const [searchQuery, setSearchQuery] = useState(routePrefill.searchQuery || "");
  const [showOutsideArea, setShowOutsideArea] = useState(false);

  const effectiveStateCode = String(stateCode || location.stateCode || "").toUpperCase();
  const effectiveCountyFips = String(countyFips || location.countyFips || "").trim();
  const viewerLat = typeof location.lat === "number" ? location.lat : undefined;
  const viewerLng = typeof location.lng === "number" ? location.lng : undefined;

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
  const canQueryDirectory = localCommitted || (hasStateContext && hasDirectoryIntent);

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
    () => [...((contractors as any[]) || [])].sort(compareByDistanceThenCvs),
    [contractors]
  );
  const visibleProviders = distanceFirstProviders.slice(0, searchActive ? 24 : 14);

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

  const handleStateChange = (value: string) => {
    setStateCode(value);
    setCountyFips("");
  };

  const handleCountyChange = (value: string) => {
    setCountyFips(value);
    if (value && stateCode) {
      setSessionLocationOverride({
        stateCode,
        countyFips: value,
        countyName: undefined,
        countyId: undefined,
        lat: undefined,
        lng: undefined,
        label: undefined,
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-[0_12px_34px_rgba(0,0,0,0.35)]">
        <CardHeader className="pb-1">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-sm">Nearby Directory</CardTitle>
              <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                {localCommitted
                  ? `${(contractors as any[])?.length || 0} local profile(s), sorted by location fit and available trust evidence`
                  : "Set your area once, then TradeScout keeps the directory local by default."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {localCommitted && (
                <Badge
                  variant="outline"
                  className="gap-1 border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-primary)]"
                >
                  <MapPin className="h-3.5 w-3.5 text-[color:var(--theme-accent-primary)]" />
                  {areaLabel}
                </Badge>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 border-[color:var(--border-subtle)]"
                onClick={() => setShowOutsideArea((value) => !value)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {showOutsideArea || !localCommitted ? "Hide area picker" : "Search outside area"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {(showOutsideArea || !localCommitted) && (
            <StateCountySelector
              selectedState={stateCode}
              selectedCounty={countyFips}
              onStateChange={handleStateChange}
              onCountyChange={handleCountyChange}
              className="mt-2"
            />
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Select value={tradeSlug} onValueChange={setTradeSlug}>
              <SelectTrigger>
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

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10 pr-10"
                placeholder="Search by name, trade, or keyword"
              />
              {searchQuery.trim().length > 0 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
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
        </CardContent>
      </Card>

      {isLoading && (
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
        <DirectoryRail
          title={searchActive ? "Best nearby matches" : "Businesses near you"}
          subtitle="Each business appears once, ordered by location fit and available trust evidence."
          providers={visibleProviders}
        />
      )}
    </div>
  );
}
