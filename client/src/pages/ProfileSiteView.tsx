import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { MessageCircle, ShieldCheck, Calendar, Clock3, DollarSign } from "lucide-react";

type ProfileSections = {
  about?: boolean;
  rolesAndBadges?: boolean;
  stats?: boolean;
  services?: boolean;
  marketplaceListings?: boolean;
  reviews?: boolean;
  communityActivity?: boolean;
  contactCard?: boolean;
};

type PublicProfile = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  roleContext: string;
  contentBlocks: any;
  ctaConfig: any;
  seoMeta: any;
  profileSections?: ProfileSections | null;
  contactPolicy?: {
    mode?: "direct_connect_only";
    requiresTradeScoutAccount?: boolean;
    reason?: string;
  } | null;
  profileBooking?: {
    enabled?: boolean;
    paidBookings?: boolean;
    bookingPriceUsd?: number;
    calendarVisibility?: "public" | "private";
    timezone?: string;
    slots?: Array<{
      id: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      label?: string;
      active?: boolean;
    }>;
    pricingTableEnabled?: boolean;
    pricingRows?: Array<{
      id: string;
      name: string;
      priceLabel: string;
      description?: string;
    }>;
  } | null;
};

type PublicBusinessSubset = {
  id: string;
  name: string;
  categories: string[];
  serviceAreas: string[];
} | null;

type PublicProfileResponse = {
  profile: PublicProfile;
  business: PublicBusinessSubset;
};

