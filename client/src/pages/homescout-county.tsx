import React, { memo, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
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
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { formatCountyLabel } from "@/utils/countyFipsToName";

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

const HomeScoutCountyPage = memo(function HomeScoutCountyPage() {
  const [match, params] = useRoute("/homescout/:stateCode/:countyFips");
  const stateCode = String(params?.stateCode || "").toUpperCase();
  const countyFips = String(params?.countyFips || "");

  const [searchQuery, setSearchQuery] = useState("");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [bedrooms, setBedrooms] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<string>("all");

  const validCounty = /^[0-9]{5}$/.test(countyFips);
  const validState = /^[A-Z]{2}$/.test(stateCode);

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

  const queryKey = useMemo(
    () => [
      "/api/homescout/search",
      countyFips,
      stateCode,
      searchQuery.trim(),
      propertyType,
      String(bedsMin ?? ""),
      String(minPrice ?? ""),
      String(maxPrice ?? ""),
    ],
    [countyFips, stateCode, searchQuery, propertyType, bedsMin, minPrice, maxPrice]
  );

  const {
    data: listings = [],
    isLoading,
    isError,
    error,
  } = useQuery<HomeScoutListing[]>({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("countyFips", countyFips);
      sp.set("stateCode", stateCode);
      const q = searchQuery.trim();
      if (q) sp.set("query", q);
      if (propertyType !== "all") sp.set("propertyType", propertyType);
      if (bedsMin != null) sp.set("bedsMin", String(bedsMin));
      if (minPrice != null) sp.set("minPrice", String(minPrice));
      if (maxPrice != null) sp.set("maxPrice", String(maxPrice));
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
    enabled: Boolean(match && validCounty && validState),
  });

  if (!match) return null;

  if (!validCounty || !validState) {
    return (
      <RealEstateMarketplaceShell>
        <div className="max-w-3xl mx-auto px-4 py-10">
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Invalid HomeScout county</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 space-y-3">
              <p>Expected URL format: /homescout/CA/06001</p>
              <Link href="/homescout-listings">
                <Button variant="outline" size="sm">
                  Go to HomeScout
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </RealEstateMarketplaceShell>
    );
  }

  const locationLabel = formatCountyLabel(countyFips, stateCode);

  return (
    <RealEstateMarketplaceShell>
      <div className="max-w-6xl mx-auto px-4 py-5 md:py-8 space-y-4 md:space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-4">
          <div className="space-y-0.5 md:space-y-1">
            <div className="flex items-center gap-3">
              <Home className="h-6 w-6 md:h-7 md:w-7 text-ts-orange" />
              <h1 className="text-2xl md:text-4xl font-bold text-white">HomeScout Listings</h1>
            </div>
            <p className="text-sm md:text-base text-white/70">
              HomeScout Listings for this county. Contact remains intent-based.
            </p>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <MapPin className="h-3.5 w-3.5" />
              <span>{locationLabel}</span>
            </div>
          </div>
          <div className="flex w-full md:w-auto gap-2">
            <Link href="/exchange?tab=sell&category=real-estate">
              <Button className="w-full md:w-auto bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold">
                <PlusCircle className="h-4 w-4 mr-2" />
                Open HomeScout Listings
              </Button>
            </Link>
          </div>
        </div>

        <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 md:gap-4 mb-3 md:mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/60" />
                <Input
                  placeholder="Search title or city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-tsCard border-white/10 text-white"
                />
              </div>

              <Select value={priceRange} onValueChange={setPriceRange}>
                <SelectTrigger className="bg-tsCard border-white/10 text-white">
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
                <SelectTrigger className="bg-tsCard border-white/10 text-white">
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
                <SelectTrigger className="bg-tsCard border-white/10 text-white">
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
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-white/60" />
              <span className="text-white/60 text-sm">
                {isLoading ? "Searching..." : `${listings.length} active listing(s)`}
                {isError ? " (search failed)" : ""}
              </span>
            </div>
            {isError && (
              <div className="mt-2 text-xs text-red-300">
                {formatUserFacingErrorMessage(error, "Search failed")}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {listings.map((listing) => {
            const photos = safePhotos(listing.photos);
            const hero = photos.length > 0 ? photos[0] : null;
            const cityLabel = [listing.city, listing.stateCode].filter(Boolean).join(", ");

            return (
              <Card
                key={listing.id}
                className="bg-tsCard/50 border-white/10 backdrop-blur-sm hover:bg-tsCard/50 transition-colors overflow-hidden"
              >
                <CardHeader className="p-0">
                  <div className="relative">
                    {hero ? (
                      <img
                        src={hero}
                        alt={listing.title}
                        className="w-full h-44 sm:h-52 md:h-56 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-44 sm:h-52 md:h-56 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                        <div className="text-white/60 text-sm">No photo</div>
                      </div>
                    )}
                    <div className="absolute top-3 md:top-4 left-3 md:left-4">
                      <Badge className="bg-ts-orange-dark hover:bg-ts-orange-dark">For Sale</Badge>
                    </div>
                    <div className="absolute bottom-3 md:bottom-4 left-3 md:left-4">
                      <Badge className="bg-black/60 text-white border-white/10">
                        {String((listing as any).listingAuthorType || "owner") === "agent"
                          ? "By agent"
                          : "By owner"}
                      </Badge>
                    </div>
                    <div className="absolute top-3 md:top-4 right-3 md:right-4">
                      <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-md">
                        {formatCurrency(listing.price)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-5 space-y-2.5 md:space-y-3">
                  <div className="space-y-1">
                    <div className="text-base md:text-lg font-semibold text-white leading-snug">
                      {listing.title}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <MapPin className="h-4 w-4 text-white/60" />
                      <span>
                        {cityLabel || formatCountyLabel(listing.countyFips, listing.stateCode)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-white/70">
                      <BedDouble className="h-4 w-4 text-white/60" />
                      <span>{listing.beds ?? "?"} bd</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <Bath className="h-4 w-4 text-white/60" />
                      <span>{listing.baths ?? "?"} ba</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70">
                      <Square className="h-4 w-4 text-white/60" />
                      <span>{listing.sqft ?? "?"} sqft</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <div className="text-xs text-white/60">
                      Contact requires intent confirmation (Decision Card required).
                    </div>
                    <Link href={`/homescout/listings/${listing.id}`}>
                      <Button
                        size="sm"
                        className="bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold"
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
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">No active listings yet</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-white/70 space-y-3">
              <p>Use Exchange when you want to launch a sale listing for this county.</p>
              <Link href="/exchange?tab=sell&category=real-estate">
                <Button className="bg-ts-orange hover:bg-ts-orange-dark text-black font-semibold">
                  Open HomeScout Listings
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </RealEstateMarketplaceShell>
  );
});

export default HomeScoutCountyPage;
