/**
 * ExchangeListingDetail.tsx
 *
 * Dedicated listing detail page at /exchange/:category/:listingId
 * Shows full specs, photo gallery, set/collection items, and contact flow.
 */

import React, { useState, useRef } from "react";
import { stoneSlabMaterialPrice } from "@shared/exchangeStoneBuyerFlow";
import { isStoneRetailListing, STONE_DRAFT_MAX_MESSAGE } from "@shared/exchangeStoneInquiryDraft";
import { useExchangeStoneInquiry } from "@/hooks/useExchangeStoneInquiry";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { sendStoneInquiryRequest } from "@/lib/exchangeStoneInquiryRequest";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  Eye,
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { share } from "@/utils/share";
import { CATEGORY_CONFIGS } from "./categoryConfigs";
import { audienceQualifiedStoneMedia, isPublicStoneId, selectedStoneAudienceSearch, verifiedStoneDetailPath } from "./stonePublicUrls";
import { SELL_CATEGORY_FIELDS } from "@shared/exchangeListingRules";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetItem = {
  name: string;
  description?: string;
  price?: number;
  fallbackValue?: number;
  condition?: string;
  rarityTags?: string[];
  imageUrl?: string;
};

type ListingDetail = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  pricingMode?: "fixed" | "request_quote";
  category: string;
  condition: string;
  images: string[];
  location: string;
  seller: { id: string; name: string; rating: number; verified: boolean };
  createdAt: string;
  featured: boolean;
  views: number;
  favorites: number;
  isLocalPickupOnly: boolean;
  willShip?: boolean;
  shippingCost: number | null;
  year?: number;
  mileage?: number;
  brand?: string;
  model?: string;
  listingType?: "single" | "bundle" | "collection";
  bundlePurchaseMode?: "must_buy_all" | "seller_allows_split" | "buyer_can_choose_items";
  bundleItems?: SetItem[];
  valueGuidance?: {
    suggestedRangeLow: number;
    suggestedRangeHigh: number;
    medianCompPrice: number | null;
    confidence: "low" | "medium" | "high";
    sampleSize: number;
    undercutWarning?: { severity: "soft" | "strong"; message: string };
  };
  rarityTags?: string[];
  rarityConfidence?: "low" | "medium" | "high";
  rarityExplanation?: string;
  shippingQuote?: {
    carrier: "usps" | "ups" | "fedex" | "seller_created";
    serviceName: string;
    estimatedCost: number;
    buyerPays: boolean;
    sellerAbsorbs: boolean;
    labelPurchaseMode: "seller_external" | "platform_label";
  };
  specifications?: Record<string, any>;
  slug?: string;
  sourceType?: string;
  profileOfferId?: string;
  publicProfilePath?: string;
  publicDetailPath?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(price);
}

function formatMileage(m: number): string {
  return m.toLocaleString() + " mi";
}

