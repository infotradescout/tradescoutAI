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

type StateRow = { code: string; name: string };
type CountyRow = { id: string; name: string; stateCode: string; fips: string };

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
        .map((s: any) => ({
          code: String(s.code || "").toUpperCase(),
          name: String(s.name || s.label || s.code || "").trim(),
        }))
        .filter((s: any) => s.code && s.name);
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
        .map((c: any) => ({
          id: String(c.id || ""),
          name: String(c.name || ""),
          stateCode: String(c.stateCode || selectedState || "").toUpperCase(),
          fips: String(c.fips || c.fipsCode || ""),
        }))
        .filter((c: any) => c.name && c.stateCode && /^\d{5}$/.test(c.fips));
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

  return (
    <div className="text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">County Directory</h1>
          </div>
          <p className="text-gray-300 text-lg">
            Browse counties by state. This page pulls from real data sources (no mock counts).
          </p>
        </div>

        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search counties in selected state…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
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

              <div className="text-xs text-gray-400 flex items-center">
                {statesLoading ? "Loading states…" : `State: ${selectedStateName}`}
                {selectedState !== "all" && !countiesLoading
                  ? ` • Counties: ${counties.length}`
                  : ""}
              </div>
            </div>

            <div className="space-y-3">
              {selectedState === "all" && (
                <div className="text-sm text-gray-300 bg-navy-700/30 border border-navy-600 rounded-lg p-6">
                  Select a state to see its full county list.
                </div>
              )}

              {selectedState !== "all" && countiesLoading && (
                <div className="text-sm text-gray-300 bg-navy-700/30 border border-navy-600 rounded-lg p-6">
                  Loading counties…
                </div>
              )}

              {selectedState !== "all" && !countiesLoading && filtered.length === 0 && (
                <div className="text-sm text-gray-300 bg-navy-700/30 border border-navy-600 rounded-lg p-6">
                  No counties found.
                </div>
              )}

              {selectedState !== "all" &&
                !countiesLoading &&
                filtered.slice(0, 200).map((county) => (
                  <div
                    key={county.fips}
                    className="bg-navy-700/30 border border-navy-600 rounded-lg p-5 hover:bg-navy-700/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-white truncate">
                            {county.name}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            FIPS: {county.fips}
                          </Badge>
                        </div>
                        <p className="text-gray-400 text-sm">{county.stateCode}</p>
                      </div>

                      <Link
                        href={`/county/${county.stateCode.toLowerCase()}/${nameToSlug(county.name)}`}
                      >
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
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
