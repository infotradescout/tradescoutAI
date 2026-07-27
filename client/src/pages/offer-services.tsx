import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SEOHelmet } from "@/components/SEOHelmet";
import { TRADESCOUT_TRANSACTION_FEE_USD } from "@shared/platformRevenue";
import {
  ShieldCheck,
  FileText,
  MapPin,
  User,
  Briefcase,
  CheckCircle2,
  Circle,
  Clock,
  ChevronRight,
  Star,
  ArrowRight,
  Eye,
  Building2,
  ReceiptText,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type VerificationStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: "complete" | "pending" | "not_started";
  href: string;
  priority: "required" | "recommended" | "optional";
};

type IdentityStatusResponse = { isVerified: boolean; verification: unknown | null };
type AddressStatusResponse = { isVerified: boolean; requiresVerification: boolean };

type TrustSnapshot = {
  licenseStatus?: string | null;
  insuranceStatus?: string | null;
  verificationStatus?: string | null;
  cvsScore?: number | null;
};

type ProfileOffer = {
  id: string;
  title: string;
  description?: string | null;
  offerType: "service" | "item";
  price: number;
  currency: string;
  serviceCategory?: string | null;
  serviceDurationMinutes?: number | null;
  itemSku?: string | null;
  itemStockQuantity?: number | null;
  fulfillmentMode?: string | null;
  shippingCost: number;
  isActive: boolean;
  metadata?: {
    itemCategory?: string;
    exchangeCategorySlug?: string;
    taxCategory?: string;
    fulfillmentPolicy?: string;
    returnPolicy?: string;
    imageUrls?: string[];
    images?: string[];
  };
};

type PublicProfileSummary = {
  id: string;
  businessId?: string | null;
  slug?: string | null;
  status?: string | null;
  displayName?: string | null;
};

type ProfileOfferPurchase = {
  id: string;
  offerId?: string;
  offerType: "service" | "item";
  purchaseStatus: string;
  paymentStatus: string;
  quantity?: number;
  platformFee?: number;
  sellerAmount?: number;
  totalAmount: number;
  currency: string;
  workRequestId?: string | null;
  receiptDocumentId?: string | null;
  shippingStatus?: string | null;
  metadata?: Record<string, any>;
  createdAt?: string;
};