function formatListedDate(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function TitleStatusBadge({ status }: { status: string }) {
  if (status === "clean")
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
        <CheckCircle className="h-3 w-3 mr-1" />
        Clean Title
      </Badge>
    );
  if (status === "rebuilt")
    return (
      <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Rebuilt Title
      </Badge>
    );
  return (
    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
      <XCircle className="h-3 w-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1)} Title
    </Badge>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExchangeListingDetail() {
  const { category, listingId } = useParams<{ category: string; listingId: string }>();
  const [, navigate] = useLocation();
  const isPublicStone = isPublicStoneId(listingId);
  // Wouter's location hook tracks pathname; search changes need their own subscription.
  const routeSearch = useSearch();
  const selectedMarketSearch = isPublicStone ? selectedStoneAudienceSearch(routeSearch) : null;
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const stoneViewerKey = isPublicStone ? [
    authLoading ? "auth-pending" : isAuthenticated ? String(user?.id || "authenticated") : "guest",
    isAuthenticated ? String(user?.city || "") : "",
    isAuthenticated ? String(user?.stateCode || user?.state_code || user?.state || "") : "",
    isAuthenticated ? String(user?.countryCode || user?.country_code || user?.country || "") : "",
  ] : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryOffer, setInquiryOffer] = useState("");

  // ── Fetch listing ──────────────────────────────────────────────────────────
  const {
    data: listing,
    isLoading,
    isError,
  } = useQuery<ListingDetail>({
    queryKey: isPublicStone
      ? ["/api/marketplace/listings", listingId, selectedMarketSearch ?? routeSearch, stoneViewerKey]
      : ["/api/marketplace/listings", listingId, ""],
    queryFn: async () => {
      if (isPublicStone && authLoading) throw new Error("Viewer location is still loading");
      if (isPublicStone && !selectedMarketSearch) throw new Error("Select a stone market first");
      const res = await fetch(`/api/marketplace/listings/${encodeURIComponent(listingId ?? "")}${isPublicStone ? selectedMarketSearch : ""}`);
      if (!res.ok) throw new Error("Listing not found");
      const raw = await res.json();
      const publicDetailPath = isPublicStone ? verifiedStoneDetailPath(raw.publicDetailPath, listingId!) : null;
      if (isPublicStone && publicDetailPath !== `/exchange/building-materials/${encodeURIComponent(listingId!)}${selectedMarketSearch}`) {
        throw new Error("Stone listing is not available in the selected area");
      }
      // Normalise the API shape to match our type
      return {
        id: String(raw.id),
        title: raw.title ?? "",
        description: raw.description ?? "",
        price: raw.price == null ? null : Number(raw.price),
        pricingMode: raw.pricingMode ?? (raw.price == null ? "request_quote" : "fixed"),
        category: raw.category ?? category ?? "",
        condition: raw.condition ?? "",
        images: Array.isArray(raw.images) ? raw.images : [],
        location: raw.location ?? raw.county ?? "",
        seller: {
          id: String(raw.sellerId ?? raw.seller?.id ?? ""),
          name: raw.sellerName ?? raw.seller?.name ?? "Seller",
          rating: Number(raw.sellerRating ?? raw.seller?.rating ?? 0),
          verified: Boolean(raw.sellerVerified ?? raw.seller?.verified),
        },
        createdAt: raw.createdAt ?? "",
        featured: Boolean(raw.featured),
        views: Number(raw.views ?? raw.viewCount ?? 0),
        favorites: Number(raw.favorites ?? raw.favoriteCount ?? 0),
        isLocalPickupOnly: Boolean(raw.isLocalPickupOnly ?? raw.localPickupOnly),
        willShip: raw.willShip === true,
        shippingCost: raw.shippingCost != null ? Number(raw.shippingCost) : null,
        year: raw.year ? Number(raw.year) : undefined,
        mileage: raw.mileage != null ? Number(raw.mileage) : undefined,
        brand: raw.brand ?? raw.make ?? undefined,
        model: raw.model ?? undefined,
        listingType: raw.listingType ?? undefined,
        bundlePurchaseMode: raw.bundlePurchaseMode ?? undefined,
        bundleItems: Array.isArray(raw.bundleItems) ? raw.bundleItems : undefined,
        valueGuidance: raw.valueGuidance ?? undefined,
        rarityTags: Array.isArray(raw.rarityTags) ? raw.rarityTags : undefined,
        rarityConfidence: raw.rarityConfidence ?? undefined,
        rarityExplanation: raw.rarityExplanation ?? undefined,
        shippingQuote: raw.shippingQuote ?? undefined,
        specifications: raw.specifications ?? undefined,
        slug: raw.slug ?? undefined,
        sourceType: raw.sourceType ?? raw.specifications?.source ?? undefined,
        profileOfferId: raw.profileOfferId ?? raw.specifications?.profileOfferId ?? undefined,
        publicProfilePath: raw.publicProfilePath ?? undefined,
        publicDetailPath: publicDetailPath ?? undefined,
      } as ListingDetail;
    },
    enabled: Boolean(listingId) && (!isPublicStone || (selectedMarketSearch !== null && !authLoading)),
    retry: isPublicStone ? false : undefined,
  });

  const stoneInquiry = useExchangeStoneInquiry({
    listing,
    selectedMarketSearch,
    actorId: user?.id ? String(user.id) : null,
    isAuthenticated,
    message: inquiryMessage,
    setMessage: setInquiryMessage,
    setOpen: setDecisionOpen,
    navigate,
  });
  const submissionLock = useRef(false);
  const visibleListingId = useRef(listing?.id);
  visibleListingId.current = listing?.id;
  const visibleActorId = useRef<string | null>(user?.id ? String(user.id) : null);
  visibleActorId.current = user?.id ? String(user.id) : null;

  // ── Favorites ──────────────────────────────────────────────────────────────
  const { data: favoriteIds = [] } = useQuery<string[]>({
    queryKey: ["/api/marketplace/favorites"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const data = await apiRequest("GET", "/api/marketplace/favorites");
      return (data || []).map((f: any) => String(f?.listingId || f?.id || ""));
    },
  });
  const resolvedCategory = listing?.category || category || "";
  const categoryConfig = CATEGORY_CONFIGS[resolvedCategory] ?? null;
  const isFaved = listing ? favoriteIds.includes(listing.id) : false;

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ listingId: lid, wasSaved }: { listingId: string; wasSaved: boolean }) => {
      if (wasSaved) {
        await apiRequest("DELETE", `/api/marketplace/favorites/${encodeURIComponent(lid)}`);
      } else {
        await apiRequest("POST", "/api/marketplace/favorites", { listingId: lid });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/marketplace/favorites"] }),
  });

  // ── Inquiry ────────────────────────────────────────────────────────────────
  const sendInquiryMutation = useMutation({
    retry: false,
    mutationFn: async (submission: {
      listing: ListingDetail;
      message: string;
      offer: string;
      actorId: string | null;
      inquiryIntent: "availability" | "callback";
    }) => {
      const { listing: selected, message, offer } = submission;
      if (!isAuthenticated) throw new Error("Sign in before sending an inquiry");
      if (submission.actorId !== visibleActorId.current)
        throw new Error("Your account changed. Review the request again.");
      if (isStoneRetailListing(selected)) {
        let requestStorage: Storage | null = null;
        try {
          requestStorage = window.sessionStorage;
        } catch {
          /* server-side legacy replay remains available */
        }
        await sendStoneInquiryRequest(
          apiRequest,
          requestStorage,
          {
            actorId: submission.actorId || "",
            listingId: selected.id,
            title: selected.title,
            message,
            inquiryIntent: submission.inquiryIntent,
          },
          () => submission.actorId === visibleActorId.current
        );
        return selected.id;
      }
      const decisionScope = `marketplace_listing:${selected.id}`;
      const decision = await apiRequest("POST", "/api/decision-cards", {
        intent: "collaborate",
        decisionScope,
        title: `Exchange inquiry: ${selected.title}`,
        description: `Review a protected in-platform inquiry about ${selected.title}.`,
      });
      const sourceDecisionCardId = String(decision?.id || "").trim();
      if (!sourceDecisionCardId) throw new Error("Decision Card creation failed");
      if (submission.actorId !== visibleActorId.current)
        throw new Error("Your account changed. Review the request again.");

      await apiRequest("POST", "/api/marketplace/inquiries", {
        listingId: selected.id,
        message,
        offerAmount: !isStoneRetailListing(selected) && offer ? Number(offer) : undefined,
        authorityGate: "decision_card",
        sourceDecisionCardId,
        decisionScope,
      });
      return selected.id;
    },
    onSuccess: (submittedListingId: string, submission) => {
      if (submission.actorId !== visibleActorId.current) return;
      const retail = isStoneRetailListing(submission.listing);
      toast({
        title: retail ? "Request sent to TradeScout" : "Protected inquiry sent",
        description: retail
          ? "Your stone request was sent. A callback request is not a confirmed call or reservation."
          : "Your Decision Card now authorizes this in-platform conversation.",
      });
      if (retail) stoneInquiry.finish(submittedListingId);
      if (visibleListingId.current === submittedListingId) {
        setDecisionOpen(false);
        setInquiryMessage("");
        setInquiryOffer("");
      }
    },
    onError: (err: any) => {
      toast({
        title: "Could not confirm delivery",
        description: formatUserFacingErrorMessage(
          err,
          "Your message is still here. Check your inquiries before retrying."
        ),
        variant: "destructive",
      });
    },
    onSettled: () => {
      submissionLock.current = false;
    },
  });

  function submitInquiry() {
    if (
      !listing ||
      !inquiryMessage.trim() ||
      submissionLock.current ||
      sendInquiryMutation.isPending
    )
      return;
    if (stoneInquiry.isRetail && !isAuthenticated) {
      stoneInquiry.continueToSignIn();
      return;
    }
    submissionLock.current = true;
    sendInquiryMutation.mutate({
      listing,
      message: inquiryMessage,
      offer: inquiryOffer,
      actorId: visibleActorId.current,
      inquiryIntent: stoneInquiry.intent,
    });
  }

  // ── Photo nav ──────────────────────────────────────────────────────────────
  const candidateRetailPath = stoneInquiry.isRetail && listing && selectedMarketSearch
    ? verifiedStoneDetailPath(listing.publicDetailPath, listing.id)
    : null;
  const retailPublicPath = candidateRetailPath === `/exchange/building-materials/${encodeURIComponent(listing?.id ?? "")}${selectedMarketSearch}`
    ? candidateRetailPath
    : null;
  const photos = (listing?.images ?? []).flatMap((photo) => {
    if (!stoneInquiry.isRetail || !photo.startsWith("/api/exchange/stone-media/")) return [photo];
    const qualified = listing && retailPublicPath
      ? audienceQualifiedStoneMedia(photo, retailPublicPath, listing.id)
      : null;
    return qualified ? [qualified] : [];
  });
  const prevPhoto = () => setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const nextPhoto = () => setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  // ── Spec rows (config-driven for all 13 categories) ──────────────────────
  function buildSpecRows(l: ListingDetail): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [];
    const slug = resolvedCategory;

    // Top-level fields that map to dedicated DB columns
    if (l.year) rows.push({ label: "Year", value: String(l.year) });
    // brand stores make for vehicles/construction/farm/business-equipment/electronics/sports/tools/other
    if (l.brand) {
      const isMakeCategory = ["vehicles", "construction", "farm", "business-equipment"].includes(
        slug
      );
      rows.push({ label: isMakeCategory ? "Make" : "Brand", value: l.brand });
    }
    if (l.model) rows.push({ label: "Model", value: l.model });
    if (l.mileage != null) rows.push({ label: "Mileage", value: formatMileage(l.mileage) });

    // Condition (shown for categories that track it)
    if (l.condition && categoryConfig?.showCondition)
      rows.push({
        label: "Condition",
        value: l.condition.charAt(0).toUpperCase() + l.condition.slice(1),
      });

    // Spec fields driven by SELL_CATEGORY_FIELDS for the current category
    const sellFields = (SELL_CATEGORY_FIELDS as any)[slug] ?? [];
    const SKIP_KEYS = new Set(["year", "make", "model", "mileage", "brand"]);
    for (const field of sellFields) {
      if (SKIP_KEYS.has(field.key)) continue;
      const raw = l.specifications?.[field.key];
      if (raw == null || raw === "") continue;
      // Format boolean-style yes/no fields
      let display = String(raw);
      if (display === "yes") display = "Yes";
      else if (display === "no") display = "No";
      else if (field.key === "mileage" && typeof raw === "number") display = formatMileage(raw);
      else if (typeof raw === "number") display = raw.toLocaleString();
      else {
        // Capitalise first letter
        display = display.charAt(0).toUpperCase() + display.slice(1);
      }
      rows.push({ label: field.label, value: display });
    }

    return rows;
  }

  const setItems: SetItem[] = listing?.bundleItems ?? listing?.specifications?.setItems ?? [];
  const isSetListing = setItems.length > 0;
  const listingType: string = listing?.listingType ?? listing?.specifications?.listingType ?? "";

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading || (isPublicStone && authLoading)) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="animate-pulse text-white/40 text-sm">Loading listing…</div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white/60 text-sm">
          {isPublicStone
            ? "This stone is unavailable in the selected area or can no longer be found."
            : "This listing could not be found or has been removed."}
        </p>
        <Button
          variant="ghost"
          onClick={() => navigate(resolvedCategory ? `/exchange/${resolvedCategory}` : "/exchange")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {categoryConfig?.name ?? "Exchange"}
        </Button>
      </div>
    );
  }

  const specRows = buildSpecRows(listing);
  const backPath = resolvedCategory ? `/exchange/${resolvedCategory}` : "/exchange";
  const isProfileOffer = listing.sourceType === "profile_offer";
  const isProfileCatalog = listing.sourceType === "profile_catalog";
  const isProfileLinked = isProfileOffer || isProfileCatalog;
  const stoneSlabPrice = stoneInquiry.isRetail
    ? stoneSlabMaterialPrice(
        listing.price,
        listing.specifications?.priceUnit,
        listing.specifications?.referenceSizesInches,
        listing.specifications?.exactSlab
      )
    : null;
  const displayedPrice = stoneInquiry.isRetail
    ? stoneSlabPrice?.primaryPrice || "Price unavailable"
    : formatPrice(listing.price as number);
  const retailTitle = stoneInquiry.isRetail
    ? listing.title.replace(/\s*\|\s*TradeScout(?: Stone)?\s*$/i, "")
    : listing.title;
  const retailMaterial =
    typeof listing.specifications?.material === "string"
      ? listing.specifications.material.trim()
      : "";
  const retailReferenceSizes =
    stoneSlabPrice?.kind === "estimated" &&
    typeof listing.specifications?.referenceSizesInches === "string"
      ? listing.specifications.referenceSizesInches
          .split(",")
          .map((size: string) => `${size.trim().replace(/\s*[x×]\s*/i, " × ")} in`)
      : [];
  const retailShareTitle = stoneInquiry.isRetail
    ? stoneSlabPrice?.kind === "size_required"
      ? `Slab price TBD — ${retailTitle}`
      : stoneSlabPrice
        ? `${stoneSlabPrice.primaryPrice} ${stoneSlabPrice.kind === "estimated" ? "estimated " : ""}full slab — ${retailTitle}`
        : `Confirm slab material price — ${retailTitle}`
    : `${retailTitle} — TradeScout Exchange`;
  const retailDescription = stoneSlabPrice?.kind === "size_required"
    ? `Slab price TBD. Published material rate ${stoneSlabPrice.primaryPrice}. Ask TradeScout to confirm the selected slab and delivery.`
    : stoneSlabPrice
      ? `${stoneSlabPrice.primaryLabel}: ${stoneSlabPrice.primaryPrice}.${stoneSlabPrice.secondaryPrice ? ` Material rate ${stoneSlabPrice.secondaryPrice}.` : ""} Ask TradeScout to confirm the selected slab and delivery.`
      : `Ask TradeScout to confirm the slab material price and delivery.`;
  const retailImage = photos[0];

  return (
    <>
      <SEOHelmet
        title={retailShareTitle}
        description={
          stoneInquiry.isRetail
            ? retailDescription
            : listing.description.slice(0, 160)
        }
        canonical={stoneInquiry.isRetail
          ? new URL(retailPublicPath || "/exchange/stone", window.location.origin).toString()
          : `/exchange/${resolvedCategory}/${listing.id}`}
        preserveCanonicalQuery={stoneInquiry.isRetail}
        robots={stoneInquiry.isRetail ? "noindex, follow" : undefined}
        omitCanonical={stoneInquiry.isRetail}
        ogImage={stoneInquiry.isRetail && retailImage
          ? new URL(retailImage, window.location.origin).toString()
          : retailImage}
        keywords={[categoryConfig?.name ?? "", listing.brand ?? "", listing.condition]
          .filter(Boolean)
          .join(", ")}
      />

      <div className="min-h-full text-white">
        {/* ── Top nav bar ── */}
        <div className="sticky top-0 z-30 bg-tsBackground/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 text-white/70 hover:text-white -ml-2"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span className="text-sm">{categoryConfig?.name ?? "Exchange"}</span>
          </Button>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              aria-label={isFaved ? "Remove from saved listings" : "Save listing"}
              className={`h-11 w-11 p-0 ${isFaved ? "text-rose-400" : "text-white/50 hover:text-white"}`}
              disabled={isProfileLinked}
              onClick={() => {
                if (isProfileLinked) return;
                if (!isAuthenticated) {
                  navigate("/pre-scout-setup?mode=signin");
                  return;
                }
                toggleFavoriteMutation.mutate({ listingId: listing.id, wasSaved: isFaved });
              }}
            >
              <Heart className={`h-4 w-4 ${isFaved ? "fill-current" : ""}`} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Share listing"
              className="h-11 w-11 p-0 text-white/50 hover:text-white"
              disabled={stoneInquiry.isRetail && !retailPublicPath}
              onClick={() =>
                share({
                  title: stoneInquiry.isRetail ? retailShareTitle : listing.title,
                  text: stoneInquiry.isRetail
                    ? retailDescription
                    : isProfileCatalog
                    ? `${listing.title} — catalog inquiry through TradeScout`
                    : `${listing.title} — ${displayedPrice}`,
                  url: `${window.location.origin}${retailPublicPath || `/exchange/${resolvedCategory}/${listing.id}`}`,
                })
              }
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className={`${stoneInquiry.isRetail ? "max-w-6xl" : "max-w-4xl"} mx-auto px-4 py-4 space-y-4`}
        >
          <div
            className={
              stoneInquiry.isRetail
                ? "grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start"
                : "space-y-4"
            }
          >
            <div className="space-y-2 min-w-0">
              {/* ── Photo gallery ── */}
              {photos.length > 0 ? (
                <div className="relative rounded-xl overflow-hidden bg-black/40">
                  <div
                    className={stoneInquiry.isRetail ? "h-56 sm:h-72 lg:h-[380px]" : "aspect-video"}
                  >
                    <img
                      src={photos[photoIndex]}
                      alt={`${retailTitle} — photo ${photoIndex + 1}`}
                      className={`w-full h-full ${stoneInquiry.isRetail ? "object-contain" : "object-cover"}`}
                    />
                  </div>
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={prevPhoto}
                        aria-label="Previous photo"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-3 text-white transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        aria-label="Next photo"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-3 text-white transition-colors"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      {!stoneInquiry.isRetail && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {photos.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setPhotoIndex(i)}
                              aria-label={`Show photo ${i + 1} of ${photos.length}`}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                            />
                          ))}
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[11px] text-white/80">
                        {photoIndex + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className={`${stoneInquiry.isRetail ? "h-56 sm:h-72 lg:h-[380px]" : "aspect-video"} rounded-xl bg-white/5 flex items-center justify-center`}
                >
                  <Package className="h-12 w-12 text-white/20" />
                </div>
              )}

              {/* Thumbnail strip */}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {photos.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setPhotoIndex(i)}
                      aria-label={`Show photo ${i + 1} of ${photos.length}`}
                      aria-current={i === photoIndex ? "true" : undefined}
                      className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                        i === photoIndex
                          ? "border-ts-orange"
                          : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Title + price ── */}
            <div
              className={
                stoneInquiry.isRetail
                  ? "min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5"
                  : "space-y-3"
              }
            >
              <div
                className={
                  stoneInquiry.isRetail
                    ? "flex flex-col gap-3"
                    : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                }
              >
                <div className="flex-1 min-w-0">
                  {listing.featured && (
                    <Badge className="mb-1.5 bg-ts-orange/20 text-ts-orange border-ts-orange/30 text-[10px]">
                      Featured
                    </Badge>
                  )}
                  <h1 className="text-xl font-bold text-white leading-snug">{retailTitle}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/50">
                    {stoneInquiry.isRetail ? (
                      <span>Stone material · Ask TradeScout to confirm the selected slab</span>
                    ) : isProfileCatalog ? (
                      <>
                        <Package className="h-3 w-3 shrink-0" />
                        <span>
                          {listing.specifications?.catalogKind === "inventory_item"
                            ? "Profile item"
                            : "Profile catalog"}
                        </span>
                        <span>·</span>
                        <span>Managed TradeScout request</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span>{listing.location}</span>
                        <span>·</span>
                        <Eye className="h-3 w-3 shrink-0" />
                        <span>{listing.views} views</span>
                        <span>·</span>
                        <span>Listed {formatListedDate(listing.createdAt)}</span>
                      </>
                    )}
                  </div>
                  {stoneInquiry.isRetail && retailMaterial && (
                    <p className="mt-2 text-sm text-white/75">{retailMaterial}</p>
                  )}
                </div>
                <div
                  className={`shrink-0 text-left ${stoneInquiry.isRetail ? "" : "sm:text-right"}`}
                >
                  {stoneInquiry.isRetail ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                        {stoneSlabPrice?.primaryLabel || "Full slab material price"}
                      </p>
                      <p
                        className="mt-1 text-2xl font-bold text-ts-orange"
                        data-testid="exchange-stone-slab-price"
                      >
                        {displayedPrice}
                      </p>
                      {stoneSlabPrice?.secondaryPrice ? (
                        <p
                          className="mt-1 text-sm text-white/70"
                          data-testid="exchange-stone-unit-rate"
                        >
                          {stoneSlabPrice.secondaryPrice}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-2xl font-bold text-ts-orange">
                      {isProfileCatalog ? "Request quote" : displayedPrice}
                    </p>
                  )}
                  {isSetListing && (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {listingType === "collection" ? "Collection" : "Set"} · {setItems.length}{" "}
                      items
                    </p>
                  )}
                </div>
              </div>

              {stoneInquiry.isRetail && retailReferenceSizes.length > 0 && (
                <div className="text-sm text-white/70">
                  <p className="text-xs uppercase tracking-wide text-white/50">
                    Recorded reference slab sizes
                  </p>
                  <p className="mt-1">
                    {retailReferenceSizes.slice(0, 2).join(", ")}
                    {retailReferenceSizes.length > 2
                      ? ` · ${retailReferenceSizes.length} sizes recorded`
                      : ""}
                  </p>
                  {retailReferenceSizes.length > 2 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer py-1 text-ts-orange">
                        See all {retailReferenceSizes.length} reference sizes
                      </summary>
                      <p className="mt-1 leading-relaxed">{retailReferenceSizes.join(", ")}</p>
                    </details>
                  )}
                </div>
              )}

              {stoneInquiry.isRetail && (
                <section aria-label="Ask TradeScout about this stone" className="space-y-2">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="min-h-12 flex-1 bg-ts-orange text-white"
                      onClick={() => stoneInquiry.prepare("availability")}
                    >
                      Ask TradeScout about availability
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-12 flex-1"
                      onClick={() => stoneInquiry.prepare("callback")}
                    >
                      Request a callback
                    </Button>
                  </div>
                  <p className="text-sm text-white/70">
                    {stoneSlabPrice?.explanation ||
                      "Material price unavailable. Confirm the selected slab and charges with TradeScout."}
                  </p>
                  <p className="text-xs text-white/50">
                    Review your request before sending. No payment or reservation is made.
                  </p>
                </section>
              )}
            </div>
          </div>

          {/* ── Spec badges row ── */}
          {!stoneInquiry.isRetail && specRows.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {listing.specifications?.titleStatus && (
                <TitleStatusBadge status={listing.specifications.titleStatus} />
              )}
              {listing.year && (
                <Badge variant="outline" className="border-white/15 text-white/70 text-xs">
                  {listing.year}
                </Badge>
              )}
              {listing.brand && (
                <Badge variant="outline" className="border-white/15 text-white/70 text-xs">
                  {listing.brand}
                </Badge>
              )}
              {listing.model && (
                <Badge variant="outline" className="border-white/15 text-white/70 text-xs">
                  {listing.model}
                </Badge>
              )}
              {listing.mileage != null && (
                <Badge variant="outline" className="border-white/15 text-white/70 text-xs">
                  {formatMileage(listing.mileage)}
                </Badge>
              )}
              {listing.specifications?.authenticated === "yes" && (
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Authenticated
                </Badge>
              )}
              {listing.specifications?.graded === "yes" && (
                <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30 text-xs">
                  {listing.specifications.grade
                    ? `Grade: ${listing.specifications.grade}`
                    : "Graded"}
                </Badge>
              )}
            </div>
          )}

          {/* ── Shipping / pickup ── */}
          {!stoneInquiry.isRetail &&
            !isProfileCatalog &&
            (listing.isLocalPickupOnly || listing.willShip === true) && (
              <div className="flex items-center gap-2 text-sm">
                {listing.isLocalPickupOnly ? (
                  <span className="flex items-center gap-1.5 text-white/50">
                    <MapPin className="h-4 w-4" />
                    Local pickup only
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <Truck className="h-4 w-4" />
                    Shipping available
                    {listing.shippingCost != null && listing.shippingCost > 0 && (
                      <span className="text-white/50">· {formatPrice(listing.shippingCost)}</span>
                    )}
                    {listing.shippingCost === 0 && <span className="text-emerald-300">· Free</span>}
                  </span>
                )}
              </div>
            )}

          <Separator className="bg-white/10" />

          {/* ── Description ── */}
          <div>
            <h2 className="text-sm font-semibold text-white/80 mb-2">
              {stoneInquiry.isRetail ? "About this stone" : "Description"}
            </h2>
            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
              {stoneInquiry.isRetail
                ? "Photos are material references. TradeScout will confirm the selected slab's appearance, dimensions, finish, quantity and availability before purchase."
                : listing.description}
            </p>
          </div>

          {!stoneInquiry.isRetail &&
            (listing.valueGuidance || listing.rarityTags?.length || listing.shippingQuote) && (
              <>
                <Separator className="bg-white/10" />
                <div className="grid gap-2 sm:grid-cols-3">
                  {listing.valueGuidance && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-white/40">
                        Fair value
                      </p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {formatPrice(listing.valueGuidance.suggestedRangeLow)} -{" "}
                        {formatPrice(listing.valueGuidance.suggestedRangeHigh)}
                      </p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {listing.valueGuidance.sampleSize} comps ·{" "}
                        {listing.valueGuidance.confidence} confidence
                      </p>
                    </div>
                  )}
                  {listing.rarityTags?.length ? (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-white/40">Rarity</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {listing.rarityTags.slice(0, 3).join(", ")}
                      </p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {listing.rarityConfidence || "low"} confidence
                      </p>
                    </div>
                  ) : null}
                  {listing.shippingQuote && (
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-white/40">Shipping</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {listing.shippingQuote.serviceName}
                      </p>
                      <p className="mt-1 text-[11px] text-white/50">
                        {listing.shippingQuote.buyerPays ? "Buyer pays" : "Included in price"} ·{" "}
                        {formatPrice(listing.shippingQuote.estimatedCost)}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

          {/* ── Spec table ── */}
          {!stoneInquiry.isRetail && specRows.length > 0 && (
            <>
              <Separator className="bg-white/10" />
              <div>
                <h2 className="text-sm font-semibold text-white/80 mb-3">Specifications</h2>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {specRows.map(({ label, value }) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[11px] text-white/40 uppercase tracking-wide">
                        {label}
                      </span>
                      <span className="text-sm text-white/80">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Set / Collection items ── */}
          {isSetListing && (
            <>
              <Separator className="bg-white/10" />
              <div>
                <h2 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-400" />
                  {listingType === "collection" ? "Collection Items" : "Set Items"}
                  <Badge
                    variant="outline"
                    className="border-purple-500/30 text-purple-300 text-[10px]"
                  >
                    {setItems.length} items
                  </Badge>
                </h2>
                <div className="space-y-2">
                  {setItems.map((item, idx) => (
                    <Card key={idx} className="bg-white/5 border-white/10">
                      <CardContent className="p-3 flex gap-3 items-start">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-14 h-14 rounded-md object-cover shrink-0 bg-black/30"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-md bg-white/5 flex items-center justify-center shrink-0">
                            <Tag className="h-5 w-5 text-white/20" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            {(item.price ?? item.fallbackValue) != null && (
                              <span className="text-sm font-semibold text-ts-orange shrink-0">
                                {formatPrice((item.price ?? item.fallbackValue) as number)}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-[12px] text-white/50 mt-0.5 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Seller card ── */}
          {!stoneInquiry.isRetail && (
            <>
              <Separator className="bg-white/10" />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-white">{listing.seller.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{listing.seller.name}</p>
                  <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                    {listing.seller.verified && (
                      <span className="text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                    {!listing.seller.verified && (
                      <span>{isProfileCatalog ? "Business profile" : "Seller profile"}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ── CTA ── */}
              <div className="pb-6">
                <Button
                  className="w-full bg-ts-orange hover:bg-ts-orange/90 text-white font-semibold h-12 text-base"
                  onClick={() => {
                    if (isProfileLinked) {
                      navigate(listing.publicProfilePath || `/profile/${listing.seller.id}`);
                      return;
                    }
                    if (!isAuthenticated) {
                      const returnTo = `/exchange/${encodeURIComponent(category || "other")}/${encodeURIComponent(listing.id)}`;
                      navigate(`/pre-scout-setup?mode=signin&next=${encodeURIComponent(returnTo)}`);
                      return;
                    }
                    setDecisionOpen(true);
                  }}
                >
                  <ShieldCheck className="h-5 w-5 mr-2" />
                  {isProfileOffer
                    ? "Review Purchase on Profile"
                    : isProfileCatalog
                      ? listing.specifications?.catalogKind === "inventory_item"
                        ? "Open Item & Request"
                        : "Open Catalog & Request"
                      : "Review Protected Connection"}
                </Button>
                {isProfileOffer ? (
                  <p className="mt-2 text-center text-[11px] text-white/50">
                    Purchase, receipt, shipping, and accounting steps stay in review before anything
                    is posted or fulfilled.
                  </p>
                ) : isProfileCatalog ? (
                  <p className="mt-2 text-center text-[11px] text-white/50">
                    The maintained profile owns the material detail. Availability, project fit, and
                    pricing are confirmed through TradeScout before contact opens.
                  </p>
                ) : (
                  <p className="mt-2 text-center text-[11px] text-white/50">
                    Intent and a Decision Card are required before an in-platform message is sent.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Intent and Decision Card gate ── */}
      <Dialog
        open={decisionOpen}
        onOpenChange={(open) => {
          if (sendInquiryMutation.isPending) return;
          if (!open && stoneInquiry.isRetail) stoneInquiry.finish();
          else setDecisionOpen(open);
        }}
      >
        <DialogContent className="bg-tsCard border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {stoneInquiry.isRetail ? "Review your stone request" : "Exchange Decision Card"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Review your message before sending it through TradeScout.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-ts-orange/30 bg-ts-orange/10 p-3 text-sm text-white/75">
              <p className="font-medium text-white">Review before connecting</p>
              <p className="mt-1">
                You are expressing interest in <strong>{listing.title}</strong>. Confirming creates
                a durable Decision Card and sends one protected in-platform inquiry. It does not
                reveal either person&apos;s phone number or email.
              </p>
            </div>
            <div>
              <Label className="text-white/70 text-xs mb-1.5 block">
                {stoneInquiry.isRetail && stoneInquiry.intent === "callback"
                  ? "Callback request"
                  : "What do you need to know?"}
              </Label>
              <Textarea
                placeholder={`Hi, I'm interested in your ${listing.title}. Is it still available?`}
                value={inquiryMessage}
                maxLength={stoneInquiry.isRetail ? STONE_DRAFT_MAX_MESSAGE : undefined}
                onChange={(e) => setInquiryMessage(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none min-h-[100px]"
              />
            </div>
            {!stoneInquiry.isRetail && (
              <div>
                <Label className="text-white/70 text-xs mb-1.5 block">
                  Proposed amount (optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                    $
                  </span>
                  <Input
                    type="number"
                    placeholder="0"
                    value={inquiryOffer}
                    onChange={(e) => setInquiryOffer(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 pl-7"
                  />
                </div>
              </div>
            )}
            {stoneInquiry.warning && (
              <p role="alert" className="text-sm text-amber-200">
                {stoneInquiry.warning}
              </p>
            )}
            {stoneInquiry.isRetail && !isAuthenticated && (
              <p className="text-sm text-white/60">
                Sign in to send your request. Your message will return with you.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="min-h-11 text-white/60"
              disabled={sendInquiryMutation.isPending}
              onClick={() =>
                stoneInquiry.isRetail ? stoneInquiry.finish() : setDecisionOpen(false)
              }
            >
              Cancel
            </Button>
            <Button
              className="min-h-11 bg-ts-orange hover:bg-ts-orange/90 text-white"
              disabled={!inquiryMessage.trim() || sendInquiryMutation.isPending}
              onClick={submitInquiry}
            >
              {sendInquiryMutation.isPending
                ? "Sending request…"
                : stoneInquiry.isRetail && !isAuthenticated
                  ? "Sign in to send"
                  : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
