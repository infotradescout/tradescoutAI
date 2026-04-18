import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { AlertCircle } from "lucide-react";
import { ErrorState, SkeletonTable } from "@/components/ui/states";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";

export type CountyCoverageStatus = "unassigned" | "partial" | "full";

interface CountyCoverageRow {
  countyFips: string;
  countyName: string;
  stateCode: string;
  coverageStatus: CountyCoverageStatus;
  territoryManagerCount: number;
  affiliateCount: number;
  lastEntityChangeAt: string | null;
  hasNotes: boolean;
  hasOpsNote: boolean;
  hasRiskNote: boolean;
  hasPartnerNote: boolean;
  lastNoteAt: string | null;
}

interface CountyCoverageSummaryResponse {
  ok: true;
  totalCounties: number;
  unassignedCounties: number;
  partiallyCoveredCounties: number;
  fullyCoveredCounties: number;
  verifiedCoverageRatePercent: number;
  fullCoverageNewLast30: number;
  rows: CountyCoverageRow[];
}

interface CountyFolderResponse {
  county: {
    fips: string;
    countyName: string;
    stateCode: string;
    countySlugs: string[];
  };
  counts: {
    notes: number;
    entities: number;
    meetings: number;
    rsvps: number;
    interestSubmissions: number;
  };
  notes: Array<{
    id: string;
    category: string;
    content: string;
    updatedAt?: string | null;
    createdAt?: string | null;
  }>;
  entities: Array<{
    id: string;
    entityType: string;
    label?: string | null;
    status: string;
    updatedAt?: string | null;
  }>;
  meetings: Array<{
    partnerSlug: string;
    meetingId: string;
    meetingDate: string;
    timeLabel?: string | null;
    meetingCity?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    eventLabel?: string | null;
  }>;
  rsvps: Array<{
    id: string | number;
    businessName: string;
    contactName: string;
    contactEmail: string;
    attendanceStatus: string;
    meetingDate?: string | null;
    timeLabel?: string | null;
    createdAt?: string | null;
  }>;
  interestSubmissions: Array<{
    id: string | number;
    businessName: string;
    contactName: string;
    serviceCategory: string;
    createdAt?: string | null;
  }>;
}

type CoverageFilter = "all" | "unassigned" | "partial" | "full";

type NotesFilter = "any" | "ops" | "risk" | "partner";

type TerritoryFilter = "any" | "yes" | "no";

type AffiliateEntityType = "affiliate" | "partner";

interface AdminUserSummary {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  roles?: string[] | null;
}

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const GEO_ADMIN_SCRIPT_ID = "ts-google-maps-admin-geo-script";

function normalizeCoverageMarkerIcon(status: CountyCoverageStatus): string {
  if (status === "full") return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
  if (status === "partial") return "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
  return "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
}

async function fetchAdminGoogleMapsKey(): Promise<string> {
  const response = await fetch(`/api/public-config?_=${Date.now()}`, {
    method: "GET",
    credentials: "omit",
    headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    cache: "no-store",
  });
  if (!response.ok) return "";
  const payload = (await response.json()) as any;
  return String(payload?.googleMapsApiKey || "").trim();
}

