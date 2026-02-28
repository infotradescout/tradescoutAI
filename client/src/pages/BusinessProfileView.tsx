import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Globe, Edit, MessageSquare, Loader2, Shield } from "lucide-react";
import type { BusinessProfile } from "@/../../shared/businessProfile";
import type { MarketplaceListing } from "@shared/schema";
import { recordActivity } from "@/agent/activity";
import { useAuth } from "@/hooks/useAuth";
import { SEOHelmet } from "@/components/SEOHelmet";

/**
 * PublicBusinessProfileView
 *
 * Renders a public business profile page at /business/:slug.
 *
 * Contract:
 * - Fetches via GET /api/business-profile/slug/:slug
 * - Renders: name, location, description, service areas, website
 * - Primary CTA: "Contact via TradeScout" → routes to Direct Connect or Scout
 * - Owner-only: Shows "Edit Profile" button
 * - Telemetry: business_profile_viewed { slug, isOwner }
 * - Empty state: "Tell your community about your business" if no description
 */
export default function BusinessProfileView() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [profileSource, setProfileSource] = useState<"published" | "directory" | null>(null);
  const [directoryBusinessId, setDirectoryBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);

  const isOwner = user?.businessSlug === slug;

  function formatListingPrice(price: MarketplaceListing["price"]): string {
    const numeric = typeof price === "number" ? price : Number((price as any) ?? 0);
    if (!Number.isFinite(numeric)) return "—";
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  useEffect(() => {
    if (!slug) {
      setError("Invalid profile URL");
      setLoading(false);
      return;
    }

    setListings([]);
    setListingsError(null);
    setListingsLoading(false);

    async function fetchProfile() {
      try {
        const response = await fetch(`/api/business-profile/slug/${slug}`);

        if (!response.ok) {
          if (response.status !== 404) {
            setError("Failed to load profile");
            setLoading(false);
            return;
          }

          // Fallback: directory listing (unclaimed/claimable businesses table).
          const directoryRes = await fetch(`/api/public/businesses/${slug}`);
          if (!directoryRes.ok) {
            setError("Business profile not found");
            setLoading(false);
            return;
          }

          const directoryData: any = await directoryRes.json();
          const counties = Array.isArray(directoryData?.counties) ? directoryData.counties : [];
          const primaryCounty = counties[0] || null;

          const directoryProfile: BusinessProfile = {
            id: String(directoryData?.id || ""),
            userId: null as any,
            slug: String(directoryData?.slug || slug),
            name: String(directoryData?.name || slug),
            description: directoryData?.profile?.description ?? null,
            countyFips: primaryCounty?.fips || null,
            countyName: primaryCounty?.name || null,
            city: null,
            stateCode: primaryCounty?.stateCode || null,
            serviceAreas: counties.map((c: any) => String(c?.name || "")).filter(Boolean),
            // Prevent contact bypass for directory shells; contact stays Scout-gated.
            website: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: null as any,
            // These optional fields are read by the view; keep safe defaults.
            verificationStatus: "pending" as any,
            addressVerified: false as any,
            cvsScore: null as any,
          } as any;

          setDirectoryBusinessId(String(directoryData?.id || ""));
          setProfileSource("directory");
          setProfile(directoryProfile);
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProfileSource("published");
        setDirectoryBusinessId(null);
        setProfile(data);

        // Show marketplace catalog without introducing contact bypass.
        if (data?.userId) {
          setListingsLoading(true);
          setListingsError(null);
          try {
            const params = new URLSearchParams({
              sellerId: String(data.userId),
              limit: "6",
              offset: "0",
            });
            const listingsRes = await fetch(`/api/marketplace/listings?${params.toString()}`);
            if (!listingsRes.ok) {
              throw new Error(`Failed to load listings (${listingsRes.status})`);
            }
            const raw = await listingsRes.json();
            setListings(Array.isArray(raw) ? (raw as MarketplaceListing[]) : []);
          } catch (err) {
            console.error("Error fetching business listings:", err);
            setListingsError("Failed to load listings");
          } finally {
            setListingsLoading(false);
          }
        }

        // Non-optional telemetry
        recordActivity({
          type: "business_profile_viewed" as any,
          ts: new Date().toISOString(),
          path: window.location.pathname,
          meta: {
            slug,
            isOwner: user?.businessSlug === slug,
          },
        });
      } catch (err) {
        console.error("Error fetching business profile:", err);
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [slug, user?.businessSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2" data-testid="not-found">
                {error || "Profile not found"}
              </h2>
              <p className="text-muted-foreground mb-6">
                This business profile could not be loaded.
              </p>
              <Button onClick={() => setLocation("/community")}>Browse Community</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasDescription = profile.description && profile.description.trim().length > 0;
  const hasServiceAreas = profile.serviceAreas && profile.serviceAreas.length > 0;
  const verificationStatus = String(profile.verificationStatus || "").toLowerCase();
  const addressVerified = Boolean(profile.addressVerified);
  const rawCvs =
    typeof profile.cvsScore === "number"
      ? profile.cvsScore
      : typeof profile.cvsScore === "string" && profile.cvsScore.trim().length > 0
        ? Number(profile.cvsScore)
        : null;
  const cvsScore = Number.isFinite(rawCvs as number) ? Number(rawCvs) : null;
  const verificationTone = (() => {
    if (verificationStatus === "approved") return "bg-emerald-600 text-white";
    if (verificationStatus === "under_review" || verificationStatus === "pending") {
      return "bg-amber-500 text-slate-950";
    }
    if (verificationStatus === "rejected" || verificationStatus === "expired") {
      return "bg-red-600 text-white";
    }
    if (verificationStatus === "suspended") return "bg-slate-700 text-white";
    return "bg-slate-700 text-white";
  })();
  const verificationLabel = (() => {
    if (verificationStatus === "approved") return "Professional Verified";
    if (verificationStatus === "under_review") return "Verification Review";
    if (verificationStatus === "pending") return "Verification Pending";
    if (verificationStatus === "rejected") return "Verification Required";
    if (verificationStatus === "expired") return "Verification Expired";
    if (verificationStatus === "suspended") return "Verification Suspended";
    return "Verification Pending";
  })();

  // SEO metadata
  const pageTitle =
    profile.countyName && profile.stateCode
      ? `${profile.name} in ${profile.countyName}, ${profile.stateCode} | TradeScout`
      : `${profile.name} | TradeScout`;

  const pageDescription = hasDescription
    ? (profile.description || "").slice(0, 155) // Meta description limit
    : `${profile.name} serving ${profile.countyName || "local areas"}${profile.serviceAreas && profile.serviceAreas.length > 0 ? " and nearby areas" : ""}. Contact via TradeScout.`;

  const canonicalUrl = `${window.location.origin}/business/${profile.slug}`;
  const showClaimCta = !isOwner && profileSource === "directory" && Boolean(directoryBusinessId);

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* SEO Metadata */}
      <SEOHelmet
        title={pageTitle}
        description={pageDescription}
        canonical={canonicalUrl}
        ogType="profile"
      />
      {/* Header Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:justify-between gap-4">
            <div className="flex-1">
              <CardTitle
                className="text-3xl mb-2 flex items-center gap-2"
                data-testid="bp-headline"
              >
                <Building2 className="h-8 w-8" />
                {profile.name}
              </CardTitle>

              {/* Location */}
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <MapPin className="h-4 w-4" />
                <span>
                  {profile.city && `${profile.city}, `}
                  {profile.countyName && profile.stateCode ? (
                    <a
                      href={`/county/${profile.stateCode.toLowerCase()}/${profile.countyName.toLowerCase().replace(/\s+/g, "-")}`}
                      className="text-primary hover:underline"
                    >
                      {profile.countyName}, {profile.stateCode}
                    </a>
                  ) : (
                    profile.countyName && `${profile.countyName}, ${profile.stateCode}`
                  )}
                </span>
              </div>

              {/* Website */}
              {profile.website && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {profile.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Badge className={verificationTone}>
                  <Shield className="h-3 w-3 mr-1" />
                  {verificationLabel}
                </Badge>
                <Badge variant="outline" className="border-[color:var(--border-subtle)]">
                  {addressVerified ? "Address Verified" : "Address Verification Required"}
                </Badge>
                <Badge variant="outline" className="border-[color:var(--border-subtle)]">
                  {cvsScore !== null ? `CVS ${Math.round(cvsScore)}` : "CVS Pending"}
                </Badge>
              </div>
            </div>

            {/* Owner-only: Edit button */}
            {isOwner ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/business/${slug}/edit`)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            ) : showClaimCta ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(
                    `/claim-my-business?businessId=${encodeURIComponent(String(directoryBusinessId))}`
                  )
                }
              >
                <Shield className="h-4 w-4 mr-2" />
                Claim This Business
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {/* Description */}
          {hasDescription ? (
            <p className="text-base leading-relaxed" data-testid="bp-mission">
              {profile.description}
            </p>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isOwner ? (
                <>
                  <p className="mb-4">Tell your community about your business.</p>
                  <Button variant="outline" onClick={() => setLocation(`/business/${slug}/edit`)}>
                    Add Description
                  </Button>
                </>
              ) : (
                <p>This business hasn't added a description yet.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Areas */}
      {hasServiceAreas && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Service Areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profile.serviceAreas.map((area, idx) => (
                <Badge key={idx} variant="secondary">
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Listings (seller catalog) */}
      <Card className="mb-6" data-testid="bp-active-listings">
        <CardHeader>
          <CardTitle className="text-xl">Active Listings</CardTitle>
        </CardHeader>
        <CardContent>
          {listingsLoading && (
            <div className="text-sm text-muted-foreground">Loading listings…</div>
          )}

          {!listingsLoading && listingsError && (
            <div className="text-sm text-muted-foreground">{listingsError}</div>
          )}

          {!listingsLoading && !listingsError && listings.length === 0 && (
            <div className="text-sm text-muted-foreground">No active listings.</div>
          )}

          {!listingsLoading && !listingsError && listings.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {listings.map((listing) => {
                const images = (listing as any).images as string[] | undefined;
                const primaryIndex = (listing as any).primaryImageIndex as number | undefined;
                const thumbnailUrl = images?.length
                  ? (images[primaryIndex ?? 0] ?? images[0])
                  : null;

                const categoryName = (listing as any).categoryName as string | undefined;
                const createdAt = listing.createdAt
                  ? new Date(listing.createdAt as any).toLocaleDateString()
                  : null;

                return (
                  <article
                    key={listing.id}
                    className="flex gap-3 rounded-lg border border-border p-3"
                    data-testid="bp-listing-card"
                  >
                    {thumbnailUrl && (
                      <div className="h-14 w-14 flex-none overflow-hidden rounded-md bg-muted">
                        <img
                          src={thumbnailUrl}
                          alt={listing.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{listing.title}</div>
                          {listing.description && (
                            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {listing.description}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-sm font-semibold">
                          ${formatListingPrice(listing.price)}
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {listing.state}
                          {listing.county ? ` / ${listing.county}` : ""}
                        </span>
                        {categoryName ? <span>• {categoryName}</span> : null}
                        {createdAt ? <span>• {createdAt}</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Primary CTA: Contact via TradeScout */}
      {!isOwner && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Connect with {profile.name}</h3>
              <p className="text-muted-foreground mb-4">
                Reach out through TradeScout for trusted local connections.
              </p>
              <Button
                size="lg"
                data-testid="bp-contact-cta"
                onClick={() => {
                  // Route to Direct Connect with business context
                  // wouter doesn't support state, so we pass via query params
                  const params = new URLSearchParams({
                    prefill_businessName: profile.name,
                    prefill_businessSlug: profile.slug,
                    prefill_countyFips: profile.countyFips || "",
                  });
                  setLocation(`/direct-connect?${params.toString()}`);
                }}
              >
                <MessageSquare className="h-5 w-5 mr-2" />
                Contact via TradeScout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer: Explore more in county */}
      {profile.countyName && profile.stateCode && (
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <a
            href={`/county/${profile.stateCode.toLowerCase()}/${profile.countyName.toLowerCase().replace(/\s+/g, "-")}`}
            className="text-primary hover:underline"
          >
            Explore more businesses in {profile.countyName}
          </a>
        </div>
      )}
    </div>
  );
}
