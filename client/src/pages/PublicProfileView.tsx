import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserColorScheme } from "@shared/colorPresets";
import { ThemeScope } from "@/components/theme/ThemeScope";
import { UserBadges } from "@/components/user-badges";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { USER_TYPES } from "@shared/userTypes";
import {
  MapPin,
  Calendar,
  Eye,
  Building,
  Award,
  Star,
  ShoppingBag,
  Users,
  Shield,
  Clock3,
  DollarSign,
} from "lucide-react";

interface PublicProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  city?: string;
  state?: string;
  roles?: string[];
  badges?: string[];
  createdAt?: string;
  verificationStatus?: string | null;
  addressVerified?: boolean;
  cvsScore?: number | string | null;
  preferences?: any;
  realtorProfile?: {
    brokerageName?: string | null;
    mlsId?: string | null;
    licenseState?: string | null;
    licenseNumber?: string | null;
    yearsExperience?: number | null;
    specializations?: string[] | null;
    serviceAreas?: any;
    verificationStatus?: string | null;
  };
  carSalesProfile?: {
    dealershipName?: string | null;
    dealerLicense?: string | null;
    salesmanLicense?: string | null;
    licenseState?: string | null;
    yearsExperience?: number | null;
    specializations?: string[] | null;
    brandsSpecialty?: string[] | null;
    serviceAreas?: any;
    verificationStatus?: string | null;
  };
  stats?: {
    listings?: number;
    reviews?: number;
    rating?: number;
    jobsCompleted?: number;
    peopleHelped?: number;
    activeWeeks?: number;
  };
  connections?: {
    followers: number;
    following: number;
    mutual: number;
  };
  viewerConnection?: {
    isFollowing: boolean;
    isFollowedBy: boolean;
    isMutual: boolean;
  };
}

interface SellerProductSummary {
  id: string;
  title: string;
  price: string;
  primaryImageUrl?: string;
  city?: string;
  stateCode?: string;
}

interface SellerRatingsSummary {
  average: number;
  count: number;
}

interface CommunityPostSummary {
  id: string;
  title: string;
  createdAt?: string;
  category?: string | null;
}

