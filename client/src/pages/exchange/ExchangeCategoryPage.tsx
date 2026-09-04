/**
 * ExchangeCategoryPage.tsx
 *
 * Reusable per-category Exchange page.
 * Each category gets its own route (/exchange/vehicles, /exchange/tools, etc.)
 * with category-specific filters, mobile-first layout, and proper OG/SEO tags.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Eye,
  Filter,
  Heart,
  MapPin,
  Plus,
  Search,
  Share2,
  Tag,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { SEOHelmet } from "@/components/SEOHelmet";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { share } from "@/utils/share";
import { useLocationContext, hasCountyContext } from "@/hooks/useLocationContext";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import type { ExchangeCategorySlug } from "@shared/exchangeListingRules";
import { EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME } from "@shared/exchangeListingRules";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExchangeItem = {
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
  shippingCost: number | null;
  sourceType?: string;
  profileOfferId?: string;
  publicProfilePath?: string;
  // Category-specific spec fields
  year?: number;
  mileage?: number;
  brand?: string;
  model?: string;
  specifications?: Record<string, any>;
};

type SearchScope = "local" | "state" | "nationwide";

// ─── Category config ──────────────────────────────────────────────────────────

export type CategoryConfig = {
  slug: ExchangeCategorySlug;
  /** Human-readable name */
  name: string;
  /** Short description for the page header */
  description: string;
  /** Icon component */
  icon: React.ComponentType<{ className?: string }>;
  /** Category-specific filter selects shown above the grid */
  extraFilters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  /** Price range presets specific to this category */
  priceRanges?: Array<{ value: string; label: string }>;
  /** Whether condition filter applies */
  showCondition?: boolean;
  /** Read-only profile catalog category; public sellers cannot add ordinary listings here. */
  catalogOnly?: boolean;
  /**
   * Config-driven spec badges shown on each item card.
   * `specKey` looks up item.specifications[specKey] first, then item[specKey] for top-level fields.
   * `trueValue` / `trueLabel` renders a badge only when the value equals trueValue.
   * `valueMap` maps raw values to display labels.
   * `colorMap` maps raw values to Tailwind color names (green | yellow | red | orange | sky | purple).
   * `suffix` appends a unit string after the value.
   * `isTopLevel` reads from the top-level ExchangeItem field instead of specifications.
   */
  cardBadges?: Array<{
    specKey: string;
    label: string;
    isTopLevel?: boolean;
    suffix?: string;
    trueValue?: string;
    trueLabel?: string;
    valueMap?: Record<string, string>;
    colorMap?: Record<string, string>;
  }>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price == null || !Number.isFinite(price) || price < 0) return "Request quote";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

