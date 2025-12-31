import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Map, Users, TrendingUp, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import provided by us-atlas
import usCounties from "us-atlas/counties-10m.json";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

type HeatmapDataPoint = {
  state: string;
  county: string;
  interactions: number;
  users: number;
  contractors: number;
  homeowners: number;
  latitude: number;
  longitude: number;
};

type CountyHeatmapResponse = {
  updatedAt: string;
  metric: string;
  timeframe: string;
  days: number;
  byCounty: Record<string, number>;
};

type CountyFeature = {
  type: string;
  id?: string | number;
  properties?: Record<string, any>;
  geometry: any;
};

type HoveredCounty = {
  fips: string;
  countyName: string;
  stateCode: string;
  count: number;
  clientX: number;
  clientY: number;
} | null;

type CountyNote = {
  id: string;
  countyFips: string;
  authorUserId: string;
  category: "affiliate" | "employee" | "partner" | "operations" | "risk" | "general";
  content: string;
  createdAt: string;
  updatedAt: string;
};

type CountyEntity = {
  id: string;
  countyFips: string;
  entityType: "affiliate" | "employee" | "partner" | "territory_manager" | "vendor";
  entityId: string | null;
  label: string | null;
  status: "active" | "inactive" | "pending";
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type CountySearchResult = {
  fips: string;
  countyName: string;
  stateCode: string;
};

function buildFipsLookup() {
  const map = new Map<string, { countyName: string; stateCode: string }>();
  for (const state of US_STATES_COUNTIES) {
    for (const county of state.counties) {
      map.set(county.fipsCode, { countyName: county.name, stateCode: state.code });
    }
  }
  return map;
}

const FIPS_LOOKUP = buildFipsLookup();

function getCountyFillColor(count: number): string {
  if (!count || count <= 0) return "#020617"; // slate-950 background

  const value = Math.log10(count);

  if (value <= 0) return "#f1f5f9"; // slate-100
  if (value <= 1) return "#bae6fd"; // light blue
  if (value <= 2) return "#7dd3fc";
  if (value <= 3) return "#38bdf8";
  if (value <= 4) return "#0284c7";
  return "#0c4a6e"; // darkest
}

function CountyHeatmapMap({
  byCounty,
  selectedFips,
  onSelectCounty,
  metricLabel,
}: {
  byCounty: Record<string, number>;
  selectedFips?: string | null;
  onSelectCounty?: (fips: string) => void;
  metricLabel: string;
}) {
  const [hovered, setHovered] = useState<HoveredCounty>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const counties = useMemo(() => {
    const topo = usCounties as any;
    const geo = feature(topo, topo.objects.counties) as any;
    return (geo.features || []) as CountyFeature[];
  }, []);

  const projection = useMemo(() => geoAlbersUsa().scale(1300).translate([487.5, 305]), []);
  const path = useMemo(() => geoPath(projection), [projection]);

  const allCounties = useMemo<CountySearchResult[]>(() => {
    const results: CountySearchResult[] = [];
    for (const [fips, info] of FIPS_LOOKUP.entries()) {
      results.push({ fips, countyName: info.countyName, stateCode: info.stateCode });
    }
    return results;
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as CountySearchResult[];
    return allCounties
      .filter((c) => {
        const haystack = `${c.countyName} ${c.stateCode} ${c.fips}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [allCounties, searchQuery]);

  const handleSelect = (fips: string) => {
    if (!fips) return;
    onSelectCounty?.(fips);
  };

  return (
    <div className="relative w-full h-[420px] bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
      <svg viewBox="0 0 975 610" className="w-full h-full">
        <g>
          {counties.map((c) => {
            const fips = typeof c.id === "string" || typeof c.id === "number" ? String(c.id).padStart(5, "0") : "";
            const count = fips ? byCounty[fips] || 0 : 0;
            const d = path(c as any) || "";
            if (!d) return null;

            const info = fips ? FIPS_LOOKUP.get(fips) : undefined;

            const isSelected = selectedFips && fips === selectedFips;

            return (
              <path
                key={fips || d}
                d={d}
                fill={getCountyFillColor(count)}
                stroke={isSelected ? "#f97316" : "#020617"}
                strokeWidth={isSelected ? 1 : 0.25}
                onMouseEnter={(evt) => {
                  if (!fips || !info) return;
                  setHovered({
                    fips,
                    countyName: info.countyName,
                    stateCode: info.stateCode,
                    count,
                    clientX: evt.clientX,
                    clientY: evt.clientY,
                  });
                }}
                onMouseMove={(evt) => {
                  if (!hovered) return;
                  setHovered({ ...hovered, clientX: evt.clientX, clientY: evt.clientY });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleSelect(fips)}
              />
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-slate-900/95 border border-slate-700 px-3 py-2 text-xs shadow-lg"
          style={{
            left: hovered.clientX + 12,
            top: hovered.clientY + 12,
          }}
        >
          <div className="font-medium text-slate-100">
            {hovered.countyName}, {hovered.stateCode}
          </div>
          <div className="mt-1 text-slate-300">{metricLabel}: {hovered.count.toLocaleString()}</div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 border border-slate-700">
        {metricLabel} per county (log scale)
      </div>

      <div className="absolute top-3 left-3 w-64">
        <div className="rounded-md bg-slate-900/90 border border-slate-700 shadow-md p-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchResults.length > 0) {
                handleSelect(searchResults[0].fips);
              }
            }}
            placeholder="Search county, state, or FIPS"
            className="h-8 bg-slate-950/80 border-slate-600 text-xs text-slate-100 placeholder:text-slate-500"
          />
          {searchFocused && searchResults.length > 0 && (
            <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-100">
              {searchResults.map((c) => (
                <button
                  key={c.fips}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c.fips)}
                  className="flex w-full items-center justify-between px-2 py-1 hover:bg-slate-800 text-left"
                >
                  <span>
                    {c.countyName}, {c.stateCode}
                  </span>
                  <span className="text-[10px] text-slate-400">{c.fips}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function UserHeatmap() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [timeframe, setTimeframe] = useState<string>("30d");
  const [viewMode, setViewMode] = useState<"heatmap" | "counties">("heatmap");
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [noteCategory, setNoteCategory] = useState<CountyNote["category"]>("general");
  const [noteContent, setNoteContent] = useState("");
  const [countyPanelTab, setCountyPanelTab] = useState<"notes" | "entities">("notes");
  const [countyMetric, setCountyMetric] = useState<string>("users");

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "head_admin";

  const { data: heatmapData = [], isLoading } = useQuery({
    queryKey: ["/api/heatmap", timeframe],
    queryFn: () => apiRequest("GET", `/api/heatmap?timeframe=${timeframe}`),
    retry: false,
  });

  const {
    data: countyHeatmap,
    isLoading: isCountyLoading,
    error: countyError,
  } = useQuery<CountyHeatmapResponse>({
    queryKey: ["/api/admin/heatmap/users-by-county", timeframe, countyMetric],
    queryFn: () => apiRequest("GET", `/api/admin/heatmap/users-by-county?timeframe=${timeframe}&metric=${countyMetric}`),
    enabled: isSuperAdmin && viewMode === "counties",
    retry: false,
  });

  const {
    data: countyNotes,
    isLoading: notesLoading,
  } = useQuery<CountyNote[]>({
    queryKey: ["/api/admin/geo/counties", selectedCountyFips, "notes"],
    queryFn: () => apiRequest("GET", `/api/admin/geo/counties/${selectedCountyFips}/notes`),
    enabled: isSuperAdmin && viewMode === "counties" && !!selectedCountyFips,
    retry: false,
  });

  const {
    data: countyEntities,
    isLoading: entitiesLoading,
  } = useQuery<CountyEntity[]>({
    queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"],
    queryFn: () => apiRequest("GET", `/api/admin/geo/counties/${selectedCountyFips}/entities`),
    enabled: isSuperAdmin && viewMode === "counties" && !!selectedCountyFips,
    retry: false,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (payload: { category: CountyNote["category"]; content: string }) => {
      if (!selectedCountyFips) throw new Error("No county selected");
      return apiRequest("POST", `/api/admin/geo/counties/${selectedCountyFips}/notes`, payload);
    },
    onSuccess: () => {
      setNoteContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/counties", selectedCountyFips, "notes"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/admin/geo/notes/${noteId}`);
    },
    onSuccess: (_data, variables) => {
      const fips = selectedCountyFips;
      if (fips) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/counties", fips, "notes"] });
      }
    },
  });

  const createEntityMutation = useMutation({
    mutationFn: async (payload: { entityType: CountyEntity["entityType"]; label?: string; status?: CountyEntity["status"]; entityId?: string }) => {
      if (!selectedCountyFips) throw new Error("No county selected");
      return apiRequest("POST", `/api/admin/geo/counties/${selectedCountyFips}/entities`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"] });
    },
  });

  const updateEntityStatusMutation = useMutation({
    mutationFn: async (payload: { entityId: string; status: CountyEntity["status"] }) => {
      return apiRequest("PATCH", `/api/admin/geo/entities/${payload.entityId}`, { status: payload.status });
    },
    onSuccess: () => {
      if (selectedCountyFips) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"] });
      }
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      await apiRequest("DELETE", `/api/admin/geo/entities/${entityId}`);
    },
    onSuccess: () => {
      if (selectedCountyFips) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"] });
      }
    },
  });

  const refreshMetricsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/geo/metrics/refresh");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/heatmap/users-by-county"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/heatmap/users-by-county", timeframe, countyMetric] });
      const summary = (data || {}) as { activeCountyCount?: number; metricsWritten?: number };
      const activeCountyCount = summary.activeCountyCount ?? 0;
      const metricsWritten = summary.metricsWritten ?? 0;
      toast({
        title: "County metrics refreshed",
        description: `Updated ${metricsWritten.toLocaleString()} metric rows across ${activeCountyCount.toLocaleString()} counties.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Refresh failed",
        description: error?.message ?? "Unable to refresh county metrics. Please try again in a minute.",
        variant: "destructive",
      });
    },
  });

  const totalInteractions = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.interactions, 0);
  const totalUsers = heatmapData.reduce((sum: number, point: HeatmapDataPoint) => sum + point.users, 0);
  const topLocations = [...heatmapData].sort((a: HeatmapDataPoint, b: HeatmapDataPoint) => b.interactions - a.interactions).slice(0, 5);

  const getIntensityClass = (interactions: number) => {
    const maxInteractions = Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions));
    const intensity = interactions / maxInteractions;
    
    if (intensity > 0.8) return "bg-red-500 text-white";
    if (intensity > 0.6) return "bg-orange-500 text-white";
    if (intensity > 0.4) return "bg-yellow-500 text-black";
    if (intensity > 0.2) return "bg-blue-400 text-white";
    return "bg-slate-600 text-gray-300";
  };

  const countyMetricLabel = useMemo(() => {
    switch (countyMetric) {
      case "users":
      case "users_total":
        return "Users";
      case "users_verified":
        return "Verified users";
      case "contractors":
        return "Contractors";
      case "affiliates_count":
        return "Affiliates";
      default:
        return "Value";
    }
  }, [countyMetric]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-orange-500" />
            User Activity Heatmap
          </h2>
          <p className="text-gray-400 mt-1">Geographic distribution of user interactions across the United States</p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <div className="inline-flex rounded-full bg-slate-800 border border-slate-700 p-1 text-xs text-slate-200">
              <button
                type="button"
                onClick={() => setViewMode("heatmap")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  viewMode === "heatmap" ? "bg-slate-200 text-slate-900" : "text-slate-300"
                }`}
              >
                Heatmap
              </button>
              <button
                type="button"
                onClick={() => setViewMode("counties")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  viewMode === "counties" ? "bg-slate-200 text-slate-900" : "text-slate-300"
                }`}
              >
                Counties
              </button>
            </div>
          )}
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>

          {isSuperAdmin && viewMode === "counties" && (
            <div className="flex items-center gap-2">
              <Select value={countyMetric} onValueChange={setCountyMetric}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Metric" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-sm">
                  <SelectItem value="users">Users (total)</SelectItem>
                  <SelectItem value="users_verified">Verified users</SelectItem>
                  <SelectItem value="contractors">Contractors</SelectItem>
                  <SelectItem value="affiliates_count">Affiliates</SelectItem>
                </SelectContent>
              </Select>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={refreshMetricsMutation.isPending}
                      onClick={() => refreshMetricsMutation.mutate()}
                      className="bg-slate-800 border-slate-700 text-xs text-slate-100 hover:bg-slate-700"
                    >
                      {refreshMetricsMutation.isPending ? "Refreshing..." : "Refresh metrics"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Recomputes county metrics from canonical data. No roles or permissions are changed.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Interactions</p>
                <p className="text-2xl font-bold text-white">{totalInteractions.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white">{totalUsers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Active Locations</p>
                <p className="text-2xl font-bold text-white">{heatmapData.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="skeleton-enhanced h-96 rounded-lg" />
          <div className="skeleton-enhanced h-64 rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Heatmap Visualization */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Map className="w-5 h-5" />
                {viewMode === "counties" && isSuperAdmin ? "County Heatmap (Admin only)" : "Activity Heatmap"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === "counties" && isSuperAdmin ? (
                <>
                  {isCountyLoading && (
                    <div className="skeleton-enhanced h-[420px] rounded-lg" />
                  )}
                  {countyError && !isCountyLoading && (
                    <div className="text-sm text-red-400">
                      County heatmap unavailable. This feature may be disabled or restricted.
                    </div>
                  )}
                  {countyHeatmap && !isCountyLoading && !countyError && (
                    <CountyHeatmapMap
                      byCounty={countyHeatmap.byCounty}
                      selectedFips={selectedCountyFips}
                      onSelectCounty={(fips) => setSelectedCountyFips(fips)}
                      metricLabel={countyMetricLabel}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {heatmapData.map((point: HeatmapDataPoint) => (
                      <div
                        key={`${point.state}-${point.county}`}
                        className={`p-3 rounded-lg border transition-all hover:scale-105 ${getIntensityClass(point.interactions)}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">
                              {point.county}, {point.state}
                            </h4>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {point.interactions} interactions
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {point.users} users
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div>👷 {point.contractors}</div>
                            <div>🏠 {point.homeowners}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t border-slate-600">
                    <p className="text-sm text-gray-400 mb-2">Activity Level:</p>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-xs text-gray-400">Very High</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-500 rounded"></div>
                        <span className="text-xs text-gray-400">High</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span className="text-xs text-gray-400">Medium</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-400 rounded"></div>
                        <span className="text-xs text-gray-400">Low</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-slate-600 rounded"></div>
                        <span className="text-xs text-gray-400">Very Low</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top Locations */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {viewMode === "counties" && isSuperAdmin ? (
                  <>
                    <MapPin className="w-5 h-5" />
                    County Panel
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    Top Active Locations
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === "counties" && isSuperAdmin ? (
                <div className="space-y-4">
                  {selectedCountyFips ? (
                    <>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Selected county</p>
                        <p className="text-sm font-semibold text-white">
                          {FIPS_LOOKUP.get(selectedCountyFips)?.countyName || "Unknown"}, {FIPS_LOOKUP.get(selectedCountyFips)?.stateCode || ""}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">FIPS: {selectedCountyFips}</p>
                        {countyHeatmap && (
                          <p className="text-xs text-slate-300 mt-1">
                            {countyMetricLabel}: {(countyHeatmap.byCounty[selectedCountyFips] || 0).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <Tabs value={countyPanelTab} onValueChange={(v) => setCountyPanelTab(v as "notes" | "entities")} className="mt-4">
                        <TabsList className="grid grid-cols-2 mb-3 bg-slate-900/80 border border-slate-700">
                          <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                          <TabsTrigger value="entities" className="text-xs">Entities</TabsTrigger>
                        </TabsList>

                        <TabsContent value="notes" className="mt-0 space-y-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Add note</label>
                            <Select value={noteCategory} onValueChange={(v) => setNoteCategory(v as CountyNote["category"])}>
                              <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-xs text-slate-100 h-8">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700 text-xs text-slate-100">
                                <SelectItem value="affiliate">Affiliate</SelectItem>
                                <SelectItem value="employee">Employee</SelectItem>
                                <SelectItem value="partner">Partner</SelectItem>
                                <SelectItem value="operations">Operations</SelectItem>
                                <SelectItem value="risk">Risk</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              placeholder="Operational note (affiliates, partners, risk, ops...)"
                              className="min-h-[80px] bg-slate-900 border-slate-700 text-sm text-slate-100"
                            />
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                disabled={!noteContent.trim() || createNoteMutation.isPending}
                                onClick={() =>
                                  createNoteMutation.mutate({
                                    category: noteCategory,
                                    content: noteContent,
                                  })
                                }
                              >
                                Save note
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3">
                            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Notes</p>
                            {notesLoading ? (
                              <div className="text-xs text-slate-400">Loading notes...</div>
                            ) : countyNotes && countyNotes.length > 0 ? (
                              <ScrollArea className="h-64 w-full rounded-md border border-slate-700 bg-slate-900/60">
                                <div className="p-3 space-y-3">
                                  {countyNotes.map((note) => {
                                    const isOwner = note.authorUserId === user?.id;
                                    const canDelete = isOwner || user?.role === "head_admin";

                                    const categoryLabel = note.category.charAt(0).toUpperCase() + note.category.slice(1);

                                    return (
                                      <div key={note.id} className="rounded-md border border-slate-700 bg-slate-900/80 p-2 text-xs text-slate-100">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                                (note.category === "risk"
                                                  ? "bg-red-900/60 text-red-100"
                                                  : note.category === "operations"
                                                  ? "bg-sky-900/60 text-sky-100"
                                                  : note.category === "affiliate" || note.category === "partner"
                                                  ? "bg-emerald-900/60 text-emerald-100"
                                                  : "bg-slate-800 text-slate-100")
                                              }
                                            >
                                              {categoryLabel}
                                            </span>
                                            <span className="text-[10px] text-slate-400">
                                              {new Date(note.createdAt).toLocaleString()}
                                            </span>
                                          </div>
                                          {canDelete && (
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                                                >
                                                  ×
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Delete note?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will permanently remove this note for this county. This action cannot be undone.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() => deleteNoteMutation.mutate(note.id)}
                                                  >
                                                    Delete
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          )}
                                        </div>
                                        <div className="whitespace-pre-wrap text-[11px] leading-snug text-slate-100">
                                          {note.content}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="text-xs text-slate-400">No notes yet for this county.</div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="entities" className="mt-0 space-y-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-300">Add entity</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                defaultValue="affiliate"
                                onValueChange={(v) =>
                                  createEntityMutation.mutate({
                                    entityType: v as CountyEntity["entityType"],
                                  })
                                }
                              >
                                <SelectTrigger className="col-span-2 bg-slate-900 border-slate-700 text-xs text-slate-100 h-8">
                                  <SelectValue placeholder="Entity type" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-xs text-slate-100">
                                  <SelectItem value="affiliate">Affiliate</SelectItem>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="partner">Partner</SelectItem>
                                  <SelectItem value="territory_manager">Territory manager</SelectItem>
                                  <SelectItem value="vendor">Vendor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Entities</p>
                            {entitiesLoading ? (
                              <div className="text-xs text-slate-400">Loading entities...</div>
                            ) : countyEntities && countyEntities.length > 0 ? (
                              <ScrollArea className="h-64 w-full rounded-md border border-slate-700 bg-slate-900/60">
                                <div className="p-3 space-y-3">
                                  {countyEntities.map((entity) => {
                                    const statusBadgeClass =
                                      entity.status === "active"
                                        ? "bg-emerald-900/60 text-emerald-100"
                                        : entity.status === "pending"
                                        ? "bg-amber-900/60 text-amber-100"
                                        : "bg-slate-800 text-slate-100";

                                    const typeLabel =
                                      entity.entityType === "territory_manager"
                                        ? "Territory manager"
                                        : entity.entityType.charAt(0).toUpperCase() + entity.entityType.slice(1);

                                    return (
                                      <div key={entity.id} className="rounded-md border border-slate-700 bg-slate-900/80 p-2 text-xs text-slate-100">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-[11px] text-slate-100">
                                              {entity.label || typeLabel}
                                            </span>
                                            {entity.entityId && (
                                              <span className="text-[10px] text-slate-400">Ref: {entity.entityId}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span
                                              className={
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                                statusBadgeClass
                                              }
                                            >
                                              {entity.status.charAt(0).toUpperCase() + entity.status.slice(1)}
                                            </span>
                                            <Select
                                              defaultValue={entity.status}
                                              onValueChange={(v) =>
                                                updateEntityStatusMutation.mutate({
                                                  entityId: entity.id,
                                                  status: v as CountyEntity["status"],
                                                })
                                              }
                                            >
                                              <SelectTrigger className="h-7 w-20 bg-slate-900 border-slate-700 text-[10px] text-slate-100">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-slate-900 border-slate-700 text-xs text-slate-100">
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="inactive">Inactive</SelectItem>
                                                <SelectItem value="pending">Pending</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-slate-400 hover:text-red-400 hover:bg-slate-800"
                                                >
                                                  ×
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Delete entity?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will remove this entity from the county container. This does not change any user roles or permissions.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() => deleteEntityMutation.mutate(entity.id)}
                                                  >
                                                    Delete
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="text-xs text-slate-400">No entities stored for this county.</div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400">
                      Select a county on the map or search by name/state/FIPS to view or add notes.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {topLocations.map((location: HeatmapDataPoint, index: number) => (
                      <div key={`${location.state}-${location.county}`} className="flex items-center justify-between p-3 bg-slate-700 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">
                              {location.county}, {location.state}
                            </h4>
                            <p className="text-sm text-gray-400">
                              {location.users} users • {location.contractors} contractors • {location.homeowners} homeowners
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-orange-400">
                            {location.interactions}
                          </p>
                          <p className="text-xs text-gray-400">interactions</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {topLocations.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No activity data available for the selected timeframe</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}