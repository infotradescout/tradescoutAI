import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, MapPinned, RefreshCw, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useLocation } from "wouter";
import {
  AdminEmptyState,
  AdminList,
  AdminSection,
  AdminSummaryStrip,
  AdminToolbar,
  AdminWorkspace,
  AdminWorkspaceSubnav,
} from "@/admin/AdminWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

export type CountyCoverageStatus = "unassigned" | "partial" | "full";

type CountyCoverageRow = {
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
};

type CountyCoverageSummaryResponse = {
  ok: true;
  totalCounties: number;
  unassignedCounties: number;
  partiallyCoveredCounties: number;
  fullyCoveredCounties: number;
  verifiedCoverageRatePercent: number;
  fullCoverageNewLast30: number;
  rows: CountyCoverageRow[];
};

type CountyFolderResponse = {
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
};

type CoverageFilter = "all" | "unassigned" | "partial" | "full";
type NotesFilter = "any" | "ops" | "risk" | "partner";
type TerritoryFilter = "any" | "yes" | "no";
type AffiliateEntityType = "affiliate" | "partner";

type AdminUserSummary = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  roles?: string[] | null;
};

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

const GEO_ADMIN_SCRIPT_ID = "ts-google-maps-admin-geo-script";

function markerIcon(status: CountyCoverageStatus): string {
  if (status === "full") return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
  if (status === "partial") return "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
  return "https://maps.google.com/mapfiles/ms/icons/red-dot.png";
}

function readable(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "Not recorded";
  return text.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: unknown): string {
  if (!value) return "Not recorded";
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Invalid date";
}

