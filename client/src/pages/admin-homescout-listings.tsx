import React, { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Home, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type HomeScoutListing = {
  id: string;
  status: string;
  title: string;
  price: string | number;
  propertyType?: string | null;
  countyFips: string;
  stateCode: string;
  city?: string | null;
  createdAt?: string | null;
};

function formatCurrency(value: string | number) {
  const num = typeof value === "number" ? value : Number(String(value || 0));
  const safe = Number.isFinite(num) ? num : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(safe);
}

export default function AdminHomeScoutListings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<"pending_review" | "active">("pending_review");

  const queryKey = useMemo(() => ["/api/admin/homescout/listings", status], [status]);

  const {
    data: listings = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<HomeScoutListing[]>({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("status", status);
      sp.set("limit", "100");
      const res = await fetch(`/api/admin/homescout/listings?${sp.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to fetch HomeScout listings");
      }
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (listingId: string) => {
      const res = await fetch(
        `/api/admin/homescout/listings/${encodeURIComponent(listingId)}/approve`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to approve listing");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Approved", description: "Listing is now active in HomeScout search." });
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Approval failed",
        description: err instanceof Error ? err.message : "Failed to approve listing",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Home className="h-5 w-5 text-ts-orange" />
            HomeScout Listings
          </CardTitle>
          <CardDescription className="text-white/60">
            Approve listings to publish them to county-first HomeScout search.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={status === "pending_review" ? "default" : "outline"}
            onClick={() => setStatus("pending_review")}
          >
            <Clock className="h-4 w-4 mr-2" />
            Pending
          </Button>
          <Button
            size="sm"
            variant={status === "active" ? "default" : "outline"}
            onClick={() => setStatus("active")}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Active
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-black/30 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">
            {status === "pending_review" ? "Pending review" : "Active listings"} ({listings.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <div className="text-sm text-white/60">Loading...</div>}
          {!isLoading && isError && (
            <div className="text-sm text-red-300">Failed to load listings.</div>
          )}
          {!isLoading && !isError && listings.length === 0 && (
            <div className="text-sm text-white/60">No listings.</div>
          )}
          {listings.map((l) => {
            const locationLabel = [l.city, l.stateCode].filter(Boolean).join(", ");
            return (
              <div
                key={l.id}
                className="rounded-lg border border-white/10 bg-black/30 p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-white font-semibold">{l.title}</div>
                    <div className="text-xs text-white/60">
                      {locationLabel || `${l.countyFips}, ${l.stateCode}`} •{" "}
                      {String(l.propertyType || "home")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-white/10 text-white/70">
                      {String(l.status || "").replace(/_/g, " ")}
                    </Badge>
                    <div className="text-white font-semibold">{formatCurrency(l.price)}</div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  {status === "pending_review" && (
                    <Button
                      size="sm"
                      className="bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold"
                      onClick={() => approveMutation.mutate(l.id)}
                      disabled={approveMutation.isPending}
                    >
                      Approve
                    </Button>
                  )}
                  <a href={`/homescout/listings/${l.id}`} className="text-sm">
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </a>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
