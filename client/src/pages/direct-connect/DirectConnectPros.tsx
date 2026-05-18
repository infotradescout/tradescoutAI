import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ContractorCard from "@/components/contractor-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useLocationContext,
  hasCountyContext,
  setSessionLocationOverride,
} from "@/hooks/useLocationContext";
import { StateCountySelector } from "@/components/state-county-selector";
import { Link } from "wouter";
import { formatCountyLabel } from "@/utils/countyFipsToName";

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

  const effectiveStateCode = String(stateCode || location.stateCode || "").toUpperCase();
  const effectiveCountyFips = String(countyFips || location.countyFips || "").trim();

  const countyCommitted = hasCountyContext(location) || Boolean(effectiveCountyFips);
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
  const canQueryDirectory = countyCommitted || (hasStateContext && hasDirectoryIntent);

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: [
      "/api/business-providers/search",
      effectiveCountyFips,
      effectiveStateCode,
      effectiveTradeSlug,
      searchQuery,
    ],
    enabled: canQueryDirectory,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveCountyFips) params.set("county", effectiveCountyFips);
      if (!effectiveCountyFips && hasStateContext) params.set("state", effectiveStateCode);
      if (effectiveTradeSlug) params.set("trade", effectiveTradeSlug);
      if (searchQuery) params.set("query", searchQuery.trim());
      params.set("limit", "40");
      return apiRequest("GET", `/api/business-providers/search?${params.toString()}`);
    },
  });

  const hasResults = (contractors as any[])?.length > 0;
  const showEmptyState = canQueryDirectory && !isLoading && !hasResults;

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
          <CardTitle className="text-sm">Local Directory</CardTitle>
          <p className="text-xs text-[color:var(--text-secondary)]">
            {countyCommitted
              ? `${(contractors as any[])?.length || 0} result(s)`
              : "Choose a county to start"}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <StateCountySelector
            selectedState={stateCode}
            selectedCounty={countyFips}
            onStateChange={handleStateChange}
            onCountyChange={handleCountyChange}
            className="mt-2"
          />

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Select value={tradeSlug} onValueChange={setTradeSlug}>
              <SelectTrigger>
                <SelectValue placeholder="Select a trade" />
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
                placeholder="Search by name or keyword"
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
              These businesses appear in the county directory, but they have not finished TradeScout
              verification yet.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {directoryFallback.map((business) => {
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
                          : "County not specified"}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">Not verified</Badge>
                        <Badge variant="outline">County directory</Badge>
                        {String(business.claimStatus || "").toLowerCase() === "claimed" ? (
                          <Badge variant="outline">Claimed profile</Badge>
                        ) : (
                          <Badge variant="outline">Unclaimed listing</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Link href={`/business/${encodeURIComponent(business.slug)}`}>
                        <Button size="sm" variant="outline">
                          View listing
                        </Button>
                      </Link>
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
              These listings are active in your state. Some may still need county assignment before
              they appear in county-only routing.
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
                          : "County assignment pending"}
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
                      <Link href={`/business/${encodeURIComponent(business.slug)}`}>
                        <Button size="sm" variant="outline">
                          View listing
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {hasResults && (
        <div className="grid gap-4 lg:grid-cols-2">
          {(contractors as any[]).map((contractor) => (
            <ContractorCard key={contractor.id} contractor={contractor} compact requestOnly />
          ))}
        </div>
      )}
    </div>
  );
}
