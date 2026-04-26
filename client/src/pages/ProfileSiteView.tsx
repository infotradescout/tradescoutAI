import { useEffect, useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEOHelmet } from "@/components/SEOHelmet";
import { getCanonicalAppOrigin } from "@/lib/canonicalOrigin";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageCircle,
  ShieldCheck,
  Calendar,
  Clock3,
  DollarSign,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Page } from "@/components/layout/PagePrimitives";

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
  recommendationsDirectory?: Array<{
    id: string;
    createdAt: string | null;
    recommendationType: "positive" | "negative";
    comment: string;
    projectType: string | null;
    contractor: {
      id: string;
      companyName: string;
      slug: string;
    };
  }>;
  recommendationDirectorySummary?: {
    total: number;
    positive: number;
    negative: number;
  };
};

export default function ProfileSiteView() {
  const { user, isAuthenticated } = useAuth();
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
        <Card className="bg-tsCard w-full max-w-xl">
          <CardHeader>
            <CardTitle className="text-white">Profile not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-white/70">
              This profile may be private, unpublished, or unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, business } = data;
  const recommendationsDirectory = Array.isArray(data.recommendationsDirectory)
    ? data.recommendationsDirectory
    : [];
  const recommendationDirectorySummary = data.recommendationDirectorySummary || {
    total: recommendationsDirectory.length,
    positive: recommendationsDirectory.filter((row) => row.recommendationType === "positive")
      .length,
    negative: recommendationsDirectory.filter((row) => row.recommendationType === "negative")
      .length,
  };
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
  const normalizedViewerRole = String((user as any)?.role || "")
    .trim()
    .toLowerCase();
  const isSuperAdminViewer =
    Boolean((user as any)?.isSuperAdmin === true) || normalizedViewerRole === "super_admin";
  const hasViewerSession = isAuthenticated || Boolean((user as any)?.id);
  const directConnectHref = `/direct-connect?profile=${encodeURIComponent(profile.slug)}`;
  const preScoutCreateHref = `/pre-scout-setup?mode=create&next=${encodeURIComponent(directConnectHref)}`;
  const preScoutSignInHref = `/pre-scout-setup?mode=signin&next=${encodeURIComponent(directConnectHref)}`;
  const contentBlocks = Array.isArray(profile.contentBlocks) ? profile.contentBlocks : [];
  const aboutText = contentBlocks
    .filter((block) => block && typeof block === "object")
    .map((block: any) => {
      if (block.type === "about" || block.type === "hero") {
        const data = block?.data && typeof block.data === "object" ? block.data : {};
        const raw =
          typeof data.text === "string"
            ? data.text
            : typeof data.description === "string"
              ? data.description
              : typeof data.body === "string"
                ? data.body
                : "";
        return raw.trim();
      }
      return "";
    })
    .find((value) => value.length > 0);
  const serviceTags = Array.from(
    new Set(
      [
        ...(Array.isArray(business?.categories) ? business?.categories : []),
        ...contentBlocks.flatMap((block: any) => {
          if (block?.type !== "services") return [] as string[];
          const data = block?.data && typeof block.data === "object" ? block.data : {};
          if (Array.isArray(data.items)) {
            return data.items
              .map((item: unknown) => String(item || "").trim())
              .filter((item: string) => item.length > 0);
          }
          if (typeof data.text === "string") {
            return data.text
              .split(/\n|,|\u2022|- /g)
              .map((item: string) => item.trim())
              .filter((item: string) => item.length > 0);
          }
          return [] as string[];
        }),
      ]
        .map((item) => String(item || "").trim())
        .filter((item) => item.length > 0)
    )
  );
  const serviceAreas = Array.isArray(business?.serviceAreas) ? business.serviceAreas : [];
  const customBlocks = contentBlocks
    .filter((block) => block && typeof block === "object")
    .filter((block: any) => !["about", "hero", "services", "cta"].includes(String(block?.type)))
    .slice(0, 4)
    .map((block: any) => {
      const data = block?.data && typeof block.data === "object" ? block.data : {};
      const title =
        typeof data.title === "string"
          ? data.title
          : typeof block.type === "string"
            ? block.type.charAt(0).toUpperCase() + block.type.slice(1)
            : "Details";
      const body =
        typeof data.text === "string"
          ? data.text
          : typeof data.body === "string"
            ? data.body
            : typeof data.description === "string"
              ? data.description
              : "";
      return { title, body: body.trim() };
    })
    .filter((item) => item.body.length > 0);

  return (
    <Page className="max-w-6xl space-y-6">
      <SEOHelmet
        title={seoTitle}
        description={seoDescription}
        canonical={`${getCanonicalAppOrigin()}/u/${encodeURIComponent(profile.slug)}`}
        ogType="profile"
        ogImage={seoImage}
        structuredData={structuredData}
      />
      <Card className="bg-tsCard overflow-hidden">
        <CardHeader className="space-y-4 bg-gradient-to-br from-tsCard via-[#1a1d23] to-[#101217]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge variant="secondary">Website Profile</Badge>
              <CardTitle className="text-white text-3xl md:text-4xl">{displayName}</CardTitle>
              {profileSections.about !== false ? (
                <p className="text-white/70 text-sm uppercase tracking-[0.18em]">
                  {profile.roleContext}
                </p>
              ) : null}
              {profile.headline && profileSections.about !== false ? (
                <p className="text-white/80 max-w-2xl">{profile.headline}</p>
              ) : null}
            </div>
            {profileSections.stats !== false ? (
              <div className="grid grid-cols-2 gap-2 min-w-[220px]">
                <div className="rounded-md bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Services</p>
                  <p className="text-white text-lg font-semibold">{serviceTags.length}</p>
                </div>
                <div className="rounded-md bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Areas</p>
                  <p className="text-white text-lg font-semibold">{serviceAreas.length}</p>
                </div>
                <div className="rounded-md bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Availability</p>
                  <p className="text-white text-lg font-semibold">
                    {bookingEnabled ? "Open" : "By request"}
                  </p>
                </div>
                <div className="rounded-md bg-black/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-white/60">Contact</p>
                  <p className="text-white text-lg font-semibold">Protected</p>
                </div>
              </div>
            ) : null}
          </div>
          {profileSections.rolesAndBadges !== false ? (
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-ts-orange text-white">Verified on TradeScout</Badge>
              {business ? (
                <Badge className="bg-white/10 text-white">Business profile linked</Badge>
              ) : (
                <Badge className="bg-white/10 text-white">Individual profile</Badge>
              )}
              <Badge className="bg-white/10 text-white">Direct Connect protected</Badge>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-4 md:p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {profileSections.about !== false && (aboutText || profile.headline) ? (
                <section className="space-y-2">
                  <h2 className="text-white font-semibold text-lg">About</h2>
                  <p className="text-white/75 leading-relaxed">{aboutText || profile.headline}</p>
                </section>
              ) : null}

              {profileSections.services !== false && serviceTags.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Services</h2>
                  <div className="flex flex-wrap gap-2">
                    {serviceTags.slice(0, 24).map((service) => (
                      <Badge key={service} className="bg-white/10 text-white">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {profileSections.services !== false && serviceAreas.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Service Areas</h2>
                  <div className="flex flex-wrap gap-2">
                    {serviceAreas.slice(0, 20).map((area) => (
                      <Badge key={area} className="bg-white/10 text-white/80">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </section>
              ) : null}

              {profileSections.reviews !== false && recommendationsDirectory.length > 0 ? (
                <section id="recommendations-directory" className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-white font-semibold text-lg">Recommendations Directory</h2>
                    <div className="text-xs text-white/70">
                      {recommendationDirectorySummary.positive} positive,{" "}
                      {recommendationDirectorySummary.negative} negative (
                      {recommendationDirectorySummary.total} total)
                    </div>
                  </div>
                  <p className="text-xs text-white/60">
                    Share this section using this profile URL. Recommendations are public,
                    moderated, and tied to verified TradeScout activity.
                  </p>
                  <div className="space-y-3">
                    {recommendationsDirectory.slice(0, 24).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {entry.recommendationType === "positive" ? (
                              <Badge className="bg-emerald-600/80 text-white">
                                <ThumbsUp className="mr-1 h-3.5 w-3.5" />
                                Recommends
                              </Badge>
                            ) : (
                              <Badge className="bg-red-600/80 text-white">
                                <ThumbsDown className="mr-1 h-3.5 w-3.5" />
                                Does not recommend
                              </Badge>
                            )}
                            {entry.projectType ? (
                              <Badge className="bg-white/10 text-white/80">
                                {entry.projectType}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="text-xs text-white/60">
                            {entry.createdAt
                              ? new Date(entry.createdAt).toLocaleDateString()
                              : "Date unavailable"}
                          </div>
                        </div>
                        <p className="text-sm text-white/80">{entry.comment}</p>
                        {entry.contractor?.slug ? (
                          <Link href={`/contractors/${encodeURIComponent(entry.contractor.slug)}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/20 text-white"
                            >
                              {entry.contractor.companyName}
                            </Button>
                          </Link>
                        ) : (
                          <p className="text-xs text-white/60">{entry.contractor.companyName}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {customBlocks.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-white font-semibold text-lg">Profile Highlights</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {customBlocks.map((block, index) => (
                      <div
                        key={`${block.title}-${index}`}
                        className="rounded-lg bg-black/20 p-4 space-y-2"
                      >
                        <h3 className="text-white font-medium">{block.title}</h3>
                        <p className="text-white/70 text-sm leading-relaxed">{block.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {bookingEnabled ? (
                <section className="space-y-3 rounded-lg bg-black/20 p-4">
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
                    <Link href={hasViewerSession ? directConnectHref : preScoutCreateHref}>
                      <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                        Request Booking
                      </Button>
                    </Link>
                    {paidBookings && bookingPriceUsd > 0 ? (
                      <Link
                        href={`/checkout/booking/${encodeURIComponent(profile.id)}?amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${encodeURIComponent(`Booking deposit for ${displayName}`)}`}
                      >
                        <Button className="bg-ts-orange hover:bg-ts-orange-dark text-white">
                          <DollarSign className="h-4 w-4 mr-1" />
                          Pay deposit (${bookingPriceUsd.toFixed(2)})
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-4">
              {business ? (
                <section className="rounded-lg bg-black/20 p-4 space-y-3">
                  <h2 className="text-white font-semibold">Business Snapshot</h2>
                  <div className="text-sm text-white/70 space-y-1">
                    <p>
                      <span className="text-white/50">Name:</span> {business.name}
                    </p>
                    <p>
                      <span className="text-white/50">Categories:</span>{" "}
                      {business.categories.length ? business.categories.join(", ") : "None listed"}
                    </p>
                    <p>
                      <span className="text-white/50">Coverage:</span>{" "}
                      {business.serviceAreas.length
                        ? `${business.serviceAreas.length} service area(s)`
                        : "No areas listed"}
                    </p>
                  </div>
                </section>
              ) : null}

              {showContactCard ? (
                <section className="space-y-3 rounded-lg bg-black/20 p-4">
                  <h2 className="text-white font-semibold">Contact</h2>
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
                      {isSuperAdminViewer
                        ? "Super Admin override active. You are automatically connected through Direct Connect."
                        : hasViewerSession
                          ? "Open Direct Connect to contact this profile inside TradeScout."
                          : "Create a free TradeScout account to contact this profile through Direct Connect."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Link href={hasViewerSession ? directConnectHref : preScoutCreateHref}>
                      <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white flex items-center justify-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        <span>
                          {isSuperAdminViewer ? "Open Direct Connect" : "Start Direct Connect"}
                        </span>
                      </Button>
                    </Link>
                    {!hasViewerSession ? (
                      <Link href={preScoutSignInHref}>
                        <Button className="w-full bg-ts-orange hover:bg-ts-orange-dark text-white">
                          Sign in
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </aside>
          </div>
        </CardContent>
      </Card>
    </Page>
  );
}
