import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserColorScheme } from "@shared/colorPresets";
import { ThemeScope } from "@/components/theme/ThemeScope";
import { UserBadges } from "@/components/user-badges";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { ShareButton } from "@/components/ShareButton";
import {
  buildProfileOfferExchangePath,
  listProfileOfferImageUrls,
} from "@shared/profileOfferShare";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
} from "@shared/handmadeProductShare";
import { buildCommunityPostPath, listCommunityPostImageUrls } from "@shared/communityPostShare";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { USER_TYPES } from "@shared/userTypes";
import {
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_USD,
} from "@shared/platformRevenue";
import {
  MapPin,
  Calendar,
  Eye,
  Building,
  Award,
  ThumbsUp,
  ShoppingBag,
  Users,
  Shield,
  Clock3,
  DollarSign,
} from "lucide-react";

interface PublicProfile {
  id: string;
  canonicalProfileSlug?: string | null;
  canonicalProfileUrl?: string | null;
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
  isAdmin?: boolean;
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
  content?: string;
  imageUrls?: string[];
  createdAt?: string;
  category?: string | null;
}

interface ProfileOfferSummary {
  id: string;
  title: string;
  description?: string | null;
  offerType: "service" | "item";
  price: number;
  currency: string;
  fulfillmentMode: string;
  shippingCost: number;
  itemStockQuantity?: number | null;
  metadata?: {
    itemCategory?: string;
    exchangeCategorySlug?: string;
    taxCategory?: string;
    fulfillmentPolicy?: string;
    returnPolicy?: string;
    imageUrls?: string[];
    images?: string[];
  };
}

const COMMUNITY_BUILDER_BADGE_LABEL = "Community Builder Badge";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TRADESCOUT_TRANSACTION_FEE = TRADESCOUT_TRANSACTION_FEE_USD;

