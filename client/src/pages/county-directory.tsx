import { memo, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, ChevronRight, MapPin, Search, ShieldCheck } from "lucide-react";
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

const QUICK_STATE_CODES = ["FL", "AL", "LA", "MS", "GA", "TX"];

const CountyDirectory = memo(function CountyDirectory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState<string>("FL");

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

  const stateOptions = states.length ? states : [{ code: "FL", name: "Florida" }];
  const selectedStateName = useMemo(() => {
    const state = stateOptions.find((s) => s.code === selectedState);
    return state?.name || selectedState;
  }, [selectedState, stateOptions]);

  const quickStates = useMemo(
    () =>
      QUICK_STATE_CODES.map((code) => stateOptions.find((s) => s.code === code)).filter(
        Boolean
      ) as StateRow[],
    [stateOptions]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = counties.slice();
    if (q.length >= 2) return list.filter((c) => c.name.toLowerCase().includes(q));
    return list;
  }, [counties, searchQuery]);

  const visibleCounties = filtered.slice(0, 200);
  const selectedCounty = visibleCounties[0] || counties[0] || null;
  const selectedCountyHref = selectedCounty
    ? `/county/${selectedCounty.stateCode.toLowerCase()}/${nameToSlug(selectedCounty.name)}`
    : "/county-directory";

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
    <div className="min-h-screen bg-tsBg text-white">
      <SEOHelmet
        title="County Directory | Browse U.S. Counties on TradeScout"
        description="Browse TradeScout county pages by state and open local county hubs for community activity, trade partners, and verified business discovery."
        canonical="https://www.thetradescout.com/county-directory"
        structuredData={structuredData}
      />

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--ts-radius-chip)] border border-ts-orange/30 bg-ts-orange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
              <MapPin className="h-4 w-4" />
              County operating map
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">County Directory</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62">
              Choose the county container first. From there, open the local market, trades, and
              business profiles without breaking contact gating.
            </p>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-[var(--ts-radius-card)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] text-center">
            <div className="px-4 py-3">
              <div className="text-lg font-semibold">{stateOptions.length}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">States</div>
            </div>
            <div className="border-x border-[color:var(--border-subtle)] px-4 py-3">
              <div className="text-lg font-semibold">{countiesLoading ? "-" : counties.length}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Counties</div>
            </div>
            <div className="px-4 py-3">
              <div className="text-lg font-semibold">{visibleCounties.length}</div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-white/45">Shown</div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="ts-panel space-y-4 p-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-ts-orange" />
                  Market controls
                </div>
                <Select value={selectedState} onValueChange={setSelectedState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {stateOptions.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                  Quick states
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickStates.map((state) => (
                    <button
                      key={state.code}
                      type="button"
                      onClick={() => setSelectedState(state.code)}
                      className={`h-9 rounded-[var(--ts-radius-control)] border text-sm font-semibold transition-colors ${
                        selectedState === state.code
                          ? "border-ts-orange bg-ts-orange text-black"
                          : "border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-white/70 hover:border-ts-orange/40 hover:text-white"
                      }`}
                    >
                      {state.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[var(--ts-radius-card)] border border-[color:var(--border-subtle)] bg-black/25 p-3">
                <div className="text-xs uppercase tracking-[0.14em] text-white/45">Selected</div>
                <div className="mt-1 text-lg font-semibold">{selectedStateName}</div>
                <div className="mt-1 text-sm text-white/50">
                  {statesLoading || countiesLoading
                    ? "Loading county containers..."
                    : `${counties.length} county containers`}
                </div>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/45" />
                <Input
                  placeholder={`Search ${selectedStateName} counties`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Link href={selectedCountyHref}>
                <Button disabled={!selectedCounty}>
                  Open top result
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {selectedCounty ? (
              <section className="mb-4 rounded-[var(--ts-radius-panel)] border border-ts-orange/30 bg-[color:var(--surface-card)] p-4 shadow-[var(--surface-card-shadow)]">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-ts-orange">
                      Current county
                    </div>
                    <div className="mt-1 truncate text-2xl font-semibold">
                      {selectedCounty.name}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/55">
                      <span>{selectedCounty.stateCode}</span>
                      <span className="h-1 w-1 rounded-full bg-white/25" />
                      <span>FIPS {selectedCounty.fips}</span>
                    </div>
                  </div>
                  <Link href={selectedCountyHref}>
                    <Button variant="secondary">
                      View market
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </section>
            ) : null}

            <div className="overflow-hidden rounded-[var(--ts-radius-panel)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
              <div className="grid grid-cols-[minmax(0,1fr)_88px_48px] border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45 sm:grid-cols-[minmax(0,1fr)_120px_96px_48px]">
                <div>County</div>
                <div>FIPS</div>
                <div className="hidden sm:block">State</div>
                <div />
              </div>

              {countiesLoading ? (
                <div className="px-4 py-8 text-sm text-white/55">Loading counties...</div>
              ) : null}

              {!countiesLoading && visibleCounties.length === 0 ? (
                <div className="px-4 py-8 text-sm text-white/55">No counties found.</div>
              ) : null}

              {!countiesLoading &&
                visibleCounties.map((county) => {
                  const href = `/county/${county.stateCode.toLowerCase()}/${nameToSlug(county.name)}`;
                  return (
                    <Link key={county.fips} href={href}>
                      <a className="grid grid-cols-[minmax(0,1fr)_88px_48px] items-center border-b border-[color:var(--border-subtle)] px-4 py-3 transition-colors last:border-b-0 hover:bg-white/[0.055] sm:grid-cols-[minmax(0,1fr)_120px_96px_48px]">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ts-radius-control)] border border-ts-orange/25 bg-ts-orange/10 text-ts-orange">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{county.name}</div>
                            <div className="text-xs text-white/42 sm:hidden">
                              {county.stateCode}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="w-fit border-[color:var(--border-subtle)] bg-black/25 text-xs text-white/68"
                        >
                          {county.fips}
                        </Badge>
                        <div className="hidden text-sm text-white/55 sm:block">
                          {county.stateCode}
                        </div>
                        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ts-radius-control)] bg-ts-orange text-black">
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </a>
                    </Link>
                  );
                })}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
});

export default CountyDirectory;
