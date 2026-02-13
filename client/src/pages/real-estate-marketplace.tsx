import React, { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Home, Search, Filter, MapPin, BedDouble, Bath, Square, PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RealEstateMarketplaceShell } from "@/shells/RealEstateMarketplaceShell";
import { CountyRequiredGate } from "@/components/CountyRequiredGate";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

type HomeScoutListing = {
  id: string;
  status: string;
  title: string;
  price: string | number;
  propertyType?: string | null;
  beds?: number | null;
  baths?: string | number | null;
  sqft?: number | null;
  photos?: string[] | null;
  city?: string | null;
  stateCode: string;
  countyFips: string;
  listedAt?: string | null;
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

function safePhotos(input: unknown): string[] {
  if (Array.isArray(input))
    return input.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return [];
}

const RealEstateMarketplace = memo(function RealEstateMarketplace() {
  const ctx = useLocationContext();
  const allowBypass = hasCountyContext(ctx);
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [bedrooms, setBedrooms] = useState<string>("all");
  const [bathrooms, setBathrooms] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");
  const [maxDom, setMaxDom] = useState<string>("all");
  const [sqftMin, setSqftMin] = useState<string>("all");
  const [priceDropsOnly, setPriceDropsOnly] = useState(false);

  const resolvedCountyFips = typeof ctx.countyFips === "string" ? ctx.countyFips : undefined;
  const resolvedStateCode = typeof ctx.stateCode === "string" ? ctx.stateCode : undefined;

  const { minPrice, maxPrice } = useMemo(() => {
    switch (priceRange) {
      case "under-300k":
        return { minPrice: undefined, maxPrice: 300000 };
      case "300k-500k":
        return { minPrice: 300000, maxPrice: 500000 };
      case "500k-750k":
        return { minPrice: 500000, maxPrice: 750000 };
      case "over-750k":
        return { minPrice: 750000, maxPrice: undefined };
      default:
        return { minPrice: undefined, maxPrice: undefined };
    }
  }, [priceRange]);

  const bedsMin = useMemo(() => {
    if (bedrooms === "all") return undefined;
    const n = Number(bedrooms);
    return Number.isFinite(n) ? n : undefined;
  }, [bedrooms]);

  const bathsMin = useMemo(() => {
    if (bathrooms === "all") return undefined;
    const n = Number(bathrooms);
    return Number.isFinite(n) ? n : undefined;
  }, [bathrooms]);

  const domMaxDays = useMemo(() => {
    if (maxDom === "all") return undefined;
    const n = Number(maxDom);
    return Number.isFinite(n) ? n : undefined;
  }, [maxDom]);

  const sqftMinValue = useMemo(() => {
    if (sqftMin === "all") return undefined;
    const n = Number(sqftMin);
    return Number.isFinite(n) ? n : undefined;
  }, [sqftMin]);

  const queryKey = useMemo(
    () => [
      "/api/homescout/search",
      resolvedCountyFips || "",
      resolvedStateCode || "",
      searchQuery.trim(),
      propertyType,
      String(bedsMin ?? ""),
      String(bathsMin ?? ""),
      String(minPrice ?? ""),
      String(maxPrice ?? ""),
      String(domMaxDays ?? ""),
      String(sqftMinValue ?? ""),
      priceDropsOnly ? "1" : "0",
    ],
    [
      resolvedCountyFips,
      resolvedStateCode,
      searchQuery,
      propertyType,
      bedsMin,
      bathsMin,
      minPrice,
      maxPrice,
      domMaxDays,
      sqftMinValue,
      priceDropsOnly,
    ]
  );

  const {
    data: listings = [],
    isLoading,
    isError,
  } = useQuery<HomeScoutListing[]>({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (resolvedCountyFips) sp.set("countyFips", resolvedCountyFips);
      if (resolvedStateCode) sp.set("stateCode", resolvedStateCode);
      const q = searchQuery.trim();
      if (q) sp.set("query", q);
      if (propertyType !== "all") sp.set("propertyType", propertyType);
      if (bedsMin != null) sp.set("bedsMin", String(bedsMin));
      if (bathsMin != null) sp.set("bathsMin", String(bathsMin));
      if (minPrice != null) sp.set("minPrice", String(minPrice));
      if (maxPrice != null) sp.set("maxPrice", String(maxPrice));
      if (domMaxDays != null) sp.set("maxDomDays", String(domMaxDays));
      if (sqftMinValue != null) sp.set("sqftMin", String(sqftMinValue));
      if (priceDropsOnly) sp.set("priceDropsOnly", "true");
      sp.set("sortBy", "newest");
      sp.set("limit", "50");
      sp.set("offset", "0");

      const res = await fetch(`/api/homescout/search?${sp.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to search HomeScout");
      }
      return res.json();
    },
    enabled: Boolean(resolvedCountyFips && resolvedStateCode),
  });

  const saveSearchMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        searchType: "homescout",
        searchQuery: searchQuery.trim() || null,
        filters: {
          countyFips: resolvedCountyFips,
          stateCode: resolvedStateCode,
          query: searchQuery.trim() || undefined,
          propertyType: propertyType !== "all" ? propertyType : undefined,
          bedsMin: bedsMin ?? undefined,
          bathsMin: bathsMin ?? undefined,
          minPrice: minPrice ?? undefined,
          maxPrice: maxPrice ?? undefined,
          maxDomDays: domMaxDays ?? undefined,
          sqftMin: sqftMinValue ?? undefined,
          priceDropsOnly,
        },
        alertsEnabled: true,
      };
      const res = await fetch("/api/saved-searches", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Failed to save search");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Saved",
        description: "HomeScout alerts are enabled for this search.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save search",
        variant: "destructive",
      });
    },
  });

  return (
    <RealEstateMarketplaceShell>
      <CountyRequiredGate surface="homescout" allowBypass={allowBypass}>
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Home className="h-7 w-7 text-orange-400" />
                <h1 className="text-3xl md:text-4xl font-bold text-white">HomeScout</h1>
              </div>
              <p className="text-sm md:text-base text-slate-300">
                County-first real estate, with intent-gated contact.
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MapPin className="h-3.5 w-3.5" />
                <span>{ctx.label || "Your county context"}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/property-listing">
                <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  List a home
                </Button>
              </Link>
              <Button
                variant="secondary"
                onClick={() => saveSearchMutation.mutate()}
                disabled={saveSearchMutation.isPending}
              >
                Save search
              </Button>
            </div>
          </div>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search title or city..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-navy-700 border-navy-600 text-white"
                  />
                </div>

                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Price Range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Prices</SelectItem>
                    <SelectItem value="under-300k">Under $300,000</SelectItem>
                    <SelectItem value="300k-500k">$300,000 - $500,000</SelectItem>
                    <SelectItem value="500k-750k">$500,000 - $750,000</SelectItem>
                    <SelectItem value="over-750k">Over $750,000</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Property Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="multifamily">Multi-Family</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={bedrooms} onValueChange={setBedrooms}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Bedrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Bedrooms</SelectItem>
                    <SelectItem value="1">1+ Bedrooms</SelectItem>
                    <SelectItem value="2">2+ Bedrooms</SelectItem>
                    <SelectItem value="3">3+ Bedrooms</SelectItem>
                    <SelectItem value="4">4+ Bedrooms</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={bathrooms} onValueChange={setBathrooms}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Bathrooms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Baths</SelectItem>
                    <SelectItem value="1">1+ Baths</SelectItem>
                    <SelectItem value="1.5">1.5+ Baths</SelectItem>
                    <SelectItem value="2">2+ Baths</SelectItem>
                    <SelectItem value="3">3+ Baths</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={maxDom} onValueChange={setMaxDom}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Days on market" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any DOM</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sqftMin} onValueChange={setSqftMin}>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Min sqft" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any sqft</SelectItem>
                    <SelectItem value="800">800+</SelectItem>
                    <SelectItem value="1200">1200+</SelectItem>
                    <SelectItem value="1600">1600+</SelectItem>
                    <SelectItem value="2000">2000+</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant={priceDropsOnly ? "default" : "secondary"}
                  className="shrink-0"
                  onClick={() => setPriceDropsOnly((v) => !v)}
                >
                  Price drops
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400 text-sm">
                  {isLoading ? "Searching..." : `${listings.length} active listing(s)`}
                  {isError ? " (search failed)" : ""}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {listings.map((listing) => {
              const photos = safePhotos(listing.photos);
              const hero = photos.length > 0 ? photos[0] : null;
              const locationLabel = [listing.city, listing.stateCode].filter(Boolean).join(", ");

              return (
                <Card
                  key={listing.id}
                  className="bg-navy-800/50 border-navy-600 backdrop-blur-sm hover:bg-navy-700/50 transition-colors overflow-hidden"
                >
                  <CardHeader className="p-0">
                    <div className="relative">
                      {hero ? (
                        <img
                          src={hero}
                          alt={listing.title}
                          className="w-full h-56 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-56 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                          <div className="text-slate-400 text-sm">No photo</div>
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-orange-600 hover:bg-orange-700">For Sale</Badge>
                      </div>
                      <div className="absolute top-4 right-4">
                        <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-md">
                          {formatCurrency(listing.price)}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-white leading-snug">
                        {listing.title}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span>
                          {locationLabel || `${listing.countyFips}, ${listing.stateCode}`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-200">
                        <BedDouble className="h-4 w-4 text-slate-400" />
                        <span>{listing.beds ?? "?"} bd</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-200">
                        <Bath className="h-4 w-4 text-slate-400" />
                        <span>{listing.baths ?? "?"} ba</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-200">
                        <Square className="h-4 w-4 text-slate-400" />
                        <span>{listing.sqft ?? "?"} sqft</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <div className="text-xs text-slate-400">
                        Contact is intent-gated (Decision Card required).
                      </div>
                      <Link href={`/homescout/listings/${listing.id}`}>
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!isLoading && listings.length === 0 && (
            <Card className="bg-slate-950/60 border-slate-800">
              <CardHeader>
                <CardTitle className="text-slate-100">No active listings yet</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 space-y-3">
                <p>
                  HomeScout inventory is county-first. If you're the first to post a listing here,
                  it will appear after admin review.
                </p>
                <div className="flex gap-2">
                  <Link href="/property-listing">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-black font-semibold">
                      List a home
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </CountyRequiredGate>
    </RealEstateMarketplaceShell>
  );
});

export default RealEstateMarketplace;