function userLabel(user: AdminUserSummary): string {
  return `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email;
}

function userRoles(user: AdminUserSummary): string[] {
  if (Array.isArray(user.roles) && user.roles.length) return user.roles;
  return user.role ? [user.role] : [];
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [location, navigate] = useLocation();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerByFipsRef = useRef<Record<string, any>>({});
  const geocoderRef = useRef<any>(null);

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [notesFilter, setNotesFilter] = useState<NotesFilter>("any");
  const [territoryFilter, setTerritoryFilter] = useState<TerritoryFilter>("any");
  const [selectedCountyFips, setSelectedCountyFips] = useState("");

  const [assignCounty, setAssignCounty] = useState<CountyCoverageRow | null>(null);
  const [tmSearch, setTmSearch] = useState("");
  const [selectedTmId, setSelectedTmId] = useState("");

  const [assignAffiliateCounty, setAssignAffiliateCounty] = useState<CountyCoverageRow | null>(
    null
  );
  const [affiliateSearch, setAffiliateSearch] = useState("");
  const [selectedAffiliateUserId, setSelectedAffiliateUserId] = useState("");
  const [affiliateEntityType, setAffiliateEntityType] =
    useState<AffiliateEntityType>("affiliate");

  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState("");
  const [countyCentersByFips, setCountyCentersByFips] = useState<
    Record<string, { lat: number; lng: number }>
  >({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setViewMode(params.get("view") === "map" ? "map" : "list");
    const fips = params.get("fips");
    if (fips) setSelectedCountyFips(fips);
  }, [location]);

  const coverageQuery = useQuery<CountyCoverageSummaryResponse>({
    queryKey: ["/api/admin/geo/coverage"],
    queryFn: () =>
      apiRequest("GET", "/api/admin/geo/coverage") as Promise<CountyCoverageSummaryResponse>,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const allRows = coverageQuery.data?.rows || [];
  const stateOptions = useMemo(
    () => Array.from(new Set(allRows.map((row) => row.stateCode).filter(Boolean))).sort(),
    [allRows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (stateFilter !== "all" && row.stateCode !== stateFilter) return false;
      if (coverageFilter !== "all" && row.coverageStatus !== coverageFilter) return false;
      if (territoryFilter === "yes" && row.territoryManagerCount <= 0) return false;
      if (territoryFilter === "no" && row.territoryManagerCount > 0) return false;
      if (notesFilter === "ops" && !row.hasOpsNote) return false;
      if (notesFilter === "risk" && !row.hasRiskNote) return false;
      if (notesFilter === "partner" && !row.hasPartnerNote) return false;
      if (
        query &&
        !`${row.countyName} ${row.stateCode} ${row.countyFips}`.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [allRows, coverageFilter, notesFilter, search, stateFilter, territoryFilter]);

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
    if (viewMode === "map") params.set("view", "map");
    else params.delete("view");
    if (selectedCountyFips) params.set("fips", selectedCountyFips);
    else params.delete("fips");

    const query = params.toString();
    const target = query ? `/admin/geo/counties?${query}` : "/admin/geo/counties";
    if (location !== target) navigate(target, { replace: true });
  }, [location, navigate, selectedCountyFips, viewMode]);

  const selectedCounty = useMemo(
    () => allRows.find((row) => row.countyFips === selectedCountyFips) || null,
    [allRows, selectedCountyFips]
  );

  const folderQuery = useQuery<CountyFolderResponse>({
    queryKey: ["/api/admin/geo/counties/folder", selectedCountyFips],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/admin/geo/counties/${selectedCountyFips}/folder`
      ) as Promise<CountyFolderResponse>,
    enabled: Boolean(selectedCountyFips),
    staleTime: 60_000,
    retry: false,
  });

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
        setMapsReady(false);
        setMapsError(error instanceof Error ? error.message : "Failed to initialize Google Maps");
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !mapContainerRef.current) return;
    if (mapRef.current) return;
    const google = window.google;
    if (!google?.maps) return;

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 39.8283, lng: -98.5795 },
      zoom: 4,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
    });
    geocoderRef.current = new google.maps.Geocoder();
  }, [mapsReady, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !geocoderRef.current) return;
    const missing = filteredRows
      .slice(0, 180)
      .filter((row) => !countyCentersByFips[row.countyFips])
      .slice(0, 24);
    if (!missing.length) return;

    let cancelled = false;
    const geocode = (row: CountyCoverageRow) =>
      new Promise<{ fips: string; lat: number; lng: number } | null>((resolve) => {
        geocoderRef.current.geocode(
          { address: `${row.countyName} County, ${row.stateCode}, USA` },
          (results: any[], status: string) => {
            if (status !== "OK" || !results?.[0]?.geometry?.location) {
              resolve(null);
              return;
            }
            const point = results[0].geometry.location;
            resolve({
              fips: row.countyFips,
              lat: Number(point.lat?.()),
              lng: Number(point.lng?.()),
            });
          }
        );
      });

    Promise.all(missing.map(geocode)).then((resolved) => {
      if (cancelled) return;
      const next: Record<string, { lat: number; lng: number }> = {};
      for (const item of resolved) {
        if (!item || !Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
        next[item.fips] = { lat: item.lat, lng: item.lng };
      }
      if (Object.keys(next).length) {
        setCountyCentersByFips((current) => ({ ...current, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [countyCentersByFips, filteredRows, mapsReady, viewMode]);

  useEffect(() => {
    if (viewMode !== "map" || !mapsReady || !mapRef.current) return;
    const google = window.google;
    if (!google?.maps) return;

    Object.values(markerByFipsRef.current).forEach((marker) => marker.setMap(null));
    markerByFipsRef.current = {};
    const bounds = new google.maps.LatLngBounds();

    for (const row of filteredRows.slice(0, 180)) {
      const center = countyCentersByFips[row.countyFips];
      if (!center) continue;
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position: center,
        title: `${row.countyName}, ${row.stateCode}`,
        icon: markerIcon(row.coverageStatus),
      });
      marker.addListener("click", () => setSelectedCountyFips(row.countyFips));
      markerByFipsRef.current[row.countyFips] = marker;
      bounds.extend(center);
    }

    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 36);
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

  const seedMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/geo/seed-counties", {}),
    onSuccess: (payload: any) => {
      toast({
        title: "County seed complete",
        description: `Inserted ${payload?.insertedStates || 0} states and ${payload?.insertedCounties || 0} counties.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
    },
    onError: (error: unknown) => {
      toast({
        title: "County seed failed",
        description: formatUserFacingErrorMessage(error, "Unable to seed counties."),
        variant: "destructive",
      });
    },
  });

  const assignmentDialogOpen = Boolean(assignCounty || assignAffiliateCounty);
  const usersQuery = useQuery<AdminUserSummary[]>({
    queryKey: ["/api/admin/users"],
    queryFn: () => apiRequest("GET", "/api/admin/users") as Promise<AdminUserSummary[]>,
    enabled: assignmentDialogOpen,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const territoryManagers = useMemo(() => {
    const query = tmSearch.trim().toLowerCase();
    return (usersQuery.data || [])
      .filter((user) => userRoles(user).includes("territory_manager"))
      .filter((user) => !query || `${userLabel(user)} ${user.email}`.toLowerCase().includes(query))
      .sort((left, right) => userLabel(left).localeCompare(userLabel(right)));
  }, [tmSearch, usersQuery.data]);

  const affiliates = useMemo(() => {
    const query = affiliateSearch.trim().toLowerCase();
    return (usersQuery.data || [])
      .filter((user) => userRoles(user).includes("affiliate"))
      .filter((user) => !query || `${userLabel(user)} ${user.email}`.toLowerCase().includes(query))
      .sort((left, right) => userLabel(left).localeCompare(userLabel(right)));
  }, [affiliateSearch, usersQuery.data]);

  const assignTerritoryManager = useMutation({
    mutationFn: ({ countyFips, userId }: { countyFips: string; userId: string }) =>
      apiRequest("POST", `/api/admin/geo/counties/${countyFips}/entities`, {
        entityType: "territory_manager",
        entityId: userId,
        status: "active",
      }),
    onSuccess: (_payload, variables) => {
      toast({
        title: "Territory manager assigned",
        description: `County ${variables.countyFips} now includes the selected territory manager.`,
      });
      setAssignCounty(null);
      setSelectedTmId("");
      setTmSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/geo/counties/folder", variables.countyFips],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Assignment failed",
        description: formatUserFacingErrorMessage(error, "Unable to assign territory manager."),
        variant: "destructive",
      });
    },
  });

  const assignAffiliateOrPartner = useMutation({
    mutationFn: ({
      countyFips,
      userId,
      entityType,
    }: {
      countyFips: string;
      userId: string;
      entityType: AffiliateEntityType;
    }) =>
      apiRequest("POST", `/api/admin/geo/counties/${countyFips}/entities`, {
        entityType,
        entityId: userId,
        status: "active",
      }),
    onSuccess: (_payload, variables) => {
      toast({
        title: "Coverage entity assigned",
        description: `County ${variables.countyFips} now includes the selected ${variables.entityType}.`,
      });
      setAssignAffiliateCounty(null);
      setSelectedAffiliateUserId("");
      setAffiliateSearch("");
      setAffiliateEntityType("affiliate");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/geo/coverage"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/geo/counties/folder", variables.countyFips],
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Assignment failed",
        description: formatUserFacingErrorMessage(
          error,
          "Unable to assign affiliate or partner."
        ),
        variant: "destructive",
      });
    },
  });

  const openMapCounty = (row: CountyCoverageRow) => {
    setSelectedCountyFips(row.countyFips);
    setViewMode("map");
  };

  const data = coverageQuery.data;

  return (
    <AdminWorkspace data-testid="admin-county-coverage-v2">
      <AdminSection
        title="County coverage"
        description="Operating coverage across U.S. counties. Full coverage requires an active territory manager and an active affiliate or partner in the geographic storage layer."
        className="pt-0"
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => coverageQuery.refetch()}
            disabled={coverageQuery.isFetching}
            className="border-white/12 bg-transparent text-white/65"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${coverageQuery.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        }
      >
        <AdminSummaryStrip
          items={[
            {
              label: "Verified coverage",
              value: coverageQuery.isError
                ? "—"
                : `${Number(data?.verifiedCoverageRatePercent || 0).toFixed(1)}%`,
              detail: coverageQuery.isError
                ? "Coverage source unavailable"
                : `${data?.fullyCoveredCounties || 0} of ${data?.totalCounties || 0} counties`,
              tone: coverageQuery.isError ? "warning" : "neutral",
            },
            {
              label: "Unassigned",
              value: coverageQuery.isError ? "—" : data?.unassignedCounties ?? 0,
              detail: "No active territory manager or affiliate",
              tone:
                coverageQuery.isError || Number(data?.unassignedCounties || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Partial coverage",
              value: coverageQuery.isError ? "—" : data?.partiallyCoveredCounties ?? 0,
              detail: "Only one required coverage side is present",
              tone:
                coverageQuery.isError || Number(data?.partiallyCoveredCounties || 0) > 0
                  ? "warning"
                  : "good",
            },
            {
              label: "Full coverage",
              value: coverageQuery.isError ? "—" : data?.fullyCoveredCounties ?? 0,
              detail: `${data?.fullCoverageNewLast30 || 0} added in the last 30 days`,
              tone: coverageQuery.isError ? "warning" : "good",
            },
          ]}
        />
      </AdminSection>

      {data && data.totalCounties < 3000 ? (
        <div className="flex flex-col gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-4 text-sm text-amber-100 md:flex-row md:items-center md:justify-between">
          <div>
            Only {data.totalCounties} counties are stored. Seed the built-in county dataset before
            treating coverage as national.
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="bg-amber-300 text-black hover:bg-amber-200"
          >
            {seedMutation.isPending ? "Seeding…" : "Seed counties"}
          </Button>
        </div>
      ) : null}

      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "list" | "map")}>
        <AdminWorkspaceSubnav>
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0">
            <TabsTrigger
              value="list"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              Coverage List
            </TabsTrigger>
            <TabsTrigger
              value="map"
              className="min-h-10 rounded-lg border border-transparent px-4 text-white/48 data-[state=active]:border-white/10 data-[state=active]:bg-white/[0.055] data-[state=active]:text-white"
            >
              County Map & Folder
            </TabsTrigger>
          </TabsList>
        </AdminWorkspaceSubnav>

        <AdminToolbar className="mt-6">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            <div className="relative min-w-[15rem] flex-1 md:max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-white/28" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search county, state, or FIPS"
                className="border-white/10 bg-black/20 pl-10 text-white placeholder:text-white/28"
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[8rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {stateOptions.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={coverageFilter}
              onValueChange={(value) => setCoverageFilter(value as CoverageFilter)}
            >
              <SelectTrigger className="w-[11rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Coverage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All coverage</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={notesFilter}
              onValueChange={(value) => setNotesFilter(value as NotesFilter)}
            >
              <SelectTrigger className="w-[10rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Notes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any notes</SelectItem>
                <SelectItem value="ops">Ops note</SelectItem>
                <SelectItem value="risk">Risk note</SelectItem>
                <SelectItem value="partner">Partner note</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={territoryFilter}
              onValueChange={(value) => setTerritoryFilter(value as TerritoryFilter)}
            >
              <SelectTrigger className="w-[11rem] border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Territory manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any TM state</SelectItem>
                <SelectItem value="yes">TM assigned</SelectItem>
                <SelectItem value="no">No TM</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span className="text-xs text-white/35">
            {filteredRows.length} of {allRows.length} counties
          </span>
        </AdminToolbar>

        <TabsContent value="list" className="mt-4">
          <AdminSection
            title="Coverage by county"
            description="Expand a county to assign coverage or open its complete operating folder."
            className="pt-0"
          >
            {coverageQuery.isLoading ? (
              <QueueLoading label="Loading county coverage…" />
            ) : coverageQuery.isError ? (
              <QueueUnavailable label="County coverage is unavailable. No coverage assignment was changed." />
            ) : filteredRows.length ? (
              <AdminList>
                {filteredRows.map((row) => (
                  <details key={row.countyFips} className="group">
                    <summary
                      onClick={() => setSelectedCountyFips(row.countyFips)}
                      className="grid cursor-pointer list-none gap-4 px-3 py-4 transition-colors hover:bg-white/[0.025] sm:px-4 lg:grid-cols-[minmax(14rem,1.1fr)_minmax(9rem,0.45fr)_minmax(9rem,0.45fr)_minmax(9rem,0.45fr)_auto] lg:items-center [&::-webkit-details-marker]:hidden"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">
                            {row.countyName}, {row.stateCode}
                          </p>
                          <CoverageBadge status={row.coverageStatus} />
                        </div>
                        <p className="mt-1 font-mono text-xs text-white/30">
                          FIPS {row.countyFips}
                        </p>
                      </div>
                      <MetricCell label="Territory managers" value={row.territoryManagerCount} />
                      <MetricCell label="Affiliates / partners" value={row.affiliateCount} />
                      <div className="text-sm text-white/52">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
                          Last change
                        </p>
                        <p className="mt-1">{formatDate(row.lastEntityChangeAt)}</p>
                      </div>
                      <MapPinned className="h-4 w-4 text-white/30 transition-transform group-open:rotate-90" />
                    </summary>
                    <div className="border-t border-white/10 bg-white/[0.015] px-3 py-5 sm:px-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap gap-2">
                          {row.hasOpsNote ? <NoteBadge label="Ops" tone="warning" /> : null}
                          {row.hasRiskNote ? <NoteBadge label="Risk" tone="danger" /> : null}
                          {row.hasPartnerNote ? <NoteBadge label="Partner" tone="good" /> : null}
                          {!row.hasNotes ? (
                            <Badge className="border-white/15 bg-white/5 text-white/45">
                              No county notes
                            </Badge>
                          ) : null}
                          <Badge className="border-white/15 bg-white/5 text-white/45">
                            Last note {formatDate(row.lastNoteAt)}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignCounty(row);
                              setSelectedTmId("");
                              setTmSearch("");
                            }}
                            className="border-white/12 bg-transparent text-white/65"
                          >
                            Assign territory manager
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignAffiliateCounty(row);
                              setSelectedAffiliateUserId("");
                              setAffiliateSearch("");
                              setAffiliateEntityType("affiliate");
                            }}
                            className="border-white/12 bg-transparent text-white/65"
                          >
                            Assign affiliate / partner
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => openMapCounty(row)}
                            className="bg-orange-500 text-black hover:bg-orange-400"
                          >
                            Open county folder
                          </Button>
                        </div>
                      </div>
                    </div>
                  </details>
                ))}
              </AdminList>
            ) : (
              <AdminEmptyState
                title="No counties match these filters"
                description="Change the county, state, coverage, notes, or territory-manager filter."
              />
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="map" className="mt-4">
          <AdminSection
            title="County map and operating folder"
            description="The map displays up to 180 filtered counties. Selecting a county opens its stored entities, notes, meetings, RSVPs, and interest records."
            className="pt-0"
          >
            {coverageQuery.isLoading ? (
              <QueueLoading label="Loading county map…" />
            ) : coverageQuery.isError ? (
              <QueueUnavailable label="County coverage is unavailable." />
            ) : !filteredRows.length ? (
              <AdminEmptyState
                title="No counties match these filters"
                description="Change the coverage filters before opening the map."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="max-h-[42rem] overflow-auto border-y border-white/10">
                  {filteredRows.map((row) => (
                    <button
                      key={row.countyFips}
                      type="button"
                      onClick={() => setSelectedCountyFips(row.countyFips)}
                      className={`grid w-full gap-1 border-b border-white/10 px-3 py-3 text-left transition sm:px-4 ${
                        row.countyFips === selectedCountyFips
                          ? "bg-white/[0.07] text-white"
                          : "text-white/58 hover:bg-white/[0.03]"
                      }`}
                    >
                      <span className="font-semibold">
                        {row.countyName}, {row.stateCode}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-xs text-white/32">
                        <span>FIPS {row.countyFips}</span>
                        <CoverageBadge status={row.coverageStatus} />
                      </span>
                    </button>
                  ))}
                </div>

                <div className="min-w-0 space-y-5">
                  <div className="border-y border-white/10 bg-black/20 p-3">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                      Google Maps coverage view
                    </p>
                    {mapsError ? (
                      <div className="flex items-start gap-3 border-y border-red-400/20 bg-red-400/5 px-4 py-5 text-sm text-red-100">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        {mapsError}
                      </div>
                    ) : (
                      <div ref={mapContainerRef} className="h-[22rem] w-full" />
                    )}
                  </div>

                  <CountyFolderPanel
                    county={selectedCounty}
                    query={folderQuery}
                    onAssignTerritoryManager={(row) => {
                      setAssignCounty(row);
                      setSelectedTmId("");
                      setTmSearch("");
                    }}
                    onAssignAffiliate={(row) => {
                      setAssignAffiliateCounty(row);
                      setSelectedAffiliateUserId("");
                      setAffiliateSearch("");
                      setAffiliateEntityType("affiliate");
                    }}
                  />
                </div>
              </div>
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>

      <TerritoryManagerDialog
        county={assignCounty}
        search={tmSearch}
        onSearchChange={setTmSearch}
        selectedUserId={selectedTmId}
        onSelectedUserIdChange={setSelectedTmId}
        users={territoryManagers}
        usersLoading={usersQuery.isLoading}
        pending={assignTerritoryManager.isPending}
        onClose={() => {
          setAssignCounty(null);
          setSelectedTmId("");
          setTmSearch("");
        }}
        onAssign={() => {
          if (!assignCounty || !selectedTmId) return;
          assignTerritoryManager.mutate({
            countyFips: assignCounty.countyFips,
            userId: selectedTmId,
          });
        }}
      />

      <AffiliateDialog
        county={assignAffiliateCounty}
        entityType={affiliateEntityType}
        onEntityTypeChange={setAffiliateEntityType}
        search={affiliateSearch}
        onSearchChange={setAffiliateSearch}
        selectedUserId={selectedAffiliateUserId}
        onSelectedUserIdChange={setSelectedAffiliateUserId}
        users={affiliates}
        usersLoading={usersQuery.isLoading}
        pending={assignAffiliateOrPartner.isPending}
        onClose={() => {
          setAssignAffiliateCounty(null);
          setSelectedAffiliateUserId("");
          setAffiliateSearch("");
          setAffiliateEntityType("affiliate");
        }}
        onAssign={() => {
          if (!assignAffiliateCounty || !selectedAffiliateUserId) return;
          assignAffiliateOrPartner.mutate({
            countyFips: assignAffiliateCounty.countyFips,
            userId: selectedAffiliateUserId,
            entityType: affiliateEntityType,
          });
        }}
      />
    </AdminWorkspace>
  );
}

function CountyFolderPanel({
  county,
  query,
  onAssignTerritoryManager,
  onAssignAffiliate,
}: {
  county: CountyCoverageRow | null;
  query: ReturnType<typeof useQuery<CountyFolderResponse>>;
  onAssignTerritoryManager: (county: CountyCoverageRow) => void;
  onAssignAffiliate: (county: CountyCoverageRow) => void;
}) {
  if (!county) {
    return (
      <AdminEmptyState
        title="Choose a county"
        description="Select a county from the map list to open its operating folder."
      />
    );
  }
  if (query.isLoading) return <QueueLoading label="Loading county folder…" />;
  if (query.isError || !query.data) {
    return <QueueUnavailable label="This county folder is unavailable." />;
  }

  const folder = query.data;
  return (
    <div className="space-y-6" data-testid="county-operating-folder">
      <div className="flex flex-col gap-3 border-y border-white/10 px-3 py-4 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">
              {folder.county.countyName}, {folder.county.stateCode}
            </h3>
            <CoverageBadge status={county.coverageStatus} />
          </div>
          <p className="mt-1 font-mono text-xs text-white/30">
            FIPS {folder.county.fips} · {folder.county.countySlugs.join(", ") || "No slug"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAssignTerritoryManager(county)}
            className="border-white/12 bg-transparent text-white/65"
          >
            Assign territory manager
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAssignAffiliate(county)}
            className="border-white/12 bg-transparent text-white/65"
          >
            Assign affiliate / partner
          </Button>
        </div>
      </div>

      <div className="grid overflow-hidden border-y border-white/10 sm:grid-cols-2 xl:grid-cols-5">
        <FolderMetric label="Notes" value={folder.counts.notes} />
        <FolderMetric label="Entities" value={folder.counts.entities} />
        <FolderMetric label="Meetings" value={folder.counts.meetings} />
        <FolderMetric label="RSVPs" value={folder.counts.rsvps} />
        <FolderMetric label="Interest" value={folder.counts.interestSubmissions} />
      </div>

      <div className="grid gap-7 xl:grid-cols-2">
        <FolderSection title="Coverage entities">
          {folder.entities.length ? (
            <AdminList>
              {folder.entities.map((entity) => (
                <div
                  key={entity.id}
                  className="grid gap-2 px-3 py-3 text-sm sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-white">
                      {entity.label || entity.id}
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      {readable(entity.entityType)} · updated {formatDate(entity.updatedAt)}
                    </p>
                  </div>
                  <Badge className="border-white/15 bg-white/5 text-white/55">
                    {readable(entity.status)}
                  </Badge>
                </div>
              ))}
            </AdminList>
          ) : (
            <FolderEmpty>No coverage entities are stored.</FolderEmpty>
          )}
        </FolderSection>

        <FolderSection title="County notes">
          {folder.notes.length ? (
            <AdminList>
              {folder.notes.slice(0, 12).map((note) => (
                <div key={note.id} className="px-3 py-3 sm:px-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                    {readable(note.category)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/58">
                    {note.content}
                  </p>
                  <p className="mt-2 text-xs text-white/30">
                    {formatDate(note.updatedAt || note.createdAt)}
                  </p>
                </div>
              ))}
            </AdminList>
          ) : (
            <FolderEmpty>No county notes are stored.</FolderEmpty>
          )}
        </FolderSection>

        <FolderSection title="On-site dates">
          {folder.meetings.length ? (
            <AdminList>
              {folder.meetings.slice(0, 12).map((meeting) => (
                <div
                  key={`${meeting.partnerSlug}-${meeting.meetingId}`}
                  className="px-3 py-3 text-sm sm:px-4"
                >
                  <p className="font-semibold text-white">
                    {meeting.eventLabel || meeting.partnerSlug}
                  </p>
                  <p className="mt-1 text-white/55">
                    {meeting.meetingDate} {meeting.timeLabel || ""}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    {[meeting.meetingCity, meeting.addressLine1, meeting.addressLine2]
                      .filter(Boolean)
                      .join(" · ") || "Location not recorded"}
                  </p>
                </div>
              ))}
            </AdminList>
          ) : (
            <FolderEmpty>No on-site dates are stored.</FolderEmpty>
          )}
        </FolderSection>

        <FolderSection title="RSVP tracker">
          {folder.rsvps.length ? (
            <AdminList>
              {folder.rsvps.slice(0, 20).map((rsvp) => (
                <div
                  key={String(rsvp.id)}
                  className="grid gap-2 px-3 py-3 text-sm sm:px-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-white">{rsvp.businessName}</p>
                    <p className="mt-1 text-white/48">
                      {rsvp.contactName} · {rsvp.contactEmail}
                    </p>
                    <p className="mt-1 text-xs text-white/32">
                      {rsvp.meetingDate || "Date not recorded"} {rsvp.timeLabel || ""}
                    </p>
                  </div>
                  <Badge className="border-white/15 bg-white/5 text-white/55">
                    {readable(rsvp.attendanceStatus)}
                  </Badge>
                </div>
              ))}
            </AdminList>
          ) : (
            <FolderEmpty>No RSVPs are stored.</FolderEmpty>
          )}
        </FolderSection>

        <FolderSection title="Interest submissions">
          {folder.interestSubmissions.length ? (
            <AdminList>
              {folder.interestSubmissions.slice(0, 20).map((submission) => (
                <div key={String(submission.id)} className="px-3 py-3 text-sm sm:px-4">
                  <p className="font-semibold text-white">{submission.businessName}</p>
                  <p className="mt-1 text-white/48">{submission.contactName}</p>
                  <p className="mt-1 text-xs text-white/32">
                    {readable(submission.serviceCategory)} · {formatDate(submission.createdAt)}
                  </p>
                </div>
              ))}
            </AdminList>
          ) : (
            <FolderEmpty>No interest submissions are stored.</FolderEmpty>
          )}
        </FolderSection>
      </div>
    </div>
  );
}

function TerritoryManagerDialog({
  county,
  search,
  onSearchChange,
  selectedUserId,
  onSelectedUserIdChange,
  users,
  usersLoading,
  pending,
  onClose,
  onAssign,
}: {
  county: CountyCoverageRow | null;
  search: string;
  onSearchChange: (value: string) => void;
  selectedUserId: string;
  onSelectedUserIdChange: (value: string) => void;
  users: AdminUserSummary[];
  usersLoading: boolean;
  pending: boolean;
  onClose: () => void;
  onAssign: () => void;
}) {
  return (
    <Dialog open={Boolean(county)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-tsBg text-white">
        <DialogHeader>
          <DialogTitle>Assign territory manager</DialogTitle>
          <DialogDescription className="text-white/48">
            Add a user with the Territory Manager role to this county's geographic record.
          </DialogDescription>
        </DialogHeader>
        <AssignmentCounty county={county} />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email"
          className="border-white/10 bg-black/20 text-white"
        />
        <Select
          value={selectedUserId}
          onValueChange={onSelectedUserIdChange}
          disabled={usersLoading || !users.length}
        >
          <SelectTrigger className="border-white/10 bg-black/20 text-white">
            <SelectValue
              placeholder={usersLoading ? "Loading users…" : "Choose a territory manager"}
            />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {userLabel(user)} · {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!usersLoading && !users.length ? (
          <p className="text-sm text-amber-100">
            No user with the Territory Manager role matches this search.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onAssign}
            disabled={!county || !selectedUserId || pending}
            className="bg-orange-500 text-black hover:bg-orange-400"
          >
            {pending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AffiliateDialog({
  county,
  entityType,
  onEntityTypeChange,
  search,
  onSearchChange,
  selectedUserId,
  onSelectedUserIdChange,
  users,
  usersLoading,
  pending,
  onClose,
  onAssign,
}: {
  county: CountyCoverageRow | null;
  entityType: AffiliateEntityType;
  onEntityTypeChange: (value: AffiliateEntityType) => void;
  search: string;
  onSearchChange: (value: string) => void;
  selectedUserId: string;
  onSelectedUserIdChange: (value: string) => void;
  users: AdminUserSummary[];
  usersLoading: boolean;
  pending: boolean;
  onClose: () => void;
  onAssign: () => void;
}) {
  return (
    <Dialog open={Boolean(county)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-white/10 bg-tsBg text-white">
        <DialogHeader>
          <DialogTitle>Assign affiliate or partner</DialogTitle>
          <DialogDescription className="text-white/48">
            Add a user with the Affiliate role to this county as an affiliate or partner.
          </DialogDescription>
        </DialogHeader>
        <AssignmentCounty county={county} />
        <Select
          value={entityType}
          onValueChange={(value) => onEntityTypeChange(value as AffiliateEntityType)}
        >
          <SelectTrigger className="border-white/10 bg-black/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="affiliate">Affiliate</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by name or email"
          className="border-white/10 bg-black/20 text-white"
        />
        <Select
          value={selectedUserId}
          onValueChange={onSelectedUserIdChange}
          disabled={usersLoading || !users.length}
        >
          <SelectTrigger className="border-white/10 bg-black/20 text-white">
            <SelectValue placeholder={usersLoading ? "Loading users…" : "Choose an affiliate"} />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {userLabel(user)} · {user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!usersLoading && !users.length ? (
          <p className="text-sm text-amber-100">
            No user with the Affiliate role matches this search.
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onAssign}
            disabled={!county || !selectedUserId || pending}
            className="bg-orange-500 text-black hover:bg-orange-400"
          >
            {pending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentCounty({ county }: { county: CountyCoverageRow | null }) {
  if (!county) return null;
  return (
    <div className="border-y border-white/10 px-3 py-3 text-sm text-white/58">
      <p className="font-semibold text-white">
        {county.countyName}, {county.stateCode}
      </p>
      <p className="mt-1 font-mono text-xs text-white/30">FIPS {county.countyFips}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white/72">{value}</p>
    </div>
  );
}

function FolderMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-b border-white/10 px-4 py-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/28">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function FolderSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
        {title}
      </p>
      {children}
    </section>
  );
}

function FolderEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="border-y border-dashed border-white/12 px-3 py-6 text-sm text-white/38">
      {children}
    </div>
  );
}

function NoteBadge({
  label,
  tone,
}: {
  label: string;
  tone: "warning" | "danger" | "good";
}) {
  const classes =
    tone === "danger"
      ? "border-red-400/25 bg-red-400/10 text-red-100"
      : tone === "good"
        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
        : "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return <Badge className={classes}>{label}</Badge>;
}

function CoverageBadge({ status }: { status: CountyCoverageStatus }) {
  if (status === "full") {
    return (
      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-200">
        Full
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="border-amber-400/25 bg-amber-400/10 text-amber-100">
        Partial
      </Badge>
    );
  }
  return (
    <Badge className="border-red-400/25 bg-red-400/10 text-red-100">Unassigned</Badge>
  );
}

function QueueLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-44 items-center justify-center border-y border-white/10 text-sm text-white/45">
      <RefreshCw className="mr-3 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function QueueUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 border-y border-amber-400/20 bg-amber-400/5 px-4 py-5 text-sm leading-6 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {label}
    </div>
  );
}
