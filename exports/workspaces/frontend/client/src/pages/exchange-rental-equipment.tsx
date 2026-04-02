import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Wrench, Briefcase, Tractor, Hammer, ArrowRight, MapPin } from "lucide-react";
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
  category: string;
};

const EQUIPMENT_CATEGORY_SLUGS = ["construction", "tools", "farm", "business-equipment"] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function looksLikeRentalListing(item: ExchangePortalItem) {
  const haystack = `${item.title} ${item.description}`.toLowerCase();
  return /\brent|rental|lease|daily rate|weekly rate|monthly rate|per day|per week|per month\b/.test(
    haystack
  );
}

export default function ExchangeRentalEquipment() {
  const locationCtx = useLocationContext();
  const stateCode = typeof locationCtx.stateCode === "string" ? locationCtx.stateCode : undefined;
  const countyFips =
    typeof locationCtx.countyFips === "string" ? locationCtx.countyFips : undefined;

  const { data, isLoading, isError, error } = useQuery<ExchangePortalItem[]>({
    queryKey: ["/api/exchange/items", "rental-equipment", stateCode || "", countyFips || ""],
    queryFn: async () => {
      const merged = await Promise.all(
        EQUIPMENT_CATEGORY_SLUGS.map(async (slug) => {
          const params = new URLSearchParams();
          params.set("categoryId", slug);
          params.set("limit", "30");
          if (stateCode) params.set("stateCode", stateCode);
          if (countyFips) params.set("countyFips", countyFips);

          const response = await fetch(`/api/exchange/items?${params.toString()}`, {
            credentials: "include",
          });
          if (!response.ok) throw new Error("Failed to load rental equipment inventory");
          const json = await response.json();
          return Array.isArray(json) ? json : [];
        })
      );

      const deduped = new Map<string, ExchangePortalItem>();
      for (const item of merged.flat().filter(looksLikeRentalListing)) {
        deduped.set(String(item.id), item);
      }
      return Array.from(deduped.values()).slice(0, 18);
    },
  });

  const listings = Array.isArray(data) ? data : [];

  return (
    <div className="min-h-screen bg-tsDark text-white">
      <SEOHelmet
        title="Rental Equipment Portal | Equipment Rentals in Exchange | TradeScout"
        description="Browse equipment rentals inside TradeScout Exchange, from construction and farm gear to commercial and pro tool inventory."
        canonical="https://www.thetradescout.com/exchange/rental-equipment"
        keywords="equipment rental portal, rental equipment exchange, tool rental listings, construction equipment rentals, tradescout rental equipment"
      />

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-tsCard p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-ts-orange text-black">Exchange Portal</Badge>
            <Badge variant="outline" className="border-white/15 text-white/80">
              Rental Equipment
            </Badge>
          </div>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ts-orange/15 text-ts-orange">
                  <Wrench className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-black tracking-tight md:text-5xl">Rental Equipment</h1>
              </div>
              <p className="text-base text-white/70 md:text-lg">
                Short-term and long-term equipment rental inventory inside Exchange, from heavy
                machinery to pro tools and commercial-use equipment.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/exchange?tab=sell&portal=rental-equipment">
                <Button className="bg-ts-orange text-black hover:bg-ts-orange/90">
                  List Rental Equipment
                </Button>
              </Link>
              <Link href="/exchange">
                <Button variant="outline" className="border-white/15 text-white hover:bg-white/10">
                  Browse Exchange
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Hammer className="h-5 w-5 text-ts-orange" />
                Construction
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Excavators, skid steers, lifts, compactors, and contractor-use machines.
            </CardContent>
          </Card>
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Wrench className="h-5 w-5 text-ts-orange" />
                Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Pro tools, diagnostic gear, specialty kits, and crew-ready jobsite inventory.
            </CardContent>
          </Card>
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Tractor className="h-5 w-5 text-ts-orange" />
                Farm
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Seasonal and field-ready agricultural equipment with local pickup logistics.
            </CardContent>
          </Card>
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Briefcase className="h-5 w-5 text-ts-orange" />
                Business Use
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70">
              Commercial-use gear, event equipment, and office/ops hardware available for rental.
            </CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <h2 className="text-2xl font-bold text-white">Active Rental Equipment Listings</h2>
          <p className="text-sm text-white/60">
            Exchange inventory flagged for rent/lease terms across equipment-heavy categories.
          </p>
        </div>

        {isLoading ? (
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-6 text-sm text-white/70">
              Loading rental equipment inventory...
            </CardContent>
          </Card>
        ) : isError ? (
          <Card className="bg-tsCard border-red-500/40">
            <CardContent className="p-6 text-sm text-red-100">
              {formatUserFacingErrorMessage(error, "Could not load rental equipment inventory.")}
            </CardContent>
          </Card>
        ) : listings.length === 0 ? (
          <Card className="bg-tsCard border-white/10">
            <CardContent className="p-8 text-center">
              <h3 className="text-xl font-semibold text-white">
                No rental equipment listings active yet
              </h3>
              <p className="mt-2 text-sm text-white/65">
                This portal is live. The next step is getting rental fleet and tool inventory into
                Exchange with clear rate, availability, and delivery terms.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link href="/exchange?tab=sell&portal=rental-equipment">
                  <Button className="bg-ts-orange text-black hover:bg-ts-orange/90">
                    List Rental Equipment
                  </Button>
                </Link>
                <Link href="/exchange/rental-property">
                  <Button
                    variant="outline"
                    className="border-white/15 text-white hover:bg-white/10"
                  >
                    Open Rental Property
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
                      <Wrench className="h-10 w-10" />
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
                  <div className="flex items-center justify-between gap-3 text-xs text-white/55">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{item.location || "Local market"}</span>
                    </div>
                    <span className="rounded-full bg-white/5 px-2 py-1">{item.category}</span>
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