type BusinessOnboardingState = {
  version: 1;
  businessType: string;
  startedAt: string;
  lastUpdatedAt: string;
  completedAt?: string;
  modules: Record<
    | "identity_profile"
    | "service_catalog"
    | "coverage_availability"
    | "trust_verification"
    | "operations_payout",
    "not_started" | "in_progress" | "complete"
  >;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepStatusIcon(status: VerificationStep["status"]) {
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />;
  if (status === "pending") return <Clock className="h-5 w-5 text-ts-orange shrink-0" />;
  return <Circle className="h-5 w-5 text-white/30 shrink-0" />;
}

function priorityBadge(priority: VerificationStep["priority"]) {
  if (priority === "required")
    return (
      <Badge className="text-[10px] bg-red-500/20 text-red-300 border-red-500/30 px-1.5 py-0">
        Required
      </Badge>
    );
  if (priority === "recommended")
    return (
      <Badge className="text-[10px] bg-ts-orange/20 text-ts-orange border-ts-orange/30 px-1.5 py-0">
        Recommended
      </Badge>
    );
  return (
    <Badge className="text-[10px] bg-white/10 text-white/50 border-white/10 px-1.5 py-0">
      Optional
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfferServicesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();
  const [offerType, setOfferType] = useState<"service" | "item">("service");
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState("");
  const [offerDescription, setOfferDescription] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceDurationMinutes, setServiceDurationMinutes] = useState("");
  const [itemSku, setItemSku] = useState("");
  const [itemStockQuantity, setItemStockQuantity] = useState("");
  const [itemFulfillmentMode, setItemFulfillmentMode] = useState<
    "manual_review" | "shipping" | "pickup" | "digital"
  >("manual_review");
  const [shippingCost, setShippingCost] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [taxCategory, setTaxCategory] = useState("");
  const [offerImageUrls, setOfferImageUrls] = useState("");
  const [fulfillmentPolicy, setFulfillmentPolicy] = useState("");
  const [returnPolicy, setReturnPolicy] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState<Record<string, string>>({});
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [trackingCarriers, setTrackingCarriers] = useState<Record<string, string>>({});
  const onboardingMode = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    const params = new URLSearchParams(query);
    return params.get("onboarding") === "business";
  }, [location]);
  const onboardingModule = useMemo(() => {
    const raw = String(location || "");
    const query = raw.includes("?") ? raw.split("?", 2)[1] : "";
    const params = new URLSearchParams(query);
    return params.get("module");
  }, [location]);

  useEffect(() => {
    if (!onboardingMode) return;
    if (onboardingModule === "service_catalog") {
      document.getElementById("fixed-price-offers")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [onboardingMode, onboardingModule]);

  const displayName = useMemo(() => {
    if (user?.firstName) return user.firstName;
    const provisional = (user as any)?.preferences?.provisional?.profileDraft;
    if (provisional?.firstName) return provisional.firstName;
    return null;
  }, [user]);

  const businessName = useMemo(() => {
    const provisional = (user as any)?.preferences?.provisional?.profileDraft;
    return provisional?.businessName ?? (user as any)?.businessName ?? null;
  }, [user]);

  const profileOffersQuery = useQuery<{ offers: ProfileOffer[] }>({
    queryKey: ["/api/profile-offers/mine"],
    queryFn: async () => {
      const response = await fetch("/api/profile-offers/mine", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load profile offers");
      return response.json();
    },
    staleTime: 30_000,
  });

  const profilePurchasesQuery = useQuery<{ purchases: ProfileOfferPurchase[] }>({
    queryKey: ["/api/profile-offer-purchases/mine", "seller"],
    queryFn: async () => {
      const response = await fetch("/api/profile-offer-purchases/mine?role=seller", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to load profile purchases");
      return response.json();
    },
    staleTime: 30_000,
  });

  const publicProfilesQuery = useQuery<PublicProfileSummary[]>({
    queryKey: ["/api/profiles"],
    queryFn: async () => apiRequest("GET", "/api/profiles"),
    staleTime: 60_000,
  });

  const booksFoundationQuery = useQuery<any>({
    queryKey: ["/api/accounting/books-foundation"],
    queryFn: async () => apiRequest("GET", "/api/accounting/books-foundation"),
    staleTime: 60_000,
  });

  const businessOnboardingQuery = useQuery<{ businessOnboarding: BusinessOnboardingState }>({
    queryKey: ["/api/user/business-onboarding"],
    queryFn: async () => apiRequest("GET", "/api/user/business-onboarding"),
    staleTime: 30_000,
  });

  const updateBusinessOnboardingMutation = useMutation({
    mutationFn: async ({
      moduleId,
      status,
    }: {
      moduleId: keyof BusinessOnboardingState["modules"];
      status: BusinessOnboardingState["modules"][keyof BusinessOnboardingState["modules"]];
    }) =>
      apiRequest("PATCH", "/api/user/business-onboarding", {
        moduleId,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/business-onboarding"] });
    },
    onError: (error: any) => {
      toast({
        title: "Business setup not updated",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const resetOfferForm = () => {
    setEditingOfferId(null);
    setOfferType("service");
    setOfferTitle("");
    setOfferDescription("");
    setOfferPrice("");
    setServiceCategory("");
    setServiceDurationMinutes("");
    setItemSku("");
    setItemStockQuantity("");
    setItemFulfillmentMode("manual_review");
    setShippingCost("");
    setItemCategory("");
    setTaxCategory("");
    setOfferImageUrls("");
    setFulfillmentPolicy("");
    setReturnPolicy("");
  };

  const startEditingOffer = (offer: ProfileOffer) => {
    setEditingOfferId(offer.id);
    setOfferType(offer.offerType);
    setOfferTitle(offer.title || "");
    setOfferDescription(offer.description || "");
    setOfferPrice(String(offer.price ?? ""));
    setServiceCategory(offer.serviceCategory || "");
    setServiceDurationMinutes(
      offer.serviceDurationMinutes === null || offer.serviceDurationMinutes === undefined
        ? ""
        : String(offer.serviceDurationMinutes)
    );
    setItemSku(offer.itemSku || "");
    setItemStockQuantity(
      offer.itemStockQuantity === null || offer.itemStockQuantity === undefined
        ? ""
        : String(offer.itemStockQuantity)
    );
    const nextFulfillment = String(offer.fulfillmentMode || "manual_review");
    setItemFulfillmentMode(
      nextFulfillment === "shipping" ||
        nextFulfillment === "pickup" ||
        nextFulfillment === "digital"
        ? nextFulfillment
        : "manual_review"
    );
    setShippingCost(String(offer.shippingCost || ""));
    setItemCategory(offer.metadata?.itemCategory || offer.metadata?.exchangeCategorySlug || "");
    setTaxCategory(offer.metadata?.taxCategory || "");
    setOfferImageUrls((offer.metadata?.imageUrls || offer.metadata?.images || []).join("\n"));
    setFulfillmentPolicy(offer.metadata?.fulfillmentPolicy || "");
    setReturnPolicy(offer.metadata?.returnPolicy || "");
    document.getElementById("fixed-price-offers")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const saveOfferMutation = useMutation({
    mutationFn: async () => {
      const price = Number(offerPrice);
      const duration = serviceDurationMinutes ? Number(serviceDurationMinutes) : undefined;
      const stock = itemStockQuantity ? Number(itemStockQuantity) : undefined;
      const shipping = shippingCost ? Number(shippingCost) : 0;
      if (!offerTitle.trim()) throw new Error("Add an offer name.");
      if (!Number.isFinite(price) || price < 0) throw new Error("Add a valid price.");
      if (duration !== undefined && (!Number.isFinite(duration) || duration < 0)) {
        throw new Error("Add a valid service duration.");
      }
      if (stock !== undefined && (!Number.isFinite(stock) || stock < 0)) {
        throw new Error("Add a valid stock quantity.");
      }
      if (!Number.isFinite(shipping) || shipping < 0) throw new Error("Add a valid shipping cost.");
      const imageUrls = offerImageUrls
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 6);

      const response = await fetch(
        editingOfferId
          ? `/api/profile-offers/${encodeURIComponent(editingOfferId)}`
          : "/api/profile-offers",
        {
          method: editingOfferId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: offerTitle.trim(),
            description: offerDescription.trim() || undefined,
            offerType,
            price,
            serviceCategory:
              offerType === "service" ? serviceCategory.trim() || undefined : undefined,
            serviceDurationMinutes: offerType === "service" ? duration : undefined,
            itemSku: offerType === "item" ? itemSku.trim() || undefined : undefined,
            itemStockQuantity: offerType === "item" ? stock : undefined,
            fulfillmentMode: offerType === "service" ? "scheduled_service" : itemFulfillmentMode,
            shippingCost: offerType === "item" && itemFulfillmentMode === "shipping" ? shipping : 0,
            metadata:
              offerType === "item"
                ? {
                    itemCategory: itemCategory.trim() || undefined,
                    exchangeCategorySlug: itemCategory.trim() || undefined,
                    taxCategory: taxCategory.trim() || undefined,
                    imageUrls,
                    images: imageUrls,
                    fulfillmentPolicy: fulfillmentPolicy.trim() || undefined,
                    returnPolicy: returnPolicy.trim() || undefined,
                  }
                : undefined,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to save offer");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-offers/mine"] });
      resetOfferForm();
      toast({
        title: editingOfferId ? "Offer updated" : "Offer created",
        description:
          offerType === "service"
            ? "People can start a guided job flow from your profile."
            : "People can buy it from your profile and route receipt/shipping review to you.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Offer not saved",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const toggleOfferMutation = useMutation({
    mutationFn: async (offer: ProfileOffer) => {
      const response = await fetch(`/api/profile-offers/${encodeURIComponent(offer.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !offer.isActive }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to update offer");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-offers/mine"] });
    },
    onError: (error: any) => {
      toast({
        title: "Offer not updated",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  const fulfillmentActionMutation = useMutation({
    mutationFn: async ({
      purchase,
      action,
    }: {
      purchase: ProfileOfferPurchase;
      action: string;
    }) => {
      const response = await fetch(
        `/api/profile-offer-purchases/${encodeURIComponent(purchase.id)}/fulfillment-action`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: purchaseNotes[purchase.id] || undefined,
            trackingNumber: trackingNumbers[purchase.id] || undefined,
            trackingCarrier: trackingCarriers[purchase.id] || undefined,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data?.error || data?.message || "Failed to update purchase");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-offer-purchases/mine", "seller"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/automation-events"] });
      toast({
        title: "Purchase updated",
        description:
          "Fulfillment and accounting review were updated without releasing contact or moving money.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Purchase not updated",
        description: formatUserFacingErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    },
  });

  // ── Verification status queries ──────────────────────────────────────────
  const identityQuery = useQuery<IdentityStatusResponse>({
    queryKey: ["/api/identity-verification/status"],
    queryFn: () => apiRequest("GET", "/api/identity-verification/status"),
    staleTime: 60_000,
  });

  const addressQuery = useQuery<AddressStatusResponse>({
    queryKey: ["/api/address-verification/status"],
    queryFn: () => apiRequest("GET", "/api/address-verification/status"),
    staleTime: 60_000,
  });

  // ── Derive step statuses ─────────────────────────────────────────────────
  const steps: VerificationStep[] = useMemo(() => {
    const emailDone = user?.emailVerified === true;
    const addressDone = addressQuery.data?.isVerified === true;
    const identityDone = identityQuery.data?.isVerified === true;
    const addressPending = !addressDone && addressQuery.data?.requiresVerification === false;
    const identityPending =
      !identityDone &&
      identityQuery.data?.verification !== null &&
      identityQuery.data?.verification !== undefined;

    // License and insurance: read from user object (populated by sanitizeUserForResponse
    // via trust snapshot enrichment) with graceful fallback to trustSnapshot directly.
    const trustSnapshot = (user as any)?.trustSnapshot as TrustSnapshot | undefined;
    const licenseStatus = trustSnapshot?.licenseStatus ?? null;
    const insuranceStatus = trustSnapshot?.insuranceStatus ?? null;
    const licenseDone = (user as any)?.licenseVerified === true || licenseStatus === "verified";
    const licensePending =
      !licenseDone && (licenseStatus === "submitted" || licenseStatus === "pending_review");
    const insuranceDone =
      (user as any)?.insuranceVerified === true || insuranceStatus === "verified";
    const insurancePending =
      !insuranceDone && (insuranceStatus === "submitted" || insuranceStatus === "pending_review");

    // Public profile: consider done if user has a profileImageUrl or a bio/description
    const profileDone =
      Boolean((user as any)?.profileImageUrl) ||
      Boolean((user as any)?.bio) ||
      Boolean((user as any)?.about);

    return [
      {
        id: "email",
        label: "Verify your email",
        description: "Confirm your email address to activate your account.",
        icon: User,
        status: emailDone ? "complete" : "not_started",
        href: "/settings",
        priority: "required",
      },
      {
        id: "identity",
        label: "Verify your identity",
        description: "Upload a government-issued ID so customers know you're a real person.",
        icon: ShieldCheck,
        status: identityDone ? "complete" : identityPending ? "pending" : "not_started",
        href: "/identity-verification",
        priority: "required",
      },
      {
        id: "address",
        label: "Verify your address",
        description:
          "Confirm your service area so TradeScout can route the right local requests to you.",
        icon: MapPin,
        status: addressDone ? "complete" : addressPending ? "pending" : "not_started",
        href: "/address-verification",
        priority: "recommended",
      },
      {
        id: "license",
        label: "Add license or credentials",
        description: "Credential checks help Trust/CVS understand where you can safely be shown.",
        icon: FileText,
        status: licenseDone ? "complete" : licensePending ? "pending" : "not_started",
        href: "/license-verification",
        priority: "recommended",
      },
      {
        id: "insurance",
        label: "Upload proof of insurance",
        description:
          "Some services require proof of insurance before hiring or fulfillment. Upload yours here.",
        icon: Briefcase,
        status: insuranceDone ? "complete" : insurancePending ? "pending" : "not_started",
        href: "/insurance-verification",
        priority: "recommended",
      },
      {
        id: "profile",
        label: "Complete your public profile",
        description:
          "Add a photo, bio, service tags, product context, and proof so customers can inspect you.",
        icon: Star,
        status: profileDone ? "complete" : "not_started",
        href: "/profile",
        priority: "optional",
      },
    ];
  }, [user, identityQuery.data, addressQuery.data]);

  const completedCount = steps.filter((s) => s.status === "complete").length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  const isVerified = user?.verifiedBadge === true || user?.verificationStatus === "approved";
  const profileOffers = profileOffersQuery.data?.offers || [];
  const profilePurchases = profilePurchasesQuery.data?.purchases || [];
  const publicProfiles = publicProfilesQuery.data || [];
  const activeProfileId = String((user as any)?.activeProfileId || "");
  const activeBusinessId = String((user as any)?.activeBusinessId || "");
  const activePublicProfile =
    publicProfiles.find((profile) => profile.id === activeProfileId) ||
    publicProfiles.find((profile) => profile.status === "published") ||
    publicProfiles[0] ||
    null;
  const activeBusinessProfile =
    publicProfiles.find(
      (profile) => activeBusinessId && String(profile.businessId || "") === activeBusinessId
    ) || null;
  const hasPublicProfile = Boolean(activePublicProfile);
  const hasBusinessProfile = Boolean(activeBusinessProfile);
  const hasFixedPriceOffers = profileOffers.length > 0;
  const hasFinanceFoundation = Number(booksFoundationQuery.data?.counts?.accounts || 0) > 0;
  const businessOnboarding = businessOnboardingQuery.data?.businessOnboarding;
  const onboardingModules = [
    {
      id: "identity_profile" as const,
      title: "Identity and public profile",
      description: "Complete core business identity so people know who they are working with.",
    },
    {
      id: "service_catalog" as const,
      title: "Services and offers",
      description: "Add service categories, listings, and first fixed-price offers.",
    },
    {
      id: "coverage_availability" as const,
      title: "Service area and availability",
      description: "Set where you serve and your day-to-day operating coverage.",
    },
    {
      id: "trust_verification" as const,
      title: "Trust and verification",
      description: "Complete verification so routing and visibility can safely expand.",
    },
    {
      id: "operations_payout" as const,
      title: "Operations and payout",
      description: "Confirm books and payout-readiness for active order workflows.",
    },
  ];
  const launchItems = [
    {
      id: "public_profile",
      label: "Public profile",
      description: "Your personal/public profile is the safe surface people can inspect first.",
      done: hasPublicProfile,
      href: activePublicProfile?.slug
        ? `/u/${encodeURIComponent(activePublicProfile.slug)}/edit`
        : "/profile",
      icon: Eye,
    },
    {
      id: "business_profile",
      label: "Business profile",
      description: "Your business page carries services, coverage, proof, and SEO.",
      done: hasBusinessProfile,
      href: activeBusinessProfile?.slug
        ? `/u/${encodeURIComponent(activeBusinessProfile.slug)}/edit`
        : "/profile",
      icon: Building2,
    },
    {
      id: "fixed_price_offers",
      label: "Fixed-price offers",
      description: "Services start job flows. Items create receipt and fulfillment review.",
      done: hasFixedPriceOffers,
      href: "fixed-price-offers",
      icon: ShoppingBag,
    },
    {
      id: "books_foundation",
      label: "Books foundation",
      description: "Profile purchases flow into finance review before posting or payment actions.",
      done: hasFinanceFoundation,
      href: "/finances",
      icon: WalletCards,
    },
  ];

  return (
    <>
      <SEOHelmet
        title="Set Up Your Business Profile | TradeScout"
        description="Complete your business profile, offers, verification, and finance setup so customers can start gated jobs or purchases on TradeScout."
      />

      <div className="min-h-full">
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          {/* ── Welcome header ─────────────────────────────────────────── */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-ts-orange" />
              <h1 className="text-2xl font-bold text-white">
                {displayName ? `Welcome, ${displayName}!` : "Set up your business profile"}
              </h1>
            </div>
            {businessName && <p className="text-white/60 text-sm pl-8">{businessName}</p>}
            <p className="text-white/60 text-sm pl-8">
              Complete the steps below to publish your business surface, sell offers, and receive
              gated requests.
            </p>
          </div>

          {/* ── Verified badge (shown once fully verified) ─────────────── */}
          {isVerified && (
            <Card className="border border-green-500/30 bg-green-500/10">
              <CardContent className="p-4 flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-green-400 shrink-0" />
                <div>
                  <p className="text-green-300 font-semibold text-sm">You're verified!</p>
                  <p className="text-green-400/70 text-xs">
                    Your profile shows a verified badge to potential customers.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {!isVerified && (
            <Card className="border border-amber-500/40 bg-amber-500/10">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-300 shrink-0" />
                  <div>
                    <p className="text-amber-200 font-semibold text-sm">
                      Verification can wait, but discovery stays locked.
                    </p>
                    <p className="text-amber-100/80 text-xs leading-relaxed mt-1">
                      You can keep setting up offers and operations now. Your business will not be
                      shown in public discovery until verification is complete.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-ts-orange text-white hover:bg-ts-orange/90"
                    onClick={() => navigate("/identity-verification")}
                  >
                    Verify identity
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/address-verification")}
                  >
                    Verify address
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {onboardingMode && businessOnboarding ? (
            <Card className="border-ts-orange/40 bg-tsCard">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-ts-orange" />
                  Business onboarding modules
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <p className="text-xs text-white/65">
                  Business type:{" "}
                  <span className="text-white">{businessOnboarding.businessType}</span>
                </p>
                {onboardingModule ? (
                  <div className="rounded-md border border-ts-orange/40 bg-ts-orange/10 px-2.5 py-2 text-xs text-ts-orange">
                    Focus now: {onboardingModule.replace(/_/g, " ")}
                  </div>
                ) : null}
                {onboardingModules.map((module) => {
                  const status = businessOnboarding.modules[module.id] || "not_started";
                  const isVerificationModule = module.id === "trust_verification";
                  return (
                    <div
                      key={module.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium text-white">{module.title}</div>
                          <div className="text-xs text-white/50">{module.description}</div>
                        </div>
                        <Badge className="border-white/15 bg-white/5 text-white/70">
                          {status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(["not_started", "in_progress", "complete"] as const).map((nextStatus) => (
                          <Button
                            key={nextStatus}
                            type="button"
                            size="sm"
                            variant={status === nextStatus ? "default" : "outline"}
                            disabled={
                              updateBusinessOnboardingMutation.isPending ||
                              (isVerificationModule && nextStatus === "complete" && !isVerified)
                            }
                            onClick={() =>
                              updateBusinessOnboardingMutation.mutate({
                                moduleId: module.id,
                                status: nextStatus,
                              })
                            }
                          >
                            {nextStatus.replace(/_/g, " ")}
                          </Button>
                        ))}
                        {isVerificationModule && status !== "complete" ? (
                          <Badge className="border-amber-500/30 bg-amber-500/15 text-amber-200">
                            Skippable now • required for discovery
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {/* ── Progress card ───────────────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">Profile completion</CardTitle>
                <span className="text-ts-orange font-bold text-sm">
                  {completedCount}/{steps.length} steps
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={progressPct} className="h-2 bg-white/10 [&>div]:bg-ts-orange" />
              <p className="text-white/50 text-xs">
                {progressPct < 100
                  ? `${100 - progressPct}% remaining — complete all required steps to unlock your verified badge.`
                  : "All steps complete. Your verified badge is active."}
              </p>
            </CardContent>
          </Card>

          {/* ── Launch checklist ────────────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-ts-orange" />
                Profile launch setup
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {launchItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.href === "fixed-price-offers") {
                        document.getElementById("fixed-price-offers")?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                        return;
                      }
                      navigate(item.href);
                    }}
                    className="rounded-lg border border-white/10 bg-black/20 p-3 text-left transition hover:border-ts-orange/60 hover:bg-black/30"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 text-ts-orange" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{item.label}</span>
                          {item.done ? (
                            <Badge className="border-green-500/30 bg-green-500/15 px-1.5 py-0 text-[10px] text-green-300">
                              Ready
                            </Badge>
                          ) : (
                            <Badge className="border-white/10 bg-white/5 px-1.5 py-0 text-[10px] text-white/50">
                              Needed
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-white/45">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* ── Fixed-price offer setup ─────────────────────────────────── */}
          <Card id="fixed-price-offers" className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-ts-orange" />
                Fixed-price services and items
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {profileOffers.slice(0, 4).map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white">
                          {offer.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>
                            {offer.offerType === "service" ? "Service job flow" : "Item sale"}
                          </span>
                          {offer.offerType === "service" && offer.serviceDurationMinutes ? (
                            <span>{offer.serviceDurationMinutes} min</span>
                          ) : null}
                          {offer.offerType === "item" &&
                          offer.itemStockQuantity !== null &&
                          offer.itemStockQuantity !== undefined ? (
                            <span>{offer.itemStockQuantity} in stock</span>
                          ) : null}
                          {offer.offerType === "item" && offer.fulfillmentMode ? (
                            <span>{String(offer.fulfillmentMode).replace(/_/g, " ")}</span>
                          ) : null}
                          {offer.offerType === "item" && offer.metadata?.itemCategory ? (
                            <span>{offer.metadata.itemCategory}</span>
                          ) : null}
                          {offer.offerType === "item" && offer.metadata?.taxCategory ? (
                            <span>tax: {offer.metadata.taxCategory}</span>
                          ) : null}
                          <Badge
                            className={
                              offer.isActive
                                ? "border-green-500/30 bg-green-500/15 px-1.5 py-0 text-[10px] text-green-300"
                                : "border-white/10 bg-white/5 px-1.5 py-0 text-[10px] text-white/45"
                            }
                          >
                            {offer.isActive ? "Live" : "Paused"}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-white">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: offer.currency || "USD",
                          }).format(Number(offer.price || 0))}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 px-2 text-xs text-white/60 hover:text-white"
                          onClick={() => startEditingOffer(offer)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="mt-1 h-7 px-2 text-xs text-white/60 hover:text-white"
                          onClick={() => toggleOfferMutation.mutate(offer)}
                          disabled={toggleOfferMutation.isPending}
                        >
                          {offer.isActive ? "Pause" : "Resume"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {profileOffers.length === 0 && (
                  <div className="sm:col-span-2 rounded-lg border border-dashed border-white/10 bg-black/10 p-3 text-xs text-white/50">
                    Add a set price that can be started from your profile. Service purchases create
                    a guided work request; item purchases create receipt and shipping review.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={offerType === "service" ? "default" : "outline"}
                    onClick={() => setOfferType("service")}
                  >
                    Service
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={offerType === "item" ? "default" : "outline"}
                    onClick={() => setOfferType("item")}
                  >
                    Item
                  </Button>
                </div>
                {editingOfferId ? (
                  <div className="rounded-md border border-ts-orange/30 bg-ts-orange/10 px-3 py-2 text-xs text-ts-orange">
                    Editing an existing offer. Changes affect new purchases only.
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <div>
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                      Offer name
                    </Label>
                    <Input
                      value={offerTitle}
                      onChange={(event) => setOfferTitle(event.target.value)}
                      placeholder={
                        offerType === "service" ? "Consultation or tune-up" : "Custom shelf"
                      }
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                      Price
                    </Label>
                    <Input
                      value={offerPrice}
                      onChange={(event) => setOfferPrice(event.target.value)}
                      inputMode="decimal"
                      placeholder="150"
                      className="mt-1"
                    />
                  </div>
                </div>
                {offerType === "service" ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Service category
                      </Label>
                      <Input
                        value={serviceCategory}
                        onChange={(event) => setServiceCategory(event.target.value)}
                        placeholder="consulting, repair, cleaning, food, care"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Duration
                      </Label>
                      <Input
                        value={serviceDurationMinutes}
                        onChange={(event) => setServiceDurationMinutes(event.target.value)}
                        inputMode="numeric"
                        placeholder="60 min"
                        className="mt-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {offerImageUrls.trim() ? (
                      <div className="grid grid-cols-3 gap-2">
                        {offerImageUrls
                          .split(/\r?\n|,/)
                          .map((value) => value.trim())
                          .filter(Boolean)
                          .slice(0, 3)
                          .map((url) => (
                            <div
                              key={url}
                              className="aspect-video overflow-hidden rounded-md border border-white/10 bg-black/30"
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </div>
                          ))}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          SKU or label
                        </Label>
                        <Input
                          value={itemSku}
                          onChange={(event) => setItemSku(event.target.value)}
                          placeholder="Optional inventory label"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Stock
                        </Label>
                        <Input
                          value={itemStockQuantity}
                          onChange={(event) => setItemStockQuantity(event.target.value)}
                          inputMode="numeric"
                          placeholder="10"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Item category
                        </Label>
                        <Input
                          value={itemCategory}
                          onChange={(event) => setItemCategory(event.target.value)}
                          placeholder="tools, furniture, local-food"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Tax category
                        </Label>
                        <Input
                          value={taxCategory}
                          onChange={(event) => setTaxCategory(event.target.value)}
                          placeholder="taxable goods, exempt, prepared food"
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                        Product image URLs
                      </Label>
                      <Textarea
                        value={offerImageUrls}
                        onChange={(event) => setOfferImageUrls(event.target.value)}
                        placeholder="One image URL per line"
                        className="mt-1 min-h-[72px]"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Fulfillment
                        </Label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {(["manual_review", "shipping", "pickup", "digital"] as const).map(
                            (mode) => (
                              <Button
                                key={mode}
                                type="button"
                                size="sm"
                                variant={itemFulfillmentMode === mode ? "default" : "outline"}
                                onClick={() => setItemFulfillmentMode(mode)}
                              >
                                {mode.replace(/_/g, " ")}
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Shipping
                        </Label>
                        <Input
                          value={shippingCost}
                          onChange={(event) => setShippingCost(event.target.value)}
                          inputMode="decimal"
                          placeholder="0"
                          disabled={itemFulfillmentMode !== "shipping"}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Fulfillment policy
                        </Label>
                        <Textarea
                          value={fulfillmentPolicy}
                          onChange={(event) => setFulfillmentPolicy(event.target.value)}
                          placeholder="Pickup window, lead time, packing, delivery expectations"
                          className="mt-1 min-h-[72px]"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                          Return policy
                        </Label>
                        <Textarea
                          value={returnPolicy}
                          onChange={(event) => setReturnPolicy(event.target.value)}
                          placeholder="Return, cancellation, or final-sale terms"
                          className="mt-1 min-h-[72px]"
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.12em] text-white/60">
                    Short description
                  </Label>
                  <Textarea
                    value={offerDescription}
                    onChange={(event) => setOfferDescription(event.target.value)}
                    placeholder="What is included, what happens next, and what the buyer should expect."
                    className="mt-1 min-h-[84px]"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-white/45">
                    No payment, contact release, posting, or shipping happens automatically.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetOfferForm}
                    disabled={saveOfferMutation.isPending}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveOfferMutation.mutate()}
                    disabled={saveOfferMutation.isPending}
                  >
                    {saveOfferMutation.isPending
                      ? "Saving..."
                      : editingOfferId
                        ? "Save offer"
                        : "Add offer"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Purchase review queue ───────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-ts-orange" />
                Profile purchase review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profilePurchases.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-3 text-xs text-white/50">
                  Purchases from your profile will appear here with job, receipt, shipping, and
                  accounting review status.
                </div>
              ) : (
                <div className="space-y-2">
                  {profilePurchases.slice(0, 5).map((purchase) => (
                    <div
                      key={purchase.id}
                      className="rounded-lg border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">
                            {purchase.offerType === "service" ? "Service purchase" : "Item sale"}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                            {purchase.quantity ? <span>qty {purchase.quantity}</span> : null}
                            <span>{purchase.purchaseStatus.replace(/_/g, " ")}</span>
                            <span>{purchase.paymentStatus.replace(/_/g, " ")}</span>
                            {purchase.shippingStatus ? (
                              <span>shipping: {purchase.shippingStatus.replace(/_/g, " ")}</span>
                            ) : null}
                            {purchase.workRequestId ? <span>work request ready</span> : null}
                            {purchase.receiptDocumentId ? <span>receipt ready</span> : null}
                            {purchase.metadata?.trackingNumber ? (
                              <span>tracking: {String(purchase.metadata.trackingNumber)}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-white">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: purchase.currency || "USD",
                            }).format(Number(purchase.totalAmount || 0))}
                          </div>
                          <div className="text-[11px] text-white/45">
                            includes{" "}
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: purchase.currency || "USD",
                            }).format(
                              Number(purchase.platformFee ?? TRADESCOUT_TRANSACTION_FEE_USD)
                            )}{" "}
                            TradeScout fee
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 px-2 text-xs text-white/60 hover:text-white"
                            onClick={() => navigate("/finances")}
                          >
                            Review books
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 px-2 text-xs text-white/60 hover:text-white"
                            onClick={() =>
                              navigate(`/profile-purchases/${encodeURIComponent(purchase.id)}`)
                            }
                          >
                            View order
                          </Button>
                        </div>
                      </div>
                      {purchase.offerType === "item" ? (
                        <div className="mt-3 space-y-2 rounded-md border border-white/10 bg-black/20 p-2">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <Input
                              value={purchaseNotes[purchase.id] || ""}
                              onChange={(event) =>
                                setPurchaseNotes((prev) => ({
                                  ...prev,
                                  [purchase.id]: event.target.value,
                                }))
                              }
                              placeholder="Seller note"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={trackingCarriers[purchase.id] || ""}
                              onChange={(event) =>
                                setTrackingCarriers((prev) => ({
                                  ...prev,
                                  [purchase.id]: event.target.value,
                                }))
                              }
                              placeholder="Carrier"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={trackingNumbers[purchase.id] || ""}
                              onChange={(event) =>
                                setTrackingNumbers((prev) => ({
                                  ...prev,
                                  [purchase.id]: event.target.value,
                                }))
                              }
                              placeholder="Tracking #"
                              className="h-8 text-xs"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              ["accept_order", "Confirm"],
                              ["mark_paid", "Mark paid"],
                              ["ready_for_pickup", "Ready"],
                              ["mark_shipped", "Shipped"],
                              ["mark_delivered", "Delivered"],
                              ["cancel_order", "Cancel"],
                              ["mark_refunded", "Refunded"],
                            ].map(([action, label]) => (
                              <Button
                                key={action}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                disabled={fulfillmentActionMutation.isPending}
                                onClick={() =>
                                  fulfillmentActionMutation.mutate({ purchase, action })
                                }
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                          <p className="text-[11px] leading-relaxed text-white/40">
                            These actions update fulfillment/accounting review only; contact,
                            payment movement, and shipment handoff stay gated.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Verification checklist ──────────────────────────────────── */}
          <Card className="border-white/10 bg-tsCard">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-ts-orange" />
                Verification checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-white/5">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => navigate(step.href)}
                  className="w-full flex items-start gap-3 py-3 text-left group hover:bg-white/5 -mx-6 px-6 transition-colors first:-mt-2 last:-mb-2"
                >
                  {stepStatusIcon(step.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-medium ${
                          step.status === "complete" ? "text-white/50 line-through" : "text-white"
                        }`}
                      >
                        {step.label}
                      </span>
                      {priorityBadge(step.priority)}
                    </div>
                    <p className="text-white/40 text-xs mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                  {step.status !== "complete" && (
                    <ChevronRight className="h-4 w-4 text-white/30 group-hover:text-white/60 shrink-0 mt-0.5 transition-colors" />
                  )}
                </button>
              ))}
            </CardContent>
          </Card>

          {/* ── Quick actions ───────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 h-auto py-3 flex flex-col items-center gap-1"
              onClick={() => navigate("/profile")}
            >
              <Eye className="h-4 w-4" />
              <span className="text-xs">View public profile</span>
            </Button>
            <Button
              className="bg-ts-orange hover:bg-ts-orange/90 text-white h-auto py-3 flex flex-col items-center gap-1"
              onClick={() => navigate("/direct-connect")}
            >
              <ArrowRight className="h-4 w-4" />
              <span className="text-xs">Open Direct Connect</span>
            </Button>
          </div>

          {/* ── Why verification matters ─────────────────────────────────── */}
          <Card className="border-white/5 bg-white/3">
            <CardContent className="p-4 space-y-2">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Why get verified?
              </p>
              <ul className="space-y-1.5">
                {[
                  "Verified badge shown on all job matches and your public profile",
                  "Trust/CVS can use verified facts when deciding exposure",
                  "Customers can start a gated job or purchase flow with clearer confidence",
                  "Profile purchases become reviewable work requests, receipts, and bookkeeping drafts",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-white/50 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-ts-orange shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
