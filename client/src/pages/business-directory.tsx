import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Page, Section } from "@/components/layout/PagePrimitives";
import { PublicBusinessCard } from "@/components/directory/PublicBusinessCard";
import type { PublicDirectoryBusiness } from "@shared/publicBusinessCard";

type DirectoryResponse = {
  items: PublicDirectoryBusiness[];
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
  return new URLSearchParams(query);
}

export default function BusinessDirectoryPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const params = useMemo(() => parseSearchParams(String(location || "")), [location]);
  const initialCountyFips = String(params.get("countyFips") || params.get("county") || "").trim();
  const initialStateCode = String(params.get("stateCode") || params.get("state") || "").trim();
  const initialClaimed = String(params.get("claimed") || "unclaimed").trim();
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
    // Signed-in visitors must use the same public projection, not owner records.
    sp.set("public", "1");
    sp.set("limit", "25");
    sp.set("offset", "0");
    return sp.toString();
  }, [countyFips, stateCode, claimed, q]);

  const enabled = /^\d{5}$/.test(countyFips.trim());
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["public-business-directory", queryString],
    enabled,
    queryFn: async () => (await apiRequest(`/api/businesses?${queryString}`)) as DirectoryResponse,
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

  return (
    <Page className="max-w-6xl">
      <Section
        title={<span className="flex items-center gap-2"><Building2 aria-hidden="true" className="h-5 w-5" />Business Directory</span>}
        subtitle="Explore local businesses, compare their services, and see the details available on each profile."
      >
        <Card className="mb-6">
          <CardContent className="pt-6">
            <form className="grid min-w-0 gap-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
              <div className="space-y-2">
                <label htmlFor="business-directory-county" className="text-sm text-muted-foreground">County FIPS</label>
                <Input id="business-directory-county" value={countyFips}
                  onChange={(event) => setCountyFips(event.target.value.replace(/\D/g, "").slice(0, 5))}
                  placeholder="12033" inputMode="numeric" className="min-h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label htmlFor="business-directory-state" className="text-sm text-muted-foreground">State (optional)</label>
                <Input id="business-directory-state" value={stateCode}
                  onChange={(event) => setStateCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                  placeholder="FL" className="min-h-11 text-base" />
              </div>
              <div className="space-y-2">
                <label htmlFor="business-directory-status" className="text-sm text-muted-foreground">Listing status</label>
                <Select value={claimed} onValueChange={(value) => {
                  if (value === "claimed" || value === "unclaimed" || value === "any") setClaimed(value);
                }}>
                  <SelectTrigger id="business-directory-status" className="min-h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unclaimed">Unclaimed</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                    <SelectItem value="any">Any</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <label htmlFor="business-directory-search" className="text-sm text-muted-foreground">Search businesses</label>
                <div className="flex min-w-0 gap-2">
                  <Input id="business-directory-search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search by name" className="min-h-11 min-w-0 text-base" />
                  <Button type="submit" aria-label="Search businesses" className="min-h-11 min-w-11 shrink-0"><Search aria-hidden="true" className="h-4 w-4" /></Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {!enabled ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">Enter a county FIPS to view businesses.</CardContent></Card>
        ) : isLoading ? (
          <div role="status" className="text-sm text-muted-foreground">Loading directory…</div>
        ) : error ? (
          <Card><CardContent className="space-y-3 pt-6">
            <p role="alert" className="text-sm text-red-400">Could not load businesses. Your filters are still here.</p>
            <Button type="button" variant="outline" onClick={() => void refetch()} className="min-h-11">Try again</Button>
          </CardContent></Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="pt-6 text-sm text-muted-foreground">No businesses found for that county/filter.</CardContent></Card>
        ) : (
          <>
            <p role="status" className="mb-4 text-sm text-muted-foreground">{items.length} {items.length === 1 ? "business" : "businesses"} shown</p>
            <div className="grid min-w-0 items-stretch gap-5 md:grid-cols-2">
              {items.map((business) => <PublicBusinessCard key={business.id} business={business} />)}
            </div>
          </>
        )}
      </Section>
    </Page>
  );
}
