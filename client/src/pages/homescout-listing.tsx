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
};

type ListingResponse = { listing: HomeScoutListing; contactUserId: string | null };

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
