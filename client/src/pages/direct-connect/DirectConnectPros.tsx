import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ContractorCard from "@/components/contractor-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

type TradeOption = {
  id: string;
  name: string;
  slug: string;
};

export default function DirectConnectPros() {
  const location = useLocationContext();
  const [stateCode, setStateCode] = useState(location.stateCode || "");
  const [countyFips, setCountyFips] = useState(location.countyFips || "");
  const [tradeSlug, setTradeSlug] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const countyCommitted = hasCountyContext(location) || Boolean(countyFips);

  const { data: trades = [] } = useQuery<TradeOption[]>({
    queryKey: ["/api/trades"],
    queryFn: async () => apiRequest("GET", "/api/trades"),
  });

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ["/api/contractors/search", countyFips, tradeSlug, searchQuery],
    enabled: countyCommitted,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (countyFips) params.set("county", countyFips);
      if (tradeSlug) params.set("trade", tradeSlug);
      if (searchQuery) params.set("query", searchQuery.trim());
      params.set("limit", "40");
      return apiRequest("GET", `/api/contractors/search?${params.toString()}`);
    },
  });

  const hasResults = (contractors as any[])?.length > 0;
  const showEmptyState = countyCommitted && !isLoading && !hasResults;

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
          <CardTitle className="text-sm">Browse local pros</CardTitle>
          <p className="text-xs text-[color:var(--text-secondary)]">
            {countyCommitted
              ? `${(contractors as any[])?.length || 0} result(s)`
              : "Set county to search"}
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
            No pros found yet for this selection.
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