export default function PublicProfileView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/profile/:userId");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sellerProducts, setSellerProducts] = useState<SellerProductSummary[]>([]);
  const [profileOffers, setProfileOffers] = useState<ProfileOfferSummary[]>([]);
  const [sellerRatings, setSellerRatings] = useState<SellerRatingsSummary | null>(null);
  const [communityPosts, setCommunityPosts] = useState<CommunityPostSummary[]>([]);
  const profileThemeIdRef = useRef<string | null>(null);
  const [kickDialogOpen, setKickDialogOpen] = useState(false);
  const [kickReason, setKickReason] = useState("");
  const [kicking, setKicking] = useState(false);
  const [isUpdatingConnection, setIsUpdatingConnection] = useState(false);
  const [purchasingOfferId, setPurchasingOfferId] = useState<string | null>(null);
  const [purchaseDialogOffer, setPurchaseDialogOffer] = useState<ProfileOfferSummary | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState("1");
  const [shippingName, setShippingName] = useState("");
  const [shippingLine1, setShippingLine1] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);

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

        if (typeof data?.canonicalProfileSlug === "string" && data.canonicalProfileSlug.trim()) {
          navigate(`/u/${encodeURIComponent(data.canonicalProfileSlug.trim())}`, {
            replace: true,
          });
          return;
        }

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
  }, [params?.userId, navigate]);

  const profileThemeId = profileThemeIdRef.current;
  const purchaseDialogQuantity = Math.max(1, Math.floor(Number(purchaseQuantity) || 1));
  const purchaseDialogTotal = purchaseDialogOffer
    ? purchaseDialogOffer.price * purchaseDialogQuantity +
      (purchaseDialogOffer.fulfillmentMode === "shipping" ? purchaseDialogOffer.shippingCost : 0) +
      TRADESCOUT_TRANSACTION_FEE
    : 0;

  const roleTokens = (() => {
    const tokens: string[] = [];
    const push = (v: any) => {
      const r = String(v || "")
        .trim()
        .toLowerCase();
      if (!r) return;
      tokens.push(r === "owner" ? "super_admin" : r);
    };
    push((user as any)?.role);
    push((user as any)?.activeRole);
    const roles = Array.isArray((user as any)?.roles) ? (user as any).roles : [];
    for (const r of roles) push(r);
    return Array.from(new Set(tokens));
  })();
  const viewerIsCommunityModerator =
    roleTokens.includes("community_moderator") || roleTokens.includes("community_leader");
  const viewerIsSelf = Boolean(user?.id && profile?.id && String(user.id) === String(profile.id));

  const submitKickVote = async () => {
    if (!profile?.id) return;
    const reason = kickReason.trim();
    if (reason.length < 10) {
      toast({
        title: "Reason required",
        description: "Add a short reason (at least 10 characters).",
        variant: "destructive",
      });
      return;
    }

    setKicking(true);
    try {
      const resp = await fetch("/api/moderation/kick-vote", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, reason }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(data?.error || data?.message || "Kick vote failed");
      }

      const voteCount = Number(data?.voteCount || 0);
      const threshold = Number(data?.threshold || 3);
      toast({
        title: "Kick vote recorded",
        description:
          voteCount >= threshold
            ? `Threshold reached (${voteCount}/${threshold}). Sent to staff review.`
            : `Recorded (${voteCount}/${threshold}).`,
      });
      setKickReason("");
      setKickDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Kick vote failed",
        description: formatUserFacingErrorMessage(err, "Failed to submit kick vote"),
        variant: "destructive",
      });
    } finally {
      setKicking(false);
    }
  };

  // Load additional public data tied to this user: handmade offerings, trust summary, community posts
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

        // Seller trust summary (recommendation count; no star ratings)
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
            console.error("Error fetching seller trust summary for profile:", err);
          }
        }

        // Fixed-price profile offers. Services create guided work requests; items create receipt
        // and fulfillment/accounting review records after buyer intent.
        try {
          const res = await fetch(
            `/api/profile-offers?sellerUserId=${encodeURIComponent(userId)}`,
            {
              credentials: "include",
              signal,
            }
          );
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.offers)) {
              setProfileOffers(
                data.offers.map((offer: any) => ({
                  id: String(offer.id),
                  title: String(offer.title || ""),
                  description: offer.description || null,
                  offerType: offer.offerType === "item" ? "item" : "service",
                  price: Number(offer.price || 0),
                  currency: String(offer.currency || "USD"),
                  fulfillmentMode: String(offer.fulfillmentMode || "manual_review"),
                  shippingCost: Number(offer.shippingCost || 0),
                  itemStockQuantity:
                    offer.itemStockQuantity === null || offer.itemStockQuantity === undefined
                      ? null
                      : Number(offer.itemStockQuantity),
                  metadata: offer.metadata || {},
                }))
              );
            }
          }
        } catch (err) {
          if (!(err instanceof DOMException && err.name === "AbortError")) {
            console.error("Error fetching fixed-price profile offers:", err);
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
                content: typeof p.content === "string" ? p.content : "",
                imageUrls: listCommunityPostImageUrls(p.imageUrls),
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
  let distinctBadges = badges.filter((b: string) => b !== COMMUNITY_BUILDER_BADGE_LABEL);

  // Add Admin/Staff badges for authority labeling (not verification)
  const roleLabels: string[] = [];
  if (
    profile.isAdmin ||
    (Array.isArray(profile.roles) &&
      profile.roles.some((r: string) => String(r).toLowerCase() === "admin"))
  ) {
    roleLabels.push("Admin");
  }
  if (
    Array.isArray(profile.roles) &&
    profile.roles.some((r: string) => String(r).toLowerCase() === "staff")
  ) {
    roleLabels.push("Staff");
  }
  // Only add if not already present
  distinctBadges = [...distinctBadges, ...roleLabels.filter((l) => !distinctBadges.includes(l))];
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
  const verificationTone = (() => {
    if (verificationStatus === "approved") return "bg-emerald-600 text-white";
    if (verificationStatus === "under_review" || verificationStatus === "pending") {
      return "bg-amber-500 text-black";
    }
    if (verificationStatus === "rejected" || verificationStatus === "expired") {
      return "bg-red-600 text-white";
    }
    if (verificationStatus === "suspended") return "bg-white/10 text-white";
    return "bg-white/10 text-white";
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

  const handleBookingDeposit = () => {
    if (!paidBookings || bookingPriceUsd <= 0 || !profile?.id) return;
    const description = encodeURIComponent(`Booking deposit for ${displayName}`);
    window.location.href = `/checkout/booking/${encodeURIComponent(profile.id)}?amount=${encodeURIComponent(String(bookingPriceUsd))}&description=${description}`;
  };

  const handlePurchaseProfileOffer = async (
    offer: ProfileOfferSummary,
    options?: { quantity?: number; shippingAddress?: Record<string, string> | null }
  ) => {
    if (!profile?.id) return;
    if (!user) {
      window.location.href = `/pre-scout-setup?mode=create&next=${encodeURIComponent(
        `/profile/${profile.id}`
      )}`;
      return;
    }
    if (viewerIsSelf || purchasingOfferId) return;

    setPurchasingOfferId(offer.id);
    try {
      const response = await fetch(`/api/profile-offers/${encodeURIComponent(offer.id)}/purchase`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: options?.quantity || 1,
          shippingAddress: options?.shippingAddress || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Purchase request failed");
      }

      toast({
        title: offer.offerType === "service" ? "Job flow created" : "Purchase recorded",
        description:
          offer.offerType === "service"
            ? "TradeScout created a guided work request and seller accounting review."
            : "TradeScout created receipt, fulfillment, and seller accounting review records.",
      });
      if (offer.offerType === "item" && data?.purchase?.id) {
        navigate(`/profile-purchases/${encodeURIComponent(String(data.purchase.id))}`);
      }
      setPurchaseDialogOffer(null);
      setPurchaseQuantity("1");
      setShippingName("");
      setShippingLine1("");
      setShippingCity("");
      setShippingState("");
      setShippingPostalCode("");
    } catch (err: any) {
      toast({
        title: "Purchase request failed",
        description: formatUserFacingErrorMessage(err, "Failed to start purchase"),
        variant: "destructive",
      });
    } finally {
      setPurchasingOfferId(null);
    }
  };

  const openPurchaseDialog = (offer: ProfileOfferSummary) => {
    if (!user) {
      void handlePurchaseProfileOffer(offer);
      return;
    }
    setPurchaseDialogOffer(offer);
    setPurchaseQuantity("1");
  };

  const submitPurchaseDialog = () => {
    if (!purchaseDialogOffer) return;
    const quantity = Math.max(1, Math.floor(Number(purchaseQuantity) || 1));
    const needsShipping = purchaseDialogOffer.fulfillmentMode === "shipping";
    const shippingAddress = needsShipping
      ? {
          name: shippingName.trim(),
          line1: shippingLine1.trim(),
          city: shippingCity.trim(),
          state: shippingState.trim(),
          postalCode: shippingPostalCode.trim(),
        }
      : null;

    if (
      needsShipping &&
      (!shippingAddress?.name ||
        !shippingAddress.line1 ||
        !shippingAddress.city ||
        !shippingAddress.state ||
        !shippingAddress.postalCode)
    ) {
      toast({
        title: "Shipping details needed",
        description: "Add a shipping name and address before continuing.",
        variant: "destructive",
      });
      return;
    }
    if (
      purchaseDialogOffer.itemStockQuantity !== null &&
      purchaseDialogOffer.itemStockQuantity !== undefined &&
      quantity > purchaseDialogOffer.itemStockQuantity
    ) {
      toast({
        title: "Not enough stock",
        description: `This seller has ${purchaseDialogOffer.itemStockQuantity} available.`,
        variant: "destructive",
      });
      return;
    }

    void handlePurchaseProfileOffer(purchaseDialogOffer, { quantity, shippingAddress });
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

  const renderSellerProductSummary = (product: SellerProductSummary) => {
    const productPath = buildHandmadeProductPath(product.id);
    if (!productPath) return null;
    const productImage = listHandmadeProductImageUrls(product)[0];

    return (
      <div
        key={product.id}
        className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3"
      >
        <div className="flex items-start gap-3">
          {productImage ? (
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-[color:var(--border-subtle)] bg-black/10">
              <img
                src={productImage}
                alt={product.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{product.title}</p>
            {(product.city || product.stateCode) && (
              <p className="mt-1 flex items-center gap-1 text-xs opacity-70">
                <MapPin className="h-3 w-3" />
                <span>{[product.city, product.stateCode].filter(Boolean).join(", ")}</span>
              </p>
            )}
            <p className="mt-1 text-sm font-semibold">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
              }).format(parseFloat(product.price || "0"))}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => navigate(productPath)}>
            View
          </Button>
          <ShareButton
            destination={productPath}
            title={product.title}
            text={`View ${product.title} on TradeScout Handmade`}
          />
        </div>
      </div>
    );
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
                  className="w-24 h-24 rounded-full object-cover border-4 border-ts-orange"
                  style={{ borderColor: "var(--user-primary, #f97316)" }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-ts-orange"
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
                          <p className="text-xs text-white/60">
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

                {viewerIsCommunityModerator && !viewerIsSelf ? (
                  <>
                    <Button
                      variant="outline"
                      className="border-red-500/40 text-red-200 hover:bg-red-500/10"
                      onClick={() => setKickDialogOpen(true)}
                      title="Community moderator action: after 3 distinct votes, this escalates to staff review. No automatic removal."
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Kick vote (staff review)
                    </Button>
                    <Dialog open={kickDialogOpen} onOpenChange={setKickDialogOpen}>
                      <DialogContent className="max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Community kick vote</DialogTitle>
                          <DialogDescription>
                            This does not remove the user automatically. After 3 distinct community
                            moderator votes, it is routed to staff review.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Label htmlFor="kick-reason">Reason</Label>
                          <Textarea
                            id="kick-reason"
                            value={kickReason}
                            onChange={(e) => setKickReason(e.target.value)}
                            placeholder="Explain what happened (min 10 characters)."
                            className="min-h-[120px]"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setKickDialogOpen(false);
                              setKickReason("");
                            }}
                            disabled={kicking}
                          >
                            Cancel
                          </Button>
                          <Button onClick={submitKickVote} disabled={kicking}>
                            {kicking ? "Submitting..." : "Submit vote"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : null}

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
            {showServices &&
              (servicesDescription ||
                profileOffers.length > 0 ||
                (!showMarketplaceListings && sellerProducts.length > 0)) && (
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

                      {profileOffers.length > 0 && (
                        <div className="space-y-2">
                          {profileOffers.slice(0, 6).map((offer) => {
                            const amount = new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: offer.currency || "USD",
                            }).format(offer.price);
                            const fulfillmentLabel =
                              offer.offerType === "service"
                                ? "Service"
                                : offer.fulfillmentMode === "shipping"
                                  ? "Item plus shipping"
                                  : "Item";
                            const offerImages = listProfileOfferImageUrls(offer.metadata);
                            const offerDetailPath =
                              offer.offerType === "item"
                                ? buildProfileOfferExchangePath(
                                    offer.id,
                                    offer.metadata?.exchangeCategorySlug ||
                                      offer.metadata?.itemCategory
                                  )
                                : null;
                            return (
                              <div
                                key={offer.id}
                                className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)] p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  {offerImages[0] ? (
                                    <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md border border-[color:var(--border-subtle)] bg-black/10">
                                      <img
                                        src={offerImages[0]}
                                        alt={offer.title}
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                  ) : null}
                                  <div className="min-w-0">
                                    <div className="font-semibold break-words">{offer.title}</div>
                                    {offer.description ? (
                                      <p className="mt-1 line-clamp-2 text-xs opacity-75">
                                        {offer.description}
                                      </p>
                                    ) : null}
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs opacity-75">
                                      <Badge variant="outline">{fulfillmentLabel}</Badge>
                                      {offer.offerType === "item" &&
                                      offer.metadata?.itemCategory ? (
                                        <Badge variant="outline">
                                          {offer.metadata.itemCategory}
                                        </Badge>
                                      ) : null}
                                      {offer.shippingCost > 0 ? (
                                        <span>
                                          Shipping{" "}
                                          {new Intl.NumberFormat("en-US", {
                                            style: "currency",
                                            currency: offer.currency || "USD",
                                          }).format(offer.shippingCost)}
                                        </span>
                                      ) : null}
                                      {offer.offerType === "item" &&
                                      offer.itemStockQuantity !== null &&
                                      offer.itemStockQuantity !== undefined ? (
                                        <span>{offer.itemStockQuantity} available</span>
                                      ) : null}
                                      {offer.offerType === "item" && offer.metadata?.taxCategory ? (
                                        <span>Tax: {offer.metadata.taxCategory}</span>
                                      ) : null}
                                    </div>
                                    {offer.offerType === "item" &&
                                    (offer.metadata?.fulfillmentPolicy ||
                                      offer.metadata?.returnPolicy) ? (
                                      <div className="mt-2 space-y-1 text-xs opacity-70">
                                        {offer.metadata.fulfillmentPolicy ? (
                                          <p className="line-clamp-2">
                                            Fulfillment: {offer.metadata.fulfillmentPolicy}
                                          </p>
                                        ) : null}
                                        {offer.metadata.returnPolicy ? (
                                          <p className="line-clamp-2">
                                            Returns: {offer.metadata.returnPolicy}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <div className="font-bold">{amount}</div>
                                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                                      {offerDetailPath ? (
                                        <>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => navigate(offerDetailPath)}
                                          >
                                            View
                                          </Button>
                                          <ShareButton
                                            destination={offerDetailPath}
                                            title={offer.title}
                                            text={`View ${offer.title} on TradeScout Exchange`}
                                          />
                                        </>
                                      ) : null}
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          offer.offerType === "service"
                                            ? handlePurchaseProfileOffer(offer)
                                            : openPurchaseDialog(offer)
                                        }
                                        disabled={viewerIsSelf || purchasingOfferId === offer.id}
                                      >
                                        {purchasingOfferId === offer.id
                                          ? "Starting..."
                                          : offer.offerType === "service"
                                            ? "Start Job"
                                            : "Buy"}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!showMarketplaceListings && sellerProducts.length > 0 && (
                        <>
                          {(servicesDescription || profileOffers.length > 0) && (
                            <p className="text-xs opacity-70 mt-2">
                              Examples from this member&apos;s marketplace listings:
                            </p>
                          )}
                          <div className="space-y-3">
                            {sellerProducts.slice(0, 3).map(renderSellerProductSummary)}
                          </div>
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
                  <div className="mt-4 space-y-3">
                    {sellerProducts.slice(0, 3).map(renderSellerProductSummary)}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations summary */}
            {showReviews && sellerRatings && sellerRatings.count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp
                      className="h-5 w-5"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-3 mb-2">
                    <span
                      className="text-3xl font-bold"
                      style={{ color: "var(--user-primary, #f97316)" }}
                    >
                      {sellerRatings.count}
                    </span>
                    <span className="text-sm opacity-80">public recommendations</span>
                  </div>
                  <p className="text-xs opacity-70">
                    Recommendations are recorded inside TradeScout and are visible on this public
                    profile.
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
                    {communityPosts.slice(0, 3).map((post) => {
                      const postPath = buildCommunityPostPath(post.id);
                      const postImage = listCommunityPostImageUrls(post.imageUrls)[0];
                      const postTitle = post.title.trim() || "Community post";
                      return (
                        <article
                          key={post.id}
                          className="overflow-hidden rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-intermediate)]"
                        >
                          {postImage ? (
                            <img
                              src={postImage}
                              alt={`${postTitle} preview`}
                              className="aspect-[16/9] w-full object-cover"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="space-y-3 p-3">
                            <div>
                              <h3 className="font-medium break-words">{postTitle}</h3>
                              {post.content ? (
                                <p className="mt-1 line-clamp-2 text-xs opacity-75">
                                  {post.content}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs opacity-70">
                                {post.createdAt
                                  ? new Date(post.createdAt).toLocaleDateString()
                                  : "Date not available"}
                                {post.category ? ` • ${post.category}` : ""}
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => navigate(postPath)}
                              >
                                View
                              </Button>
                              <ShareButton
                                destination={postPath}
                                title={postTitle}
                                text={post.content || `View ${postTitle} on TradeScout`}
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
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

          <Dialog
            open={Boolean(purchaseDialogOffer)}
            onOpenChange={(open) => !open && setPurchaseDialogOffer(null)}
          >
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Review purchase</DialogTitle>
                <DialogDescription>
                  TradeScout will create receipt, fulfillment, and seller accounting review records.
                </DialogDescription>
              </DialogHeader>
              {purchaseDialogOffer ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="font-semibold">{purchaseDialogOffer.title}</div>
                    <div className="mt-1 text-sm opacity-70">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: purchaseDialogOffer.currency || "USD",
                      }).format(purchaseDialogOffer.price)}
                      {purchaseDialogOffer.shippingCost > 0
                        ? ` + ${new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: purchaseDialogOffer.currency || "USD",
                          }).format(purchaseDialogOffer.shippingCost)} shipping`
                        : ""}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="purchase-quantity">Quantity</Label>
                    <Input
                      id="purchase-quantity"
                      value={purchaseQuantity}
                      onChange={(event) => setPurchaseQuantity(event.target.value)}
                      inputMode="numeric"
                      className="mt-1"
                    />
                    {purchaseDialogOffer.itemStockQuantity !== null &&
                    purchaseDialogOffer.itemStockQuantity !== undefined ? (
                      <p className="mt-1 text-xs opacity-60">
                        {purchaseDialogOffer.itemStockQuantity} available
                      </p>
                    ) : null}
                  </div>
                  {purchaseDialogOffer.fulfillmentMode === "shipping" ? (
                    <div className="grid gap-3">
                      <div>
                        <Label htmlFor="shipping-name">Shipping name</Label>
                        <Input
                          id="shipping-name"
                          value={shippingName}
                          onChange={(event) => setShippingName(event.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="shipping-line1">Address</Label>
                        <Input
                          id="shipping-line1"
                          value={shippingLine1}
                          onChange={(event) => setShippingLine1(event.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_80px_120px]">
                        <div>
                          <Label htmlFor="shipping-city">City</Label>
                          <Input
                            id="shipping-city"
                            value={shippingCity}
                            onChange={(event) => setShippingCity(event.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="shipping-state">State</Label>
                          <Input
                            id="shipping-state"
                            value={shippingState}
                            onChange={(event) => setShippingState(event.target.value)}
                            maxLength={2}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="shipping-postal">ZIP</Label>
                          <Input
                            id="shipping-postal"
                            value={shippingPostalCode}
                            onChange={(event) => setShippingPostalCode(event.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <p className="text-xs opacity-70">
                    No payment, contact release, posting, or shipping happens automatically.
                  </p>
                  <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Seller subtotal</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: purchaseDialogOffer.currency || "USD",
                        }).format(
                          purchaseDialogOffer.price * purchaseDialogQuantity +
                            (purchaseDialogOffer.fulfillmentMode === "shipping"
                              ? purchaseDialogOffer.shippingCost
                              : 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{TRADESCOUT_TRANSACTION_FEE_LABEL}</span>
                      <span>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: purchaseDialogOffer.currency || "USD",
                        }).format(TRADESCOUT_TRANSACTION_FEE)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span>Total for review</span>
                      <span className="font-semibold">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: purchaseDialogOffer.currency || "USD",
                        }).format(purchaseDialogTotal)}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setPurchaseDialogOffer(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={submitPurchaseDialog}
                      disabled={purchasingOfferId === purchaseDialogOffer.id}
                    >
                      {purchasingOfferId === purchaseDialogOffer.id ? "Starting..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </ThemeScope>
      </div>
    </div>
  );
}
