/**
 * ExchangeListingDetail.tsx
 *
 * Dedicated listing detail page at /exchange/:category/:listingId
 * Shows full specs, photo gallery, set/collection items, and contact flow.
 */

import React, { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Star,
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
  MessageSquare,
} from "lucide-react";
import { share } from "@/utils/share";
import { CATEGORY_CONFIGS } from "./categoryConfigs";
import { SELL_CATEGORY_FIELDS } from "@shared/exchangeListingRules";

// ─── Types ────────────────────────────────────────────────────────────────────

type SetItem = {
  name: string;
  description?: string;
  price?: number;
  imageUrl?: string;
};

type ListingDetail = {
  id: string;
  title: string;
  description: string;
  price: number;
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
  shippingCost: number | null;
  year?: number;
  mileage?: number;
  brand?: string;
  model?: string;
  specifications?: Record<string, any>;
  slug?: string;
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
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryOffer, setInquiryOffer] = useState("");

  const categoryConfig = CATEGORY_CONFIGS[category ?? ""] ?? null;

  // ── Fetch listing ──────────────────────────────────────────────────────────
  const {
    data: listing,
    isLoading,
    isError,
  } = useQuery<ListingDetail>({
    queryKey: ["/api/marketplace/listings", listingId],
    queryFn: async () => {
      const res = await fetch(`/api/marketplace/listings/${encodeURIComponent(listingId ?? "")}`);
      if (!res.ok) throw new Error("Listing not found");
      const raw = await res.json();
      // Normalise the API shape to match our type
      return {
        id: String(raw.id),
        title: raw.title ?? "",
        description: raw.description ?? "",
        price: Number(raw.price ?? 0),
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
        shippingCost: raw.shippingCost != null ? Number(raw.shippingCost) : null,
        year: raw.year ? Number(raw.year) : undefined,
        mileage: raw.mileage != null ? Number(raw.mileage) : undefined,
        brand: raw.brand ?? raw.make ?? undefined,
        model: raw.model ?? undefined,
        specifications: raw.specifications ?? undefined,
        slug: raw.slug ?? undefined,
      } as ListingDetail;
    },
    enabled: Boolean(listingId),
  });

  // ── Favorites ──────────────────────────────────────────────────────────────
  const { data: favoriteIds = [] } = useQuery<string[]>({
    queryKey: ["/api/exchange/favorites"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/exchange/favorites");
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).map((f: any) => String(f?.listingId || f?.id || ""));
    },
  });
  const isFaved = listing ? favoriteIds.includes(listing.id) : false;

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ listingId: lid, wasSaved }: { listingId: string; wasSaved: boolean }) => {
      const res = await apiRequest(
        wasSaved ? "DELETE" : "POST",
        `/api/exchange/favorites/${encodeURIComponent(lid)}`
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/exchange/favorites"] }),
  });

  // ── Inquiry ────────────────────────────────────────────────────────────────
  const sendInquiryMutation = useMutation({
    mutationFn: async () => {
      if (!listing) throw new Error("No listing");
      const res = await apiRequest("POST", `/api/marketplace/inquiries`, {
        listingId: listing.id,
        message: inquiryMessage,
        offerPrice: inquiryOffer ? Number(inquiryOffer) : undefined,
      });
      if (!res.ok)
        throw new Error(formatUserFacingErrorMessage(await res.json(), "Failed to send inquiry"));
    },
    onSuccess: () => {
      toast({ title: "Inquiry sent", description: "The seller will be notified." });
      setContactOpen(false);
      setInquiryMessage("");
      setInquiryOffer("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to send",
        description: formatUserFacingErrorMessage(err, "Failed to send inquiry"),
        variant: "destructive",
      });
    },
  });

  // ── Photo nav ──────────────────────────────────────────────────────────────
  const photos = listing?.images ?? [];
  const prevPhoto = () => setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1));
  const nextPhoto = () => setPhotoIndex((i) => (i === photos.length - 1 ? 0 : i + 1));

  // ── Spec rows (config-driven for all 13 categories) ──────────────────────
  function buildSpecRows(l: ListingDetail): Array<{ label: string; value: string }> {
    const rows: Array<{ label: string; value: string }> = [];
    const slug = category as string;

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

  const setItems: SetItem[] = listing?.specifications?.setItems ?? [];
  const isSetListing = setItems.length > 0;
  const listingType: string = listing?.specifications?.listingType ?? "";

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-tsBackground flex items-center justify-center">
        <div className="animate-pulse text-white/40 text-sm">Loading listing…</div>
      </div>
    );
  }

  if (isError || !listing) {
    return (
      <div className="min-h-screen bg-tsBackground flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white/60 text-sm">
          This listing could not be found or has been removed.
        </p>
        <Button
          variant="ghost"
          onClick={() => navigate(category ? `/exchange/${category}` : "/exchange")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {categoryConfig?.name ?? "Exchange"}
        </Button>
      </div>
    );
  }

  const specRows = buildSpecRows(listing);
  const backPath = category ? `/exchange/${category}` : "/exchange";

  return (
    <>
      <SEOHelmet
        title={`${listing.title} — TradeScout Exchange`}
        description={listing.description.slice(0, 160)}
        canonical={`/exchange/${category}/${listing.id}`}
        keywords={[categoryConfig?.name ?? "", listing.brand ?? "", listing.condition]
          .filter(Boolean)
          .join(", ")}
      />

      <div className="min-h-screen bg-tsBackground text-white">
        {/* ── Top nav bar ── */}
        <div className="sticky top-0 z-30 bg-tsBackground/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            className="text-white/70 hover:text-white -ml-2"
            onClick={() => navigate(backPath)}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            <span className="text-sm">{categoryConfig?.name ?? "Exchange"}</span>
          </Button>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 w-8 p-0 ${isFaved ? "text-rose-400" : "text-white/50 hover:text-white"}`}
              onClick={() => {
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
              className="h-8 w-8 p-0 text-white/50 hover:text-white"
              onClick={() =>
                share({
                  title: listing.title,
                  text: `${listing.title} — ${formatPrice(listing.price)}`,
                  url: `${window.location.origin}/exchange/${category}/${listing.id}`,
                })
              }
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
          {/* ── Photo gallery ── */}
          {photos.length > 0 ? (
            <div className="relative rounded-xl overflow-hidden bg-black/40">
              <div className="aspect-video">
                <img
                  src={photos[photoIndex]}
                  alt={`${listing.title} — photo ${photoIndex + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-1.5 text-white transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 rounded-full p-1.5 text-white transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPhotoIndex(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-colors ${i === photoIndex ? "bg-white" : "bg-white/40"}`}
                      />
                    ))}
                  </div>
                  <div className="absolute top-2 right-2 bg-black/60 rounded-full px-2 py-0.5 text-[11px] text-white/80">
                    {photoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-xl bg-white/5 flex items-center justify-center">
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
                  className={`shrink-0 w-16 h-12 rounded-md overflow-hidden border-2 transition-colors ${
                    i === photoIndex ? "border-ts-orange" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* ── Title + price ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {listing.featured && (
                <Badge className="mb-1.5 bg-ts-orange/20 text-ts-orange border-ts-orange/30 text-[10px]">
                  Featured
                </Badge>
              )}
              <h1 className="text-xl font-bold text-white leading-snug">{listing.title}</h1>
              <div className="flex items-center gap-2 mt-1 text-[12px] text-white/50">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{listing.location}</span>
                <span>·</span>
                <Eye className="h-3 w-3 shrink-0" />
                <span>{listing.views} views</span>
                <span>·</span>
                <span>Listed {formatListedDate(listing.createdAt)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-ts-orange">{formatPrice(listing.price)}</p>
              {isSetListing && (
                <p className="text-[11px] text-white/50 mt-0.5">
                  {listingType === "collection" ? "Collection" : "Set"} · {setItems.length} items
                </p>
              )}
            </div>
          </div>

          {/* ── Spec badges row ── */}
          {specRows.length > 0 && (
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

          <Separator className="bg-white/10" />

          {/* ── Description ── */}
          <div>
            <h2 className="text-sm font-semibold text-white/80 mb-2">Description</h2>
            <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
              {listing.description}
            </p>
          </div>

          {/* ── Spec table ── */}
          {specRows.length > 0 && (
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
                            {item.price != null && (
                              <span className="text-sm font-semibold text-ts-orange shrink-0">
                                {formatPrice(item.price)}
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

          <Separator className="bg-white/10" />

          {/* ── Seller card ── */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-white">{listing.seller.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{listing.seller.name}</p>
              <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                <Star className="h-3 w-3 text-yellow-500" />
                <span>{listing.seller.rating.toFixed(1)}</span>
                {listing.seller.verified && (
                  <span className="text-emerald-400 flex items-center gap-0.5">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── CTA ── */}
          <div className="pb-6">
            <Button
              className="w-full bg-ts-orange hover:bg-ts-orange/90 text-white font-semibold h-12 text-base"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate("/pre-scout-setup?mode=signin");
                  return;
                }
                setContactOpen(true);
              }}
            >
              <MessageSquare className="h-5 w-5 mr-2" />
              Contact Seller
            </Button>
          </div>
        </div>
      </div>

      {/* ── Contact dialog ── */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="bg-tsCard border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Contact Seller</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-white/70 text-xs mb-1.5 block">Message</Label>
              <Textarea
                placeholder={`Hi, I'm interested in your ${listing.title}. Is it still available?`}
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none min-h-[100px]"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs mb-1.5 block">Make an Offer (optional)</Label>
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
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" className="text-white/60" onClick={() => setContactOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-ts-orange hover:bg-ts-orange/90 text-white"
              disabled={!inquiryMessage.trim() || sendInquiryMutation.isPending}
              onClick={() => sendInquiryMutation.mutate()}
            >
              {sendInquiryMutation.isPending ? "Sending…" : "Send Inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
