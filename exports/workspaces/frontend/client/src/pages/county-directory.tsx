import { memo, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { SEOHelmet, createBreadcrumbStructuredData } from "@/components/SEOHelmet";

type StateRow = { code: string; name: string };
type CountyRow = { id: string; name: string; stateCode: string; fips: string };

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

const CountyDirectory = memo(function CountyDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("all");

  const { data: states = [], isLoading: statesLoading } = useQuery<StateRow[]>({
    queryKey: ["/api/states"],
    queryFn: async () => {
      const rows = await apiRequest("GET", "/api/states");
      return (Array.isArray(rows) ? rows : [])
        .map((s) => {
          const r = toRecord(s);
          const code = String(r.code || "").toUpperCase();
          const name = String(r.name || r.label || r.code || "").trim();
          return { code, name };
        })
        .filter((s) => s.code && s.name);
    },
    staleTime: 60 * 60 * 1000,
  });

  const { data: counties = [], isLoading: countiesLoading } = useQuery<CountyRow[]>({
    queryKey: ["/api/counties", selectedState],
    enabled: selectedState !== "all",
    queryFn: async () => {
      const rows = await apiRequest(
        "GET",
        `/api/counties?state=${encodeURIComponent(selectedState)}`
      );
      return (Array.isArray(rows) ? rows : [])
        .map((c) => {
          const r = toRecord(c);
          return {
            id: String(r.id || ""),
            name: String(r.name || ""),
            stateCode: String(r.stateCode || selectedState || "").toUpperCase(),
            fips: String(r.fips || r.fipsCode || ""),
          };
        })
        .filter((c) => c.name && c.stateCode && /^\d{5}$/.test(c.fips));
    },
    staleTime: 15 * 60 * 1000,
  });

  const selectedStateName = useMemo(() => {
    if (selectedState === "all") return "All states";
    const state = states.find((s) => s.code === selectedState);
    return state?.name || selectedState;
  }, [selectedState, states]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = counties.slice();
    if (q.length >= 2) {
      return list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [counties, searchQuery]);

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "CollectionPage",
          name: "TradeScout County Directory",
          description:
            "Browse U.S. county pages by state to reach county hubs, trade pages, community activity, and local business discovery.",
          url: "https://www.thetradescout.com/county-directory",
        },
        createBreadcrumbStructuredData([
          { name: "TradeScout", url: "/" },
          { name: "County Directory", url: "/county-directory" },
        ]),
      ],
    }),
    []
  );

  return (
    <div className="text-white">
      <SEOHelmet
        title="County Directory | Browse U.S. Counties on TradeScout"
        description="Browse TradeScout county pages by state and open local county hubs for community activity, trade partners, and verified business discovery."
        canonical="https://www.thetradescout.com/county-directory"
        structuredData={structuredData}
      />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="h-8 w-8 text-[color:var(--theme-accent-primary,#ff6600)]" />
            <h1 className="text-4xl font-bold">County Directory</h1>
          </div>
          <p className="text-white/60 text-lg">Browse counties by state.</p>
        </div>

        <Card className="bg-tsCard border border-white/10 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Search counties in selected state…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-tsBg border-white/10 text-white"
                />
              </div>

              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-tsBg border-white/10 text-white">
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select a state…</SelectItem>
                  {states.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="text-xs text-white/60 flex items-center">
                {statesLoading ? "Loading states…" : `State: ${selectedStateName}`}
                {selectedState !== "all" && !countiesLoading
                  ? ` • Counties: ${counties.length}`
                  : ""}
              </div>
            </div>

            <div className="space-y-3">
              {selectedState === "all" && (
                <div className="text-sm text-white/60 bg-tsBg/40 border border-white/10 rounded-lg p-6">
                  Select a state to see its full county list.
                </div>
              )}

              {selectedState !== "all" && countiesLoading && (
                <div className="text-sm text-white/60 bg-tsBg/40 border border-white/10 rounded-lg p-6">
                  Loading counties…
                </div>
              )}

              {selectedState !== "all" && !countiesLoading && filtered.length === 0 && (
                <div className="text-sm text-white/60 bg-tsBg/40 border border-white/10 rounded-lg p-6">
                  No counties found.
                </div>
              )}

              {selectedState !== "all" &&
                !countiesLoading &&
                filtered.slice(0, 200).map((county) => (
                  <div
                    key={county.fips}
                    className="bg-tsBg/40 border border-white/10 rounded-lg p-5 hover:bg-tsBg/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold truncate">{county.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            FIPS: {county.fips}
                          </Badge>
                        </div>
                        <p className="text-white/60 text-sm">{county.stateCode}</p>
                      </div>

                      <Link
                        href={`/county/${county.stateCode.toLowerCase()}/${nameToSlug(county.name)}`}
                      >
                        <Button size="sm" className="bg-ts-orange hover:bg-ts-orange/90 text-black">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default CountyDirectory;
