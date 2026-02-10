import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, MapPin, Globe, Edit, MessageSquare, Loader2, Shield } from "lucide-react";
import type { BusinessProfile } from "@/../../shared/businessProfile";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwner = user?.businessSlug === slug;

  useEffect(() => {
    if (!slug) {
      setError("Invalid profile URL");
      setLoading(false);
      return;
    }

    async function fetchProfile() {
      try {
        const response = await fetch(`/api/business-profile/slug/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            setError("Business profile not found");
          } else {
            setError("Failed to load profile");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setProfile(data);

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

  const canonicalUrl = `https://www.thetradescout.com/business/${profile.slug}`;

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
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setLocation(`/claim-my-business?slug=${encodeURIComponent(profile.slug)}`)
                }
              >
                <Shield className="h-4 w-4 mr-2" />
                Claim This Business
              </Button>
            )}
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
