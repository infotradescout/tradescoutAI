import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, Home, MapPin, Building, ArrowRight, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useLocationContext } from "@/hooks/useLocationContext";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";

type ExchangePortalItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function looksLikeRentalListing(item: ExchangePortalItem) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return /\brent|rental|lease|leasing|per month|monthly|weekly\b/.test(haystack);
}

export default function ExchangeRentalProperty() {
  const locationCtx = useLocationContext();
  const stateCode = typeof locationCtx.stateCode === "string" ? locationCtx.stateCode : undefined;
  const countyFips =
    typeof locationCtx.countyFips === "string" ? locationCtx.countyFips : undefined;

  const { data, isLoading, isError, error } = useQuery<ExchangePortalItem[]>({
    queryKey: ["/api/exchange/items", "rental-property", stateCode || "", countyFips || ""],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("categoryId", "real-estate");
      params.set("limit", "40");
      if (stateCode) params.set("stateCode", stateCode);
      if (countyFips) params.set("countyFips", countyFips);

      const response = await fetch(`/api/exchange/items?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load rental property listings");
      const json = await response.json();
      return Array.isArray(json) ? json.filter(looksLikeRentalListing) : [];
    },
  });

  const listings = Array.isArray(data) ? data.slice(0, 12) : [];

  return (
    <div className="min-h-screen bg-tsDark text-white">
      <SEOHelmet
        title="Rental Property Portal | Residential & Commercial Rentals | TradeScout Exchange"
        description="Browse TradeScout Exchange rental property inventory for residential and commercial space. This rental property portal stays separate from HomeScout Listings."
        canonical="https://www.thetradescout.com/exchange/rental-property"
        keywords="rental property portal, commercial rentals, residential rentals, exchange rental listings, tradescout rental property"
      />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-tsCard p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-ts-orange text-black">Exchange Portal</Badge>
            <Badge variant="outline" className="border-white/15 text-white/80">
              Separate from HomeScout Listings
            </Badge>
          </div>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ts-orange/15 text-ts-orange">
                  <KeyRound className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-black tracking-tight md:text-5xl">Rental Property</h1>
              </div>
              <p className="text-base text-white/70 md:text-lg">
                Exchange-side rental inventory for residential and commercial property. This is the
                rental portal, not HomeScout Listings and not the HomeScout property-management
                system.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/exchange?tab=sell&portal=rental-property">
                <Button className="bg-ts-orange text-black hover:bg-ts-orange/90">
                  List Rental Property
                </Button>
              </Link>
              <Link href="/homescout-listings">
                <Button variant="outline" className="border-white/15 text-white hover:bg-white/10">
                  Open HomeScout Listings
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Home className="h-5 w-5 text-ts-orange" />
                Residential Rentals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Houses, condos, townhomes, duplexes, and long-term living inventory that belongs in a
              rental flow, not a sale flow.
            </CardContent>
          </Card>
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Building className="h-5 w-5 text-ts-orange" />
                Commercial Rentals
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Storefronts, office suites, mixed-use space, warehouse bays, and other lease-first
              inventory.
            </CardContent>
          </Card>
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Building2 className="h-5 w-5 text-ts-orange" />
                Exchange-Only Rental Path
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Rental property stays in Exchange so sale inventory, rental inventory, and HomeScout
              management stay separate.
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Active Rental Property Listings</h2>
            <p className="text-sm text-white/60">
              Exchange inventory flagged by rental language and ordered with your county/state
              preference when available.
            </p>
          </div>
          <Link href="/exchange">
            <Button variant="ghost" className="text-white/80 hover:bg-white/10 hover:text-white">
              Browse all Exchange
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-6 text-sm text-white/70">
              Loading rental property inventory...
            </CardContent>
          </Card>
        ) : isError ? (
          <Card className="bg-tsCard border-red-500/40">
            <CardContent className="p-6 text-sm text-red-100">
              {formatUserFacingErrorMessage(error, "Could not load rental property inventory.")}
            </CardContent>
          </Card>
        ) : listings.length === 0 ? (
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-semibold text-white">
                No rental property listings active yet
              </h3>
              <p className="mt-2 text-sm text-white/65">
                This portal is live now. The next step is posting residential and commercial rental
                inventory into Exchange instead of HomeScout Listings.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/exchange?tab=sell&portal=rental-property">
                  <Button className="bg-ts-orange text-black hover:bg-ts-orange/90">
                    List Rental Property
                  </Button>
                </Link>
                <Link href="/exchange/rental-equipment">
                  <Button
                    variant="outline"
                    className="border-white/15 text-white hover:bg-white/10"
                  >
                    Open Rental Equipment
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((item) => (
              <Card key={item.id} className="overflow-hidden bg-tsCard border-white/10">
                <div className="aspect-[16/10] bg-black/30">
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/35">
                      <Building2 className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-2 text-lg font-semibold text-white">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm text-white/60">{formatCurrency(item.price)}</p>
                    </div>
                    <Badge variant="outline" className="border-ts-orange/40 text-ts-orange">
                      Rental
                    </Badge>
                  </div>
                  <p className="line-clamp-3 text-sm text-white/65">{item.description}</p>
                  <div className="flex items-center gap-2 text-xs text-white/55">
                    <MapPin className="h-4 w-4" />
                    <span>{item.location || "Local market"}</span>
                  </div>
                  <Link href={`/exchange?item=${encodeURIComponent(item.id)}`}>
                    <Button
                      variant="outline"
                      className="w-full border-white/15 text-white hover:bg-white/10"
                    >
                      Open in Exchange
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
