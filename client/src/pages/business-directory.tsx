import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Building2, MapPin, Search, ShieldCheck, Store } from "lucide-react";
import { Link } from "wouter";
import { Page, Section } from "@/components/layout/PagePrimitives";

type DirectoryItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  roleContext: string;
  claimStatus: "unclaimed" | "claimed" | string;
  counties: Array<{ fips: string; stateCode: string; name: string }>;
};

type DirectoryResponse = {
  items: DirectoryItem[];
  countyFips: string;
  stateCode: string | null;
  claimed: "unclaimed" | "claimed" | "any" | string;
  q: string;
  limit: number;
  offset: number;
};

function parseSearchParams(location: string) {
  const idx = location.indexOf("?");
  const query = idx >= 0 ? location.slice(idx + 1) : "";
  const params = new URLSearchParams(query);
  return params;
}

export default function BusinessDirectoryPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const params = useMemo(() => parseSearchParams(String(location || "")), [location]);

  const initialCountyFips = String(params.get("countyFips") || params.get("county") || "").trim();
  const initialStateCode = String(params.get("stateCode") || params.get("state") || "").trim();
  const initialClaimed = String(params.get("claimed") || "unclaimed").trim() as any;
  const initialQ = String(params.get("q") || params.get("search") || "").trim();

  const [countyFips, setCountyFips] = useState(initialCountyFips);
  const [stateCode, setStateCode] = useState(initialStateCode);
  const [claimed, setClaimed] = useState<"unclaimed" | "claimed" | "any">(
    initialClaimed === "claimed" || initialClaimed === "any" ? initialClaimed : "unclaimed"
  );
  const [q, setQ] = useState(initialQ);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (countyFips.trim()) sp.set("countyFips", countyFips.trim());
    if (stateCode.trim()) sp.set("stateCode", stateCode.trim().toUpperCase());
    if (claimed) sp.set("claimed", claimed);
    if (q.trim()) sp.set("q", q.trim());
    sp.set("limit", "25");
    sp.set("offset", "0");
    return sp.toString();
  }, [countyFips, stateCode, claimed, q]);

  const enabled = /^\d{5}$/.test(countyFips.trim());

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-business-directory", queryString],
    enabled,
    queryFn: async () => {
      return (await apiRequest(`/api/businesses?${queryString}`)) as DirectoryResponse;
    },
  });

  function applyFilters() {
    if (!/^\d{5}$/.test(countyFips.trim())) {
      toast({
        title: "County required",
        description: "Enter a 5-digit county FIPS (e.g., 12033).",
        variant: "destructive",
      });
      return;
    }
    navigate(`/directory/businesses?${queryString}`);
    void refetch();
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const titleSuffix = data?.stateCode ? `${data.stateCode}-${data.countyFips}` : data?.countyFips;

  return (
    <Page className="max-w-5xl">
      <Section
        title={
          <span className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Directory{titleSuffix ? ` (${titleSuffix})` : ""}
          </span>
        }
        subtitle={
          <>
            Seeded listings are labeled <span className="font-medium text-white">Unclaimed</span>.
            Contact stays Scout-gated.
          </>
        }
      >
        <Card className="mb-6">
          <CardContent className="grid gap-3 md:grid-cols-4 pt-6">
            <div className="md:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">County FIPS</div>
              <Input
                value={countyFips}
                onChange={(e) => setCountyFips(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="12033"
                inputMode="numeric"
              />
            </div>
            <div className="md:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">State (optional)</div>
              <Input
                value={stateCode}
                onChange={(e) =>
                  setStateCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z]/g, "")
                      .slice(0, 2)
                  )
                }
                placeholder="FL"
              />
            </div>
            <div className="md:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">Status</div>
              <Select value={claimed} onValueChange={(v) => setClaimed(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unclaimed">Unclaimed</SelectItem>
                  <SelectItem value="claimed">Claimed</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-1">
              <div className="text-xs text-muted-foreground mb-1">Search</div>
              <div className="flex gap-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name"
                />
                <Button onClick={applyFilters} variant="default">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading directory…</div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-red-500">Failed to load directory.</div>
            </CardContent>
          </Card>
        ) : !enabled ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                Enter a county FIPS to view businesses.
              </div>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                No businesses found for that county/filter.
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((b) => (
              <Card
                key={b.id}
                className="group overflow-hidden border-white/10 bg-[color:var(--surface-card)] shadow-xl shadow-black/25 transition hover:-translate-y-0.5 hover:border-ts-orange/40"
              >
                <CardContent className="p-0">
                  <div className="relative h-20 border-b border-white/10 bg-black">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,107,0,0.26),transparent_34%),linear-gradient(135deg,rgba(255,107,0,0.18),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(0,0,0,0.72))]" />
                    <div className="absolute bottom-3 left-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/58">
                      <Store className="h-3.5 w-3.5 text-ts-orange" />
                      Business home
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="-mt-10 mb-3 flex items-end justify-between gap-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-ts-orange bg-black text-lg font-bold text-white shadow-lg shadow-black/40">
                        {b.name
                          .split(/\s+/)
                          .map((word) => word[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      {String(b.claimStatus) === "unclaimed" ? (
                        <Badge variant="secondary">Unclaimed</Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">
                          <ShieldCheck className="mr-1 h-3 w-3" />
                          Claimed
                        </Badge>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-white">{b.name}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-white/62">
                        <MapPin className="h-3.5 w-3.5 text-ts-orange" />
                        <span className="truncate">
                          {b.counties?.[0]
                            ? `${b.counties[0].name}, ${b.counties[0].stateCode}`
                            : "County unknown"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/70">
                      <div className="rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
                        <div className="font-semibold uppercase tracking-[0.12em] text-white/44">
                          Source
                        </div>
                        <div className="mt-1">Directory</div>
                      </div>
                      <div className="rounded-[var(--ts-radius-control)] border border-white/10 bg-white/[0.045] p-2">
                        <div className="font-semibold uppercase tracking-[0.12em] text-white/44">
                          Contact
                        </div>
                        <div className="mt-1">Protected</div>
                      </div>
                    </div>
                    <Link href={`/business/${encodeURIComponent(b.slug)}`}>
                      <Button className="mt-4 w-full ts-accent-btn">
                        View Profile
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Page>
  );
}