function formatListedTime(createdAt: string): string {
  try {
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch {
    return "";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ExchangeCategoryPageProps {
  config: CategoryConfig;
}

export function ExchangeCategoryPage({ config }: ExchangeCategoryPageProps) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const locationCtx = useLocationContext();
  const stateCode = locationCtx.stateCode as string | undefined;
  const countyFips = locationCtx.countyFips as string | undefined;
  const countyCommitted = hasCountyContext(locationCtx as any);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [conditionFilter, setConditionFilter] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [extraFilterValues, setExtraFilterValues] = useState<Record<string, string>>({});
  const [searchScope, setSearchScope] = useState<SearchScope>(
    countyCommitted ? "local" : stateCode ? "state" : "nationwide"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ── Contact dialog ─────────────────────────────────────────────────────────
  const [contactItem, setContactItem] = useState<ExchangeItem | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryOffer, setInquiryOffer] = useState("");

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
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ listingId, wasSaved }: { listingId: string; wasSaved: boolean }) => {
      const res = await apiRequest(
        wasSaved ? "DELETE" : "POST",
        `/api/exchange/favorites/${encodeURIComponent(listingId)}`
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/exchange/favorites"] }),
  });

  // ── Items query ────────────────────────────────────────────────────────────
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("categoryId", config.slug);
    if (searchQuery) p.set("search", searchQuery);
    if (priceRange) {
      const [min, max] = priceRange.split("-");
      if (min) p.set("priceMin", min);
      if (max && max !== "+") p.set("priceMax", max);
    }
    if (conditionFilter && conditionFilter !== "any") p.set("condition", conditionFilter);
    if (sortBy) p.set("sort", sortBy);
    if (searchScope === "local" && countyFips) p.set("filterCounty", countyFips);
    else if (searchScope === "state" && stateCode) p.set("filterState", stateCode);
    if (stateCode) p.set("stateCode", stateCode);
    if (countyFips) p.set("countyFips", countyFips);
    // Pass extra filter values as server-side query params
    for (const [key, val] of Object.entries(extraFilterValues)) {
      if (val) p.set(key, val);
    }
    return p.toString();
  }, [
    searchQuery,
    priceRange,
    conditionFilter,
    sortBy,
    searchScope,
    countyFips,
    stateCode,
    config.slug,
    extraFilterValues,
  ]);

  const { data: items = [], isLoading } = useQuery<ExchangeItem[]>({
    queryKey: ["/api/exchange/items", config.slug, queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/exchange/items?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch listings");
      return res.json();
    },
  });

  // filteredItems = items (all filtering is now server-side)
  const filteredItems = items;

  // ── Contact mutation ───────────────────────────────────────────────────────
  const sendInquiryMutation = useMutation({
    mutationFn: async () => {
      if (!contactItem) throw new Error("No item selected");
      const res = await apiRequest("POST", `/api/exchange/items/${contactItem.id}/inquire`, {
        message: inquiryMessage,
        offerPrice: inquiryOffer ? Number(inquiryOffer) : undefined,
      });
      if (!res.ok)
        throw new Error(formatUserFacingErrorMessage(await res.json(), "Failed to send inquiry"));
    },
    onSuccess: () => {
      toast({ title: "Inquiry sent", description: "The seller will be notified." });
      setContactItem(null);
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

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async (item: ExchangeItem) => {
    await share({
      path: `/exchange/${config.slug}/${encodeURIComponent(item.id)}`,
      title: item.title || "Exchange listing",
      text: item.description,
      contextLabel: "Listing link",
    });
  };

  const handleShareCategory = async () => {
    await share({
      path: `/exchange/${config.slug}`,
      title: `${config.name} | TradeScout Exchange`,
      text: config.description,
      contextLabel: "Category link",
    });
  };

  // ── Price ranges ───────────────────────────────────────────────────────────
  const priceRanges = config.priceRanges || [
    { value: "", label: "Any Price" },
    { value: "0-1000", label: "Under $1K" },
    { value: "1000-5000", label: "$1K – $5K" },
    { value: "5000-25000", label: "$5K – $25K" },
    { value: "25000-100000", label: "$25K – $100K" },
    { value: "100000+", label: "$100K+" },
  ];

  const IconComponent = config.icon;

  // ── SEO canonical ──────────────────────────────────────────────────────────
  const catName = EXCHANGE_CATEGORY_TO_MARKETPLACE_NAME[config.slug] || config.name;

  // ── Filter panel (shared between sheet and sidebar) ────────────────────────
  const FilterPanel = () => (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/60" />
        <Input
          placeholder={`Search ${config.name.toLowerCase()}…`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-10 bg-white/5 border-white/10 text-white text-sm"
        />
      </div>

      {/* Scope */}
      {!config.catalogOnly && (
        <Select value={searchScope} onValueChange={(v) => setSearchScope(v as SearchScope)}>
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
            <SelectValue placeholder="Search scope" />
          </SelectTrigger>
          <SelectContent className="bg-tsCard border-white/10">
            <SelectItem value="local">My County</SelectItem>
            <SelectItem value="state">My State</SelectItem>
            <SelectItem value="nationwide">Nationwide</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Price */}
      {!config.catalogOnly && (
        <Select value={priceRange} onValueChange={setPriceRange}>
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
            <SelectValue placeholder="Price Range" />
          </SelectTrigger>
          <SelectContent className="bg-tsCard border-white/10">
            {priceRanges.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Condition */}
      {config.showCondition !== false && (
        <Select value={conditionFilter} onValueChange={setConditionFilter}>
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent className="bg-tsCard border-white/10">
            <SelectItem value="any">Any Condition</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="like_new">Like New</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="fair">Fair</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Category-specific extra filters */}
      {(config.extraFilters || []).map((ef) => (
        <Select
          key={ef.key}
          value={extraFilterValues[ef.key] || ""}
          onValueChange={(v) => setExtraFilterValues((prev) => ({ ...prev, [ef.key]: v }))}
        >
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
            <SelectValue placeholder={ef.label} />
          </SelectTrigger>
          <SelectContent className="bg-tsCard border-white/10">
            <SelectItem value="">Any {ef.label}</SelectItem>
            {ef.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {/* Sort */}
      {!config.catalogOnly && (
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-9 bg-white/5 border-white/10 text-white text-sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent className="bg-tsCard border-white/10">
            <SelectItem value="date_desc">Newest First</SelectItem>
            <SelectItem value="date_asc">Oldest First</SelectItem>
            <SelectItem value="price_asc">Price: Low to High</SelectItem>
            <SelectItem value="price_desc">Price: High to Low</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* Reset */}
      {(searchQuery ||
        priceRange ||
        conditionFilter ||
        Object.values(extraFilterValues).some(Boolean)) && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-white/60 hover:text-white h-8 text-xs"
          onClick={() => {
            setSearchQuery("");
            setPriceRange("");
            setConditionFilter("");
            setExtraFilterValues({});
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <>
      <SEOHelmet
        title={`${catName} | TradeScout Exchange`}
        description={config.description}
        canonical={`https://www.thetradescout.com/exchange/${config.slug}`}
        keywords={`${catName}, buy locally, tradescout exchange, local marketplace`}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 space-y-4">
        {/* ── Header ── */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 sm:p-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
            <Link href="/exchange" className="hover:text-white/80 transition-colors">
              Exchange
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/80">{config.name}</span>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 bg-ts-orange/15 rounded-xl flex items-center justify-center">
                <IconComponent className="h-5 w-5 text-ts-orange" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-white leading-tight">
                  {config.name}
                </h1>
                <p className="text-xs sm:text-sm text-white/60 mt-0.5 line-clamp-2">
                  {config.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white/60 hover:text-white"
                onClick={handleShareCategory}
                title="Share this category"
              >
                <Share2 className="h-4 w-4" />
              </Button>
              {!config.catalogOnly && (
                <Button
                  size="sm"
                  className="h-8 px-3 bg-ts-orange hover:bg-ts-orange-dark text-xs font-medium"
                  onClick={() => navigate(`/exchange?tab=sell&category=${config.slug}`)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Sell
                </Button>
              )}
            </div>
          </div>

          {/* Mobile filter trigger */}
          <div className="mt-3 flex items-center gap-2 xl:hidden">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/50" />
              <Input
                placeholder={`Search ${config.name.toLowerCase()}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9 bg-white/5 border-white/10 text-white text-sm"
              />
            </div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3 border-white/10 text-white/70 shrink-0"
                >
                  <Filter className="h-4 w-4 mr-1.5" />
                  Filters
                  {(priceRange ||
                    conditionFilter ||
                    Object.values(extraFilterValues).some(Boolean)) && (
                    <span className="ml-1.5 w-4 h-4 rounded-full bg-ts-orange text-white text-[10px] flex items-center justify-center">
                      !
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="bg-tsCard border-white/10 rounded-t-2xl max-h-[80vh] overflow-y-auto"
              >
                <SheetHeader className="pb-3">
                  <SheetTitle className="text-white text-base flex items-center gap-2">
                    <Filter className="h-4 w-4 text-ts-orange" />
                    Filters
                  </SheetTitle>
                </SheetHeader>
                <FilterPanel />
                <Button
                  className="w-full mt-4 bg-ts-orange hover:bg-ts-orange-dark"
                  onClick={() => setFiltersOpen(false)}
                >
                  Show {filteredItems.length}{" "}
                  {config.catalogOnly
                    ? `catalog spotlight${filteredItems.length !== 1 ? "s" : ""}`
                    : `listing${filteredItems.length !== 1 ? "s" : ""}`}
                </Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* ── Body: sidebar + grid ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[260px,1fr] gap-4">
          {/* Desktop sidebar */}
          <Card className="hidden xl:block bg-tsCard border-white/10 h-fit xl:sticky xl:top-20">
            <CardHeader className="pb-1">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Filter className="h-4 w-4 text-ts-orange" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FilterPanel />
            </CardContent>
          </Card>

          {/* Item grid */}
          <div>
            {/* Result count + scope pills */}
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <p className="text-sm text-white/60">
                {isLoading ? (
                  "Loading…"
                ) : (
                  <>
                    <span className="text-white font-medium">{filteredItems.length}</span>{" "}
                    {config.catalogOnly
                      ? `catalog spotlight${filteredItems.length !== 1 ? "s" : ""}`
                      : `listing${filteredItems.length !== 1 ? "s" : ""}`}
                  </>
                )}
              </p>
              {!config.catalogOnly && (
                <div className="flex gap-1.5">
                  {(["local", "state", "nationwide"] as SearchScope[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSearchScope(s)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        searchScope === s
                          ? "bg-ts-orange text-white"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {s === "local" ? "Local" : s === "state" ? "State" : "All"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="bg-tsCard border-white/10 animate-pulse">
                    <div className="aspect-video bg-white/5 rounded-t-lg" />
                    <CardContent className="p-3 space-y-2">
                      <div className="h-4 bg-white/10 rounded w-3/4" />
                      <div className="h-3 bg-white/10 rounded w-1/2" />
                      <div className="h-6 bg-white/10 rounded w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={<Search />}
                title={`No ${config.name.toLowerCase()} found`}
                description={
                  config.catalogOnly
                    ? "Try a broader search. Catalog spotlights are added only from maintained TradeScout business profiles."
                    : "Try broader filters, a different scope, or be the first to list."
                }
                actionLabel={config.catalogOnly ? undefined : "List something"}
                onAction={
                  config.catalogOnly
                    ? undefined
                    : () => navigate(`/exchange?tab=sell&category=${config.slug}`)
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredItems.map((item) => {
                  const isFaved = favoriteSet.has(item.id);
                  const isProfileOffer = item.sourceType === "profile_offer";
                  const isProfileCatalog = item.sourceType === "profile_catalog";
                  const isProfileLinked = isProfileOffer || isProfileCatalog;
                  const detailPath = `/exchange/${config.slug}/${item.id}`;
                  return (
                    <Card
                      key={item.id}
                      className={`bg-tsCard border-white/10 hover:border-white/20 transition-colors overflow-hidden ${
                        item.featured ? "ring-1 ring-ts-orange/40" : ""
                      }`}
                    >
                      {/* Image — click to open detail page */}
                      <div className="cursor-pointer" onClick={() => navigate(detailPath)}>
                        {item.images.length > 0 ? (
                          <div className="aspect-video bg-black/40 overflow-hidden">
                            <img
                              src={item.images[0]}
                              alt={item.title}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                              loading="lazy"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video bg-white/5 flex items-center justify-center">
                            <IconComponent className="h-10 w-10 text-white/20" />
                          </div>
                        )}
                      </div>

                      <CardContent className="p-3">
                        {/* Featured badge */}
                        {isProfileCatalog ? (
                          <Badge className="mb-1.5 bg-sky-500/15 text-sky-200 border-sky-400/30 text-[10px]">
                            Profile catalog
                          </Badge>
                        ) : item.featured ? (
                          <Badge className="mb-1.5 bg-ts-orange/20 text-ts-orange border-ts-orange/30 text-[10px]">
                            Featured
                          </Badge>
                        ) : null}

                        {/* Title + price */}
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h3
                            className="text-sm font-semibold text-white line-clamp-2 leading-snug flex-1 cursor-pointer hover:text-ts-orange transition-colors"
                            onClick={() => navigate(detailPath)}
                          >
                            {item.title}
                          </h3>
                          <span className="text-sm font-bold text-ts-orange shrink-0">
                            {formatPrice(item.price)}
                          </span>
                        </div>

                        {/* Location + time */}
                        <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </span>
                          <span className="shrink-0 ml-2">
                            {isProfileCatalog ? "Managed request" : formatListedTime(item.createdAt)}
                          </span>
                        </div>

                        {/* Config-driven category-specific spec badges */}
                        {config.cardBadges &&
                          config.cardBadges.length > 0 &&
                          (() => {
                            const COLOR_CLASSES: Record<string, string> = {
                              green: "border-emerald-500/30 text-emerald-300",
                              yellow: "border-yellow-500/30 text-yellow-300",
                              red: "border-red-500/30 text-red-300",
                              orange: "border-orange-500/30 text-orange-300",
                              sky: "border-sky-500/30 text-sky-300",
                              purple: "border-purple-500/30 text-purple-300",
                            };
                            const badges = config.cardBadges!.flatMap((b, idx) => {
                              const raw = b.isTopLevel
                                ? (item as any)[b.specKey]
                                : item.specifications?.[b.specKey];
                              if (raw == null || raw === "") return [];
                              // trueValue mode
                              if (b.trueValue !== undefined) {
                                if (String(raw) !== b.trueValue) return [];
                                return [
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className={`text-[10px] ${
                                      b.colorMap?.[raw]
                                        ? (COLOR_CLASSES[b.colorMap[raw]] ??
                                          "border-white/10 text-white/60")
                                        : "border-emerald-500/30 text-emerald-300"
                                    }`}
                                  >
                                    {b.trueLabel ?? b.label}
                                  </Badge>,
                                ];
                              }
                              // valueMap mode
                              const display = b.valueMap?.[String(raw)] ?? String(raw);
                              const colorKey = b.colorMap?.[String(raw)];
                              const colorClass = colorKey
                                ? (COLOR_CLASSES[colorKey] ?? "border-white/10 text-white/60")
                                : "border-white/10 text-white/60";
                              const text = b.suffix
                                ? `${typeof raw === "number" ? raw.toLocaleString() : display}${b.suffix}`
                                : display;
                              return [
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className={`text-[10px] ${colorClass}`}
                                >
                                  {text}
                                </Badge>,
                              ];
                            });
                            if (badges.length === 0) return null;
                            return <div className="flex flex-wrap gap-1 mb-2">{badges}</div>;
                          })()}
                        {/* Set / Collection badge (always shown when present) */}
                        {item.specifications?.listingType && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            <Badge
                              variant="outline"
                              className="border-purple-500/30 text-[10px] text-purple-300"
                            >
                              {item.specifications.listingType === "collection"
                                ? "Collection"
                                : "Set"}
                              {Array.isArray(item.specifications?.setItems)
                                ? ` · ${item.specifications.setItems.length} items`
                                : ""}
                            </Badge>
                          </div>
                        )}

                        {/* Shipping badge */}
                        {!isProfileCatalog && (
                          <div className="mb-2">
                            {item.isLocalPickupOnly ? (
                              <Badge
                                variant="outline"
                                className="border-white/10 text-[10px] text-white/50"
                              >
                                Local pickup
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-emerald-500/30 text-[10px] text-emerald-300"
                              >
                                Shipping available
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Seller row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                              <span className="text-[10px] text-white">{item.seller.name[0]}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-white/60 truncate">
                                {item.seller.name}
                              </p>
                              <div className="flex items-center text-[10px] text-white/50">
                                {item.seller.verified ? (
                                  <span className="text-emerald-400">Verified seller</span>
                                ) : (
                                  <span>{isProfileCatalog ? "Business profile" : "Seller profile"}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!isProfileLinked && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={`h-7 w-7 p-0 ${isFaved ? "text-rose-400" : "text-white/50 hover:text-white"}`}
                                onClick={() => {
                                  if (!isAuthenticated) {
                                    navigate("/pre-scout-setup?mode=signin");
                                    return;
                                  }
                                  toggleFavoriteMutation.mutate({
                                    listingId: item.id,
                                    wasSaved: isFaved,
                                  });
                                }}
                              >
                                <Heart className={`h-3.5 w-3.5 ${isFaved ? "fill-current" : ""}`} />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-white/50 hover:text-white"
                              onClick={() => handleShare(item)}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-2.5 bg-ts-orange hover:bg-ts-orange-dark text-[11px]"
                              onClick={() => navigate(detailPath)}
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {isProfileOffer ? "Buy" : isProfileCatalog ? "View catalog" : "View"}
                            </Button>
                          </div>
                        </div>

                        {/* Stats */}
                        {!isProfileCatalog && (
                          <div className="mt-2 flex items-center gap-3 text-[10px] text-white/40">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {item.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {item.favorites}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Contact / Inquiry dialog ── */}
      <Dialog open={!!contactItem} onOpenChange={(open) => !open && setContactItem(null)}>
        <DialogContent className="bg-tsCard border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Request Quote / Inquiry</DialogTitle>
          </DialogHeader>
          {contactItem && (
            <div className="space-y-3">
              <p className="text-sm text-white/70 line-clamp-2">{contactItem.title}</p>
              <div>
                <Label className="text-white/70 text-xs mb-1 block">Message</Label>
                <Textarea
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  rows={3}
                  className="bg-white/5 border-white/10 text-white text-sm resize-none"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs mb-1 block">Offer Price (optional)</Label>
                <Input
                  type="number"
                  value={inquiryOffer}
                  onChange={(e) => setInquiryOffer(e.target.value)}
                  placeholder="Leave blank to ask for asking price"
                  className="h-9 bg-white/5 border-white/10 text-white text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="flex-1 border-white/10 text-white/70"
                  onClick={() => setContactItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-ts-orange hover:bg-ts-orange-dark"
                  disabled={!inquiryMessage.trim() || sendInquiryMutation.isPending}
                  onClick={() => sendInquiryMutation.mutate()}
                >
                  {sendInquiryMutation.isPending ? "Sending…" : "Send Inquiry"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