export default function ProfileSiteView() {
  const [, paramsU] = useRoute("/u/:slug");
  const [matchP, paramsP] = useRoute("/p/:slug");
  const [, navigate] = useLocation();
  const slug = (paramsU?.slug || paramsP?.slug || "").trim();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    if (matchP) {
      navigate(`/u/${encodeURIComponent(slug)}`, { replace: true });
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setNotFound(false);

        const response = await fetch(`/api/u/${encodeURIComponent(slug)}`);
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error("Failed to fetch profile");

        const json = (await response.json()) as PublicProfileResponse;
        setData(json);
      } catch (e) {
        console.error("Error fetching profile:", e);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [slug, matchP, navigate]);

  if (loading) {
    return (
      <div className=" flex items-center justify-center">
        <div className="ts-surface px-4 py-6 md:px-10 md:py-8 text-white">
          Loading profile site…
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className=" flex items-center justify-center px-4">
        <Card className="bg-tsCard border-white/10 w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Profile not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">
              This profile may be private, unpublished, or unavailable.
            </p>
            <Link href="/">
              <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                Back to Scout
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, business } = data;
  const profileSections = profile.profileSections || {};
  const showContactCard = profileSections.contactCard !== false;
  const booking = profile.profileBooking || {};
  const bookingEnabled = booking.enabled === true;
  const paidBookings = booking.paidBookings === true;
  const bookingPriceUsd = Number(booking.bookingPriceUsd || 0);
  const calendarVisibility = booking.calendarVisibility === "private" ? "private" : "public";
  const slots = Array.isArray(booking.slots)
    ? booking.slots.filter((slot) => slot && slot.active !== false)
    : [];
  const pricingRows = Array.isArray(booking.pricingRows) ? booking.pricingRows : [];
  const timezone =
    typeof booking.timezone === "string" && booking.timezone.trim().length > 0
      ? booking.timezone
      : "America/Chicago";
  const displayName =
    business?.name && business.name.trim().length > 0 ? business.name : profile.displayName;
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const seoTitle =
    typeof profile.seoMeta?.title === "string" && profile.seoMeta.title.trim().length > 0
      ? profile.seoMeta.title
      : `${displayName} | TradeScout`;
  const seoDescription =
    typeof profile.seoMeta?.description === "string" &&
    profile.seoMeta.description.trim().length > 0
      ? profile.seoMeta.description
      : profile.headline ||
        `${displayName} on TradeScout. Public profile discoverable on web search with protected contact through Direct Connect.`;
  const seoImage =
    typeof profile.seoMeta?.imageUrl === "string" && profile.seoMeta.imageUrl.trim().length > 0
      ? profile.seoMeta.imageUrl
      : undefined;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": business?.name ? "LocalBusiness" : "Person",
    name: displayName,
    description: seoDescription,
    url: `${getCanonicalAppOrigin()}/u/${encodeURIComponent(profile.slug)}`,
    ...(business?.categories?.length ? { category: business.categories.slice(0, 6) } : {}),
    ...(business?.serviceAreas?.length ? { areaServed: business.serviceAreas.slice(0, 10) } : {}),
  };

  return (
    <div className=" py-8">
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        canonical={`${getCanonicalAppOrigin()}/u/${encodeURIComponent(profile.slug)}`}
        ogType="profile"
        ogImage={seoImage}
        structuredData={structuredData}
      />
      <div className="container mx-auto px-4 max-w-5xl">
        <Card className="bg-tsCard border-white/10">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-white text-3xl">{displayName}</CardTitle>
                {profile.headline && profileSections.about !== false ? (
                  <p className="text-white/70">{profile.headline}</p>
                ) : null}
                {profileSections.about !== false ? (
                  <p className="text-white/60 text-xs uppercase tracking-[0.18em]">
                    {profile.roleContext}
                  </p>
                ) : null}
              </div>
              <Badge variant="secondary">Website Profile</Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {business ? (
              <section className="space-y-2">
                <h2 className="text-white font-semibold">Business</h2>
                <div className="text-white/70 text-sm space-y-1">
                  <div>
                    <span className="text-white/60">Name:</span> {business.name}
                  </div>
                  <div>
                    <span className="text-white/60">Categories:</span>{" "}
                    {business.categories.length ? business.categories.join(", ") : "None"}
                  </div>
                  <div>
                    <span className="text-white/60">Service areas:</span>{" "}
                    {business.serviceAreas.length
                      ? `${business.serviceAreas.length} area(s)`
                      : "None"}
                  </div>
                </div>
              </section>
            ) : null}

            {bookingEnabled ? (
              <section className="space-y-3 pt-2 border-t border-white/10">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-ts-orange" />
                  Bookings
                </h2>
                <p className="text-sm text-white/70">
                  Booking requests route through TradeScout Direct Connect for protected contact.
                </p>
                {calendarVisibility === "public" && slots.length > 0 ? (
                  <div className="space-y-1 text-sm text-white/70">
                    <div className="text-xs text-white/60 flex items-center gap-1 uppercase tracking-wider">
                      <Clock3 className="h-3.5 w-3.5" />
                      Availability ({timezone})
                    </div>
                    {slots.slice(0, 14).map((slot) => (
                      <div key={slot.id} className="flex justify-between gap-4">
                        <span>{dayNames[slot.dayOfWeek] || "Day"}</span>
                        <span>
                          {slot.startTime} - {slot.endTime}
                          {slot.label ? ` (${slot.label})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {booking.pricingTableEnabled === true && pricingRows.length > 0 ? (
                  <div className="space-y-1 text-sm text-white/70">
                    <div className="text-xs text-white/60 uppercase tracking-wider">
                      Pricing table
                    </div>
                    {pricingRows.slice(0, 10).map((row) => (
                      <div key={row.id} className="flex justify-between gap-4">
                        <span>{row.name}</span>
                        <span className="font-medium">{row.priceLabel}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/pre-scout-setup?mode=create&next=${encodeURIComponent(`/direct-connect?profile=${profile.slug}`)}`}
                  >
                    <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                      Request Booking
                    </Button>
                  </Link>
                  {paidBookings && bookingPriceUsd > 0 ? (
                    <Link
                      href={`/checkout/booking/${encodeURIComponent(profile.id)}?amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${encodeURIComponent(`Booking deposit for ${displayName}`)}`}
                    >
                      <Button variant="outline" className="border-white/10 text-white/70">
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pay deposit (${bookingPriceUsd.toFixed(2)})
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </section>
            ) : null}

            {showContactCard && (
              <section className="space-y-3 pt-2 border-t border-white/10">
                <h2 className="text-white font-semibold">Contact</h2>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-2 text-sm text-white/70">
                    <div className="flex items-center gap-2 text-white/70">
                      <ShieldCheck className="h-4 w-4 text-ts-orange" />
                      <span>
                        Contact is protected to prevent spam
                        {profile.contactPolicy?.reason
                          ? ` (${profile.contactPolicy.reason.toLowerCase()})`
                          : "."}
                      </span>
                    </div>
                    <p className="text-white/60">
                      Create a free TradeScout account to contact this profile through Direct
                      Connect.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <Link
                      href={`/pre-scout-setup?mode=create&next=${encodeURIComponent(`/direct-connect?profile=${profile.slug}`)}`}
                    >
                      <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <span>Start Direct Connect</span>
                      </Button>
                    </Link>
                    <Link
                      href={`/pre-scout-setup?mode=signin&next=${encodeURIComponent(`/direct-connect?profile=${profile.slug}`)}`}
                    >
                      <Button variant="outline" className="border-white/10 text-white/70">
                        Sign in
                      </Button>
                    </Link>
                  </div>
                </div>
              </section>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
