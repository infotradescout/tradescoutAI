import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Building2, Search } from "lucide-react";
import { Link } from "wouter";

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
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Business Directory{" "}
            {titleSuffix ? <span className="text-muted-foreground">({titleSuffix})</span> : null}
          </CardTitle>
          <div className="text-sm text-muted-foreground">
            Seeded listings are labeled <span className="font-medium">Unclaimed</span>. Contact
            stays Scout-gated.
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
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
        <div className="grid gap-3">
          {items.map((b) => (
            <Card key={b.id}>
              <CardContent className="pt-6 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold truncate">{b.name}</div>
                    {String(b.claimStatus) === "unclaimed" ? (
                      <Badge variant="secondary">Unclaimed</Badge>
                    ) : (
                      <Badge variant="outline">Claimed</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {b.counties?.[0]
                      ? `${b.counties[0].name}, ${b.counties[0].stateCode} (FIPS ${b.counties[0].fips})`
                      : "County unknown"}
                  </div>
                </div>
                <div className="shrink-0">
                  <Link href={`/business/${encodeURIComponent(b.slug)}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