const COMMUNITY_BUILDER_BADGE_LABEL = "Community Builder Badge";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PublicProfileView() {
  const { user } = useAuth();
  const [, params] = useRoute("/profile/:userId");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<SellerProductSummary[]>([]);
  const [sellerRatings, setSellerRatings] = useState<SellerRatingsSummary | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPostSummary[]>([]);
  const profileThemeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params?.userId) return;

      try {
        const response = await fetch(`/api/users/${params.userId}/public`, {
          credentials: "include",
        });

        if (response.status === 404) {
          setNotFound(true);
          return;
        }

        if (!response.ok) throw new Error("Failed to fetch profile");

        const data = await response.json();
        setProfile(data);

        if (data.preferences?.themeId && typeof data.preferences.themeId === "string") {
          profileThemeIdRef.current = data.preferences.themeId;
        } else if (data.preferences?.colorScheme) {
          // Fallback: derive a synthetic theme id from colorScheme preset if present
          const preset = (data.preferences.colorScheme as any).preset;
          profileThemeIdRef.current = typeof preset === "string" ? preset : "charcoal";
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      profileThemeIdRef.current = null;
    };
  }, [params?.userId]);

  const profileThemeId = profileThemeIdRef.current;

  // Load additional public data tied to this user: handmade offerings, ratings, community posts
  useEffect(() => {
    if (!profile?.id) return;

    const controller = new AbortController();
    const { signal } = controller;

    const loadExtras = async () => {
      const userId = profile.id;

      try {
        // Handmade products (services / offerings)
        try {
          const res = await fetch(`/api/handmade/sellers/${userId}/products`, { signal });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mapped: SellerProductSummary[] = data.map((p: any) => ({
                id: String(p.id),
                title: String(p.title ?? ""),
                price: String(p.price ?? "0"),
                primaryImageUrl: p.primaryImageUrl || undefined,
                city: p.city || undefined,
                stateCode: p.stateCode || undefined,
              }));
              setSellerProducts(mapped);
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching seller products for profile:", err);
          }
        }

        // Seller ratings (recommendation count + average rating)
        try {
          const res = await fetch(`/api/handmade/sellers/${userId}/ratings`, { signal });
          if (res.ok) {
            const data = await res.json();
            if (typeof data?.average === "number" && typeof data?.count === "number") {
              setSellerRatings({ average: data.average, count: data.count });
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching seller ratings for profile:", err);
          }
        }

        // Community posts authored by this user
        try {
          const res = await fetch(
            `/api/community/posts?authorId=${encodeURIComponent(userId)}&limit=3`,
            { signal }
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
              const mapped: CommunityPostSummary[] = data.map((p: any) => ({
                id: String(p.id),
                title: String(p.title ?? ""),
                createdAt: p.createdAt,
                category: p.category ?? null,
              }));
              setCommunityPosts(mapped);
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching community posts for profile:", err);
          }
        }
      } catch (error) {
        console.error("Error loading extra profile data:", error);
      }
    };

    loadExtras();

    return () => {
      controller.abort();
    };
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="bg-app flex items-center justify-center py-24">
        <p className="text-muted">Loading profile...</p>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="bg-app flex flex-col items-center justify-center text-center px-4 py-24">
        <Eye className="h-12 w-12 text-muted mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-primary mb-2">Profile Not Found</h2>
        <p className="text-muted">This profile is private or doesn't exist.</p>
      </div>
    );
  }

  const displayName =
    profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile.firstName || "TradeScout User";

  const location =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.city || profile.state || "Location not set";

  const badges = profile.badges || [];
  const distinctBadges = badges.filter((b: string) => b !== COMMUNITY_BUILDER_BADGE_LABEL);
  const showBadges = profile.preferences?.badges?.show !== false;
  const hasCommunityBuilder = (profile.roles || []).includes("community_builder");

  const bio = typeof profile.preferences?.bio === "string" ? profile.preferences.bio.trim() : "";

  const servicesDescription =
    typeof profile.preferences?.servicesDescription === "string"
      ? profile.preferences.servicesDescription.trim()
      : "";

  const profileSections = profile.preferences?.profileSections || {};
  const showAbout = profileSections.about !== false;
  const showRolesAndBadges = profileSections.rolesAndBadges !== false;
  const showStats = profileSections.stats !== false;
  const showServices = profileSections.services !== false;
  const showMarketplaceListings = profileSections.marketplaceListings !== false;
  const showReviews = profileSections.reviews !== false;
  const showCommunityActivity = profileSections.communityActivity !== false;
  const showContactCard = profileSections.contactCard !== false;
  const profileBooking = profile.preferences?.profileBooking || {};
  const bookingEnabled = profileBooking.enabled === true;
  const paidBookings = profileBooking.paidBookings === true;
  const bookingPriceUsd = Number(profileBooking.bookingPriceUsd || 0);
  const calendarVisibility = profileBooking.calendarVisibility === "private" ? "private" : "public";
  const timezone =
    typeof profileBooking.timezone === "string" && profileBooking.timezone.trim().length > 0
      ? profileBooking.timezone
      : "America/Chicago";
  const bookingSlots = Array.isArray(profileBooking.slots)
    ? profileBooking.slots.filter(
        (slot: any) =>
          slot &&
          typeof slot.dayOfWeek === "number" &&
          slot.dayOfWeek >= 0 &&
          slot.dayOfWeek <= 6 &&
          typeof slot.startTime === "string" &&
          typeof slot.endTime === "string" &&
          slot.active !== false
      )
    : [];
  const pricingTableEnabled = profileBooking.pricingTableEnabled === true;
  const pricingRows = Array.isArray(profileBooking.pricingRows)
    ? profileBooking.pricingRows.filter(
        (row: any) =>
          row &&
          typeof row.name === "string" &&
          row.name.trim().length > 0 &&
          typeof row.priceLabel === "string" &&
          row.priceLabel.trim().length > 0
      )
    : [];
  const verificationStatus = String(profile.verificationStatus || "").toLowerCase();
  const addressVerified = Boolean(profile.addressVerified);
  const rawCvs =
    typeof profile.cvsScore === "number"
      ? profile.cvsScore
      : typeof profile.cvsScore === "string" && profile.cvsScore.trim().length > 0
        ? Number(profile.cvsScore)
        : null;
  const cvsScore = Number.isFinite(rawCvs as number) ? Number(rawCvs) : null;
  const roles = profile.roles || [];
  const trustRoles = new Set([
    "contractor",
    "handyman",
    "service_provider",
    "specialty_tradesperson",
    "realtor",
    "mortgage_broker",
    "insurance_agent",
    "car_dealer",
    "auto_service",
    "business_owner",
    "property_manager",
  ]);
  const showCvs = roles.some((role) => trustRoles.has(role));
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

  const [isUpdatingConnection, setIsUpdatingConnection] = useState(false);
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);

  const handleBookingDeposit = () => {
    if (!paidBookings || bookingPriceUsd <= 0 || !profile?.id) return;
    const description = encodeURIComponent(`Booking deposit for ${displayName}`);
    window.location.href = `/checkout/booking/${encodeURIComponent(profile.id)}?amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${description}`;
  };

  const handleToggleConnection = async () => {
    if (isUpdatingConnection || !profile?.id) return;

    // If viewerConnection is undefined we optimistically try to follow
    const isCurrentlyFollowing = profile.viewerConnection?.isFollowing ?? false;

    try {
      setIsUpdatingConnection(true);
      const method = isCurrentlyFollowing ? "DELETE" : "POST";
      const response = await fetch(`/api/social/connections/${profile.id}/follow`, {
        method,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error("Failed to update connection status");
        return;
      }

      const data = await response.json();

      setProfile((prev) => {
        if (!prev) return prev;

        const viewerConnection = data.viewerConnection ?? {
          isFollowing: !isCurrentlyFollowing,
          isFollowedBy: prev.viewerConnection?.isFollowedBy ?? false,
          isMutual: (!isCurrentlyFollowing && prev.viewerConnection?.isFollowedBy) ?? false,
        };

        // Adjust follower count for this public profile when viewer follows/unfollows
        let followers = prev.connections?.followers ?? 0;
        if (!isCurrentlyFollowing) {
          followers += 1;
        } else if (followers > 0) {
          followers -= 1;
        }

        return {
          ...prev,
          connections: {
            followers,
            following: prev.connections?.following ?? 0,
            mutual: prev.connections?.mutual ?? 0,
          },
          viewerConnection,
        };
      });
    } catch (err) {
      console.error("Error toggling connection:", err);
    } finally {
      setIsUpdatingConnection(false);
    }
  };

  return (
    <div className="bg-app text-primary py-8">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
        <ThemeScope themeId={profileThemeId || undefined}>
          <div className="ts-card rounded-2xl p-6 md:p-8 border-subtle space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={displayName}
                  className="w-24 h-24 rounded-full object-cover border-4 border-tsAccent"
                  style={{ borderColor: "var(--user-primary, #f97316)" }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-tsAccent"
                  style={{
                    backgroundColor: "var(--user-primary, #f97316)",
                    borderColor: "var(--user-secondary, #fb923c)",
                    color: "var(--user-background, #0a0f1e)",
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2 break-words">{displayName}</h1>
                <div className="flex flex-wrap gap-3 text-sm opacity-80">
                  {location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{location}</span>
                    </div>
                  )}
                  {profile.createdAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>Member since {new Date(profile.createdAt).getFullYear()}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <Badge className={verificationTone}>
                    <Shield className="h-3 w-3 mr-1" />
                    {verificationLabel}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)]"
                  >
                    {addressVerified ? "Address Verified" : "Address Verification Required"}
                  </Badge>
                  {showCvs && (
                    <Badge
                      variant="outline"
                      className="border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] text-[color:var(--text-secondary)]"
                    >
                      {cvsScore !== null ? `CVS ${Math.round(cvsScore)}` : "CVS Pending"}
                    </Badge>
                  )}
                </div>

                {/* Roles exist for capabilities and layout, but are not shown as trust/status chips. */}

                {/* Badges */}
                {showRolesAndBadges && showBadges && (badges.length > 0 || hasCommunityBuilder) && (
                  <>
                    <button
                      type="button"
                      className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-black/20 px-2 py-1 hover:bg-black/30 transition-colors"
                      onClick={() => setBadgeModalOpen(true)}
                    >
                      <UserBadges
                        badges={[
                          ...(hasCommunityBuilder ? [COMMUNITY_BUILDER_BADGE_LABEL] : []),
                          ...distinctBadges,
                        ]}
                        size="md"
                        maxVisible={3}
                      />
                    </button>
                    <Dialog open={badgeModalOpen} onOpenChange={setBadgeModalOpen}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Badges</DialogTitle>
                          <DialogDescription>
                            Contribution and trust signals this profile has earned.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-3">
                          <UserBadges
                            badges={[
                              ...(hasCommunityBuilder ? [COMMUNITY_BUILDER_BADGE_LABEL] : []),
                              ...distinctBadges,
                            ]}
                            size="lg"
                            maxVisible={64}
                            showLabels
                          />
                          <p className="text-xs text-gray-400">
                            Badges are awarded for real activity in the community and job tools.
                          </p>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
              <div className="flex flex-col items-end gap-4">
                {/* Connection button */}
                <Button
                  variant={profile.viewerConnection?.isFollowing ? "outline" : "default"}
                  onClick={handleToggleConnection}
                  disabled={isUpdatingConnection}
                  className="min-w-[140px]"
                >
                  {isUpdatingConnection
                    ? "Updating..."
                    : profile.viewerConnection?.isFollowing
                      ? "Connected"
                      : "Connect"}
                </Button>

                {/* Credibility metrics (subtle, non-competitive) */}
                {showStats && profile.stats && (
                  <div className="flex flex-col items-end gap-1 text-xs opacity-80 mt-1">
                    <div className="flex gap-4">
                      {profile.stats.jobsCompleted !== undefined &&
                        profile.stats.jobsCompleted > 0 && (
                          <div className="text-right">
                            <div className="font-semibold">
                              {profile.stats.jobsCompleted} job
                              {profile.stats.jobsCompleted === 1 ? "" : "s"} completed
                            </div>
                          </div>
                        )}
                      {profile.stats.peopleHelped !== undefined &&
                        profile.stats.peopleHelped > 0 && (
                          <div className="text-right">
                            <div className="font-semibold">
                              Helped {profile.stats.peopleHelped} person
                              {profile.stats.peopleHelped === 1 ? "" : "s"}
                            </div>
                          </div>
                        )}
                      {profile.stats.activeWeeks !== undefined && profile.stats.activeWeeks > 0 && (
                        <div className="text-right">
                          <div className="font-semibold">
                            Active in this community {profile.stats.activeWeeks} week
                            {profile.stats.activeWeeks === 1 ? "" : "s"} this year
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Connection counts */}
                {profile.connections && (
                  <div className="flex gap-4 text-xs opacity-80 mt-1">
                    <span>{profile.connections.followers} followers</span>
                    <span>{profile.connections.following} following</span>
                    {profile.connections.mutual > 0 && (
                      <span>{profile.connections.mutual} mutual</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content sections based on user types and activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {showAbout && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building
                      className="h-5 w-5"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    About
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bio ? (
                    <p className="text-sm whitespace-pre-wrap">{bio}</p>
                  ) : (
                    <p className="text-sm">
                      This is a TradeScout community member. Their profile serves as their
                      professional website, customized based on their roles and activity on the
                      platform.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {(profile.realtorProfile || profile.carSalesProfile) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" style={{ color: "var(--user-primary, #f97316)" }} />
                    Professional Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {profile.realtorProfile ? (
                    <div className="space-y-2 text-sm">
                      <div className="font-semibold">Realtor</div>
                      <div className="flex justify-between gap-4">
                        <span className="opacity-70">Brokerage</span>
                        <span className="font-medium text-right">
                          {profile.realtorProfile.brokerageName || "Not listed"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="opacity-70">License</span>
                        <span className="font-medium text-right">
                          {[
                            profile.realtorProfile.licenseState,
                            profile.realtorProfile.licenseNumber,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "Not listed"}
                        </span>
                      </div>
                      {typeof profile.realtorProfile.yearsExperience === "number" ? (
                        <div className="flex justify-between gap-4">
                          <span className="opacity-70">Experience</span>
                          <span className="font-medium text-right">
                            {profile.realtorProfile.yearsExperience} year
                            {profile.realtorProfile.yearsExperience === 1 ? "" : "s"}
                          </span>
                        </div>
                      ) : null}
                      {Array.isArray(profile.realtorProfile.specializations) &&
                      profile.realtorProfile.specializations.length > 0 ? (
                        <div className="pt-1">
                          <div className="text-xs opacity-70 mb-1">Specializations</div>
                          <div className="flex flex-wrap gap-2">
                            {profile.realtorProfile.specializations.slice(0, 8).map((s) => (
                              <Badge key={s} variant="secondary">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {profile.carSalesProfile ? (
                    <div className="space-y-2 text-sm">
                      <div className="font-semibold">Car Sales</div>
                      <div className="flex justify-between gap-4">
                        <span className="opacity-70">Dealership</span>
                        <span className="font-medium text-right">
                          {profile.carSalesProfile.dealershipName || "Not listed"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="opacity-70">License</span>
                        <span className="font-medium text-right">
                          {[
                            profile.carSalesProfile.licenseState,
                            profile.carSalesProfile.salesmanLicense,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "Not listed"}
                        </span>
                      </div>
                      {typeof profile.carSalesProfile.yearsExperience === "number" ? (
                        <div className="flex justify-between gap-4">
                          <span className="opacity-70">Experience</span>
                          <span className="font-medium text-right">
                            {profile.carSalesProfile.yearsExperience} year
                            {profile.carSalesProfile.yearsExperience === 1 ? "" : "s"}
                          </span>
                        </div>
                      ) : null}
                      {Array.isArray(profile.carSalesProfile.brandsSpecialty) &&
                      profile.carSalesProfile.brandsSpecialty.length > 0 ? (
                        <div className="pt-1">
                          <div className="text-xs opacity-70 mb-1">Brands</div>
                          <div className="flex flex-wrap gap-2">
                            {profile.carSalesProfile.brandsSpecialty.slice(0, 10).map((b) => (
                              <Badge key={b} variant="secondary">
                                {b}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {!profile.realtorProfile && !profile.carSalesProfile ? (
                    <div className="text-sm opacity-70">No professional profile details yet.</div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" style={{ color: "var(--user-primary, #f97316)" }} />
                  Verified Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="opacity-70">Location</span>
                    <span className="font-medium">{location}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Services / offerings */}
            {showServices && (servicesDescription || sellerProducts.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag
                      className="h-5 w-5"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    Services & offerings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    {servicesDescription && (
                      <p className="whitespace-pre-wrap">{servicesDescription}</p>
                    )}

                    {sellerProducts.length > 0 && (
                      <>
                        {servicesDescription && (
                          <p className="text-xs opacity-70 mt-2">
                            Examples from this member&apos;s marketplace listings:
                          </p>
                        )}
                        {sellerProducts.slice(0, 3).map((product) => (
                          <div key={product.id} className="flex justify-between items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{product.title}</p>
                              {(product.city || product.stateCode) && (
                                <p className="text-xs opacity-70 truncate flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>
                                    {[product.city, product.stateCode].filter(Boolean).join(", ")}
                                  </span>
                                </p>
                              )}
                            </div>
                            <div className="ml-2 text-right">
                              <span className="text-sm font-semibold">
                                {new Intl.NumberFormat("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                }).format(parseFloat(product.price || "0"))}
                              </span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Marketplace summary (handmade listings) */}
            {showMarketplaceListings && sellerProducts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag
                      className="h-5 w-5"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    Marketplace listings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">
                    This member has {sellerProducts.length} active handmade offerings listed on
                    TradeScout.
                  </p>
                  <p className="text-xs opacity-70">
                    Listings and availability are managed by the seller through the Handmade
                    Marketplace.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* RECOMMENDATIONS summary */}
            {showReviews && sellerRatings && sellerRatings.count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star
                      className="h-5 w-5 fill-current"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    RECOMMENDATIONS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span
                      className="text-3xl font-bold"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    >
                      {sellerRatings.average.toFixed(1)}
                    </span>
                    <span className="text-sm opacity-80">
                      based on {sellerRatings.count} public recommendations
                    </span>
                  </div>
                  <p className="text-xs opacity-70">
                    Ratings are calculated from verified purchases and public recommendations on
                    TradeScout.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Community activity */}
            {showCommunityActivity && communityPosts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" style={{ color: "var(--user-primary, #f97316)" }} />
                    Community activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {communityPosts.slice(0, 3).map((post) => (
                      <div key={post.id} className="flex flex-col">
                        <span className="font-medium truncate">{post.title}</span>
                        <span className="text-xs opacity-70">
                          {post.createdAt
                            ? new Date(post.createdAt).toLocaleDateString()
                            : "Date not available"}
                          {post.category ? ` • ${post.category}` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {bookingEnabled && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar
                      className="h-5 w-5"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-sm">
                    Booking requests are handled through TradeScout to keep communication protected.
                  </div>
                  {calendarVisibility === "public" && bookingSlots.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide opacity-70 flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        Weekly availability ({timezone})
                      </div>
                      <div className="space-y-1 text-sm">
                        {bookingSlots.slice(0, 14).map((slot: any) => (
                          <div key={slot.id} className="flex items-center justify-between gap-3">
                            <span className="font-medium">{DAYS[slot.dayOfWeek] || "Day"}</span>
                            <span className="opacity-80">
                              {slot.startTime} - {slot.endTime}
                              {slot.label ? ` (${slot.label})` : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pricingTableEnabled && pricingRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide opacity-70">
                        Pricing table
                      </div>
                      <div className="space-y-1 text-sm">
                        {pricingRows.slice(0, 10).map((row: any) => (
                          <div key={row.id} className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{row.name}</div>
                              {row.description ? (
                                <div className="text-xs opacity-70">{row.description}</div>
                              ) : null}
                            </div>
                            <div className="font-semibold">{row.priceLabel}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      onClick={() => {
                        if (user) {
                          window.location.href = "/direct-connect";
                          return;
                        }
                        window.location.href = `/pre-scout-setup?mode=create&next=${encodeURIComponent("/direct-connect")}`;
                      }}
                    >
                      Request Booking
                    </Button>
                    {paidBookings && bookingPriceUsd > 0 && (
                      <Button variant="outline" onClick={handleBookingDeposit}>
                        <DollarSign className="h-4 w-4 mr-1" />
                        Pay booking deposit (${bookingPriceUsd.toFixed(2)})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact CTA */}
            {showContactCard && (
              <div className="ts-card rounded-2xl p-6 text-center bg-accent text-[color:var(--ts-text-on-accent)]">
                <h3 className="text-xl font-bold mb-2">
                  Interested in connecting with {profile.firstName || "this user"}?
                </h3>
                <p className="mb-4 opacity-90">Send a message or inquiry through TradeScout</p>
                <Button size="lg" className="ts-btn-ghost ts-focus">
                  Send Message
                </Button>
              </div>
            )}
          </div>
        </ThemeScope>
      </div>
    </div>
  );
}