async function loadAdminGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.google?.maps) return;

  const existing = document.getElementById(GEO_ADMIN_SCRIPT_ID) as HTMLScriptElement | null;
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
    script.id = GEO_ADMIN_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export default function AdminGeoCoverageConsole() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerByFipsRef = useRef<Record<string, any>>({});
  const geocoderRef = useRef<any>(null);

  const [location, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [stateFilter, setStateFilter] = useState<string | "all">("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [notesFilter, setNotesFilter] = useState<NotesFilter>("any");
  const [territoryFilter, setTerritoryFilter] = useState<TerritoryFilter>("any");
  const [selectedCountyFips, setSelectedCountyFips] = useState<string>("");
  const [assignCounty, setAssignCounty] = useState<CountyCoverageRow | null>(null);
  const [tmSearch, setTmSearch] = useState("");
  const [selectedTmId, setSelectedTmId] = useState<string>("");
  const [assignAffiliateCounty, setAssignAffiliateCounty] = useState<CountyCoverageRow | null>(
    null
  );
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [selectedAffiliateUserId, setSelectedAffiliateUserId] = useState<string>("");
  const [affiliateEntityType, setAffiliateEntityType] = useState<AffiliateEntityType>("affiliate");
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [countyCentersByFips, setCountyCentersByFips] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  const queryClient = useQueryClient() || globalQueryClient;
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fips = params.get("fips");
    const view = params.get("view");

    if (view === "map") {
      setViewMode("map");
    }

    if (fips) {
      setSelectedCountyFips(fips);
    }
  }, [location]);

  const { data, isLoading, error } = useQuery<CountyCoverageSummaryResponse>({
    queryKey: ["/api/admin/geo/coverage"],
    queryFn: async () => {
      return apiRequest("/api/admin/geo/coverage");
    },
    staleTime: 5 * 60 * 1000,
  });

  const allRows = data?.rows || [];

  const stateOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const row of allRows) {
      if (row.stateCode) codes.add(row.stateCode);
    }
    return Array.from(codes).sort();
  }, [allRows]);

  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      if (stateFilter !== "all" && row.stateCode !== stateFilter) return false;

      if (coverageFilter !== "all" && row.coverageStatus !== coverageFilter) return false;

      if (territoryFilter === "yes" && row.territoryManagerCount <= 0) return false;
      if (territoryFilter === "no" && row.territoryManagerCount > 0) return false;

      if (notesFilter === "ops" && !row.hasOpsNote) return false;
      if (notesFilter === "risk" && !row.hasRiskNote) return false;
      if (notesFilter === "partner" && !row.hasPartnerNote) return false;

      return true;
    });
  }, [allRows, stateFilter, coverageFilter, notesFilter, territoryFilter]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedCountyFips("");
      return;
    }
    if (!selectedCountyFips || !filteredRows.some((row) => row.countyFips === selectedCountyFips)) {
      setSelectedCountyFips(filteredRows[0].countyFips);
    }
  }, [filteredRows, selectedCountyFips]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    if (viewMode === "map") {
      params.set("view", "map");
    } else {
      params.delete("view");
    }

    if (selectedCountyFips) {
      params.set("fips", selectedCountyFips);
    } else {
      params.delete("fips");
    }

    const next = params.toString();
    const target = next ? `/admin/geo/counties?${next}` : "/admin/geo/counties";
    if (location !== target) {
      navigate(target, { replace: true });
    }
  }, [location, navigate, selectedCountyFips, viewMode]);

  const selectedCounty = useMemo(
    () => filteredRows.find((row) => row.countyFips === selectedCountyFips) || null,
    [filteredRows, selectedCountyFips]
  );

  useEffect(() => {
    if (viewMode !== "map") return;
    let cancelled = false;

    fetchAdminGoogleMapsKey()
      .then(async (key) => {
        if (!key) throw new Error("Missing Google Maps API key");
        await loadAdminGoogleMapsScript(key);
        if (cancelled) return;
        setMapsReady(true);
        setMapsError("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to initialize Google Maps";
        setMapsError(message);
        setMapsReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !mapContainerRef.current) return;
    if (mapRef.current) return;

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
    });
    geocoderRef.current = new window.google.maps.Geocoder();
  }, [mapsReady, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !geocoderRef.current) return;

    const missing = filteredRows
      .slice(0, 180)
      .filter((row) => !countyCentersByFips[row.countyFips])
      .slice(0, 24);

    if (missing.length === 0) return;

    let cancelled = false;

    const geocodeCounty = async (row: CountyCoverageRow) => {
      return await new Promise<{ fips: string; lat: number; lng: number } | null>((resolve) => {
        const query = `${row.countyName} County, ${row.stateCode}, USA`;
        geocoderRef.current.geocode({ address: query }, (results: any[], status: string) => {
          if (status !== "OK" || !Array.isArray(results) || !results[0]?.geometry?.location) {
            resolve(null);
            return;
          }
          const location = results[0].geometry.location;
          resolve({
            fips: row.countyFips,
            lat: Number(location.lat?.()),
            lng: Number(location.lng?.()),
          });
        });
      });
    };

    (async () => {
      const resolved = await Promise.all(missing.map((row) => geocodeCounty(row)));
      if (cancelled) return;

      const next: Record<string, { lat: number; lng: number }> = {};
      for (const item of resolved) {
        if (!item) continue;
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
        next[item.fips] = { lat: item.lat, lng: item.lng };
      }

      if (Object.keys(next).length === 0) return;
      setCountyCentersByFips((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [countyCentersByFips, filteredRows, mapsReady, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !mapRef.current) return;

    Object.values(markerByFipsRef.current).forEach((marker) => marker.setMap(null));
    markerByFipsRef.current = {};

    const bounds = new window.google.maps.LatLngBounds();

    for (const row of filteredRows.slice(0, 180)) {
      const center = countyCentersByFips[row.countyFips];
      if (!center) continue;

      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: center,
        title: `${row.countyName}, ${row.stateCode}`,
        icon: normalizeCoverageMarkerIcon(row.coverageStatus),
      });

      marker.addListener("click", () => setSelectedCountyFips(row.countyFips));
      markerByFipsRef.current[row.countyFips] = marker;
      bounds.extend(center);
    }

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 36);
    }
  }, [countyCentersByFips, filteredRows, mapsReady, viewMode]);

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !selectedCountyFips) return;
    const center = countyCentersByFips[selectedCountyFips];
    if (!center) return;
    mapRef.current.panTo(center);
    if (typeof mapRef.current.getZoom === "function" && mapRef.current.getZoom() < 7) {
      mapRef.current.setZoom(7);
    }
  }, [countyCentersByFips, mapsReady, selectedCountyFips]);

  const { data: countyFolder, isLoading: countyFolderLoading } = useQuery<CountyFolderResponse>({
    queryKey: ["/api/admin/geo/counties/folder", selectedCountyFips],
    queryFn: async () => apiRequest(`/api/admin/geo/counties/${selectedCountyFips}/folder`),
    enabled: viewMode === "map" && Boolean(selectedCountyFips),
    staleTime: 60_000,
  });

  const coverageRateLabel = `${data ? data.verifiedCoverageRatePercent.toFixed(1) : "0.0"}%`;

  const seedCounties = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/geo/seed-counties", {}),
    onSuccess: (payload: any) => {
      toast({
        title: "Seed complete",
        description: `Inserted ${payload?.insertedStates || 0} states and ${payload?.insertedCounties || 0} counties.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
    onError: (err: any) => {
      toast({
        title: "Seed failed",
        description: formatUserFacingErrorMessage(err, "Unable to seed counties."),
        variant: "destructive",
      });
    },
  });

  const isAssignTmDialogOpen = !!assignCounty;
  const isAssignAffiliateDialogOpen = !!assignAffiliateCounty;

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<AdminUserSummary[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      return apiRequest("/api/admin/users");
    },
    enabled: isAssignTmDialogOpen || isAssignAffiliateDialogOpen,
    staleTime: 5 * 60 * 1000,
  });

  const territoryManagers = useMemo(() => {
    const usersArray = allUsers || [];
    const lowerSearch = tmSearch.toLowerCase();
    return usersArray
      .filter((user) => {
        const roles =
          user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : [];
        const hasTmRole = roles.some((r) => r === "territory_manager");
        if (!hasTmRole) return false;

        if (!lowerSearch) return true;
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        return (
          user.email.toLowerCase().includes(lowerSearch) || name.toLowerCase().includes(lowerSearch)
        );
      })
      .sort((a, b) => {
        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [allUsers, tmSearch]);

  const assignTerritoryManager = useMutation({
    mutationFn: async ({ countyFips, userId }: { countyFips: string; userId: string }) => {
      return apiRequest("POST", `/api/admin/geo/counties/${countyFips}/entities`, {
        entityType: "territory_manager",
        entityId: userId,
        status: "active",
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Territory manager assigned",
        description: `Assigned a territory manager to county ${variables.countyFips}.`,
      });
      setAssignCounty(null);
      setSelectedTmId("");
      setTmSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
    onError: (err: any) => {
      toast({
        title: "Assignment failed",
        description: formatUserFacingErrorMessage(err, "Unable to assign territory manager."),
        variant: "destructive",
      });
    },
  });

  const affiliateUsers = useMemo(() => {
    const usersArray = allUsers || [];
    const lowerSearch = affiliateSearch.toLowerCase();
    return usersArray
      .filter((user) => {
        const roles =
          user.roles && user.roles.length > 0 ? user.roles : user.role ? [user.role] : [];
        const hasAffiliateRole = roles.some((r) => r === "affiliate");
        if (!hasAffiliateRole) return false;

        if (!lowerSearch) return true;
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        return (
          user.email.toLowerCase().includes(lowerSearch) || name.toLowerCase().includes(lowerSearch)
        );
      })
      .sort((a, b) => {
        const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
        const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [allUsers, affiliateSearch]);

  const assignAffiliateOrPartner = useMutation({
    mutationFn: async ({
      countyFips,
      userId,
      entityType,
    }: {
      countyFips: string;
      userId: string;
      entityType: AffiliateEntityType;
    }) => {
      return apiRequest("POST", `/api/admin/geo/counties/${countyFips}/entities`, {
        entityType,
        entityId: userId,
        status: "active",
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Coverage entity added",
        description: `Assigned a ${variables.entityType} to county ${variables.countyFips}.`,
      });
      setAssignAffiliateCounty(null);
      setSelectedAffiliateUserId("");
      setAffiliateSearch("");
      setAffiliateEntityType("affiliate");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
    onError: (err: any) => {
      toast({
        title: "Assignment failed",
        description: formatUserFacingErrorMessage(err, "Unable to assign affiliate or partner."),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-white">County Coverage Console</h1>
          <p className="text-xs text-white/60 max-w-xl">
            Operational view of TradeScout coverage across U.S. counties. "Verified Coverage Rate"
            reflects counties with both an active territory manager and an active affiliate or
            partner mapped in the geographic storage layer.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>View:</span>
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as "list" | "map")}
            className="h-8"
          >
            <TabsList className="h-8">
              <TabsTrigger value="list" className="px-3 h-8 text-xs">
                List
              </TabsTrigger>
              <TabsTrigger value="map" className="px-3 h-8 text-xs">
                Map
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-black/30 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-white/70">Verified Coverage Rate</CardTitle>
            <CardDescription className="text-[11px] text-white/60">
              Fully covered counties ÷ total counties
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-white">{coverageRateLabel}</span>
            <span className="text-[11px] text-white/60">full coverage</span>
          </CardContent>
        </Card>

        <Card className="bg-black/30 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-white/70">Unassigned counties</CardTitle>
            <CardDescription className="text-[11px] text-white/60">
              No TM, no affiliate
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-white">
              {data?.unassignedCounties ?? "-"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/30 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-white/70">Partially covered</CardTitle>
            <CardDescription className="text-[11px] text-white/60">
              Only TM or affiliate
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold text-white">
              {data?.partiallyCoveredCounties ?? "-"}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/30 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-white/70">Fully covered</CardTitle>
            <CardDescription className="text-[11px] text-white/60">
              TM + affiliate present
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-white">
                {data?.fullyCoveredCounties ?? "-"}
              </div>
              <div className="text-[11px] text-emerald-400">
                +{data?.fullCoverageNewLast30 ?? 0} in last 30 days
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data && data.totalCounties < 3000 && (
        <Card className="bg-black/30 border-white/10">
          <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs text-white/70">
              County table looks incomplete (<span className="font-mono">{data.totalCounties}</span>
              ). Seed the full built-in county dataset so coverage tooling can represent every
              county.
            </div>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => seedCounties.mutate()}
              disabled={seedCounties.isPending}
            >
              {seedCounties.isPending ? "Seeding…" : "Seed counties"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="bg-black/30 border-white/10">
        <CardHeader className="pb-2 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <CardTitle className="text-sm text-white">Coverage by county</CardTitle>
            <CardDescription className="text-[11px] text-white/60">
              Filters apply to both list and map views.
            </CardDescription>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px] w-full md:w-auto">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-white/60">State</span>
              <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as any)}>
                <SelectTrigger className="h-8 w-full sm:w-[110px] text-[11px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {stateOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-white/60">Coverage</span>
              <Select
                value={coverageFilter}
                onValueChange={(v) => setCoverageFilter(v as CoverageFilter)}
              >
                <SelectTrigger className="h-8 w-full sm:w-[130px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-white/60">Notes</span>
              <Select value={notesFilter} onValueChange={(v) => setNotesFilter(v as NotesFilter)}>
                <SelectTrigger className="h-8 w-full sm:w-[120px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="ops">Ops</SelectItem>
                  <SelectItem value="risk">Risk</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-white/60">TM assigned</span>
              <Select
                value={territoryFilter}
                onValueChange={(v) => setTerritoryFilter(v as TerritoryFilter)}
              >
                <SelectTrigger className="h-8 w-full sm:w-[120px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading && <SkeletonTable rows={8} />}
          {error && !isLoading && (
            <ErrorState
              icon={<AlertCircle />}
              title="Failed to Load Coverage"
              description="Unable to fetch county data. Please refresh the page."
            />
          )}

          {!isLoading && !error && viewMode === "list" && (
            <>
              <div className="md:hidden space-y-2">
                {filteredRows.map((row) => (
                  <div
                    key={row.countyFips}
                    className="rounded-md border border-white/10 bg-black/30 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium text-white">
                          {row.countyName}, {row.stateCode}
                        </div>
                        <div className="text-[11px] text-white/60">FIPS {row.countyFips}</div>
                      </div>
                      <CoverageBadge status={row.coverageStatus} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded border border-white/10 bg-white/5 px-2 py-2">
                        <div className="text-white/50">Territory managers</div>
                        <div className="text-sm font-medium text-white">
                          {row.territoryManagerCount}
                        </div>
                      </div>
                      <div className="rounded border border-white/10 bg-white/5 px-2 py-2">
                        <div className="text-white/50">Affiliates / partners</div>
                        <div className="text-sm font-medium text-white">{row.affiliateCount}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.hasOpsNote && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/70 text-amber-400 px-1.5 py-0 text-[10px]"
                        >
                          Ops
                        </Badge>
                      )}
                      {row.hasRiskNote && (
                        <Badge
                          variant="outline"
                          className="border-red-500/70 text-red-400 px-1.5 py-0 text-[10px]"
                        >
                          Risk
                        </Badge>
                      )}
                      {row.hasPartnerNote && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/70 text-emerald-400 px-1.5 py-0 text-[10px]"
                        >
                          Partner
                        </Badge>
                      )}
                      {!row.hasNotes && <span className="text-[11px] text-white/60">No notes</span>}
                    </div>
                    <div className="text-[11px] text-white/60">
                      Last change:{" "}
                      {row.lastEntityChangeAt
                        ? new Date(row.lastEntityChangeAt).toLocaleDateString()
                        : "—"}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => {
                          setAssignCounty(row);
                          setSelectedTmId("");
                          setTmSearch("");
                        }}
                      >
                        Assign TM
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 text-[11px]"
                        onClick={() => {
                          setAssignAffiliateCounty(row);
                          setSelectedAffiliateUserId("");
                          setAffiliateSearch("");
                          setAffiliateEntityType("affiliate");
                        }}
                      >
                        Assign affiliate / partner
                      </Button>
                      <Link href={`/admin/geo/counties?view=map&fips=${row.countyFips}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-full px-2 text-[11px] text-white/70"
                        >
                          Open county detail
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
                {filteredRows.length === 0 && (
                  <div className="rounded-md border border-white/10 bg-black/30 px-3 py-6 text-center text-[11px] text-white/60">
                    No counties match the current filters.
                  </div>
                )}
              </div>

              <ScrollArea className="hidden md:block h-[480px] border border-white/10 rounded-md bg-black/30">
                <table className="w-full text-xs">
                  <thead className="bg-tsCard/95 text-white/60">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">County</th>
                      <th className="px-3 py-2 text-left font-medium">Coverage</th>
                      <th className="px-3 py-2 text-left font-medium">Territory managers</th>
                      <th className="px-3 py-2 text-left font-medium">Affiliates / partners</th>
                      <th className="px-3 py-2 text-left font-medium">Notes</th>
                      <th className="px-3 py-2 text-left font-medium">Last change</th>
                      <th className="px-3 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr
                        key={row.countyFips}
                        className="border-t border-white/10 hover:bg-tsCard/95"
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-white">
                            {row.countyName}
                            <span className="ml-1 text-[11px] text-white/60">
                              ({row.stateCode})
                            </span>
                          </div>
                          <div className="text-[11px] text-white/60">FIPS {row.countyFips}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <CoverageBadge status={row.coverageStatus} />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-white">{row.territoryManagerCount}</div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="text-white">{row.affiliateCount}</div>
                        </td>
                        <td className="px-3 py-2 align-top space-y-1">
                          {row.hasOpsNote && (
                            <Badge
                              variant="outline"
                              className="border-amber-500/70 text-amber-400 px-1.5 py-0 text-[10px]"
                            >
                              Ops
                            </Badge>
                          )}
                          {row.hasRiskNote && (
                            <Badge
                              variant="outline"
                              className="border-red-500/70 text-red-400 px-1.5 py-0 text-[10px]"
                            >
                              Risk
                            </Badge>
                          )}
                          {row.hasPartnerNote && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/70 text-emerald-400 px-1.5 py-0 text-[10px]"
                            >
                              Partner
                            </Badge>
                          )}
                          {!row.hasNotes && (
                            <span className="text-[11px] text-white/60">No notes</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-[11px] text-white/60">
                          {row.lastEntityChangeAt
                            ? new Date(row.lastEntityChangeAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => {
                                setAssignCounty(row);
                                setSelectedTmId("");
                                setTmSearch("");
                              }}
                            >
                              Assign TM
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => {
                                setAssignAffiliateCounty(row);
                                setSelectedAffiliateUserId("");
                                setAffiliateSearch("");
                                setAffiliateEntityType("affiliate");
                              }}
                            >
                              Assign affiliate / partner
                            </Button>
                            <Link href={`/admin/geo/counties?view=map&fips=${row.countyFips}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px] text-white/70"
                              >
                                Open county detail
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-[11px] text-white/60">
                          No counties match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </>
          )}

          {!isLoading && !error && viewMode === "map" && (
            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 py-2 min-w-0">
              <div className="border border-white/10 rounded-md bg-black/30 md:h-[560px] max-h-[40vh] md:max-h-none overflow-auto">
                <div className="px-3 py-2 border-b border-white/10 text-[11px] text-white/60">
                  County blocks
                </div>
                {filteredRows.map((row) => {
                  const isActive = row.countyFips === selectedCountyFips;
                  return (
                    <button
                      key={row.countyFips}
                      type="button"
                      onClick={() => setSelectedCountyFips(row.countyFips)}
                      className={`w-full text-left px-3 py-2 border-b border-white/5 text-xs transition ${
                        isActive ? "bg-tsCard text-white" : "text-white/80 hover:bg-tsCard/70"
                      }`}
                    >
                      <div className="font-medium">
                        {row.countyName}, {row.stateCode}
                      </div>
                      <div className="text-[10px] text-white/60">FIPS {row.countyFips}</div>
                    </button>
                  );
                })}
              </div>

              <div className="border border-white/10 rounded-md bg-black/30 p-3 md:h-[560px] max-h-[70vh] md:max-h-none overflow-auto space-y-3 min-w-0">
                <div className="rounded border border-white/10 bg-black/20 p-2">
                  <div className="mb-2 text-[11px] text-white/60">
                    Google Maps county coverage view
                  </div>
                  {mapsError ? (
                    <div className="rounded border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200">
                      {mapsError}
                    </div>
                  ) : (
                    <div
                      ref={mapContainerRef}
                      className="h-[260px] w-full rounded border border-white/10"
                    />
                  )}
                </div>

                {!selectedCounty ? (
                  <div className="text-xs text-white/60">Choose a county to open its folder.</div>
                ) : countyFolderLoading ? (
                  <div className="text-xs text-white/60">Loading county folder...</div>
                ) : !countyFolder ? (
                  <div className="text-xs text-white/60">County folder data is unavailable.</div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                          {countyFolder.county.countyName}, {countyFolder.county.stateCode}
                        </div>
                        <div className="text-[11px] text-white/60">
                          FIPS {countyFolder.county.fips}
                        </div>
                      </div>
                      <Link href={`/admin/geo/counties?fips=${countyFolder.county.fips}`}>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          Open county detail
                        </Button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                      <MetricTile label="Notes" value={countyFolder.counts.notes} />
                      <MetricTile label="Entities" value={countyFolder.counts.entities} />
                      <MetricTile label="Meetings" value={countyFolder.counts.meetings} />
                      <MetricTile label="RSVPs" value={countyFolder.counts.rsvps} />
                      <MetricTile
                        label="Interest"
                        value={countyFolder.counts.interestSubmissions}
                      />
                    </div>

                    <FolderSection title="On-site dates">
                      {countyFolder.meetings.length === 0 ? (
                        <div className="text-[11px] text-white/60">
                          No meeting dates in this county yet.
                        </div>
                      ) : (
                        countyFolder.meetings.slice(0, 10).map((meeting) => (
                          <div
                            key={`${meeting.partnerSlug}-${meeting.meetingId}`}
                            className="text-[11px] text-white/80 border-b border-white/5 py-1"
                          >
                            <div className="font-medium">
                              {meeting.meetingDate} {meeting.timeLabel || ""}
                            </div>
                            <div>{meeting.meetingCity || ""}</div>
                            <div className="text-white/60">
                              {meeting.addressLine1 || ""} {meeting.addressLine2 || ""}
                            </div>
                          </div>
                        ))
                      )}
                    </FolderSection>

                    <FolderSection title="RSVP tracker">
                      {countyFolder.rsvps.length === 0 ? (
                        <div className="text-[11px] text-white/60">No RSVPs recorded.</div>
                      ) : (
                        countyFolder.rsvps.slice(0, 12).map((rsvp) => (
                          <div
                            key={String(rsvp.id)}
                            className="text-[11px] text-white/80 border-b border-white/5 py-1"
                          >
                            <div className="font-medium">{rsvp.businessName}</div>
                            <div>
                              {rsvp.contactName} • {rsvp.contactEmail}
                            </div>
                            <div className="text-white/60">
                              {rsvp.meetingDate || ""} {rsvp.timeLabel || ""} •{" "}
                              {rsvp.attendanceStatus}
                            </div>
                          </div>
                        ))
                      )}
                    </FolderSection>

                    <FolderSection title="County notes">
                      {countyFolder.notes.length === 0 ? (
                        <div className="text-[11px] text-white/60">No county notes.</div>
                      ) : (
                        countyFolder.notes.slice(0, 8).map((note) => (
                          <div
                            key={note.id}
                            className="text-[11px] text-white/80 border-b border-white/5 py-1"
                          >
                            <div className="uppercase tracking-wide text-[10px] text-white/60">
                              {note.category}
                            </div>
                            <div className="whitespace-pre-wrap">{note.content}</div>
                          </div>
                        ))
                      )}
                    </FolderSection>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isAssignTmDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignCounty(null);
            setSelectedTmId("");
            setTmSearch("");
          }
        }}
      >
        <DialogContent className="bg-tsBg border-white/10 max-w-md text-white">
          <DialogHeader>
            <DialogTitle className="text-sm text-white">Assign Territory Manager</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Select a user with the Territory Manager role to map into the geographic storage layer
              for this county.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {assignCounty && (
              <div className="text-xs text-white/70">
                <div className="font-medium">
                  {assignCounty.countyName}{" "}
                  <span className="text-white/60">({assignCounty.stateCode})</span>
                </div>
                <div className="text-white/60">FIPS {assignCounty.countyFips}</div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-white/60">Search territory managers</span>
              <Input
                value={tmSearch}
                onChange={(e) => setTmSearch(e.target.value)}
                placeholder="Search by name or email"
                className="h-8 text-xs bg-tsCard/95 border-white/10"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/60">Select territory manager</span>
              <Select
                value={selectedTmId}
                onValueChange={(value) => setSelectedTmId(value)}
                disabled={usersLoading || territoryManagers.length === 0}
              >
                <SelectTrigger className="h-8 text-xs bg-tsCard/95 border-white/10">
                  <SelectValue
                    placeholder={usersLoading ? "Loading users…" : "Choose a territory manager"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {territoryManagers.map((user) => {
                    const name =
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
                    return (
                      <SelectItem key={user.id} value={user.id} className="text-xs">
                        <div className="flex flex-col">
                          <span>{name}</span>
                          <span className="text-[10px] text-white/60">{user.email}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {territoryManagers.length === 0 && !usersLoading && (
                    <div className="px-3 py-2 text-[11px] text-white/60">
                      No users with the Territory Manager role were found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setAssignCounty(null);
                setSelectedTmId("");
                setTmSearch("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!assignCounty || !selectedTmId || assignTerritoryManager.isPending}
              onClick={() => {
                if (!assignCounty || !selectedTmId) return;
                assignTerritoryManager.mutate({
                  countyFips: assignCounty.countyFips,
                  userId: selectedTmId,
                });
              }}
            >
              {assignTerritoryManager.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isAssignAffiliateDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignAffiliateCounty(null);
            setSelectedAffiliateUserId("");
            setAffiliateSearch("");
            setAffiliateEntityType("affiliate");
          }
        }}
      >
        <DialogContent className="bg-tsBg border-white/10 max-w-md text-white">
          <DialogHeader>
            <DialogTitle className="text-sm text-white">Assign Affiliate / Partner</DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Select a user with the Affiliate role to map into the geographic storage layer for
              this county, as either an affiliate or a partner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {assignAffiliateCounty && (
              <div className="text-xs text-white/70">
                <div className="font-medium">
                  {assignAffiliateCounty.countyName}{" "}
                  <span className="text-white/60">({assignAffiliateCounty.stateCode})</span>
                </div>
                <div className="text-white/60">FIPS {assignAffiliateCounty.countyFips}</div>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] text-white/60">Entity type</span>
              <Select
                value={affiliateEntityType}
                onValueChange={(value) => setAffiliateEntityType(value as AffiliateEntityType)}
              >
                <SelectTrigger className="h-8 text-xs bg-tsCard/95 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Affiliate</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/60">Search affiliates</span>
              <Input
                value={affiliateSearch}
                onChange={(e) => setAffiliateSearch(e.target.value)}
                placeholder="Search by name or email"
                className="h-8 text-xs bg-tsCard/95 border-white/10"
              />
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/60">Select affiliate</span>
              <Select
                value={selectedAffiliateUserId}
                onValueChange={(value) => setSelectedAffiliateUserId(value)}
                disabled={usersLoading || affiliateUsers.length === 0}
              >
                <SelectTrigger className="h-8 text-xs bg-tsCard/95 border-white/10">
                  <SelectValue
                    placeholder={usersLoading ? "Loading users…" : "Choose an affiliate user"}
                  />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {affiliateUsers.map((user) => {
                    const name =
                      `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
                    return (
                      <SelectItem key={user.id} value={user.id} className="text-xs">
                        <div className="flex flex-col">
                          <span>{name}</span>
                          <span className="text-[10px] text-white/60">{user.email}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {affiliateUsers.length === 0 && !usersLoading && (
                    <div className="px-3 py-2 text-[11px] text-white/60">
                      No users with the Affiliate role were found.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setAssignAffiliateCounty(null);
                setSelectedAffiliateUserId("");
                setAffiliateSearch("");
                setAffiliateEntityType("affiliate");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={
                !assignAffiliateCounty ||
                !selectedAffiliateUserId ||
                assignAffiliateOrPartner.isPending
              }
              onClick={() => {
                if (!assignAffiliateCounty || !selectedAffiliateUserId) return;
                assignAffiliateOrPartner.mutate({
                  countyFips: assignAffiliateCounty.countyFips,
                  userId: selectedAffiliateUserId,
                  entityType: affiliateEntityType,
                });
              }}
            >
              {assignAffiliateOrPartner.isPending ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function FolderSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-2">
      <div className="text-[11px] font-semibold text-white mb-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CoverageBadge({ status }: { status: CountyCoverageStatus }) {
  if (status === "full") {
    return (
      <Badge className="bg-emerald-600/80 text-emerald-50 border-emerald-500/80 px-2 py-0.5 text-[11px]">
        Full
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/80 text-amber-300 px-2 py-0.5 text-[11px]"
      >
        Partial
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-red-500/80 text-red-300 px-2 py-0.5 text-[11px]">
      Unassigned
    </Badge>
  );
}
