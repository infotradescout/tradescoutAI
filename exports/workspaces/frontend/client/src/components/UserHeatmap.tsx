import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Map as MapIcon,
  Users,
  TrendingUp,
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isSuperAdminLike } from "@/lib/roleChecks";
import { US_STATES_COUNTIES } from "@shared/states-counties";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import usCountiesUrl from "us-atlas/counties-10m.json?url";
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
import { useToast } from "@/hooks/use-toast";
import { RegionalIntelligenceBrowser } from "@/scout/RegionalIntelligenceBrowser";
import { DraggableDataTray } from "@/scout/DraggableDataTray";

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

type CountiesTopology = {
  objects: {
    counties: unknown;
  };
};

type HoveredCounty = {
  fips: string;
  countyName: string;
  stateCode: string;
  lens: "metric" | "coverage";
  count?: number;
  metricHasData?: boolean;
  coverageStatus?: CountyCoverageStatus;
  territoryManagerCount?: number;
  affiliateCount?: number;
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

type CountyCoverageStatus = "unassigned" | "partial" | "full";

type CountyCoverageRow = {
  countyFips: string;
  coverageStatus: CountyCoverageStatus;
  territoryManagerCount: number;
  affiliateCount: number;
  observations30d?: number;
};

type CountyCoverageResponse = {
  rows: CountyCoverageRow[];
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
  if (!count || count <= 0) return "var(--heatmap-bg)"; // slate-950 background

  const value = Math.log10(count);

  if (value <= 0) return "var(--heatmap-0)"; // slate-100
  if (value <= 1) return "var(--heatmap-1)"; // light blue
  if (value <= 2) return "var(--heatmap-2)";
  if (value <= 3) return "var(--heatmap-3)";
  if (value <= 4) return "var(--heatmap-4)";
  return "var(--heatmap-5)"; // darkest
}

function getCoverageFillColor(status?: CountyCoverageStatus): string {
  if (!status) return "var(--coverage-neutral)"; // slate-800 neutral
  if (status === "unassigned") return "var(--coverage-unassigned)"; // red-700
  if (status === "partial") return "var(--coverage-partial)"; // amber-700
  return "var(--coverage-full)"; // green-700 for full
}

function CountyHeatmapMap({
  byCounty,
  coverageByCounty,
  selectedFips,
  onSelectCounty,
  metricLabel,
  lens,
}: {
  byCounty: Record<string, number>;
  coverageByCounty?: Record<string, CountyCoverageRow>;
  selectedFips?: string | null;
  onSelectCounty?: (fips: string) => void;
  metricLabel: string;
  lens: "metric" | "coverage";
}) {
  const [hovered, setHovered] = useState<HoveredCounty>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [internalSelectedFips, setInternalSelectedFips] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTrayOpen, setIsTrayOpen] = useState(true);
  const [dragOverFips, setDragOverFips] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [countiesTopology, setCountiesTopology] = useState<CountiesTopology | null>(null);
  const [mapDataError, setMapDataError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef({
    active: false,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  useEffect(() => {
    let cancelled = false;

    const loadCountyMap = async () => {
      try {
        const response = await fetch(usCountiesUrl);
        if (!response.ok) {
          throw new Error(`Failed to load county map (${response.status})`);
        }

        const topology = (await response.json()) as CountiesTopology;
        if (!cancelled) {
          setCountiesTopology(topology);
          setMapDataError(null);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : "Unable to load county map data.";
          setMapDataError(message);
        }
      }
    };

    void loadCountyMap();

    return () => {
      cancelled = true;
    };
  }, []);

  const counties = useMemo(() => {
    if (!countiesTopology) {
      return [] as CountyFeature[];
    }

    const geo = feature(countiesTopology as any, countiesTopology.objects.counties) as any;
    return (geo.features || []) as CountyFeature[];
  }, [countiesTopology]);

  const projection = useMemo(() => geoAlbersUsa().scale(1300).translate([487.5, 305]), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const viewportCenter = useMemo(() => ({ x: 975 / 2, y: 610 / 2 }), []);

  const clampPanForZoom = (candidate: { x: number; y: number }, zoomLevel: number) => {
    const scaledWidth = 975 * zoomLevel;
    const scaledHeight = 610 * zoomLevel;

    // When zoomed out or at 1x, keep map centered in viewport.
    if (scaledWidth <= 975 && scaledHeight <= 610) {
      return {
        x: (975 - scaledWidth) / 2,
        y: (610 - scaledHeight) / 2,
      };
    }

    const minX = 975 - scaledWidth;
    const maxX = 0;
    const minY = 610 - scaledHeight;
    const maxY = 0;

    return {
      x: Math.min(maxX, Math.max(minX, candidate.x)),
      y: Math.min(maxY, Math.max(minY, candidate.y)),
    };
  };

  const allCounties = useMemo<CountySearchResult[]>(() => {
    const results: CountySearchResult[] = [];
    for (const [fips, info] of Array.from(FIPS_LOOKUP.entries())) {
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

  const centerOnCounty = (fips: string) => {
    const target = counties.find((county) => String(county.id || "").padStart(5, "0") === fips);
    if (!target) return;
    const centroid = path.centroid(target as any);
    if (!Array.isArray(centroid) || centroid.length !== 2) return;
    const [cx, cy] = centroid;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;

    const nextZoom = Math.max(zoom, 2.5);
    setZoom(nextZoom);
    setPan(
      clampPanForZoom(
        {
          x: viewportCenter.x - cx * nextZoom,
          y: viewportCenter.y - cy * nextZoom,
        },
        nextZoom
      )
    );
  };
  const handleSelect = (fips: string) => {
    setInternalSelectedFips(fips);
    setIsSidebarOpen(true);
    if (onSelectCounty) {
      onSelectCounty(fips);
    }
    centerOnCounty(fips);
  };

  const assignFileMutation = useMutation({
    mutationFn: async ({ fileId, fips }: { fileId: string; fips: string }) => {
      return apiRequest("POST", "/api/scout/assign-file", { fileId, fips });
    },
    onSuccess: () => {
      toast({
        title: "File Assigned",
        description: "The file has been successfully assigned to the county.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/scout/unassigned-files"] });
      if (internalSelectedFips) {
        queryClient.invalidateQueries({ queryKey: [`/api/heatmap/county/${internalSelectedFips}`] });
      }
    },
    onError: (error) => {
      toast({
        title: "Assignment Failed",
        description: formatUserFacingErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  const handleDrop = (e: React.DragEvent, fips: string) => {
    e.preventDefault();
    setDragOverFips(null);
    try {
      const fileData = JSON.parse(e.dataTransfer.getData("application/json"));
      if (fileData && fileData.id) {
        assignFileMutation.mutate({ fileId: fileData.id, fips });
      }
    } catch (err) {
      console.error("Error parsing dropped file data:", err);
    }
  };t clampZoom = (value: number) => Math.min(8, Math.max(1, value));

  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 975,
      y: ((clientY - rect.top) / rect.height) * 610,
    };
  };

  const zoomAtClientPoint = (clientX: number, clientY: number, requestedZoom: number) => {
    const anchor = clientToSvgPoint(clientX, clientY);
    if (!anchor) return;
    const nextZoom = clampZoom(requestedZoom);
    if (Math.abs(nextZoom - zoom) < 0.001) return;
    const worldX = (anchor.x - pan.x) / zoom;
    const worldY = (anchor.y - pan.y) / zoom;
    setZoom(nextZoom);
    setPan(
      clampPanForZoom(
        {
          x: anchor.x - worldX * nextZoom,
          y: anchor.y - worldY * nextZoom,
        },
        nextZoom
      )
    );
  };

  useEffect(() => {
    setPan((current) => clampPanForZoom(current, zoom));
  }, [zoom]);

  return (
    <div className="relative w-full h-[420px] bg-tsCard rounded-lg overflow-hidden border border-white/10">
      <svg
        ref={svgRef}
        viewBox="0 0 975 610"
        className="w-full h-full select-none"
        style={{ cursor: dragRef.current.active ? "grabbing" : "grab", touchAction: "none" }}
        onWheel={(event) => {
          event.preventDefault();
          const factor = event.deltaY > 0 ? 0.85 : 1.15;
          zoomAtClientPoint(event.clientX, event.clientY, zoom * factor);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          zoomAtClientPoint(event.clientX, event.clientY, zoom * 1.5);
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current.active = true;
          dragRef.current.startClientX = event.clientX;
          dragRef.current.startClientY = event.clientY;
          dragRef.current.startPanX = pan.x;
          dragRef.current.startPanY = pan.y;
          dragRef.current.moved = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragRef.current.active) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          const scaleX = 975 / rect.width;
          const scaleY = 610 / rect.height;
          const dx = (event.clientX - dragRef.current.startClientX) * scaleX;
          const dy = (event.clientY - dragRef.current.startClientY) * scaleY;
          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            dragRef.current.moved = true;
          }
          setPan(
            clampPanForZoom(
              {
                x: dragRef.current.startPanX + dx,
                y: dragRef.current.startPanY + dy,
              },
              zoom
            )
          );
        }}
        onPointerUp={(event) => {
          if (dragRef.current.active) {
            dragRef.current.active = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            window.setTimeout(() => {
              dragRef.current.moved = false;
            }, 0);
          }
        }}
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {counties.map((c) => {
            const fips =
              typeof c.id === "string" || typeof c.id === "number"
                ? String(c.id).padStart(5, "0")
                : "";
            const coverage = fips && coverageByCounty ? coverageByCounty[fips] : undefined;
            const hasMetric = !!(fips && Object.prototype.hasOwnProperty.call(byCounty, fips));
            const count = fips && hasMetric ? byCounty[fips] || 0 : 0;
            const d = path(c as any) || "";
            if (!d) return null;

            const info = fips ? FIPS_LOOKUP.get(fips) : undefined;

            const isSelected = (selectedFips || internalSelectedFips) && fips === (selectedFips || internalSelectedFips);
            const isDragOver = dragOverFips && fips === dragOverFips;

            const fillColor =
              isDragOver
                ? "var(--ts-blue-muted)" // Highlight when dragging over
                : lens === "coverage"
                  ? getCoverageFillColor(coverage?.coverageStatus)
                  : hasMetric
                    ? getCountyFillColor(count)
                    : "var(--coverage-neutral)"; // neutral when metric not populated

            return (
              <path
                key={fips || d}
                d={d}
                fill={fillColor}
                stroke={
                  isSelected || isDragOver
                    ? "var(--heatmap-stroke-selected)"
                    : "var(--heatmap-stroke-default)"
                }
                strokeWidth={isSelected || isDragOver ? 1 : 0.25}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (fips !== dragOverFips) setDragOverFips(fips);
                }}
                onDragLeave={() => setDragOverFips(null)}
                onDrop={(e) => handleDrop(e, fips)}
                onMouseEnter={(evt) => {
                  if (!fips || !info) return;
                  if (lens === "coverage") {
                    setHovered({
                      fips,
                      countyName: info.countyName,
                      stateCode: info.stateCode,
                      lens: "coverage",
                      coverageStatus: coverage?.coverageStatus,
                      territoryManagerCount: coverage?.territoryManagerCount ?? 0,
                      affiliateCount: coverage?.affiliateCount ?? 0,
                      clientX: evt.clientX,
                      clientY: evt.clientY,
                    });
                  } else {
                    setHovered({
                      fips,
                      countyName: info.countyName,
                      stateCode: info.stateCode,
                      lens: "metric",
                      count,
                      metricHasData: hasMetric,
                      clientX: evt.clientX,
                      clientY: evt.clientY,
                    });
                  }
                }}
                onMouseMove={(evt) => {
                  if (!hovered) return;
                  setHovered({ ...hovered, clientX: evt.clientX, clientY: evt.clientY });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={(event) => {
                  if (dragRef.current.moved) {
                    event.preventDefault();
                    return;
                  }
                  handleSelect(fips);
                }}
              />
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div
          className="pointer-events-none fixed z-50 rounded-md bg-tsCard/95 border border-white/10 px-3 py-2 text-xs shadow-lg"
          style={{
            left: hovered.clientX + 12,
            top: hovered.clientY + 12,
          }}
        >
          <div className="font-medium text-white">
            {hovered.countyName}, {hovered.stateCode}
          </div>
          {hovered.lens === "coverage" ? (
            <>
              <div className="mt-1 text-white/70">
                Coverage:{" "}
                {hovered.coverageStatus
                  ? hovered.coverageStatus.charAt(0).toUpperCase() + hovered.coverageStatus.slice(1)
                  : "Not set"}
              </div>
              <div className="mt-1 text-white/60 text-[11px]">
                TM: {hovered.territoryManagerCount ?? 0} • Affiliate/partner:{" "}
                {hovered.affiliateCount ?? 0}
              </div>
            </>
          ) : (
            <div className="mt-1 text-white/70">
              {hovered.metricHasData
                ? `${metricLabel}: ${((hovered.count ?? 0) as number).toLocaleString()}`
                : "Metric not populated yet."}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-3 left-3 rounded bg-tsCard/95 px-2 py-1 text-[10px] text-white/70 border border-white/10">
        {metricLabel} per county (log scale) · scroll/double-click to zoom · drag to pan
      </div>

      {!countiesTopology && !mapDataError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-tsCard/70 text-sm text-white/70">
          Loading county map...
        </div>
      ) : null}

      {mapDataError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-tsCard/80 px-4 text-center text-sm text-red-200">
          {mapDataError}
        </div>
      ) : null}

      <div className="absolute top-3 right-3 rounded-md bg-tsCard/95 border border-white/10 shadow-md p-1.5 flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setZoom((current) => clampZoom(current * 1.2))}
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setZoom((current) => clampZoom(current / 1.2))}
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => {
            setZoom(1);
            setPan(clampPanForZoom({ x: 0, y: 0 }, 1));
          }}
          aria-label="Reset map"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="absolute top-3 left-3 w-64">
        <div className="rounded-md bg-tsCard/95 border border-white/10 shadow-md p-2">
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
            className="h-8 bg-black/30 border-white/15 text-xs text-white placeholder:text-white/60"
          />
          {searchFocused && searchResults.length > 0 && (
            <div className="mt-1 max-h-52 overflow-y-auto rounded-md border border-white/10 bg-tsCard text-xs text-white">
              {searchResults.map((c) => (
                <button
                  key={c.fips}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c.fips)}
                  className="flex w-full items-center justify-between px-2 py-1 hover:bg-white/5 text-left"
                >
                  <span>
                    {c.countyName}, {c.stateCode}
                  </span>
                  <span className="text-[10px] text-white/60">{c.fips}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Scout 2.0 Command Center Components */}
      {(selectedFips || internalSelectedFips) && isSidebarOpen && (
        <RegionalIntelligenceBrowser
          fips={(selectedFips || internalSelectedFips)!}
          county={FIPS_LOOKUP.get((selectedFips || internalSelectedFips)!)?.countyName || "Unknown"}
          state={FIPS_LOOKUP.get((selectedFips || internalSelectedFips)!)?.stateCode || ""}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      <DraggableDataTray
        isOpen={isTrayOpen}
        onClose={() => setIsTrayOpen(false)}
        onFileAssigned={(fileId, fips) => assignFileMutation.mutate({ fileId, fips })}
      />
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
  const [countyMetric, setCountyMetric] = useState<string>("users_total");
  const [countyLens, setCountyLens] = useState<"coverage" | "metric">("coverage");
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isSuperAdmin = isSuperAdminLike(user?.role);

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
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/heatmap/users-by-county?timeframe=${timeframe}&metric=${countyMetric}`
      ),
    enabled: isSuperAdmin && viewMode === "counties" && countyLens === "metric",
    retry: false,
  });

  const {
    data: countyCoverage,
    isLoading: coverageLoading,
    error: coverageError,
  } = useQuery<CountyCoverageResponse>({
    queryKey: ["/api/admin/geo/coverage"],
    queryFn: () => apiRequest("GET", "/api/admin/geo/coverage"),
    enabled: isSuperAdmin && viewMode === "counties",
    retry: false,
  });

  const { data: countyNotes, isLoading: notesLoading } = useQuery<CountyNote[]>({
    queryKey: ["/api/admin/geo/counties", selectedCountyFips, "notes"],
    queryFn: () => apiRequest("GET", `/api/admin/geo/counties/${selectedCountyFips}/notes`),
    enabled: isSuperAdmin && viewMode === "counties" && !!selectedCountyFips,
    retry: false,
  });

  const { data: countyEntities, isLoading: entitiesLoading } = useQuery<CountyEntity[]>({
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
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/geo/counties", selectedCountyFips, "notes"],
      });
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
    mutationFn: async (payload: {
      entityType: CountyEntity["entityType"];
      label?: string;
      status?: CountyEntity["status"];
      entityId?: string;
    }) => {
      if (!selectedCountyFips) throw new Error("No county selected");
      return apiRequest("POST", `/api/admin/geo/counties/${selectedCountyFips}/entities`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
  });

  const updateEntityStatusMutation = useMutation({
    mutationFn: async (payload: { entityId: string; status: CountyEntity["status"] }) => {
      return apiRequest("PATCH", `/api/admin/geo/entities/${payload.entityId}`, {
        status: payload.status,
      });
    },
    onSuccess: () => {
      if (selectedCountyFips) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      await apiRequest("DELETE", `/api/admin/geo/entities/${entityId}`);
    },
    onSuccess: () => {
      if (selectedCountyFips) {
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/geo/counties", selectedCountyFips, "entities"],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fips = params.get("fips");
      if (fips && /^\d{5}$/.test(fips)) {
        setViewMode("counties");
        setSelectedCountyFips(fips);
      }
    } catch {
      // ignore malformed URLs
    }
  }, []);

  const refreshMetricsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/geo/metrics/refresh");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/heatmap/users-by-county"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/heatmap/users-by-county", timeframe, countyMetric],
      });
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
        description: formatUserFacingErrorMessage(
          error,
          "Unable to refresh county metrics. Please try again in a minute."
        ),
        variant: "destructive",
      });
    },
  });

  const totalInteractions = heatmapData.reduce(
    (sum: number, point: HeatmapDataPoint) => sum + point.interactions,
    0
  );
  const totalUsers = heatmapData.reduce(
    (sum: number, point: HeatmapDataPoint) => sum + point.users,
    0
  );
  const topLocations = [...heatmapData]
    .sort((a: HeatmapDataPoint, b: HeatmapDataPoint) => b.interactions - a.interactions)
    .slice(0, 5);

  const getIntensityClass = (interactions: number) => {
    const maxInteractions = Math.max(...heatmapData.map((p: HeatmapDataPoint) => p.interactions));
    const intensity = interactions / maxInteractions;

    if (intensity > 0.8) return "bg-red-500 text-white";
    if (intensity > 0.6) return "bg-ts-orange text-white";
    if (intensity > 0.4) return "bg-yellow-500 text-black";
    if (intensity > 0.2) return "bg-blue-400 text-white";
    return "bg-white/10 text-white/70";
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
      case "observations_30d":
        return "Observations (30d)";
      default:
        return "Value";
    }
  }, [countyMetric]);

  const coverageByCounty = useMemo(() => {
    const map: Record<string, CountyCoverageRow> = {};
    if (!countyCoverage?.rows) return map;
    for (const row of countyCoverage.rows) {
      map[row.countyFips] = row;
    }
    return map;
  }, [countyCoverage]);

  const handleAssignTerritoryManager = () => {
    if (!selectedCountyFips || createEntityMutation.isPending) return;
    createEntityMutation.mutate({
      entityType: "territory_manager",
      status: "active",
    } as any);
  };

  const handleAssignAffiliateOrPartner = () => {
    if (!selectedCountyFips || createEntityMutation.isPending) return;
    createEntityMutation.mutate({
      entityType: "affiliate",
      status: "active",
    } as any);
  };

  const handleStartNoteForCounty = () => {
    if (!selectedCountyFips) return;
    setCountyPanelTab("notes");
    setTimeout(() => {
      noteTextareaRef.current?.focus();
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapIcon className="w-6 h-6 text-ts-orange" />
            User Activity Heatmap
          </h2>
          <p className="text-white/60 mt-1">
            Geographic distribution of user interactions across the United States
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isSuperAdmin && (
            <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1 text-xs text-white/70">
              <button
                type="button"
                onClick={() => setViewMode("heatmap")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  viewMode === "heatmap" ? "bg-white/10 text-white/70" : "text-white/70"
                }`}
              >
                Heatmap
              </button>
              <button
                type="button"
                onClick={() => setViewMode("counties")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  viewMode === "counties" ? "bg-white/10 text-white/70" : "text-white/70"
                }`}
              >
                Counties
              </button>
            </div>
          )}
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white/5 border-white/10">
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>

          {isSuperAdmin && viewMode === "counties" && (
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1 text-xs text-white/70">
                <button
                  type="button"
                  onClick={() => setCountyLens("coverage")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    countyLens === "coverage" ? "bg-white/10 text-white/70" : "text-white/70"
                  }`}
                >
                  Coverage
                </button>
                <button
                  type="button"
                  onClick={() => setCountyLens("metric")}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    countyLens === "metric" ? "bg-white/10 text-white/70" : "text-white/70"
                  }`}
                >
                  Metrics
                </button>
              </div>
              {countyLens === "metric" && (
                <>
                  <Select value={countyMetric} onValueChange={setCountyMetric}>
                    <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Metric" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/5 border-white/10 text-sm">
                      <SelectItem value="users_total">Users (total)</SelectItem>
                      <SelectItem value="users_verified">Verified users</SelectItem>
                      <SelectItem value="contractors">Contractors</SelectItem>
                      <SelectItem value="affiliates_count">Affiliates</SelectItem>
                      <SelectItem value="businesses_total">Businesses</SelectItem>
                      <SelectItem value="homeowners_total">Homeowners</SelectItem>
                      <SelectItem value="tradedeals_active">TradeDeals (active)</SelectItem>
                      <SelectItem value="observations_30d">Observations (30d)</SelectItem>
                      <SelectItem value="unmet_demand_score">Unmet demand score</SelectItem>
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
                          className="bg-white/5 border-white/10 text-xs text-white hover:bg-white/10"
                        >
                          {refreshMetricsMutation.isPending ? "Refreshing..." : "Refresh metrics"}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Recomputes county metrics from canonical data. No roles or permissions are
                        changed.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Total Interactions</p>
                <p className="text-2xl font-bold text-white">
                  {totalInteractions.toLocaleString()}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-ts-orange" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Active Users</p>
                <p className="text-2xl font-bold text-white">{totalUsers.toLocaleString()}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Active Locations</p>
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
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapIcon className="w-5 h-5" />
                {viewMode === "counties" && isSuperAdmin
                  ? "County Heatmap (Admin only)"
                  : "Activity Heatmap"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {viewMode === "counties" && isSuperAdmin ? (
                <>
                  {countyLens === "metric" && isCountyLoading && (
                    <div className="skeleton-enhanced h-[420px] rounded-lg" />
                  )}
                  {countyLens === "coverage" && coverageLoading && (
                    <div className="skeleton-enhanced h-[420px] rounded-lg" />
                  )}
                  {countyLens === "metric" && countyError && !isCountyLoading && (
                    <div className="text-sm text-red-400">
                      County metric heatmap unavailable. This feature may be disabled or restricted.
                    </div>
                  )}
                  {countyLens === "coverage" && coverageError && !coverageLoading && (
                    <div className="text-sm text-red-400">
                      Coverage view unavailable. This feature may be disabled or restricted.
                    </div>
                  )}
                  {countyLens === "metric" && countyHeatmap && !isCountyLoading && !countyError && (
                    <CountyHeatmapMap
                      byCounty={countyHeatmap.byCounty}
                      coverageByCounty={coverageByCounty}
                      selectedFips={selectedCountyFips}
                      onSelectCounty={(fips) => setSelectedCountyFips(fips)}
                      metricLabel={countyMetricLabel}
                      lens="metric"
                    />
                  )}
                  {countyLens === "coverage" &&
                    countyCoverage &&
                    !coverageLoading &&
                    !coverageError && (
                      <CountyHeatmapMap
                        byCounty={{}}
                        coverageByCounty={coverageByCounty}
                        selectedFips={selectedCountyFips}
                        onSelectCounty={(fips) => setSelectedCountyFips(fips)}
                        metricLabel={"Coverage"}
                        lens="coverage"
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
                  <div className="mt-4 pt-4 border-t border-white/15">
                    <p className="text-sm text-white/60 mb-2">Activity Level:</p>
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span className="text-xs text-white/60">Very High</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-ts-orange rounded"></div>
                        <span className="text-xs text-white/60">High</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span className="text-xs text-white/60">Medium</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-blue-400 rounded"></div>
                        <span className="text-xs text-white/60">Low</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-white/10 rounded"></div>
                        <span className="text-xs text-white/60">Very Low</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Top Locations */}
          <Card className="bg-white/5 border-white/10">
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
                        <p className="text-xs uppercase tracking-wide text-white/60 mb-1">
                          Selected county
                        </p>
                        <p className="text-sm font-semibold text-white">
                          {FIPS_LOOKUP.get(selectedCountyFips)?.countyName || "Unknown"},{" "}
                          {FIPS_LOOKUP.get(selectedCountyFips)?.stateCode || ""}
                        </p>
                        <p className="text-xs text-white/60 mt-0.5">FIPS: {selectedCountyFips}</p>
                        {countyHeatmap && (
                          <p className="text-xs text-white/70 mt-1">
                            {countyMetricLabel}:{" "}
                            {(countyHeatmap.byCounty[selectedCountyFips] || 0).toLocaleString()}
                          </p>
                        )}
                        {coverageByCounty[selectedCountyFips] && (
                          <p className="text-xs text-white/70 mt-1">
                            Coverage:{" "}
                            {coverageByCounty[selectedCountyFips].coverageStatus
                              .charAt(0)
                              .toUpperCase() +
                              coverageByCounty[selectedCountyFips].coverageStatus.slice(1)}{" "}
                            • TM: {coverageByCounty[selectedCountyFips].territoryManagerCount} •
                            Affiliate/partner: {coverageByCounty[selectedCountyFips].affiliateCount}
                          </p>
                        )}
                        {coverageByCounty[selectedCountyFips] && (
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                            <span className="text-white/60 mr-2">Actions:</span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={createEntityMutation.isPending}
                              className="h-6 px-2 text-[11px]"
                              onClick={handleAssignTerritoryManager}
                            >
                              Assign Territory Manager
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={createEntityMutation.isPending}
                              className="h-6 px-2 text-[11px]"
                              onClick={handleAssignAffiliateOrPartner}
                            >
                              Assign Affiliate / Partner
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px] text-white/70"
                              onClick={handleStartNoteForCounty}
                            >
                              Add note
                            </Button>
                          </div>
                        )}
                      </div>
                      <Tabs
                        value={countyPanelTab}
                        onValueChange={(v) => setCountyPanelTab(v as "notes" | "entities")}
                        className="mt-4"
                      >
                        <TabsList className="grid grid-cols-2 mb-3 bg-tsCard/95 border border-white/10">
                          <TabsTrigger value="notes" className="text-xs">
                            Notes
                          </TabsTrigger>
                          <TabsTrigger value="entities" className="text-xs">
                            Entities
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="notes" className="mt-0 space-y-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-white/70">Add note</label>
                            <Select
                              value={noteCategory}
                              onValueChange={(v) => setNoteCategory(v as CountyNote["category"])}
                            >
                              <SelectTrigger className="w-full bg-tsCard border-white/10 text-xs text-white h-8">
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent className="bg-tsCard border-white/10 text-xs text-white">
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
                              ref={noteTextareaRef}
                              className="min-h-[80px] bg-tsCard border-white/10 text-sm text-white"
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
                            <p className="text-xs uppercase tracking-wide text-white/60 mb-2">
                              Notes
                            </p>
                            {notesLoading ? (
                              <div className="text-xs text-white/60">Loading notes...</div>
                            ) : countyNotes && countyNotes.length > 0 ? (
                              <ScrollArea className="h-64 w-full rounded-md border border-white/10 bg-tsCard/95">
                                <div className="p-3 space-y-3">
                                  {countyNotes.map((note) => {
                                    const isOwner = note.authorUserId === user?.id;
                                    const canDelete = isOwner || isSuperAdminLike(user?.role);

                                    const categoryLabel =
                                      note.category.charAt(0).toUpperCase() +
                                      note.category.slice(1);

                                    return (
                                      <div
                                        key={note.id}
                                        className="rounded-md border border-white/10 bg-tsCard/95 p-2 text-xs text-white"
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                                (note.category === "risk"
                                                  ? "bg-red-900/60 text-red-100"
                                                  : note.category === "operations"
                                                    ? "bg-sky-900/60 text-sky-100"
                                                    : note.category === "affiliate" ||
                                                        note.category === "partner"
                                                      ? "bg-emerald-900/60 text-emerald-100"
                                                      : "bg-white/5 text-white")
                                              }
                                            >
                                              {categoryLabel}
                                            </span>
                                            <span className="text-[10px] text-white/60">
                                              {new Date(note.createdAt).toLocaleString()}
                                            </span>
                                          </div>
                                          {canDelete && (
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-white/60 hover:text-red-400 hover:bg-white/5"
                                                >
                                                  ×
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>Delete note?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will permanently remove this note for this
                                                    county. This action cannot be undone.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() =>
                                                      deleteNoteMutation.mutate(note.id)
                                                    }
                                                  >
                                                    Delete
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          )}
                                        </div>
                                        <div className="whitespace-pre-wrap text-[11px] leading-snug text-white">
                                          {note.content}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </ScrollArea>
                            ) : (
                              <div className="text-xs text-white/60">
                                No notes yet for this county.
                              </div>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="entities" className="mt-0 space-y-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-white/70">Add entity</label>
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                defaultValue="affiliate"
                                onValueChange={(v) =>
                                  createEntityMutation.mutate({
                                    entityType: v as CountyEntity["entityType"],
                                  })
                                }
                              >
                                <SelectTrigger className="col-span-2 bg-tsCard border-white/10 text-xs text-white h-8">
                                  <SelectValue placeholder="Entity type" />
                                </SelectTrigger>
                                <SelectContent className="bg-tsCard border-white/10 text-xs text-white">
                                  <SelectItem value="affiliate">Affiliate</SelectItem>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="partner">Partner</SelectItem>
                                  <SelectItem value="territory_manager">
                                    Territory manager
                                  </SelectItem>
                                  <SelectItem value="vendor">Vendor</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs uppercase tracking-wide text-white/60 mb-2">
                              Entities
                            </p>
                            {entitiesLoading ? (
                              <div className="text-xs text-white/60">Loading entities...</div>
                            ) : countyEntities && countyEntities.length > 0 ? (
                              <ScrollArea className="h-64 w-full rounded-md border border-white/10 bg-tsCard/95">
                                <div className="p-3 space-y-3">
                                  {countyEntities.map((entity) => {
                                    const statusBadgeClass =
                                      entity.status === "active"
                                        ? "bg-emerald-900/60 text-emerald-100"
                                        : entity.status === "pending"
                                          ? "bg-amber-900/60 text-amber-100"
                                          : "bg-white/5 text-white";

                                    const typeLabel =
                                      entity.entityType === "territory_manager"
                                        ? "Territory manager"
                                        : entity.entityType.charAt(0).toUpperCase() +
                                          entity.entityType.slice(1);

                                    return (
                                      <div
                                        key={entity.id}
                                        className="rounded-md border border-white/10 bg-tsCard/95 p-2 text-xs text-white"
                                      >
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-medium text-[11px] text-white">
                                              {entity.label || typeLabel}
                                            </span>
                                            {entity.entityId && (
                                              <span className="text-[10px] text-white/60">
                                                Ref: {entity.entityId}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span
                                              className={
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                                                statusBadgeClass
                                              }
                                            >
                                              {entity.status.charAt(0).toUpperCase() +
                                                entity.status.slice(1)}
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
                                              <SelectTrigger className="h-7 w-20 bg-tsCard border-white/10 text-[10px] text-white">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="bg-tsCard border-white/10 text-xs text-white">
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
                                                  className="h-6 w-6 text-white/60 hover:text-red-400 hover:bg-white/5"
                                                >
                                                  ×
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Delete entity?
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will remove this entity from the county
                                                    container. This does not change any user roles
                                                    or permissions.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() =>
                                                      deleteEntityMutation.mutate(entity.id)
                                                    }
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
                              <div className="text-xs text-white/60">
                                No entities stored for this county.
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </>
                  ) : (
                    <div className="text-xs text-white/60">
                      Select a county on the map or search by name/state/FIPS to view or add notes.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    {topLocations.map((location: HeatmapDataPoint, index: number) => (
                      <div
                        key={`${location.state}-${location.county}`}
                        className="flex items-center justify-between p-3 bg-white/10 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-ts-orange rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white">
                              {location.county}, {location.state}
                            </h4>
                            <p className="text-sm text-white/60">
                              {location.users} users • {location.contractors} contractors •{" "}
                              {location.homeowners} homeowners
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-ts-orange">
                            {location.interactions}
                          </p>
                          <p className="text-xs text-white/60">interactions</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {topLocations.length === 0 && (
                    <div className="text-center py-8 text-white/60">
                      <MapIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
