import React, { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { MapPin, BedDouble, Bath, Square, Home, ShieldAlert, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import {
  ContactOutcomeModal,
  type ContactOutcome,
} from "@/components/community/ContactOutcomeModal";

type HomeScoutListing = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  price: string | number;
  propertyType?: string | null;
  beds?: number | null;
  baths?: string | number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  yearBuilt?: number | null;
  features?: string[] | null;
  photos?: string[] | null;
  countyFips: string;
  stateCode: string;
  city?: string | null;
  zipCode?: string | null;
  address1?: string | null;
  address2?: string | null;
  addressVisibility?: "exact" | "approximate" | string | null;
  listedAt?: string | null;
  createdAt?: string | null;
  contactUserId?: string | null;
  sellerUserId?: string | null;
  agentUserId?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

type HomeScoutListingEvent = {
  id: string;
  eventType: string;
  observedAt: string;
  payload: any;
};

type HomeScoutMarketBucket = {
  countyFips: string;
  stateCode: string;
  propertyType: string;
  bedsBucket?: number | null;
  activeCount: number;
  medianPrice?: string | number | null;
  medianPricePerSqft?: string | number | null;
  medianDomDays?: number | null;
  priceDropCount7d?: number | null;
  computedAt?: string | null;
};

type CountyMetric = {
  countyFips: string;
  metricKey: string;
  metricValue: string | number;
  updatedAt?: string | null;
};

type ListingResponse = {
  listing: HomeScoutListing;
  contactUserId: string | null;
  events: HomeScoutListingEvent[];
  marketBucket: HomeScoutMarketBucket | null;
  countyMetrics: CountyMetric[];
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

export default function HomeScoutListingPage() {
  const [match, params] = useRoute("/homescout/listings/:id");
  const listingId = params?.id ? String(params.id) : "";
  const [contactOutcome, setContactOutcome] = useState<ContactOutcome | null>(null);

  const { data, isLoading, isError, error } = useQuery<ListingResponse>({
    queryKey: ["/api/homescout/listings", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/homescout/listings/${encodeURIComponent(listingId)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.message || "Failed to load listing";
        throw new Error(message);
      }
      return res.json();
    },
    enabled: Boolean(match && listingId),
  });

  const listing = data?.listing ?? null;
  const contactUserId = data?.contactUserId ?? null;
  const events = Array.isArray(data?.events) ? data!.events : [];
  const marketBucket = data?.marketBucket ?? null;
  const countyMetrics = Array.isArray(data?.countyMetrics) ? data!.countyMetrics : [];

  const { data: contactPublicProfile } = useQuery<any>({
    queryKey: ["/api/users/public", contactUserId],
    queryFn: async () => {
      if (!contactUserId) return null;
      const res = await fetch(`/api/users/${encodeURIComponent(contactUserId)}/public`, {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(contactUserId),
  });

  const primaryPhoto = useMemo(() => {
    const photos = safePhotos(listing?.photos);
    return photos.length > 0 ? photos[0] : null;
  }, [listing?.photos]);

  const priceEvents = useMemo(() => {
    return events
      .filter((e) => String(e.eventType) === "price_changed")
      .sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt))
      .slice(0, 20);
  }, [events]);

  const statusEvents = useMemo(() => {
    return events
      .filter((e) => String(e.eventType) === "status_changed" || String(e.eventType) === "created")
      .sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt))
      .slice(0, 20);
  }, [events]);

  const metricMap = useMemo(() => {
    const m = new Map<string, string | number>();
    for (const cm of countyMetrics) {
      if (cm?.metricKey) m.set(String(cm.metricKey), cm.metricValue);
    }
    return m;
  }, [countyMetrics]);

  if (!match) return null;
  if (isLoading) return <PageLoadingSpinner message="Loading HomeScout listing..." />;

  if (isError || !listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Card className="bg-slate-950/70 border-slate-800">
          <CardHeader>
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-orange-400" />
              Listing unavailable
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>{error instanceof Error ? error.message : "This listing could not be loaded."}</p>
            <div className="flex gap-2">
              <Link href="/real-estate-marketplace">
                <Button variant="outline" size="sm">
                  Back to HomeScout
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusLabel = String(listing.status || "active").replace(/_/g, " ");
  const locationLabel = [listing.city, listing.stateCode].filter(Boolean).join(", ");
  const coordsLabel = (() => {
    const lat = listing.latitude != null ? Number(listing.latitude) : NaN;
    const lng = listing.longitude != null ? Number(listing.longitude) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  })();

  const canContact = Boolean(contactUserId);
  const targetName =
    (contactPublicProfile as any)?.displayName ||
    (contactPublicProfile as any)?.name ||
    (contactPublicProfile as any)?.fullName ||
    "Listing contact";
  const targetRole =
    (contactPublicProfile as any)?.role ||
    (contactPublicProfile as any)?.userRole ||
    "Seller/Agent";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-orange-500" />
            <h1 className="text-2xl md:text-3xl font-bold text-slate-100">{listing.title}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span>{locationLabel || `${listing.countyFips}, ${listing.stateCode}`}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-700 text-slate-200">
            {statusLabel}
          </Badge>
          <div className="text-xl font-semibold text-slate-100">
            {formatCurrency(listing.price)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="bg-slate-950/60 border-slate-800 overflow-hidden">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={listing.title}
                className="w-full h-72 md:h-96 object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-72 md:h-96 bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
                <div className="text-slate-400 text-sm">No photos yet</div>
              </div>
            )}
          </Card>

          {listing.description && (
            <Card className="bg-slate-950/60 border-slate-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-slate-100">About this home</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-300 whitespace-pre-wrap">
                {listing.description}
              </CardContent>
            </Card>
          )}

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Price history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {priceEvents.length === 0 ? (
                <div className="text-xs text-slate-400">No recorded price changes yet.</div>
              ) : (
                priceEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-200">
                      {formatCurrency((e.payload as any)?.from ?? 0)} →{" "}
                      <span className="font-semibold">
                        {formatCurrency((e.payload as any)?.to ?? 0)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Type</span>
                <span className="font-medium text-slate-100">{listing.propertyType || "Home"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <BedDouble className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.beds ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Beds</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Bath className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.baths ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Baths</div>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Square className="h-4 w-4 text-slate-400" />
                    <span className="font-semibold">{listing.sqft ?? "?"}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Sqft</div>
                </div>
              </div>
              {listing.yearBuilt != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Year built</span>
                  <span className="font-medium text-slate-100">{listing.yearBuilt}</span>
                </div>
              )}
              {listing.lotSqft != null && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Lot</span>
                  <span className="font-medium text-slate-100">{listing.lotSqft} sqft</span>
                </div>
              )}
              {coordsLabel ? (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-slate-400">Coords</span>
                  <span className="font-medium text-slate-100">{coordsLabel}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">County context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Active listings</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_active_listings") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Median price</span>
                <span className="font-medium text-slate-100">
                  {metricMap.has("homescout_median_price")
                    ? formatCurrency(metricMap.get("homescout_median_price") as any)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Median DOM</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_median_dom_days") ?? "—")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Price drops (7d)</span>
                <span className="font-medium text-slate-100">
                  {String(metricMap.get("homescout_price_drops_7d") ?? "—")}
                </span>
              </div>

              {marketBucket ? (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400">Similar homes snapshot</div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Count</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.activeCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Median price</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.medianPrice != null
                        ? formatCurrency(marketBucket.medianPrice as any)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Median $/sqft</span>
                    <span className="font-medium text-slate-100">
                      {marketBucket.medianPricePerSqft != null
                        ? `$${Math.round(Number(marketBucket.medianPricePerSqft))}`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Status timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              {statusEvents.length === 0 ? (
                <div className="text-xs text-slate-400">No recorded status timeline yet.</div>
              ) : (
                statusEvents.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3">
                    <div className="text-slate-200">
                      {String((e.payload as any)?.from ?? "").trim()
                        ? `${String((e.payload as any)?.from).replace(/_/g, " ")} → ${String(
                            (e.payload as any)?.to ?? ""
                          ).replace(/_/g, " ")}`
                        : String((e.payload as any)?.status ?? listing.status).replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                      {new Date(e.observedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-950/60 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-slate-100">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="space-y-1">
                <div className="text-slate-100 font-semibold">{targetName}</div>
                <div className="text-xs text-slate-400">
                  {String(targetRole).replace(/_/g, " ")}
                </div>
                <div className="text-xs text-slate-500">
                  HomeScout never exposes direct contact without intent gating.
                </div>
              </div>
              <Button
                className="w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold"
                disabled={!canContact}
                onClick={() => {
                  if (!contactUserId) return;
                  setContactOutcome({
                    targetUserId: contactUserId,
                    targetUserName: targetName,
                    targetRole: String(targetRole),
                    targetLocation: locationLabel || undefined,
                    suggestedIntent: "advise",
                    reasonForContact: `Hi ${targetName} — I'm interested in this listing. Can we discuss next steps?`,
                    riskFlags: [],
                    decisionScope: `homescout_listing:${listing.id}`,
                    decisionTitle: `HomeScout: ${listing.title}`,
                  });
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Request contact
              </Button>
              <Link href="/real-estate-marketplace">
                <Button variant="outline" className="w-full">
                  Back to HomeScout
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {contactOutcome && (
        <ContactOutcomeModal outcome={contactOutcome} onClose={() => setContactOutcome(null)} />
      )}
    </div>
  );
}
